# Implementation Plan: TwitchMIDI Discord Bot

## Overview
A Node.js Discord bot that allows users to query TwitchMIDI/TwitchMIDI+ documentation for free. It uses Gemma 4 31B (`gemma-4-31b-it`, Free Tier via Google AI Studio) as the LLM and connects to the existing MCP server in Kubernetes to retrieve context from the Qdrant vector database. **Authentication for the MCP server is per-user, requiring individuals to provide their own TwitchMIDI credentials to use the bot.**

## Architecture & Layers
1.  **Discord Layer (`discord.js`)**: Listens to channels/DMs, handles user commands, manages "typing" states, and splits long messages.
2.  **Concurrency/Queue Layer (`p-queue`)**: Enforces rate limits (max 15 RPM) to prevent Gemini API blocks.
3.  **Persistence Layer (SQLite/D1)**: Stores user-specific TwitchMIDI credentials (encrypted) and potentially chat history.
4.  **LLM Layer (`@google/genai`)**: Interacts with Gemma 4 31B. Responsible for deciding when to call tools and formatting the final answer.
5.  **MCP Integration Layer (`@modelcontextprotocol/sdk`)**: Bridges Gemini's tool calls to the actual K8s MCP server via SSE. **Sessions are ephemeral and established per-request using user-specific auth.**

## Phase 1: Setup & Infrastructure
1.  **Repository Setup:**
    *   Initialize Node.js project (`pnpm init`).
    *   Enforce `pnpm` v11 in `package.json` (`"packageManager": "pnpm@11.x.x"`).
    *   Install TypeScript, ESLint, Prettier.
    *   Configure `tsconfig.json` for Node.
2.  **Dependencies:**
    *   `pnpm i discord.js @google/genai @modelcontextprotocol/sdk dotenv p-queue better-sqlite3`
    *   `pnpm i -D typescript @types/node tsx @types/better-sqlite3`
3.  **Environment Variables (`.env`):**
    *   `DISCORD_TOKEN`: Bot token from Discord Developer Portal.
    *   `DISCORD_CLIENT_ID`: For registering slash commands.
    *   `GEMINI_API_KEY`: From Google AI Studio.
    *   `MCP_SERVER_URL`: The public endpoint (`https://mcp.twitchmidi.com/mcp`).
    *   `ENCRYPTION_KEY`: A 32-character hex string for encrypting user credentials.

## Phase 2: Core Components

### 2.1 The Persistence System (New)
*   **Database:** Use `better-sqlite3` for local storage or a remote DB if deploying to a cluster with multiple replicas.
*   **Schema:**
    ```sql
    CREATE TABLE users (
      discord_id TEXT PRIMARY KEY,
      twitch_username TEXT NOT NULL,
      license_key_encrypted TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    ```
*   **Security:** NEVER store license keys in plain text. Use `crypto` (AES-256-GCM) to encrypt/decrypt credentials before saving/reading.

### 2.2 User Authentication Command
*   Implement `/auth <username> <license_key>`.
*   **Ease of Use:** Users provide their TwitchMIDI username and license key as separate, plain-text fields. The bot handles the necessary encoding for the MCP server.
*   **Privacy:** This command MUST use `ephemeral: true` so the credentials are not visible to other users in a channel.
*   **Validation:** Optionally attempt a test connection to the MCP server to verify credentials before saving.

### 2.3 The Queue System (Critical)
*   **Caveat:** Gemini Free Tier has a hard limit of 15 Requests Per Minute (RPM). A single user query often requires 2-3 API requests (Initial -> Tool Call -> Final Answer).
*   **Implementation:** Use `p-queue`. Set concurrency to 1 and interval to ensure we don't burst past limits.
    ```typescript
    const apiQueue = new PQueue({ 
      concurrency: 1, 
      intervalCap: 5, // Max 5 complete conversations per minute (assuming 3 reqs each)
      interval: 60000 
    });
    ```
*   **UX:** If the queue is long, the bot must immediately acknowledge the user: *"Your question is queued. I'll answer shortly..."*

### 2.4 Dynamic MCP Client Integration
*   Instead of a single global MCP client, establish connections on-demand (or pool them) using the user's stored credentials.
*   **Authentication:** The public endpoint is protected by a Cloudflare Worker. The HTTP client must inject an `Authorization: Basic <base64>` header, where the credentials are the user's decrypted `twitch_username` and `license_key`.
*   **Flow:**
    1. User asks question.
    2. Bot retrieves credentials from DB.
    3. If no credentials, prompt user to run `/auth`.
    4. establish Streamable HTTP transport with `Authorization` header.
    5. Run Gemini loop with tool calling.

### 2.5 Gemini Tool Calling
*   Map the tools retrieved from the MCP server to Gemini's expected `tools` schema.
*   Implement the chat loop:
    1. Send user message to Gemini.
    2. Check if Gemini response includes a `functionCall`.
    3. If yes, execute the corresponding tool via the MCP Client.
    4. Return the tool result back to Gemini.
    5. Get the final text response.

### 2.6 Discord Integration
*   Register a Slash Command (e.g., `/docs <query>`).
*   Handle message events (if allowing mention-based chats).
*   **Caveat - Discord Message Limits:** Discord limits messages to 2000 characters. Implement a chunking utility to split long Markdown responses from Gemini into multiple consecutive messages.
*   **Caveat - Context Window:** Discord bots don't inherently remember past messages. Maintain an LRU cache (or simple array) of recent message history per user/channel to pass to Gemini so follow-up questions work.

## Phase 3: Deployment (Kubernetes)
1.  **Dockerization:** Create a `Dockerfile` for the bot.
2.  **K8s Manifests (`bot-deployment.yaml`):**
    *   Deploy as a pod in the existing cluster.
    *   **Volume:** Use a `PersistentVolumeClaim` (PVC) if using SQLite to ensure credentials persist across restarts.
3.  **Secrets:** Manage Discord, Gemini, and `ENCRYPTION_KEY` via K8s Secrets.

## Phase 4: Error Handling & Edge Cases
*   **Invalid Auth:** Handle `401 Unauthorized` from the MCP server by notifying the user their credentials might be expired or incorrect.
*   **Rate Limits:** Even with the queue, catch `429` errors from Gemini and backoff gracefully, notifying the user.
*   **Empty Results:** If the MCP search returns nothing, instruct Gemini to say "I couldn't find that in the docs" rather than hallucinating.
*   **MCP Server Down:** Ensure the bot handles connection drops to the MCP server and reconnects automatically.

## Phase 5: Discord Developer Portal Configuration
1.  **Bot Creation:** Create an Application in the [Discord Developer Portal](https://discord.com/developers/applications). Go to the "Bot" tab and enable it.
2.  **Permissions:** Under "OAuth2 > URL Generator", select the `bot` and `applications.commands` scopes. Grant necessary text permissions (e.g., `Send Messages`, `Read Message History`).
3.  **Distribution Link:** Copy the generated OAuth2 URL. This is the public link users will click to invite the bot to their own servers.
4.  **Direct Messages (DMs):** To allow users to chat with the bot privately without a server:
    *   Ensure the bot's intents allow reading direct messages.
    *   Share the bot's Discord Profile link/ID so users can initiate a DM.
    *   Ensure the Node.js code listens to the `Message` event in `DirectMessage` channels, not just guild channels.