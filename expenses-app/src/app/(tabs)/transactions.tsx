import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, getCategory } from '../../categories';
import { normalizeMerchant } from '../../categorize';
import { dayHeading, monthKey, monthLabel } from '../../dates';
import { flowOf } from '../../insights';
import { useStore } from '../../store';
import type { Source, Transaction } from '../../types';
import {
  Button, Card, Chip, EmptyState, Money, Row, ScreenHeader, Sheet, Skeleton, T, type IconName,
} from '../../ui/components';
import { TransactionRow, TransactionSheet } from '../../ui/parts';
import { ROW } from '../../ui/rtl';
import { fonts, radius, spacing, usePalette } from '../../ui/theme';

type TypeFilter = 'all' | 'expense' | 'income';

const SOURCE_LABEL: Record<Source, string> = { card: 'כרטיס אשראי', bank: 'חשבון בנק', manual: 'ידני' };

export default function Transactions() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; month?: string }>();
  const { ready, transactions, month, today, setCategory, deleteTransaction } = useStore();

  const [query, setQuery] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [category, setCategoryFilter] = useState<string | null>(params.category ?? null);
  const [source, setSource] = useState<Source | null>(null);
  const [scope, setScope] = useState<'month' | 'all'>(params.category && !params.month ? 'all' : 'month');
  const [filterOpen, setFilterOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  // כניסה חוזרת ממסך הסקירה/החיסכון עם קטגוריה או חודש אחרים: מעדכנים את המסנן
  const paramSig = `${params.category ?? ''}|${params.month ?? ''}`;
  const [seenSig, setSeenSig] = useState(paramSig);
  if (paramSig !== seenSig) {
    setSeenSig(paramSig);
    if (params.category) {
      setCategoryFilter(params.category);
      setScope(params.month ? 'month' : 'all');
      setType('all');
    }
  }

  const activeMonth = (params.category && params.month) || month;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qNum = q && /^[\d.,]+$/.test(q) ? q.replace(/,/g, '') : null;
    return transactions.filter((t) => {
      if (scope === 'month' && activeMonth && monthKey(t.date) !== activeMonth) return false;
      if (category && t.category !== category) return false;
      if (source && t.source !== source) return false;
      if (type === 'expense' && t.amount >= 0) return false;
      if (type === 'income' && t.amount <= 0) return false;
      if (q) {
        const hay = `${t.description} ${getCategory(t.category).label}`.toLowerCase();
        if (!hay.includes(q) && !(qNum && String(Math.abs(t.amount)).includes(qNum))) return false;
      }
      return true;
    });
  }, [transactions, scope, activeMonth, category, source, type, query]);

  const sections = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const arr = map.get(t.date);
      if (arr) arr.push(t);
      else map.set(t.date, [t]);
    }
    return [...map.entries()].map(([date, data]) => ({ date, title: dayHeading(date, today), data }));
  }, [filtered, today]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      const f = flowOf(t);
      if (f.kind === 'income') income += f.value;
      else if (f.kind === 'expense') expense += f.value;
    }
    return { income, expense };
  }, [filtered]);

  const merchantCount = useCallback(
    (t: Transaction) => {
      const key = normalizeMerchant(t.description);
      if (!key) return 0;
      let n = 0;
      for (const o of transactions) if (o.id !== t.id && normalizeMerchant(o.description) === key) n++;
      return n;
    },
    [transactions],
  );

  const activeFilters = (category ? 1 : 0) + (source ? 1 : 0);
  const clearAll = () => {
    setQuery('');
    setType('all');
    setCategoryFilter(null);
    setSource(null);
    setScope('month');
    router.setParams({ category: undefined, month: undefined });
  };

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
      <ScreenHeader
        title="תנועות"
        subtitle={ready ? `${filtered.length} תנועות${scope === 'month' && activeMonth ? ` · ${monthLabel(activeMonth)}` : ' · כל התקופה'}` : undefined}
      />
      <Row
        gap={spacing.sm}
        style={{ backgroundColor: p.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 50, borderWidth: 1, borderColor: p.border }}
      >
        <MaterialCommunityIcons name="magnify" size={22} color={p.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="חיפוש לפי שם בית עסק, קטגוריה או סכום"
          placeholderTextColor={p.textMuted}
          style={{ flex: 1, textAlign: 'right', color: p.text, fontFamily: fonts.regular, fontSize: 15, paddingVertical: 0 }}
          returnKeyType="search"
          accessibilityLabel="חיפוש תנועות"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="נקה חיפוש">
            <MaterialCommunityIcons name="close-circle" size={20} color={p.textMuted} />
          </Pressable>
        ) : null}
      </Row>
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
        <Chip label="הכל" selected={type === 'all'} onPress={() => setType('all')} />
        <Chip label="הוצאות" selected={type === 'expense'} onPress={() => setType('expense')} icon="arrow-up" />
        <Chip label="הכנסות" selected={type === 'income'} onPress={() => setType('income')} icon="arrow-down" />
        <Chip label={activeFilters ? `סינון (${activeFilters})` : 'סינון'} icon="tune-variant" selected={activeFilters > 0} onPress={() => setFilterOpen(true)} />
      </Row>
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
        <Chip
          label={scope === 'month' ? 'החודש הנבחר' : 'כל התקופה'}
          icon={scope === 'month' ? 'calendar-month-outline' : 'infinity'}
          onPress={() => setScope((s) => (s === 'month' ? 'all' : 'month'))}
        />
        {category ? (
          <Chip label={getCategory(category).label} icon={getCategory(category).icon as IconName} color={getCategory(category).color} selected onPress={() => setCategoryFilter(null)} />
        ) : null}
        {source ? <Chip label={SOURCE_LABEL[source]} selected onPress={() => setSource(null)} /> : null}
      </Row>
      {filtered.length ? (
        <Card style={{ flexDirection: ROW, justifyContent: 'space-between', paddingVertical: spacing.md }}>
          <View style={{ gap: 2 }}>
            <T variant="micro" color="textMuted">הוצאות</T>
            <Money value={totals.expense} variant="headline" />
          </View>
          <View style={{ gap: 2 }}>
            <T variant="micro" color="textMuted">הכנסות</T>
            <Money value={totals.income} variant="headline" color={p.positive} />
          </View>
          <View style={{ gap: 2 }}>
            <T variant="micro" color="textMuted">נטו</T>
            <Money value={totals.income - totals.expense} variant="headline" sign />
          </View>
        </Card>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      {!ready ? (
        <View style={{ padding: spacing.lg, paddingTop: insets.top + spacing.lg, gap: spacing.md }}>
          <Skeleton height={36} width="40%" />
          <Skeleton height={50} radiusPx={16} />
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={56} />)}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(t) => t.id}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: 140 }}
          ListHeaderComponent={header}
          initialNumToRender={14}
          windowSize={9}
          renderSectionHeader={({ section }) => (
            <T variant="captionStrong" color="textSecondary" style={{ paddingTop: spacing.lg, paddingBottom: spacing.xs }}>{section.title}</T>
          )}
          renderItem={({ item, index, section }) => (
            <View
              style={{
                backgroundColor: p.surface,
                paddingHorizontal: spacing.md,
                borderTopLeftRadius: index === 0 ? radius.lg : 0,
                borderTopRightRadius: index === 0 ? radius.lg : 0,
                borderBottomLeftRadius: index === section.data.length - 1 ? radius.lg : 0,
                borderBottomRightRadius: index === section.data.length - 1 ? radius.lg : 0,
                borderBottomWidth: index === section.data.length - 1 ? 0 : 1,
                borderBottomColor: p.border,
              }}
            >
              <TransactionRow t={item} onPress={setEditing} />
            </View>
          )}
          ListEmptyComponent={
            transactions.length === 0 ? (
              <EmptyState
                icon="receipt-text-outline"
                title="אין עדיין תנועות"
                body="ייבא קובץ מ-Max או מהבנק כדי לראות כאן את כל התנועות, לחפש ולתקן סיווגים."
                actionLabel="ייבוא קבצים"
                onAction={() => router.push('/import')}
              />
            ) : (
              <EmptyState
                icon="text-search-variant"
                title="לא נמצאו תנועות"
                body="נסה לשנות את החיפוש או את הסינון, או להציג את כל התקופה."
                actionLabel="נקה סינון"
                onAction={clearAll}
              />
            )
          }
        />
      )}

      <Sheet visible={filterOpen} onClose={() => setFilterOpen(false)} title="סינון תנועות">
        <T variant="captionStrong" color="textSecondary">מקור</T>
        <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: 8 }}>
          {(['card', 'bank', 'manual'] as Source[]).map((s) => (
            <Chip key={s} label={SOURCE_LABEL[s]} selected={source === s} onPress={() => setSource(source === s ? null : s)} />
          ))}
        </View>
        <T variant="captionStrong" color="textSecondary">קטגוריה</T>
        <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.map((c) => (
            <Chip key={c.id} label={c.label} icon={c.icon as IconName} color={c.color} selected={category === c.id} onPress={() => setCategoryFilter(category === c.id ? null : c.id)} />
          ))}
        </View>
        <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
          <Button label="נקה הכל" variant="secondary" style={{ flex: 1 }} onPress={() => { setCategoryFilter(null); setSource(null); }} />
          <Button label={`הצג ${filtered.length} תנועות`} style={{ flex: 1 }} onPress={() => setFilterOpen(false)} />
        </Row>
      </Sheet>

      <TransactionSheet
        tx={editing}
        onClose={() => setEditing(null)}
        onSetCategory={setCategory}
        onDelete={deleteTransaction}
        merchantCount={merchantCount}
      />
    </View>
  );
}
