import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Rect } from 'react-native-svg';
import { T } from './components';
import { ROW } from './rtl';
import { fonts, usePalette, withAlpha } from './theme';
import { useAnimatedValue } from './anim';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/* ---------- גרף מגמה חודשי ---------- */

export interface TrendPoint {
  key: string;
  label: string;
  income: number;
  expense: number;
  partial?: boolean;
}

/**
 * עמודות הכנסות/הוצאות לפי חודש. הזמן זורם מימין לשמאל (העבר בימין) כמקובל בעברית.
 * לחיצה על חודש בוחרת אותו.
 */
export function TrendChart({
  data, selectedKey, onSelect, height = 168, average,
}: { data: TrendPoint[]; selectedKey?: string; onSelect?: (key: string) => void; height?: number; average?: number }) {
  const p = usePalette();
  const [width, setWidth] = useState(0);
  const prog = useAnimatedValue(0);
  const dataSig = data.map((d) => `${d.key}:${Math.round(d.income)}:${Math.round(d.expense)}`).join('|');
  useEffect(() => {
    prog.setValue(0);
    Animated.timing(prog, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [dataSig, prog]);

  const max = useMemo(() => Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)), average ?? 0), [data, average]);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const n = data.length;
  const slot = n ? width / n : 0;
  const barW = Math.max(6, Math.min(16, slot * 0.26));
  const gap = 4;
  const top = 8;
  const base = height - 4;
  const usable = base - top;

  return (
    <View>
      <View onLayout={onLayout} style={{ height }}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <Line key={f} x1={0} x2={width} y1={base - usable * f} y2={base - usable * f} stroke={p.border} strokeWidth={1} strokeDasharray="3 5" />
            ))}
            {average ? (
              <Line x1={0} x2={width} y1={base - (average / max) * usable} y2={base - (average / max) * usable} stroke={p.primary} strokeWidth={1.5} strokeDasharray="6 4" opacity={0.7} />
            ) : null}
            {data.map((d, i) => {
              const cx = width - (i + 0.5) * slot;
              const active = !selectedKey || selectedKey === d.key;
              const hE = Math.max(d.expense > 0 ? 3 : 0, (Math.max(0, d.expense) / max) * usable);
              const hI = Math.max(d.income > 0 ? 3 : 0, (Math.max(0, d.income) / max) * usable);
              const opacity = active ? 1 : 0.35;
              return (
                <G key={d.key} opacity={opacity}>
                  <AnimatedRect
                    x={cx + gap / 2}
                    width={barW}
                    rx={barW / 2.4}
                    fill={p.positive}
                    y={prog.interpolate({ inputRange: [0, 1], outputRange: [base, base - hI] })}
                    height={prog.interpolate({ inputRange: [0, 1], outputRange: [0, hI] })}
                    opacity={0.85}
                  />
                  <AnimatedRect
                    x={cx - gap / 2 - barW}
                    width={barW}
                    rx={barW / 2.4}
                    fill={p.primary}
                    y={prog.interpolate({ inputRange: [0, 1], outputRange: [base, base - hE] })}
                    height={prog.interpolate({ inputRange: [0, 1], outputRange: [0, hE] })}
                  />
                </G>
              );
            })}
          </Svg>
        )}
        {width > 0 && onSelect && (
          <View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, flexDirection: ROW }}>
            {data.map((d) => (
              <Pressable key={d.key} style={{ flex: 1 }} onPress={() => onSelect(d.key)} accessibilityRole="button" accessibilityLabel={d.label} />
            ))}
          </View>
        )}
      </View>
      <View style={{ flexDirection: ROW, marginTop: 8 }}>
        {data.map((d) => {
          const active = !selectedKey || selectedKey === d.key;
          return (
            <View key={d.key} style={{ flex: 1, alignItems: 'center' }}>
              <T variant="micro" align="center" color={active ? p.text : p.textMuted} style={{ fontFamily: active ? fonts.bold : fonts.medium }}>
                {d.label}
              </T>
              {d.partial ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: p.warning, marginTop: 2 }} /> : <View style={{ height: 6 }} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ---------- דונאט ---------- */

export interface DonutSlice {
  id: string;
  value: number;
  color: string;
}

export function DonutChart({
  slices, size = 208, thickness = 24, selectedId, onSelect, children,
}: {
  slices: DonutSlice[]; size?: number; thickness?: number; selectedId?: string | null;
  onSelect?: (id: string) => void; children?: React.ReactNode;
}) {
  const p = usePalette();
  const enter = useAnimatedValue(0);
  const sig = slices.map((s) => `${s.id}:${Math.round(s.value)}`).join('|');
  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [sig, enter]);

  const total = slices.reduce((a, s) => a + s.value, 0);
  const c = size / 2;
  const r = (size - thickness) / 2 - 4;
  const C = 2 * Math.PI * r;
  const gapLen = slices.length > 1 ? Math.min(4, C * 0.01) : 0;
  let acc = 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          opacity: enter,
          transform: [
            { rotate: enter.interpolate({ inputRange: [0, 1], outputRange: ['-70deg', '0deg'] }) },
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
          ],
        }}
      >
        <Svg width={size} height={size}>
          <Circle cx={c} cy={c} r={r} stroke={p.surfaceAlt} strokeWidth={thickness} fill="none" />
          <G rotation={-90} origin={`${c}, ${c}`}>
            {total > 0 &&
              slices.map((s) => {
                const len = (s.value / total) * C;
                const dash = Math.max(1, len - gapLen);
                const start = acc;
                acc += len;
                const selected = selectedId === s.id;
                const dim = selectedId && !selected;
                return (
                  <Circle
                    key={s.id}
                    cx={c}
                    cy={c}
                    r={r}
                    stroke={s.color}
                    strokeWidth={selected ? thickness + 6 : thickness}
                    strokeOpacity={dim ? 0.3 : 1}
                    strokeDasharray={`${dash} ${C - dash}`}
                    strokeDashoffset={-start}
                    strokeLinecap="butt"
                    fill="none"
                    onPress={onSelect ? () => onSelect(s.id) : undefined}
                  />
                );
              })}
          </G>
        </Svg>
      </Animated.View>
      <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center', width: size - thickness * 2 - 16 }}>
        {children}
      </View>
    </View>
  );
}

/* ---------- גרף עמודות קטן לתשלומים עתידיים ---------- */

export function MiniBars({ values, color, height = 56 }: { values: { key: string; label: string; value: number }[]; color: string; height?: number }) {
  const p = usePalette();
  const max = Math.max(1, ...values.map((v) => v.value));
  return (
    <View style={{ flexDirection: ROW, alignItems: 'flex-end', gap: 6, height: height + 22 }}>
      {values.map((v) => (
        <View key={v.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
          <View style={{ width: '100%', maxWidth: 22, height: Math.max(4, (v.value / max) * height), borderRadius: 6, backgroundColor: withAlpha(color, 0.9) }} />
          <T variant="micro" align="center" color={p.textMuted}>{v.label}</T>
        </View>
      ))}
    </View>
  );
}
