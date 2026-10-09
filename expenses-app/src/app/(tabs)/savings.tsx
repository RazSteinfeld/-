import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { buildSavings, type Opportunity } from '../../advice';
import { getCategory } from '../../categories';
import { monthLabel } from '../../dates';
import { fmtMoney, fmtPct } from '../../format';
import { useStore } from '../../store';
import {
  Banner, Card, CategoryBadge, EmptyState, FadeIn, IconCircle, Money, Pill, ProgressBar, Row, Screen, ScreenHeader,
  SectionHeader, Skeleton, T, useCountUp,
} from '../../ui/components';
import { MonthSwitcher } from '../../ui/parts';
import { ROW } from '../../ui/rtl';
import { radius, spacing, usePalette, withAlpha } from '../../ui/theme';

export default function Savings() {
  const p = usePalette();
  const { ready, transactions, summaries, month, setMonth } = useStore();
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const selected = summaries.months.find((m) => m.key === month) ?? null;
  const report = useMemo(() => buildSavings(transactions, summaries.months, selected), [transactions, summaries.months, selected]);
  const target = period === 'month' ? report.potentialMonthly : report.potentialYearly;
  const animated = useCountUp(target);

  if (!ready) {
    return (
      <Screen>
        <Skeleton height={36} width="40%" />
        <Skeleton height={180} radiusPx={28} />
        <Skeleton height={120} radiusPx={22} />
      </Screen>
    );
  }
  if (!transactions.length || !selected) {
    return (
      <Screen header={<ScreenHeader title="חיסכון" subtitle="איפה אפשר לחסוך בלי להרגיש" />}>
        <EmptyState
          icon="piggy-bank-outline"
          title="אין עדיין מה לנתח"
          body="אחרי שתייבא תנועות של חודש או שניים, אחשב כמה אפשר לחסוך, אראה השוואה לממוצע שלך ואזהה מנויים וחיובים קבועים."
          actionLabel="ייבוא קבצים"
          onAction={() => router.push('/import')}
        />
      </Screen>
    );
  }

  const hasBase = report.basedOnMonths > 0 || report.estimated;
  return (
    <Screen header={<FadeIn><ScreenHeader title="חיסכון" subtitle="איפה אפשר לחסוך בלי להרגיש" /></FadeIn>}>
      <FadeIn delay={40}>
        <MonthSwitcher months={summaries.months} selected={month} onChange={setMonth} />
      </FadeIn>

      {/* פוטנציאל */}
      <FadeIn delay={80}>
        <LinearGradient
          colors={p.scheme === 'dark' ? ['#0F6B57', '#12896D', '#1BA784'] : ['#0B8F6B', '#14B085', '#3CCB9E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: radius.xl, padding: spacing.xl, gap: spacing.lg, overflow: 'hidden' }}
        >
          <View style={{ position: 'absolute', top: -50, end: -30, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T variant="captionStrong" color="rgba(255,255,255,0.85)">פוטנציאל חיסכון {period === 'month' ? 'חודשי' : 'שנתי'}</T>
              <T variant="hero" color="#FFFFFF">{fmtMoney(animated)}</T>
            </View>
            <IconCircle icon="piggy-bank" color="#FFFFFF" bg="rgba(255,255,255,0.2)" size={60} />
          </Row>
          <Row gap={spacing.sm}>
            <Toggle label="חודשי" active={period === 'month'} onPress={() => setPeriod('month')} />
            <Toggle label="שנתי" active={period === 'year'} onPress={() => setPeriod('year')} />
          </Row>
          <T variant="caption" color="rgba(255,255,255,0.9)">
            {report.opportunities.length
              ? `אם תיישם את ההמלצות למטה, תחסוך כ-${fmtMoney(report.potentialMonthly)} בחודש, כלומר כ-${fmtMoney(report.potentialYearly)} בשנה.`
              : 'לא מצאתי כרגע הזדמנויות משמעותיות. ההוצאות שלך מאוזנות לפי הנתונים שיש.'}
          </T>
          <T variant="micro" color="rgba(255,255,255,0.75)">
            {report.estimated
              ? 'הערכה מבוססת על חודש חלקי בלבד, ותתחדד ככל שתייבא עוד חודשים.'
              : `מבוסס על ממוצע של ${report.basedOnMonths === 1 ? 'חודש אחד שלם' : `${report.basedOnMonths} חודשים שלמים`}. זו הערכה ולא הבטחה.`}
          </T>
        </LinearGradient>
      </FadeIn>

      {!hasBase ? (
        <Banner tone="warning" text="עדיין אין מספיק נתונים לחישוב מדויק. ייבא לפחות שבוע שלם של תנועות." action="ייבוא" onAction={() => router.push('/import')} />
      ) : null}

      {report.savingsRate !== null ? (
        <FadeIn delay={100}>
          <Card style={{ gap: spacing.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="title">שיעור חיסכון</T>
              <Pill
                label={report.savingsRate >= 20 ? 'מצוין' : report.savingsRate >= 10 ? 'סביר' : report.savingsRate >= 0 ? 'אפשר יותר' : 'מעל ההכנסה'}
                tone={report.savingsRate >= 20 ? 'positive' : report.savingsRate >= 0 ? 'warning' : 'negative'}
              />
            </Row>
            <T variant="display" color={report.savingsRate >= 0 ? p.positive : p.negative}>{fmtPct(report.savingsRate)}</T>
            <ProgressBar value={Math.max(0, report.savingsRate) / 40} color={report.savingsRate >= 0 ? p.positive : p.negative} />
            <T variant="caption" color="textSecondary">
              מהכנסה חודשית ממוצעת של {fmtMoney(report.avg?.income ?? 0)} נשארים בממוצע {fmtMoney((report.avg?.income ?? 0) - report.baseMonthlyExpense)}. היעד המקובל הוא 15%–20%.
            </T>
          </Card>
        </FadeIn>
      ) : null}

      {/* הזדמנויות */}
      {report.opportunities.length ? (
        <View style={{ gap: spacing.md }}>
          <SectionHeader title="הזדמנויות לחיסכון" />
          {report.opportunities.map((o, i) => (
            <FadeIn key={o.id} delay={120 + i * 40}>
              <OpportunityCard o={o} />
            </FadeIn>
          ))}
        </View>
      ) : null}

      {/* השוואה לממוצע */}
      {report.comparisons.length ? (
        <FadeIn delay={160}>
          <Card style={{ gap: spacing.md }}>
            <View>
              <T variant="title">{monthLabel(selected.key)} מול הממוצע שלך</T>
              <T variant="caption" color="textSecondary">
                {report.avg?.scaled ? 'הממוצע מבוסס על חודשים חלקיים (הערכה). ' : `ממוצע של ${report.avg?.months} חודשים שלמים. `}
                {report.proRatedDays ? `החודש חלקי, ולכן הממוצע מותאם ל-${report.proRatedDays} הימים שמכוסים.` : ''}
              </T>
            </View>
            {report.comparisons.map((c) => {
              const cat = getCategory(c.categoryId);
              const up = c.delta > 0;
              const max = Math.max(c.current, c.average, 1);
              return (
                <View key={c.categoryId} style={{ gap: 6 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Row gap={8} style={{ flex: 1 }}>
                      <CategoryBadge id={c.categoryId} size={32} />
                      <T variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>{cat.label}</T>
                    </Row>
                    <Pill
                      label={`${up ? '▲' : '▼'} ${fmtPct(Math.abs(c.deltaPct))} · ${fmtMoney(Math.abs(c.delta))}`}
                      tone={up ? 'negative' : 'positive'}
                    />
                  </Row>
                  <View style={{ gap: 4 }}>
                    <Row gap={8}>
                      <T variant="micro" color="textMuted" style={{ width: 44 }}>החודש</T>
                      <View style={{ flex: 1 }}><ProgressBar value={c.current / max} color={cat.color} height={7} /></View>
                      <Money value={c.current} variant="micro" style={{ minWidth: 52 }} />
                    </Row>
                    <Row gap={8}>
                      <T variant="micro" color="textMuted" style={{ width: 44 }}>ממוצע</T>
                      <View style={{ flex: 1 }}><ProgressBar value={c.average / max} color={withAlpha(cat.color, 0.4)} height={7} /></View>
                      <Money value={c.average} variant="micro" color="textMuted" style={{ minWidth: 52 }} />
                    </Row>
                  </View>
                </View>
              );
            })}
          </Card>
        </FadeIn>
      ) : report.avg === null ? (
        <Banner tone="info" text="ההשוואה לממוצע תופיע כשיהיה לפחות חודש נוסף שלם בנתונים." />
      ) : null}

      {/* מנויים */}
      <FadeIn delay={200}>
        <Card style={{ gap: spacing.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T variant="title">מנויים וחיובים קבועים</T>
              <T variant="caption" color="textSecondary">
                {report.recurring.length
                  ? `${report.recurring.length} חיובים חוזרים · ${fmtMoney(report.recurringMonthly)} בחודש · ${fmtMoney(report.recurringMonthly * 12)} בשנה`
                  : 'לא זוהו מנויים או חיובים חוזרים.'}
              </T>
            </View>
            <MaterialCommunityIcons name="autorenew" size={26} color={p.primary} />
          </Row>
          {report.recurring.length ? (
            <View>
              {report.recurring.slice(0, 12).map((r, i) => (
                <Row key={r.key} style={{ paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border }}>
                  <CategoryBadge id={r.categoryId} size={40} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="bodyStrong" numberOfLines={1}>{r.name}</T>
                    <T variant="caption" color="textSecondary">
                      {r.months} חודשים · {fmtMoney(r.monthly * 12)} בשנה
                    </T>
                  </View>
                  <View style={{ alignItems: 'flex-start', gap: 3 }}>
                    <Money value={r.monthly} />
                    {r.isSubscription ? <Pill label="מנוי" tone="primary" /> : null}
                  </View>
                </Row>
              ))}
            </View>
          ) : (
            <T variant="caption" color="textSecondary">
              ככל שיצטברו כמה חודשים של נתונים, אזהה אוטומטית מנויים, הוראות קבע וחיובים חוזרים שכדאי לבדוק.
            </T>
          )}
          {report.recurring.length ? (
            <T variant="caption" color="textSecondary">
              טיפ: עבור על הרשימה ובטל כל מה שלא השתמשת בו בחודש האחרון.
            </T>
          ) : null}
        </Card>
      </FadeIn>
    </Screen>
  );
}

function Toggle({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: 18, height: 34, borderRadius: radius.pill, justifyContent: 'center',
        backgroundColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.2)',
      }}
    >
      <T variant="captionStrong" color={active ? '#0B8F6B' : '#FFFFFF'}>{label}</T>
    </Pressable>
  );
}

function OpportunityCard({ o }: { o: Opportunity }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const cat = getCategory(o.categoryId);
  return (
    <Card style={{ gap: spacing.md }}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityLabel={`${o.title}, ${open ? 'סגור' : 'הצג'} צעדים`}>
        <Row>
          <CategoryBadge id={o.categoryId} size={48} />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="headline" numberOfLines={1}>{o.title}</T>
            <T variant="caption" color="textSecondary">{o.insight}</T>
          </View>
          <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={24} color={p.textMuted} />
        </Row>
      </Pressable>
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Pill label={`חיסכון אפשרי ${fmtMoney(o.potentialMonthly)} בחודש`} tone="positive" icon="trending-down" />
        <Pill label={`${fmtMoney(o.potentialMonthly * 12)} בשנה`} tone="neutral" />
        <Pill label={o.effort} tone={o.effort === 'קל' ? 'primary' : o.effort === 'בינוני' ? 'warning' : 'negative'} icon="speedometer" />
        {o.aboveAverage ? <Pill label="גבוה מהרגיל" tone="negative" icon="alert-outline" /> : null}
      </View>
      {open ? (
        <FadeIn distance={6}>
          <View style={{ gap: 10, backgroundColor: withAlpha(cat.color, 0.08), borderRadius: radius.md, padding: spacing.md }}>
            <T variant="captionStrong" color="textSecondary">צעדים מעשיים</T>
            {o.steps.map((s, i) => (
              <Row key={i} gap={10} style={{ alignItems: 'flex-start' }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: cat.color, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  <T variant="micro" color="#FFFFFF" align="center">{i + 1}</T>
                </View>
                <T variant="body" style={{ flex: 1 }}>{s}</T>
              </Row>
            ))}
            <Pressable
              onPress={() => router.push({ pathname: '/transactions', params: { category: o.categoryId } })}
              accessibilityRole="button"
              style={{ alignSelf: 'flex-start', paddingTop: 4 }}
            >
              <T variant="captionStrong" color={p.primary}>הצג את התנועות בקטגוריה</T>
            </Pressable>
          </View>
        </FadeIn>
      ) : null}
    </Card>
  );
}
