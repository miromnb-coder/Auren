import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

type AurenEmailAuthScreenProps = {
  onBack: () => void;
  onContinue: () => void;
};

export function AurenEmailAuthScreen({ onBack, onContinue }: AurenEmailAuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <LinearGradient colors={['#fbfbfa', '#f7f7f5', '#eef1f2']} locations={[0, 0.7, 1]} style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.hero}>
          <Text style={styles.wordmark}>A U R E N</Text>
          <Text style={styles.title}>Continue with Email</Text>
          <Text style={styles.subtitle}>Sign in or create your account with your email.</Text>
        </View>

        <View style={styles.formCardOuter}>
          <View style={styles.formCardHighlight} />
          <View style={styles.formCard}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputShell}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#858995"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                style={styles.input}
              />
            </View>

            <Text style={[styles.label, styles.passwordLabel]}>Password</Text>
            <View style={styles.inputShell}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#858995"
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                style={styles.input}
              />
              <Pressable
                onPress={() => setPasswordVisible((current) => !current)}
                hitSlop={12}
                style={styles.eyeButton}
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
              >
                <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={25} color="#7c818b" />
              </Pressable>
            </View>

            <Pressable hitSlop={10} style={styles.forgotButton} accessibilityRole="button" accessibilityLabel="Forgot password">
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

            <Pressable
              onPress={onContinue}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Continue"
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </Pressable>

            <Pressable
              onPress={onContinue}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Send magic link"
            >
              <Text style={styles.secondaryButtonText}>Send magic link</Text>
            </Pressable>

            <View style={styles.backRow}>
              <View style={styles.backLine} />
              <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to sign in">
                <Text style={styles.backText}>Back to sign in</Text>
              </Pressable>
              <View style={styles.backLine} />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    paddingTop: 158,
  },
  wordmark: {
    color: '#202126',
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 11,
    marginLeft: 11,
    fontWeight: '300',
  },
  title: {
    marginTop: 72,
    color: '#1f2229',
    fontSize: 39,
    lineHeight: 48,
    letterSpacing: -1.15,
    textAlign: 'center',
    fontWeight: '760',
  },
  subtitle: {
    marginTop: 18,
    color: '#737780',
    fontSize: 17.5,
    lineHeight: 25,
    letterSpacing: -0.18,
    textAlign: 'center',
    fontWeight: '430',
  },
  formCardOuter: {
    marginBottom: 44,
    borderRadius: 34,
    padding: 1,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#111827',
    shadowOpacity: 0.065,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 24 },
    elevation: 8,
  },
  formCardHighlight: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: -8,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.48)',
    opacity: 0.72,
  },
  formCard: {
    borderRadius: 33,
    paddingHorizontal: 31,
    paddingTop: 31,
    paddingBottom: 25,
    backgroundColor: 'rgba(255,255,255,0.44)',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.028)',
    overflow: 'hidden',
  },
  label: {
    color: '#202126',
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.18,
    fontWeight: '560',
  },
  passwordLabel: {
    marginTop: 25,
  },
  inputShell: {
    marginTop: 12,
    height: 58,
    borderRadius: 17,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#111827',
    shadowOpacity: 0.045,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 9 },
    elevation: 3,
  },
  input: {
    flex: 1,
    padding: 0,
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.18,
  },
  eyeButton: {
    width: 36,
    height: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: 16,
    marginBottom: 28,
  },
  forgotText: {
    color: '#737780',
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.14,
    fontWeight: '470',
  },
  primaryButton: {
    height: 58,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1d1d1f',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.26,
    fontWeight: '560',
  },
  secondaryButton: {
    marginTop: 12,
    height: 58,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#111827',
    shadowOpacity: 0.044,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  secondaryButtonText: {
    color: '#1f2229',
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.28,
    fontWeight: '540',
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.86,
  },
  backRow: {
    marginTop: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  backLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(17,24,39,0.08)',
  },
  backText: {
    color: '#747881',
    fontSize: 14.5,
    lineHeight: 20,
    letterSpacing: -0.12,
    fontWeight: '470',
  },
});
