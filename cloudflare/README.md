# WORLDWAR Cloudflare backend foundation

This folder contains an initial Cloudflare Workers + Durable Objects backend foundation.

## Free-tier intent
- Uses Workers and Durable Objects only.
- No paid add-ons, custom domain, or billing activation is required.
- Free-plan quotas and limits apply; traffic above quota may be rejected.

## Deploy
```sh
npx wrangler deploy --config wrangler.toml
```

## Endpoints
- `GET /health` — deployment health.
- `GET /api/rooms` — public room registry.
- `POST /api/rooms` — create a room (JSON: name, map, maxPlayers).
- `GET /api/rooms/:id/state` — room presence.
- `GET /api/rooms/:id/ws` — WebSocket relay.

## Important status
This is infrastructure groundwork, **not a playable game server yet**. The current game server uses Node.js cluster processes, Express, the `ws` package, and a binary game protocol. Those systems are not wired into this Durable Objects relay. A later migration must connect the real game simulation, authentication, lobby browser, and client protocol before advertising WORLDWAR as playable.

The upstream project's required license and copyright notices remain in place.
