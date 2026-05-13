import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { shadows } from '../theme';

export type PlusSheetStage = 'closed' | 'peek' | 'expanded';

type AurenPlusSheetProps = {
  stage: PlusSheetStage;
  onStageChange: (stage: PlusSheetStage) => void;
};

const PEEK_HEIGHT_RATIO = 0.54;
const EXPANDED_HEIGHT_RATIO = 0.92;
const PEEK_MIN_HEIGHT = 390;
const PEEK_MAX_HEIGHT = 520;
const EXPANDED_MIN_HEIGHT = 690;
const DRAG_THRESHOLD = 72;
const FAST_SWIPE_VELOCITY = 0.85;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function AurenPlusSheet({ stage, onStageChange }: AurenPlusSheetProps) {
  const { height } = useWindowDimensions();

  const { closedY, expandedHeight, expandedY, peekY } = useMemo(() => {
    const nextExpandedHeight = Math.min(
      Math.max(height * EXPANDED_HEIGHT_RATIO, EXPANDED_MIN_HEIGHT),
      height,
    );
    const nextPeekHeight = Math.min(
      Math.max(height * PEEK_HEIGHT_RATIO, PEEK_MIN_HEIGHT),
      Math.min(PEEK_MAX_HEIGHT, nextExpandedHeight - 80),
    );

    return {
      expandedHeight: nextExpandedHeight,
      expandedY: 0,
      peekY: nextExpandedHeight - nextPeekHeight,
      closedY: nextExpandedHeight + 28,
    };
  }, [height]);

  const translateY = useRef(new Animated.Value(stage === 'closed' ? closedY : stage === 'expanded' ? expandedY : peekY)).current;
  const currentY = useRef(stage === 'closed' ? closedY : stage === 'expanded' ? expandedY : peekY);
  const dragStartY = useRef(currentY.current);

  function getTargetY(nextStage: PlusSheetStage) {
    if (nextStage === 'expanded') return expandedY;
    if (nextStage === 'peek') return peekY;
    return closedY;
  }

  function animateToStage(nextStage: PlusSheetStage) {
    const targetY = getTargetY(nextStage);
    currentY.current = targetY;

    Animated.timing(translateY, {
      toValue: targetY,
      duration: nextStage === 'closed' ? 250 : 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  useEffect(() => {
    animateToStage(stage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, closedY, expandedY, peekY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          if (stage === 'closed') return false;
          const verticalDistance = Math.abs(gestureState.dy);
          const horizontalDistance = Math.abs(gestureState.dx);
          return verticalDistance > 8 && verticalDistance > horizontalDistance * 1.25;
        },
        onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
          if (stage === 'closed') return false;
          const verticalDistance = Math.abs(gestureState.dy);
          const horizontalDistance = Math.abs(gestureState.dx);
          return verticalDistance > 8 && verticalDistance > horizontalDistance * 1.25;
        },
        onPanResponderGrant: () => {
          dragStartY.current = currentY.current;
          translateY.stopAnimation((value) => {
            currentY.current = value;
            dragStartY.current = value;
          });
        },
        onPanResponderMove: (_event, gestureState) => {
          const nextY = clamp(dragStartY.current + gestureState.dy, expandedY, closedY);
          currentY.current = nextY;
          translateY.setValue(nextY);
        },
        onPanResponderRelease: (_event, gestureState) => {
          const draggedUp = gestureState.dy < -DRAG_THRESHOLD || gestureState.vy < -FAST_SWIPE_VELOCITY;
          const draggedDown = gestureState.dy > DRAG_THRESHOLD || gestureState.vy > FAST_SWIPE_VELOCITY;

          if (stage === 'peek') {
            if (draggedUp) {
              onStageChange('expanded');
              return;
            }

            if (draggedDown) {
              onStageChange('closed');
              return;
            }

            onStageChange('peek');
            return;
          }

          if (stage === 'expanded') {
            if (draggedDown) {
              onStageChange('peek');
              return;
            }

            onStageChange('expanded');
          }
        },
        onPanResponderTerminate: () => {
          onStageChange(stage === 'expanded' ? 'expanded' : stage === 'peek' ? 'peek' : 'closed');
        },
      }),
    [closedY, expandedY, onStageChange, stage, translateY],
  );

  return (
    <Animated.View
      pointerEvents={stage === 'closed' ? 'none' : 'auto'}
      {...panResponder.panHandlers}
      style={[
        styles.sheet,
        {
          height: expandedHeight,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.solidFill} />
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
    elevation: 40,
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    backgroundColor: '#fbfbfa',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.04)',
    overflow: 'hidden',
    ...shadows.soft,
  },
  solidFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fbfbfa',
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
