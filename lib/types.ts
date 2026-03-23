// Quiz answers
export type Gender = 'Male' | 'Female';
export type Goal = 'Build muscle' | 'Build strength' | 'Lose weight' | 'Maintain weight' | 'Stay active';
export type Experience = 'Beginner' | 'Some experience' | 'Intermediate' | 'Advanced';
export type Equipment = 'Full gym' | 'Dumbbells' | 'Resistance bands' | 'None';
export type DaysPerWeek = '2' | '3' | '4' | '5+';
export type WorkoutDuration = '30 min' | '45 min' | '60 min' | '90 min';
export type PreferredSplit = 'Push/Pull/Legs' | 'Full body' | 'Upper/Lower';
export type RoutineChoice = 'Generate my plan' | "I'll build my own";
export type Injury = 'None' | 'Lower back' | 'Knees' | 'Shoulders';
export type MealsPerDay = '2' | '3' | '4' | '5+';
export type RestTimerOption = '60s' | '75s' | '90s' | '120s';
export type StartDateOption = 'Today' | 'Tomorrow' | 'Next Monday';

export interface QuizAnswers {
  name?: string;
  gender?: Gender;
  age?: number;
  goal?: Goal[];
  milestones?: string[];
  experience?: Experience;
  equipment?: Equipment[];
  daysPerWeek?: DaysPerWeek;
  workoutDuration?: WorkoutDuration;
  preferredSplit?: PreferredSplit;
  routineChoice?: RoutineChoice;
  height?: string;
  weight?: string;
  injuries?: Injury[];
  mealsPerDay?: MealsPerDay;
  restTimer?: RestTimerOption;
  includeWarmups?: boolean;
  notifications?: boolean;
  startDate?: StartDateOption;
}

// Pre-workout micro-quiz
export interface PreWorkoutAnswers {
  location: 'Home' | 'Gym';
  availableMinutes: 30 | 45 | 60 | 90;
  muscleGroup: string;
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
  isDropSet?: boolean;
}

export interface LoggedExercise {
  name: string;
  sets: LoggedSet[];
  supersetGroupId?: string;
  attachment?: string | null;
  notes?: string;
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
