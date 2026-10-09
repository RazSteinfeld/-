import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { mergeBackup, type parseBackup } from './backup';
import { normalizeMerchant } from './categorize';
import { todayISO } from './dates';
import { mergeTransactions } from './importer';
import { buildSummaries, defaultMonth, type Summaries } from './insights';
import type { ParsedFile } from './parsers';
import { DEFAULT_SETTINGS, type Settings, type Transaction } from './types';

const TX_KEY = 'hv.transactions.v1';
const SETTINGS_KEY = 'hv.settings.v1';

export interface ImportSummary {
  files: { name: string; kind: 'card' | 'bank' | 'manual'; found: number; added: number; duplicates: number; skipped: number }[];
  added: number;
  duplicates: number;
}

interface StoreValue {
  ready: boolean;
  loadError: string | null;
  saveError: string | null;
  transactions: Transaction[];
  settings: Settings;
  today: string;
  summaries: Summaries;
  month: string | null;
  setMonth: (m: string) => void;
  importFiles: (files: ParsedFile[]) => ImportSummary;
  setCategory: (id: string, categoryId: string, applyToMerchant: boolean) => number;
  deleteTransaction: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  restoreBackup: (data: ReturnType<typeof parseBackup>, mode: 'replace' | 'merge') => { added: number };
  clearAll: () => void;
  retryLoad: () => void;
  resetAfterLoadError: () => void;
}

const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [today, setToday] = useState(todayISO());
  const [monthState, setMonthState] = useState<string | null>(null);
  const [loadTick, setLoadTick] = useState(0);

  // מונע דריסת נתונים קיימים אם הטעינה נכשלה
  const persistEnabled = useRef(false);
  const latest = useRef({ transactions, settings });
  useEffect(() => {
    latest.current = { transactions, settings };
  }, [transactions, settings]);
  const dirty = useRef(false);

  /* ----- טעינה ----- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rawTx, rawSettings] = await Promise.all([AsyncStorage.getItem(TX_KEY), AsyncStorage.getItem(SETTINGS_KEY)]);
        if (cancelled) return;
        const tx = rawTx ? (JSON.parse(rawTx) as Transaction[]) : [];
        if (!Array.isArray(tx)) throw new Error('bad transactions');
        const st = rawSettings ? { ...DEFAULT_SETTINGS, ...(JSON.parse(rawSettings) as Partial<Settings>) } : DEFAULT_SETTINGS;
        setTransactions(tx);
        setSettings(st);
        persistEnabled.current = true;
        setLoadError(null);
      } catch {
        if (cancelled) return;
        persistEnabled.current = false;
        setLoadError('לא הצלחתי לקרוא את הנתונים השמורים בטלפון.');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTick]);

  /* ----- שמירה ----- */
  const flush = useCallback(async () => {
    if (!persistEnabled.current || !dirty.current) return;
    dirty.current = false;
    try {
      await AsyncStorage.multiSet([
        [TX_KEY, JSON.stringify(latest.current.transactions)],
        [SETTINGS_KEY, JSON.stringify(latest.current.settings)],
      ]);
      setSaveError(null);
    } catch {
      dirty.current = true;
      setSaveError('השמירה בטלפון נכשלה. ייתכן שנגמר המקום בזיכרון. מומלץ לייצא גיבוי.');
    }
  }, []);

  useEffect(() => {
    if (!ready || !persistEnabled.current) return;
    dirty.current = true;
    const t = setTimeout(flush, 350);
    return () => clearTimeout(t);
  }, [transactions, settings, ready, flush]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') flush();
      else setToday(todayISO());
    });
    return () => sub.remove();
  }, [flush]);

  /* ----- נגזרים ----- */
  const summaries = useMemo(() => buildSummaries(transactions, today), [transactions, today]);
  const month = useMemo(() => {
    if (monthState && summaries.months.some((m) => m.key === monthState)) return monthState;
    return defaultMonth(summaries);
  }, [monthState, summaries]);

  /* ----- פעולות ----- */
  const importFiles = useCallback<StoreValue['importFiles']>(
    (files) => {
      let current = latest.current.transactions;
      const summary: ImportSummary = { files: [], added: 0, duplicates: 0 };
      for (const f of files) {
        const res = mergeTransactions(current, f.transactions, latest.current.settings);
        current = res.merged;
        summary.files.push({
          name: f.fileName,
          kind: f.kind,
          found: f.transactions.length,
          added: res.added,
          duplicates: res.duplicates,
          skipped: f.skippedRows,
        });
        summary.added += res.added;
        summary.duplicates += res.duplicates;
      }
      if (summary.added) {
        latest.current = { ...latest.current, transactions: current };
        setTransactions(current);
        setMonthState(null);
      }
      return summary;
    },
    [],
  );

  const setCategory = useCallback<StoreValue['setCategory']>((id, categoryId, applyToMerchant) => {
    const cur = latest.current.transactions;
    const target = cur.find((t) => t.id === id);
    if (!target) return 0;
    const key = normalizeMerchant(target.description);
    let changed = 0;
    const next = cur.map((t) => {
      const same = t.id === id || (applyToMerchant && key && normalizeMerchant(t.description) === key && !t.locked);
      if (!same) return t;
      if (t.category !== categoryId || (t.id === id && !t.locked)) changed++;
      return { ...t, category: categoryId, locked: t.id === id ? true : t.locked };
    });
    latest.current = { ...latest.current, transactions: next };
    setTransactions(next);
    if (applyToMerchant && key) {
      const settingsNext = { ...latest.current.settings, merchantRules: { ...latest.current.settings.merchantRules, [key]: categoryId } };
      latest.current = { ...latest.current, settings: settingsNext };
      setSettings(settingsNext);
    }
    return changed;
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const restoreBackup = useCallback<StoreValue['restoreBackup']>((data, mode) => {
    if (mode === 'replace') {
      setTransactions(data.transactions);
      setSettings({ ...data.settings, onboarded: true });
      setMonthState(null);
      return { added: data.transactions.length };
    }
    const merged = mergeBackup(latest.current.transactions, latest.current.settings, data);
    setTransactions(merged.transactions);
    setSettings(merged.settings);
    setMonthState(null);
    return { added: merged.added };
  }, []);

  const clearAll = useCallback(() => {
    persistEnabled.current = true;
    setTransactions([]);
    setSettings({ ...DEFAULT_SETTINGS, onboarded: true });
    setMonthState(null);
  }, []);

  const retryLoad = useCallback(() => {
    setReady(false);
    setLoadTick((n) => n + 1);
  }, []);

  const resetAfterLoadError = useCallback(() => {
    persistEnabled.current = true;
    setTransactions([]);
    setSettings(DEFAULT_SETTINGS);
    setLoadError(null);
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      ready, loadError, saveError, transactions, settings, today, summaries, month,
      setMonth: setMonthState, importFiles, setCategory, deleteTransaction, updateSettings,
      restoreBackup, clearAll, retryLoad, resetAfterLoadError,
    }),
    [ready, loadError, saveError, transactions, settings, today, summaries, month, importFiles, setCategory, deleteTransaction, updateSettings, restoreBackup, clearAll, retryLoad, resetAfterLoadError],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside StoreProvider');
  return v;
}
