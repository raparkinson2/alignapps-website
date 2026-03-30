import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
          <LinearGradient
            colors={['#0f172a', '#1e293b', '#0f172a']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <Text style={{ color: '#f8fafc', fontSize: 20, fontWeight: '700', marginBottom: 12, textAlign: 'center' }}>
              Something went wrong
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
              The app hit an unexpected error. Tap below to try again.
            </Text>
            <Pressable
              onPress={() => this.setState({ hasError: false, error: null })}
              style={{ backgroundColor: '#0ea5e9', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Try Again</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}
