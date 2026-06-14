# Privacy Policy

**Last updated: June 14, 2026**

This policy describes what data this Discord bot ("the Bot") collects, how it is used, and your rights.

## 1. Data Collected

When you use `/auth`, the Bot stores:

| Data | Storage | Protection |
|------|---------|------------|
| Discord user ID | SQLite database | Plaintext (public identifier) |
| Email address | SQLite database | AES-256-GCM encrypted |
| TwitchMIDI license key | SQLite database | AES-256-GCM encrypted |

**Conversation history** is held in memory only for the duration of the bot's session (last 10 exchanges). It is not written to disk and is lost on restart.

## 2. How Data Is Used

Stored credentials are used solely to authenticate your requests to the TwitchMIDI documentation service when you use the `/docs` command or message the Bot.

## 3. Data Sharing

Your queries and credentials are shared with:

- **Google Gemini API** — your query text is sent to generate a response
- **TwitchMIDI MCP documentation server** — your credentials are used to authenticate and your query is used to retrieve documentation

No data is sold, rented, or shared for advertising or analytics purposes.

## 4. Data Retention

Your credentials are stored until you delete them. Use `/forget` at any time to permanently delete your Discord ID, email, and license key from the database.

## 5. Security

Credentials are encrypted at rest using AES-256-GCM. Encryption keys are not stored in the database.

## 6. Your Rights

- **Access**: Ask what data is stored about you
- **Deletion**: Use `/forget` to delete all stored data immediately

## 7. Children's Privacy

The Bot is not intended for users under 13. No data is knowingly collected from minors.

## 8. Changes

This policy may be updated. Continued use of the Bot after changes constitutes acceptance.

## 9. Contact

Questions or data requests: info@twitchmidi.com
