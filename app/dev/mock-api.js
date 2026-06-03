const http = require("http");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 8080);
const now = () => new Date().toISOString();

const tags = [
  { id: 1, name: "Late Night", type: "\u573a\u666f" },
  { id: 2, name: "Dream Pop", type: "\u98ce\u683c" },
  { id: 3, name: "Warm", type: "\u60c5\u7eea" },
  { id: 4, name: "Synth", type: "\u5176\u4ed6" },
  { id: 5, name: "Focus", type: "\u573a\u666f" },
  { id: 6, name: "Soft Pulse", type: "\u60c5\u7eea" }
];

const user = {
  id: 1,
  account_id: "demo",
  display_name: "Demo Listener",
  avatar: "\uD83C\uDFA7",
  role: "listener",
  membership_status: "free",
  wallet_balance: 0,
  wallet_frozen: 0
};

const songs = [
  {
    id: 101,
    title: "Neon Drift",
    cover_url: "",
    prompt: "late night dream pop with soft synth pulse",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    tags: ["Late Night", "Dream Pop", "Synth"],
    creator_type: "user",
    revenue_enabled: true,
    source: "mock"
  },
  {
    id: 102,
    title: "Warm Signal",
    cover_url: "",
    prompt: "warm focus loop with gentle texture",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    tags: ["Warm", "Focus", "Soft Pulse"],
    creator_type: "user",
    revenue_enabled: true,
    source: "mock"
  },
  {
    id: 103,
    title: "Glass Orbit",
    cover_url: "",
    prompt: "floating synth orbit for midnight listening",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    tags: ["Synth", "Late Night", "Dream Pop"],
    creator_type: "platform",
    revenue_enabled: false,
    source: "mock"
  }
];

let queueSeed = 1000;
let lastGeneratedSong = songs[0];
const playlists = [{ id: 1, name: "Demo Queue", created_at: now() }];
const playlistSongs = new Map([[1, [songs[0], songs[1]]]]);
const generationJobs = new Map();

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

function route(reqUrl) {
  const url = new URL(reqUrl, `http://localhost:${PORT}`);
  return {
    path: url.pathname.replace(/^\/api(?=\/|$)/, "") || "/",
    query: url.searchParams
  };
}

function queueItems() {
  return songs.map((song, index) => ({
    ...song,
    queue_id: queueSeed + index,
    created_at: now(),
    source: index === 0 ? "reused" : "mock_queue"
  }));
}

function rotatedQueue(cursorQueueId) {
  const items = queueItems();
  const cursor = Number(cursorQueueId);
  if (!Number.isFinite(cursor)) return items;
  const nextIndex = items.findIndex((item) => Number(item.queue_id) > cursor);
  if (nextIndex < 0) return items;
  return items.slice(nextIndex).concat(items.slice(0, nextIndex));
}

function userTags() {
  return tags.map((tag, index) => ({
    tag_id: tag.id,
    name: tag.name,
    type: tag.type,
    weight: index < 2 ? 1 : 0.65,
    is_active: true
  }));
}

function authPayload(accountId, displayName, avatar) {
  return {
    user: {
      ...user,
      account_id: accountId || user.account_id,
      display_name: displayName || user.display_name,
      avatar: avatar || user.avatar
    }
  };
}

function generatedSongFromJob(jobId) {
  const generated = {
    ...songs[0],
    id: 200 + Number(jobId),
    title: `Generated Signal ${jobId}`,
    source: "generated",
    creator_type: "user",
    revenue_enabled: true
  };
  lastGeneratedSong = generated;
  return generated;
}

const server = http.createServer(async (req, res) => {
  const { path, query } = route(req.url);
  const body = await readBody(req);

  console.log(`${now()} ${req.method} ${path}`);

  if (req.method === "GET" && path === "/health") return send(res, 200, { ok: true, mode: "mock" });
  if (req.method === "GET" && path === "/tags") return send(res, 200, { items: tags });

  if (req.method === "POST" && path === "/auth/login") {
    return send(res, 200, authPayload(body.account_id, "Demo Listener", user.avatar));
  }

  if (req.method === "POST" && path === "/auth/register") {
    return send(res, 200, authPayload(body.account_id, body.display_name || body.username, body.avatar));
  }

  if (req.method === "POST" && path === "/users") {
    return send(res, 200, authPayload(body.device_id || user.account_id, body.display_name, user.avatar));
  }

  if (req.method === "GET" && path === "/user-tags") return send(res, 200, { items: userTags() });
  if (req.method === "POST" && path === "/init-tags") return send(res, 200, { ok: true, items: userTags() });
  if (req.method === "POST" && path === "/user-tags") {
    const id = tags.length + 1;
    const tag = { id, name: body.name || "Custom", type: body.type || "\u5176\u4ed6" };
    tags.push(tag);
    return send(res, 200, { item: { tag_id: id, ...tag, weight: 0.7, is_active: true }, tag });
  }
  if (req.method === "POST" && path === "/user-tags/remove") return send(res, 200, { ok: true });
  if (req.method === "POST" && path === "/user-tags/weight") return send(res, 200, { ok: true });
  if (req.method === "POST" && path === "/user-tags/anchor") return send(res, 200, { ok: true, items: userTags() });

  if (req.method === "GET" && path === "/recommend/next") {
    const items = rotatedQueue(query.get("cursor_queue_id"));
    return send(res, 200, {
      items,
      current: items[0] || null,
      next: items[1] || null,
      playable_count: items.length,
      needs_generation: false,
      has_pending_generation: false
    });
  }

  if (req.method === "GET" && path === "/songs") return send(res, 200, { items: queueItems() });
  if (req.method === "GET" && path === "/favorites") return send(res, 200, { items: [songs[0]] });
  if (req.method === "GET" && path === "/my-songs") return send(res, 200, { items: songs.filter((song) => song.creator_type === "user") });
  if (req.method === "POST" && path === "/feedback") {
    if (body.action === "skip") queueSeed += 1;
    return send(res, 200, { ok: true });
  }

  if (req.method === "GET" && path === "/playlists") return send(res, 200, { items: playlists });
  if (req.method === "POST" && path === "/playlists") {
    const playlist = { id: playlists.length + 1, name: body.name || "New Playlist", created_at: now() };
    playlists.push(playlist);
    playlistSongs.set(playlist.id, []);
    return send(res, 200, { item: playlist, playlist });
  }
  if (req.method === "GET" && /^\/playlists\/\d+\/songs$/.test(path)) {
    const id = Number(path.split("/")[2]);
    return send(res, 200, { items: playlistSongs.get(id) || [] });
  }
  if (req.method === "POST" && /^\/playlists\/\d+\/add$/.test(path)) {
    const id = Number(path.split("/")[2]);
    const song = songs.find((item) => Number(item.id) === Number(body.song_id)) || songs[0];
    playlistSongs.set(id, [...(playlistSongs.get(id) || []), song]);
    return send(res, 200, { ok: true });
  }
  if (req.method === "POST" && /^\/playlists\/\d+\/remove$/.test(path)) return send(res, 200, { ok: true });

  if (req.method === "POST" && path === "/generate") {
    const id = generationJobs.size + 1;
    const song = generatedSongFromJob(id);
    generationJobs.set(id, { id, status: "done", song_id: song.id, song });
    return send(res, 200, {
      status: "submitted",
      job_id: id,
      existing: false,
      song,
      song_id: song.id
    });
  }

  if (req.method === "GET" && /^\/generation-jobs\/\d+$/.test(path)) {
    const id = Number(path.split("/").pop());
    const job = generationJobs.get(id) || { id, status: "done", song_id: lastGeneratedSong.id, song: lastGeneratedSong };
    return send(res, 200, job);
  }

  return send(res, 404, { error: "mock route not found", method: req.method, path, query: Object.fromEntries(query) });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Mock API listening on http://0.0.0.0:${PORT}`);
});
