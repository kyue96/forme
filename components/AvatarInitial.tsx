import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useSettings } from '@/lib/settings-context';

// Deterministic color from name string
const AVATAR_COLORS = [
  '#F59E0B', '#EF4444', '#3B82F6', '#10B981', '#8B5CF6',
  '#EC4899', '#F97316', '#06B6D4', '#6366F1', '#14B8A6',
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface AvatarInitialProps {
  name: string;
  avatarUrl?: string | null;
  avatarColor?: string | null;
  size: number;
  isTraining?: boolean;
}

export function AvatarInitial({ name, avatarUrl, avatarColor, size, isTraining }: AvatarInitialProps) {
  const { theme } = useSettings();
  const [imgError, setImgError] = useState(false);
  const initial = (name || '?').charAt(0).toUpperCase();
  const bgColor = avatarColor || getColorForName(name || 'U');
  const fontSize = Math.round(size * 0.42);
  const borderRadius = size / 2;

  const showImage = !!avatarUrl && !imgError;

  return (
    <View style={{
      width: size,
      height: size,
      borderRadius,
      overflow: 'hidden',
      ...(isTraining ? {
        borderWidth: 2,
        borderColor: '#22C55E',
      } : {}),
    }}>
      {showImage ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: size, height: size, borderRadius }}
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={{
          width: '100%',
          height: '100%',
          backgroundColor: bgColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{
            fontSize,
            fontWeight: '700',
            color: '#FFFFFF',
          }}>
            {initial}
          </Text>
        </View>
      )}
      {isTraining && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: Math.round(size * 0.3),
          height: Math.round(size * 0.3),
          borderRadius: Math.round(size * 0.15),
          backgroundColor: '#22C55E',
          borderWidth: 2,
          borderColor: theme.background,
        }} />
      )}
    </View>
  );
}
