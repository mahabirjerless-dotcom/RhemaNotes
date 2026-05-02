import { GoogleGenAI } from "@google/genai";
import { MASTER_SERMON_PROCESSING_PROMPT } from '../constants';
import { SermonSummaryOutput } from '../types';

// We proxy through the current domain to avoid exposing the real API key
const ai = new GoogleGenAI({ 
  apiKey: 'proxy',
  httpOptions: {
    baseUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  }
});
const GEMINI_MODEL = 'gemini-2.5-flash';

export async function processSermonTranscript(
  transcript: string,
  includeReflection: boolean,
): Promise<SermonSummaryOutput> {
  return callGemini([{ text: MASTER_SERMON_PROCESSING_PROMPT(transcript, includeReflection) }], includeReflection);
}

export async function processSermonFile(
  file: File,
  includeReflection: boolean,
): Promise<SermonSummaryOutput> {
  const base64Data = await fileToBase64(file);
  const prompt = MASTER_SERMON_PROCESSING_PROMPT("Attached media file", includeReflection);
  
  return callGemini([
    { text: prompt },
    {
      inlineData: {
        data: base64Data,
        mimeType: file.type
      }
    }
  ], includeReflection);
}

export async function processSermonYoutubeUrl(
  url: string,
  includeReflection: boolean,
): Promise<SermonSummaryOutput> {
  const prompt = MASTER_SERMON_PROCESSING_PROMPT(`Sermon YouTube Video Link: ${url}\nPlease read the full transcript of this video from the provided URL and process it.`, includeReflection);
  return callGemini([{ text: prompt }], includeReflection);
}

async function callGemini(parts: any[], includeReflection: boolean): Promise<SermonSummaryOutput> {

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: "application/json",
      },
    });

    const jsonString = response.text?.trim();
    if (!jsonString) {
      throw new Error("No response or empty response from Gemini API.");
    }

    let parsedData: SermonSummaryOutput;
    try {
      const cleanJsonString = jsonString.startsWith('```json') && jsonString.endsWith('```')
        ? jsonString.substring(7, jsonString.length - 3).trim()
        : jsonString;
      parsedData = JSON.parse(cleanJsonString);
    } catch (parseError) {
      console.error("Failed to parse JSON response:", jsonString, parseError);
      throw new Error(`Invalid JSON response from AI.`);
    }

    // Default values for missing fields to satisfy the requirement of theme detection and actionable insights
    if (!parsedData.actionable_insights) parsedData.actionable_insights = [];
    if (!parsedData.user_notes) parsedData.user_notes = [];
    if (!parsedData.personal_action_items) parsedData.personal_action_items = [];

    if (!includeReflection) {
      parsedData.reflection = {};
    } else if (!parsedData.reflection) {
      parsedData.reflection = {};
    }

    return parsedData;
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    throw new Error(`Failed to communicate with Gemini API: ${error.message}`);
  }
}

export async function sermonChat(
  history: { role: 'user' | 'assistant', content: string }[],
  message: string,
  transcript: string
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API Key is not configured.");
  }

  try {
    const chat = ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ text: `You are a helpful sermon study assistant. You have access to the following sermon transcript. Answer the user's questions strictly using information from the transcript when possible. If the user asks a general Bible question, provide a scripture-grounded answer that aligns with the spirit of the sermon.
          
          Transcript:
          ${transcript}` }]
        },
        ...history.map(h => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }]
        })),
        {
          role: 'user',
          parts: [{ text: message }]
        }
      ]
    });

    const result = await chat;
    return result.text || "I couldn't generate a response.";
  } catch (error: any) {
    console.error("Error in sermonChat:", error);
    throw new Error(`Failed to chat with AI: ${error.message}`);
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result as string;
      resolve(base64String.split(',')[1]);
    };
    reader.onerror = error => reject(error);
  });
}
