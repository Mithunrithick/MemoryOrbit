import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

export default async function handler(request, response) {
  const { question, context } = request.body;

  if (!question || !context) {
    return response.status(400).json({ error: "Missing question or context." });
  }

  try {
    // --- FIX: Changed model to match your working processEntry.js ---
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

    const prompt = `
    You are "The Oracle," a wise, mystical, and highly intelligent AI analyst for a personal journal.
    
    Here is the user's recorded memory log (Journal Entries):
    ---------------------------------------------------------
    ${context}
    ---------------------------------------------------------

    USER QUESTION: "${question}"

    INSTRUCTIONS:
    1. Answer the user's question based ONLY on the provided journal entries.
    2. Be insightful. Connect dots between different entries.
    3. Cite specific dates or events to prove you know their history.
    4. If the answer isn't in the journals, say "The stars do not hold this answer."
    5. Keep the tone mystical but helpful.
    `;

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
        console.warn(`Gemini askOracle attempt ${attempt + 1} failed (${status}); retrying in ${delayMs}ms.`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    const aiResponse = await result.response;
    const answer = aiResponse.text().trim();

    return response.status(200).json({ answer });

  } catch (e) {
    console.error("Oracle Error:", e);
    return response.status(500).json({ error: e.message });
  }
}
