const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.BOT_MANAGER_PORT || 3500;
const API_KEY = process.env.BOT_MANAGER_API_KEY;
const BOTS_DIR = path.join(__dirname, 'bots');
const BOT_SCRIPT = path.join(__dirname, 'bot.cjs');

if (!API_KEY) {
  console.error('[FATAL] BOT_MANAGER_API_KEY environment variable is required');
  process.exit(1);
}

if (!fs.existsSync(BOTS_DIR)) {
  fs.mkdirSync(BOTS_DIR, { recursive: true });
}

const activeBots = new Map();

function authMiddleware(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function getBotDir(phone) {
  return path.join(BOTS_DIR, `bot_${phone}`);
}

function startBotProcess(phone) {
  const botDir = getBotDir(phone);
  const authDir = path.join(botDir, 'auth_info');

  if (!fs.existsSync(authDir)) {
    console.log(`[BOT] No auth_info for ${phone}, cannot start`);
    return false;
  }

  if (activeBots.has(phone)) {
    const existing = activeBots.get(phone);
    if (existing.process && !existing.process.killed) {
      console.log(`[BOT] Bot for ${phone} already running (pid: ${existing.process.pid})`);
      return true;
    }
  }

  console.log(`[BOT] Starting bot for ${phone}...`);

  const child = spawn('node', [BOT_SCRIPT], {
    cwd: botDir,
    env: {
      ...process.env,
      BOT_OWNER: phone,
      YOUTUBE_DL_SKIP_PYTHON_CHECK: '1',
      BOT_AUTH_DIR: authDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      console.log(`[BOT:${phone}] ${line}`);
    }
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      console.error(`[BOT-ERR:${phone}] ${line}`);
    }
  });

  child.on('exit', (code, signal) => {
    console.log(`[BOT] Bot for ${phone} exited (code: ${code}, signal: ${signal})`);
    const bot = activeBots.get(phone);
    if (bot) {
      bot.status = 'stopped';
      bot.process = null;
      bot.exitCode = code;
      bot.stoppedAt = new Date().toISOString();

      if (code !== 0 && code !== null && !bot.manualStop) {
        const restartCount = (bot.restartCount || 0) + 1;
        if (restartCount <= 5) {
          const delay = Math.min(restartCount * 5000, 30000);
          console.log(`[BOT] Auto-restarting bot for ${phone} in ${delay / 1000}s (attempt ${restartCount})`);
          bot.restartCount = restartCount;
          setTimeout(() => {
            if (activeBots.has(phone) && activeBots.get(phone).status === 'stopped') {
              startBotProcess(phone);
            }
          }, delay);
        } else {
          console.log(`[BOT] Bot for ${phone} exceeded restart limit`);
        }
      }
    }
  });

  activeBots.set(phone, {
    process: child,
    pid: child.pid,
    phone,
    status: 'running',
    startedAt: new Date().toISOString(),
    restartCount: 0,
    manualStop: false,
  });

  return true;
}

function stopBotProcess(phone) {
  const bot = activeBots.get(phone);
  if (!bot || !bot.process || bot.process.killed) {
    return false;
  }
  bot.manualStop = true;
  bot.process.kill('SIGTERM');

  setTimeout(() => {
    if (bot.process && !bot.process.killed) {
      bot.process.kill('SIGKILL');
    }
  }, 5000);

  return true;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', activeBots: activeBots.size });
});

app.post('/api/deploy', authMiddleware, async (req, res) => {
  try {
    const { phone, authFiles } = req.body;

    if (!phone || !authFiles || !Array.isArray(authFiles)) {
      return res.status(400).json({ error: 'Missing phone or authFiles' });
    }

    const botDir = getBotDir(phone);
    const authDir = path.join(botDir, 'auth_info');

    if (activeBots.has(phone)) {
      stopBotProcess(phone);
      await new Promise(r => setTimeout(r, 2000));
    }

    if (fs.existsSync(botDir)) {
      fs.rmSync(botDir, { recursive: true, force: true });
    }
    fs.mkdirSync(authDir, { recursive: true });

    for (const file of authFiles) {
      const filePath = path.join(authDir, file.name);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, Buffer.from(file.content, 'base64'));
    }

    const botData = { botOwner: phone, deployedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(botDir, 'bot_data.json'), JSON.stringify(botData, null, 2));

    const started = startBotProcess(phone);

    console.log(`[DEPLOY] Bot deployed for ${phone}, started: ${started}`);
    res.json({ success: true, started, phone });
  } catch (err) {
    console.error('[DEPLOY] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stop', authMiddleware, (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Missing phone' });

  const stopped = stopBotProcess(phone);
  res.json({ success: stopped, phone });
});

app.post('/api/restart', authMiddleware, (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Missing phone' });

  stopBotProcess(phone);
  setTimeout(() => {
    const started = startBotProcess(phone);
    res.json({ success: started, phone });
  }, 2000);
});

app.post('/api/remove', authMiddleware, (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Missing phone' });

  stopBotProcess(phone);

  setTimeout(() => {
    const botDir = getBotDir(phone);
    if (fs.existsSync(botDir)) {
      fs.rmSync(botDir, { recursive: true, force: true });
    }
    activeBots.delete(phone);
    res.json({ success: true, phone });
  }, 2000);
});

app.get('/api/status', authMiddleware, (req, res) => {
  const { phone } = req.query;

  if (phone) {
    const bot = activeBots.get(phone);
    if (!bot) return res.json({ status: 'not_found', phone });
    return res.json({
      phone: bot.phone,
      status: bot.status,
      pid: bot.pid,
      startedAt: bot.startedAt,
      stoppedAt: bot.stoppedAt || null,
    });
  }

  const bots = [];
  for (const [ph, bot] of activeBots) {
    bots.push({
      phone: ph,
      status: bot.status,
      pid: bot.pid,
      startedAt: bot.startedAt,
    });
  }
  res.json({ totalBots: bots.length, bots });
});

app.get('/api/system', authMiddleware, (req, res) => {
  const os = require('os');
  const memUsage = process.memoryUsage();

  res.json({
    memory: {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      systemTotal: os.totalmem(),
      systemFree: os.freemem(),
    },
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0]?.model || 'Unknown',
      loadAverage: os.loadavg(),
    },
    uptime: process.uptime(),
    platform: os.platform(),
    nodeVersion: process.version,
    activeBots: activeBots.size,
    runningBots: [...activeBots.values()].filter(b => b.status === 'running').length,
  });
});

app.post('/api/start-existing', authMiddleware, (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Missing phone' });

  const started = startBotProcess(phone);
  res.json({ success: started, phone });
});

function startAllExistingBots() {
  if (!fs.existsSync(BOTS_DIR)) return;

  const dirs = fs.readdirSync(BOTS_DIR, { withFileTypes: true });
  let count = 0;

  for (const dir of dirs) {
    if (!dir.isDirectory() || !dir.name.startsWith('bot_')) continue;
    const phone = dir.name.replace('bot_', '');
    const authDir = path.join(BOTS_DIR, dir.name, 'auth_info');

    if (fs.existsSync(authDir)) {
      setTimeout(() => {
        startBotProcess(phone);
      }, count * 3000);
      count++;
    }
  }

  if (count > 0) {
    console.log(`[STARTUP] Queued ${count} bots for startup (staggered 3s apart)`);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[BOT-MANAGER] Running on port ${PORT}`);
  console.log(`[BOT-MANAGER] Bots directory: ${BOTS_DIR}`);

  setTimeout(() => {
    startAllExistingBots();
  }, 2000);
});
