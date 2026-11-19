# WORLDWAR Cloudflare prototype

This branch contains a free-tier-oriented browser prototype backed by Cloudflare Workers and Durable Objects.

## Play
Open the deployed Worker root URL. The browser interface supports:
- Creating public rooms and browsing recent rooms
- Joining a room over WebSocket
- A shared 12 × 8 territory map
- Server-validated expansion into adjacent neutral tiles
- Player names, colors, room capacity, and a territory win condition

## API
- `GET /health` — deployment health/version marker
- `GET /api/rooms` — recent public rooms with live player counts
- `POST /api/rooms` — create a room (JSON: `name`, optional `maxPlayers`, 2–8)
- `GET /api/rooms/:id/state` — current room state
- `GET /api/rooms/:id/ws` — WebSocket game connection

## Deploy
```sh
npx wrangler deploy --config wrangler.toml
```

## Current scope and limitations
This is a playable multiplayer prototype, not yet a complete port of the original OpenFront-style game engine. It currently implements a compact territory-expansion game rather than the full original simulation, maps, diplomacy, economy, matchmaking, account system, ranked play, or mobile/desktop feature parity. The existing Node.js cluster server and binary game protocol have not been migrated into Durable Objects.

Cloudflare free-plan quotas and limits apply; usage above free allowances may be throttled or rejected. No paid add-ons, custom domain, or billing activation are required by this prototype. Do not enable paid services without an explicit decision.

The upstream project's required license and copyright notices must remain visible. This repository is a fork/rewrite and must comply with its AGPL-3.0 and asset license obligations.
