const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

// gpt-4o-mini: cheap + JSON-capable, good for stretching credits.
const MODEL = 'gpt-4o-mini';

export async function suggestPlaces(lat: number, lng: number, theme: string = 'interesting places') {
  const prompt = `I am at coordinates ${lat}, ${lng}.
Recommend 3 highly-rated ${theme} nearby.
Return a JSON object of the form { "places": [ { "name", "description", "category", "lat", "lng" } ] }.
"category" MUST be exactly one of: "food", "sightseeing", "activity", "scenery". lat/lng are numbers.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a travel assistant that returns only valid JSON.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('OpenAI error:', data?.error?.message ?? res.status);
      return [];
    }
    const text = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : parsed.places ?? [];
  } catch (error) {
    console.error('OpenAI Suggestion Error:', error);
    return [];
  }
}
