# Documentation Plan: TwitchMIDI+ Discord Bot

> Hand this file to the documentation agent. Sections marked [TBD] need info from the agent before writing.

---

## Pages to Create / Update

| Page | Action | Location |
|---|---|---|
| Intro / Overview page | Update — add Discord Bot as free alternative to Claude MCP | Intro section, after Claude MCP mention |
| "Discord Bot" | Create new | Guides section |

---

## What to Document

### 1. Update: Intro / Overview Page

**Where:** Find the section describing the Claude MCP integration. Add a callout or paragraph immediately after it.

**Write:**
- Introduce the Discord Bot as a free alternative for users without a Claude subscription or who don't want to configure MCP
- Link to the new Guides > Discord Bot page
- Be honest about downsides vs Claude MCP:
  - Shared rate limit (~5 queries/min across all users) — may queue during busy periods
  - Conversational memory limited to last 10 messages per user
  - Docs-only: cannot control TwitchMIDI or take any actions
  - Requires adding the bot to a Discord server before use

---

### 2. Create: Guides > "Discord Bot" Page

Full standalone guide page. All sections below go on this page.

**Tone:** Beginner-friendly. Users are streamers, not developers.

---

#### 2.1 Overview

**Write:**
- The bot is a free AI assistant that answers questions about TwitchMIDI and TwitchMIDI+ documentation
- Powered by Gemma 4 31B (Google AI Studio free tier)
- Uses the same documentation index as the Claude MCP integration
- Requires a valid TwitchMIDI+ license to authenticate
- Users add the bot to any Discord server they own — there is no central server to join

---

#### 2.2 Getting Access — Adding the Bot

**Write:**
- Add the bot (`TwitchMIDI Docs#9567`) to any Discord server where the user has "Manage Server" permission
- Most users already have a personal/friends server they can use
- Install link: https://discord.com/oauth2/authorize?client_id=1515526135247798292&permissions=67584&integration_type=0&scope=bot+applications.commands
- After adding it to a server, users can also DM the bot directly: https://discord.com/users/1515526135247798292

**Steps (numbered):**
1. Click the install link and pick a server you own
2. Authorize the bot (`bot` + `applications.commands` scopes)
3. Use `/auth` once in any channel to link your TwitchMIDI+ license
4. Ask questions with `/docs`, or DM the bot via https://discord.com/users/1515526135247798292

**Note on DMs:** Discord only allows DMing a bot once you share a server with it. Adding the bot to any server unlocks DM access.

---

#### 2.3 Authentication — `/auth` Command

**Write:**
- Bot requires TwitchMIDI+ credentials to access docs (per-user, not shared)
- Credentials are encrypted and stored securely; never visible to other users
- Must authenticate once before using `/docs` or DM chat
- Uses the same email and license key from the TwitchMIDI+ purchase — users already have these

**Command:**
```
/auth email:<your_email> license_key:<your_license_key>
```

- `email`: The email used to purchase TwitchMIDI+
- `license_key`: The license key received after purchase (also used for TwitchMIDI+ desktop tools)
- Reply is ephemeral (only visible to the user who ran the command)
- If credentials are wrong, bot will say so immediately

---

#### 2.4 Asking Questions — `/docs` Command

**Write:**
- Ask any question about TwitchMIDI or TwitchMIDI+ features, commands, configuration, etc.
- Bot searches the official documentation and answers using AI
- If the question can't be answered from docs, bot will say so (no hallucinations)
- Long answers are split into multiple messages automatically

**Command:**
```
/docs query:<your question>
```

**Examples:**
```
/docs query:How do I add a MIDI device?
/docs query:What is the !tmvolume command?
/docs query:How do I configure TwitchMIDI+ with OBS?
```

---

#### 2.5 DM Chat

**Write:**
- Users can DM the bot directly for a private, conversational experience
- Bot remembers the last 10 messages per user (conversation context)
- Must have run `/auth` at least once before DM chat works
- Can also @mention the bot in server channels to chat inline

---

#### 2.6 Limitations

**Write honestly:**
- **Rate limit:** Bot processes ~5 questions per minute across all users (free tier Gemini quota). Questions may be queued during busy periods — bot will acknowledge with "Your question is queued..."
- **Authentication required:** No anonymous queries. TwitchMIDI+ license needed.
- **Docs only:** Bot answers from documentation only. It cannot control TwitchMIDI, modify settings, or interact with Twitch on your behalf.
- **DM requires shared server:** To DM the bot, you must first add it to at least one server you share with it.
- **License required to use, not to add:** Anyone (e.g. a mod) can add the bot to a server, but only users with a valid TwitchMIDI+ license can authenticate and ask questions.

---

#### 2.7 Troubleshooting

| Problem | Fix |
|---|---|
| "You must authenticate first" | Run `/auth` with your credentials |
| "Authentication failed" | Check email and license key — same ones used for TwitchMIDI+ tools |
| Bot not responding | May be queued — wait a moment and try again |
| `/docs` or `/forget` not showing in Discord | Restart Discord (Ctrl+R) to refresh slash command cache |
| Re-authenticated but still failing | Run `/forget` then `/auth` again |

---

#### 2.8 Privacy & Security

**Write:**
- Both email and license key are encrypted with AES-256-GCM before storage
- Credentials are never shown in chat (ephemeral replies)
- Credentials are stored only to authenticate documentation queries
- **Right to deletion:** Run `/forget` at any time to permanently delete stored credentials and conversation history

#### 2.8b Deleting Your Data — `/forget` Command

**Write:**
- Deletes stored email, license key, and conversation history from the bot
- Takes effect immediately
- User can re-authenticate later with `/auth` if they want to use the bot again

**Command:**
```
/forget
```

---

## Info Still Needed from Agent

- [ ] Exact location/slug of the Claude MCP integration section in the intro (for the callout placement)
- [ ] Docs site slug for the new guide page (e.g. `guides/discord-bot`)
