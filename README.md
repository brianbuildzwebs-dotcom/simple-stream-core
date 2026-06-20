# Simple Stream Core

A multi-source video streaming player built with React, Vite, and Supabase.

Watch YouTube videos, upload local files, or connect RTMP streams — with a custom player UI and live chat overlay.

## Project home

| | |
|---|---|
| **Local folder** | `C:\Users\Brian\Documents\simple-stream-core` |
| **GitHub** | [brianbuildzwebs-dotcom/simple-stream-core](https://github.com/brianbuildzwebs-dotcom/simple-stream-core) |
| **Production** | https://simple-stream-core.brianbuildzwebs.workers.dev |
| **Cloudflare Worker** | `simple-stream-core` (Workers Builds on push to `main`) |
| **Sentry** | [simple-webz / simple-stream-core](https://simple-webz.sentry.io/issues/?project=simple-stream-core) |

Open this folder in Cursor/Grok to continue edits. Sentry and Cloudflare are already configured — push to `main` to deploy.

## Production

| | URL |
|---|---|
| **Live site** | https://simple-stream-core.brianbuildzwebs.workers.dev |
| **Embed** | https://simple-stream-core.brianbuildzwebs.workers.dev/embed |
| **YouTube LIVE API** | https://simple-stream-core.brianbuildzwebs.workers.dev/api/youtube-live |

Deployed via Cloudflare Workers Builds from `main` (`brianbuildzwebs-dotcom/simple-stream-core`).

## Features

- **YouTube** — embed videos and playlists via URL
- **File upload** — play local MP4/WebM/OGG files
- **RTMP** — Cloudflare Stream ingest via OBS, HLS playback in browser
- **Live chat** — real-time messages via Supabase
- **Admin dashboard** — player settings, chat moderation, banned users

## Tech Stack

- React 18 + Vite 6
- Tailwind CSS + shadcn/ui
- Supabase (Auth, Realtime, PostgreSQL)
- Framer Motion

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### Setup

```bash
git clone https://github.com/brianbuildzwebs-dotcom/simple-stream-core.git
cd simple-stream-core
npm install
```

Copy the environment template and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Find these values in your Supabase dashboard under **Settings → API**.

### Database setup

1. Open your Supabase project → **SQL Editor** → **New query**
2. Paste and run the migration files (in order):
   - `supabase/migrations/20260610000000_initial_schema.sql`
   - `supabase/migrations/20260610000001_player_settings_realtime.sql`
   - `supabase/migrations/20260610000002_complete_partial_setup.sql`
   - `supabase/migrations/20260610000003_fix_messages_columns.sql`
   - `supabase/migrations/20260610000004_align_messages_schema.sql` (fixes chat if sends fail)
   - `supabase/migrations/20260610000005_messages_source_key.sql` (separate chat per video/stream URL)
3. Register an account in the app
4. Promote yourself to admin by running `supabase/seed_admin.sql` (update the email first)

This creates four tables:

| Table | Purpose |
|---|---|
| `profiles` | User roles (`viewer` / `admin`) |
| `player_settings` | Branding, chat toggle, profanity filter |
| `messages` | Live chat messages |
| `banned_users` | Chat ban list |

### RTMP live stream test (OBS + Cloudflare)

Browsers cannot play raw RTMP. This app plays the **HLS output** from Cloudflare Stream while you **ingest via RTMP** in OBS.

1. In [Cloudflare Stream](https://dash.cloudflare.com/) → **Live inputs** → create or open a live input
2. Copy the **RTMP URL**, **Stream key**, and **HLS playback URL** (manifest)
3. Add to `.env.local`:
   ```env
   VITE_RTMP_SERVER_URL=rtmps://live.cloudflare.com:443/live/
   VITE_RTMP_STREAM_KEY=your-stream-key
   VITE_RTMP_HLS_URL=https://customer-xxx.cloudflarestream.com/xxx/manifest/video.m3u8
   ```
4. Restart `npm run dev`
5. In OBS → **Settings → Stream** → Service: **Custom**
   - Server: your `VITE_RTMP_SERVER_URL`
   - Stream key: your `VITE_RTMP_STREAM_KEY`
6. In the app → **RTMP Stream** tab → **Connect**
7. Click **Start Streaming** in OBS — the player should show **LIVE**

### Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Routes

| Path | Page | Access |
|---|---|---|
| `/` | Home (player) | Public |
| `/embed` | Embeddable player | Public |
| `/login` | Sign in | Public |
| `/register` | Create account | Public |
| `/forgot-password` | Password reset email | Public |
| `/reset-password` | Set new password | Public |
| `/admin` | Admin dashboard | Admin only |

### Build

```bash
npm run build
npm run preview
```

### Deploy to Cloudflare Pages

The app is set up for [Cloudflare Pages](https://pages.cloudflare.com/) with a Pages Function at `/api/youtube-live` (playlist LIVE badge detection).

#### Option A — Git deploy (recommended)

Cloudflare now uses **Workers Builds** (Settings → **Builds** on your Worker). "Connect your Worker to a Git repository" is the right place.

1. Push this repo to GitHub
2. Cloudflare dashboard → **Workers & Pages** → **Create application** → **Import a repository** (or open your existing Worker → **Settings** → **Builds** → **Connect**)
3. Select **`simple-stream-core`** and confirm the Worker name matches `wrangler.toml` (`simple-stream-core`)
4. Use these build settings:

| Setting | Value |
|---|---|
| Git branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npm run deploy:ci` (uses `--old-asset-ttl 0` to clear stale assets) |
| Root directory | `/` (blank) |

5. Under **Build variables and secrets** (build-time), add at least:

| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | From Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Yes | Anon/public key |
| `VITE_RTMP_STREAM_KEY` | Optional | Default RTMP key in the player |
| `VITE_RTMP_HLS_URL` | Optional | Default HLS manifest URL |
| `VITE_RTMP_SERVER_URL` | Optional | Defaults to Cloudflare RTMPS |
| `VITE_RTMP_CUSTOMER_CODE` | Optional | Builds HLS URL from stream key |
| `VITE_YOUTUBE_API_KEY` | Optional | Extra LIVE detection via YouTube Data API |

6. Save and **Retry deployment** (or push to `main`).

> **LIVE badges:** `/api/youtube-live` fetches a public Innertube key from YouTube automatically. You do **not** need to hunt for it in DevTools. Optional override: set runtime secret `YOUTUBE_INNERTUBE_KEY` under **Variables & Secrets**.

> **Build failed?** Open **Deployments** → failed build → **View build log**. Common fixes: Worker name mismatch, missing `VITE_SUPABASE_*` build variables, or `NODE_VERSION=20` (Wrangler 4 needs **Node 22** — set `NODE_VERSION=22` or remove the override). Run `scripts/setup-workers-builds.ps1` for the checklist.

#### Option B — CLI deploy

```bash
npm install
npx wrangler login
npm run deploy
```

Preview the production build locally (static + API function):

```bash
npm run build
npx wrangler dev
```

#### After deploy

- Home player: `https://your-project.pages.dev/`
- Embed: `https://your-project.pages.dev/embed?...`
- YouTube embeds require **HTTPS** (Pages provides this)
- Add a custom domain under **Pages → Custom domains** if needed

## Project Structure

```
src/
├── components/
│   ├── player/     # VideoPlayer, SourceSelector, ChatOverlay
│   ├── admin/      # Settings, moderation, bans
│   └── ui/         # shadcn/ui primitives
├── pages/          # Home, Embed, Auth, Admin
├── lib/
│   ├── supabase.js # Shared Supabase client
│   └── AuthContext.jsx
└── main.jsx        # App entry point
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript check |
| `npm run deploy` | Build and deploy to Cloudflare Workers |
| `npm run pages:deploy` | Alias for `npm run deploy` |

## License

Private — all rights reserved.