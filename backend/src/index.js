import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Dashboard Static Files ──────────────────────────────────────────────────
const dashboardDist = path.join(__dirname, '..', 'public');
const hasDashboard = fs.existsSync(path.join(dashboardDist, 'index.html'));

// ─── Config ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'admin123';

// ─── In-Memory Data Store ────────────────────────────────────────────────────
const devices = new Map();
const deviceData = new Map(); // deviceId -> array of data entries
const commands = new Map();   // deviceId -> array of commands

// Seed some demo devices
const demoDevices = [
  { device_id: 'demo-001', device_name: 'Oliver Phone', online: true, last_seen: new Date().toISOString(), created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
  { device_id: 'demo-002', device_name: 'Emma Laptop', online: true, last_seen: new Date().toISOString(), created_at: new Date(Date.now() - 86400000 * 7).toISOString() },
  { device_id: 'demo-003', device_name: 'Living Room TV', online: false, last_seen: new Date(Date.now() - 3600000).toISOString(), created_at: new Date(Date.now() - 86400000 * 14).toISOString() },
  { device_id: 'demo-004', device_name: 'Office Desktop', online: true, last_seen: new Date().toISOString(), created_at: new Date(Date.now() - 86400000 * 30).toISOString() },
  { device_id: 'demo-005', device_name: 'Garage Camera', online: false, last_seen: new Date(Date.now() - 7200000).toISOString(), created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
];
for (const d of demoDevices) {
  devices.set(d.device_id, { ...d, api_key: crypto.randomBytes(16).toString('hex') });
  deviceData.set(d.device_id, [
    { id: crypto.randomUUID(), device_id: d.device_id, data: { battery: 85, cpu: 42, memory: 61, temp: 36 }, created_at: new Date().toISOString() },
    { id: crypto.randomUUID(), device_id: d.device_id, data: { battery: 82, cpu: 38, memory: 59, temp: 35 }, created_at: new Date(Date.now() - 300000).toISOString() },
    { id: crypto.randomUUID(), device_id: d.device_id, data: { battery: 79, cpu: 55, memory: 63, temp: 38 }, created_at: new Date(Date.now() - 600000).toISOString() },
  ]);
  commands.set(d.device_id, []);
}

// ─── Rate Limiter (in-memory) ───────────────────────────────────────────────
const rateBuckets = new Map();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60_000;

function checkRateLimit(deviceId) {
  const now = Date.now();
  let bucket = rateBuckets.get(deviceId);
  if (!bucket || now - bucket.windowStart > RATE_WINDOW) {
    bucket = { count: 0, windowStart: now };
    rateBuckets.set(deviceId, bucket);
  }
  bucket.count++;
  return bucket.count <= RATE_LIMIT;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateBuckets.entries()) {
    if (now - val.windowStart > RATE_WINDOW * 2) rateBuckets.delete(key);
  }
}, 300_000);

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// ─── Serve Dashboard Static Files ────────────────────────────────────────────
if (hasDashboard) {
  app.use(express.static(dashboardDist));
}

// ─── Auth Middleware ─────────────────────────────────────────────────────────
function deviceAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const deviceId = req.headers['x-device-id'];
  if (!authHeader?.startsWith('Bearer ') || !deviceId) {
    return res.status(401).json({ error: 'Missing Bearer token or X-Device-ID header' });
  }
  req.apiKey = authHeader.slice(7);
  req.deviceId = deviceId;
  next();
}

// ─── POST /api/register ─────────────────────────────────────────────────────
app.post('/api/register', (req, res) => {
  try {
    const { deviceName } = req.body;
    if (!deviceName) return res.status(400).json({ error: 'deviceName is required' });

    const deviceId = crypto.randomUUID();
    const apiKey = crypto.randomBytes(32).toString('hex');
    const device = {
      device_id: deviceId,
      device_name: deviceName,
      api_key: apiKey,
      online: true,
      last_seen: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    devices.set(deviceId, device);
    deviceData.set(deviceId, []);
    commands.set(deviceId, []);

    console.log(`📱 Device registered: ${deviceId} (${deviceName})`);
    res.status(201).json({ apiKey, deviceId });
  } catch (err) {
    console.error('Register exception:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/data ─────────────────────────────────────────────────────────
app.post('/api/data', deviceAuth, (req, res) => {
  try {
    if (!checkRateLimit(req.deviceId)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    const device = devices.get(req.deviceId);
    if (!device || device.api_key !== req.apiKey) {
      return res.status(401).json({ error: 'Invalid API key or device ID' });
    }
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Data must be a JSON object' });
    }

    const entry = { id: crypto.randomUUID(), device_id: req.deviceId, data, created_at: new Date().toISOString() };
    const arr = deviceData.get(req.deviceId) || [];
    arr.unshift(entry);
    if (arr.length > 200) arr.pop(); // keep last 200
    deviceData.set(req.deviceId, arr);

    device.last_seen = new Date().toISOString();
    device.online = true;

    broadcastToDashboard({ type: 'device_data', deviceId: req.deviceId, data, timestamp: entry.created_at });
    res.json({ success: true });
  } catch (err) {
    console.error('Data exception:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/commands/:deviceId ───────────────────────────────────────────
app.get('/api/commands/:deviceId', deviceAuth, (req, res) => {
  try {
    const device = devices.get(req.params.deviceId);
    if (!device || device.api_key !== req.apiKey) {
      return res.status(401).json({ error: 'Invalid API key or device ID' });
    }
    const cmds = (commands.get(req.params.deviceId) || []).filter(c => c.status === 'pending');
    res.json({ commands: cmds });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/commands/:deviceId/ack ──────────────────────────────────────
app.post('/api/commands/:deviceId/ack', deviceAuth, (req, res) => {
  try {
    const { commandId } = req.body;
    if (!commandId) return res.status(400).json({ error: 'commandId is required' });

    const device = devices.get(req.params.deviceId);
    if (!device || device.api_key !== req.apiKey) {
      return res.status(401).json({ error: 'Invalid API key or device ID' });
    }

    const cmds = commands.get(req.params.deviceId) || [];
    const cmd = cmds.find(c => c.id === commandId && c.status === 'pending');
    if (cmd) {
      cmd.status = 'executed';
      cmd.executed_at = new Date().toISOString();
    }

    broadcastToDashboard({ type: 'command_executed', deviceId: req.params.deviceId, commandId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/devices ───────────────────────────────────────────────────────
app.get('/api/devices', (req, res) => {
  const list = Array.from(devices.values()).map(({ api_key, ...rest }) => rest);
  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ devices: list });
});

// ─── GET /api/devices/:deviceId/data ────────────────────────────────────────
app.get('/api/devices/:deviceId/data', (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const all = deviceData.get(req.params.deviceId) || [];
    const latest = all[0] || null;
    const history = all.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    const cmds = (commands.get(req.params.deviceId) || []).slice(-10).reverse();
    res.json({ latest, history, commands: cmds, total: all.length });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/devices/:deviceId/command ────────────────────────────────────
app.post('/api/devices/:deviceId/command', (req, res) => {
  try {
    const { command, params = {} } = req.body;
    const validCommands = ['ring', 'lock', 'location', 'wipe', 'screenshot', 'camera', 'reboot'];
    if (!command || !validCommands.includes(command)) {
      return res.status(400).json({ error: `Invalid command. Valid: ${validCommands.join(', ')}` });
    }
    const device = devices.get(req.params.deviceId);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const cmd = {
      id: crypto.randomUUID(),
      device_id: req.params.deviceId,
      command,
      params,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    const arr = commands.get(req.params.deviceId) || [];
    arr.push(cmd);
    commands.set(req.params.deviceId, arr);

    broadcastToDashboard({ type: 'new_command', deviceId: req.params.deviceId, command, commandId: cmd.id });
    console.log(`📨 Command "${command}" queued for device ${req.params.deviceId}`);
    res.status(201).json({ success: true, commandId: cmd.id });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/health ────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString(), mode: 'in-memory' });
});

// ─── Dashboard SPA Catch-All ───────────────────────────────────────────────
if (hasDashboard) {
  app.get(/^(?!\/api|\/ws).*/, (req, res) => {
    res.sendFile(path.join(dashboardDist, 'index.html'), (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: 'Dashboard not found' });
      }
    });
  });
}

// ─── HTTP + WebSocket ────────────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const wsClients = new Set();

wss.on('connection', (ws) => {
  console.log('🔌 Dashboard WebSocket client connected');
  wsClients.add(ws);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('close', () => { wsClients.delete(ws); console.log('🔌 Dashboard WebSocket client disconnected'); });
  ws.on('error', (err) => { console.error('WS error:', err.message); wsClients.delete(ws); });
});

const heartbeat = setInterval(() => {
  for (const ws of wsClients) {
    if (!ws.isAlive) { ws.terminate(); wsClients.delete(ws); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);
wss.on('close', () => clearInterval(heartbeat));

function broadcastToDashboard(payload) {
  const message = JSON.stringify(payload);
  for (const ws of wsClients) {
    if (ws.readyState === ws.OPEN) ws.send(message);
  }
}

// ─── Start ──────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════════════╗`);
  console.log(`║     🖥️  Device Monitor Backend                ║`);
  console.log(`║     Running on http://localhost:${PORT}          ║`);
  console.log(`║     WebSocket on ws://localhost:${PORT}/ws        ║`);
  console.log(`║     Mode: In-Memory (no database)             ║`);
  console.log(`╚═══════════════════════════════════════════════╝\n`);
});

export { app, server };
