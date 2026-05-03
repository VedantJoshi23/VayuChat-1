import { NavigationContainer } from '@react-navigation/native';
import { Component, ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import EmptyState from './src/components/EmptyState';
import { AlertCircle, Cpu } from './src/components/icons';
import { initDatabase } from './src/database/db';
import RootNavigator from './src/navigation/RootNavigator';
import { Colors } from './src/theme/colors';

// FIX: Add Error Boundary to catch render-time errors
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={[styles.container, { backgroundColor: Colors.background }]}>
          <EmptyState
            icon={AlertCircle}
            title="Application Error"
            body={this.state.error?.message || 'An unexpected error occurred'}
            tone="warning"
          />
          <TouchableOpacity
            style={{ marginTop: 16, padding: 12, backgroundColor: Colors.primary, borderRadius: 8 }}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={{ color: Colors.white, textAlign: 'center', fontWeight: '600' }}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    initDatabase()
      .then(() => {
        if (!mounted) return;
        setDbReady(true);
        setDbError(null);
      })
      .catch((error) => {
        console.error('Failed to initialize database:', error);
        if (!mounted) return;
        setDbError(error instanceof Error ? error.message : 'Unknown database error');
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        {!dbReady ? (
          <View style={styles.container}>
            {dbError ? (
              <EmptyState
                icon={AlertCircle}
                title="Database failed to initialize"
                body={dbError}
                tone="warning"
              />
            ) : (
              <View style={styles.loadingWrap}>
                <View style={styles.loadingIcon}>
                  <Cpu size={28} color={Colors.primary} strokeWidth={1.8} />
                </View>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            )}
          </View>
        ) : (
          <NavigationContainer>
            <View style={styles.container}>
              <RootNavigator />
            </View>
          </NavigationContainer>
        )}
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  loadingIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${Colors.primary}14`,
  },
});
