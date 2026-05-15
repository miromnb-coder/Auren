import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { AurenThinkingEvent } from '../lib/auren-agent/core/types';
import { colors } from '../theme';

type AurenThinkingStateProps = {
  thinkingState: AurenThinkingEvent;
};

export function AurenThinkingState({ thinkingState }: AurenThinkingStateProps) {
  const shimmerProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    shimmerProgress.setValue(0);

    const loop = Animated.loop(
      Animated.timing(shimmerProgress, {
        toValue: 1,
        duration: 2200,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [shimmerProgress, thinkingState.stage, thinkingState.sequence]);

  const shimmerTranslateX = shimmerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-72, 280],
  });

  return (
    <View style={styles.root}>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{thinkingState.title}</Text>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shimmer,
            {
              transform: [{ translateX: shimmerTranslateX }, { rotate: '14deg' }],
            },
          ]}
        />
      </View>

      <Text style={styles.detail}>{thinkingState.detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '88%',
    paddingTop: 2,
    paddingBottom: 2,
  },
  titleWrap: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  title: {
    color: colors.text,
    fontSize: 17.5,
    lineHeight: 24,
    letterSpacing: -0.34,
    fontWeight: '720',
  },
  shimmer: {
    position: 'absolute',
    top: -8,
    bottom: -8,
    width: 36,
    opacity: 0.42,
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#ffffff',
    shadowOpacity: 0.85,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  detail: {
    marginTop: 4,
    color: 'rgba(17, 24, 39, 0.48)',
    fontSize: 14.3,
    lineHeight: 20.5,
    letterSpacing: -0.16,
    fontWeight: '500',
  },
});
