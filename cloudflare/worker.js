const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-max-age": "86400",
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});
const withCors = (response) => {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};
const safeText = (value, fallback, max) =>
  typeof value === "string" ? value.trim().replace(/[<>]/g, "").slice(0, max) || fallback : fallback;

const GAME_HTML = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101827"><title>WORLDWAR — Online Strategy</title>
<style>
:root{color-scheme:dark;font-family:Inter,system-ui,Arial,sans-serif;background:#0b1220;color:#e8eef9}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at top,#1a2c48,#0b1220 65%);min-height:100vh}.wrap{max-width:1100px;margin:auto;padding:24px}.top{display:flex;align-items:center;justify-content:space-between;gap:12px}.logo{font-size:30px;font-weight:900;letter-spacing:2px;color:#8fc5ff}.tag{color:#9fb0c9;font-size:13px}.panel{background:#131f31;border:1px solid #2a3d58;border-radius:16px;padding:18px;margin:18px 0;box-shadow:0 12px 32px #0004}.row{display:flex;gap:10px;flex-wrap:wrap}input,select,button{font:inherit;border-radius:10px;padding:11px 13px;border:1px solid #344b69;background:#0c1727;color:#edf4ff}input{min-width:0;flex:1}button{background:#2468b5;border-color:#347dce;font-weight:700;cursor:pointer}button:hover{filter:brightness(1.15)}button:disabled{opacity:.5;cursor:not-allowed}.muted{color:#9fb0c9}.rooms{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}.room{background:#0c1727;border:1px solid #2b405c;padding:14px;border-radius:12px}.room strong{display:block;margin-bottom:6px}.game{display:none}.hud{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}.map{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:3px;max-width:800px;margin:auto;background:#0b1422;padding:8px;border-radius:12px}.cell{aspect-ratio:1;border:1px solid #ffffff18;border-radius:4px;background:#26384b;cursor:pointer;min-width:0}.cell:focus{outline:2px solid white}.cell.mine{box-shadow:inset 0 0 0 2px #fff}.notice{min-height:24px;color:#b8d6ff;margin-top:10px}.foot{font-size:12px;color:#8092aa;text-align:center;margin:24px 0}@media(max-width:600px){.wrap{padding:13px}.logo{font-size:24px}.panel{padding:13px}.cell{border-radius:2px;gap:1px}.map{gap:2px;padding:5px}}
</style></head><body><main class="wrap">
<header class="top"><div><div class="logo">WORLDWAR</div><div class="tag">REAL-TIME TERRITORY STRATEGY</div></div><div class="tag" id="connection">● Offline</div></header>
<section id="lobby" class="panel"><h2>Public servers</h2><p class="muted">Create a room or join an open match. Share the room code with friends.</p><div class="row"><input id="player" maxlength="18" placeholder="Your player name" value="Commander"><input id="roomName" maxlength="32" placeholder="Room name" value="New Front"><button id="create">Create room</button></div><div class="notice" id="lobbyNotice"></div><h3>Available rooms</h3><div class="rooms" id="rooms"><p class="muted">Loading rooms…</p></div></section>
<section id="game" class="panel game"><div class="hud"><div><strong id="roomTitle">Room</strong><div class="muted" id="roomCode"></div></div><div><strong id="score">Territory: 0</strong><div class="muted" id="players">Players: 0</div></div><button id="leave" type="button">Leave match</button></div><p class="muted">Tap an adjacent neutral tile or your territory edge to expand. The server validates every move.</p><div id="map" class="map" aria-label="Territory map"></div><div class="notice" id="gameNotice"></div></section>
<div class="foot">WORLDWAR prototype • Multiplayer rooms powered by Cloudflare Durable Objects</div></main>
<script>
const API=location.origin;let socket=null,roomId=null,me=null,state=null;
const el=id=>document.getElementById(id);const say=(id,msg)=>el(id).textContent=msg;
function setOnline(v){say("connection",v?"● Connected":"● Offline");el("connection").style.color=v?"#70e2a2":"#f29a9a"}
async function loadRooms(){try{const r=await fetch(API+"/api/rooms");const d=await r.json();const root=el("rooms");root.replaceChildren();if(!d.rooms?.length){root.innerHTML='<p class="muted">No public rooms yet. Create the first one.</p>';return}for(const room of d.rooms){const card=document.createElement("div");card.className="room";const title=document.createElement("strong");title.textContent=room.name;const meta=document.createElement("div");meta.className="muted";meta.textContent="Code: "+room.id+" · "+(room.players||0)+"/"+room.maxPlayers+" players";const join=document.createElement("button");join.textContent="Join match";join.onclick=()=>joinRoom(room.id,room.name);card.append(title,meta,join);root.append(card)}}catch(e){say("lobbyNotice","Could not load rooms. Check your connection.")}}
async function createRoom(){const name=el("roomName").value.trim()||"New Front";try{const r=await fetch(API+"/api/rooms",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name,maxPlayers:8})});const d=await r.json();if(!r.ok)throw Error(d.error||"Room creation failed");await joinRoom(d.room.id,d.room.name)}catch(e){say("lobbyNotice",e.message)}}
function joinRoom(id,name){if(socket)socket.close();roomId=id;me=el("player").value.trim().slice(0,18)||"Commander";el("lobby").style.display="none";el("game").style.display="block";say("roomTitle",name);say("roomCode","Room code: "+id);say("gameNotice","Connecting…");socket=new WebSocket(API.replace(/^http/,"ws")+"/api/rooms/"+id+"/ws");socket.onopen=()=>{setOnline(true);socket.send(JSON.stringify({type:"join",name:me}))};socket.onmessage=e=>{let msg;try{msg=JSON.parse(e.data)}catch{return}if(msg.type==="state"){state=msg.state;render()}if(msg.type==="error")say("gameNotice",msg.message);if(msg.type==="event"&&msg.event==="winner")say("gameNotice",msg.name+" controls the map!");};socket.onclose=()=>setOnline(false);socket.onerror=()=>say("gameNotice","Connection error. Try rejoining.") ;}
function render(){if(!state)return;const root=el("map");root.replaceChildren();let mine=0;for(let i=0;i<state.cells.length;i++){const owner=state.cells[i];if(owner===state.you)mine++;const b=document.createElement("button");b.className="cell"+(owner===state.you?" mine":"");b.style.background=owner===null?"#26384b":(state.colors[owner]||"#65758b");b.title=owner===null?"Neutral territory":(state.names[owner]||"Player");b.setAttribute("aria-label","Tile "+(i+1));b.onclick=()=>send({type:"expand",cell:i});root.append(b)}say("score","Territory: "+mine);say("players","Players: "+Object.keys(state.names).length);say("gameNotice","Your color: "+(state.colors[state.you]||"waiting"))}
function send(data){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(data))}
function leave(){if(socket)socket.close();socket=null;roomId=null;state=null;el("game").style.display="none";el("lobby").style.display="block";setOnline(false);loadRooms()}
el("create").onclick=createRoom;el("leave").onclick=leave;loadRooms();setInterval(()=>{if(!roomId)loadRooms()},8000);
</script></body></html>`;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/play") {
      return new Response(GAME_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
    }
    if (url.pathname === "/health") return json({ ok: true, service: "WORLDWAR", stage: "playable-multiplayer-prototype" });
    if (url.pathname === "/api/rooms" && request.method === "GET") {
      const registry = env.WORLDWAR_REGISTRY.get(env.WORLDWAR_REGISTRY.idFromName("public"));
      const listed = await registry.fetch("https://registry/list");
      const data = await listed.json();
      const rooms = await Promise.all((data.rooms || []).map(async (entry) => {
        const room = env.WORLDWAR_ROOMS.get(env.WORLDWAR_ROOMS.idFromName(entry.id));
        try {
          const response = await room.fetch("https://room/state");
          const state = await response.json();
          return { ...entry, players: Object.keys(state.players || {}).length };
        } catch { return entry; }
      }));
      return json({ rooms });
    }
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      let input;
      try { input = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
      const maxPlayers = Number(input.maxPlayers ?? 8);
      if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 8) return json({ error: "maxPlayers must be between 2 and 8" }, 400);
      const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const room = { id, name: safeText(input.name, "WORLDWAR room", 40), map: "world", maxPlayers, players: 0, createdAt: Date.now(), status: "waiting" };
      const registry = env.WORLDWAR_REGISTRY.get(env.WORLDWAR_REGISTRY.idFromName("public"));
      const response = await registry.fetch("https://registry/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(room) });
      if (!response.ok) return json({ error: "Could not register room" }, 503);
      const game = env.WORLDWAR_ROOMS.get(env.WORLDWAR_ROOMS.idFromName(id));
      await game.fetch("https://room/configure", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(room) });
      return json({ room, websocket: "/api/rooms/" + id + "/ws" }, 201);
    }
    const match = url.pathname.match(/^\/api\/rooms\/([a-f0-9]{12})(?:\/(ws|state))?$/);
    if (!match) return json({ error: "Not found" }, 404);
    const [, id, action] = match;
    const room = env.WORLDWAR_ROOMS.get(env.WORLDWAR_ROOMS.idFromName(id));
    if (action === "ws") return room.fetch(request);
    if (action === "state" && request.method === "GET") return withCors(await room.fetch("https://room/state"));
    return json({ error: "Not found" }, 404);
  },
};

export class RoomRegistry {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const url = new URL(request.url);
    const rooms = (await this.state.storage.get("rooms")) ?? [];
    if (url.pathname === "/list") return json({ rooms: rooms.filter(r => Date.now() - r.createdAt < 6 * 60 * 60 * 1000) });
    if (url.pathname === "/create" && request.method === "POST") {
      const room = await request.json();
      await this.state.storage.put("rooms", [room, ...rooms.filter(r => r.id !== room.id)].slice(0, 100));
      return json({ ok: true });
    }
    return json({ error: "Not found" }, 404);
  }
}

export class GameRoom {
  constructor(state) { this.state = state; this.roomId = state.id.toString(); }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/configure" && request.method === "POST") {
      const room = await request.json();
      await this.state.storage.put("room", room);
      return json({ ok: true });
    }
    if (url.pathname === "/state") return json(await this.snapshot(null));
    if (request.headers.get("Upgrade") !== "websocket") return json({ error: "WebSocket upgrade required" }, 426);
    const config = await this.state.storage.get("room");
    if (!config) return json({ error: "Room not found" }, 404);
    const current = this.state.getWebSockets();
    if (current.length >= config.maxPlayers) return json({ error: "Room is full" }, 409);
    const pair = new WebSocketPair();
    this.state.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ playerId: null });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  async webSocketMessage(socket, message) {
    if (typeof message !== "string" || message.length > 2048) return;
    let data; try { data = JSON.parse(message); } catch { return; }
    const attachment = socket.deserializeAttachment() || {};
    if (data.type === "join" && !attachment.playerId) {
      const players = (await this.state.storage.get("players")) || {};
      if (Object.keys(players).length >= 8) { socket.send(JSON.stringify({type:"error",message:"Room is full"})); socket.close(1008,"full"); return; }
      const playerId = crypto.randomUUID().slice(0,8);
      const palette = ["#2f8fff","#e35d6a","#e2b84f","#43c49a","#a77be8","#e58c45","#4ec6d8","#d77ab0"];
      players[playerId] = { name: safeText(data.name,"Commander",18), color: palette[Object.keys(players).length % palette.length] };
      attachment.playerId = playerId; socket.serializeAttachment(attachment);
      let cells = await this.state.storage.get("cells");
      if (!cells) { cells = Array(96).fill(null); await this.state.storage.put("cells",cells); }
      const start = (await this.state.storage.get("nextSlot")) || 0;
      const seed = [0,11,84,95,5,90,48,47][start % 8];
      await this.state.storage.put("nextSlot", start + 1);
      if (cells[seed] !== null) {
        const fallback = cells.findIndex((owner) => owner === null);
        if (fallback >= 0) cells[fallback] = playerId;
      } else {
        cells[seed] = playerId;
      }
      await this.state.storage.put("players",players); await this.state.storage.put("cells",cells);
      this.broadcastState();
      return;
    }
    if (data.type === "expand" && attachment.playerId) {
      const cells = (await this.state.storage.get("cells")) || Array(96).fill(null);
      const players = (await this.state.storage.get("players")) || {};
      const id = attachment.playerId, target = Number(data.cell);
      if (!Number.isInteger(target) || target < 0 || target >= 96 || cells[target] !== null) return;
      const neighbors = [target-12,target+12,...(target%12? [target-1]:[]),...(target%12!==11?[target+1]:[])].filter(n=>n>=0&&n<96);
      if (!neighbors.some(n=>cells[n]===id)) return;
      const last = await this.state.storage.get("lastMove:"+id) || 0;
      if (Date.now()-last < 350) return;
      cells[target]=id;
      await this.state.storage.put("cells",cells); await this.state.storage.put("lastMove:"+id,Date.now());
      const owned = cells.filter(x=>x===id).length;
      if (owned >= 48) this.broadcast({type:"event",event:"winner",name:players[id]?.name||"A player"});
      this.broadcastState();
    }
  }
  async webSocketClose(socket) {
    const a=socket.deserializeAttachment()||{};
    if(a.playerId){const players=(await this.state.storage.get("players"))||{};delete players[a.playerId];await this.state.storage.put("players",players);this.broadcastState();}
  }
  async webSocketError(socket) { await this.webSocketClose(socket); }
  async snapshot(you) {
    return { cells:(await this.state.storage.get("cells"))||Array(96).fill(null), players:await this.state.storage.get("players")||{}, you };
  }
  async broadcastState() {
    const players=(await this.state.storage.get("players"))||{};
    const cells=(await this.state.storage.get("cells"))||Array(96).fill(null);
    for(const socket of this.state.getWebSockets()){
      const a=socket.deserializeAttachment()||{};
      const names={},colors={}; for(const [id,p] of Object.entries(players)){names[id]=p.name;colors[id]=p.color;}
      try{socket.send(JSON.stringify({type:"state",state:{cells,players,names,colors,you:a.playerId||null}}));}catch{}
    }
  }
  broadcast(message) { const s=JSON.stringify(message); for(const ws of this.state.getWebSockets()){try{ws.send(s)}catch{}} }
}