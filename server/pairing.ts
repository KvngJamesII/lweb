import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_DIR = path.join(__dirname, '..', 'users');
const activeSessions = new Map<string, any>();

export class PairingHandler {

  static createUserDirectory(phone: string) {
    const userDir = path.join(USERS_DIR, `user_${phone}`);
    const authDir = path.join(userDir, 'auth_info');

    if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

    return { userDir, authDir };
  }

  static clearAuthData(phone: string) {
    const userDir = path.join(USERS_DIR, `user_${phone}`);
    const authDir = path.join(userDir, 'auth_info');
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
      console.log(`[PAIRING] Cleared stale auth data for ${phone}`);
    }
  }

  static async generatePairingCode(
    phone: string,
    onCodeGenerated: (code: string) => void,
    onConnected: () => void,
    onError: (error: Error) => void
  ) {
    this.cancelPairing(phone);
    this.clearAuthData(phone);

    let attempts = 0;
    const maxAttempts = 5;
    let codeGenerated = false;
    let connectionSuccessful = false;

    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default;
    const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;
    const pino = (await import('pino')).default;

    let waVersion: [number, number, number] | undefined;
    try {
      const { version } = await fetchLatestBaileysVersion();
      waVersion = version;
      console.log(`[PAIRING] Using WhatsApp version: ${version.join('.')}`);
    } catch (e) {
      console.log(`[PAIRING] Could not fetch latest version, using default`);
    }

    const startConnection = async () => {
      attempts++;
      console.log(`[PAIRING] Connection attempt ${attempts}/${maxAttempts} for ${phone}`);

      try {
        const { userDir, authDir } = this.createUserDirectory(phone);
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        const socketConfig: any = {
          auth: state,
          logger: pino({ level: 'silent' }),
          browser: ['Ubuntu', 'Chrome', '20.0.04'],
          printQRInTerminal: false,
          connectTimeoutMs: 60000,
          defaultQueryTimeoutMs: 60000,
          keepAliveIntervalMs: 10000,
          emitOwnEvents: false,
          markOnlineOnConnect: false,
          syncFullHistory: false,
          shouldIgnoreJid: () => false,
          retryRequestDelayMs: 250,
          maxMsgRetryCount: 5
        };

        if (waVersion) socketConfig.version = waVersion;

        const sock = makeWASocket(socketConfig);

        sock.ev.on('creds.update', () => {
          saveCreds().catch(() => {});
        });

        sock.ev.on('connection.update', async (update: any) => {
          try {
            const { connection, lastDisconnect, qr } = update;
            const statusCode = lastDisconnect?.error?.output?.statusCode;

            console.log(`[PAIRING] Connection: ${connection}, QR: ${!!qr}, Status: ${statusCode}, CodeGen: ${codeGenerated}, Attempt: ${attempts}/${maxAttempts}`);

            if (qr && !codeGenerated) {
              try {
                await new Promise(resolve => setTimeout(resolve, 3000));
                const code = await sock.requestPairingCode(phone);
                console.log(`[PAIRING] Pairing code generated: ${code}`);
                codeGenerated = true;

                activeSessions.set(phone, { sock, startTime: Date.now() });
                onCodeGenerated(code);
              } catch (err: any) {
                console.error(`[PAIRING] Error requesting code:`, err.message);
                try { sock.end(undefined); } catch {}
                activeSessions.delete(phone);
                onError(err);
              }
            }

            if (connection === 'open') {
              console.log(`[PAIRING] CONNECTION SUCCESSFUL for ${phone}!`);
              connectionSuccessful = true;

              try {
                const botDataPath = path.join(userDir, 'bot_data.json');
                fs.writeFileSync(botDataPath, JSON.stringify({
                  botOwner: phone,
                  customWelcomeMessages: {},
                  stickerCommands: {},
                  adminSettings: {},
                  userWarns: {},
                  lastSaved: new Date().toISOString()
                }, null, 2));
              } catch {}

              onConnected();

              setTimeout(() => {
                try { sock.end(undefined); } catch {}
                activeSessions.delete(phone);
              }, 3000);
            }

            if (connection === 'close') {
              console.log(`[PAIRING] Connection closed. Status: ${statusCode}`);

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
            console.error(`[PAIRING] Error in connection handler:`, err.message);
          }
        });

        sock.ev.on('messages.upsert', () => {});

      } catch (error: any) {
        console.error(`[PAIRING] Fatal error:`, error.message);
        if (attempts < maxAttempts && !connectionSuccessful) {
          setTimeout(() => startConnection().catch(() => {}), 3000);
        } else {
          onError(error);
        }
      }
    };

    console.log(`[PAIRING] Starting pairing process for ${phone}`);
    await startConnection().catch((err) => {
      console.error(`[PAIRING] startConnection error:`, err.message);
      onError(err);
    });

    setTimeout(() => {
      if (!connectionSuccessful) {
        const session = activeSessions.get(phone);
        if (session?.sock) { try { session.sock.end(undefined); } catch {} }
        activeSessions.delete(phone);
        if (codeGenerated) onError(new Error('Pairing timeout.'));
      }
    }, 300000);
  }

  static checkConnection(phone: string): boolean {
    const credsPath = path.join(USERS_DIR, `user_${phone}`, 'auth_info', 'creds.json');
    if (!fs.existsSync(credsPath)) return false;
    try {
      const d = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
      return !!(d.me && d.me.id);
    } catch { return false; }
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
}
