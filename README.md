# Adt Bot — Cloudflare Workers

Telegram catalog bot with D1, inline game/developer/version navigation, `/search`, and a password-protected web admin page.

## Important limitation
Telegram Bot API does not expose general channel history. This bot indexes new channel posts received after the webhook is configured. Add the bot as an administrator to the source channel. Old posts need to be re-posted or entered through the admin page.

## Setup
1. Create a D1 database named `adt-bot-db`.
2. Replace `database_id` in `wrangler.toml`.
3. Run `npm install`, then `npx wrangler login`.
4. Set Worker secrets: `npx wrangler secret put BOT_TOKEN`, `ADMIN_PASSWORD`, and `WEBHOOK_SECRET` (run each command separately).
5. Run `npm run db:migrate` and `npm run deploy`.
6. Set Telegram webhook to `https://YOUR-WORKER.workers.dev/telegram/webhook`, using the same `WEBHOOK_SECRET` as Telegram's `secret_token`. Enable `message`, `channel_post`, `callback_query`.

## GitHub Actions
Add repository Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Pushes to `main` validate and deploy the Worker.

Never commit tokens or passwords.
