import * as MediaLibrary from 'expo-media-library';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { shadows } from '../theme';

export type PlusSheetStage = 'closed' | 'peek' | 'expanded';

type AurenPlusSheetProps = {
  stage: PlusSheetStage;
  onStageChange: (stage: PlusSheetStage) => void;
};

type RecentPhoto = {
  id: string;
  uri: string;
};

const PHOTO_PLACEHOLDERS = ['photo-1', 'photo-2', 'photo-3', 'photo-4', 'photo-5'];
const RECENT_PHOTO_LIMIT = 5;

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

function canRenderImageUri(uri?: string | null) {
  if (!uri) return false;

  return (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('assets-library://') ||
    uri.startsWith('http://') ||
    uri.startsWith('https://')
  );
}

function GlobeIcon() {
  return (
    <View style={styles.globeIcon}>
      <View style={styles.globeHorizontal} />
      <View style={styles.globeVerticalOval} />
    </View>
  );
}

function PaperclipIcon() {
  return (
    <View style={styles.paperclipIcon}>
      <View style={styles.paperclipInner} />
    </View>
  );
}

export function AurenPlusSheet({ stage, onStageChange }: AurenPlusSheetProps) {
  const { height } = useWindowDimensions();
  const [recentPhotos, setRecentPhotos] = useState<RecentPhoto[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);

  const selectedCount = selectedPhotoIds.length;
  const placeholderCount = Math.max(0, RECENT_PHOTO_LIMIT - recentPhotos.length);
  const placeholderItems = PHOTO_PLACEHOLDERS.slice(0, placeholderCount);

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

  function togglePhotoSelection(photoId: string) {
    setSelectedPhotoIds((currentIds) => {
      if (currentIds.includes(photoId)) {
        return currentIds.filter((id) => id !== photoId);
      }

      return [...currentIds, photoId];
    });
  }

  useEffect(() => {
    animateToStage(stage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, closedY, expandedY, peekY]);

  useEffect(() => {
    if (stage === 'closed') {
      setSelectedPhotoIds([]);
      return undefined;
    }

    let isMounted = true;

    async function loadRecentPhotos() {
      try {
        let permission = await MediaLibrary.getPermissionsAsync();

        if (!permission.granted && permission.canAskAgain) {
          permission = await MediaLibrary.requestPermissionsAsync();
        }

        if (!isMounted || !permission.granted) {
          setRecentPhotos([]);
          return;
        }

        const result = await MediaLibrary.getAssetsAsync({
          first: RECENT_PHOTO_LIMIT,
          mediaType: MediaLibrary.MediaType.photo,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });

        const photos = await Promise.all(
          result.assets.map(async (asset) => {
            try {
              const info = await MediaLibrary.getAssetInfoAsync(asset);
              const uri = info.localUri ?? asset.uri;

              if (!canRenderImageUri(uri)) return null;

              return {
                id: asset.id,
                uri,
              };
            } catch {
              if (!canRenderImageUri(asset.uri)) return null;

              return {
                id: asset.id,
                uri: asset.uri,
              };
            }
          }),
        );

        if (!isMounted) return;

        setRecentPhotos(photos.filter((photo): photo is RecentPhoto => Boolean(photo)));
      } catch (error) {
        if (isMounted) {
          setRecentPhotos([]);
        }
      }
    }

    void loadRecentPhotos();

    return () => {
      isMounted = false;
    };
  }, [stage]);

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

      <View style={styles.content}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoRail}
        >
          <Pressable style={[styles.photoTile, styles.cameraTile]}>
            <View style={styles.cameraIcon}>
              <View style={styles.cameraTop} />
              <View style={styles.cameraLens} />
            </View>
          </Pressable>

          {recentPhotos.map((photo) => {
            const selectedIndex = selectedPhotoIds.indexOf(photo.id);
            const isSelected = selectedIndex >= 0;

            return (
              <Pressable
                key={photo.id}
                onPress={() => togglePhotoSelection(photo.id)}
                style={[styles.photoTile, isSelected && styles.photoTileSelected]}
              >
                <Image source={{ uri: photo.uri }} style={styles.photoImage} resizeMode="cover" />
                <View style={[styles.photoSelectCircle, isSelected && styles.photoSelectCircleSelected]}>
                  {isSelected ? <Text style={styles.photoSelectNumber}>{selectedIndex + 1}</Text> : null}
                </View>
              </Pressable>
            );
          })}

          {placeholderItems.map((photoKey) => (
            <View key={photoKey} style={[styles.photoTile, styles.placeholderTile]}>
              <View style={styles.placeholderGlow} />
              <View style={styles.photoSelectCircle} />
            </View>
          ))}
        </ScrollView>

        <View style={styles.photoDivider} />

        <View style={styles.actionsCard}>
          <Pressable style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}>
            <View style={styles.actionIconWrap}>
              <GlobeIcon />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Web search</Text>
              <Text style={styles.actionSubtitle}>Search current information</Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
          </Pressable>

          <View style={styles.actionDivider} />

          <Pressable style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}>
            <View style={styles.actionIconWrap}>
              <PaperclipIcon />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Add files</Text>
              <Text style={styles.actionSubtitle}>Docs, PDFs and images</Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
          </Pressable>
        </View>
      </View>

      {selectedCount > 0 ? (
        <Pressable style={styles.confirmButton}>
          <Text style={styles.confirmText}>{selectedCount === 1 ? 'Add 1 photo' : `Add ${selectedCount} photos`}</Text>
        </Pressable>
      ) : null}
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
  content: {
    paddingTop: 34,
  },
  photoRail: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 12,
  },
  photoTile: {
    width: 106,
    height: 106,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.055)',
    backgroundColor: 'rgba(246,247,249,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.tiny,
  },
  photoTileSelected: {
    borderWidth: 3,
    borderColor: '#2f7df6',
  },
  cameraTile: {
    backgroundColor: 'rgba(240,242,244,0.96)',
  },
  cameraIcon: {
    width: 46,
    height: 34,
    borderRadius: 10,
    borderWidth: 4,
    borderColor: '#626771',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTop: {
    position: 'absolute',
    top: -9,
    width: 20,
    height: 9,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: '#626771',
  },
  cameraLens: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: '#626771',
  },
  photoImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  placeholderTile: {
    backgroundColor: 'rgba(244,245,247,0.92)',
  },
  placeholderGlow: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.52)',
  },
  photoSelectCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.94)',
    backgroundColor: 'rgba(81,85,94,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSelectCircleSelected: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  photoSelectNumber: {
    color: '#111217',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  photoDivider: {
    marginTop: 25,
    marginHorizontal: 24,
    height: 1,
    backgroundColor: 'rgba(17,24,39,0.07)',
  },
  actionsCard: {
    marginTop: 18,
    marginHorizontal: 24,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.46)',
    overflow: 'hidden',
  },
  actionRow: {
    minHeight: 70,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionRowPressed: {
    backgroundColor: 'rgba(17,24,39,0.035)',
  },
  actionDivider: {
    height: 1,
    marginLeft: 58,
    backgroundColor: 'rgba(17,24,39,0.07)',
  },
  actionIconWrap: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrap: {
    flex: 1,
    marginLeft: 14,
  },
  actionTitle: {
    color: '#111217',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.34,
  },
  actionSubtitle: {
    marginTop: 4,
    color: '#8c8f98',
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.14,
  },
  actionChevron: {
    marginLeft: 8,
    color: '#a0a4ad',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },
  globeIcon: {
    width: 29,
    height: 29,
    borderRadius: 999,
    borderWidth: 2.4,
    borderColor: '#111217',
    alignItems: 'center',
    justifyContent: 'center',
  },
  globeHorizontal: {
    position: 'absolute',
    width: 23,
    height: 2.4,
    borderRadius: 999,
    backgroundColor: '#111217',
  },
  globeVerticalOval: {
    width: 13,
    height: 27,
    borderRadius: 999,
    borderWidth: 2.2,
    borderColor: '#111217',
  },
  paperclipIcon: {
    width: 17,
    height: 32,
    borderRadius: 999,
    borderWidth: 2.6,
    borderColor: '#111217',
    transform: [{ rotate: '8deg' }],
  },
  paperclipInner: {
    position: 'absolute',
    left: 4,
    top: 6,
    width: 7,
    height: 19,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#111217',
  },
  confirmButton: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 28,
    minHeight: 62,
    borderRadius: 999,
    backgroundColor: '#050507',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.35,
  },
});