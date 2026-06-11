# Simple Stream Core

A multi-source video streaming player built with React, Vite, and Supabase.

Watch YouTube videos, upload local files, or connect RTMP streams — with a custom player UI and live chat overlay.

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

## License

Private — all rights reserved.