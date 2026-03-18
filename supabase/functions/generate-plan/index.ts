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
      const lastWorkedStr = (session.lastWorked ?? [])
        .map((lw: { muscleGroup: string; date: string }) => `${lw.muscleGroup} on ${lw.date}`)
        .join(', ');

      prompt = `You are a certified personal trainer. Generate a SINGLE workout session based on:

Location: ${session.location}
Available time: ${session.availableMinutes} minutes
Target muscle group/focus: ${session.muscleGroup}
Recently worked muscles (avoid repeating within 48hrs): ${lastWorkedStr || 'None'}

Provide exercises that fit within the available time. Choose exercises appropriate for ${session.location === 'Home' ? 'home with minimal equipment' : 'a fully equipped gym'}.

Return ONLY valid JSON with no markdown, no explanation. Just the JSON object:
{
  "dayName": "Today",
  "focus": "${session.muscleGroup}",
  "exercises": [
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
      const daysCount = answers.daysPerWeek === '5+' ? 5 : parseInt(answers.daysPerWeek);
      const splitInfo = answers.preferredSplit
        ? `\nPreferred training split: ${answers.preferredSplit}`
        : '';

      // Equipment enforcement
      const equipmentList = Array.isArray(answers.equipment) ? answers.equipment : [answers.equipment];
      const equipmentStr = equipmentList.join(', ');
      let equipmentRule = '';
      if (equipmentList.length === 1 && equipmentList[0] === 'Bodyweight') {
        equipmentRule = 'Only include bodyweight exercises (push-ups, lunges, planks, dips, etc). Do NOT include any exercises requiring dumbbells, barbells, machines, or any other equipment.';
      } else if (equipmentList.length === 1 && equipmentList[0] === 'Resistance bands') {
        equipmentRule = 'Only include resistance band exercises. Do NOT include any exercises requiring dumbbells, barbells, or machines.';
      } else if (equipmentList.includes('Dumbbells') && !equipmentList.includes('Full gym')) {
        equipmentRule = `Only include exercises that use the following equipment: ${equipmentStr}. Do NOT include any exercises requiring barbells, cable machines, or gym machines.`;
      } else {
        equipmentRule = `Only include exercises that use the following equipment: ${equipmentStr}. Do not include any exercises requiring other equipment.`;
      }

      prompt = `You are a certified personal trainer. Generate a personalized weekly workout plan based on the following details:

Goal: ${answers.goal}
Experience level: ${answers.experience}
Equipment available: ${equipmentStr}
Days per week: ${answers.daysPerWeek}${splitInfo}
Areas to avoid: ${answers.injuries}
Height: ${answers.height}
Weight: ${answers.weight}

EQUIPMENT RULES: ${equipmentRule}

Create a structured weekly program with exactly ${daysCount} workout days. ${
        answers.preferredSplit
          ? `Organize the days using a ${answers.preferredSplit} split structure.`
          : ''
      } Include specific exercises appropriate for the equipment and experience level. Avoid exercises that stress the areas listed under "areas to avoid".

Do not include cardio exercises in the workout plan. Cardio is tracked separately by the user.

Keep exercise notes to 5 words or fewer. Return ONLY valid JSON with no markdown, no explanation. Just the JSON object:
{
  "weeklyPlan": [
    {
      "dayName": "Monday",
      "focus": "Push Day (Chest, Shoulders, Triceps)",
      "exercises": [
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
      max_tokens: mode === 'session' ? 1024 : 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    let text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      text = text.slice(jsonStart, jsonEnd + 1);
    }
    if (message.stop_reason === 'max_tokens') {
      throw new Error('Plan generation was cut off. Response too long. Please try again.');
    }

    let plan;
    try {
      plan = JSON.parse(text);
    } catch {
      const fixed = text
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
      plan = JSON.parse(fixed);
    }

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
