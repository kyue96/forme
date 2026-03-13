import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { WorkoutPlan } from './types';

interface PlanContextType {
  plan: WorkoutPlan | null;
  loading: boolean;
  setPlan: (plan: WorkoutPlan | null) => void;
  refetch: () => void;
}

const PlanContext = createContext<PlanContextType | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setPlan({
          id: data.id,
          userId: data.user_id,
          weeklyPlan: data.plan.weeklyPlan,
          createdAt: data.created_at,
        });
      }
    } catch {
      // No plan found
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, []);

  return (
    <PlanContext.Provider value={{ plan, loading, setPlan, refetch: fetchPlan }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}
