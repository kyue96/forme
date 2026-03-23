import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = async () => {
    try {
      const Updates = require('expo-updates');
      await Updates.reloadAsync();
    } catch {
      // expo-updates not available (dev mode or not installed) — reset state
      this.setState({ hasError: false });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{
          flex: 1,
          backgroundColor: '#000000',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}>
          <Text style={{
            fontSize: 24,
            fontWeight: '800',
            color: '#FFFFFF',
            marginBottom: 12,
            textAlign: 'center',
          }}>
            Something went wrong
          </Text>
          <Text style={{
            fontSize: 14,
            color: '#FFFFFF99',
            marginBottom: 32,
            textAlign: 'center',
            lineHeight: 20,
          }}>
            An unexpected error occurred. Tap below to reload the app.
          </Text>
          <Pressable
            onPress={this.handleReload}
            style={{
              backgroundColor: '#F59E0B',
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 12,
            }}
          >
            <Text style={{
              fontSize: 16,
              fontWeight: '700',
              color: '#000000',
            }}>
              Tap to reload
            </Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}
