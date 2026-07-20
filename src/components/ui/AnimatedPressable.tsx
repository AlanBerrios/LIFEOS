import type { ReactElement } from 'react';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { useAppTheme } from '../../theme';

const MotionPressable = Animated.createAnimatedComponent(Pressable);

type AnimatedPressableProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

export function AnimatedPressable({
  style,
  pressedScale = 0.975,
  disabled,
  onPressIn,
  onPressOut,
  children,
  ...props
}: AnimatedPressableProps): ReactElement {
  const theme = useAppTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <MotionPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        scale.value = withTiming(reduceMotion ? 1 : pressedScale, {
          duration: reduceMotion ? 0 : theme.motion.press
        });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withTiming(1, {
          duration: reduceMotion ? 0 : theme.motion.fast
        });
        onPressOut?.(event);
      }}
      style={[style, animatedStyle, disabled && { opacity: 0.42 }]}
    >
      {children}
    </MotionPressable>
  );
}
