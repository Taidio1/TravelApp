import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export interface NearbyPlace {
  name: string;
  rating?: number | null;
  totalRatings?: number | null;
  category?: string | null;
}

export interface ChatContext {
  lat: number;
  lng: number;
  locationLabel?: string | null;
  nearbyPlaces?: NearbyPlace[];
}

function systemPrompt(ctx: ChatContext): string {
  // Build location string — always include raw coordinates so the model
  // cannot ignore or override the real position with its own assumptions.
  const coordsStr = `${ctx.lat.toFixed(5)}, ${ctx.lng.toFixed(5)}`;
  const loc = ctx.locationLabel
    ? `${ctx.locationLabel} (GPS: ${coordsStr})`
    : `GPS: ${coordsStr}`;

  const nearby = ctx.nearbyPlaces?.length
    ? `\nNa mapie grupy widoczne są już te miejsca w pobliżu (dane z bazy użytkownika):\n${ctx.nearbyPlaces
        .map(p => {
          let line = `- ${p.name}`;
          if (p.rating != null) line += ` ⭐ ${p.rating.toFixed(1)}`;
          if (p.totalRatings != null) line += ` (${p.totalRatings} opinii)`;
          if (p.category) line += ` [${p.category}]`;
          return line;
        })
        .join('\n')}\nMożesz się do nich odnosić, ale nie zmieniaj na ich podstawie okolicy — trzymaj się GPS.`
    : '';

  return `Jesteś lokalnym przewodnikiem-kumplem od podróży.

LOKALIZACJA UŻYTKOWNIKA (bezwzględnie obowiązująca): ${loc}.${nearby}

KRYTYCZNE ZASADY:
1. Zawsze polecaj miejsca TYLKO w tej konkretnej lokalizacji wyznaczonej przez GPS. Jeśli współrzędne wskazują np. Warszawę — polecaj miejsca w Warszawie, jeśli Tokio — w Tokio. NIGDY nie zakładaj z góry żadnego miasta.
2. Nie daj się zmylić nazwom miejsc z listy "widoczne w pobliżu" — to dane historyczne użytkownika, a nie wskazówka co do miasta.
3. Jeśli nie znasz konkretnych miejsc pod tymi współrzędnymi, powiedz to szczerze i opisz co ogólnie jest warte uwagi w tym regionie.

ZASADY FORMATOWANIA ODPOWIEDZI:
- Restauracje, bary, kawiarnie: zawsze podaj ocenę Google (np. ⭐ 4.6, 1200 opinii) jeśli ją znasz. Format: [[Nazwa]] ⭐ X.X (N opinii) — jedno zdanie dlaczego warto.
- Atrakcje, muzea, zabytki, widoki: po nazwie dodaj 1-2 zdania co konkretnie warto tam zobaczyć lub przeżyć (bez zbędnych ogólników).
- Kawiarnie i bary: podaj ocenę jeśli znasz + jeden charakterystyczny detal (specjalność, klimat, coś unikalnego).
- Jeśli nie znasz oceny danego miejsca — nie wymyślaj, po prostu pomiń ocenę.

Twoje zadanie: polecać konkretne, prawdziwe miejsca w okolicy GPS — restauracje, bary, kawiarnie, atrakcje, widoki — oraz regionalne dania i napoje.
Mów po polsku, krótko, konkretnie i z luzem, jak dobry znajomy. Bez markdown, bez długich wstępów.
WAŻNE: za każdym razem gdy polecasz konkretne miejsce — owiń jego pełną nazwę własną w podwójne nawiasy kwadratowe, np. [[Mercado de San Miguel]]. Stosuj to wyłącznie dla nazw własnych miejsc. NIE owijaj nazw potraw, napojów, dzielnic ani ogólnych określeń.`;
}

async function chatGemini(messages: ChatMsg[], ctx: ChatContext): Promise<string> {
  const chatModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt(ctx),
  });
  // Gemini history must start with a 'user' turn — our first message always is.
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const chat = chatModel.startChat({ history });
  const last = messages[messages.length - 1];
  const result = await chat.sendMessage(last.content);
  return result.response.text().trim();
}

async function chatOpenAI(messages: ChatMsg[], ctx: ChatContext): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY ?? ''}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt(ctx) },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('OpenAI chat error:', data?.error?.message ?? res.status);
    throw new Error(data?.error?.message ?? 'OpenAI error');
  }
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

export async function chatWithAI(messages: ChatMsg[], ctx: ChatContext): Promise<string> {
  const provider = (localStorage.getItem('ai_provider') as 'openai' | 'gemini') || 'gemini';
  try {
    return provider === 'openai'
      ? await chatOpenAI(messages, ctx)
      : await chatGemini(messages, ctx);
  } catch (e) {
    console.error('chatWithAI error:', e);
    return 'Ups, coś się posypało po stronie AI. Spróbuj jeszcze raz za chwilę.';
  }
}
