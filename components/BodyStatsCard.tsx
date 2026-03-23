import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polyline } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';

interface BodyStatsCardProps {
  userId: string;
}

interface BodyStat {
  date: string;
  weight_kg: number;
}

const SCALE_ICON_COLOR = '#3B82F6';
const SCALE_ICON_BG = '#3B82F620';

export default function BodyStatsCard({ userId }: BodyStatsCardProps) {
  const { theme, weightUnit } = useSettings();
  const [stats, setStats] = useState<BodyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInput, setShowInput] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [saving, setSaving] = useState(false);
  const fetched = useRef(false);

  const convert = (kg: number) => weightUnit === 'lbs' ? Math.round(kg * 2.205) : Math.round(kg);
  const unit = weightUnit === 'lbs' ? 'lbs' : 'kg';

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('body_stats')
        .select('date, weight_kg')
        .eq('user_id', userId)
        .not('weight_kg', 'is', null)
        .order('date', { ascending: false })
        .limit(28);

      setStats((data as BodyStat[]) ?? []);
    } catch {} finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    fetchStats();
  }, [fetchStats]);

  const todayStr = new Date().toISOString().split('T')[0];
  const loggedToday = stats.length > 0 && stats[0].date === todayStr;

  const currentWeight = stats.length > 0 ? stats[0].weight_kg : null;

  // Find weight from ~7 days ago
  const lastWeekWeight = (() => {
    if (stats.length < 2) return null;
    const target = new Date();
    target.setDate(target.getDate() - 7);
    const targetStr = target.toISOString().split('T')[0];
    let closest: BodyStat | null = null;
    let closestDiff = Infinity;
    for (const s of stats) {
      if (s.date === todayStr) continue;
      const diff = Math.abs(new Date(s.date).getTime() - target.getTime());
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = s;
      }
    }
    return closest?.weight_kg ?? null;
  })();

  const trend = currentWeight && lastWeekWeight
    ? currentWeight < lastWeekWeight ? 'down' : currentWeight > lastWeekWeight ? 'up' : 'same'
    : null;

  const delta = currentWeight && lastWeekWeight
    ? convert(Math.abs(currentWeight - lastWeekWeight))
    : 0;

  // Sparkline: weekly averages for last 4 weeks
  const sparklinePoints = (() => {
    if (stats.length < 2) return null;
    const weeks: number[][] = [[], [], [], []];
    const now = new Date();
    for (const s of stats) {
      const daysAgo = Math.floor((now.getTime() - new Date(s.date).getTime()) / (1000 * 60 * 60 * 24));
      const weekIdx = Math.min(3, Math.floor(daysAgo / 7));
      weeks[weekIdx].push(s.weight_kg);
    }
    const avgs = weeks.map((w) => w.length > 0 ? w.reduce((a, b) => a + b, 0) / w.length : null);
    // Need at least 2 data points
    const valid = avgs.filter((a) => a !== null) as number[];
    if (valid.length < 2) return null;

    const W = 60;
    const H = 28;
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const range = max - min || 1;

    // Build points string (reversed so left = oldest)
    const reversed = [...avgs].reverse();
    const pts: string[] = [];
    let x = 0;
    const step = W / (reversed.length - 1);
    for (const v of reversed) {
      if (v !== null) {
        const y = H - ((v - min) / range) * (H - 4) - 2;
        pts.push(`${Math.round(x)},${Math.round(y)}`);
      }
      x += step;
    }
    return pts.join(' ');
  })();

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
      fetched.current = false;
      fetchStats();
    } catch {} finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  const trendColor = trend === 'down' ? '#22C55E' : trend === 'up' ? '#EF4444' : theme.textSecondary;
  const trendIcon = trend === 'down' ? 'trending-down' : trend === 'up' ? 'trending-up' : 'remove';

  // Input mode: show full-width input row
  if (showInput) {
    return (
      <View style={{
        backgroundColor: theme.surface, borderRadius: 16,
        borderWidth: 1, borderColor: theme.border, padding: 14,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: SCALE_ICON_BG, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="scale-outline" size={22} color={SCALE_ICON_COLOR} />
          </View>
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
            style={{
              backgroundColor: '#22C55E', borderRadius: 10,
              paddingHorizontal: 16, paddingVertical: 10,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
              {saving ? '...' : 'Save'}
            </Text>
          </Pressable>
          <Pressable onPress={() => { setShowInput(false); setWeightInput(''); }}>
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 16,
      borderWidth: 1, borderColor: theme.border, padding: 14,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Scale icon - bigger, blue teal */}
        <View style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: SCALE_ICON_BG, alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="scale-outline" size={22} color={SCALE_ICON_COLOR} />
        </View>

        {/* Weight display */}
        <View style={{ marginLeft: 12, flex: 1 }}>
          {currentWeight ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, fontVariant: ['tabular-nums'] }}>
                {convert(currentWeight)}
              </Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginLeft: 3 }}>{unit}</Text>
              {trend && trend !== 'same' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                  <Ionicons name={trendIcon as any} size={14} color={trendColor} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: trendColor, marginLeft: 2 }}>
                    {delta} {unit}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={{ fontSize: 14, color: theme.textSecondary }}>
              No entries yet
            </Text>
          )}
        </View>

        {/* Sparkline */}
        {sparklinePoints && (
          <Svg width={60} height={28} style={{ marginRight: 8 }}>
            <Polyline
              points={sparklinePoints}
              fill="none"
              stroke={trendColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        )}

        {/* Right side: Log Today button or checkmark */}
        {!loggedToday ? (
          <Pressable
            onPress={() => setShowInput(true)}
            style={{
              backgroundColor: '#F59E0B',
              borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>Log Today</Text>
          </Pressable>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
          </View>
        )}
      </View>
    </View>
  );
}
