import { GoogleGenAI } from '@google/genai';
import PQueue from 'p-queue';
import type { MCPService } from './mcp.js';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

const SYSTEM_INSTRUCTION = "You are the TwitchMIDI Docs Discord Bot (TwitchMIDI Docs#9567), a free helper for TwitchMIDI and TwitchMIDI+ users. You are powered by Gemma 4 31B. You remember the last 10 messages per user, then forget earlier context. You answer questions from the official TwitchMIDI+ documentation — you cannot control TwitchMIDI, modify settings, or do anything on Twitch. You are given DOCUMENTATION CONTEXT retrieved from the official docs for each question; answer using only that context plus the conversation history. If the context does not contain the answer, explicitly state that you couldn't find it in the docs rather than hallucinating. Reply in the same language the user wrote in. Format responses for Discord: use plain text and Unicode characters directly (→ ← × ≤ etc.), never LaTeX notation like $\\rightarrow$ or $$...$$.";

// Enforce 15 RPM limit (1 concurrency, max 5 full queries per minute to be safe)
const llmQueue = new PQueue({
  concurrency: 1,
  intervalCap: 5,
  interval: 60000,
});

// Gemma models do NOT support the Gemini API function-calling round-trip: the
// model can emit a functionCall, but sending the functionResponse back 500s
// (ApiError INTERNAL). So we retrieve docs manually here and inject them as
// context, letting Gemma generate plain text with no tools attached.
async function retrieveDocs(mcpService: MCPService, query: string): Promise<string> {
  try {
    const tools = await mcpService.getTools();
    const docTool = tools.find(t => t.name.includes('query') || t.name.includes('doc')) || tools[0];
    if (!docTool) return '';

    const argKey =
      (docTool.inputSchema?.required as string[] | undefined)?.[0] ||
      Object.keys(docTool.inputSchema?.properties || {})[0] ||
      'query';

    const result = await mcpService.callTool(docTool.name, { [argKey]: query });
    return (result.content as any[]).map((c: any) => c.text).filter(Boolean).join('\n');
  } catch (err: any) {
    console.error('Doc retrieval failed:', err);
    return '';
  }
}

export async function askGemini(mcpService: MCPService, prompt: string, history: { role: string; parts: { text: string }[] }[]): Promise<string> {
  return llmQueue.add(async () => {
    const docs = await retrieveDocs(mcpService, prompt);

    const augmentedPrompt = docs
      ? `DOCUMENTATION CONTEXT:\n${docs}\n\nUSER QUESTION:\n${prompt}`
      : `No documentation was found for this query.\n\nUSER QUESTION:\n${prompt}`;

    const currentChat = ai.chats.create({
      model: 'gemma-4-31b-it',
      config: {
         systemInstruction: SYSTEM_INSTRUCTION,
      },
      history: history.map(h => ({
         role: h.role,
         parts: h.parts
      }))
    });

    const response = await currentChat.sendMessage({
      message: augmentedPrompt
    });

    return response.text || 'Sorry, I got an empty response.';
  }) as Promise<string>;
}
