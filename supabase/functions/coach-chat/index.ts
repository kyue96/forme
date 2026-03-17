import Anthropic from 'npm:@anthropic-ai/sdk@0.36.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are Forme Coach, an AI fitness coach built into the Forme workout app. You are friendly, knowledgeable, and concise.

Your expertise includes:
- Exercise form and technique
- Workout programming and periodization
- Nutrition basics for fitness goals
- Recovery and injury prevention
- Motivation and habit building

Guidelines:
- Keep responses short and actionable (2-3 paragraphs max)
- Use bullet points for lists
- If asked about medical conditions, recommend consulting a doctor
- Be encouraging but honest
- Reference the user's workout context when provided
- Don't prescribe specific calorie/macro targets without knowing their full profile`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { messages, context } = body;

    const client = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
    });

    // Build context string
    let contextStr = '';
    if (context) {
      if (context.currentWorkout) {
        contextStr += `\nUser is currently working out: ${JSON.stringify(context.currentWorkout)}`;
      }
      if (context.profile) {
        contextStr += `\nUser profile: ${JSON.stringify(context.profile)}`;
      }
      if (context.recentSummaries) {
        contextStr += `\nRecent workout summaries: ${JSON.stringify(context.recentSummaries)}`;
      }
    }

    const systemPrompt = contextStr
      ? `${SYSTEM_PROMPT}\n\nCurrent context:${contextStr}`
      : SYSTEM_PROMPT;

    const apiMessages = (messages || []).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: apiMessages,
    });

    const reply = message.content[0].type === 'text' ? message.content[0].text : '';

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
