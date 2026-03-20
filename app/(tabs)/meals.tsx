import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { AppHeader } from '@/components/AppHeader';
import { WeeklyCalendar, getWeekDates, dateKey } from '@/components/WeeklyCalendar';
import { formatNumber } from '@/lib/utils';

interface MealRow {
  id: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  name?: string | null;
}

export default function MealsScreen() {
  const { theme } = useSettings();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [mealName, setMealName] = useState('');
  const [cal, setCal] = useState('');
  const [prot, setProt] = useState('');
  const [carb, setCarb] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCal, setEditCal] = useState('');
  const [editProt, setEditProt] = useState('');
  const [editCarb, setEditCarb] = useState('');

  // Weekly calendar - days with meals logged
  const [mealDays, setMealDays] = useState<Set<string>>(new Set());

  const dk = dateKey(selectedDate);


  const loadMeals = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('meals')
        .select('id, calories, protein, carbs, name')
        .eq('user_id', user.id)
        .eq('date', dk)
        .order('created_at', { ascending: true });
      setMeals((data as MealRow[]) ?? []);
    } catch {} finally {
      setLoading(false);
    }
  }, [dk]);

  const loadMealDays = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const weekDates = getWeekDates();
      const startDate = dateKey(weekDates[0]);
      const endDate = dateKey(weekDates[6]);
      const { data } = await supabase
        .from('meals')
        .select('date')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);
      if (data) {
        setMealDays(new Set(data.map((m: { date: string }) => m.date)));
      }
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { loadMeals(); loadMealDays(); }, [loadMeals, loadMealDays]));


  const addMeal = async () => {
    const c = parseInt(cal) || null;
    const p = parseInt(prot) || null;
    const cb = parseInt(carb) || null;
    if (!c && !p && !cb) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('meals').insert({
        user_id: user.id,
        date: dk,
        calories: c,
        protein: p,
        carbs: cb,
        name: mealName.trim() || null,
      });
      setMealName(''); setCal(''); setProt(''); setCarb('');
      loadMeals();
      loadMealDays();
    } catch {} finally {
      setSaving(false);
    }
  };

  const startEdit = (meal: MealRow) => {
    setEditingId(meal.id);
    setEditName(meal.name ?? '');
    setEditCal(meal.calories != null ? String(meal.calories) : '');
    setEditProt(meal.protein != null ? String(meal.protein) : '');
    setEditCarb(meal.carbs != null ? String(meal.carbs) : '');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await supabase.from('meals').update({
        name: editName.trim() || null,
        calories: parseInt(editCal) || null,
        protein: parseInt(editProt) || null,
        carbs: parseInt(editCarb) || null,
      }).eq('id', editingId);
      setEditingId(null);
      loadMeals();
    } catch {}
  };

  const deleteMeal = (id: string) => {
    Alert.alert('Delete meal', 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('meals').delete().eq('id', id);
          loadMeals();
        },
      },
    ]);
  };

  const totalCal = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const totalProt = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const totalCarb = meals.reduce((s, m) => s + (m.carbs ?? 0), 0);

  const macroInputStyle = {
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15 as const,
    color: theme.text,
  };


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <AppHeader />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={49}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* Weekly calendar strip */}
          <WeeklyCalendar
            completedDays={mealDays}
            selectedDay={dk}
            onDayPress={(date) => { setMeals([]); setSelectedDate(date); }}
          />

          {/* Daily totals */}
          <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { label: 'Calories', value: formatNumber(totalCal), unit: '' },
                { label: 'Protein', value: String(totalProt), unit: 'g' },
                { label: 'Carbs', value: String(totalCarb), unit: 'g' },
              ].map(({ label, value, unit }) => (
                <View
                  key={label}
                  style={{
                    flex: 1,
                    backgroundColor: theme.surface,
                    borderRadius: 16,
                    padding: 12,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <Text allowFontScaling style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>
                    {value}{unit}
                  </Text>
                  <Text allowFontScaling style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Meal list */}
          <View style={{ paddingHorizontal: 24 }}>
            {meals.length === 0 && !loading ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Ionicons name="restaurant-outline" size={32} color={theme.border} />
                <Text allowFontScaling style={{ color: theme.textSecondary, marginTop: 8 }}>
                  No meals logged for this day.
                </Text>
              </View>
            ) : (
              meals.map((meal, i) => (
                <View
                  key={meal.id}
                  style={{
                    backgroundColor: theme.surface,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  {editingId === meal.id ? (
                    <>
                      <TextInput
                        style={{ ...macroInputStyle, marginBottom: 10 }}
                        placeholder="Meal name (optional)"
                        placeholderTextColor={theme.textSecondary}
                        underlineColorAndroid="transparent"
                        value={editName}
                        onChangeText={setEditName}
                      />
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                        {[
                          { label: 'Cal', val: editCal, set: setEditCal },
                          { label: 'Protein', val: editProt, set: setEditProt },
                          { label: 'Carbs', val: editCarb, set: setEditCarb },
                        ].map(({ label, val, set }) => (
                          <View key={label} style={{ flex: 1 }}>
                            <Text allowFontScaling style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              {label}
                            </Text>
                            <TextInput
                              style={macroInputStyle}
                              keyboardType="decimal-pad"
                              placeholder=""
                              placeholderTextColor={theme.textSecondary}
                              underlineColorAndroid="transparent"
                              value={val}
                              onChangeText={set}
                            />
                          </View>
                        ))}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                          onPress={saveEdit}
                          style={{ flex: 1, backgroundColor: theme.text, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
                        >
                          <Text allowFontScaling style={{ color: theme.background, fontWeight: '700', fontSize: 13 }}>Save</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setEditingId(null)}
                          style={{ flex: 1, backgroundColor: theme.chromeLight, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
                        >
                          <Text allowFontScaling style={{ color: theme.textSecondary, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text allowFontScaling style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>
                          {meal.name || `Meal ${i + 1}`}
                        </Text>
                        <Text allowFontScaling style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                          {formatNumber(meal.calories ?? 0)} cal · {meal.protein ?? 0}g protein · {meal.carbs ?? 0}g carbs
                        </Text>
                      </View>
                      <Pressable onPress={() => startEdit(meal)} style={{ padding: 8, marginLeft: 4 }}>
                        <Ionicons name="pencil-outline" size={16} color={theme.chrome} />
                      </Pressable>
                      <Pressable onPress={() => deleteMeal(meal.id)} style={{ padding: 8, marginLeft: 4 }}>
                        <Ionicons name="trash-outline" size={16} color={theme.chrome} />
                      </Pressable>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>

          {/* Add meal form (always visible) */}
          <View style={{ paddingHorizontal: 24, marginTop: 8 }}>
            <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border }}>
              <TextInput
                style={{ ...macroInputStyle, marginBottom: 10 }}
                placeholder="Meal name (optional)"
                placeholderTextColor={theme.textSecondary}
                underlineColorAndroid="transparent"
                value={mealName}
                onChangeText={setMealName}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                {[
                  { label: 'Calories', val: cal, set: setCal },
                  { label: 'Protein (g)', val: prot, set: setProt },
                  { label: 'Carbs (g)', val: carb, set: setCarb },
                ].map(({ label, val, set }) => (
                  <View key={label} style={{ flex: 1 }}>
                    <Text allowFontScaling style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {label}
                    </Text>
                    <TextInput
                      style={macroInputStyle}
                      keyboardType="decimal-pad"
                      placeholder=""
                      placeholderTextColor={theme.textSecondary}
                      underlineColorAndroid="transparent"
                      value={val}
                      onChangeText={set}
                    />
                  </View>
                ))}
              </View>
              <Pressable
                onPress={addMeal}
                disabled={saving}
                style={{ backgroundColor: theme.text, paddingVertical: 12, borderRadius: 12, alignItems: 'center', opacity: saving ? 0.6 : 1 }}
              >
                <Text allowFontScaling style={{ color: theme.background, fontWeight: '700' }}>
                  {saving ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
