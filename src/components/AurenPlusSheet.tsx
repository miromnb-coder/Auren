import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { colors, shadows } from '../theme';

type AurenPlusSheetProps = {
  open: boolean;
};

const SHEET_HEIGHT_RATIO = 0.54;
const SHEET_MIN_HEIGHT = 390;
const SHEET_MAX_HEIGHT = 520;

export function AurenPlusSheet({ open }: AurenPlusSheetProps) {
  const { height } = useWindowDimensions();
  const sheetHeight = useMemo(() => {
    const measuredHeight = height * SHEET_HEIGHT_RATIO;
    return Math.min(Math.max(measuredHeight, SHEET_MIN_HEIGHT), SHEET_MAX_HEIGHT);
  }, [height]);

  const translateY = useRef(new Animated.Value(open ? 0 : sheetHeight)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: open ? 0 : sheetHeight,
      duration: open ? 320 : 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, sheetHeight, translateY]);

  return (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      style={[
        styles.sheet,
        {
          height: sheetHeight,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.handle} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.86)',
    ...shadows.soft,
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    marginTop: 18,
    backgroundColor: 'rgba(110,113,124,0.28)',
  },
});
