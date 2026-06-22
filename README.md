# 🖥️ Device Monitor — Personal Device Monitoring System

A full-stack personal device monitoring system with an Android app, Node.js backend, and real-time React dashboard.

## Architecture

```
┌──────────────┐     HTTPS/WSS      ┌──────────────┐     Supabase     ┌──────────────┐
│  Android App │ ◄──────────────────► │   Backend    │ ◄──────────────► │   Supabase   │
│   (Kotlin)   │   POST /api/data    │  (Express)   │   PostgreSQL    │  (PostgreSQL) │
│              │   GET /api/commands  │  (Node.js)   │                 │              │
└──────────────┘                      └──────┬───────┘                 └──────────────┘
                                             │
                                    WebSocket │ /ws
                                             │
                                    ┌────────▼───────┐
                                    │   Dashboard    │
                                    │  (React + Vite)│
                                    │  Tailwind CSS  │
                                    └────────────────┘
```

## Features

### Android App
- **Stealth mode** — hides app icon from launcher
- **Background monitoring** — collects device data via WorkManager
- **Data collected**: battery, storage, RAM, network info, installed apps, location, screen state
- **Alarm-based scheduling** — efficient battery usage
- **Boot persistence** — auto-starts on device boot
- **API communication** — sends encrypted data to backend

### Backend (Node.js + Express)
- **Device registration** — generates unique API keys per device
- **Data ingestion** — receives and stores telemetry in Supabase
- **Command queue** — ring, lock, location, wipe, screenshot, camera, reboot
- **WebSocket** — real-time data push to dashboard
- **Rate limiting** — per-device in-memory rate limiter
- **CORS enabled** — for dashboard access

### Dashboard (React + Vite + Tailwind)
- **Dark security operations center theme**
- **Device list** — sidebar with online/offline status
- **Device details** — battery, storage, network, system info, installed apps
- **Interactive map** — Leaflet/OpenStreetMap with device markers
- **Command panel** — send remote commands with confirmation
- **Real-time updates** — WebSocket with polling fallback
- **APK download** — direct download from dashboard
- **Mobile responsive** — collapsible sidebar

## Quick Start

### Prerequisites
- Node.js 18+
- Android Studio (for building APK)
- Supabase account (free tier works)

### 1. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration:
   ```bash
   # Copy contents of backend/src/migrations.sql and run it
   ```
3. Get your **Project URL** and **service_role key** from Settings → API

### 2. Configure Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your Supabase credentials
```

`.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3000
DASHBOARD_PASSWORD=your-secure-password
```

### 3. Start Backend

```bash
cd backend
npm install
npm start
# Server runs on http://localhost:3000
```

### 4. Start Dashboard

```bash
cd dashboard
npm install
npm run dev
# Dashboard at http://localhost:5173
```

### 5. Build Android APK

```bash
cd ..
# Open in Android Studio and build, or:
./gradlew assembleRelease
# APK at app/build/outputs/apk/release/app-release.ap
```

### 6. Install & Register

1. Install APK on target Android device
2. Open the app, grant permissions
3. The device auto-registers with the backend
4. View in dashboard at `http://localhost:5173`

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/register` | None | Register new device |
| POST | `/api/data` | Bearer + X-Device-ID | Submit telemetry |
| GET | `/api/commands/:deviceId` | Bearer + X-Device-ID | Get pending commands |
| POST | `/api/commands/:deviceId/ack` | Bearer + X-Device-ID | Acknowledge command |
| GET | `/api/devices` | None | List all devices |
| GET | `/api/devices/:deviceId/data` | None | Get device data + history |
| POST | `/api/devices/:deviceId/command` | None | Send command to device |
| GET | `/api/apk` | None | Download APK |
| WS | `/ws` | None | Real-time dashboard updates |

## Database Schema

### `devices`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| device_id | TEXT | Unique device identifier |
| device_name | TEXT | Human-readable name |
| api_key | TEXT | Authentication key |
| created_at | TIMESTAMPTZ | Registration time |
| last_seen | TIMESTAMPTZ | Last data received |
| online | BOOLEAN | Current status |

### `device_data`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| device_id | TEXT | References devices |
| data | JSONB | Telemetry payload |
| created_at | TIMESTAMPTZ | Received time |

### `commands`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| device_id | TEXT | Target device |
| command | TEXT | Command type |
| params | JSONB | Command parameters |
| status | TEXT | pending/executed/failed |
| created_at | TIMESTAMPTZ | Created time |
| executed_at | TIMESTAMPTZ | Executed time |

## Available Commands

| Command | Description | Risk |
|---------|-------------|------|
| `ring` | Ring device for 30 seconds | Low |
| `lock` | Lock device screen | Medium |
| `location` | Request GPS coordinates | Low |
| `screenshot` | Capture screen | Medium |
| `camera` | Take photo with rear camera | Medium |
| `reboot` | Restart device | High |
| `wipe` | Factory reset (IRREVERSIBLE) | Critical |

## Project Structure

```
device-monitor/
├── README.md
├── build.gradle.kts              # Project-level Gradle
├── settings.gradle.kts           # Gradle settings
├── gradle.properties             # Gradle properties
├── app/
│   ├── build.gradle.kts          # App-level Gradle
│   ├── proguard-rules.pro        # ProGuard rules
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/monitor/
│       │   ├── MainActivity.kt
│       │   ├── model/DeviceData.kt
│       │   ├── receiver/
│       │   │   ├── AlarmReceiver.kt
│       │   │   └── BootReceiver.kt
│       │   ├── service/MonitorService.kt
│       │   └── util/
│       │       ├── ApiClient.kt
│       │       ├── DeviceCollector.kt
│       │       ├── PrefsManager.kt
│       │       └── StealthManager.kt
│       └── res/
│           ├── layout/
│           ├── values/
│           └── xml/
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js              # Express server
│       └── migrations.sql        # Database schema
├── dashboard/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── components/
│       │   ├── DeviceList.jsx
│       │   ├── DeviceMap.jsx
│       │   ├── DeviceDetails.jsx
│       │   ├── CommandPanel.jsx
│       │   ├── APKDownload.jsx
│       │   └── Login.jsx
│       └── hooks/
│           ├── useDevices.js
│           └── useDeviceData.js
└── apk-download.html              # Standalone APK download page
```

## Security Considerations

⚠️ **This is a personal monitoring tool. Use responsibly and legally.**

- API keys are generated with `crypto.randomBytes(32)` — 256-bit entropy
- Rate limiting prevents abuse (60 req/min per device)
- Dashboard has password authentication
- All communication should use HTTPS in production
- Service role key should be kept secret
- Consider adding JWT-based auth for production use

## Production Deployment

### Backend (Docker)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --production
COPY backend/ .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

### Dashboard
```bash
cd dashboard
npm run build
# Serve dist/ with nginx or any static host
```

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `PORT` | No | Server port (default: 3000) |
| `DASHBOARD_PASSWORD` | No | Dashboard login password |

## License

MIT License — use at your own risk.
