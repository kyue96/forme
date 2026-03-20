import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/lib/settings-context';
import { REACTION_EMOJIS } from '@/lib/social-types';
import { animateLayout } from '@/lib/utils';

interface ReactionBarProps {
  likeCount: number;
  userReactions: string[];
  onToggle: (emoji: string) => void;
}

export function ReactionBar({ likeCount, userReactions, onToggle }: ReactionBarProps) {
  const { theme } = useSettings();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customEmojiOpen, setCustomEmojiOpen] = useState(false);
  const [customEmoji, setCustomEmoji] = useState('');
  const hasReaction = userReactions.length > 0;
  const activeEmoji = userReactions[0] ?? null;

  const togglePicker = () => {
    animateLayout();
    setPickerOpen(!pickerOpen);
  };

  const handleSelect = (emoji: string) => {
    onToggle(emoji);
    setPickerOpen(false);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {/* Active reaction display or smiley trigger */}
      {hasReaction && !pickerOpen ? (
        <Pressable
          onPress={togglePicker}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 20,
            backgroundColor: theme.text + '12',
            borderWidth: 1,
            borderColor: theme.text + '30',
          }}
        >
          <Text style={{ fontSize: 16 }}>{activeEmoji}</Text>
        </Pressable>
      ) : !pickerOpen ? (
        <Pressable
          onPress={togglePicker}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="happy-outline" size={18} color={theme.chrome} />
        </Pressable>
      ) : null}

      {/* Expanded emoji picker */}
      {pickerOpen && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {REACTION_EMOJIS.map((emoji, idx) => {
            const isActive = activeEmoji === emoji;
            return (
              <Pressable
                key={`${emoji}-${idx}`}
                onPress={() => handleSelect(emoji)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: isActive ? theme.text + '12' : 'transparent',
                  borderWidth: 1,
                  borderColor: isActive ? theme.text + '30' : theme.border,
                }}
              >
                <Text style={{ fontSize: 16 }}>{emoji}</Text>
              </Pressable>
            );
          })}
          {customEmojiOpen ? (
            <TextInput
              style={{
                width: 40,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: theme.border,
                fontSize: 16,
                textAlign: 'center',
                color: theme.text,
              }}
              maxLength={2}
              autoFocus
              value={customEmoji}
              onChangeText={setCustomEmoji}
              returnKeyType="send"
              onSubmitEditing={() => {
                if (customEmoji.trim()) {
                  handleSelect(customEmoji.trim());
                  setCustomEmoji('');
                  setCustomEmojiOpen(false);
                }
              }}
            />
          ) : (
            <Pressable
              onPress={() => setCustomEmojiOpen(true)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <Ionicons name="add" size={16} color={theme.chrome} />
            </Pressable>
          )}
          <Pressable onPress={() => { togglePicker(); setCustomEmojiOpen(false); setCustomEmoji(''); }} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
      )}

      {likeCount > 0 && (
        <Text style={{ fontSize: 13, color: theme.textSecondary, marginLeft: 4 }}>
          {likeCount}
        </Text>
      )}
    </View>
  );
}
