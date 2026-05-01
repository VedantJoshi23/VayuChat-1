import React, { useEffect } from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { initDatabase } from './src/database/db';
import RootNavigator from './src/navigation/RootNavigator';
import { Colors } from './src/theme/colors';

function App() {
  useEffect(() => {
    initDatabase().catch((error) => {
      console.error('Failed to initialize database:', error);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        <View style={{ flex: 1, backgroundColor: Colors.white }}>
          <RootNavigator />
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
