// Quiz answers
export type Goal = 'Build muscle' | 'Lose fat' | 'Build strength' | 'Stay active';
export type Experience = 'Brand new' | 'Some experience' | 'Intermediate' | 'Advanced';
export type Equipment = 'Full gym' | 'Dumbbells only' | 'Bodyweight only' | 'Resistance bands';
export type DaysPerWeek = '2' | '3' | '4' | '5+';
export type Injury = 'None' | 'Lower back' | 'Knees' | 'Shoulders';
export type PreferredSplit = 'Push/Pull/Legs' | 'Arnold split' | 'Full body' | 'Upper/Lower';

export interface QuizAnswers {
  goal?: Goal;
  experience?: Experience;
  equipment?: Equipment;
  daysPerWeek?: DaysPerWeek;
  preferredSplit?: PreferredSplit;
  injuries?: Injury;
  height?: string;
  weight?: string;
}

// Pre-workout micro-quiz
export interface PreWorkoutAnswers {
  location: 'Home' | 'Gym';
  availableMinutes: 30 | 45 | 60 | 90;
  muscleGroup: string; // AI-decided based on split + recovery
}

// Workout plan (from Claude)
export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
}

export interface WorkoutDay {
  dayName: string;
  focus: string;
  exercises: Exercise[];
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  weeklyPlan: WorkoutDay[];
  createdAt: string;
}

// Workout logging
export interface LoggedSet {
  weight: number | null;
  reps: number;
  completed: boolean;
  suggestedWeight?: number | null;
}

export interface LoggedExercise {
  name: string;
  sets: LoggedSet[];
}

// Meal logging
export interface MealLog {
  id?: string;
  userId?: string;
  date: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
}
