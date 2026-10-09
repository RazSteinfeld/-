import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { backupFileName, BackupError, createBackup, parseBackup } from '../../backup';
import { formatDate } from '../../dates';
import { fmtMoney } from '../../format';
import { pickBackupFile, shareBackupFile } from '../../files';
import { useStore } from '../../store';
import {
  Banner, Button, Card, Divider, FadeIn, IconCircle, Row, Screen, ScreenHeader, SettingsRow, Sheet, T,
} from '../../ui/components';
import { fonts, radius, spacing, usePalette } from '../../ui/theme';

type Notice = { tone: 'success' | 'error' | 'info'; text: string };

export default function More() {
  const p = usePalette();
  const params = useLocalSearchParams<{ restore?: string }>();
  const { transactions, settings, summaries, updateSettings, restoreBackup, clearAll, saveError } = useStore();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [incomeText, setIncomeText] = useState('');
  const [clearOpen, setClearOpen] = useState(false);
  const [pending, setPending] = useState<{ data: ReturnType<typeof parseBackup>; name: string } | null>(null);
  const [busy, setBusy] = useState<'export' | 'restore' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (n: Notice) => {
    setNotice(n);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 7000);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const versionCode = Constants.expoConfig?.android?.versionCode;

  const doExport = async () => {
    if (!transactions.length) {
      show({ tone: 'info', text: 'אין עדיין נתונים לגבות. ייבא קבצים קודם.' });
      return;
    }
    setBusy('export');
    try {
      const json = JSON.stringify(createBackup(transactions, settings, version));
      await shareBackupFile(backupFileName(), json);
      show({ tone: 'success', text: 'הגיבוי מוכן. שמור אותו ב-Drive, במייל או בקבצים כדי שלא יאבד.' });
    } catch (e) {
      show({ tone: 'error', text: `לא הצלחתי ליצור גיבוי. ${e instanceof Error ? e.message : ''}`.trim() });
    } finally {
      setBusy(null);
    }
  };

  const doRestorePick = async () => {
    setBusy('restore');
    try {
      const picked = await pickBackupFile();
      if (!picked) return;
      setPending({ data: parseBackup(picked.text), name: picked.name });
    } catch (e) {
      show({ tone: 'error', text: e instanceof BackupError ? e.message : 'לא הצלחתי לקרוא את קובץ הגיבוי.' });
    } finally {
      setBusy(null);
    }
  };

  // נפתח מכפתור "שחזור מגיבוי" במסך הריק
  useEffect(() => {
    if (params.restore) {
      router.setParams({ restore: undefined });
      setTimeout(() => { doRestorePick(); }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.restore]);

  const applyRestore = (mode: 'merge' | 'replace') => {
    if (!pending) return;
    const { added } = restoreBackup(pending.data, mode);
    setPending(null);
    show({ tone: 'success', text: mode === 'replace' ? `הנתונים שוחזרו: ${added.toLocaleString('en-US')} תנועות.` : `נוספו ${added.toLocaleString('en-US')} תנועות חדשות מהגיבוי.` });
  };

  const saveIncome = () => {
    const n = Number(incomeText.replace(/[^\d.]/g, ''));
    updateSettings({ expectedIncome: Number.isFinite(n) && n > 0 ? Math.round(n) : 0 });
    setIncomeOpen(false);
  };

  const range = summaries.range;

  return (
    <Screen header={<FadeIn><ScreenHeader title="עוד" subtitle="נתונים, גיבוי והגדרות" /></FadeIn>}>
      {notice ? <Banner tone={notice.tone} text={notice.text} /> : null}
      {saveError ? <Banner tone="error" text={saveError} /> : null}

      <FadeIn delay={40}>
        <Card style={{ gap: spacing.md }}>
          <Row gap={spacing.md}>
            <IconCircle icon="shield-lock-outline" color={p.positive} size={48} />
            <View style={{ flex: 1 }}>
              <T variant="headline">הנתונים שלך נשארים אצלך</T>
              <T variant="caption" color="textSecondary">
                הכול נשמר רק בטלפון הזה. אין שרת, אין חשבון, ואין אנליטיקס. לאפליקציה אפילו אין הרשאת אינטרנט.
              </T>
            </View>
          </Row>
          <Divider />
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <T variant="micro" color="textMuted">תנועות שמורות</T>
              <T variant="headline">{transactions.length.toLocaleString('en-US')}</T>
            </View>
            <View>
              <T variant="micro" color="textMuted">טווח תאריכים</T>
              <T variant="bodyStrong">{range ? `${formatDate(range.min)} – ${formatDate(range.max)}` : '—'}</T>
            </View>
          </Row>
        </Card>
      </FadeIn>

      <FadeIn delay={80}>
        <Card padded={false}>
          <SettingsRow icon="file-upload-outline" title="ייבוא קבצים" subtitle="Max, בנק מזרחי, Excel או CSV" onPress={() => router.push('/import')} />
          <Divider inset={spacing.lg} />
          <SettingsRow
            icon="content-save-outline"
            color={p.positive}
            title="ייצוא גיבוי"
            subtitle="שמירת כל הנתונים לקובץ JSON"
            onPress={busy ? undefined : doExport}
          />
          <Divider inset={spacing.lg} />
          <SettingsRow
            icon="backup-restore"
            color={p.warning}
            title="שחזור מגיבוי"
            subtitle="טעינת נתונים מקובץ גיבוי (החלפת טלפון או עדכון)"
            onPress={busy ? undefined : doRestorePick}
          />
        </Card>
      </FadeIn>

      <FadeIn delay={120}>
        <Card padded={false}>
          <SettingsRow
            icon="cash-plus"
            title="הכנסה חודשית צפויה"
            subtitle={settings.expectedIncome > 0 ? `${fmtMoney(settings.expectedIncome)} · משמש לחישוב "כמה נשאר"` : 'לא הוגדרה. מומלץ, כדי שהסקירה תעבוד גם לפני שהמשכורת נכנסה'}
            onPress={() => { setIncomeText(settings.expectedIncome ? String(settings.expectedIncome) : ''); setIncomeOpen(true); }}
          />
        </Card>
      </FadeIn>

      <FadeIn delay={160}>
        <Card padded={false}>
          <SettingsRow icon="trash-can-outline" danger title="מחיקת כל הנתונים" subtitle="מוחק את כל התנועות וההגדרות מהטלפון" onPress={() => setClearOpen(true)} />
        </Card>
      </FadeIn>

      <T variant="caption" color="textMuted" align="center">
        הכנסות והוצאות · גרסה {version}{versionCode ? ` (${versionCode})` : ''}
      </T>

      <Sheet visible={incomeOpen} onClose={() => setIncomeOpen(false)} title="הכנסה חודשית צפויה">
        <T variant="body" color="textSecondary">הסכום נטו שנכנס לך בדרך כלל בחודש. אם ההכנסה בפועל גבוהה יותר, האפליקציה תשתמש בה.</T>
        <TextInput
          value={incomeText}
          onChangeText={setIncomeText}
          keyboardType="number-pad"
          placeholder="לדוגמה 12000"
          placeholderTextColor={p.textMuted}
          autoFocus
          accessibilityLabel="הכנסה חודשית צפויה"
          style={{
            textAlign: 'right', fontFamily: fonts.bold, fontSize: 26, color: p.text, backgroundColor: p.surfaceAlt,
            borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 62,
          }}
        />
        <Row gap={spacing.sm}>
          <Button label="שמירה" onPress={saveIncome} style={{ flex: 1 }} />
          {settings.expectedIncome > 0 ? (
            <Button label="הסרה" variant="secondary" style={{ flex: 1 }} onPress={() => { updateSettings({ expectedIncome: 0 }); setIncomeOpen(false); }} />
          ) : null}
        </Row>
      </Sheet>

      <Sheet visible={!!pending} onClose={() => setPending(null)} title="שחזור מגיבוי">
        {pending ? (
          <>
            <Card style={{ backgroundColor: p.surfaceAlt, gap: 4 }}>
              <T variant="bodyStrong" numberOfLines={1}>{pending.name}</T>
              <T variant="caption" color="textSecondary">
                {pending.data.transactions.length.toLocaleString('en-US')} תנועות
                {pending.data.exportedAt ? ` · נוצר ב-${formatDate(pending.data.exportedAt.slice(0, 10))}` : ''}
              </T>
              {pending.data.dropped > 0 ? <T variant="caption" color={p.warning}>{pending.data.dropped} רשומות פגומות דולגו.</T> : null}
            </Card>
            <T variant="body" color="textSecondary">
              {'"מיזוג" מוסיף רק תנועות חדשות ומשאיר את הקיימות. "החלפה" מוחקת את הנתונים הנוכחיים ומחליפה אותם בגיבוי.'}
            </T>
            <Button label="מיזוג עם הנתונים הקיימים" icon="call-merge" onPress={() => applyRestore('merge')} />
            <Button label="החלפת הכול בגיבוי" variant="danger" icon="swap-horizontal" onPress={() => applyRestore('replace')} />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={clearOpen} onClose={() => setClearOpen(false)} title="למחוק את כל הנתונים?">
        <T variant="body" color="textSecondary">
          כל התנועות, הסיווגים וההגדרות יימחקו מהטלפון. אי אפשר לבטל. מומלץ לייצא גיבוי לפני.
        </T>
        <Button label="ייצוא גיבוי קודם" variant="secondary" icon="content-save-outline" onPress={() => { setClearOpen(false); doExport(); }} />
        <Button label="כן, מחק הכול" variant="danger" icon="trash-can-outline" onPress={() => { clearAll(); setClearOpen(false); show({ tone: 'info', text: 'כל הנתונים נמחקו.' }); }} />
        <Button label="ביטול" variant="ghost" onPress={() => setClearOpen(false)} />
      </Sheet>
    </Screen>
  );
}
