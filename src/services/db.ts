import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'bot.db');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || Buffer.from(ENCRYPTION_KEY, 'hex').length !== 32) {
  console.warn('WARNING: ENCRYPTION_KEY is missing or not a 32-byte hex string. Please configure it securely.');
}

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    discord_id TEXT PRIMARY KEY,
    email_encrypted TEXT NOT NULL,
    license_key_encrypted TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const ALGORITHM = 'aes-256-gcm';

function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY not configured');
  const iv = crypto.randomBytes(12);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY not configured');
  const [ivHex, authTagHex, encryptedData] = encryptedText.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export const dbService = {
  saveUserCredentials(discordId: string, email: string, licenseKey: string) {
    const encryptedEmail = encrypt(email);
    const encryptedKey = encrypt(licenseKey);
    const stmt = db.prepare(`
      INSERT INTO users (discord_id, email_encrypted, license_key_encrypted)
      VALUES (?, ?, ?)
      ON CONFLICT(discord_id) DO UPDATE SET
        email_encrypted = excluded.email_encrypted,
        license_key_encrypted = excluded.license_key_encrypted
    `);
    stmt.run(discordId, encryptedEmail, encryptedKey);
  },

  getUserCredentials(discordId: string): { email: string; licenseKey: string } | null {
    const stmt = db.prepare('SELECT email_encrypted, license_key_encrypted FROM users WHERE discord_id = ?');
    const row = stmt.get(discordId) as { email_encrypted: string; license_key_encrypted: string } | undefined;

    if (!row) return null;

    try {
      return {
        email: decrypt(row.email_encrypted),
        licenseKey: decrypt(row.license_key_encrypted),
      };
    } catch (err) {
      console.error(`Failed to decrypt credentials for user ${discordId}:`, err);
      return null;
    }
  },

  deleteUserCredentials(discordId: string): boolean {
    const stmt = db.prepare('DELETE FROM users WHERE discord_id = ?');
    const result = stmt.run(discordId);
    return result.changes > 0;
  }
};
