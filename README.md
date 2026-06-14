# TwitchMIDI+ Discord Bot

Discord bot that answers TwitchMIDI and TwitchMIDI+ documentation questions using AI. Powered by Gemma 4 31B via Google AI Studio (free tier) and the TwitchMIDI+ MCP server.

## Commands

| Command | Description |
|---|---|
| `/auth email: license_key:` | Link your TwitchMIDI+ license (required once before use) |
| `/docs query:` | Ask a question about TwitchMIDI or TwitchMIDI+ |
| `/forget` | Delete your stored credentials and conversation history |

## Setup

### Prerequisites

- Node.js 22+
- pnpm 11
- A Discord application with a bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- A Google AI Studio API key ([aistudio.google.com](https://aistudio.google.com))
- A TwitchMIDI+ MCP server endpoint

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
DISCORD_TOKEN=          # Bot token from Discord Developer Portal
DISCORD_CLIENT_ID=      # Application ID
GEMINI_API_KEY=         # Google AI Studio API key
MCP_SERVER_URL=         # TwitchMIDI+ MCP endpoint
ENCRYPTION_KEY=         # 32-byte hex string (openssl rand -hex 32)
```

### Install & Run

```bash
pnpm install
pnpm run register   # Register slash commands with Discord (run once, or after command changes)
pnpm start          # Start the bot
```

For development with auto-reload:
```bash
pnpm dev
```

### Build

```bash
pnpm build          # Compiles TypeScript to dist/
```

## Docker

```bash
docker build -t twitchmidi-discordbot .
docker run --env-file .env twitchmidi-discordbot
```

## Kubernetes

Manifests are in `k8s/`. The bot uses a PersistentVolumeClaim for the SQLite database.

```bash
kubectl apply -f k8s/bot-deployment.yaml
```

Secrets (`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `GEMINI_API_KEY`, `ENCRYPTION_KEY`) must be created as a Kubernetes secret named `twitchmidi-bot-secrets` in the `twitchmidi` namespace before deploying.

## Architecture

- **Discord layer** — `discord.js`, handles slash commands and DMs/mentions
- **LLM layer** — Gemma 4 31B via `@google/genai`, tool-calling loop
- **MCP layer** — connects to TwitchMIDI+ MCP server per-request using user credentials
- **Persistence** — SQLite via `better-sqlite3`; email and license key encrypted at rest (AES-256-GCM)
- **Queue** — `p-queue` enforces free-tier Gemini rate limits (~5 conversations/min)

## Notes

- Global slash commands take up to 1 hour to propagate after running `pnpm register`
- Users must share a server with the bot before they can DM it
- DB schema is created automatically on first run; delete `data/bot.db` to reset
