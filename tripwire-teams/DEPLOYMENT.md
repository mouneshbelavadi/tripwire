# Tripwire Teams — Production Deployment Guide

This guide walks you through deploying **Tripwire Teams** to production in plain English. 

Tripwire Teams is built with **Node 20+**, **Slack Bolt**, **Express**, **Prisma**, **PostgreSQL**, and **`pg-boss`** (a reliable job queue engine running inside Postgres).

---

## Table of Contents
1. [Architecture & The "Always-Running Worker" Requirement](#1-architecture--the-always-running-worker-requirement)
2. [Database Setup: Neon or Supabase Postgres](#2-database-setup-neon-or-supabase-postgres)
3. [Slack App Configuration: Socket Mode vs. HTTP Mode](#3-slack-app-configuration-socket-mode-vs-http-mode)
4. [Google Cloud Console & OAuth Redirect Settings](#4-google-cloud-console--oauth-redirect-settings)
5. [Step-by-Step Deployment Options](#5-step-by-step-deployment-options)
   - [Option A: Railway (Recommended)](#option-a-railway-recommended)
   - [Option B: Render](#option-b-render)
   - [Option C: Fly.io](#option-c-flyio)
   - [Option D: Traditional VPS (Docker & Caddy/Nginx)](#option-d-traditional-vps-docker--caddynginx)
6. [Required Environment Variables Reference](#6-required-environment-variables-reference)
7. [Post-Deployment Verification & Smoke Testing](#7-post-deployment-verification--smoke-testing)

---

## 1. Architecture & The "Always-Running Worker" Requirement

### Why Serverless Platforms (AWS Lambda, Vercel Functions) Will Not Work
Tripwire Teams schedules background jobs to:
1. Capture predicted baseline commute times the evening before an office day.
2. Run polling sweeps every 5–10 minutes during the morning commute window.
3. Compare live vs. predicted commute times and calculate team-level disruption invariants.

To perform these scheduled tasks reliably without complex third-party SaaS schedulers, Tripwire uses **`pg-boss`**. `pg-boss` uses PostgreSQL as a transactional message queue with advisory locks and worker polling.

> [!IMPORTANT]
> **Serverless runtimes (such as Vercel Serverless Functions, AWS Lambda, or Cloudflare Workers) freeze or terminate their execution environments as soon as an incoming HTTP response is finished.**  
> They cannot maintain persistent background database worker loops, WebSocket listeners, or scheduled timers.  
> 
> Therefore, **Tripwire Teams must be hosted on an always-running container or service** (such as Railway, Render Web Service, Fly.io machine, or a VPS).

---

## 2. Database Setup: Neon or Supabase Postgres

Tripwire requires a PostgreSQL 16 database. Both **Neon** and **Supabase** offer generous free tiers.

### Setting up on Neon (Recommended Serverless Postgres)
1. Go to [neon.tech](https://neon.tech) and create a project (e.g., `tripwire-production`).
2. Select your closest AWS region.
3. In the Neon Dashboard, navigate to **Connection Details**.
4. You will see two connection string variants:
   - **Pooled connection string** (ends with `-pooler.region.neon.tech`).
   - **Direct connection string** (ends with `region.neon.tech`).

> [!TIP]
> **Connection String Configuration:**  
> - For general queries, the pooled string is great.  
> - However, `pg-boss` and Prisma schema migrations (`prisma db push`) perform session-level advisory locks. Use the **direct connection string** (or set `DIRECT_URL` in Prisma) so that advisory locks operate properly.  
> Format:  
> `DATABASE_URL="postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"`

### Setting up on Supabase
1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In **Project Settings -> Database**, locate the **Connection Strings**.
3. Use the **Direct Connection (Port 5432)** for `DATABASE_URL`:  
   `DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"`

### Pushing the Database Schema
Before starting the app for the first time, apply the Prisma schema to create the tables:
```bash
# Push schema directly to your production database
npx prisma db push
```

---

## 3. Slack App Configuration: Socket Mode vs. HTTP Mode

### Local Development vs. Production
- **Local Development (`SLACK_SOCKET_MODE=true`):**  
  Uses Slack Socket Mode via WebSockets. Your local machine connects outward to Slack servers. You do not need a public HTTPS domain or tunneling (like ngrok).
- **Production (`SLACK_SOCKET_MODE=false`):**  
  Slack sends HTTPS POST requests directly to your public server endpoint: `https://your-domain.com/slack/events`.

### Switching to HTTP Mode in the Slack Developer Portal
1. Navigate to your app in the [Slack API Dashboard](https://api.slack.com/apps).
2. Go to **Settings -> Socket Mode**:
   - Toggle **Enable Socket Mode** to **Off**.
3. Go to **Features -> Event Subscriptions**:
   - Toggle **Enable Events** to **On**.
   - In **Request URL**, enter:  
     `https://your-domain.com/slack/events`
   - Slack will send an HTTP POST verification challenge. Once your app is running, Slack will display a green checkmark: *"Verified"*.
   - Under **Subscribe to bot events**, ensure the following events are added:
     - `app_mention`
     - `message.channels`
     - `app_uninstalled`
     - `tokens_revoked`
4. Go to **Features -> Interactivity & Shortcuts**:
   - Toggle **Interactivity** to **On**.
   - In **Request URL**, enter:  
     `https://your-domain.com/slack/events`
5. Go to **Features -> Slash Commands**:
   - Edit the `/tripwire` command:
   - Set **Request URL** to:  
     `https://your-domain.com/slack/events`
6. Go to **Settings -> Basic Information -> App Credentials**:
   - Copy the **Signing Secret** and set it as `SLACK_SIGNING_SECRET` in your server environment.

---

## 4. Google Cloud Console & OAuth Redirect Settings

Tripwire Teams uses three Google APIs:
1. **Routes API** (computes traffic-aware travel durations).
2. **Geocoding API** (converts approximate neighborhood names into coordinates rounded to ~1 km).
3. **Google Calendar API** (creates the office calendar event and automatically adds Google Meet when transitioning to remote).

### Enabling Google APIs
1. Open the [Google Cloud Console](https://console.cloud.google.com).
2. Create or select a project (e.g. `tripwire-teams-prod`).
3. Navigate to **APIs & Services -> Library** and enable:
   - **Routes API** (or Directions API)
   - **Geocoding API**
   - **Google Calendar API**

### Configuring API Key
1. Go to **APIs & Services -> Credentials**.
2. Click **Create Credentials -> API Key**.
3. Restrict this key to the **Routes API** and **Geocoding API**.
4. Set this value as `GOOGLE_MAPS_API_KEY`.

### Configuring OAuth 2.0 Credentials (for Google Calendar & Meet)
1. Go to **APIs & Services -> OAuth consent screen**:
   - Select **User Type: Internal** (if using Google Workspace) or **External**.
   - App Name: `Tripwire Teams`.
   - Authorized domains: `your-domain.com`.
   - Scopes: Add `https://www.googleapis.com/auth/calendar.events` (read/write access to calendar events).
2. Go to **APIs & Services -> Credentials -> Create Credentials -> OAuth client ID**:
   - Application type: **Web application**.
   - Name: `Tripwire Production OAuth Client`.
   - **Authorized redirect URIs**:
     - `https://your-domain.com/auth/google/callback`
     - *(For local dev testing)* `http://localhost:3000/auth/google/callback`
3. Copy the **Client ID** (`GOOGLE_CLIENT_ID`) and **Client Secret** (`GOOGLE_CLIENT_SECRET`).

---

## 5. Step-by-Step Deployment Options

### Option A: Railway (Recommended)
Railway automatically detects the `Dockerfile`, provides persistent workers, and includes optional managed Postgres.

1. Install Railway CLI: `npm install -g @railway/cli` or sign in at [railway.app](https://railway.app).
2. In your terminal:
   ```bash
   cd tripwire-teams
   railway login
   railway init
   ```
3. Set your environment variables in the Railway dashboard or CLI:
   ```bash
   railway variables set NODE_ENV=production
   railway variables set PORT=3000
   railway variables set SLACK_SOCKET_MODE=false
   railway variables set DATABASE_URL="postgresql://..."
   railway variables set SLACK_BOT_TOKEN="xoxb-..."
   railway variables set SLACK_SIGNING_SECRET="..."
   railway variables set GOOGLE_MAPS_API_KEY="..."
   railway variables set GOOGLE_CLIENT_ID="..."
   railway variables set GOOGLE_CLIENT_SECRET="..."
   railway variables set GOOGLE_REDIRECT_URI="https://<your-railway-app>.up.railway.app/auth/google/callback"
   railway variables set ENCRYPTION_KEY="<64-hex-characters>"
   ```
4. Deploy:
   ```bash
   railway up
   ```
5. In **Railway Settings -> Networking**, click **Generate Domain**. Use this domain in your Slack Request URLs.

---

### Option B: Render
1. Sign in to [render.com](https://render.com).
2. Click **New + -> Web Service**.
3. Connect your Git repository.
4. Select **Docker** environment. Render will automatically build using `tripwire-teams/Dockerfile`.
5. Under **Plan**, choose at least the **Starter** tier ($7/mo) to prevent free-tier worker sleep.
6. Under **Environment Variables**, add all keys listed in Section 6.
7. Click **Create Web Service**.
8. Once deployed, copy your `https://your-app.onrender.com` URL to your Slack Event Subscriptions.

---

### Option C: Fly.io
Fly.io runs Docker containers directly on physical micro-VMs around the world.

1. Install `flyctl`: `curl -L https://fly.io/install.sh | sh` (or `winget install flyctl` on Windows).
2. Launch the app config:
   ```bash
   cd tripwire-teams
   fly launch --no-deploy
   ```
3. Set secrets:
   ```bash
   fly secrets set \
     NODE_ENV=production \
     PORT=3000 \
     SLACK_SOCKET_MODE=false \
     DATABASE_URL="postgresql://..." \
     SLACK_BOT_TOKEN="xoxb-..." \
     SLACK_SIGNING_SECRET="..." \
     GOOGLE_MAPS_API_KEY="..." \
     GOOGLE_CLIENT_ID="..." \
     GOOGLE_CLIENT_SECRET="..." \
     GOOGLE_REDIRECT_URI="https://your-app.fly.dev/auth/google/callback" \
     ENCRYPTION_KEY="<64-hex-characters>"
   ```
4. In `fly.toml`, ensure `auto_stop_machines = false` so that the `pg-boss` background worker never sleeps:
   ```toml
   [http_service]
     internal_port = 3000
     force_https = true
     auto_stop_machines = false
     auto_start_machines = true
     min_machines_running = 1
   ```
5. Deploy:
   ```bash
   fly deploy
   ```

---

### Option D: Traditional VPS (Docker & Caddy/Nginx)
If deploying to an Ubuntu VPS (DigitalOcean, Hetzner, AWS EC2):

1. **Install Docker & Docker Compose Plugin**:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
2. **Clone Repository & Configure Environment**:
   ```bash
   git clone https://github.com/your-org/tripwire-teams.git /opt/tripwire-teams
   cd /opt/tripwire-teams
   cp .env.example .env
   nano .env # Fill in production credentials
   ```
3. **Launch Containers**:
   ```bash
   docker compose up -d --build
   ```
4. **Setup Caddy (Automatic SSL Reverse Proxy)**:
   Install Caddy:
   ```bash
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update && sudo apt install caddy
   ```
   Add to `/etc/caddy/Caddyfile`:
   ```caddyfile
   tripwire.yourdomain.com {
       reverse_proxy localhost:3000
   }
   ```
   Reload Caddy:
   ```bash
   sudo systemctl reload caddy
   ```

---

## 6. Required Environment Variables Reference

| Variable | Description | Example / Format |
|---|---|---|
| `NODE_ENV` | Environment identifier | `production` |
| `PORT` | Web server listening port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `SLACK_SOCKET_MODE` | Socket mode vs HTTP webhook | `false` in production |
| `SLACK_BOT_TOKEN` | Slack Bot User OAuth Token | `xoxb-...` |
| `SLACK_SIGNING_SECRET` | Slack verification secret | `7a8b...` (from Slack App Credentials) |
| `SLACK_APP_TOKEN` | Slack App-level token (Only required if `SLACK_SOCKET_MODE=true`) | `xapp-...` |
| `GOOGLE_MAPS_API_KEY` | Google Routes & Geocoding API key | `AIzaSy...` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `123456...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | `GOCSPX-...` |
| `GOOGLE_REDIRECT_URI` | Full public OAuth callback URL | `https://your-domain.com/auth/google/callback` |
| `ENCRYPTION_KEY` | 32-byte hexadecimal key for AES-256-GCM | `openssl rand -hex 32` |

> [!TIP]
> **Generating an Encryption Key:**  
> Run the following command in your terminal to generate a secure 32-byte hex key:  
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## 7. Post-Deployment Verification & Smoke Testing

### 1. Healthcheck Verification
Visit `https://your-domain.com/health` in your browser or run:
```bash
curl -I https://your-domain.com/health
```
Expected response:
```json
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "status": "ok",
  "timestamp": "2026-11-21T19:40:00.000Z",
  "service": "tripwire-teams"
}
```

### 2. Verify Landing Page
Visit `https://your-domain.com/` to view the public landing page, `/privacy` for the Privacy Policy, and `/security` for the Security & Architecture guide.

### 3. Verify Slack Integration
1. In Slack, invite the bot to a channel: `/invite @Tripwire`
2. Run `/tripwire setup` to register an approximate home area and travel mode.
3. Verify that coordinates are saved rounded to ~1 km and encrypted at rest.
4. Run `/tripwire plan` to create a test office day and connect Google Calendar.
5. Confirm that the decision card posts at the scheduled decision time.
