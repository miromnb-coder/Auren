import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, shadows } from '../theme';

type AurenAuthScreenProps = {
  onContinue: () => void;
};

type AuthButtonProps = {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  variant?: 'dark' | 'light';
  iconColor?: string;
  onPress: () => void;
};

function AuthButton({ label, iconName, variant = 'light', iconColor, onPress }: AuthButtonProps) {
  const dark = variant === 'dark';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.authButton,
        dark ? styles.authButtonDark : styles.authButtonLight,
        pressed && styles.authButtonPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={iconName} size={25} color={iconColor ?? (dark ? '#ffffff' : colors.text)} />
      <Text style={[styles.authButtonText, dark ? styles.authButtonTextDark : styles.authButtonTextLight]}>{label}</Text>
    </Pressable>
  );
}

export function AurenAuthScreen({ onContinue }: AurenAuthScreenProps) {
  return (
    <LinearGradient colors={['#fbfbfa', '#f5f6f4', '#eef0f2']} style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.hero}>
          <Text style={styles.wordmark}>A U R E N</Text>
          <Text style={styles.title}>Auren helps you{`\n`}think, plan, and act</Text>
          <Text style={styles.subtitle}>One place for decisions, planning, and action.</Text>
        </View>

        <View style={styles.authCardOuter}>
          <View style={styles.authCardHighlight} />
          <View style={styles.authCard}>
            <AuthButton label="Continue with Apple" iconName="logo-apple" variant="dark" onPress={onContinue} />
            <AuthButton label="Continue with Google" iconName="logo-google" iconColor="#4285F4" onPress={onContinue} />
            <AuthButton label="Continue with Email" iconName="mail-outline" onPress={onContinue} />

            <Pressable onPress={onContinue} hitSlop={12} style={styles.loginRow} accessibilityRole="button" accessibilityLabel="Log in">
              <Text style={styles.loginText}>Already have an account? </Text>
              <Text style={styles.loginLink}>Log in</Text>
            </Pressable>
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 52,
  },
  wordmark: {
    color: '#202126',
    fontSize: 23,
    lineHeight: 29,
    letterSpacing: 11,
    marginLeft: 11,
    fontWeight: '300',
  },
  title: {
    marginTop: 74,
    color: '#1f2229',
    fontSize: 38,
    lineHeight: 48,
    letterSpacing: -1.15,
    textAlign: 'center',
    fontWeight: '720',
  },
  subtitle: {
    marginTop: 26,
    color: '#737780',
    fontSize: 19,
    lineHeight: 27,
    letterSpacing: -0.2,
    textAlign: 'center',
    fontWeight: '430',
  },
  authCardOuter: {
    marginBottom: 56,
    borderRadius: 34,
    padding: 1,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.76)',
    ...shadows.soft,
  },
  authCardHighlight: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: -8,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.54)',
    opacity: 0.8,
  },
  authCard: {
    borderRadius: 33,
    paddingHorizontal: 17,
    paddingTop: 22,
    paddingBottom: 25,
    backgroundColor: 'rgba(255,255,255,0.43)',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.04)',
    overflow: 'hidden',
  },
  authButton: {
    height: 58,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  authButtonDark: {
    backgroundColor: '#1d1d1f',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  authButtonLight: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.82)',
    shadowColor: '#111827',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  authButtonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.86,
  },
  authButtonText: {
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
    fontWeight: '520',
  },
  authButtonTextDark: {
    color: '#ffffff',
  },
  authButtonTextLight: {
    color: '#2b2d33',
  },
  loginRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    color: '#747881',
    fontSize: 15.5,
    lineHeight: 22,
    letterSpacing: -0.15,
    fontWeight: '430',
  },
  loginLink: {
    color: '#4a4d55',
    fontSize: 15.5,
    lineHeight: 22,
    letterSpacing: -0.15,
    fontWeight: '720',
  },
});
