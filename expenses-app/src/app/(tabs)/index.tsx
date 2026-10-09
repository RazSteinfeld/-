import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { getCategory } from '../../categories';
import { formatDate, monthLabel, monthShort } from '../../dates';
import { fmtMoney, fmtPct } from '../../format';
import {
  averages, categoryBreakdown, installmentCommitments, monthOverview, staleDays, topMerchants, trend,
} from '../../insights';
import { useStore } from '../../store';
import { DonutChart, MiniBars, TrendChart } from '../../ui/charts';
import {
  Banner, Card, CategoryBadge, EmptyState, FadeIn, IconButton, Money, PressableScale, ProgressBar, Row, Screen,
  ScreenHeader, Skeleton, T, useCountUp, type IconName,
} from '../../ui/components';
import { MonthSwitcher } from '../../ui/parts';
import { CHEVRON_FORWARD, ROW } from '../../ui/rtl';
import { radius, spacing, usePalette, withAlpha } from '../../ui/theme';

export default function Overview() {
  const p = usePalette();
  const { ready, transactions, summaries, month, setMonth, settings, today, restoreHint } = useOverviewData();
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const summary = summaries.months.find((m) => m.key === month) ?? null;
  const overview = useMemo(
    () => (summary ? monthOverview(summary, summaries.months, settings.expectedIncome, today) : null),
    [summary, summaries.months, settings.expectedIncome, today],
  );
  const animatedRemaining = useCountUp(overview?.remaining ?? 0);

  if (!ready) {
    return (
      <Screen>
        <Skeleton height={36} width="45%" />
        <Skeleton height={200} radiusPx={28} />
        <Skeleton height={220} radiusPx={22} />
      </Screen>
    );
  }

  if (!transactions.length || !summary || !overview) {
    return (
      <Screen header={<ScreenHeader title="סקירה" subtitle="הכנסות והוצאות במבט אחד" />}>
        <EmptyState
          icon="file-chart-outline"
          title="עוד אין כאן נתונים"
          body="ייבא קובץ פירוט מ-Max או תנועות מהבנק, ותראה תוך שניות כמה נשאר לך החודש, לאן הולך הכסף ואיפה אפשר לחסוך. הכול נשאר בטלפון שלך."
          actionLabel="ייבוא קבצים"
          onAction={() => router.push('/import')}
          secondaryLabel="שחזור מגיבוי"
          onSecondary={restoreHint}
        />
      </Screen>
    );
  }

  const breakdown = categoryBreakdown(summary);
  const slices = breakdown.map((b) => ({ id: b.id, value: b.amount, color: getCategory(b.id).color }));
  const selected = selectedCat ? breakdown.find((b) => b.id === selectedCat) : null;
  const trendData = trend(summaries.months, summary.key, 6).map((m) => ({
    key: m.key, label: monthShort(m.key), income: m.income, expense: m.expense, partial: m.partial,
  }));
  const avg = averages(summaries.months, undefined);
  const merchants = topMerchants(transactions, summary.key, 5);
  const commitments = installmentCommitments(transactions, today);
  const stale = summary.ongoing ? staleDays(summaries.range, today) : 0;

  const positive = overview.remaining >= 0;
  const spent = Math.min(1, overview.spentRatio);

  return (
    <Screen
      header={
        <FadeIn>
          <ScreenHeader
            title="סקירה"
            subtitle="הכנסות והוצאות במבט אחד"
            right={<IconButton icon="file-upload-outline" label="ייבוא קבצים" onPress={() => router.push('/import')} tone="primary" size={44} />}
          />
        </FadeIn>
      }
    >
      <FadeIn delay={40}>
        <MonthSwitcher months={summaries.months} selected={month} onChange={(k) => { setMonth(k); setSelectedCat(null); }} />
      </FadeIn>

      {summary.partial ? (
        <FadeIn delay={60}>
          <Banner
            tone="warning"
            text={
              summary.ongoing
                ? `החודש עוד לא נגמר, והנתונים מגיעים עד ${summary.lastDate ? formatDate(summary.lastDate) : '—'}.`
                : `בחודש הזה יש נתונים רק מ-${summary.firstDate ? formatDate(summary.firstDate) : '—'} עד ${summary.lastDate ? formatDate(summary.lastDate) : '—'}, ולכן הסכומים חלקיים.`
            }
          />
        </FadeIn>
      ) : null}
      {stale > 6 ? (
        <Banner tone="info" text={`התנועה האחרונה שיובאה היא מלפני ${stale} ימים. ייבא קובץ חדש כדי לעדכן.`} action="ייבוא" onAction={() => router.push('/import')} />
      ) : null}

      {/* כרטיס "כמה נשאר" */}
      <FadeIn delay={80}>
        <LinearGradient
          colors={positive ? p.heroGradient : ['#B3263A', '#D43D55', '#E8607A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: radius.xl, padding: spacing.xl, gap: spacing.lg, overflow: 'hidden' }}
        >
          <View style={{ position: 'absolute', top: -60, end: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <View style={{ position: 'absolute', bottom: -70, start: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.06)' }} />
          <View style={{ gap: 2 }}>
            <T variant="captionStrong" color="rgba(255,255,255,0.8)">
              {summary.ongoing ? 'נשאר החודש' : positive ? 'נשאר בסוף החודש' : 'חריגה בחודש'}
            </T>
            <T variant="hero" color="#FFFFFF">
              {fmtMoney(animatedRemaining)}
            </T>
            <T variant="caption" color="rgba(255,255,255,0.8)">
              {overview.incomeBasis > 0
                ? `מתוך הכנסה ${overview.incomeEstimated ? 'צפויה ' : ''}של ${fmtMoney(overview.incomeBasis)}`
                : 'עוד לא נכנסה הכנסה החודש. אפשר להגדיר הכנסה צפויה בלשונית "עוד".'}
            </T>
          </View>
          <View style={{ gap: 6 }}>
            <ProgressBar value={spent} color="#FFFFFF" track="rgba(255,255,255,0.22)" height={10} />
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="micro" color="rgba(255,255,255,0.85)">הוצא {fmtPct(overview.spentRatio * 100)}</T>
              {overview.daysLeft !== null ? <T variant="micro" color="rgba(255,255,255,0.85)">{overview.daysLeft === 1 ? 'נשאר יום אחד' : `נשארו ${overview.daysLeft} ימים`}</T> : null}
            </Row>
          </View>
          <Row gap={spacing.sm}>
            <HeroStat icon="arrow-down-circle-outline" label="הכנסות" value={summary.income} />
            <HeroStat icon="arrow-up-circle-outline" label="הוצאות" value={summary.expense} />
            {overview.dailyAllowance !== null ? <HeroStat icon="calendar-today" label="ליום" value={overview.dailyAllowance} /> : <HeroStat icon="swap-vertical" label="תנועות" raw={String(summary.count)} />}
          </Row>
          {overview.projectedExpense !== null ? (
            <T variant="caption" color="rgba(255,255,255,0.85)">
              בקצב הנוכחי תסיים את החודש עם הוצאות של כ-{fmtMoney(overview.projectedExpense)}.
            </T>
          ) : null}
        </LinearGradient>
      </FadeIn>

      {/* מגמה */}
      <FadeIn delay={120}>
        <Card style={{ gap: spacing.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="title">מגמה חודשית</T>
            <Row gap={12}>
              <Legend color={p.primary} label="הוצאות" />
              <Legend color={p.positive} label="הכנסות" />
            </Row>
          </Row>
          {trendData.length > 1 ? (
            <TrendChart data={trendData} selectedKey={summary.key} onSelect={(k) => { setMonth(k); setSelectedCat(null); }} average={avg && !avg.scaled ? avg.expense : undefined} />
          ) : (
            <T variant="caption" color="textSecondary">
              הגרף יתמלא כשיהיו נתונים ביותר מחודש אחד. ייבא קבצים נוספים כדי לראות מגמה.
            </T>
          )}
          {avg && trendData.length > 1 ? (
            <Row gap={6}>
              <View style={{ width: 14, height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: p.primary }} />
              <T variant="caption" color="textSecondary">ממוצע הוצאות חודשי: {fmtMoney(avg.expense)}{avg.scaled ? ' (הערכה)' : ''}</T>
            </Row>
          ) : null}
        </Card>
      </FadeIn>

      {/* קטגוריות */}
      <FadeIn delay={160}>
        <Card style={{ gap: spacing.lg }}>
          <T variant="title">לאן הולך הכסף</T>
          {breakdown.length ? (
            <>
              <View style={{ alignItems: 'center' }}>
                <DonutChart slices={slices} selectedId={selectedCat} onSelect={(id) => setSelectedCat((c) => (c === id ? null : id))}>
                  {selected ? (
                    <>
                      <CategoryBadge id={selected.id} size={36} />
                      <T variant="captionStrong" align="center" numberOfLines={1}>{getCategory(selected.id).label}</T>
                      <T variant="title" align="center">{fmtMoney(selected.amount)}</T>
                      <T variant="micro" color="textMuted" align="center">{fmtPct(selected.pct)} מההוצאות</T>
                    </>
                  ) : (
                    <>
                      <T variant="caption" color="textSecondary" align="center">סך הוצאות</T>
                      <T variant="display" align="center">{fmtMoney(summary.expense)}</T>
                      <T variant="micro" color="textMuted" align="center">{breakdown.length} קטגוריות</T>
                    </>
                  )}
                </DonutChart>
              </View>
              <View style={{ gap: 2 }}>
                {breakdown.slice(0, 8).map((b) => {
                  const c = getCategory(b.id);
                  const active = selectedCat === b.id;
                  return (
                    <PressableScale
                      key={b.id}
                      onPress={() => setSelectedCat((cur) => (cur === b.id ? null : b.id))}
                      scaleTo={0.985}
                      style={{
                        flexDirection: ROW, alignItems: 'center', gap: spacing.md, paddingVertical: 8, paddingHorizontal: 8,
                        borderRadius: radius.md, backgroundColor: active ? withAlpha(c.color, 0.1) : 'transparent',
                      }}
                    >
                      <CategoryBadge id={b.id} size={38} />
                      <View style={{ flex: 1, gap: 5 }}>
                        <Row style={{ justifyContent: 'space-between' }}>
                          <T variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>{c.label}</T>
                          <Money value={b.amount} />
                        </Row>
                        <Row gap={8}>
                          <View style={{ flex: 1 }}><ProgressBar value={b.pct / 100} color={c.color} height={5} /></View>
                          <T variant="micro" color="textMuted" align="left" style={{ minWidth: 34 }}>{fmtPct(b.pct)}</T>
                        </Row>
                      </View>
                    </PressableScale>
                  );
                })}
              </View>
              {selected ? (
                <PressableScale onPress={() => router.push({ pathname: '/transactions', params: { category: selected.id, month: summary.key } })} style={{ alignSelf: 'center' }}>
                  <Row gap={4}>
                    <T variant="captionStrong" color={p.primary}>הצג תנועות בקטגוריה</T>
                    <MaterialCommunityIcons name={CHEVRON_FORWARD} size={18} color={p.primary} />
                  </Row>
                </PressableScale>
              ) : null}
            </>
          ) : (
            <T variant="body" color="textSecondary">אין הוצאות בחודש הזה.</T>
          )}
        </Card>
      </FadeIn>

      {/* בתי עסק */}
      {merchants.length ? (
        <FadeIn delay={200}>
          <Card style={{ gap: spacing.xs }}>
            <T variant="title" style={{ marginBottom: spacing.xs }}>בתי העסק הגדולים</T>
            {merchants.map((m, i) => (
              <Row key={m.key} style={{ paddingVertical: 8 }}>
                <View style={{ width: 24, alignItems: 'center' }}>
                  <T variant="captionStrong" color="textMuted" align="center">{i + 1}</T>
                </View>
                <CategoryBadge id={m.category} size={38} />
                <View style={{ flex: 1 }}>
                  <T variant="bodyStrong" numberOfLines={1}>{m.name}</T>
                  <T variant="caption" color="textSecondary">{m.count === 1 ? 'תנועה אחת' : `${m.count} תנועות`}</T>
                </View>
                <Money value={m.total} />
              </Row>
            ))}
          </Card>
        </FadeIn>
      ) : null}

      {/* תשלומים עתידיים */}
      {commitments.byMonth.length ? (
        <FadeIn delay={240}>
          <Card style={{ gap: spacing.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T variant="title">תשלומים בדרך</T>
                <T variant="caption" color="textSecondary">
                  עוד {fmtMoney(commitments.totalRemaining)} ב-{commitments.series.length === 1 ? 'עסקת תשלומים אחת' : `${commitments.series.length} עסקאות תשלומים`}
                </T>
              </View>
              <MaterialCommunityIcons name="calendar-clock" size={26} color={p.primary} />
            </Row>
            <MiniBars
              color={p.primary}
              values={commitments.byMonth.slice(0, 6).map((c) => ({ key: c.month, label: monthShort(c.month), value: c.amount }))}
            />
            <T variant="caption" color="textSecondary">
              בחודש הקרוב ({monthLabel(commitments.byMonth[0].month, false)}) צפויים {fmtMoney(commitments.byMonth[0].amount)} מתשלומים קיימים.
            </T>
          </Card>
        </FadeIn>
      ) : null}
    </Screen>
  );
}

function useOverviewData() {
  const store = useStore();
  return {
    ...store,
    restoreHint: () => router.push({ pathname: '/more', params: { restore: '1' } }),
  };
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row gap={5}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
      <T variant="micro" color="textSecondary">{label}</T>
    </Row>
  );
}

function HeroStat({ icon, label, value, raw }: { icon: IconName; label: string; value?: number; raw?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius.md, padding: spacing.md, gap: 4 }}>
      <Row gap={5}>
        <MaterialCommunityIcons name={icon} size={15} color="rgba(255,255,255,0.85)" />
        <T variant="micro" color="rgba(255,255,255,0.85)">{label}</T>
      </Row>
      <T variant="headline" color="#FFFFFF">
        {raw ?? fmtMoney(value ?? 0)}
      </T>
    </View>
  );
}
