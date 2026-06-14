import { GoogleGenAI, Type, FunctionDeclaration, Tool } from '@google/genai';
import PQueue from 'p-queue';
import type { MCPService } from './mcp.js';
import type { Tool as MCPTool } from '@modelcontextprotocol/sdk/types.js';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

// Enforce 15 RPM limit (1 concurrency, max 5 full queries per minute to be safe)
const llmQueue = new PQueue({
  concurrency: 1,
  intervalCap: 5,
  interval: 60000,
});

function mapMcpToolToGemini(tool: MCPTool): FunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description || '',
    parameters: {
      type: Type.OBJECT,
      properties: Object.fromEntries(
        Object.entries(tool.inputSchema?.properties || {}).map(([key, value]: [string, any]) => {
          let geminiType = Type.STRING;
          if (value.type === 'number') geminiType = Type.NUMBER;
          if (value.type === 'boolean') geminiType = Type.BOOLEAN;
          if (value.type === 'array') geminiType = Type.ARRAY;
          if (value.type === 'object') geminiType = Type.OBJECT;
          if (value.type === 'integer') geminiType = Type.INTEGER;

          return [
            key,
            {
              type: geminiType,
              description: value.description || '',
              ...(value.items ? { items: value.items } : {}),
            },
          ];
        })
      ),
      required: (tool.inputSchema?.required as string[]) || [],
    },
  };
}

export async function askGemini(mcpService: MCPService, prompt: string, history: { role: string; parts: { text: string }[] }[]): Promise<string> {
  return llmQueue.add(async () => {
    const mcpTools = await mcpService.getTools();
    const geminiTools: Tool[] = [{
      functionDeclarations: mcpTools.map(mapMcpToolToGemini),
    }];

    const currentChat = ai.chats.create({
      model: 'gemma-4-31b-it',
      config: {
         systemInstruction: "You are a helpful Discord bot expert in TwitchMIDI and TwitchMIDI+ documentation. Use the available tools to lookup documentation when answering user queries. If a search returns nothing, explicitly state that you couldn't find the answer in the docs rather than hallucinating. Format responses for Discord: use plain text and Unicode characters directly (→ ← × ≤ etc.), never LaTeX notation like $\\rightarrow$ or $$...$$.",
         tools: geminiTools,
      },
      history: history.map(h => ({
         role: h.role,
         parts: h.parts
      }))
    });

    let response = await currentChat.sendMessage({
      message: prompt
    });

    while (response.functionCalls && response.functionCalls.length > 0) {
      const toolCall = response.functionCalls[0];
      try {
        console.log(`Calling MCP tool: ${toolCall.name}`);
        const mcpResult = await mcpService.callTool(
          toolCall.name || '',
          toolCall.args as Record<string, any>
        );

        const contentResult = (mcpResult.content as any[]).map((c: any) => c.text).join('\n');
        
        response = await currentChat.sendMessage({
          message: [
            {
              functionResponse: {
                name: toolCall.name,
                response: { result: contentResult || 'No results found.' },
              }
            }
          ]
        });
      } catch (err: any) {
        console.error('Tool call failed:', err);
        response = await currentChat.sendMessage({
          message: [
             {
               functionResponse: {
                 name: toolCall.name,
                 response: { error: err.message },
               }
             }
          ]
        });
      }
    }

    return response.text || 'Sorry, I got an empty response.';
  }) as Promise<string>;
}
