import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useSettings } from '@/lib/settings-context';
import { useSocialStore } from '@/lib/social-store';
import { AvatarInitial } from '@/components/AvatarInitial';
import type { Comment } from '@/lib/social-types';

interface CommentSheetProps {
  postId: string;
  visible: boolean;
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export function CommentSheet({ postId, visible, onClose }: CommentSheetProps) {
  const { theme } = useSettings();
  const { loadComments, addComment } = useSocialStore();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      loadComments(postId).then((data) => {
        setComments(data);
        setLoading(false);
      });
    }
  }, [visible, postId]);

  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(0);
      Animated.timing(slideAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [visible]);

  const dismiss = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 350, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => onClose());
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const comment = await addComment(postId, trimmed);
    if (comment) {
      setComments((prev) => [...prev, comment]);
      setText('');
    }
    setSending(false);
  };

  return (
    <Modal visible={visible} animationType="none" transparent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={dismiss}>
          <Animated.View style={{ flex: 1, backgroundColor: '#000', opacity: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }} />
        </Pressable>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <Animated.View style={{ transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] }}>
          <View style={{
            backgroundColor: theme.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '70%',
            minHeight: 300,
            borderTopWidth: 1,
            borderTopColor: theme.border,
          }}>
            {/* Header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 20, paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: theme.border,
            }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>Comments</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={22} color={theme.chrome} />
              </Pressable>
            </View>

            {/* Comment list */}
            {loading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                <ActivityIndicator color={theme.chrome} />
              </View>
            ) : comments.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 14, color: theme.textSecondary }}>No comments yet</Text>
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(c) => c.id}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                    <AvatarInitial
                      name={item.profiles?.display_name ?? '?'}
                      avatarUrl={item.profiles?.avatar_url}
                      size={32}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
                          {item.profiles?.display_name ?? 'User'}
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                          {timeAgo(item.created_at)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, color: theme.text, marginTop: 2, lineHeight: 20 }}>
                        {item.body}
                      </Text>
                    </View>
                  </View>
                )}
              />
            )}

            {/* Input */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: theme.border,
            }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: theme.surface,
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  fontSize: 14,
                  color: theme.text,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
                placeholder="Add a comment..."
                placeholderTextColor={theme.textSecondary}
                value={text}
                onChangeText={setText}
                returnKeyType="send"
                onSubmitEditing={handleSend}
                multiline={false}
              />
              <Pressable
                onPress={handleSend}
                disabled={!text.trim() || sending}
                style={{ opacity: text.trim() ? 1 : 0.4 }}
              >
                <Ionicons name="send" size={22} color={theme.text} />
              </Pressable>
            </View>
          </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
