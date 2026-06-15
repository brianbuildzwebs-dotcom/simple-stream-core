# Phase 2 — Stream Keys, Embed Manager, Cloudflare Stream

## What's included

- **Stream Keys** (`/dashboard/streams`) — creates Cloudflare Stream live inputs per key
- **Embed Manager** (`/dashboard/embeds`) — tracked embed codes with watermark + domain rules
- **Tracked embeds** — `/embed?code=TRACKING_CODE` resolves source via Worker API
- **View counting** — increments `total_views` on embed load

## Database migration

Run in Supabase SQL Editor:

```
supabase/migrations/20260615000000_phase2_stream_keys.sql
```

Adds `cloudflare_input_id` and `hls_playback_url` to `stream_keys`.

## Worker secrets (required for stream key creation)

```bash
wrangler secret put CLOUDFLARE_ACCOUNT_ID
wrangler secret put CLOUDFLARE_API_TOKEN
wrangler secret put CLOUDFLARE_STREAM_CUSTOMER_CODE
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

| Secret | Where to find it |
|--------|------------------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → right sidebar on any zone |
| `CLOUDFLARE_API_TOKEN` | My Profile → API Tokens — needs **Stream → Edit** |
| `CLOUDFLARE_STREAM_CUSTOMER_CODE` | Stream → any live input → HLS URL: `customer-XXXXXXXX.cloudflarestream.com` |

Also keep existing `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## User flow

1. **Dashboard → Stream Keys** → create a key (calls Cloudflare API)
2. Copy RTMP server + stream key into OBS
3. **Dashboard → Embed Manager** → create embed (YouTube URL or RTMP stream key)
4. Copy iframe code → paste on your site
5. Embed loads at `/embed?code=...` with HLS playback (not raw RTMP)

## API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/stream-keys` | POST | Create stream key (auth required) |
| `/api/stream-keys?id=` | DELETE | Delete stream key + CF live input |
| `/api/stream-keys/refresh` | POST | Regenerate CF credentials |
| `/api/embed/config?code=` | GET | Public embed source resolver |
| `/api/embed/view` | POST | Increment view count |

## Tier limits

Stream key creation respects `subscription_tiers.max_stream_keys` when the user has an assigned tier. Default limit is **1** without a tier assignment.

## Embed iframe format

Responsive 16:9 iframe (no fixed 800×450):

```html
<iframe src="https://simple-stream-core.brianbuildzwebs.workers.dev/embed?code=YOUR_CODE" title="Simple Streamz Player" width="100%" style="width:100%;aspect-ratio:16/9;border:0;border-radius:12px;overflow:hidden;" allowfullscreen allow="autoplay; encrypted-media; fullscreen"></iframe>
```