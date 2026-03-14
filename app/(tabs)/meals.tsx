import { useCallback, useState } from 'react';
import {
  Alert,
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

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

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

  const [showAdd, setShowAdd] = useState(false);
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

  const dk = dateKey(selectedDate);
  const isToday = dk === dateKey(new Date());

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

  useFocusEffect(useCallback(() => { loadMeals(); }, [loadMeals]));

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d);
  };

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
      setShowAdd(false);
      loadMeals();
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Date picker */}
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme.surface,
            borderRadius: 16,
            paddingHorizontal: 4,
            paddingVertical: 4,
            borderWidth: 1,
            borderColor: theme.border,
          }}>
            <Pressable
              onPress={() => changeDate(-1)}
              style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chevron-back" size={20} color={theme.chrome} />
            </Pressable>
            <Pressable onPress={() => setSelectedDate(new Date())}>
              <Text allowFontScaling style={{
                fontSize: 15,
                fontWeight: '700',
                color: isToday ? theme.text : theme.textSecondary,
              }}>
                {isToday ? 'Today' : formatDate(selectedDate)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => changeDate(1)}
              style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chevron-forward" size={20} color={theme.chrome} />
            </Pressable>
          </View>
        </View>

        {/* Daily totals */}
        <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { label: 'Calories', value: String(totalCal), unit: '' },
              { label: 'Protein', value: String(totalProt), unit: 'g' },
              { label: 'Carbs', value: String(totalCarb), unit: 'g' },
            ].map(({ label, value, unit }) => (
              <View
                key={label}
                style={{
                  flex: 1,
                  backgroundColor: theme.surface,
                  borderRadius: 16,
                  padding: 14,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Text allowFontScaling style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>
                  {value}{unit}
                </Text>
                <Text allowFontScaling style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
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
                    {/* Meal name */}
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
                            keyboardType="number-pad"
                            placeholder="—"
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
                  <Pressable onPress={() => startEdit(meal)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text allowFontScaling style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>
                        {meal.name || `Meal ${i + 1}`}
                      </Text>
                      <Text allowFontScaling style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                        {meal.calories ?? 0} cal · {meal.protein ?? 0}g protein · {meal.carbs ?? 0}g carbs
                      </Text>
                    </View>
                    <Pressable onPress={() => deleteMeal(meal.id)} style={{ padding: 8, marginLeft: 4 }}>
                      <Ionicons name="trash-outline" size={16} color={theme.chrome} />
                    </Pressable>
                  </Pressable>
                )}
              </View>
            ))
          )}
        </View>

        {/* Add meal form */}
        {showAdd && (
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
                      keyboardType="number-pad"
                      placeholder="—"
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
                  onPress={addMeal}
                  disabled={saving}
                  style={{ flex: 1, backgroundColor: theme.text, paddingVertical: 12, borderRadius: 12, alignItems: 'center', opacity: saving ? 0.6 : 1 }}
                >
                  <Text allowFontScaling style={{ color: theme.background, fontWeight: '700' }}>
                    {saving ? 'Saving…' : 'Save'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setShowAdd(false); setMealName(''); setCal(''); setProt(''); setCarb(''); }}
                  style={{ flex: 1, backgroundColor: theme.chromeLight, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                >
                  <Text allowFontScaling style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add meal button */}
      {!showAdd && (
        <View style={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border }}>
          <Pressable
            onPress={() => setShowAdd(true)}
            style={{ backgroundColor: theme.text, paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
          >
            <Text allowFontScaling style={{ color: theme.background, fontWeight: '700', fontSize: 15 }}>+ Add meal</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
