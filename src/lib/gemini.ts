import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

export const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function suggestPlaces(lat: number, lng: number, category: string = 'food') {
  const prompt = `I am in Spain at coordinates ${lat}, ${lng}. 
    Recommend 3 highly-rated ${category} places nearby. 
    Return ONLY a JSON array of objects with these keys: name, description, category, lat, lng. 
    Do not include markdown formatting or extra text.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Suggestion Error:", error);
    return [];
  }
}
