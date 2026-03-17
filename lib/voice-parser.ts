/**
 * Parse voice transcript into weight and reps.
 * Supports patterns like:
 *   "135 for 8", "60 kilos 12 times", "225 by 5",
 *   "ten reps at 60", "bodyweight 15", "12 reps"
 */

const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  twenty5: 25, thirty: 30, thirty5: 35, forty: 40, forty5: 45,
  fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

function parseNumber(s: string): number | null {
  const n = parseFloat(s);
  if (!isNaN(n)) return n;
  const lower = s.toLowerCase().replace(/[-\s]/g, '');
  if (WORD_NUMBERS[lower] !== undefined) return WORD_NUMBERS[lower];
  return null;
}

export function parseVoiceInput(
  transcript: string,
  _unitHint: 'lbs' | 'kg' = 'lbs',
): { weight: number | null; reps: number | null } {
  const t = transcript.toLowerCase().trim();

  // Pattern: "{weight} for/by/x {reps}"
  let match = t.match(/(\d+(?:\.\d+)?)\s*(?:for|by|x|times)\s*(\d+)/);
  if (match) return { weight: parseNumber(match[1]), reps: parseNumber(match[2]) };

  // Pattern: "{weight} pounds/lbs/kilos/kg {reps} reps/times"
  match = t.match(/(\d+(?:\.\d+)?)\s*(?:pounds?|lbs?|kilos?|kg|kgs?)\s+(\d+)\s*(?:reps?|times?|rep)?/);
  if (match) return { weight: parseNumber(match[1]), reps: parseNumber(match[2]) };

  // Pattern: "{reps} reps at/with {weight}"
  match = t.match(/(\d+)\s*(?:reps?|times?)\s*(?:at|with|@)\s*(\d+(?:\.\d+)?)/);
  if (match) return { weight: parseNumber(match[2]), reps: parseNumber(match[1]) };

  // Pattern: "{weight} {reps}" (two numbers)
  match = t.match(/(\d+(?:\.\d+)?)\s+(\d+)/);
  if (match) return { weight: parseNumber(match[1]), reps: parseNumber(match[2]) };

  // Pattern: just reps "{N} reps"
  match = t.match(/(\d+)\s*(?:reps?|times?)/);
  if (match) return { weight: null, reps: parseNumber(match[1]) };

  // Pattern: just a single number (assume reps if small, weight if large)
  match = t.match(/(\d+(?:\.\d+)?)/);
  if (match) {
    const val = parseNumber(match[1]);
    if (val !== null && val <= 30) return { weight: null, reps: val };
    return { weight: val, reps: null };
  }

  return { weight: null, reps: null };
}
