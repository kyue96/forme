import { create } from 'zustand';
import { supabase } from './supabase';

export interface CustomExercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string | null;
  createdAt: string;
}

interface CustomExerciseStore {
  exercises: CustomExercise[];
  loaded: boolean;
  load: () => Promise<void>;
  create: (name: string, muscleGroup: string, equipment?: string) => Promise<CustomExercise | null>;
  update: (id: string, fields: { name?: string; muscleGroup?: string; equipment?: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useCustomExerciseStore = create<CustomExerciseStore>()((set, get) => ({
  exercises: [],
  loaded: false,

  load: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('custom_exercises')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) {
        set({
          exercises: data.map((d) => ({
            id: d.id,
            name: d.name,
            muscleGroup: d.muscle_group,
            equipment: d.equipment,
            createdAt: d.created_at,
          })),
          loaded: true,
        });
      }
    } catch {
      // silent
    }
  },

  create: async (name, muscleGroup, equipment) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('custom_exercises')
        .insert({
          user_id: user.id,
          name: name.trim(),
          muscle_group: muscleGroup,
          equipment: equipment?.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      const newEx: CustomExercise = {
        id: data.id,
        name: data.name,
        muscleGroup: data.muscle_group,
        equipment: data.equipment,
        createdAt: data.created_at,
      };
      set((state) => ({ exercises: [newEx, ...state.exercises] }));
      return newEx;
    } catch {
      return null;
    }
  },

  update: async (id, fields) => {
    try {
      const dbFields: Record<string, string | null> = {};
      if (fields.name !== undefined) dbFields.name = fields.name.trim();
      if (fields.muscleGroup !== undefined) dbFields.muscle_group = fields.muscleGroup;
      if (fields.equipment !== undefined) dbFields.equipment = fields.equipment?.trim() || null;
      await supabase.from('custom_exercises').update(dbFields).eq('id', id);
      set((state) => ({
        exercises: state.exercises.map((e) =>
          e.id === id ? { ...e, ...fields.name !== undefined ? { name: fields.name.trim() } : {}, ...fields.muscleGroup !== undefined ? { muscleGroup: fields.muscleGroup } : {}, ...fields.equipment !== undefined ? { equipment: fields.equipment?.trim() || null } : {} } : e
        ),
      }));
    } catch {
      // silent
    }
  },

  remove: async (id) => {
    try {
      await supabase.from('custom_exercises').delete().eq('id', id);
      set((state) => ({ exercises: state.exercises.filter((e) => e.id !== id) }));
    } catch {
      // silent
    }
  },
}));
