import { config } from 'dotenv';
config();
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

// --- Our list of standard emotions ---
const emotionList = [
  'Happy', 'Joyful', 'Grateful', 'Confident', 'Productive', // Positive
  'Sad', 'Anxious', 'Stressed', 'Angry', 'Tired',     // Negative
  'Calm', 'Reflective', 'Neutral'                     // Neutral
].join(', ');

export default async function handler(request, response) {
  const { text } = request.body;

  if (!text) {
    return response.status(400).json({
      error: "Request must include 'text' field.",
    });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
    
    // --- PROMPT UPDATED FOR DEEPER PERSONALITY ---
    const prompt = `
      Analyze the following journal entry as a deeply empathetic and intelligent AI companion. 
      
      You must provide a JSON object with these five keys:

      1. 'emotion': You MUST choose ONE single, primary emotion from this exact list: [${emotionList}].
      2. 'summary': A one-sentence summary of the key event or feeling.
      3. 'reply': A warm, deeply personalized, and insightful paragraph (3-4 sentences). Do not just repeat what they said. Analyze specific details they mentioned, validate their feelings, and offer a unique perspective or gentle encouragement. Speak to them like a wise, close friend.
      4. 'keywords': An array of 3-5 key nouns or topics.
      5. 'sentiment_score': A number between -1.0 (very negative) and 1.0 (very positive), representing the overall sentiment.

      ENTRY: "${text}"

      JSON:
      `;
    // --- END OF UPDATE ---

    // Retry transient Gemini overload/rate-limit errors (initial attempt + 2 retries).
    let result;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await model.generateContent(prompt);
        break;
      } catch (error) {
        const status = error.status ?? error.statusCode;
        const isRetryable = [429, 500, 502, 503, 504].includes(Number(status));

        if (!isRetryable || attempt === 2) {
          throw error;
        }

        const delayMs = 500 * (2 ** attempt) + Math.floor(Math.random() * 250);
        console.warn(`Gemini processEntry attempt ${attempt + 1} failed (${status}); retrying in ${delayMs}ms.`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    const aiResponse = await result.response;
    
    const aiJsonString = aiResponse.text()
      .trim()
      .replace(/^```json\n/, "")
      .replace(/\n```$/, "");

    return response.status(200).json({ reply: aiJsonString });

  } catch (e) {
    console.error("An error occurred:", e);
    return response.status(500).json({
      error: `An error occurred: ${e.message}`,
    });
  }
}