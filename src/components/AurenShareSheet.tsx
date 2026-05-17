import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadows } from '../theme';

type AurenShareSheetProps = {
  open: boolean;
  onClose: () => void;
};

const SHEET_CLOSED_TRANSLATE_Y = 520;
const SHEET_OPEN_DURATION = 330;
const SHEET_CLOSE_DURATION = 240;

function ShareOptionIcon({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.optionIconBox}>
      <Ionicons name={name} size={23} color="#111217" />
    </View>
  );
}

export function AurenShareSheet({ open, onClose }: AurenShareSheetProps) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(open);
  const mountedRef = useRef(open);
  const sheetTranslateY = useRef(new Animated.Value(SHEET_CLOSED_TRANSLATE_Y)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      mountedRef.current = true;
      setMounted(true);
      sheetTranslateY.setValue(SHEET_CLOSED_TRANSLATE_Y);
      backdropOpacity.setValue(0);

      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 190,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(sheetTranslateY, {
            toValue: 0,
            duration: SHEET_OPEN_DURATION,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });

      return;
    }

    if (mountedRef.current) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: SHEET_CLOSED_TRANSLATE_Y,
          duration: SHEET_CLOSE_DURATION,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        mountedRef.current = false;
        setMounted(false);
      });
    }
  }, [backdropOpacity, open, sheetTranslateY]);

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.layer} pointerEvents="box-none">
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) + 2, transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={styles.headerRow}>
            <Pressable onPress={onClose} hitSlop={14} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Close share sheet">
              <Ionicons name="close" size={29} color="#111217" />
            </Pressable>
            <Text style={styles.title}>Share study session</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.segmentedControl}>
            <View style={styles.segmentActive}>
              <Text style={styles.segmentActiveText}>Link</Text>
            </View>
            <View style={styles.segmentInactive}>
              <Text style={styles.segmentInactiveText}>Export</Text>
            </View>
          </View>

          <View style={styles.optionsWrap}>
            <View style={styles.optionRow}>
              <ShareOptionIcon name="lock-closed-outline" />
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>Private copy</Text>
                <Text style={styles.optionSubtitle}>Visible only in your account</Text>
              </View>
              <Ionicons name="checkmark" size={26} color="#111217" />
            </View>

            <View style={styles.divider} />

            <View style={styles.optionRow}>
              <ShareOptionIcon name="globe-outline" />
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>Class link</Text>
                <Text style={styles.optionSubtitle}>Create a read-only link for classmates</Text>
              </View>
              <View style={styles.emptyCheckSpace} />
            </View>
          </View>

          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]} accessibilityRole="button" accessibilityLabel="Generate link">
            <View style={styles.primaryButtonContent}>
              <Ionicons name="link-outline" size={22} color="#ffffff" />
              <Text style={styles.primaryButtonText}>Generate link</Text>
            </View>
          </Pressable>

          <Text style={styles.footerNote}>Share only the study content you want others to see.</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.56)',
  },
  sheet: {
    minHeight: 390,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#fbfbfa',
    paddingTop: 22,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.74)',
    ...shadows.soft,
  },
  headerRow: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.62,
  },
  title: {
    flex: 1,
    color: '#050505',
    fontSize: 18.2,
    lineHeight: 23,
    letterSpacing: -0.32,
    fontWeight: '750',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 34,
    height: 34,
  },
  segmentedControl: {
    marginTop: 22,
    height: 48,
    borderRadius: 9,
    backgroundColor: '#eeeeef',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.045)',
    padding: 2,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  segmentActive: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOpacity: 0.065,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  segmentInactive: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActiveText: {
    color: '#050505',
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: -0.22,
  },
  segmentInactiveText: {
    color: '#050505',
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '450',
    letterSpacing: -0.2,
  },
  optionsWrap: {
    marginTop: 25,
  },
  optionRow: {
    minHeight: 69,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#f0f0ef',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    color: '#202020',
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.36,
    fontWeight: '450',
  },
  optionSubtitle: {
    marginTop: 1,
    color: '#8c8c91',
    fontSize: 15.7,
    lineHeight: 20,
    letterSpacing: -0.16,
    fontWeight: '400',
  },
  divider: {
    height: 1,
    marginLeft: 64,
    backgroundColor: 'rgba(17,24,39,0.075)',
  },
  emptyCheckSpace: {
    width: 26,
  },
  primaryButton: {
    height: 55,
    marginTop: 27,
    borderRadius: 13,
    backgroundColor: '#080808',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonPressed: {
    opacity: 0.86,
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18.5,
    lineHeight: 23,
    letterSpacing: -0.32,
    fontWeight: '500',
  },
  footerNote: {
    marginTop: 22,
    color: '#9c9da2',
    fontSize: 13.5,
    lineHeight: 18.5,
    letterSpacing: -0.12,
    textAlign: 'center',
    fontWeight: '400',
  },
});
