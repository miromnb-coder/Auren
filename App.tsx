import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AurenAuthScreen } from './src/screens/AurenAuthScreen';
import { AurenHomeScreen } from './src/screens/AurenHomeScreen';
import { colors } from './src/theme';

export default function App() {
  const [showAuth, setShowAuth] = useState(true);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        {showAuth ? <AurenAuthScreen onContinue={() => setShowAuth(false)} /> : <AurenHomeScreen />}
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
