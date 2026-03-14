import React, { createContext, useContext, useState } from 'react';
import { QuizAnswers } from './types';

interface QuizContextType {
  answers: QuizAnswers;
  setAnswer: <K extends keyof QuizAnswers>(key: K, value: QuizAnswers[K]) => void;
  toggleEquipment: (item: string) => void;
  resetQuiz: () => void;
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

  const resetQuiz = () => setAnswers({});

  return (
    <QuizContext.Provider value={{ answers, setAnswer, toggleEquipment, resetQuiz }}>
      {children}
    </QuizContext.Provider>
  );
}

export function useQuiz() {
  const ctx = useContext(QuizContext);
  if (!ctx) throw new Error('useQuiz must be used within QuizProvider');
  return ctx;
}
