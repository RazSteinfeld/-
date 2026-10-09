import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { pickDataFiles } from '../files';
import { FriendlyError, parseFile, type ParsedFile } from '../parsers';
import { useStore, type ImportSummary } from '../store';
import { Banner, Button, Card, FadeIn, IconCircle, Row, Screen, T } from '../ui/components';
import { spacing, usePalette } from '../ui/theme';

type Phase = 'idle' | 'working' | 'done';
interface Item {
  name: string;
  status: 'pending' | 'parsing' | 'ok' | 'error';
  message?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ImportScreen() {
  const p = usePalette();
  const { importFiles, transactions } = useStore();
  const [phase, setPhase] = useState<Phase>('idle');
  const [items, setItems] = useState<Item[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tipsOpen, setTipsOpen] = useState(false);

  const patch = (i: number, v: Partial<Item>) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...v } : it)));

  const run = async () => {
    setError(null);
    let files;
    try {
      files = await pickDataFiles();
    } catch {
      setError('לא הצלחתי לפתוח את בורר הקבצים. נסה שוב.');
      return;
    }
    if (!files || !files.length) return;
    setItems(files.map((f) => ({ name: f.name, status: 'pending' })));
    setPhase('working');
    const parsed: ParsedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      patch(i, { status: 'parsing' });
      await sleep(60); // נותן לממשק להתעדכן לפני עבודת הפירוק
      try {
        const bytes = await files[i].bytes();
        const pf = parseFile(files[i].name, bytes);
        parsed.push(pf);
        patch(i, { status: 'ok', message: `${pf.kind === 'bank' ? 'חשבון בנק' : 'כרטיס אשראי'} · ${pf.transactions.length} תנועות` });
      } catch (e) {
        patch(i, { status: 'error', message: e instanceof FriendlyError ? e.message : 'לא הצלחתי לקרוא את הקובץ הזה.' });
      }
    }
    const result = parsed.length ? importFiles(parsed) : { files: [], added: 0, duplicates: 0 };
    setSummary(result);
    setPhase('done');
  };

  const reset = () => {
    setPhase('idle');
    setItems([]);
    setSummary(null);
  };

  const failed = items.filter((i) => i.status === 'error').length;

  return (
    <Screen
      header={
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="display">ייבוא קבצים</T>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="סגירה">
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="close" size={22} color={p.text} />
            </View>
          </Pressable>
        </Row>
      }
    >
      {phase === 'idle' ? (
        <>
          <FadeIn>
            <Card level={2} style={{ alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxl }}>
              <IconCircle icon="file-excel-outline" color={p.primary} size={84} />
              <View style={{ gap: 6, alignItems: 'center' }}>
                <T variant="title" align="center">בחר קבצי Excel או CSV</T>
                <T variant="body" color="textSecondary" align="center">
                  אפשר לבחור כמה קבצים יחד: פירוט כרטיס Max וקובץ תנועות מהבנק. אני מזהה את הסוג לבד, מסווג הוצאות ומדלג על תנועות שכבר יובאו.
                </T>
              </View>
              <Button label="בחירת קבצים" icon="folder-open-outline" onPress={run} style={{ alignSelf: 'stretch' }} />
              <T variant="micro" color="textMuted" align="center">הקבצים נקראים בטלפון בלבד ולא נשלחים לשום מקום.</T>
            </Card>
          </FadeIn>
          {error ? <Banner tone="error" text={error} /> : null}
          <FadeIn delay={80}>
            <Card style={{ gap: spacing.md }}>
              <Pressable onPress={() => setTipsOpen((v) => !v)} accessibilityRole="button">
                <Row style={{ justifyContent: 'space-between' }}>
                  <T variant="headline">איך מורידים את הקבצים?</T>
                  <MaterialCommunityIcons name={tipsOpen ? 'chevron-up' : 'chevron-down'} size={24} color={p.textMuted} />
                </Row>
              </Pressable>
              {tipsOpen ? (
                <View style={{ gap: spacing.md }}>
                  <Tip icon="credit-card-outline" title="כרטיס אשראי (Max)" body="באתר או באפליקציית Max, בפירוט העסקאות, בחר טווח תאריכים ולחץ על ייצוא ל-Excel. שמור את הקובץ בטלפון." />
                  <Tip icon="bank-outline" title="חשבון בנק (מזרחי-טפחות)" body="באתר הבנק, בתנועות בחשבון, בחר טווח תאריכים וייצא ל-Excel או ל-CSV." />
                  <Tip icon="calendar-sync-outline" title="עדכון חודשי" body="כל חודש אפשר לייבא קובץ חדש. תנועות שכבר קיימות לא יוכפלו, גם אם הקבצים חופפים." />
                </View>
              ) : null}
            </Card>
          </FadeIn>
          {transactions.length ? (
            <T variant="caption" color="textMuted" align="center">כרגע שמורות {transactions.length.toLocaleString('en-US')} תנועות.</T>
          ) : null}
        </>
      ) : (
        <>
          <Card style={{ gap: spacing.sm }}>
            <T variant="title">{phase === 'working' ? 'קורא את הקבצים…' : 'סיימנו'}</T>
            {items.map((it, i) => (
              <Row key={`${it.name}-${i}`} style={{ paddingVertical: 8 }}>
                <View style={{ width: 28, alignItems: 'center' }}>
                  {it.status === 'parsing' || it.status === 'pending' ? (
                    <ActivityIndicator size="small" color={p.primary} />
                  ) : (
                    <MaterialCommunityIcons name={it.status === 'ok' ? 'check-circle' : 'alert-circle'} size={24} color={it.status === 'ok' ? p.positive : p.negative} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="bodyStrong" numberOfLines={1}>{it.name}</T>
                  {it.message ? <T variant="caption" color={it.status === 'error' ? p.negative : 'textSecondary'}>{it.message}</T> : null}
                </View>
              </Row>
            ))}
          </Card>

          {phase === 'done' && summary ? (
            <FadeIn>
              {summary.added > 0 ? (
                <Card level={2} style={{ gap: spacing.md, alignItems: 'center' }}>
                  <IconCircle icon="check-bold" color={p.positive} size={64} />
                  <T variant="display" align="center">נוספו {summary.added.toLocaleString('en-US')} תנועות</T>
                  {summary.duplicates > 0 ? (
                    <T variant="body" color="textSecondary" align="center">{summary.duplicates.toLocaleString('en-US')} תנועות כבר היו קיימות, ודילגתי עליהן.</T>
                  ) : null}
                  {summary.files.some((f) => f.skipped > 0) ? (
                    <T variant="caption" color="textMuted" align="center">
                      {summary.files.reduce((a, f) => a + f.skipped, 0)} שורות בקבצים לא נקראו (חסר תאריך או סכום).
                    </T>
                  ) : null}
                  <T variant="caption" color="textMuted" align="center">{'אפשר לתקן סיווג של כל תנועה בלשונית "תנועות".'}</T>
                </Card>
              ) : (
                <Banner
                  tone={failed === items.length ? 'error' : 'info'}
                  text={
                    failed === items.length
                      ? 'לא הצלחתי לקרוא אף קובץ. בדוק שהקבצים הם ייצוא Excel/CSV מ-Max או מהבנק.'
                      : 'לא נוספו תנועות חדשות: כל מה שבקבצים כבר קיים באפליקציה.'
                  }
                />
              )}
            </FadeIn>
          ) : null}

          {phase === 'done' ? (
            <View style={{ gap: spacing.sm }}>
              {summary && summary.added > 0 ? <Button label="לסקירה" icon="chart-donut" onPress={() => router.replace('/')} /> : null}
              <Button label="ייבוא קבצים נוספים" variant="secondary" icon="file-plus-outline" onPress={reset} />
              <Button label="סגירה" variant="ghost" onPress={() => router.back()} />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Tip({ icon, title, body }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; body: string }) {
  const p = usePalette();
  return (
    <Row gap={spacing.md} style={{ alignItems: 'flex-start' }}>
      <IconCircle icon={icon} color={p.primary} size={40} />
      <View style={{ flex: 1 }}>
        <T variant="bodyStrong">{title}</T>
        <T variant="caption" color="textSecondary">{body}</T>
      </View>
    </Row>
  );
}
