import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const url = 'https://www.youtube.com/watch?v=0C_soDevTKY';
  const prompt = `Can you read the transcript of this YouTube video and give me the first sentence? Video: ${url}`;
  try {
    const result = await model.generateContent(prompt);
    console.log(result.response.text());
  } catch (e) {
    console.error(e.message);
  }
}
test();
