const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const USERS_DIR = path.join(__dirname, '..', 'users');

process.on('uncaughtException', (err) => {
  console.error('[WORKER] Uncaught exception:', err.message);
  process.send({ type: 'error', message: err.message });
});

process.on('unhandledRejection', (reason) => {
  console.error('[WORKER] Unhandled rejection:', reason?.message || reason);
  process.send({ type: 'error', message: String(reason?.message || reason) });
});

function createUserDirectory(phone) {
  const userDir = path.join(USERS_DIR, `user_${phone}`);
  const authDir = path.join(userDir, 'auth_info');

  if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  return { userDir, authDir };
}

process.on('message', async (msg) => {
  if (msg.type !== 'start') return;

  const phone = msg.phone;
  let attempts = 0;
  const maxAttempts = 5;
  let codeGenerated = false;
  let connectionSuccessful = false;

  let waVersion;
  try {
    const { version } = await fetchLatestBaileysVersion();
    waVersion = version;
    console.log(`[WORKER] Using WhatsApp version: ${version.join('.')}`);
  } catch (e) {
    console.log(`[WORKER] Could not fetch latest version, using default`);
  }

  const startConnection = async () => {
    attempts++;
    console.log(`[WORKER] Connection attempt ${attempts}/${maxAttempts} for ${phone}`);

    try {
      const { userDir, authDir } = createUserDirectory(phone);
      const { state, saveCreds } = await useMultiFileAuthState(authDir);

      const socketConfig = {
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
        console.log(`[WORKER] Credentials updated for ${phone}`);
        saveCreds();
      });

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        const statusCode = lastDisconnect?.error?.output?.statusCode;

        console.log(`[WORKER] Connection: ${connection}, QR: ${!!qr}, Status: ${statusCode}, CodeGen: ${codeGenerated}, Attempt: ${attempts}/${maxAttempts}`);

        if (qr && !codeGenerated) {
          try {
            console.log(`[WORKER] QR received, waiting 3s before requesting pairing code...`);
            await new Promise(resolve => setTimeout(resolve, 3000));

            const code = await sock.requestPairingCode(phone);
            console.log(`[WORKER] Pairing code generated: ${code}`);
            codeGenerated = true;
            process.send({ type: 'code', code });
          } catch (err) {
            console.error(`[WORKER] Error requesting code:`, err.message);
            sock.end(undefined);
            process.send({ type: 'error', message: err.message });
          }
        }

        if (connection === 'open') {
          console.log(`[WORKER] CONNECTION SUCCESSFUL for ${phone}!`);
          connectionSuccessful = true;

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

          process.send({ type: 'connected' });

          setTimeout(() => {
            sock.end(undefined);
            process.exit(0);
          }, 3000);
        }

        if (connection === 'close') {
          console.log(`[WORKER] Connection closed. Status: ${statusCode}`);

          const shouldReconnect =
            statusCode !== DisconnectReason.loggedOut &&
            statusCode !== 401 &&
            !connectionSuccessful &&
            attempts < maxAttempts;

          if (shouldReconnect && codeGenerated) {
            console.log(`[WORKER] Reconnecting in 2 seconds...`);
            setTimeout(() => startConnection(), 2000);
          } else if (!connectionSuccessful) {
            process.send({ type: 'error', message: 'Connection failed.' });
          }
        }
      });

      sock.ev.on('messages.upsert', () => {});

    } catch (error) {
      console.error(`[WORKER] Fatal error:`, error.message);
      if (attempts < maxAttempts && !connectionSuccessful) {
        setTimeout(() => startConnection(), 3000);
      } else {
        process.send({ type: 'error', message: error.message });
      }
    }
  };

  await startConnection();

  setTimeout(() => {
    if (!connectionSuccessful) {
      process.send({ type: 'error', message: 'Pairing timeout (5 minutes).' });
      process.exit(1);
    }
  }, 300000);
});
