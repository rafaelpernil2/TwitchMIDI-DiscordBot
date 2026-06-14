import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export class MCPService {
  public client: Client;
  private transport: StreamableHTTPClientTransport | null = null;

  constructor() {
    this.client = new Client(
      {
        name: 'discord-bot-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );
  }

  async connect(username: string, licenseKey: string) {
    const url = process.env.MCP_SERVER_URL;
    if (!url) throw new Error('MCP_SERVER_URL is not defined');

    const authHeader = Buffer.from(`${username}:${licenseKey}`).toString('base64');

    const mcpUrl = new URL(url);

    this.transport = new StreamableHTTPClientTransport(mcpUrl, {
        requestInit: {
            headers: { Authorization: `Basic ${authHeader}` }
        }
    });

    await this.client.connect(this.transport);
    console.log(`Connected to MCP Server for user ${username}`);
  }

  async getTools() {
    const response = await this.client.listTools();
    return response.tools;
  }

  async callTool(name: string, args: Record<string, any>) {
    return this.client.callTool({
      name,
      arguments: args,
    });
  }
}
