import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCategory } from '../categories';
import { fmtMoney } from '../format';
import { CHEVRON_FORWARD, ROW } from './rtl';
import { radius, shadowFor, spacing, typography, usePalette, withAlpha, type Variant } from './theme';
import { useAnimatedValue } from './anim';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/* ---------- טקסט ---------- */

type ColorKey = 'text' | 'textSecondary' | 'textMuted' | 'primary' | 'positive' | 'negative' | 'warning' | 'onPrimary';

interface TProps extends TextProps {
  variant?: Variant;
  color?: ColorKey | string;
  align?: 'right' | 'left' | 'center';
}

export function T({ variant = 'body', color = 'text', align = 'right', style, ...rest }: TProps) {
  const p = usePalette();
  const resolved = (p as unknown as Record<string, string>)[color] ?? color;
  return <Text {...rest} style={[typography[variant], { color: resolved, textAlign: align }, style]} />;
}

/** סכום כסף עם סימן ומטבע בתצוגה נכונה בתוך RTL */
export function Money({
  value, variant = 'bodyStrong', color, sign, decimals, style,
}: { value: number; variant?: Variant; color?: ColorKey | string; sign?: boolean; decimals?: boolean; style?: StyleProp<TextStyle> }) {
  return (
    <T variant={variant} color={color} align="left" style={style}>
      {fmtMoney(value, { sign, decimals })}
    </T>
  );
}

/* ---------- אנימציות ---------- */

export function FadeIn({
  children, delay = 0, distance = 14, style,
}: { children: React.ReactNode; delay?: number; distance?: number; style?: StyleProp<ViewStyle> }) {
  const v = useAnimatedValue(0);
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function PressableScale({
  children, onPress, haptic = false, style, scaleTo = 0.97, ...rest
}: PressableProps & { haptic?: boolean; style?: StyleProp<ViewStyle>; scaleTo?: number; children: React.ReactNode }) {
  const s = useAnimatedValue(1);
  const to = (value: number) => Animated.spring(s, { toValue: value, speed: 40, bounciness: 4, useNativeDriver: true }).start();
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => { to(scaleTo); rest.onPressIn?.(e); }}
      onPressOut={(e) => { to(1); rest.onPressOut?.(e); }}
      onPress={(e) => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.(e);
      }}
    >
      <Animated.View style={[{ transform: [{ scale: s }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

/** מספר שסופר מהערך הקודם לערך החדש */
export function useCountUp(target: number, duration = 700): number {
  const [val, setVal] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    const t0 = Date.now();
    let raf = 0;
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const cur = start + (target - start) * eased;
      from.current = cur;
      setVal(cur);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/* ---------- מבנה ---------- */

export function Card({
  children, style, level = 1, padded = true,
}: { children: React.ReactNode; style?: StyleProp<ViewStyle>; level?: 1 | 2 | 3; padded?: boolean }) {
  const p = usePalette();
  return (
    <View
      style={[
        {
          backgroundColor: p.surface,
          borderRadius: radius.lg,
          padding: padded ? spacing.lg : 0,
          borderWidth: p.scheme === 'dark' ? 1 : 0,
          borderColor: p.border,
        },
        shadowFor(p, level),
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({ children, style, gap = spacing.md }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: ROW, alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const p = usePalette();
  return <View style={{ height: 1, backgroundColor: p.border, marginHorizontal: inset }} />;
}

export function Screen({
  children, scroll = true, header, bottomPad = 120, refreshControl, contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  header?: React.ReactNode;
  bottomPad?: number;
  refreshControl?: React.ReactElement<any>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ paddingTop: insets.top + spacing.md, paddingBottom: bottomPad, paddingHorizontal: spacing.lg, gap: spacing.lg }, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, paddingTop: insets.top + spacing.md }, contentStyle]}>
          {header}
          {children}
        </View>
      )}
    </View>
  );
}

export function ScreenHeader({
  title, subtitle, right,
}: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingTop: spacing.xs }}>
      <View style={{ flex: 1 }}>
        <T variant="display">{title}</T>
        {subtitle ? <T variant="caption" color="textSecondary">{subtitle}</T> : null}
      </View>
      {right}
    </Row>
  );
}

export function SectionHeader({
  title, action, onAction,
}: { title: string; action?: string; onAction?: () => void }) {
  const p = usePalette();
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: spacing.xs }}>
      <T variant="title">{title}</T>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <T variant="captionStrong" color={p.primary}>{action}</T>
        </Pressable>
      ) : null}
    </Row>
  );
}

/* ---------- רכיבים קטנים ---------- */

export function CategoryBadge({ id, size = 44 }: { id: string; size?: number }) {
  const c = getCategory(id);
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size * 0.34,
        backgroundColor: withAlpha(c.color, 0.16), alignItems: 'center', justifyContent: 'center',
      }}
    >
      <MaterialCommunityIcons name={c.icon as IconName} size={size * 0.5} color={c.color} />
    </View>
  );
}

export function IconCircle({
  icon, color, size = 44, bg,
}: { icon: IconName; color: string; size?: number; bg?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg ?? withAlpha(color, 0.14), alignItems: 'center', justifyContent: 'center' }}>
      <MaterialCommunityIcons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

export function IconButton({
  icon, onPress, label, tone = 'default', size = 40,
}: { icon: IconName; onPress: () => void; label: string; tone?: 'default' | 'primary'; size?: number }) {
  const p = usePalette();
  return (
    <PressableScale onPress={onPress} haptic accessibilityRole="button" accessibilityLabel={label} scaleTo={0.9}>
      <View
        style={{
          width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
          backgroundColor: tone === 'primary' ? p.primary : p.surfaceAlt,
        }}
      >
        <MaterialCommunityIcons name={icon} size={size * 0.52} color={tone === 'primary' ? p.onPrimary : p.text} />
      </View>
    </PressableScale>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label, onPress, icon, variant = 'primary', loading, disabled, style, compact,
}: {
  label: string; onPress: () => void; icon?: IconName; variant?: ButtonVariant;
  loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; compact?: boolean;
}) {
  const p = usePalette();
  const palette: Record<ButtonVariant, { bg: string; fg: string }> = {
    primary: { bg: p.primary, fg: p.onPrimary },
    secondary: { bg: p.primarySoft, fg: p.primary },
    ghost: { bg: 'transparent', fg: p.primary },
    danger: { bg: p.negativeSoft, fg: p.negative },
  };
  const c = palette[variant];
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        {
          minHeight: compact ? 40 : 52, borderRadius: radius.md, backgroundColor: c.bg,
          paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        },
        variant === 'primary' ? shadowFor(p, 2) : null,
        style,
      ]}
    >
      <Row gap={8}>
        {loading ? <ActivityIndicator color={c.fg} /> : icon ? <MaterialCommunityIcons name={icon} size={20} color={c.fg} /> : null}
        <T variant="bodyStrong" color={c.fg} align="center">{label}</T>
      </Row>
    </PressableScale>
  );
}

export function Chip({
  label, selected, onPress, icon, color,
}: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; color?: string }) {
  const p = usePalette();
  const accent = color ?? p.primary;
  return (
    <PressableScale onPress={onPress} haptic scaleTo={0.94} accessibilityRole="button" accessibilityState={{ selected: !!selected }}>
      <View
        style={{
          flexDirection: ROW, alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: radius.pill,
          backgroundColor: selected ? accent : p.surfaceAlt, borderWidth: 1, borderColor: selected ? accent : 'transparent',
        }}
      >
        {icon ? <MaterialCommunityIcons name={icon} size={16} color={selected ? '#fff' : accent} /> : null}
        <T variant="captionStrong" color={selected ? '#FFFFFF' : p.textSecondary}>{label}</T>
      </View>
    </PressableScale>
  );
}

export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'primary'; icon?: IconName }) {
  const p = usePalette();
  const map: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: p.surfaceAlt, fg: p.textSecondary },
    positive: { bg: p.positiveSoft, fg: p.positive },
    negative: { bg: p.negativeSoft, fg: p.negative },
    warning: { bg: p.warningSoft, fg: p.warning },
    primary: { bg: p.primarySoft, fg: p.primary },
  };
  const c = map[tone];
  return (
    <View style={{ flexDirection: ROW, alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 24, borderRadius: radius.pill, backgroundColor: c.bg }}>
      {icon ? <MaterialCommunityIcons name={icon} size={13} color={c.fg} /> : null}
      <T variant="micro" color={c.fg}>{label}</T>
    </View>
  );
}

export function ProgressBar({
  value, color, height = 8, track,
}: { value: number; color: string; height?: number; track?: string }) {
  const p = usePalette();
  const v = useAnimatedValue(0);
  const clamped = Math.max(0, Math.min(1, value));
  useEffect(() => {
    Animated.timing(v, { toValue: clamped, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [clamped, v]);
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track ?? p.surfaceAlt, overflow: 'hidden', flexDirection: ROW }}>
      <Animated.View
        style={{ width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), height, borderRadius: height, backgroundColor: color }}
      />
    </View>
  );
}

export function Banner({
  tone = 'info', icon, text, action, onAction,
}: { tone?: 'info' | 'warning' | 'error' | 'success'; icon?: IconName; text: string; action?: string; onAction?: () => void }) {
  const p = usePalette();
  const map = {
    info: { bg: p.primarySoft, fg: p.primary, icon: 'information-outline' as IconName },
    warning: { bg: p.warningSoft, fg: p.warning, icon: 'alert-circle-outline' as IconName },
    error: { bg: p.negativeSoft, fg: p.negative, icon: 'alert-octagon-outline' as IconName },
    success: { bg: p.positiveSoft, fg: p.positive, icon: 'check-circle-outline' as IconName },
  } as const;
  const c = map[tone];
  return (
    <View style={{ flexDirection: ROW, alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.bg }}>
      <MaterialCommunityIcons name={icon ?? c.icon} size={22} color={c.fg} />
      <View style={{ flex: 1 }}>
        <T variant="caption" color={p.text}>{text}</T>
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <T variant="captionStrong" color={c.fg}>{action}</T>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SettingsRow({
  icon, color, title, subtitle, onPress, right, danger,
}: {
  icon: IconName; color?: string; title: string; subtitle?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean;
}) {
  const p = usePalette();
  const accent = danger ? p.negative : color ?? p.primary;
  const inner = (
    <View style={{ flexDirection: ROW, alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg }}>
      <IconCircle icon={icon} color={accent} size={40} />
      <View style={{ flex: 1 }}>
        <T variant="bodyStrong" color={danger ? p.negative : p.text}>{title}</T>
        {subtitle ? <T variant="caption" color="textSecondary">{subtitle}</T> : null}
      </View>
      {right ?? (onPress ? <MaterialCommunityIcons name={CHEVRON_FORWARD} size={22} color={p.textMuted} /> : null)}
    </View>
  );
  return onPress ? (
    <PressableScale onPress={onPress} haptic scaleTo={0.985} accessibilityRole="button" accessibilityLabel={title}>{inner}</PressableScale>
  ) : inner;
}

/* ---------- מצבי טעינה / ריק / שגיאה ---------- */

export function Skeleton({ height = 16, width = '100%', radiusPx = 10, style }: { height?: number; width?: number | `${number}%`; radiusPx?: number; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  const v = useAnimatedValue(0.5);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ height, width, borderRadius: radiusPx, backgroundColor: p.skeleton, opacity: v }, style]} />;
}

export function EmptyState({
  icon, title, body, actionLabel, onAction, secondaryLabel, onSecondary,
}: {
  icon: IconName; title: string; body: string; actionLabel?: string; onAction?: () => void;
  secondaryLabel?: string; onSecondary?: () => void;
}) {
  const p = usePalette();
  return (
    <FadeIn style={{ alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl, gap: spacing.lg }}>
      <View style={{ width: 132, height: 132, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: 132, height: 132, borderRadius: 66, backgroundColor: withAlpha(p.primary, 0.08) }} />
        <View style={{ position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: withAlpha(p.primary, 0.14) }} />
        <MaterialCommunityIcons name={icon} size={44} color={p.primary} />
      </View>
      <View style={{ gap: 6, alignItems: 'center' }}>
        <T variant="title" align="center">{title}</T>
        <T variant="body" color="textSecondary" align="center">{body}</T>
      </View>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} icon="file-upload-outline" /> : null}
      {secondaryLabel && onSecondary ? <Button label={secondaryLabel} onPress={onSecondary} variant="ghost" compact /> : null}
    </FadeIn>
  );
}

export function ErrorState({
  title = 'משהו השתבש', body, actionLabel = 'נסה שוב', onAction,
}: { title?: string; body: string; actionLabel?: string; onAction?: () => void }) {
  const p = usePalette();
  return (
    <View style={{ alignItems: 'center', padding: spacing.xxl, gap: spacing.lg }}>
      <IconCircle icon="emoticon-sad-outline" color={p.negative} size={72} />
      <T variant="title" align="center">{title}</T>
      <T variant="body" color="textSecondary" align="center">{body}</T>
      {onAction ? <Button label={actionLabel} onPress={onAction} icon="refresh" /> : null}
    </View>
  );
}

/* ---------- גיליון תחתון ---------- */

function SheetPanel({
  onClose, title, children, maxHeightPct,
}: { onClose: () => void; title?: string; children: React.ReactNode; maxHeightPct: number }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const anim = useAnimatedValue(0);
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [anim]);
  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: p.overlay }}>
      <Pressable style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} onPress={onClose} accessibilityLabel="סגירה" />
      <KeyboardAvoidingView behavior="padding">
        <Animated.View
          style={{
            backgroundColor: p.surfaceHigh, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
            maxHeight: `${maxHeightPct * 100}%` as `${number}%`, paddingBottom: insets.bottom + spacing.lg,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }],
            ...shadowFor(p, 3),
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
          </View>
          {title ? (
            <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md }}>
              <T variant="title">{title}</T>
            </View>
          ) : null}
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing.sm }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

export function Sheet({
  visible, onClose, title, children, maxHeightPct = 0.88,
}: { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode; maxHeightPct?: number }) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <SheetPanel onClose={onClose} title={title} maxHeightPct={maxHeightPct}>{children}</SheetPanel>
    </Modal>
  );
}
