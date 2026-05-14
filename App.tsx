import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import { AurenAuthScreen } from './src/screens/AurenAuthScreen';
import { AurenEmailAuthScreen } from './src/screens/AurenEmailAuthScreen';
import { AurenHomeScreen } from './src/screens/AurenHomeScreen';
import { colors } from './src/theme';

type AuthView = 'main' | 'email';

export default function App() {
  const [authView, setAuthView] = useState<AuthView>('main');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const authListener = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      authListener.data.subscription.unsubscribe();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        {loading ? (
          <View style={styles.loadingScreen}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : session ? (
          <AurenHomeScreen session={session} />
        ) : authView === 'email' ? (
          <AurenEmailAuthScreen onBack={() => setAuthView('main')} />
        ) : (
          <AurenAuthScreen onContinue={() => setAuthView('email')} onEmailContinue={() => setAuthView('email')} />
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
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fbfbfa',
  },
});
