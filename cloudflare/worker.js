const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});
const safeText = (value, fallback, max) =>
  typeof value === "string" ? value.trim().slice(0, max) || fallback : fallback;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json({ ok: true, service: "WORLDWAR", stage: "multiplayer-backend-foundation" });
    }
    if (url.pathname === "/api/rooms" && request.method === "GET") {
      const registry = env.WORLDWAR_REGISTRY.get(env.WORLDWAR_REGISTRY.idFromName("public"));
      return registry.fetch("https://registry/list");
    }
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      let input;
      try { input = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
      const maxPlayers = Number(input.maxPlayers ?? 8);
      if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 32) {
        return json({ error: "maxPlayers must be between 2 and 32" }, 400);
      }
      const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const room = {
        id, name: safeText(input.name, "WORLDWAR room", 40),
        map: safeText(input.map, "world", 24), maxPlayers, players: 0,
        createdAt: Date.now(), status: "waiting",
      };
      const registry = env.WORLDWAR_REGISTRY.get(env.WORLDWAR_REGISTRY.idFromName("public"));
      const response = await registry.fetch("https://registry/create", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(room),
      });
      if (!response.ok) return json({ error: "Could not register room" }, 503);
      return json({ room, websocket: `/api/rooms/${id}/ws` }, 201);
    }
    const match = url.pathname.match(/^\\/api\\/rooms\\/([a-f0-9]{12})(?:\\/(ws|state))?$/);
    if (!match) return json({ error: "Not found" }, 404);
    const [, id, action] = match;
    const room = env.WORLDWAR_ROOMS.get(env.WORLDWAR_ROOMS.idFromName(id));
    if (action === "ws") return room.fetch(request);
    if (action === "state" && request.method === "GET") return room.fetch("https://room/state");
    return json({ error: "Not found" }, 404);
  },
};

export class RoomRegistry {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const url = new URL(request.url);
    const rooms = (await this.state.storage.get("rooms")) ?? [];
    if (url.pathname === "/list") {
      return json({ rooms: rooms.filter(r => Date.now() - r.createdAt < 6 * 60 * 60 * 1000) });
    }
    if (url.pathname === "/create" && request.method === "POST") {
      const room = await request.json();
      const next = [room, ...rooms.filter(r => r.id !== room.id)].slice(0, 100);
      await this.state.storage.put("rooms", next);
      return json({ ok: true });
    }
    return json({ error: "Not found" }, 404);
  }
}

export class GameRoom {
  constructor(state) { this.state = state; this.roomId = state.id.toString(); }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/state") {
      const sockets = this.state.getWebSockets();
      return json({ players: sockets.length, status: sockets.length > 1 ? "playing" : "waiting" });
    }
    if (request.headers.get("Upgrade") !== "websocket") return json({ error: "WebSocket upgrade required" }, 426);
    const sockets = this.state.getWebSockets();
    if (sockets.length >= 32) return json({ error: "Room is full" }, 409);
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    server.send(JSON.stringify({ type: "connected", roomId: this.roomId, players: sockets.length + 1 }));
    this.broadcast({ type: "presence", players: sockets.length + 1 });
    return new Response(null, { status: 101, webSocket: client });
  }
  webSocketMessage(_socket, message) {
    if (typeof message !== "string" || message.length > 4096) return;
    let parsed;
    try { parsed = JSON.parse(message); } catch { return; }
    this.broadcast({ type: "message", data: parsed });
  }
  webSocketClose() { this.broadcast({ type: "presence", players: this.state.getWebSockets().length }); }
  webSocketError() { this.broadcast({ type: "presence", players: this.state.getWebSockets().length }); }
  broadcast(message) {
    const encoded = JSON.stringify(message);
    for (const socket of this.state.getWebSockets()) {
      try { socket.send(encoded); } catch { /* closed socket */ }
    }
  }
}
