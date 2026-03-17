import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Deterministic UUIDs so the script is idempotent
const SEED_PREFIX = '00000000-seed';
const profileId = (i: number) => `${SEED_PREFIX}-0000-0000-${String(i).padStart(12, '0')}`;
const postId = (i: number) => `${SEED_PREFIX}-0001-0000-${String(i).padStart(12, '0')}`;
const reactionId = (i: number) => `${SEED_PREFIX}-0002-0000-${String(i).padStart(12, '0')}`;
const commentId = (i: number) => `${SEED_PREFIX}-0003-0000-${String(i).padStart(12, '0')}`;

const PROFILES = [
  { display_name: 'Alex Rivera', avatar_color: '#F59E0B' },
  { display_name: 'Jordan Lee', avatar_color: '#3B82F6' },
  { display_name: 'Sam Chen', avatar_color: '#10B981' },
  { display_name: 'Taylor Kim', avatar_color: '#8B5CF6' },
  { display_name: 'Morgan Hayes', avatar_color: '#EF4444' },
  { display_name: 'Casey Brooks', avatar_color: '#EC4899' },
  { display_name: 'Riley Patel', avatar_color: '#06B6D4' },
  { display_name: 'Drew Nakamura', avatar_color: '#F97316' },
];

const FOCUSES = [
  'Push Day', 'Pull Day', 'Leg Day', 'Upper Body',
  'Full Body', 'Chest & Triceps', 'Back & Biceps', 'Shoulders & Arms',
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const MUSCLE_GROUPS: Record<string, string[]> = {
  'Push Day': ['Chest', 'Shoulders', 'Triceps'],
  'Pull Day': ['Back', 'Biceps', 'Core'],
  'Leg Day': ['Quads', 'Hamstrings', 'Glutes'],
  'Upper Body': ['Chest', 'Back', 'Shoulders'],
  'Full Body': ['Chest', 'Quads', 'Back', 'Core'],
  'Chest & Triceps': ['Chest', 'Triceps'],
  'Back & Biceps': ['Back', 'Biceps'],
  'Shoulders & Arms': ['Shoulders', 'Biceps', 'Triceps'],
};

const CAPTIONS = [
  'Great push session today!',
  'Legs were shaking by the end',
  'New PR on bench press, feeling unstoppable',
  'Early morning grind before work',
  'Back day is best day',
  'Finally hit 225 on squat',
  'Quick full body session, in and out',
  'Shoulder pump was unreal today',
  'Consistency over intensity',
  'Started the week strong',
  'Recovery day turned into a solid workout',
  'Nothing beats a good pull session',
  'Arms day never disappoints',
  'Post-workout glow is real',
  'That last set was pure willpower',
];

const COMMENT_BODIES = [
  'Great work! Keep it up!',
  'That volume is insane',
  'How long have you been training?',
  'Inspired me to hit the gym today',
  'Solid session!',
  'Love the consistency',
  'What program are you running?',
  'Beast mode activated',
  'Nice work! Those numbers are impressive',
  'Goals right here',
];

const EMOJIS = ['\uD83D\uDD25', '\uD83D\uDCAA', '\uD83D\uDC4F', '\u2764\uFE0F', '\uD83D\uDCAF'];

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
  console.log('Checking for existing seed data...');

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId(0))
    .maybeSingle();

  if (existing) {
    console.log('Seed data already exists. Cleaning up first...');
    // Delete in dependency order
    const allCommentIds = Array.from({ length: 45 }, (_, i) => commentId(i));
    const allReactionIds = Array.from({ length: 75 }, (_, i) => reactionId(i));
    const allPostIds = Array.from({ length: 15 }, (_, i) => postId(i));
    const allProfileIds = Array.from({ length: 8 }, (_, i) => profileId(i));

    await supabase.from('comments').delete().in('id', allCommentIds);
    await supabase.from('post_reactions').delete().in('id', allReactionIds);
    await supabase.from('posts').delete().in('id', allPostIds);
    await supabase.from('profiles').delete().in('id', allProfileIds);
    console.log('Cleaned up existing seed data.');
  }

  // 1. Create profiles
  console.log('Creating 8 fake profiles...');
  const profileRows = PROFILES.map((p, i) => ({
    id: profileId(i),
    display_name: p.display_name,
    avatar_url: null,
    avatar_color: p.avatar_color,
  }));

  const { error: profileErr } = await supabase.from('profiles').insert(profileRows);
  if (profileErr) {
    console.error('Error creating profiles:', profileErr);
    process.exit(1);
  }

  // 2. Create posts
  console.log('Creating 15 workout recap posts...');
  const now = Date.now();
  const postRows = Array.from({ length: 15 }, (_, i) => {
    const focus = FOCUSES[i % FOCUSES.length];
    const userIdx = i % PROFILES.length;
    return {
      id: postId(i),
      user_id: profileId(userIdx),
      type: 'workout_recap' as const,
      caption: CAPTIONS[i],
      workout_log_id: null,
      card_data: {
        themeIdx: rand(0, 5),
        sets: rand(12, 24),
        reps: rand(40, 120),
        volume: rand(5000, 25000),
        unitLabel: 'lbs',
        durationMinutes: rand(30, 75),
        focus,
        dayName: DAYS[i % 7],
        muscles: MUSCLE_GROUPS[focus],
      },
      image_url: null,
      program_data: null,
      visibility: 'public' as const,
      like_count: 0, // will be updated after reactions
      comment_count: 0, // will be updated after comments
      // Spread posts over the last 7 days
      created_at: new Date(now - i * 4 * 60 * 60 * 1000).toISOString(),
    };
  });

  const { error: postErr } = await supabase.from('posts').insert(postRows);
  if (postErr) {
    console.error('Error creating posts:', postErr);
    process.exit(1);
  }

  // 3. Create reactions (3-5 per post)
  console.log('Adding reactions...');
  let reactionIdx = 0;
  const reactionRows: any[] = [];
  const likeCounts: Record<string, number> = {};

  for (let p = 0; p < 15; p++) {
    const numReactions = rand(3, 5);
    likeCounts[postId(p)] = numReactions;
    // Pick unique users for this post (exclude the post author)
    const authorIdx = p % PROFILES.length;
    const available = Array.from({ length: 8 }, (_, i) => i).filter((i) => i !== authorIdx);
    const shuffled = available.sort(() => Math.random() - 0.5);
    for (let r = 0; r < numReactions; r++) {
      reactionRows.push({
        id: reactionId(reactionIdx++),
        post_id: postId(p),
        user_id: profileId(shuffled[r]),
        emoji: pick(EMOJIS),
      });
    }
  }

  const { error: reactionErr } = await supabase.from('post_reactions').insert(reactionRows);
  if (reactionErr) {
    console.error('Error creating reactions:', reactionErr);
    process.exit(1);
  }

  // 4. Create comments (2-3 per post)
  console.log('Adding comments...');
  let commentIdx = 0;
  const commentRows: any[] = [];
  const commentCounts: Record<string, number> = {};

  for (let p = 0; p < 15; p++) {
    const numComments = rand(2, 3);
    commentCounts[postId(p)] = numComments;
    const authorIdx = p % PROFILES.length;
    const available = Array.from({ length: 8 }, (_, i) => i).filter((i) => i !== authorIdx);
    const shuffled = available.sort(() => Math.random() - 0.5);
    for (let c = 0; c < numComments; c++) {
      commentRows.push({
        id: commentId(commentIdx++),
        post_id: postId(p),
        user_id: profileId(shuffled[c]),
        body: pick(COMMENT_BODIES),
        created_at: new Date(now - p * 4 * 60 * 60 * 1000 + (c + 1) * 10 * 60 * 1000).toISOString(),
      });
    }
  }

  const { error: commentErr } = await supabase.from('comments').insert(commentRows);
  if (commentErr) {
    console.error('Error creating comments:', commentErr);
    process.exit(1);
  }

  // 5. Update like_count and comment_count on posts
  console.log('Updating post counts...');
  for (let p = 0; p < 15; p++) {
    const pid = postId(p);
    await supabase
      .from('posts')
      .update({
        like_count: likeCounts[pid],
        comment_count: commentCounts[pid],
      })
      .eq('id', pid);
  }

  console.log('Done! Seeded:');
  console.log(`  - ${PROFILES.length} profiles`);
  console.log(`  - ${postRows.length} posts`);
  console.log(`  - ${reactionRows.length} reactions`);
  console.log(`  - ${commentRows.length} comments`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
