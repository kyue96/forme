import React, { useEffect, useState, useRef } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';

interface TrophyCaseCardProps {
  userId: string;
}

interface PRRecord {
  exercise_name: string;
  e1rm: number;
  previous_e1rm: number | null;
  weight: number;
  reps: number;
  achieved_at: string;
}

export default function TrophyCaseCard({ userId }: TrophyCaseCardProps) {
  const { theme, weightUnit } = useSettings();
  const [recentPRs, setRecentPRs] = useState<PRRecord[]>([]);
  const [nearPR, setNearPR] = useState<{ exercise_name: string; current: number; best: number; pct: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    fetchPRs();
  }, [userId]);

  const fetchPRs = async () => {
    try {
      // Fetch PRs from the last 7 days
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data: prs } = await supabase
        .from('personal_records')
        .select('exercise_name, e1rm, previous_e1rm, weight, reps, achieved_at')
        .eq('user_id', userId)
        .gte('achieved_at', oneWeekAgo.toISOString())
        .order('achieved_at', { ascending: false })
        .limit(3);

      if (prs && prs.length > 0) {
        // Only show PRs that beat a previous record (not first-time entries)
        // Only show PRs that beat a previous record (not first-time baselines)
        const meaningful = prs.filter((p: PRRecord) => p.previous_e1rm != null);
        setRecentPRs(meaningful);
      } else {
        // No recent PRs — find closest-to-breaking
        // Get all-time best per exercise
        const { data: allPRs } = await supabase
          .from('personal_records')
          .select('exercise_name, e1rm')
          .eq('user_id', userId)
          .order('e1rm', { ascending: false });

        if (allPRs && allPRs.length > 0) {
          // Get the latest workout's exercises to compare
          const { data: latestLog } = await supabase
            .from('workout_logs')
            .select('exercises')
            .eq('user_id', userId)
            .order('completed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestLog?.exercises) {
            const exercises = latestLog.exercises as any[];
            // Build best per exercise from all-time PRs
            const bestMap: Record<string, number> = {};
            for (const pr of allPRs) {
              if (!bestMap[pr.exercise_name]) bestMap[pr.exercise_name] = Number(pr.e1rm);
            }

            let closest: { exercise_name: string; current: number; best: number; pct: number } | null = null;
            for (const ex of exercises) {
              let bestE1rm = 0;
              for (const s of ex.sets) {
                if (s.completed && s.weight && s.reps > 0) {
                  const e1rm = s.weight * (1 + s.reps / 30);
                  if (e1rm > bestE1rm) bestE1rm = e1rm;
                }
              }
              const allTimeBest = bestMap[ex.name];
              if (allTimeBest && bestE1rm > 0 && bestE1rm < allTimeBest) {
                const pct = Math.round((bestE1rm / allTimeBest) * 100);
                if (!closest || pct > closest.pct) {
                  closest = { exercise_name: ex.name, current: bestE1rm, best: allTimeBest, pct };
                }
              }
            }
            setNearPR(closest);
          }
        }
      }

      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  // PRs and weights are already in user's unit (stored as-entered), just round
  const convert = (v: number) => Math.round(v);
  const unit = weightUnit === 'lbs' ? 'lbs' : 'kg';

  if (loading) return null;
  if (recentPRs.length === 0 && !nearPR) return null;
  /* Old empty state removed — card now hides when nothing to show
  if (recentPRs.length === 0 && !nearPR) {
    return (
      <View style={{
        backgroundColor: theme.surface, borderRadius: 16,
        borderWidth: 1, borderColor: theme.border, padding: 14,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <View style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: '#F59E0B20', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="trophy" size={20} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>Trophy Case</Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
            Keep pushing — your next PR is coming!
          </Text>
        </View>
      </View>
    );
  } */

  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 16,
      borderWidth: 1, borderColor: theme.border, padding: 14,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text, flex: 1 }}>
          Trophy Case
        </Text>
        {recentPRs.length > 1 && (
          <View style={{
            backgroundColor: '#F59E0B', borderRadius: 10,
            paddingHorizontal: 8, paddingVertical: 2,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
              {recentPRs.length} PRs
            </Text>
          </View>
        )}
      </View>

      {/* PR List */}
      {recentPRs.length > 0 ? (
        <View style={{ gap: 8 }}>
          {recentPRs.map((pr, i) => (
            <View key={i} style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#F59E0B10', borderRadius: 10,
              paddingHorizontal: 12, paddingVertical: 10,
            }}>
              <View style={{
                width: 40, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', marginRight: 10,
              }}>
                <Ionicons name="trophy" size={28} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }} numberOfLines={1}>
                  {pr.exercise_name}
                </Text>
                {pr.previous_e1rm != null ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                      {convert(Number(pr.previous_e1rm))} →
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#F59E0B' }}>
                      {' '}{convert(Number(pr.e1rm))} {unit}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#22C55E', fontWeight: '600', marginLeft: 6 }}>
                      +{convert(Number(pr.e1rm) - Number(pr.previous_e1rm))}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 12, color: '#F59E0B', fontWeight: '600', marginTop: 2 }}>
                    New PR: {convert(Number(pr.e1rm))} {unit} e1RM
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      ) : nearPR ? (
        <View style={{
          flexDirection: 'row',
          backgroundColor: '#F59E0B10', borderRadius: 10,
          paddingHorizontal: 12, paddingVertical: 10,
        }}>
          <View style={{
            width: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', marginRight: 12,
          }}>
            <Ionicons name="trophy" size={32} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }} numberOfLines={1}>
              {nearPR.exercise_name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <View style={{
                flex: 1, height: 6, borderRadius: 3,
                backgroundColor: theme.border, overflow: 'hidden',
              }}>
                <View style={{
                  width: `${nearPR.pct}%`, height: '100%',
                  backgroundColor: '#F59E0B', borderRadius: 3,
                }} />
              </View>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#F59E0B', marginLeft: 8 }}>
                {nearPR.pct}%
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 4 }}>
              {convert(nearPR.best - nearPR.current)} {unit} away from PR
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
