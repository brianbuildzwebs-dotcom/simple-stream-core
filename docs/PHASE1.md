# Phase 1 — Simple Streamz platform merge

Phase 1 ports the Base44 seller app shell into `simple-stream-core` and rebrands to **Simple Streamz**.

## What's included

- Marketing **Home**, **Pricing**, and **Paywall** pages
- Authenticated **Dashboard** shell with trial banner and stats
- **AppLayout** sidebar (dashboard, stream keys, embed manager nav)
- Supabase schema for subscriptions, tiers, stream keys, embeds
- **10-day free trial** via `init_user_subscription()` RPC
- **Stripe Checkout** (test mode) via Worker `/api/stripe/checkout`

## What's deferred (Phase 2+)

- Stream key generation + Cloudflare Stream API
- Embed Manager → tracked embed codes on `/embed`
- Seller admin panel (users, subscriptions, whitelist)
- Stripe webhook → auto-activate subscriptions

## Database setup

Run all migrations in order, including:

```
supabase/migrations/20260614000000_seller_platform_phase1.sql
```

This creates `subscription_tiers`, `user_subscriptions`, `stream_keys`, `embed_instances`, seeds three pricing tiers, and adds the trial RPC.

## Environment variables

### Frontend (`.env.local`)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Cloudflare Worker secrets

Set via `wrangler secret put <NAME>` or Workers dashboard:

| Secret | Purpose |
|--------|---------|
| `SUPABASE_URL` | Same project URL as `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | Verify user JWT on checkout |
| `SUPABASE_SERVICE_ROLE_KEY` | Load tier data for checkout |
| `STRIPE_SECRET_KEY` | `sk_test_...` for test checkout |

Optional: set `stripe_price_id` on each `subscription_tiers` row after creating Products/Prices in Stripe Dashboard. If empty, checkout uses dynamic `price_data`.

## Routes

| Path | Description |
|------|-------------|
| `/` | Marketing home + demo player |
| `/pricing` | Tier cards from Supabase |
| `/register` | Sign up → redirects to `/dashboard` |
| `/dashboard` | Seller dashboard shell |
| `/dashboard/streams` | Phase 2 placeholder |
| `/dashboard/embeds` | Phase 2 placeholder |
| `/paywall` | Trial expired upgrade screen |
| `/embed` | Existing embed player (unchanged) |
| `/play` | Dev player lab (old home) |
| `/admin` | Chat moderation admin (unchanged) |

## Trial flow

1. User registers via Supabase Auth
2. First visit to `/dashboard` calls `init_user_subscription()`
3. RPC creates a 10-day trial if none exists
4. `useSubscription` computes days remaining client-side
5. Expired trials redirect to `/paywall`

## Stripe test checkout

1. Log in and open `/pricing`
2. Click **Upgrade with Stripe** on a tier
3. Worker creates a Checkout Session and redirects to Stripe
4. Use [Stripe test cards](https://docs.stripe.com/testing#cards) (e.g. `4242 4242 4242 4242`)

Webhook handling to mark `user_subscriptions.is_paid = true` is Phase 2. Until then, subscriptions stay on trial status after checkout.

## Branding

App name constant: `src/lib/brand.js` → `APP_NAME = 'Simple Streamz'`