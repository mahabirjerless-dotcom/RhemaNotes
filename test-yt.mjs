import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf-8');
const keyMatch = envFile.match(/GEMINI_API_KEY=(.*)/);
async function test() {
  const ai = new GoogleGenAI({ apiKey: keyMatch[1] });
  const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: "Analyze this YouTube video and give me the first 2 sentences of the transcript. Video: https://www.youtube.com/watch?v=0C_soDevTKY"
  });
  console.log(response.text);
}
test();
