import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_DIR = path.join(__dirname, '..', 'users');
const activeSessions = new Map();

export class PairingHandler {

  static createUserDirectory(phone: string) {
    const userDir = path.join(USERS_DIR, `user_${phone}`);
    const authDir = path.join(userDir, 'auth_info');

    if (!fs.existsSync(USERS_DIR)) {
      fs.mkdirSync(USERS_DIR, { recursive: true });
    }

    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    return { userDir, authDir };
  }

  static async generatePairingCode(
    phone: string,
    onCodeGenerated: (code: string) => void,
    onConnected: () => void,
    onError: (error: Error) => void
  ) {
    let attempts = 0;
    const maxAttempts = 5;
    let codeGenerated = false;
    let connectionSuccessful = false;

    const startConnection = async () => {
      attempts++;
      console.log(`[PAIRING] Connection attempt ${attempts}/${maxAttempts} for ${phone}`);

      try {
        const { userDir, authDir } = this.createUserDirectory(phone);

        console.log(`[PAIRING] Loading auth state from: ${authDir}`);
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        console.log(`[PAIRING] Creating WhatsApp socket...`);
        const sock = makeWASocket({
          auth: state,
          logger: pino({ level: 'silent' }),
          browser: ['Ubuntu', 'Chrome', '20.0.04'],
          printQRInTerminal: false,
          version: [2, 3000, 1033893291],
          connectTimeoutMs: 60000,
          defaultQueryTimeoutMs: 60000,
          keepAliveIntervalMs: 10000,
          emitOwnEvents: false,
          markOnlineOnConnect: false,
          syncFullHistory: false,
          shouldIgnoreJid: () => false,
          retryRequestDelayMs: 250,
          maxMsgRetryCount: 5
        });

        console.log(`[PAIRING] Socket created, setting up event listeners...`);

        sock.ev.on('creds.update', () => {
          console.log(`[PAIRING] Credentials updated for ${phone}`);
          saveCreds();
        });

        sock.ev.on('connection.update', async (update) => {
          const { connection, lastDisconnect, qr, isNewLogin } = update;
          const statusCode = lastDisconnect?.error?.output?.statusCode;

          console.log(`[PAIRING] === CONNECTION UPDATE ===`);
          console.log(`[PAIRING] Phone: ${phone}`);
          console.log(`[PAIRING] Connection: ${connection}`);
          console.log(`[PAIRING] Has QR: ${!!qr}`);
          console.log(`[PAIRING] Status Code: ${statusCode}`);
          console.log(`[PAIRING] Is New Login: ${isNewLogin}`);
          console.log(`[PAIRING] Code Generated: ${codeGenerated}`);
          console.log(`[PAIRING] Attempt: ${attempts}/${maxAttempts}`);
          console.log(`[PAIRING] ===========================`);

          if (qr && !codeGenerated) {
            try {
              console.log(`[PAIRING] QR received, requesting pairing code...`);
              const code = await sock.requestPairingCode(phone);
              console.log(`[PAIRING] ✅ Pairing code generated: ${code}`);
              codeGenerated = true;

              activeSessions.set(phone, {
                sock,
                startTime: Date.now(),
                codeGenerated: true,
                connected: false
              });

              onCodeGenerated(code);

            } catch (err: any) {
              console.error(`[PAIRING] ❌ Error requesting code:`, err.message);
              sock.end(undefined);
              activeSessions.delete(phone);
              onError(err);
            }
          }

          if (connection === 'connecting') {
            console.log(`[PAIRING] 🔄 Connecting to WhatsApp servers...`);
          }

          if (connection === 'open') {
            console.log(`[PAIRING] 🎉 CONNECTION SUCCESSFUL for ${phone}!`);
            connectionSuccessful = true;

            const session = activeSessions.get(phone);
            if (session) {
              session.connected = true;
            }

            const botDataPath = path.join(userDir, 'bot_data.json');
            const botData = {
              botOwner: phone,
              customWelcomeMessages: {},
              stickerCommands: {},
              adminSettings: {},
              userWarns: {},
              lastSaved: new Date().toISOString()
            };

            fs.writeFileSync(botDataPath, JSON.stringify(botData, null, 2));
            console.log(`[PAIRING] bot_data.json created`);

            onConnected();

            setTimeout(() => {
              console.log(`[PAIRING] Closing pairing socket...`);
              sock.end(undefined);
              activeSessions.delete(phone);
            }, 3000);
          }

          if (connection === 'close') {
            console.log(`[PAIRING] ⚠️ Connection closed`);
            console.log(`[PAIRING] Status Code: ${statusCode}`);
            console.log(`[PAIRING] Error: ${lastDisconnect?.error?.message || 'None'}`);

            const shouldReconnect =
              statusCode !== DisconnectReason.loggedOut &&
              statusCode !== 401 &&
              !connectionSuccessful &&
              attempts < maxAttempts;

            console.log(`[PAIRING] Should reconnect: ${shouldReconnect}`);

            if (shouldReconnect && codeGenerated) {
              console.log(`[PAIRING] 🔄 Reconnecting in 2 seconds...`);
              setTimeout(() => {
                startConnection();
              }, 2000);
            } else if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
              console.log(`[PAIRING] ❌ Connection rejected/logged out`);
              activeSessions.delete(phone);
              onError(new Error('Connection rejected. Please try again with a fresh pairing code.'));
            } else if (attempts >= maxAttempts) {
              console.log(`[PAIRING] ❌ Max reconnection attempts reached`);
              activeSessions.delete(phone);
              onError(new Error('Max reconnection attempts reached. Please try again.'));
            } else if (!codeGenerated) {
              console.log(`[PAIRING] ❌ Connection closed before code generation`);
              activeSessions.delete(phone);
              onError(new Error('Connection failed before code generation.'));
            }
          }
        });

        sock.ev.on('messages.upsert', () => {
          // Silent handler to keep socket active
        });

        return sock;

      } catch (error: any) {
        console.error(`[PAIRING] ❌ Fatal error in startConnection:`, error.message);
        console.error(`[PAIRING] Stack:`, error.stack);

        if (attempts < maxAttempts && !connectionSuccessful) {
          console.log(`[PAIRING] 🔄 Retrying in 3 seconds...`);
          setTimeout(() => {
            startConnection();
          }, 3000);
        } else {
          onError(error);
        }
      }
    };

    console.log(`[PAIRING] ========================================`);
    console.log(`[PAIRING] Starting pairing process for ${phone}`);
    console.log(`[PAIRING] ========================================`);
    await startConnection();

    setTimeout(() => {
      if (!connectionSuccessful) {
        console.log(`[PAIRING] ⏰ Pairing timeout (5 minutes) for ${phone}`);
        const session = activeSessions.get(phone);
        if (session && session.sock) {
          session.sock.end(undefined);
        }
        activeSessions.delete(phone);

        if (!connectionSuccessful && codeGenerated) {
          onError(new Error('Pairing timeout. Please try again.'));
        }
      }
    }, 300000);
  }

  static checkConnection(phone: string): boolean {
    const userDir = path.join(USERS_DIR, `user_${phone}`);
    const authDir = path.join(userDir, 'auth_info');
    const credsPath = path.join(authDir, 'creds.json');

    if (!fs.existsSync(credsPath)) {
      console.log(`[CHECK] No credentials found for ${phone}`);
      return false;
    }

    try {
      const credsData = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
      const isValid = credsData.me && credsData.me.id;
      console.log(`[CHECK] Connection valid for ${phone}: ${isValid}`);
      return isValid;
    } catch (error: any) {
      console.error(`[CHECK] Error reading credentials for ${phone}:`, error.message);
      return false;
    }
  }

  static deleteUserData(phone: string): boolean {
    const userDir = path.join(USERS_DIR, `user_${phone}`);

    try {
      if (fs.existsSync(userDir)) {
        fs.rmSync(userDir, { recursive: true, force: true });
        console.log(`[DELETE] ✅ Deleted user data for ${phone}`);
        return true;
      }
      console.log(`[DELETE] No data to delete for ${phone}`);
      return false;
    } catch (error: any) {
      console.error(`[DELETE] ❌ Error deleting user data for ${phone}:`, error.message);
      return false;
    }
  }

  static cancelPairing(phone: string): boolean {
    const session = activeSessions.get(phone);
    if (session && session.sock) {
      console.log(`[CANCEL] Cancelling pairing for ${phone}`);
      session.sock.end(undefined);
      activeSessions.delete(phone);
      return true;
    }
    console.log(`[CANCEL] No active pairing session for ${phone}`);
    return false;
  }
}
