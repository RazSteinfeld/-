import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { CATEGORIES, getCategory } from '../categories';
import { normalizeMerchant } from '../categorize';
import { formatDate, monthLabel } from '../dates';
import { flowOf, type MonthSummary } from '../insights';
import type { Transaction } from '../types';
import { Button, CategoryBadge, Chip, IconButton, Money, PressableScale, Row, Sheet, T, type IconName } from './components';
import { CHEVRON_BACK, CHEVRON_FORWARD, ROW } from './rtl';
import { radius, spacing, usePalette } from './theme';

/* ---------- בורר חודש ---------- */

export function MonthSwitcher({
  months, selected, onChange,
}: { months: MonthSummary[]; selected: string | null; onChange: (key: string) => void }) {
  const p = usePalette();
  const idx = months.findIndex((m) => m.key === selected);
  if (idx < 0) return null;
  const cur = months[idx];
  const hasPrev = idx > 0;
  const hasNext = idx < months.length - 1;
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      {/* בעברית "חודש קודם" בצד ימין */}
      <IconButton icon={CHEVRON_BACK} label="חודש קודם" onPress={() => hasPrev && onChange(months[idx - 1].key)} size={38} />
      <View style={{ alignItems: 'center', gap: 2, opacity: 1 }}>
        <T variant="headline" align="center">{monthLabel(cur.key)}</T>
        {cur.ongoing ? (
          <T variant="micro" color={p.primary} align="center">החודש הנוכחי</T>
        ) : cur.partial ? (
          <T variant="micro" color={p.warning} align="center">חודש חלקי</T>
        ) : null}
      </View>
      <View style={{ opacity: hasNext ? 1 : 0.35 }}>
        <IconButton icon={CHEVRON_FORWARD} label="חודש הבא" onPress={() => hasNext && onChange(months[idx + 1].key)} size={38} />
      </View>
    </Row>
  );
}

/* ---------- שורת תנועה ---------- */

const SOURCE_ICON: Record<string, IconName> = { card: 'credit-card-outline', bank: 'bank-outline', manual: 'pencil-outline' };

export function TransactionRow({ t, onPress, showDate }: { t: Transaction; onPress?: (t: Transaction) => void; showDate?: boolean }) {
  const p = usePalette();
  const cat = getCategory(t.category);
  const flow = flowOf(t);
  const excluded = flow.kind === 'none';
  const positive = t.amount > 0;
  const meta: string[] = [cat.label];
  if (t.installment) meta.push(`תשלום ${t.installment.index}/${t.installment.total}`);
  if (showDate) meta.push(formatDate(t.date));
  return (
    <PressableScale
      onPress={() => onPress?.(t)}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`${t.description}, ${cat.label}`}
      style={{ flexDirection: ROW, alignItems: 'center', gap: spacing.md, paddingVertical: 10 }}
    >
      <CategoryBadge id={t.category} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="bodyStrong" numberOfLines={1}>{t.description}</T>
        <Row gap={6}>
          <MaterialCommunityIcons name={SOURCE_ICON[t.source]} size={13} color={p.textMuted} />
          <T variant="caption" color="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>{meta.join(' · ')}</T>
        </Row>
      </View>
      <View style={{ alignItems: 'flex-start', gap: 2 }}>
        <Money value={t.amount} sign={positive} color={excluded ? p.textMuted : positive ? p.positive : p.text} />
        {excluded ? <T variant="micro" color="textMuted" align="left">לא נספר</T> : null}
      </View>
    </PressableScale>
  );
}

/* ---------- עריכת תנועה ---------- */

export function TransactionSheet({
  tx, onClose, onSetCategory, onDelete, merchantCount,
}: {
  tx: Transaction | null;
  onClose: () => void;
  onSetCategory: (id: string, categoryId: string, applyToMerchant: boolean) => void;
  onDelete: (id: string) => void;
  /** כמה תנועות נוספות של אותו בית עסק */
  merchantCount: (t: Transaction) => number;
}) {
  const p = usePalette();
  const [applyAll, setApplyAll] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const shown = tx;
  const others = shown ? merchantCount(shown) : 0;
  const incomeLike = shown ? shown.amount > 0 : false;
  const groups: { title: string; kind: 'expense' | 'income' | 'transfer' }[] = [
    { title: 'הוצאות', kind: 'expense' },
    { title: 'הכנסות', kind: 'income' },
    { title: 'לא נספר בחישובים', kind: 'transfer' },
  ];
  if (incomeLike) groups.sort((a, b) => (a.kind === 'income' ? -1 : b.kind === 'income' ? 1 : 0));
  return (
    <Sheet visible={!!tx} onClose={() => { setConfirmDelete(false); onClose(); }} title="פרטי תנועה">
      {shown ? (
        <>
          <Row gap={spacing.md} style={{ paddingBottom: spacing.xs }}>
            <CategoryBadge id={shown.category} size={52} />
            <View style={{ flex: 1 }}>
              <T variant="headline" numberOfLines={2}>{shown.description}</T>
              <T variant="caption" color="textSecondary">
                {formatDate(shown.date)}
                {shown.purchaseDate && shown.purchaseDate !== shown.date ? ` · נרכש ב-${formatDate(shown.purchaseDate)}` : ''}
              </T>
            </View>
            <Money value={shown.amount} sign variant="title" color={shown.amount > 0 ? p.positive : p.text} />
          </Row>
          {shown.installment ? (
            <T variant="caption" color="textSecondary">
              תשלום {shown.installment.index} מתוך {shown.installment.total}
              {shown.installment.originalAmount ? ` · סכום העסקה המלא ₪${Math.round(shown.installment.originalAmount).toLocaleString('en-US')}` : ''}
            </T>
          ) : null}
          {shown.note ? <T variant="caption" color="textSecondary">{shown.note}</T> : null}

          {others > 0 ? (
            <Row style={{ justifyContent: 'space-between', backgroundColor: p.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}>
              <View style={{ flex: 1 }}>
                <T variant="bodyStrong">החל על כל בית העסק</T>
                <T variant="caption" color="textSecondary">{`עוד ${others} תנועות של "${normalizeMerchant(shown.description) || shown.description}" ובייבואים הבאים`}</T>
              </View>
              <Switch value={applyAll} onValueChange={setApplyAll} trackColor={{ true: p.primary, false: p.border }} thumbColor="#fff" />
            </Row>
          ) : null}

          {groups.map((g) => (
            <View key={g.kind} style={{ gap: spacing.sm }}>
              <T variant="captionStrong" color="textSecondary">{g.title}</T>
              <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: 8 }}>
                {CATEGORIES.filter((c) => c.kind === g.kind).map((c) => (
                  <Chip
                    key={c.id}
                    label={c.label}
                    icon={c.icon as IconName}
                    color={c.color}
                    selected={shown.category === c.id}
                    onPress={() => {
                      onSetCategory(shown.id, c.id, others > 0 && applyAll);
                      onClose();
                    }}
                  />
                ))}
              </View>
            </View>
          ))}

          {confirmDelete ? (
            <Row gap={spacing.sm}>
              <Button label="כן, למחוק" variant="danger" style={{ flex: 1 }} onPress={() => { onDelete(shown.id); setConfirmDelete(false); onClose(); }} />
              <Button label="ביטול" variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmDelete(false)} />
            </Row>
          ) : (
            <Pressable onPress={() => setConfirmDelete(true)} style={{ alignSelf: 'center', padding: spacing.sm }} accessibilityRole="button" accessibilityLabel="מחק תנועה">
              <Row gap={6}>
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={p.negative} />
                <T variant="captionStrong" color={p.negative}>מחק תנועה</T>
              </Row>
            </Pressable>
          )}
        </>
      ) : null}
    </Sheet>
  );
}
