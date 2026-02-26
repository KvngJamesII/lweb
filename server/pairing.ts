import { fork, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_DIR = path.join(__dirname, '..', 'users');
const activeWorkers = new Map<string, ChildProcess>();

export class PairingHandler {

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

    console.log(`[PAIRING] ========================================`);
    console.log(`[PAIRING] Starting pairing worker for ${phone}`);
    console.log(`[PAIRING] ========================================`);

    const workerPath = path.join(__dirname, 'pairing-worker.js');
    const worker = fork(workerPath, [], {
      stdio: ['pipe', 'inherit', 'inherit', 'ipc']
    });

    activeWorkers.set(phone, worker);

    worker.on('message', (msg: any) => {
      if (msg.type === 'code') {
        console.log(`[PAIRING] Code received from worker: ${msg.code}`);
        onCodeGenerated(msg.code);
      } else if (msg.type === 'connected') {
        console.log(`[PAIRING] Connection successful from worker`);
        onConnected();
      } else if (msg.type === 'error') {
        console.error(`[PAIRING] Error from worker: ${msg.message}`);
        onError(new Error(msg.message));
      }
    });

    worker.on('exit', (code) => {
      console.log(`[PAIRING] Worker exited with code ${code}`);
      activeWorkers.delete(phone);
    });

    worker.on('error', (err) => {
      console.error(`[PAIRING] Worker error: ${err.message}`);
      activeWorkers.delete(phone);
      onError(err);
    });

    worker.send({ type: 'start', phone });
  }

  static checkConnection(phone: string): boolean {
    const userDir = path.join(USERS_DIR, `user_${phone}`);
    const credsPath = path.join(userDir, 'auth_info', 'creds.json');

    if (!fs.existsSync(credsPath)) return false;

    try {
      const credsData = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
      return !!(credsData.me && credsData.me.id);
    } catch {
      return false;
    }
  }

  static deleteUserData(phone: string): boolean {
    const userDir = path.join(USERS_DIR, `user_${phone}`);
    try {
      if (fs.existsSync(userDir)) {
        fs.rmSync(userDir, { recursive: true, force: true });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  static cancelPairing(phone: string): boolean {
    const worker = activeWorkers.get(phone);
    if (worker) {
      console.log(`[PAIRING] Killing worker for ${phone}`);
      worker.kill();
      activeWorkers.delete(phone);
      return true;
    }
    return false;
  }
}
