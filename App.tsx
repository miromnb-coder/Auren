import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AurenAuthScreen } from './src/screens/AurenAuthScreen';
import { AurenEmailAuthScreen } from './src/screens/AurenEmailAuthScreen';
import { AurenHomeScreen } from './src/screens/AurenHomeScreen';
import { colors } from './src/theme';

type AuthView = 'main' | 'email';

export default function App() {
  const [showAuth, setShowAuth] = useState(true);
  const [authView, setAuthView] = useState<AuthView>('main');

  function openApp() {
    setShowAuth(false);
  }

  function openEmailAuth() {
    setAuthView('email');
  }

  function openMainAuth() {
    setAuthView('main');
  }

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        {showAuth ? (
          authView === 'email' ? (
            <AurenEmailAuthScreen onBack={openMainAuth} onContinue={openApp} />
          ) : (
            <AurenAuthScreen onContinue={openApp} onEmailContinue={openEmailAuth} />
          )
        ) : (
          <AurenHomeScreen />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
