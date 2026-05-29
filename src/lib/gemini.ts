import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

// gemini-1.5-flash was retired (404); 2.5-flash is the current stable flash model.
export const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export async function suggestPlaces(lat: number, lng: number, category: string = 'food') {
  const prompt = `I am at coordinates ${lat}, ${lng}.
    Recommend 3 highly-rated ${category} places nearby.
    Return ONLY a JSON array of objects with these keys: name, description, category, lat, lng.
    The "category" value MUST be exactly one of: "food", "sightseeing", "activity", "scenery".
    Do not include markdown formatting or extra text.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    // gemini-1.5-flash often wraps the array in ```json fences or stray prose —
    // extract the first [...] block so a valid response still parses.
    const match = text.match(/\[[\s\S]*\]/);
    return JSON.parse(match ? match[0] : text);
  } catch (error) {
    console.error("Gemini Suggestion Error:", error);
    return [];
  }
}
