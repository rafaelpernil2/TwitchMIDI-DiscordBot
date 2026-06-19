# CLAUDE.md

Discord bot that answers TwitchMIDI / TwitchMIDI+ documentation questions. Per-user RAG over the official docs (via MCP) fed to a Gemma model, with short conversation memory.

## Commands

```bash
pnpm install        # install deps (packageManager: pnpm@11)
pnpm start          # run bot (tsx src/index.ts)
pnpm dev            # run bot with watch/reload
pnpm build          # tsc -> dist/
pnpm register       # push slash commands to Discord (run after adding/changing a command)
npx tsc --noEmit    # typecheck
```

There are no automated tests.

## Architecture

Single long-running Node process (`src/index.ts`) holding one Discord gateway connection.

- `src/index.ts` — Discord client + interaction/message handlers. Owns the in-memory `userHistories` map (per-user conversation memory, capped at `MAX_HISTORY_LENGTH = 10` turns). Triggers: slash commands and `MessageCreate` (DMs or @-mentions).
- `src/register-commands.ts` — declares the slash commands and registers them with Discord. **Separate process** — adding a command here requires running `pnpm register` for it to appear.
- `src/services/mcp.ts` — `MCPService`: connects to the RAG MCP server over Streamable HTTP. Auth is HTTP Basic `email:licenseKey`. A new instance is created and connected **per request** with that user's credentials.
- `src/services/llm.ts` — `askGemini`: manual RAG. Retrieves doc chunks via MCP, injects them as context, calls Gemma. Rate-limited and retried (see Gotchas).
- `src/services/db.ts` — `dbService`: SQLite (better-sqlite3) storing per-user credentials, AES-256-GCM encrypted at rest. Conversation history is NOT persisted here — it lives only in `userHistories` and dies on restart.
- `src/utils/` — `chunk.ts` (split replies under Discord's 2000-char limit), `sanitize.ts` (clean model output for Discord).

### Request flow (`/docs` or mention)
1. Load user creds from `db` (reject if not authenticated).
2. New `MCPService`, connect with creds.
3. `retrieveDocs` → top-K chunks, injected into the prompt.
4. `askGemini` → Gemma plain-text answer (no tools attached).
5. Push user+model turns into `userHistories`, trim to last 10.
6. `sanitizeForDiscord` + `chunkMessage`, reply (first chunk edits the "queued" message, rest via follow-ups).

## Slash commands

- `/auth <email> <license_key>` — validate against MCP, store encrypted creds.
- `/docs <query>` — ask a docs question.
- `/forget` — delete stored creds **and** conversation history.
- `/clear` — clear conversation history only; keep creds.

## Gotchas

- **Gemma has no function-calling round-trip.** The model can emit a `functionCall`, but sending the `functionResponse` back 500s (`ApiError INTERNAL`). That is why RAG is done manually in `llm.ts` instead of letting the model call MCP tools. Do not reintroduce tool-calling for Gemma.
- **Gemma 500 INTERNAL is non-deterministic.** Same prompt can fail then succeed; bigger payloads fail more. `askGemini` retries up to `MAX_RETRIES` with backoff. Larger `DOC_TOP_K` raises the failure rate. (The MCP-redeploy de-auth 500 is a different, non-retryable case → exhausts retries → friendly error.)
- **Rate limit.** `llmQueue` (p-queue) enforces concurrency 1, 5 queries/minute. Keep it.
- **Single instance only.** k8s `Deployment` uses `strategy: Recreate`, not RollingUpdate — two pods = two gateway connections = duplicate replies. Also matches the ReadWriteOnce SQLite PVC. Keep replicas at 1.
- **History is in-memory.** A restart wipes all conversation memory; creds survive in SQLite.
- **Adding a command is two edits + a deploy step:** declare in `register-commands.ts`, handle in `index.ts`, then `pnpm register`.

## Environment

`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `GEMINI_API_KEY`, `ENCRYPTION_KEY` (32-byte hex), `MCP_SERVER_URL`, `DB_PATH`. In production these come from the `twitchmidi-bot-secrets` secret / `k8s/bot-deployment.yaml`; locally from `.env`.
