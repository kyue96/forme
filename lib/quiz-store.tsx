import React, { createContext, useContext, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Injury, QuizAnswers } from './types';

const QUIZ_ANSWERS_KEY = 'forme_quiz_answers';

interface QuizContextType {
  answers: QuizAnswers;
  setAnswer: <K extends keyof QuizAnswers>(key: K, value: QuizAnswers[K]) => void;
  toggleEquipment: (item: string) => void;
  toggleGoal: (item: string) => void;
  toggleMilestone: (item: string) => void;
  toggleInjury: (item: string) => void;
  resetQuiz: () => void;
  prefillAnswers: (saved: QuizAnswers) => void;
  saveAnswers: () => Promise<void>;
  loadSavedAnswers: () => Promise<QuizAnswers | null>;
}

const QuizContext = createContext<QuizContextType | null>(null);

export function QuizProvider({ children }: { children: React.ReactNode }) {
  const [answers, setAnswers] = useState<QuizAnswers>({});

  const setAnswer = <K extends keyof QuizAnswers>(key: K, value: QuizAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const toggleEquipment = (item: string) => {
    setAnswers((prev) => {
      const current = prev.equipment ?? [];
      const exists = current.includes(item as never);
      const updated = exists
        ? current.filter((e) => e !== item)
        : [...current, item as never];
      return { ...prev, equipment: updated };
    });
  };

  const toggleGoal = (item: string) => {
    setAnswers((prev) => {
      const current = prev.goal ?? [];
      const exists = current.includes(item as never);
      const updated = exists
        ? current.filter((g) => g !== item)
        : [...current, item as never];
      return { ...prev, goal: updated };
    });
  };

  const toggleMilestone = (item: string) => {
    setAnswers((prev) => {
      const current = prev.milestones ?? [];
      const exists = current.includes(item);
      const updated = exists
        ? current.filter((m) => m !== item)
        : current.length < 3 ? [...current, item] : current;
      return { ...prev, milestones: updated };
    });
  };

  const toggleInjury = (item: string) => {
    setAnswers((prev) => {
      const current: Injury[] = prev.injuries ?? [];
      if (item === 'None') return { ...prev, injuries: ['None'] as Injury[] };
      const filtered: Injury[] = current.filter((i) => i !== 'None');
      const exists = filtered.some((i) => i === item);
      const updated: Injury[] = exists
        ? filtered.filter((i) => i !== item)
        : [...filtered, item as Injury];
      return { ...prev, injuries: updated.length > 0 ? updated : [] };
    });
  };

  const resetQuiz = () => setAnswers({});

  const prefillAnswers = (saved: QuizAnswers) => {
    setAnswers((prev) => ({ ...prev, ...saved }));
  };

  const saveAnswers = async () => {
    try {
      await AsyncStorage.setItem(QUIZ_ANSWERS_KEY, JSON.stringify(answers));
    } catch {}
  };

  const loadSavedAnswers = async (): Promise<QuizAnswers | null> => {
    try {
      const raw = await AsyncStorage.getItem(QUIZ_ANSWERS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  return (
    <QuizContext.Provider value={{ answers, setAnswer, toggleEquipment, toggleGoal, toggleMilestone, toggleInjury, resetQuiz, prefillAnswers, saveAnswers, loadSavedAnswers }}>
      {children}
    </QuizContext.Provider>
  );
}

export function useQuiz() {
  const ctx = useContext(QuizContext);
  if (!ctx) throw new Error('useQuiz must be used within QuizProvider');
  return ctx;
}
