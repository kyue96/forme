import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';

interface BodyStatsCardProps {
  userId: string;
}

const SCALE_COLOR = '#3B82F6';
const LOGGED_COLOR = '#22C55E';

export default function BodyStatsCard({ userId }: BodyStatsCardProps) {
  const { theme, weightUnit } = useSettings();
  const [loggedToday, setLoggedToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showInput, setShowInput] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [saving, setSaving] = useState(false);
  const fetched = useRef(false);

  const unit = weightUnit === 'lbs' ? 'lbs' : 'kg';
  const todayStr = new Date().toISOString().split('T')[0];

  const checkToday = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('body_stats')
        .select('date')
        .eq('user_id', userId)
        .eq('date', todayStr)
        .not('weight_kg', 'is', null)
        .limit(1);

      setLoggedToday((data?.length ?? 0) > 0);
    } catch {} finally {
      setLoading(false);
    }
  }, [userId, todayStr]);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    checkToday();
  }, [checkToday]);

  const handleSave = async () => {
    const val = parseFloat(weightInput);
    if (isNaN(val) || val <= 0) return;
    setSaving(true);
    try {
      const kg = weightUnit === 'lbs' ? val / 2.205 : val;
      await supabase
        .from('body_stats')
        .upsert({
          user_id: userId,
          date: todayStr,
          weight_kg: Math.round(kg * 100) / 100,
        }, { onConflict: 'user_id,date' });

      setShowInput(false);
      setWeightInput('');
      setLoggedToday(true);
    } catch {} finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  // Input mode
  if (showInput) {
    return (
      <View style={{
        flex: 1, backgroundColor: theme.surface, borderRadius: 16,
        borderWidth: 1, borderColor: theme.border, padding: 14,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            style={{
              flex: 1, backgroundColor: theme.background,
              borderRadius: 10, borderWidth: 1, borderColor: theme.border,
              paddingHorizontal: 12, paddingVertical: 8,
              fontSize: 15, fontWeight: '600', color: theme.text,
            }}
            placeholder={`Weight (${unit})`}
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            value={weightInput}
            onChangeText={setWeightInput}
            autoFocus
          />
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={{ backgroundColor: '#22C55E', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
              {saving ? '...' : 'Save'}
            </Text>
          </Pressable>
          <Pressable onPress={() => { setShowInput(false); setWeightInput(''); }}>
            <Ionicons name="close" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>
    );
  }

  // Logged state: green icon with checkmark
  if (loggedToday) {
    return (
      <View style={{
        flex: 1, backgroundColor: theme.surface, borderRadius: 16,
        borderWidth: 1, borderColor: theme.border, padding: 14,
        flexDirection: 'row', alignItems: 'center', gap: 10,
      }}>
        <View style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: `${LOGGED_COLOR}20`, alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="scale-outline" size={20} color={LOGGED_COLOR} />
          <View style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 16, height: 16, borderRadius: 8,
            backgroundColor: LOGGED_COLOR, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="checkmark" size={11} color="#FFFFFF" />
          </View>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>Logged</Text>
      </View>
    );
  }

  // Not logged: blue icon, tap to weigh in
  return (
    <Pressable
      onPress={() => setShowInput(true)}
      style={{
        flex: 1, backgroundColor: theme.surface, borderRadius: 16,
        borderWidth: 1, borderColor: theme.border, padding: 14,
        flexDirection: 'row', alignItems: 'center', gap: 10,
      }}
    >
      <View style={{
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: `${SCALE_COLOR}20`, alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name="scale-outline" size={20} color={SCALE_COLOR} />
      </View>
      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>Weigh In</Text>
    </Pressable>
  );
}
