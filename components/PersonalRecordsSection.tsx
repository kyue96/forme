import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { getExerciseCategory } from '@/lib/exercise-utils';
import { animateLayout } from '@/lib/utils';

interface PRRecord {
  id: string;
  exercise_name: string;
  e1rm: number;
  weight: number;
  reps: number;
  previous_e1rm: number | null;
  achieved_at: string;
}

interface ExercisePRHistory {
  exerciseName: string;
  category: string | null;
  currentBest: PRRecord;
  history: PRRecord[];
}

interface PersonalRecordsSectionProps {
  userId: string;
  accentColor: string;
}

export function PersonalRecordsSection({ userId, accentColor }: PersonalRecordsSectionProps) {
  const { theme, weightUnit } = useSettings();
  const [exercisePRs, setExercisePRs] = useState<ExercisePRHistory[]>([]);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalPRs, setTotalPRs] = useState(0);
  const [thisWeekPRs, setThisWeekPRs] = useState(0);
  const [thisMonthPRs, setThisMonthPRs] = useState(0);

  const convert = (kg: number) => weightUnit === 'lbs' ? Math.round(kg * 2.205) : Math.round(kg);
  const unit = weightUnit === 'lbs' ? 'lbs' : 'kg';

  const loadPRs = useCallback(async () => {
    try {
      const { data: allPRs } = await supabase
        .from('personal_records')
        .select('id, exercise_name, e1rm, weight, reps, previous_e1rm, achieved_at')
        .eq('user_id', userId)
        .order('achieved_at', { ascending: false });

      if (!allPRs || allPRs.length === 0) {
        setLoading(false);
        return;
      }

      setTotalPRs(allPRs.length);

      // Count this week's and this month's PRs
      const now = new Date();
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);

      let weekCount = 0;
      let monthCount = 0;
      for (const pr of allPRs) {
        const d = new Date(pr.achieved_at);
        if (d >= weekAgo) weekCount++;
        if (d >= monthAgo) monthCount++;
      }
      setThisWeekPRs(weekCount);
      setThisMonthPRs(monthCount);

      // Group by exercise, keep best (first entry since sorted desc) and history
      const grouped: Record<string, PRRecord[]> = {};
      for (const pr of allPRs) {
        if (!grouped[pr.exercise_name]) grouped[pr.exercise_name] = [];
        grouped[pr.exercise_name].push(pr as PRRecord);
      }

      const exerciseList: ExercisePRHistory[] = Object.entries(grouped).map(([name, records]) => ({
        exerciseName: name,
        category: getExerciseCategory(name),
        currentBest: records[0], // Most recent = highest (since each PR beats the last)
        history: records,
      }));

      // Sort by most recent PR first
      exerciseList.sort((a, b) =>
        new Date(b.currentBest.achieved_at).getTime() - new Date(a.currentBest.achieved_at).getTime()
      );

      setExercisePRs(exerciseList);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadPRs(); }, [loadPRs]);

  // Get unique categories
  const categories = [...new Set(exercisePRs.map(e => e.category).filter(Boolean))] as string[];

  const filtered = filterCategory
    ? exercisePRs.filter(e => e.category === filterCategory)
    : exercisePRs;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  };

  if (loading) return null;

  if (exercisePRs.length === 0) {
    return (
      <View style={{
        backgroundColor: theme.surface, borderRadius: 16,
        borderWidth: 1, borderColor: theme.border, padding: 20,
        alignItems: 'center',
      }}>
        <Ionicons name="trophy-outline" size={32} color={theme.textSecondary} />
        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text, marginTop: 8 }}>
          No Personal Records Yet
        </Text>
        <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4, textAlign: 'center' }}>
          Complete workouts to start tracking your PRs
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {/* Summary stats row */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{
          flex: 1, backgroundColor: theme.surface, borderRadius: 14,
          borderWidth: 1, borderColor: theme.border, padding: 12, alignItems: 'center',
        }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: accentColor }}>{totalPRs}</Text>
          <Text style={{ fontSize: 10, fontWeight: '600', color: theme.textSecondary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            All-time PRs
          </Text>
        </View>
        <View style={{
          flex: 1, backgroundColor: theme.surface, borderRadius: 14,
          borderWidth: 1, borderColor: theme.border, padding: 12, alignItems: 'center',
        }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: thisWeekPRs > 0 ? '#22C55E' : theme.text }}>{thisWeekPRs}</Text>
          <Text style={{ fontSize: 10, fontWeight: '600', color: theme.textSecondary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            This Week
          </Text>
        </View>
        <View style={{
          flex: 1, backgroundColor: theme.surface, borderRadius: 14,
          borderWidth: 1, borderColor: theme.border, padding: 12, alignItems: 'center',
        }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>{thisMonthPRs}</Text>
          <Text style={{ fontSize: 10, fontWeight: '600', color: theme.textSecondary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            This Month
          </Text>
        </View>
      </View>

      {/* Category filter chips */}
      {categories.length > 1 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Pressable
            onPress={() => { animateLayout(); setFilterCategory(null); }}
            style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
              backgroundColor: filterCategory === null ? accentColor : theme.surface,
              borderWidth: 1, borderColor: filterCategory === null ? accentColor : theme.border,
            }}
          >
            <Text style={{
              fontSize: 12, fontWeight: '600',
              color: filterCategory === null ? '#FFFFFF' : theme.textSecondary,
            }}>All</Text>
          </Pressable>
          {categories.map(cat => (
            <Pressable
              key={cat}
              onPress={() => { animateLayout(); setFilterCategory(filterCategory === cat ? null : cat); }}
              style={{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                backgroundColor: filterCategory === cat ? accentColor : theme.surface,
                borderWidth: 1, borderColor: filterCategory === cat ? accentColor : theme.border,
              }}
            >
              <Text style={{
                fontSize: 12, fontWeight: '600',
                color: filterCategory === cat ? '#FFFFFF' : theme.textSecondary,
              }}>{cat}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Exercise PR cards */}
      {filtered.map((ex) => {
        const isExpanded = expandedExercise === ex.exerciseName;
        const best = ex.currentBest;
        const isRecent = new Date(best.achieved_at) >= new Date(Date.now() - 7 * 86400000);

        return (
          <Pressable
            key={ex.exerciseName}
            onPress={() => { animateLayout(); setExpandedExercise(isExpanded ? null : ex.exerciseName); }}
            style={{
              backgroundColor: theme.surface, borderRadius: 14,
              borderWidth: 1, borderColor: isRecent ? accentColor + '40' : theme.border,
              overflow: 'hidden',
            }}
          >
            {/* Main row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }} numberOfLines={1}>
                    {ex.exerciseName}
                  </Text>
                  {isRecent && (
                    <View style={{
                      backgroundColor: '#22C55E', borderRadius: 4,
                      paddingHorizontal: 5, paddingVertical: 1,
                    }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: '#FFFFFF' }}>NEW</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                  {ex.category && (
                    <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '500' }}>
                      {ex.category}
                    </Text>
                  )}
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                    {formatDate(best.achieved_at)}
                  </Text>
                </View>
              </View>

              {/* Best e1RM */}
              <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: accentColor }}>
                  {convert(Number(best.e1rm))}
                </Text>
                <Text style={{ fontSize: 10, color: theme.textSecondary, fontWeight: '500' }}>
                  {unit} e1RM
                </Text>
              </View>

              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.textSecondary}
              />
            </View>

            {/* Expanded: PR history timeline */}
            {isExpanded && ex.history.length > 1 && (
              <View style={{
                borderTopWidth: 1, borderTopColor: theme.border,
                paddingHorizontal: 14, paddingVertical: 10,
              }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  PR History
                </Text>
                {ex.history.map((pr, i) => (
                  <View key={pr.id} style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingVertical: 6,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: theme.border + '40',
                  }}>
                    <View style={{
                      width: 6, height: 6, borderRadius: 3,
                      backgroundColor: i === 0 ? accentColor : theme.textSecondary,
                      marginRight: 10,
                    }} />
                    <Text style={{ fontSize: 12, color: theme.textSecondary, width: 50 }}>
                      {formatDate(pr.achieved_at)}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: i === 0 ? theme.text : theme.textSecondary, flex: 1 }}>
                      {convert(Number(pr.e1rm))} {unit}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                      {convert(Number(pr.weight))} × {pr.reps}
                    </Text>
                    {pr.previous_e1rm != null && (
                      <Text style={{ fontSize: 11, color: '#22C55E', fontWeight: '600', marginLeft: 8 }}>
                        +{convert(Number(pr.e1rm) - Number(pr.previous_e1rm))}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
