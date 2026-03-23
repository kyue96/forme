import { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, Share, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';

import { useSettings } from '@/lib/settings-context';
import { useUserStore } from '@/lib/user-store';
import { useSocialStore } from '@/lib/social-store';
import { AvatarInitial } from '@/components/AvatarInitial';
import { ReactionBar } from '@/components/social/ReactionBar';
import { CommentSheet } from '@/components/social/CommentSheet';
import { CARD_THEMES, formatVolume, formatDuration } from '@/lib/card-themes';
import type { PostWithAuthor, CardData, Comment } from '@/lib/social-types';

function FeedImage({ uri }: { uri: string }) {
  const [ratio, setRatio] = useState(4 / 3); // fallback
  useEffect(() => {
    Image.getSize(
      uri,
      (w, h) => { if (w && h) setRatio(w / h); },
      () => {},
    );
  }, [uri]);
  return (
    <Image
      source={{ uri }}
      style={{ width: '100%', aspectRatio: ratio, marginTop: 8, borderRadius: 12 }}
      resizeMode="contain"
      onError={(e) => console.warn('Image load error:', e.nativeEvent.error, uri)}
    />
  );
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

interface FeedPostProps {
  post: PostWithAuthor;
}

export function FeedPost({ post }: FeedPostProps) {
  const router = useRouter();
  const { theme } = useSettings();
  const userId = useUserStore((s) => s.userId);
  const { toggleReaction, deletePost, updatePost, loadComments, addComment } = useSocialStore();

  const [commentsVisible, setCommentsVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [editClearImage, setEditClearImage] = useState(false);
  const [editClearCard, setEditClearCard] = useState(false);
  const [inlineComments, setInlineComments] = useState<Comment[]>([]);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [loadedComments, setLoadedComments] = useState(false);
  const menuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postRef = useRef<View>(null);
  const [showWatermark, setShowWatermark] = useState(false);

  const handleShare = async () => {
    if (!postRef.current) return;
    try {
      // Show watermark, capture, then hide it
      setShowWatermark(true);
      // Wait a frame for the watermark to render
      await new Promise((r) => setTimeout(r, 100));
      const uri = await captureRef(postRef.current, { format: 'png', quality: 1 });
      setShowWatermark(false);
      const caption = post.caption ? post.caption.slice(0, 100) : '';
      const cardFocus = post.card_data?.focus ?? '';
      const message = caption
        ? `${caption}\n\nShared via Forme`
        : cardFocus
          ? `Check out this ${cardFocus} workout!\n\nShared via Forme`
          : 'Check out this post on Forme!';
      await Share.share({
        url: uri,
        message,
      });
    } catch {
      setShowWatermark(false);
      // User cancelled or error — no alert needed
    }
  };

  // Auto-dismiss "..." menu after 2 seconds
  useEffect(() => {
    if (menuVisible) {
      if (menuTimerRef.current) clearTimeout(menuTimerRef.current);
      menuTimerRef.current = setTimeout(() => {
        setMenuVisible(false);
        setDeleteConfirm(false);
      }, 2000);
    } else {
      setDeleteConfirm(false);
    }
    return () => {
      if (menuTimerRef.current) clearTimeout(menuTimerRef.current);
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, [menuVisible]);

  // Load first 3 comments when post appears
  useEffect(() => {
    if (post.comment_count > 0 && !loadedComments) {
      setLoadedComments(true);
      loadComments(post.id).then((data) => {
        setInlineComments(data);
      });
    }
  }, [post.comment_count]);

  const handleInlineComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed || sendingComment) return;
    setSendingComment(true);
    const comment = await addComment(post.id, trimmed);
    if (comment) {
      setInlineComments((prev) => [...prev, comment]);
      setCommentText('');
    }
    setSendingComment(false);
  };

  const previewComments = commentsExpanded ? inlineComments : inlineComments.slice(0, 2);

  const author = post.profiles;
  const isOwn = post.user_id === userId;

  // Derive a fallback display name from user_id when display_name is null
  const authorDisplayName = author?.display_name || `Athlete`;
  const authorAvatarName = author?.display_name
    ? author.display_name.charAt(0).toUpperCase()
    : 'A';

  const handleDeleteTap = () => {
    if (deleteConfirm) {
      // Second tap: actually delete
      deletePost(post.id);
      setMenuVisible(false);
      setDeleteConfirm(false);
    } else {
      // First tap: turn red to confirm
      setDeleteConfirm(true);
      // Reset after 2 seconds
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = setTimeout(() => setDeleteConfirm(false), 2000);
      // Reset menu auto-dismiss timer
      if (menuTimerRef.current) clearTimeout(menuTimerRef.current);
      menuTimerRef.current = setTimeout(() => {
        setMenuVisible(false);
        setDeleteConfirm(false);
      }, 2000);
    }
  };

  const handleEdit = () => {
    setEditCaption(post.caption ?? '');
    setEditClearImage(false);
    setEditClearCard(false);
    setEditModalVisible(true);
    setMenuVisible(false);
  };

  const handleSaveEdit = async () => {
    const opts = {
      ...(editClearImage ? { clearImage: true } : {}),
      ...(editClearCard ? { clearCard: true } : {}),
    };
    const ok = await updatePost(post.id, editCaption.trim(), Object.keys(opts).length > 0 ? opts : undefined);
    if (ok) {
      setEditModalVisible(false);
    } else {
      Alert.alert('Error', 'Could not update post.');
    }
  };

  return (
    <View
      ref={postRef}
      collapsable={false}
      style={{
        backgroundColor: theme.surface,
        borderRadius: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: 'hidden',
      }}
    >
      {/* Author header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 12 }}>
        <Pressable
          onPress={() => router.push(`/user/${post.user_id}` as any)}
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
        >
          <AvatarInitial
            name={authorAvatarName}
            avatarUrl={author?.avatar_url}
            size={36}
            isTraining={author?.is_currently_training}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>
              {authorDisplayName}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                {timeAgo(post.created_at)}
              </Text>
              {author?.gym_name && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="location-outline" size={10} color={theme.textSecondary} />
                  <Text style={{ fontSize: 10, color: theme.textSecondary }}>{author.gym_name}</Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={handleShare} hitSlop={8}>
            <Ionicons name="share-outline" size={20} color={theme.chrome} />
          </Pressable>
          {isOwn && (
            <Pressable onPress={() => setMenuVisible(!menuVisible)} hitSlop={8}>
              <Ionicons name="ellipsis-horizontal" size={20} color={theme.chrome} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Menu dropdown */}
      {menuVisible && isOwn && (
        <View style={{
          position: 'absolute', top: 52, right: 16, zIndex: 10,
          backgroundColor: theme.background, borderRadius: 12,
          borderWidth: 1, borderColor: theme.border,
          shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 8,
          overflow: 'hidden',
        }}>
          <Pressable
            onPress={handleEdit}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 }}
          >
            <Ionicons name="create-outline" size={16} color={theme.text} />
            <Text style={{ fontSize: 14, color: theme.text, fontWeight: '600' }}>Edit</Text>
          </Pressable>
          <View style={{ height: 1, backgroundColor: theme.border }} />
          <Pressable
            onPress={handleDeleteTap}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 }}
          >
            <Ionicons name="trash-outline" size={16} color={deleteConfirm ? '#EF4444' : theme.text} />
            <Text style={{ fontSize: 14, color: deleteConfirm ? '#EF4444' : theme.text, fontWeight: '600' }}>
              {deleteConfirm ? 'Tap to confirm' : 'Delete'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Caption */}
      {post.caption && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <Text style={{ fontSize: 14, color: theme.text, lineHeight: 20 }}>{post.caption}</Text>
        </View>
      )}

      {/* Workout recap card */}
      {post.type === 'workout_recap' && post.card_data && (
        <Pressable
          onPress={() => {
            Alert.alert(
              'Save this workout?',
              `Save "${post.card_data!.focus}" to your saved workouts?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Save',
                  onPress: async () => {
                    const ok = await useSocialStore.getState().saveWorkoutFromPost(post.card_data!);
                    if (ok) Alert.alert('Saved!', 'Workout added to your saved workouts.');
                  },
                },
              ]
            );
          }}
        >
          <WorkoutRecapCard data={post.card_data} />
        </Pressable>
      )}

      {/* Optional image — full size, no crop */}
      {post.image_url ? (
        <FeedImage uri={post.image_url} />
      ) : null}

      {/* Reactions + comments */}
      <View style={{ padding: 16, gap: 12 }}>
        <ReactionBar
          likeCount={post.like_count}
          userReactions={post.user_reactions ?? []}
          onToggle={(emoji) => toggleReaction(post.id, emoji)}
        />

        {/* Inline comments */}
        {previewComments.length > 0 && (
          <View style={{ gap: 8 }}>
            {previewComments.map((c) => (
              <View key={c.id} style={{ flexDirection: 'row', gap: 8 }}>
                <AvatarInitial
                  name={c.profiles?.display_name ? c.profiles.display_name.charAt(0).toUpperCase() : 'A'}
                  avatarUrl={c.profiles?.avatar_url}
                  size={24}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: theme.text }}>
                    <Text style={{ fontWeight: '700' }}>{c.profiles?.display_name || 'Athlete'}</Text>
                    {'  '}{c.body}
                  </Text>
                  <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>{timeAgo(c.created_at)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* View all comments link */}
        {inlineComments.length > 2 && !commentsExpanded && (
          <Pressable onPress={() => setCommentsExpanded(true)}>
            <Text style={{ fontSize: 13, color: theme.textSecondary }}>
              View all {inlineComments.length} comments
            </Text>
          </Pressable>
        )}

        {/* Inline comment input */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            style={{
              flex: 1,
              backgroundColor: theme.background,
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 8,
              fontSize: 13,
              color: theme.text,
              borderWidth: 1,
              borderColor: theme.border,
            }}
            placeholder="Add a comment..."
            placeholderTextColor={theme.textSecondary}
            value={commentText}
            onChangeText={setCommentText}
            returnKeyType="send"
            onSubmitEditing={handleInlineComment}
          />
          {commentText.trim().length > 0 && (
            <Pressable onPress={handleInlineComment} disabled={sendingComment}>
              <Ionicons name="send" size={18} color={theme.text} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Powered by Forme watermark — shown only during capture */}
      {showWatermark && (
        <View style={{
          position: 'absolute', bottom: 8, right: 12,
          backgroundColor: 'rgba(0,0,0,0.5)',
          paddingHorizontal: 8, paddingVertical: 3,
          borderRadius: 6,
        }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5 }}>
            Powered by Forme
          </Text>
        </View>
      )}

      {/* Full comment sheet (fallback) */}
      <CommentSheet
        postId={post.id}
        visible={commentsVisible}
        onClose={() => setCommentsVisible(false)}
      />

      {/* Edit modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setEditModalVisible(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
          </Pressable>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <View style={{
              backgroundColor: theme.background,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              borderTopWidth: 1,
              borderTopColor: theme.border,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>Edit Post</Text>
                <Pressable onPress={() => setEditModalVisible(false)} hitSlop={12}>
                  <Ionicons name="close" size={22} color={theme.chrome} />
                </Pressable>
              </View>
              <TextInput
                style={{
                  fontSize: 16,
                  color: theme.text,
                  minHeight: 100,
                  textAlignVertical: 'top',
                  backgroundColor: theme.surface,
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
                value={editCaption}
                onChangeText={setEditCaption}
                multiline
                maxLength={500}
                placeholder="Write a caption..."
                placeholderTextColor={theme.textSecondary}
                autoFocus
              />
              {/* Remove attachment buttons */}
              {(post.image_url && !editClearImage) || (post.card_data && !editClearCard) ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  {post.image_url && !editClearImage && (
                    <Pressable
                      onPress={() => setEditClearImage(true)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        paddingHorizontal: 12, paddingVertical: 8,
                        borderRadius: 10, backgroundColor: theme.surface,
                        borderWidth: 1, borderColor: theme.border,
                      }}
                    >
                      <Ionicons name="image-outline" size={16} color={theme.textSecondary} />
                      <Text style={{ fontSize: 13, color: theme.textSecondary }}>Remove Photo</Text>
                      <Ionicons name="close-circle" size={16} color={theme.chrome} />
                    </Pressable>
                  )}
                  {post.card_data && !editClearCard && (
                    <Pressable
                      onPress={() => setEditClearCard(true)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        paddingHorizontal: 12, paddingVertical: 8,
                        borderRadius: 10, backgroundColor: theme.surface,
                        borderWidth: 1, borderColor: theme.border,
                      }}
                    >
                      <Ionicons name="card-outline" size={16} color={theme.textSecondary} />
                      <Text style={{ fontSize: 13, color: theme.textSecondary }}>Remove Card</Text>
                      <Ionicons name="close-circle" size={16} color={theme.chrome} />
                    </Pressable>
                  )}
                </View>
              ) : null}
              <Pressable
                onPress={handleSaveEdit}
                style={{
                  marginTop: 16,
                  backgroundColor: theme.text,
                  paddingVertical: 14,
                  borderRadius: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.background }}>Save</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

// Mini workout recap card rendered inside feed post
function WorkoutRecapCard({ data }: { data: CardData }) {
  const ct = CARD_THEMES[data.themeIdx % CARD_THEMES.length];

  const metrics = [
    { val: String(data.sets), label: 'SETS' },
    { val: String(data.reps), label: 'REPS' },
    { val: formatVolume(data.volume), label: data.unitLabel.toUpperCase() },
    { val: formatDuration(data.durationMinutes), label: 'TIME' },
  ];

  return (
    <View style={{
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: ct.bg,
      borderRadius: 16,
      padding: 20,
      borderWidth: ct.name === 'Minimal' ? 1 : 0,
      borderColor: ct.divider,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: ct.text, letterSpacing: 3, textTransform: 'uppercase' }}>
          FORME
        </Text>
      </View>

      <Text style={{ fontSize: 18, fontWeight: '800', color: ct.text, marginBottom: 2 }}>
        {(data.focus ?? '').length > 24 ? data.focus.slice(0, 24) + '...' : data.focus}
      </Text>
      <Text style={{ fontSize: 12, color: ct.sub, marginBottom: 12 }}>
        {data.dayName}
      </Text>

      <View style={{ height: 1.5, backgroundColor: ct.divider, marginBottom: 12, opacity: 0.4 }} />

      {/* Always use row layout in feed for consistency */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {metrics.map(({ val, label }) => (
          <View key={label} style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: ct.text, fontVariant: ['tabular-nums'] }}>{val}</Text>
            <Text style={{ fontSize: 8, color: ct.sub, letterSpacing: 1, marginTop: 2 }}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Muscles */}
      {data.muscles && data.muscles.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 12 }}>
          {data.muscles.map((m) => (
            <View key={m} style={{ borderWidth: 1, borderColor: ct.divider, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, opacity: 0.7 }}>
              <Text style={{ fontSize: 9, color: ct.text, fontWeight: '600' }}>{m}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
