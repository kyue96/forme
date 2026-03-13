import Anthropic from 'npm:@anthropic-ai/sdk@0.36.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { mode, answers, session } = body;

    const client = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
    });

    let prompt: string;

    if (mode === 'session') {
      // Pre-workout: generate a single session
      const lastWorkedStr = (session.lastWorked ?? [])
        .map((lw: { muscleGroup: string; date: string }) => `${lw.muscleGroup} on ${lw.date}`)
        .join(', ');

      prompt = `You are a certified personal trainer. Generate a SINGLE workout session based on:

Location: ${session.location}
Available time: ${session.availableMinutes} minutes
Target muscle group/focus: ${session.muscleGroup}
Recently worked muscles (avoid repeating within 48hrs): ${lastWorkedStr || 'None'}

Start with a 5-minute warmup section. Then provide exercises that fit within the available time (minus warmup). Choose exercises appropriate for ${session.location === 'Home' ? 'home with minimal equipment' : 'a fully equipped gym'}.

Return ONLY valid JSON with no markdown, no explanation — just the JSON object:
{
  "dayName": "Today",
  "focus": "${session.muscleGroup}",
  "exercises": [
    {
      "name": "Warm-up: Light Cardio + Dynamic Stretching",
      "sets": 1,
      "reps": "5 min",
      "rest": "0 sec",
      "notes": "Get blood flowing"
    },
    {
      "name": "Barbell Bench Press",
      "sets": 4,
      "reps": "8-10",
      "rest": "90 sec",
      "notes": "Control the descent"
    }
  ]
}`;
    } else {
      // Full weekly plan generation
      const daysCount = answers.daysPerWeek === '5+' ? 5 : parseInt(answers.daysPerWeek);
      const splitInfo = answers.preferredSplit
        ? `\nPreferred training split: ${answers.preferredSplit}`
        : '';

      prompt = `You are a certified personal trainer. Generate a personalised weekly workout plan based on the following details:

Goal: ${answers.goal}
Experience level: ${answers.experience}
Equipment available: ${answers.equipment}
Days per week: ${answers.daysPerWeek}${splitInfo}
Areas to avoid: ${answers.injuries}
Height: ${answers.height}
Weight: ${answers.weight}

Create a structured weekly programme with exactly ${daysCount} workout days. ${
        answers.preferredSplit
          ? `Organise the days using a ${answers.preferredSplit} split structure.`
          : ''
      } Include specific exercises appropriate for the equipment and experience level. Avoid exercises that stress the areas listed under "areas to avoid".

Start each day with a warmup exercise entry (5 min warmup as the first exercise).

Return ONLY valid JSON with no markdown, no explanation — just the JSON object:
{
  "weeklyPlan": [
    {
      "dayName": "Monday",
      "focus": "Push Day (Chest, Shoulders, Triceps)",
      "exercises": [
        {
          "name": "Warm-up: Light Cardio + Dynamic Stretching",
          "sets": 1,
          "reps": "5 min",
          "rest": "0 sec",
          "notes": "Get blood flowing"
        },
        {
          "name": "Barbell Bench Press",
          "sets": 4,
          "reps": "8-10",
          "rest": "90 sec",
          "notes": "Control the descent"
        }
      ]
    }
  ]
}`;
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    // Strip markdown code fences if Claude wraps the JSON
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const plan = JSON.parse(text);

    return new Response(JSON.stringify(plan), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
