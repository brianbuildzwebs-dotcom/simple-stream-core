@echo off
cd /d "%~dp0.."
echo.
echo Paste your Stripe SECRET key when prompted (sk_test_...).
echo Get it from Stripe: Developers -^> API keys -^> Secret key -^> Reveal
echo.
npx wrangler secret put STRIPE_SECRET_KEY
echo.
echo Verify at: https://simple-stream-core.brianbuildzwebs.workers.dev/api/auth/status
echo stripe_key_format_valid should be true
echo.
pause