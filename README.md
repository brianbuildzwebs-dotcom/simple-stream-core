# Simple Stream Core

A multi-source video streaming player built with React, Vite, and Supabase.

Watch YouTube videos, upload local files, or connect RTMP streams — with a custom player UI and live chat overlay.

## Features

- **YouTube** — embed videos and playlists via URL
- **File upload** — play local MP4/WebM/OGG files
- **RTMP** — stream key input (playback UI scaffolded)
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

### Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

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