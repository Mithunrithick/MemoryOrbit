// frontend/api/getReflection.js
import { config } from 'dotenv';
config();
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

export default async function handler(request, response) {
  // Get the ORIGINAL entry text from the request
  const { entryText } = request.body;

  if (!entryText) {
    return response.status(400).json({
      error: "Request must include 'entryText' field.",
    });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

    // --- NEW PROMPT for Reflection ---
    const prompt = `
    Based *only* on the following journal entry, ask the user one single, gentle, open-ended, and insightful question to encourage deeper self-reflection about the feelings or events described. Do not give advice or opinions. Frame the question directly to the user (e.g., "What makes you feel..." or "How did you...").

    JOURNAL ENTRY:
    "${entryText}"

    REFLECTIVE QUESTION:
    `;
    // --- END OF NEW PROMPT ---

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
        console.warn(`Gemini getReflection attempt ${attempt + 1} failed (${status}); retrying in ${delayMs}ms.`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    const aiResponse = await result.response;
    const reflectionQuestion = aiResponse.text().trim();

    // Send just the question string back
    return response.status(200).json({ question: reflectionQuestion });

  } catch (e) {
    console.error("Reflection error:", e);
    return response.status(500).json({
      error: `An error occurred generating reflection: ${e.message}`,
    });
  }
}
