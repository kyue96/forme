import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/lib/settings-context';
import { supabase } from '@/lib/supabase';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CoachSheetProps {
  visible: boolean;
  onClose: () => void;
  context?: Record<string, unknown>;
}

export function CoachSheet({ visible, onClose, context }: CoachSheetProps) {
  const { theme } = useSettings();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/coach-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            messages: updated.map((m) => ({ role: m.role, content: m.content })),
            context,
          }),
        },
      );
      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Sorry, I couldn't connect right now. Try again in a moment." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingVertical: 14,
          borderBottomWidth: 1, borderBottomColor: theme.border,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="sparkles" size={20} color={theme.chrome} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Forme Coach</Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={theme.chrome} />
          </Pressable>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 20 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="sparkles" size={40} color={theme.border} />
              <Text style={{ fontSize: 16, color: theme.textSecondary, marginTop: 12, textAlign: 'center' }}>
                Ask me about form, programming,{'\n'}nutrition, or your workout!
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{
              alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              marginBottom: 12,
              backgroundColor: item.role === 'user' ? theme.text : theme.surface,
              borderRadius: 16,
              borderBottomRightRadius: item.role === 'user' ? 4 : 16,
              borderBottomLeftRadius: item.role === 'assistant' ? 4 : 16,
              padding: 12,
            }}>
              <Text style={{
                fontSize: 15,
                color: item.role === 'user' ? theme.background : theme.text,
                lineHeight: 21,
              }}>
                {item.content}
              </Text>
            </View>
          )}
        />

        {loading && (
          <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
            <ActivityIndicator size="small" color={theme.chrome} />
          </View>
        )}

        {/* Input */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 20,
            borderTopWidth: 1, borderTopColor: theme.border,
          }}>
            <TextInput
              style={{
                flex: 1, fontSize: 16, color: theme.text,
                backgroundColor: theme.surface, borderRadius: 24,
                paddingHorizontal: 16, paddingVertical: 10,
                borderWidth: 1, borderColor: theme.border,
              }}
              placeholder="Ask your coach..."
              placeholderTextColor={theme.textSecondary}
              value={input}
              onChangeText={setInput}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
            />
            <Pressable
              onPress={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: input.trim() ? theme.text : theme.surface,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="send" size={18} color={input.trim() ? theme.background : theme.textSecondary} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
