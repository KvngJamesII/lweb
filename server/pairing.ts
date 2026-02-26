import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'path';
import fs from 'fs';

const __dirname = path.resolve();

const USERS_DIR = path.join(__dirname, 'users');
const activeSessions = new Map<string, any>();
const logger = pino({ level: 'silent' });

console.log('[PAIRING] Baileys module pre-loaded');

export class PairingHandler {
  static async generatePairingCode(
    phone: string,
    onCodeGenerated: (code: string) => Promise<void>,
    onConnected: () => Promise<void>,
    onError: (error: Error) => Promise<void>
  ) {
    if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });

    const userDir = path.join(USERS_DIR, `user_${phone}`);
    const authDir = path.join(userDir, 'auth_info');

    if (fs.existsSync(userDir)) {
      fs.rmSync(userDir, { recursive: true, force: true });
    }
    fs.mkdirSync(authDir, { recursive: true });

    let attempts = 0;
    const maxAttempts = 3;
    let codeGenerated = false;
    let connectionSuccessful = false;

    const startConnection = async () => {
      attempts++;
      console.log(`[PAIRING] Attempt ${attempts}/${maxAttempts} for ${phone}`);

      try {
        const { version } = await fetchLatestBaileysVersion();
        if (attempts === 1) console.log(`[PAIRING] WhatsApp version: ${version.join('.')}`);

        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        const sock = makeWASocket({
          auth: state,
          logger,
          printQRInTerminal: false,
          version,
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
          try {
            const { connection, lastDisconnect, qr } = update;
            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;

            console.log(`[PAIRING] conn=${connection} qr=${!!qr} status=${statusCode} codeGen=${codeGenerated}`);

            if (qr && !codeGenerated) {
              try {
                await new Promise(resolve => setTimeout(resolve, 3000));
                const code = await sock.requestPairingCode(phone);
                console.log(`[PAIRING] Code: ${code}`);
                codeGenerated = true;
                activeSessions.set(phone, { sock });
                onCodeGenerated(code);
              } catch (err: any) {
                console.error(`[PAIRING] Code error:`, err.message);
                try { sock.end(undefined); } catch {}
                activeSessions.delete(phone);
                onError(err);
              }
            }

            if (connection === 'open') {
              console.log(`[PAIRING] CONNECTED for ${phone}`);
              connectionSuccessful = true;

              try {
                const botDataPath = path.join(userDir, 'bot_data.json');
                fs.writeFileSync(botDataPath, JSON.stringify({
                  botOwner: phone,
                  lastSaved: new Date().toISOString()
                }, null, 2));
              } catch {}

              onConnected();

              setTimeout(async () => {
                try { sock.end(undefined); } catch {}
                activeSessions.delete(phone);
                await PairingHandler.deployToVPS(phone, authDir);
              }, 3000);
            }

            if (connection === 'close') {
              const shouldReconnect =
                statusCode !== DisconnectReason.loggedOut &&
                statusCode !== 401 &&
                !connectionSuccessful &&
                attempts < maxAttempts;

              if (shouldReconnect && codeGenerated) {
                setTimeout(() => startConnection().catch(() => {}), 2000);
              } else if (!connectionSuccessful && !codeGenerated) {
                onError(new Error('Connection failed.'));
              }
            }
          } catch (err: any) {
            console.error(`[PAIRING] Handler error:`, err.message);
          }
        });

        sock.ev.on('messages.upsert', () => {});

      } catch (error: any) {
        console.error(`[PAIRING] Fatal:`, error.message);
        if (attempts < maxAttempts && !connectionSuccessful) {
          setTimeout(() => startConnection().catch(() => {}), 3000);
        } else {
          onError(error);
        }
      }
    };

    console.log(`[PAIRING] Starting pairing for ${phone}`);
    await startConnection().catch((err) => onError(err));

    setTimeout(() => {
      if (!connectionSuccessful) {
        const session = activeSessions.get(phone);
        if (session?.sock) { try { session.sock.end(undefined); } catch {} }
        activeSessions.delete(phone);
        if (codeGenerated) onError(new Error('Pairing timeout.'));
      }
    }, 300000);
  }

  static async deployToVPS(phone: string, authDir: string): Promise<boolean> {
    const vpsUrl = process.env.VPS_URL;
    const vpsApiKey = process.env.VPS_API_KEY;

    if (!vpsUrl || !vpsApiKey) {
      console.log('[PAIRING] VPS_URL or VPS_API_KEY not set, skipping VPS deployment');
      return false;
    }

    try {
      const authFiles: { name: string; content: string }[] = [];

      function readDirRecursive(dir: string, prefix: string = '') {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            readDirRecursive(fullPath, relativePath);
          } else {
            const content = fs.readFileSync(fullPath);
            authFiles.push({ name: relativePath, content: content.toString('base64') });
          }
        }
      }

      readDirRecursive(authDir);

      console.log(`[VPS] Deploying bot for ${phone} to ${vpsUrl} (${authFiles.length} auth files)...`);

      const response = await fetch(`${vpsUrl}/api/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': vpsApiKey,
        },
        body: JSON.stringify({ phone, authFiles }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log(`[VPS] Bot deployed successfully for ${phone}`);
        return true;
      } else {
        console.error(`[VPS] Deploy failed:`, result.error || result);
        return false;
      }
    } catch (err: any) {
      console.error(`[VPS] Deploy error:`, err.message);
      return false;
    }
  }

  static async vpsRequest(endpoint: string, body?: any): Promise<any> {
    const vpsUrl = process.env.VPS_URL;
    const vpsApiKey = process.env.VPS_API_KEY;

    if (!vpsUrl || !vpsApiKey) return null;

    try {
      const response = await fetch(`${vpsUrl}${endpoint}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': vpsApiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return await response.json();
    } catch (err: any) {
      console.error(`[VPS] Request error (${endpoint}):`, err.message);
      return null;
    }
  }

  static deleteUserData(phone: string): boolean {
    const userDir = path.join(USERS_DIR, `user_${phone}`);
    try {
      if (fs.existsSync(userDir)) { fs.rmSync(userDir, { recursive: true, force: true }); return true; }
      return false;
    } catch { return false; }
  }

  static cancelPairing(phone: string): boolean {
    const session = activeSessions.get(phone);
    if (session?.sock) {
      try { session.sock.end(undefined); } catch {}
      activeSessions.delete(phone);
      return true;
    }
    return false;
  }

  static startBot(phone: string): void {
    PairingHandler.vpsRequest('/api/start-existing', { phone });
  }

  static stopBot(phone: string): void {
    PairingHandler.vpsRequest('/api/stop', { phone });
  }

  static removeBot(phone: string): void {
    PairingHandler.vpsRequest('/api/remove', { phone });
  }
}
