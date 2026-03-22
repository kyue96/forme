import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/lib/settings-context';

interface FormeCoachCardProps {
  message?: string;
}

const DEFAULT_MESSAGE =
  "Your body builds muscle during rest, not during the workout. Stay hydrated, get quality sleep, and you'll come back stronger tomorrow.";

export default function FormeCoachCard({
  message = DEFAULT_MESSAGE,
}: FormeCoachCardProps) {
  const { theme } = useSettings();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
        >
          <Ionicons name="person" size={16} color={theme.textSecondary} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.label, { color: theme.text }]}>Forme Coach</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Daily tip
          </Text>
        </View>
      </View>

      {/* Message bubble */}
      <View
        style={[
          styles.bubble,
          { backgroundColor: theme.background, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.bubbleText, { color: theme.text }]}>
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerText: {
    marginLeft: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  bubble: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 19,
  },
});
