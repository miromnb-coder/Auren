import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { shadows } from '../theme';

export type AurenStudyFocusSetupInput = {
  subject: string;
  taskTitle: string;
  nextStep: string;
  sessionMinutes: number;
  deadlineText: string;
};

type Props = {
  open: boolean;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (input: AurenStudyFocusSetupInput) => void;
};

const SESSION_OPTIONS = [15, 20, 25, 30, 45];
const DEFAULT_SESSION_MINUTES = 25;

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function AurenStudyFocusSetupSheet({ open, saving = false, error, onClose, onSave }: Props) {
  const { height } = useWindowDimensions();
  const [subject, setSubject] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [deadlineText, setDeadlineText] = useState('');
  const [sessionMinutes, setSessionMinutes] = useState(DEFAULT_SESSION_MINUTES);

  const sheetHeight = useMemo(() => Math.min(Math.max(height * 0.78, 620), height * 0.92), [height]);
  const closedY = sheetHeight + 32;
  const translateY = useRef(new Animated.Value(closedY)).current;

  const canSave = clean(taskTitle).length > 0 && clean(nextStep).length > 0 && !saving;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: open ? 0 : closedY,
      duration: open ? 330 : 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [closedY, open, translateY]);

  function handleClose() {
    Keyboard.dismiss();
    onClose();
  }

  function handleSave() {
    if (!canSave) return;

    Keyboard.dismiss();
    onSave({
      subject: clean(subject),
      taskTitle: clean(taskTitle),
      nextStep: clean(nextStep),
      sessionMinutes,
      deadlineText: clean(deadlineText),
    });
  }

  return (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      style={[styles.sheet, { height: sheetHeight, transform: [{ translateY }] }]}
    >
      <View style={styles.solidFill} />
      <View style={styles.handle} />

      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.eyebrow}>STUDY SETUP</Text>
          <Text style={styles.title}>Set your focus</Text>
          <Text style={styles.subtitle}>Create the study card Auren should guide you through next.</Text>
        </View>
        <Pressable onPress={handleClose} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Subject</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="Math, Biology, English…"
            placeholderTextColor="#a0a2aa"
            style={styles.input}
            returnKeyType="next"
            autoCorrect
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>What are you working on?</Text>
          <TextInput
            value={taskTitle}
            onChangeText={setTaskTitle}
            placeholder="Math exam prep"
            placeholderTextColor="#a0a2aa"
            style={styles.input}
            returnKeyType="next"
            autoCorrect
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Next step</Text>
          <TextInput
            value={nextStep}
            onChangeText={setNextStep}
            placeholder="Review equations"
            placeholderTextColor="#a0a2aa"
            style={styles.input}
            returnKeyType="next"
            autoCorrect
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Session length</Text>
          <View style={styles.sessionRow}>
            {SESSION_OPTIONS.map((minutes) => {
              const selected = minutes === sessionMinutes;
              return (
                <Pressable
                  key={minutes}
                  onPress={() => setSessionMinutes(minutes)}
                  style={({ pressed }) => [styles.sessionChip, selected && styles.sessionChipSelected, pressed && styles.pressed]}
                >
                  <Text style={[styles.sessionChipText, selected && styles.sessionChipTextSelected]}>{minutes} min</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Deadline optional</Text>
          <TextInput
            value={deadlineText}
            onChangeText={setDeadlineText}
            placeholder="YYYY-MM-DD or Friday"
            placeholderTextColor="#a0a2aa"
            style={styles.input}
            returnKeyType="done"
            autoCorrect
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={!canSave}
          onPress={handleSave}
          style={({ pressed }) => [styles.saveButton, !canSave && styles.saveButtonDisabled, pressed && canSave && styles.saveButtonPressed]}
        >
          <Text style={styles.saveText}>{saving ? 'Saving focus…' : 'Save Today’s Focus'}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 52,
    elevation: 52,
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
  header: {
    paddingTop: 24,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  titleWrap: {
    flex: 1,
    paddingRight: 18,
  },
  eyebrow: {
    color: '#8b8c96',
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 3.2,
    fontWeight: '700',
  },
  title: {
    marginTop: 7,
    color: '#15161a',
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.82,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    color: '#81838c',
    fontSize: 15.5,
    lineHeight: 21,
    letterSpacing: -0.18,
    fontWeight: '500',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: 'rgba(246,247,249,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.055)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#62656f',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '500',
  },
  scrollContent: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 116,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    color: '#676974',
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: -0.08,
  },
  input: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.075)',
    backgroundColor: 'rgba(255,255,255,0.68)',
    paddingHorizontal: 16,
    color: '#17181c',
    fontSize: 16.5,
    lineHeight: 21,
    letterSpacing: -0.25,
    fontWeight: '500',
  },
  sessionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  sessionChip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.075)',
    backgroundColor: 'rgba(255,255,255,0.56)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionChipSelected: {
    backgroundColor: '#15161a',
    borderColor: '#15161a',
  },
  sessionChipText: {
    color: '#6f717a',
    fontSize: 14.5,
    lineHeight: 18,
    fontWeight: '650',
    letterSpacing: -0.18,
  },
  sessionChipTextSelected: {
    color: '#ffffff',
  },
  errorText: {
    marginTop: 2,
    color: '#b54d4d',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 28,
  },
  saveButton: {
    minHeight: 62,
    borderRadius: 999,
    backgroundColor: '#050507',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  saveButtonDisabled: {
    opacity: 0.38,
  },
  saveButtonPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.9,
  },
  saveText: {
    color: '#ffffff',
    fontSize: 18.5,
    lineHeight: 23,
    fontWeight: '750',
    letterSpacing: -0.32,
  },
  pressed: {
    opacity: 0.74,
  },
});