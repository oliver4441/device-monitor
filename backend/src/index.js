import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { WebSocketServer } from 'ws';
import http from 'http';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'admin123';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

// ─── Supabase ────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Rate Limiter (in-memory) ───────────────────────────────────────────────
const rateBuckets = new Map();
const RATE_LIMIT = 60; // requests per minute per device
const RATE_WINDOW = 60_000;

function checkRateLimit(deviceId) {
  const now = Date.now();
  let bucket = rateBuckets.get(deviceId);
  if (!bucket || now - bucket.windowStart > RATE_WINDOW) {
    bucket = { count: 0, windowStart: now };
    rateBuckets.set(deviceId, bucket);
  }
  bucket.count++;
  if (bucket.count > RATE_LIMIT) {
    return false;
  }
  return true;
}

// Prune stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateBuckets.entries()) {
    if (now - val.windowStart > RATE_WINDOW * 2) {
      rateBuckets.delete(key);
    }
  }
}, 300_000);

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Simple request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// ─── Auth middlewares ────────────────────────────────────────────────────────
function deviceAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const deviceId = req.headers['x-device-id'];
  if (!authHeader?.startsWith('Bearer ') || !deviceId) {
    return res.status(401).json({ error: 'Missing Bearer token or X-Device-ID header' });
  }
  const apiKey = authHeader.slice(7);
  req.apiKey = apiKey;
  req.deviceId = deviceId;
  next();
}

// ─── POST /api/register ─────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  try {
    const { deviceName } = req.body;
    if (!deviceName) {
      return res.status(400).json({ error: 'deviceName is required' });
    }

    const deviceId = crypto.randomUUID();
    const apiKey = crypto.randomBytes(32).toString('hex');

    const { error } = await supabase.from('devices').insert({
      device_id: deviceId,
      device_name: deviceName,
      api_key: apiKey,
      online: true,
      last_seen: new Date().toISOString(),
    });

    if (error) {
      console.error('Register error:', error);
      return res.status(500).json({ error: 'Failed to register device' });
    }

    console.log(`📱 Device registered: ${deviceId} (${deviceName})`);
    res.status(201).json({ apiKey, deviceId });
  } catch (err) {
    console.error('Register exception:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/data ─────────────────────────────────────────────────────────
app.post('/api/data', deviceAuth, async (req, res) => {
  try {
    // Rate limit
    if (!checkRateLimit(req.deviceId)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    // Verify API key
    const { data: device, error: deviceErr } = await supabase
      .from('devices')
      .select('id')
      .eq('device_id', req.deviceId)
      .eq('api_key', req.apiKey)
      .single();

    if (deviceErr || !device) {
      return res.status(401).json({ error: 'Invalid API key or device ID' });
    }

    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Data must be a JSON object' });
    }

    // Store telemetry
    const { error: insertErr } = await supabase.from('device_data').insert({
      device_id: req.deviceId,
      data,
    });

    if (insertErr) {
      console.error('Data insert error:', insertErr);
      return res.status(500).json({ error: 'Failed to store data' });
    }

    // Update device last_seen and online status
    await supabase
      .from('devices')
      .update({ last_seen: new Date().toISOString(), online: true })
      .eq('device_id', req.deviceId);

    // Broadcast to WebSocket clients
    broadcastToDashboard({
      type: 'device_data',
      deviceId: req.deviceId,
      data,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Data exception:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/commands/:deviceId ───────────────────────────────────────────
app.get('/api/commands/:deviceId', deviceAuth, async (req, res) => {
  try {
    // Verify API key
    const { data: device, error: deviceErr } = await supabase
      .from('devices')
      .select('id')
      .eq('device_id', req.params.deviceId)
      .eq('api_key', req.apiKey)
      .single();

    if (deviceErr || !device) {
      return res.status(401).json({ error: 'Invalid API key or device ID' });
    }

    const { data: commands, error } = await supabase
      .from('commands')
      .select('*')
      .eq('device_id', req.params.deviceId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Commands fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch commands' });
    }

    res.json({ commands: commands || [] });
  } catch (err) {
    console.error('Commands exception:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/commands/:deviceId/ack ──────────────────────────────────────
app.post('/api/commands/:deviceId/ack', deviceAuth, async (req, res) => {
  try {
    const { commandId } = req.body;
    if (!commandId) {
      return res.status(400).json({ error: 'commandId is required' });
    }

    // Verify API key
    const { data: device, error: deviceErr } = await supabase
      .from('devices')
      .select('id')
      .eq('device_id', req.params.deviceId)
      .eq('api_key', req.apiKey)
      .single();

    if (deviceErr || !device) {
      return res.status(401).json({ error: 'Invalid API key or device ID' });
    }

    const { error } = await supabase
      .from('commands')
      .update({ status: 'executed', executed_at: new Date().toISOString() })
      .eq('id', commandId)
      .eq('device_id', req.params.deviceId)
      .eq('status', 'pending');

    if (error) {
      console.error('Command ack error:', error);
      return res.status(500).json({ error: 'Failed to acknowledge command' });
    }

    broadcastToDashboard({
      type: 'command_executed',
      deviceId: req.params.deviceId,
      commandId,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Command ack exception:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/devices ───────────────────────────────────────────────────────
app.get('/api/devices', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('id, device_id, device_name, created_at, last_seen, online')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Devices fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch devices' });
    }

    res.json({ devices: data || [] });
  } catch (err) {
    console.error('Devices exception:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/devices/:deviceId/data ────────────────────────────────────────
app.get('/api/devices/:deviceId/data', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    // Get latest data
    const { data: latest, error: latestErr } = await supabase
      .from('device_data')
      .select('*')
      .eq('device_id', req.params.deviceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get history
    const { data: history, error: histErr, count } = await supabase
      .from('device_data')
      .select('*', { count: 'exact' })
      .eq('device_id', req.params.deviceId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    // Get pending commands
    const { data: commands } = await supabase
      .from('commands')
      .select('*')
      .eq('device_id', req.params.deviceId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (latestErr && latestErr.code !== 'PGRST116') {
      console.error('Latest data error:', latestErr);
    }

    res.json({
      latest: latest || null,
      history: history || [],
      commands: commands || [],
      total: count || 0,
    });
  } catch (err) {
    console.error('Device data exception:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/devices/:deviceId/command ────────────────────────────────────
app.post('/api/devices/:deviceId/command', async (req, res) => {
  try {
    const { command, params = {} } = req.body;
    const validCommands = ['ring', 'lock', 'location', 'wipe', 'screenshot', 'camera', 'reboot'];

    if (!command || !validCommands.includes(command)) {
      return res.status(400).json({
        error: `Invalid command. Valid: ${validCommands.join(', ')}`,
      });
    }

    // Check device exists
    const { data: device, error: deviceErr } = await supabase
      .from('devices')
      .select('id')
      .eq('device_id', req.params.deviceId)
      .single();

    if (deviceErr || !device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const { data, error } = await supabase
      .from('commands')
      .insert({
        device_id: req.params.deviceId,
        command,
        params,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Command insert error:', error);
      return res.status(500).json({ error: 'Failed to create command' });
    }

    broadcastToDashboard({
      type: 'new_command',
      deviceId: req.params.deviceId,
      command,
      commandId: data.id,
    });

    console.log(`📨 Command "${command}" queued for device ${req.params.deviceId}`);
    res.status(201).json({ success: true, commandId: data.id });
  } catch (err) {
    console.error('Command exception:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/apk ───────────────────────────────────────────────────────────
app.get('/api/apk', (req, res) => {
  const apkPath = path.join(__dirname, '../../app/build/outputs/apk/release/app-release.ap');
  res.download(apkPath, 'DeviceMonitor.apk', (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'APK not found. Build the app first.' });
    }
  });
});

// ─── GET /api/health ────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ─── HTTP Server ────────────────────────────────────────────────────────────
const server = http.createServer(app);

// ─── WebSocket Server ───────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });

const wsClients = new Set();

wss.on('connection', (ws) => {
  console.log('🔌 Dashboard WebSocket client connected');
  wsClients.add(ws);
  ws.isAlive = true;

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('close', () => {
    wsClients.delete(ws);
    console.log('🔌 Dashboard WebSocket client disconnected');
  });

  ws.on('error', (err) => {
    console.error('WS error:', err.message);
    wsClients.delete(ws);
  });
});

// Heartbeat to keep connections alive
const heartbeat = setInterval(() => {
  for (const ws of wsClients) {
    if (!ws.isAlive) {
      ws.terminate();
      wsClients.delete(ws);
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);

wss.on('close', () => clearInterval(heartbeat));

function broadcastToDashboard(payload) {
  const message = JSON.stringify(payload);
  for (const ws of wsClients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
}

// ─── Start ──────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║     🖥️  Device Monitor Backend                ║
║     Running on http://localhost:${PORT}          ║
║     WebSocket on ws://localhost:${PORT}/ws        ║
╚═══════════════════════════════════════════════╝
  `);
});

export { app, server };
