import { useState } from 'react';
import { Animated } from 'react-native';

/** Animated.Value יציב לאורך חיי הקומפוננטה (בלי useRef, שנחשב גישה ל-ref בזמן רינדור). */
export function useAnimatedValue(initial: number): Animated.Value {
  const [v] = useState(() => new Animated.Value(initial));
  return v;
}
