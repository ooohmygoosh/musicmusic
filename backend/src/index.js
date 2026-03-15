import "dotenv/config";
import Fastify from "fastify";
import { query } from "./db.js";

const app = Fastify({ logger: true });

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const TPY_BASE_URL = process.env.TPY_BASE_URL || "https://api.tianpuyue.cn";
const TPY_API_KEY = process.env.TPY_API_KEY || "";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const DEEPSEEK_ENABLED = process.env.DEEPSEEK_ENABLED === "true";

const DEFAULT_TAG_WEIGHT = 0.3;
const SELECTED_TAG_WEIGHT = 0.7;
const COEF_FAVORITE = 0.15;
const COEF_SKIP_EARLY = 0.2;
const COEF_SKIP_LATE = 0.1;
const COEF_COMPLETE = 0.05;
const NORMALIZE_EVERY = 10;
const MAX_TAGS_TOTAL = 6;
const MAX_PER_TYPE = 2;
const REUSE_SIMILARITY_MIN = Number(process.env.REUSE_SIMILARITY_MIN || 0.6);

const PROMPT_GUIDE = {
  "\u60c5\u7eea": "Describe the emotional tone and energy arc.",
  "\u4e50\u5668": "Describe the lead instruments and arrangement texture.",
  "\u98ce\u683c": "Describe genre, era feeling, and production direction.",
  "\u573a\u666f": "Describe listening scene and atmosphere imagery.",
  "\u8282\u594f": "Describe tempo, groove, and pacing.",
  "\u4eba\u58f0": "Describe vocal style, timbre, and performance intensity."
};

function requireAdmin(request, reply) {
  const token = request.headers["x-admin-token"];
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    reply.code(401).send({ error: "unauthorized" });
    return false;
  }
  return true;
}

app.get("/health", async () => ({ ok: true }));

app.get("/tags", async () => {
  const { rows } = await query("SELECT id, name, type FROM tags WHERE is_active = true ORDER BY id");
  return { items: rows };
});

app.get("/admin/tags", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { rows } = await query("SELECT * FROM tags ORDER BY id");
  return { items: rows };
});

app.post("/admin/tags", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { name, type, description, sort_order, is_active } = request.body || {};
  if (!name || !type) {
    reply.code(400).send({ error: "name and type required" });
    return;
  }
  const { rows } = await query(
    "INSERT INTO tags (name, type, description, sort_order, is_active) VALUES ($1, $2, $3, COALESCE($4, 0), COALESCE($5, true)) RETURNING *",
    [name, type, description || null, sort_order ?? 0, is_active]
  );
  return { item: rows[0] };
});

app.patch("/admin/tags/:id", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { id } = request.params;
  const { name, type, is_active, description, sort_order } = request.body || {};
  const { rows } = await query(
    "UPDATE tags SET name = COALESCE($1, name), type = COALESCE($2, type), is_active = COALESCE($3, is_active), description = COALESCE($4, description), sort_order = COALESCE($5, sort_order) WHERE id = $6 RETURNING *",
    [name, type, is_active, description, sort_order, id]
  );
  return { item: rows[0] };
});

app.delete("/admin/tags/:id", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { id } = request.params;
  await query("DELETE FROM tags WHERE id = $1", [id]);
  return { ok: true };
});

app.get("/admin/users", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { rows } = await query("SELECT * FROM users ORDER BY created_at DESC");
  return { items: rows };
});

app.patch("/admin/users/:id", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { id } = request.params;
  const { display_name, is_active } = request.body || {};
  const { rows } = await query(
    "UPDATE users SET display_name = COALESCE(NULLIF($1, ''), display_name), is_active = COALESCE($2, is_active), last_seen_at = COALESCE(last_seen_at, NOW()) WHERE id = $3 RETURNING *",
    [display_name, is_active, Number(id)]
  );
  return { item: rows[0] || null };
});

app.get("/admin/user-summary", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { rows } = await query(
    "SELECT u.id, u.device_id, COALESCE(u.display_name, u.device_id) AS display_name, u.created_at, u.last_seen_at, u.is_active, COUNT(DISTINCT f.id)::int AS feedback_count, COUNT(DISTINCT CASE WHEN f.action = 'like' THEN f.id END)::int AS like_count, COUNT(DISTINCT CASE WHEN f.action = 'skip' THEN f.id END)::int AS skip_count, COUNT(DISTINCT q.song_id)::int AS queued_songs, COUNT(DISTINCT p.id)::int AS playlist_count, COUNT(DISTINCT ut.tag_id) FILTER (WHERE COALESCE(ut.is_active, true) = true)::int AS active_tag_count FROM users u LEFT JOIN feedback f ON f.user_id = u.id LEFT JOIN user_song_queue q ON q.user_id = u.id LEFT JOIN playlists p ON p.user_id = u.id LEFT JOIN user_tags ut ON ut.user_id = u.id GROUP BY u.id ORDER BY COALESCE(u.last_seen_at, u.created_at) DESC, u.created_at DESC"
  );
  return { items: rows };
});

app.get("/admin/user-feedback", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { user_id } = request.query || {};
  if (!user_id) {
    reply.code(400).send({ error: "user_id required" });
    return;
  }
  const { rows } = await query(
    "SELECT f.id, f.action, f.created_at, s.id AS song_id, s.prompt, COALESCE(array_remove(array_agg(t.name), NULL), '{}') AS tags FROM feedback f JOIN songs s ON s.id = f.song_id LEFT JOIN song_tags st ON st.song_id = s.id LEFT JOIN tags t ON t.id = st.tag_id WHERE f.user_id = $1 GROUP BY f.id, s.id ORDER BY f.created_at DESC",
    [Number(user_id)]
  );
  return { items: rows };
});

app.get("/admin/user-detail", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { user_id } = request.query || {};
  if (!user_id) {
    reply.code(400).send({ error: "user_id required" });
    return;
  }
  const userId = Number(user_id);

  const user = await query("SELECT id, device_id, created_at FROM users WHERE id = $1", [userId]);

  const favorites = await query(
    "SELECT f.created_at, s.id AS song_id, s.title, s.cover_url, s.prompt, COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tags, COALESCE(array_remove(array_agg(DISTINCT p.name), NULL), '{}') AS playlists FROM feedback f JOIN songs s ON s.id = f.song_id LEFT JOIN song_tags st ON st.song_id = s.id LEFT JOIN tags t ON t.id = st.tag_id LEFT JOIN playlist_songs ps ON ps.song_id = s.id LEFT JOIN playlists p ON p.id = ps.playlist_id AND p.user_id = f.user_id WHERE f.user_id = $1 AND f.action = 'like' GROUP BY f.id, s.id ORDER BY f.created_at DESC LIMIT 100",
    [userId]
  );

  const songs = await query(
    "SELECT s.id AS song_id, s.title, s.cover_url, s.prompt, s.created_at, COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tags FROM songs s LEFT JOIN song_tags st ON st.song_id = s.id LEFT JOIN tags t ON t.id = st.tag_id WHERE s.user_id = $1 GROUP BY s.id ORDER BY s.created_at DESC LIMIT 100",
    [userId]
  );

  const tagWeights = await query(
    "SELECT t.name, t.type, ut.weight FROM user_tags ut JOIN tags t ON t.id = ut.tag_id WHERE ut.user_id = $1 AND COALESCE(ut.is_active, true) = true ORDER BY ut.weight DESC",
    [userId]
  );

  return {
    user: user.rows[0] || { id: userId },
    favorites: favorites.rows || [],
    songs: songs.rows || [],
    tag_weights: tagWeights.rows || []
  };
});

app.get("/admin/stats", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;

  const users = await query("SELECT COUNT(*)::int AS count FROM users");
  const songs = await query("SELECT COUNT(*)::int AS count FROM songs");
  const feedback = await query("SELECT COUNT(*)::int AS count FROM feedback");
  const favorites = await query(
    "SELECT COUNT(*)::int AS count FROM feedback WHERE action = 'like'"
  );
  const tagsTotal = await query("SELECT COUNT(*)::int AS count FROM tags");
  const tagsActive = await query("SELECT COUNT(*)::int AS count FROM tags WHERE is_active = true");
  const reusableSongs = await query("SELECT COUNT(*)::int AS count FROM songs WHERE source_song_id IS NULL AND COALESCE(is_available, true) = true");
  const queuedSongs = await query("SELECT COUNT(*)::int AS count FROM user_song_queue WHERE COALESCE(is_hidden, false) = false");

  const feedbackBreakdown = await query(
    "SELECT action, COUNT(*)::int AS count FROM feedback GROUP BY action ORDER BY count DESC"
  );

  const topTags = await query(
    "SELECT t.id, t.name, t.type, COUNT(st.song_id)::int AS uses FROM tags t LEFT JOIN song_tags st ON st.tag_id = t.id GROUP BY t.id ORDER BY uses DESC LIMIT 10"
  );

  return {
    stats: {
      users: users.rows[0]?.count || 0,
      songs: songs.rows[0]?.count || 0,
      feedback: feedback.rows[0]?.count || 0,
      favorites: favorites.rows[0]?.count || 0,
      tags_total: tagsTotal.rows[0]?.count || 0,
      tags_active: tagsActive.rows[0]?.count || 0,
      reusable_songs: reusableSongs.rows[0]?.count || 0,
      queued_songs: queuedSongs.rows[0]?.count || 0
    },
    feedback_breakdown: feedbackBreakdown.rows || [],
    top_tags: topTags.rows || []
  };
});

app.get("/admin/feedback", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { user_id } = request.query || {};
  const { rows } = await query(
    "SELECT * FROM feedback WHERE ($1::int IS NULL OR user_id = $1) ORDER BY created_at DESC LIMIT 200",
    [user_id ? Number(user_id) : null]
  );
  return { items: rows };
});

app.get("/admin/favorites", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { rows } = await query(
    "SELECT f.id AS feedback_id, f.user_id, f.song_id, f.created_at, s.prompt, COALESCE(array_remove(array_agg(t.name), NULL), '{}') AS tags FROM feedback f JOIN songs s ON s.id = f.song_id LEFT JOIN song_tags st ON st.song_id = s.id LEFT JOIN tags t ON t.id = st.tag_id WHERE f.action = 'like' GROUP BY f.id, s.prompt ORDER BY f.created_at DESC LIMIT 200"
  );
  return { items: rows };
});

app.get("/admin/library-songs", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { q, available } = request.query || {};
  const search = q ? `%${String(q).trim()}%` : null;
  const availableFilter =
    available === "true" ? true : available === "false" ? false : null;

  const { rows } = await query(
    "SELECT lib.id, lib.title, lib.cover_url, lib.prompt, lib.model, lib.duration, lib.style, lib.is_available, lib.reuse_count, COUNT(DISTINCT all_s.id)::int AS copies, COUNT(DISTINCT CASE WHEN f.action = 'like' THEN f.id END)::int AS likes, COUNT(DISTINCT CASE WHEN f.action = 'skip' THEN f.id END)::int AS skips, COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tags, sa.audio_url FROM songs lib LEFT JOIN songs all_s ON COALESCE(all_s.source_song_id, all_s.id) = lib.id LEFT JOIN feedback f ON f.song_id = all_s.id LEFT JOIN song_tags st ON st.song_id = lib.id LEFT JOIN tags t ON t.id = st.tag_id LEFT JOIN LATERAL (SELECT audio_url FROM song_assets WHERE song_id = lib.id ORDER BY id DESC LIMIT 1) sa ON true WHERE lib.source_song_id IS NULL AND ($1::text IS NULL OR lib.title ILIKE $1 OR lib.prompt ILIKE $1 OR EXISTS (SELECT 1 FROM song_tags st2 JOIN tags t2 ON t2.id = st2.tag_id WHERE st2.song_id = lib.id AND t2.name ILIKE $1)) AND ($2::boolean IS NULL OR lib.is_available = $2) GROUP BY lib.id, sa.audio_url ORDER BY likes DESC, lib.reuse_count DESC, lib.created_at DESC LIMIT 300",
    [search, availableFilter]
  );
  return { items: rows };
});

app.patch("/admin/library-songs/:id", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { id } = request.params;
  const { is_available } = request.body || {};
  if (typeof is_available !== "boolean") {
    reply.code(400).send({ error: "is_available boolean required" });
    return;
  }
  const { rows } = await query(
    "UPDATE songs SET is_available = $1 WHERE id = $2 AND source_song_id IS NULL RETURNING id, is_available",
    [is_available, Number(id)]
  );
  return { item: rows[0] || null };
});
app.post("/users", async (request, reply) => {
  const { device_id, display_name } = request.body || {};
  if (!device_id) {
    reply.code(400).send({ error: "device_id required" });
    return;
  }
  const cleanName = display_name ? String(display_name).trim() : null;
  const { rows } = await query(
    "INSERT INTO users (device_id, display_name, last_seen_at) VALUES ($1, NULLIF($2, ''), NOW()) ON CONFLICT (device_id) DO UPDATE SET display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), users.display_name), last_seen_at = NOW(), is_active = true RETURNING *",
    [device_id, cleanName]
  );
  return { user: rows[0] };
});

app.post("/init-tags", async (request, reply) => {
  const { user_id, tag_ids } = request.body || {};
  if (!user_id || !Array.isArray(tag_ids) || tag_ids.length === 0) {
    reply.code(400).send({ error: "user_id and tag_ids required" });
    return;
  }

  await ensureUserTagWeights(user_id);

  await query(
    "UPDATE user_tags SET weight = $1, initial_weight = $1, update_count = 0, last_updated = NOW() WHERE user_id = $2 AND tag_id = ANY($3)",
    [SELECTED_TAG_WEIGHT, user_id, tag_ids]
  );

  await normalizeUserWeights(user_id);
  return { ok: true };
});

app.post("/user-tags", async (request, reply) => {
  const { user_id, name, type } = request.body || {};
  if (!user_id || !name || !type) {
    reply.code(400).send({ error: "user_id, name, type required" });
    return;
  }
  const cleanName = String(name).trim();
  const cleanType = String(type).trim();
  if (!cleanName || !cleanType) {
    reply.code(400).send({ error: "name and type required" });
    return;
  }

  const { rows: existing } = await query(
    "SELECT id, name, type FROM tags WHERE LOWER(name) = LOWER($1) AND LOWER(type) = LOWER($2) LIMIT 1",
    [cleanName, cleanType]
  );

  let tag = existing[0];
  if (!tag) {
    const created = await query(
      "INSERT INTO tags (name, type, is_active, is_system) VALUES ($1, $2, true, false) RETURNING id, name, type",
      [cleanName, cleanType]
    );
    tag = created.rows[0];
  }

  await ensureUserTagWeights(user_id);
  await query(
    "UPDATE user_tags SET weight = $1, initial_weight = $1, update_count = 0, last_updated = NOW(), is_active = true WHERE user_id = $2 AND tag_id = $3",
    [SELECTED_TAG_WEIGHT, user_id, tag.id]
  );
  await normalizeUserWeights(user_id);

  return { tag };
});

app.get("/user-tags", async (request, reply) => {
  const { user_id } = request.query || {};
  if (!user_id) {
    reply.code(400).send({ error: "user_id required" });
    return;
  }
  const { rows } = await query(
    "SELECT t.id AS tag_id, t.name, t.type, ut.weight, COALESCE(ut.is_active, true) AS is_active FROM user_tags ut JOIN tags t ON t.id = ut.tag_id WHERE ut.user_id = $1 ORDER BY ut.weight DESC",
    [Number(user_id)]
  );
  return { items: rows };
});

app.post("/user-tags/remove", async (request, reply) => {
  const { user_id, tag_id } = request.body || {};
  if (!user_id || !tag_id) {
    reply.code(400).send({ error: "user_id and tag_id required" });
    return;
  }
  await query(
    "UPDATE user_tags SET is_active = false, weight = 0, last_updated = NOW() WHERE user_id = $1 AND tag_id = $2",
    [Number(user_id), Number(tag_id)]
  );
  return { ok: true };
});

app.post("/user-tags/weight", async (request, reply) => {
  const { user_id, tag_id, weight } = request.body || {};
  if (!user_id || !tag_id || typeof weight !== "number") {
    reply.code(400).send({ error: "user_id, tag_id, weight required" });
    return;
  }
  const clamped = Math.max(0, Math.min(1, weight));
  await query(
    "UPDATE user_tags SET weight = $1, last_updated = NOW() WHERE user_id = $2 AND tag_id = $3",
    [clamped, Number(user_id), Number(tag_id)]
  );
  return { ok: true };
});

app.get("/favorites", async (request, reply) => {
  const { user_id } = request.query || {};
  if (!user_id) {
    reply.code(400).send({ error: "user_id required" });
    return;
  }
  const { rows } = await query(
    "SELECT s.id, s.title, s.cover_url, s.prompt, sa.audio_url, f.created_at FROM feedback f JOIN songs s ON s.id = f.song_id LEFT JOIN LATERAL (SELECT audio_url FROM song_assets WHERE song_id = s.id ORDER BY id DESC LIMIT 1) sa ON true WHERE f.user_id = $1 AND f.action = 'like' ORDER BY f.created_at DESC LIMIT 100",
    [Number(user_id)]
  );
  return { items: rows };
});

app.get("/playlists", async (request, reply) => {
  const { user_id } = request.query || {};
  if (!user_id) {
    reply.code(400).send({ error: "user_id required" });
    return;
  }
  const { rows } = await query(
    "SELECT p.id, p.name, p.created_at, COUNT(ps.song_id)::int AS song_count FROM playlists p LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id WHERE p.user_id = $1 GROUP BY p.id ORDER BY p.created_at DESC",
    [Number(user_id)]
  );
  return { items: rows };
});

app.post("/playlists", async (request, reply) => {
  const { user_id, name } = request.body || {};
  if (!user_id || !name) {
    reply.code(400).send({ error: "user_id and name required" });
    return;
  }
  const { rows } = await query(
    "INSERT INTO playlists (user_id, name) VALUES ($1, $2) RETURNING id, name, created_at",
    [Number(user_id), String(name).trim()]
  );
  return { item: rows[0] };
});

app.get("/playlists/:id/songs", async (request, reply) => {
  const { id } = request.params;
  const { rows } = await query(
    "SELECT s.id, s.title, s.cover_url, s.prompt, sa.audio_url, ps.created_at FROM playlist_songs ps JOIN songs s ON s.id = ps.song_id LEFT JOIN LATERAL (SELECT audio_url FROM song_assets WHERE song_id = s.id ORDER BY id DESC LIMIT 1) sa ON true WHERE ps.playlist_id = $1 ORDER BY ps.created_at DESC",
    [Number(id)]
  );
  return { items: rows };
});

app.post("/playlists/:id/add", async (request, reply) => {
  const { id } = request.params;
  const { song_id } = request.body || {};
  if (!song_id) {
    reply.code(400).send({ error: "song_id required" });
    return;
  }
  await query(
    "INSERT INTO playlist_songs (playlist_id, song_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [Number(id), Number(song_id)]
  );
  return { ok: true };
});

app.post("/playlists/:id/remove", async (request, reply) => {
  const { id } = request.params;
  const { song_id } = request.body || {};
  if (!song_id) {
    reply.code(400).send({ error: "song_id required" });
    return;
  }
  await query(
    "DELETE FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2",
    [Number(id), Number(song_id)]
  );
  return { ok: true };
});

function pickTagsWeighted(tags, maxCount, weightKey = "weight") {
  const pool = [...tags];
  const picked = [];
  const total = () => pool.reduce((sum, t) => sum + Number(t[weightKey] || 0), 0);
  while (pool.length > 0 && picked.length < maxCount) {
    const r = Math.random() * total();
    let acc = 0;
    let idx = 0;
    for (; idx < pool.length; idx += 1) {
      acc += Number(pool[idx][weightKey] || 0);
      if (acc >= r) break;
    }
    const chosen = pool.splice(idx, 1)[0];
    picked.push(chosen);
  }
  return picked;
}

async function getRecentTagIds(userId, limit = 5) {
  const { rows } = await query(
    "SELECT st.tag_id FROM songs s JOIN song_tags st ON st.song_id = s.id WHERE s.user_id = $1 ORDER BY s.created_at DESC LIMIT $2",
    [userId, limit]
  );
  return new Set(rows.map((row) => row.tag_id));
}

async function ensureUserTagWeights(userId) {
  const { rows } = await query(
    "SELECT id FROM tags WHERE is_active = true ORDER BY id"
  );
  if (rows.length === 0) return;
  const tagIds = rows.map((r) => r.id);

  await query(
    "INSERT INTO user_tags (user_id, tag_id, weight, initial_weight) SELECT $1, t.id, $2, $2 FROM tags t WHERE t.is_active = true ON CONFLICT (user_id, tag_id) DO NOTHING",
    [userId, DEFAULT_TAG_WEIGHT]
  );

  await query(
    "UPDATE user_tags SET is_active = false WHERE user_id = $1 AND tag_id <> ALL($2::int[])",
    [userId, tagIds]
  );
}

async function normalizeUserWeights(userId) {
  const { rows } = await query(
    "SELECT tag_id, weight FROM user_tags WHERE user_id = $1 AND COALESCE(is_active, true) = true",
    [userId]
  );
  if (rows.length === 0) return;
  const total = rows.reduce((sum, row) => sum + Number(row.weight || 0), 0);
  if (total <= 0) return;

  for (const row of rows) {
    const normalized = Number(row.weight || 0) / total;
    await query(
      "UPDATE user_tags SET weight = $1, last_updated = NOW() WHERE user_id = $2 AND tag_id = $3",
      [normalized, userId, row.tag_id]
    );
  }
}

async function buildPrompt(userId) {
  await ensureUserTagWeights(userId);
  const { rows } = await query(
    "SELECT t.id, t.name, t.type, ut.weight FROM user_tags ut JOIN tags t ON t.id = ut.tag_id WHERE ut.user_id = $1 AND t.is_active = true AND COALESCE(ut.is_active, true) = true",
    [userId]
  );
  if (rows.length === 0) {
    return {
      prompt: "",
      tagIds: [],
      base_prompt: "",
      title_hint: "",
      cover_hint: ""
    };
  }

  const recentTagIds = await getRecentTagIds(userId, 6);
  const sorted = [...rows].sort((a, b) => b.weight - a.weight);
  const fresh = sorted.filter((tag) => !recentTagIds.has(tag.id));
  const recent = sorted.filter((tag) => recentTagIds.has(tag.id));
  const chosen = [];
  const byType = new Map();
  const tryPick = (list) => {
    for (const tag of list) {
      const count = byType.get(tag.type) || 0;
      if (count >= MAX_PER_TYPE) continue;
      if (chosen.length >= MAX_TAGS_TOTAL) break;
      chosen.push(tag);
      byType.set(tag.type, count + 1);
    }
  };

  tryPick(fresh);
  if (chosen.length < MAX_TAGS_TOTAL) {
    tryPick(recent);
  }

  const remaining = sorted.filter((tag) => !chosen.find((c) => c.id === tag.id));
  if (chosen.length < Math.min(MAX_TAGS_TOTAL, sorted.length) && remaining.length > 0) {
    const need = Math.min(MAX_TAGS_TOTAL - chosen.length, remaining.length);
    const explorePool = remaining.map((tag) => ({
      ...tag,
      exploreWeight: Math.max(0.05, 1 - Number(tag.weight || 0))
    }));
    const explore = pickTagsWeighted(explorePool, need, "exploreWeight");
    for (const tag of explore) {
      if (chosen.length >= MAX_TAGS_TOTAL) break;
      const count = byType.get(tag.type) || 0;
      if (count >= MAX_PER_TYPE) continue;
      chosen.push(tag);
      byType.set(tag.type, count + 1);
    }
  }

  const grouped = new Map();
  for (const tag of chosen) {
    const list = grouped.get(tag.type) || [];
    list.push(tag.name);
    grouped.set(tag.type, list);
  }

  const parts = [];
  for (const [type, list] of grouped.entries()) {
    parts.push(`${type}: ${list.join(", ")}`);
  }
  const tagIds = chosen.map((tag) => tag.id);
  const basePrompt = parts.join(", ");
  const optimized = await optimizePromptWithDeepSeek(chosen, basePrompt);
  return {
    prompt: optimized.prompt || basePrompt,
    tagIds,
    base_prompt: basePrompt,
    title_hint: optimized.title_hint || "",
    cover_hint: optimized.cover_hint || ""
  };
}

async function optimizePromptWithDeepSeek(chosenTags, basePrompt) {
  if (!DEEPSEEK_ENABLED || !DEEPSEEK_API_KEY || !Array.isArray(chosenTags) || chosenTags.length === 0) {
    return { prompt: basePrompt, title_hint: "", cover_hint: "" };
  }

  const tagSummary = chosenTags.map((tag) => ({
    type: tag.type,
    name: tag.name,
    weight: Number(tag.weight || 0)
  }));

  const groupedGuide = Object.entries(
    chosenTags.reduce((acc, tag) => {
      if (!acc[tag.type]) acc[tag.type] = [];
      acc[tag.type].push(tag.name);
      return acc;
    }, {})
  ).map(([type, names]) => ({
    type,
    tags: names,
        usage: PROMPT_GUIDE[type] || "Add only music-generation-relevant details"
  }));

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a music prompt optimizer. Turn user tags into a more natural and production-ready Chinese music prompt for a music generation model. Do not explain anything. Return JSON only."
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "Convert these tags into a stronger Chinese prompt for a music generation model",
              base_prompt: basePrompt,
              tags: tagSummary,
              grouped_tags: groupedGuide,
              output_schema: {
                prompt: "A single Chinese prompt string, 1-3 sentences, ready for the music model",
                title_hint: "Optional short title idea",
                cover_hint: "Optional cover art description"
              },
              constraints: [
                "Keep the core meaning of the tags",
                "Add reasonable genre, mood, tempo, arrangement, and scene details",
                "Do not use Markdown",
                "Keep it under 180 Chinese characters"
              ]
            })
          }
        ]
      })
    });

    if (!response.ok) {
      app.log.warn({ status: response.status }, "deepseek prompt optimization failed");
      return { prompt: basePrompt, title_hint: "", cover_hint: "" };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { prompt: basePrompt, title_hint: "", cover_hint: "" };

    let parsed = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { prompt: basePrompt, title_hint: "", cover_hint: "" };
    }

    return {
      prompt: String(parsed?.prompt || "").trim() || basePrompt,
      title_hint: String(parsed?.title_hint || "").trim(),
      cover_hint: String(parsed?.cover_hint || "").trim()
    };
  } catch (error) {
    app.log.warn({ err: String(error) }, "deepseek prompt optimization error");
    return { prompt: basePrompt, title_hint: "", cover_hint: "" };
  }
}

async function getUserExcludedSongIds(userId) {
  const { rows } = await query(
    "SELECT DISTINCT song_id FROM (SELECT song_id, created_at FROM user_song_queue WHERE user_id = $1 ORDER BY created_at DESC LIMIT 12) recent UNION SELECT DISTINCT song_id FROM feedback WHERE user_id = $1 AND action = 'skip' ORDER BY song_id",
    [Number(userId)]
  );
  return rows.map((row) => Number(row.song_id)).filter(Boolean);
}

async function queueSongForUser(userId, songId, jobId, source) {
  await query(
    "INSERT INTO user_song_queue (user_id, song_id, generation_job_id, source) VALUES ($1, $2, $3, $4)",
    [Number(userId), Number(songId), jobId ? Number(jobId) : null, source]
  );
}

async function findReusableSong(userId, tagIds) {
  if (!Array.isArray(tagIds) || tagIds.length === 0) return null;
  const excludedSongIds = await getUserExcludedSongIds(userId);
  const { rows } = await query(
    "SELECT s.id, s.title, s.cover_url, s.prompt, s.model, s.duration, s.style, s.reuse_count, COUNT(DISTINCT st.tag_id)::int AS song_tag_count, COUNT(DISTINCT CASE WHEN st.tag_id = ANY($1::int[]) THEN st.tag_id END)::int AS matched_tag_count, (COUNT(DISTINCT CASE WHEN st.tag_id = ANY($1::int[]) THEN st.tag_id END)::float / GREATEST(COUNT(DISTINCT st.tag_id), $2)) AS similarity FROM songs s JOIN song_assets sa ON sa.song_id = s.id AND sa.audio_url IS NOT NULL LEFT JOIN song_tags st ON st.song_id = s.id WHERE s.source_song_id IS NULL AND COALESCE(s.is_available, true) = true AND ($4::int[] = '{}'::int[] OR NOT (s.id = ANY($4::int[]))) GROUP BY s.id HAVING COUNT(DISTINCT CASE WHEN st.tag_id = ANY($1::int[]) THEN st.tag_id END) > 0 AND (COUNT(DISTINCT CASE WHEN st.tag_id = ANY($1::int[]) THEN st.tag_id END)::float / GREATEST(COUNT(DISTINCT st.tag_id), $2)) >= $3 ORDER BY similarity DESC, s.reuse_count DESC, s.created_at DESC LIMIT 1",
    [tagIds, tagIds.length, REUSE_SIMILARITY_MIN, excludedSongIds]
  );
  if (rows.length === 0) return null;

  const asset = await query(
    "SELECT item_id, audio_url FROM song_assets WHERE song_id = $1 ORDER BY id DESC LIMIT 1",
    [rows[0].id]
  );
  if (asset.rows.length === 0) return null;
  return { ...rows[0], asset: asset.rows[0] };
}

async function reuseSongForUser(job, librarySong) {
  await queueSongForUser(job.user_id, librarySong.id, job.id, 'reused');

  await query(
    "UPDATE songs SET reuse_count = reuse_count + 1 WHERE id = $1",
    [Number(librarySong.id)]
  );

  await query(
    "UPDATE generation_jobs SET status = 'reused', item_ids = $1 WHERE id = $2",
    [[librarySong.asset.item_id].filter(Boolean), Number(job.id)]
  );

  return librarySong.id;
}
app.post("/generate", async (request, reply) => {
  const { user_id, instrumental = true, model } = request.body || {};
  if (!user_id) {
    reply.code(400).send({ error: "user_id required" });
    return;
  }

  const { prompt, tagIds, base_prompt, title_hint, cover_hint } = await buildPrompt(user_id);
  if (!prompt) {
    reply.code(400).send({ error: "no tags found for user" });
    return;
  }

  const { rows } = await query(
    "INSERT INTO generation_jobs (user_id, prompt, base_prompt, title_hint, cover_hint, status, tag_ids) VALUES ($1, $2, $3, $4, $5, 'pending', $6) RETURNING *",
    [user_id, prompt, base_prompt || prompt, title_hint || null, cover_hint || null, tagIds]
  );
  const job = rows[0];

  const reusableSong = await findReusableSong(user_id, tagIds);
  if (reusableSong) {
    const songId = await reuseSongForUser(job, reusableSong);
    return {
      job_id: job.id,
      item_ids: reusableSong.asset.item_id ? [reusableSong.asset.item_id] : [],
      prompt,
      reused: true,
      song_id: songId,
      matched_song_id: reusableSong.id,
      similarity: Number(reusableSong.similarity || 0)
    };
  }

  if (!TPY_API_KEY) {
    await query("UPDATE generation_jobs SET status = 'failed' WHERE id = $1", [job.id]);
    reply.code(500).send({ error: "TPY_API_KEY not set" });
    return;
  }

  const url = instrumental
    ? `${TPY_BASE_URL}/open-apis/v1/instrumental/generate`
    : `${TPY_BASE_URL}/open-apis/v1/song/generate`;

  const modelToUse =
    model ||
    (instrumental
      ? process.env.TPY_MODEL_INSTRUMENTAL || "TemPolor i3"
      : process.env.TPY_MODEL_SONG || "TemPolor v3");

  const payload = {
    model: modelToUse,
    prompt,
    callback_url: `${process.env.CALLBACK_BASE}/callback/tpy`
  };

  let res = null;
  let data = null;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: TPY_API_KEY
      },
      body: JSON.stringify(payload)
    });
    data = await res.json();
  } catch (err) {
    await query("UPDATE generation_jobs SET status = 'failed', error = $1 WHERE id = $2", [
      String(err),
      job.id
    ]);
    reply.code(502).send({ error: "tianpuyue request failed", detail: String(err) });
    return;
  }

  if (!res.ok) {
    await query("UPDATE generation_jobs SET status = 'failed', error = $1 WHERE id = $2", [
      JSON.stringify(data),
      job.id
    ]);
    reply.code(502).send({ error: "tianpuyue request failed", detail: data });
    return;
  }

  const itemIds = data?.data?.item_ids || [];
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    await query("UPDATE generation_jobs SET status = 'failed', error = $1 WHERE id = $2", [
      JSON.stringify(data),
      job.id
    ]);
    reply.code(502).send({ error: "tianpuyue returned no item_ids", detail: data });
    return;
  }

  await query(
    "UPDATE generation_jobs SET status = 'submitted', item_ids = $1 WHERE id = $2",
    [itemIds, job.id]
  );

  return { job_id: job.id, item_ids: itemIds, prompt, base_prompt, title_hint, cover_hint, reused: false };
});
app.post("/callback/tpy", async (request, reply) => {
  const payload = request.body || {};
  await query(
    "INSERT INTO tpy_callbacks (payload) VALUES ($1)",
    [payload]
  );

  const items = [];
  if (Array.isArray(payload?.songs)) items.push(...payload.songs);
  if (Array.isArray(payload?.instrumentals)) items.push(...payload.instrumentals);

  for (const s of items) {
    const itemId = s?.item_id;
    const audioUrl = s?.audio_url || s?.url;
    const status = s?.status;

    if (itemId && (status === "failed" || status === "part_failed")) {
      await query(
        "UPDATE generation_jobs SET status = 'failed', error = $1 WHERE $2 = ANY(item_ids)",
        [JSON.stringify(s), itemId]
      );
    }

    if (itemId && audioUrl) {
      const existingAsset = await query(
        "SELECT song_id FROM song_assets WHERE item_id = $1 LIMIT 1",
        [itemId]
      );
      if (existingAsset.rows.length > 0) {
        await query(
          "UPDATE song_assets SET audio_url = COALESCE($1, audio_url) WHERE item_id = $2",
          [audioUrl, itemId]
        );
        continue;
      }
      const { rows } = await query(
        "UPDATE generation_jobs SET status = 'done' WHERE $1 = ANY(item_ids) RETURNING id, user_id, prompt, base_prompt, title_hint, cover_hint, tag_ids",
        [itemId]
      );
      if (rows.length > 0) {
        const job = rows[0];
        const coverUrl = s?.cover_url || s?.image_url || s?.cover || null;
        const song = await query(
          "INSERT INTO songs (user_id, prompt, base_prompt, title, cover_url, cover_hint, model, duration, style, generation_mode) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'generated') RETURNING id",
          [
            job.user_id,
            job.prompt,
            job.base_prompt || job.prompt,
            s?.title || job.title_hint || null,
            coverUrl,
            job.cover_hint || null,
            s?.model || null,
            Number.isFinite(Number(s?.duration)) ? Number(s?.duration) : null,
            s?.style || null
          ]
        );
        const songId = song.rows[0].id;
        if (Array.isArray(job.tag_ids) && job.tag_ids.length > 0) {
          for (const tagId of job.tag_ids) {
            await query(
              "INSERT INTO song_tags (song_id, tag_id, relevance) VALUES ($1, $2, 1.0) ON CONFLICT DO NOTHING",
              [songId, tagId]
            );
          }
        }
        await query(
          "INSERT INTO song_assets (song_id, item_id, audio_url) VALUES ($1, $2, $3)",
          [songId, itemId, audioUrl]
        );
        await queueSongForUser(job.user_id, songId, job.id, 'generated');
      }
    }
  }

  reply.send("success");
});

app.post("/feedback", async (request, reply) => {
  const { user_id, song_id, action, played_seconds } = request.body || {};
  if (!user_id || !song_id || !action) {
    reply.code(400).send({ error: "user_id, song_id, action required" });
    return;
  }

  const normalizedAction = String(action).toLowerCase();
  if (!["like", "skip", "complete"].includes(normalizedAction)) {
    reply.code(400).send({ error: "action must be like, skip, or complete" });
    return;
  }

  const songCheck = await query("SELECT id FROM songs WHERE id = $1", [Number(song_id)]);
  if (songCheck.rows.length === 0) {
    reply.code(404).send({ error: "song not found" });
    return;
  }

  const seconds = Number(played_seconds || 0);
  const behavior = normalizedAction === "like" ? "favorite" : normalizedAction === "complete" ? "complete" : "skip";
  const isLateSkip = behavior === "skip" && seconds >= 30;

  try {
    await query(
      "INSERT INTO feedback (user_id, song_id, action, score) VALUES ($1, $2, $3, $4)",
      [Number(user_id), Number(song_id), normalizedAction, behavior === "favorite" ? 1.0 : behavior === "complete" ? 0.4 : -0.7]
    );
  } catch (err) {
    reply.code(500).send({ error: "feedback insert failed", detail: String(err) });
    return;
  }

  await query(
    "UPDATE user_song_queue SET acted_at = NOW(), is_hidden = CASE WHEN $1 = 'skip' THEN true ELSE is_hidden END WHERE user_id = $2 AND song_id = $3 AND COALESCE(is_hidden, false) = false",
    [normalizedAction, Number(user_id), Number(song_id)]
  );

  await ensureUserTagWeights(user_id);
  const { rows } = await query(
    "SELECT tag_id, COALESCE(relevance, 1.0) AS relevance FROM song_tags WHERE song_id = $1",
    [Number(song_id)]
  );

  for (const row of rows) {
    const relevance = Number(row.relevance || 1.0);
    const coef = behavior === "favorite" ? COEF_FAVORITE : behavior === "complete" ? COEF_COMPLETE : isLateSkip ? COEF_SKIP_LATE : COEF_SKIP_EARLY;
    const updateSql = behavior === "favorite" || behavior === "complete"
      ? "UPDATE user_tags SET weight = LEAST(1.0, weight + $1 * $2 * (1 - weight)), update_count = update_count + 1, last_updated = NOW() WHERE user_id = $3 AND tag_id = $4"
      : "UPDATE user_tags SET weight = GREATEST(0.0, weight - $1 * $2 * weight), update_count = update_count + 1, last_updated = NOW() WHERE user_id = $3 AND tag_id = $4";
    try {
      await query(updateSql, [coef, relevance, Number(user_id), row.tag_id]);
    } catch (err) {
      reply.code(500).send({ error: "feedback update failed", detail: String(err) });
      return;
    }
  }

  const totalUpdates = await query(
    "SELECT COALESCE(SUM(update_count), 0) AS total FROM user_tags WHERE user_id = $1",
    [Number(user_id)]
  );
  const total = Number(totalUpdates.rows[0]?.total || 0);
  if (total > 0 && total % NORMALIZE_EVERY === 0) {
    await normalizeUserWeights(user_id);
  }

  return { ok: true };
});

app.get("/songs", async (request, reply) => {
  const { user_id } = request.query || {};
  if (!user_id) {
    reply.code(400).send({ error: "user_id required" });
    return;
  }
  const { rows } = await query(
    "SELECT DISTINCT ON (q.song_id) s.id, s.title, s.cover_url, s.prompt, sa.audio_url, q.created_at, q.source FROM user_song_queue q JOIN songs s ON s.id = q.song_id LEFT JOIN LATERAL (SELECT audio_url FROM song_assets WHERE song_id = s.id ORDER BY id DESC LIMIT 1) sa ON true WHERE q.user_id = $1 AND COALESCE(q.is_hidden, false) = false ORDER BY q.song_id, q.created_at DESC",
    [Number(user_id)]
  );
  rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return { items: rows.slice(-50) };
});

const port = Number(process.env.PORT || 8080);
app.listen({ port, host: "0.0.0.0" });






