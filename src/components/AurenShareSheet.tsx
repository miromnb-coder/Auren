import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadows } from '../theme';

type AurenShareSheetProps = {
  open: boolean;
  onClose: () => void;
};

function ShareOptionIcon({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.optionIconBox}>
      <Ionicons name={name} size={27} color="#111217" />
    </View>
  );
}

export function AurenShareSheet({ open, onClose }: AurenShareSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.layer} pointerEvents="box-none">
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) + 8 }]}>
          <View style={styles.headerRow}>
            <Pressable onPress={onClose} hitSlop={14} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Close share sheet">
              <Ionicons name="close" size={35} color="#111217" />
            </Pressable>
            <Text style={styles.title}>Share conversation</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.segmentedControl}>
            <View style={styles.segmentActive}>
              <Text style={styles.segmentActiveText}>Share</Text>
            </View>
            <View style={styles.segmentInactive}>
              <Text style={styles.segmentInactiveText}>Export</Text>
            </View>
          </View>

          <View style={styles.optionsWrap}>
            <View style={styles.optionRow}>
              <ShareOptionIcon name="lock-closed-outline" />
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>Only me</Text>
                <Text style={styles.optionSubtitle}>Keep this chat private</Text>
              </View>
              <Ionicons name="checkmark" size={31} color="#111217" />
            </View>

            <View style={styles.divider} />

            <View style={styles.optionRow}>
              <ShareOptionIcon name="globe-outline" />
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>Public link</Text>
                <Text style={styles.optionSubtitle}>Anyone with the link can view</Text>
              </View>
              <View style={styles.emptyCheckSpace} />
            </View>
          </View>

          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]} accessibilityRole="button" accessibilityLabel="Share now">
            <Text style={styles.primaryButtonText}>Share now</Text>
          </Pressable>

          <Text style={styles.footerNote}>Share study chats carefully. Avoid sensitive{`\n`}personal information.</Text>
        </View>
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
    minHeight: 566,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#fbfbfa',
    paddingTop: 28,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.74)',
    ...shadows.soft,
  },
  headerRow: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.62,
  },
  title: {
    flex: 1,
    color: '#050505',
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: -0.55,
    fontWeight: '750',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 42,
    height: 42,
  },
  segmentedControl: {
    marginTop: 27,
    height: 61,
    borderRadius: 9,
    backgroundColor: '#eeeeef',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.04)',
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
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  segmentInactive: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActiveText: {
    color: '#050505',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.28,
  },
  segmentInactiveText: {
    color: '#050505',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '450',
    letterSpacing: -0.24,
  },
  optionsWrap: {
    marginTop: 30,
  },
  optionRow: {
    minHeight: 90,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIconBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#f0f0ef',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 19,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    color: '#202020',
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.45,
    fontWeight: '450',
  },
  optionSubtitle: {
    marginTop: 1,
    color: '#8c8c91',
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.22,
    fontWeight: '400',
  },
  divider: {
    height: 1,
    marginLeft: 83,
    backgroundColor: 'rgba(17,24,39,0.075)',
  },
  emptyCheckSpace: {
    width: 31,
  },
  primaryButton: {
    height: 74,
    marginTop: 39,
    borderRadius: 16,
    backgroundColor: '#080808',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonPressed: {
    opacity: 0.86,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.42,
    fontWeight: '500',
  },
  footerNote: {
    marginTop: 28,
    color: '#9c9da2',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.18,
    textAlign: 'center',
    fontWeight: '400',
  },
});
