import "dotenv/config";
import Fastify from "fastify";
import { query } from "./db.js";

const app = Fastify({ logger: true });

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const TPY_BASE_URL = process.env.TPY_BASE_URL || "https://api.tianpuyue.cn";
const TPY_API_KEY = process.env.TPY_API_KEY || "";

const DEFAULT_TAG_WEIGHT = 0.3;
const SELECTED_TAG_WEIGHT = 0.7;
const COEF_FAVORITE = 0.15;
const COEF_SKIP_EARLY = 0.2;
const COEF_SKIP_LATE = 0.1;
const COEF_COMPLETE = 0.05;
const NORMALIZE_EVERY = 10;
const MAX_TAGS_TOTAL = 6;
const MAX_PER_TYPE = 2;

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
  const { name, type } = request.body || {};
  if (!name || !type) {
    reply.code(400).send({ error: "name and type required" });
    return;
  }
  const { rows } = await query(
    "INSERT INTO tags (name, type) VALUES ($1, $2) RETURNING *",
    [name, type]
  );
  return { item: rows[0] };
});

app.patch("/admin/tags/:id", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { id } = request.params;
  const { name, type, is_active } = request.body || {};
  const { rows } = await query(
    "UPDATE tags SET name = COALESCE($1, name), type = COALESCE($2, type), is_active = COALESCE($3, is_active) WHERE id = $4 RETURNING *",
    [name, type, is_active, id]
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

app.get("/admin/user-summary", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { rows } = await query(
    "SELECT u.id, u.device_id, u.created_at, COUNT(f.id)::int AS feedback_count, COUNT(*) FILTER (WHERE f.action = 'like')::int AS like_count, COUNT(*) FILTER (WHERE f.action = 'skip')::int AS skip_count FROM users u LEFT JOIN feedback f ON f.user_id = u.id GROUP BY u.id ORDER BY u.created_at DESC"
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
      tags_active: tagsActive.rows[0]?.count || 0
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

app.post("/users", async (request, reply) => {
  const { device_id } = request.body || {};
  if (!device_id) {
    reply.code(400).send({ error: "device_id required" });
    return;
  }
  const { rows } = await query(
    "INSERT INTO users (device_id) VALUES ($1) ON CONFLICT (device_id) DO UPDATE SET device_id = EXCLUDED.device_id RETURNING *",
    [device_id]
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
  if (rows.length === 0) return { prompt: "", tagIds: [] };

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
  return { prompt: parts.join(", "), tagIds };
}

app.post("/generate", async (request, reply) => {
  const { user_id, instrumental = true, model } = request.body || {};
  if (!user_id) {
    reply.code(400).send({ error: "user_id required" });
    return;
  }

  const { prompt, tagIds } = await buildPrompt(user_id);
  if (!prompt) {
    reply.code(400).send({ error: "no tags found for user" });
    return;
  }

  const { rows } = await query(
    "INSERT INTO generation_jobs (user_id, prompt, status, tag_ids) VALUES ($1, $2, 'pending', $3) RETURNING *",
    [user_id, prompt, tagIds]
  );
  const job = rows[0];

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

  return { job_id: job.id, item_ids: itemIds, prompt };
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
        "UPDATE generation_jobs SET status = 'done' WHERE $1 = ANY(item_ids) RETURNING id, user_id, prompt, tag_ids",
        [itemId]
      );
      if (rows.length > 0) {
        const job = rows[0];
        const coverUrl = s?.cover_url || s?.image_url || s?.cover || null;
        const song = await query(
          "INSERT INTO songs (user_id, prompt, title, cover_url, model, duration, style) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
          [
            job.user_id,
            job.prompt,
            s?.title || null,
            coverUrl,
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
  let behavior = "skip";
  if (normalizedAction === "like") behavior = "favorite";
  if (normalizedAction === "complete") behavior = "complete";
  if (normalizedAction === "skip") behavior = "skip";

  const seconds = Number(played_seconds || 0);
  const isLateSkip = behavior === "skip" && seconds >= 30;
  const isEarlySkip = behavior === "skip" && seconds > 0 && seconds < 30;

  await query(
    "INSERT INTO feedback (user_id, song_id, action, score) VALUES ($1, $2, $3, $4)",
    [user_id, song_id, action, behavior === "favorite" ? 1.0 : behavior === "complete" ? 0.4 : -0.7]
  );

  await ensureUserTagWeights(user_id);

  const { rows } = await query(
    "SELECT tag_id, COALESCE(relevance, 1.0) AS relevance FROM song_tags WHERE song_id = $1",
    [song_id]
  );

  for (const row of rows) {
    const relevance = Number(row.relevance || 1.0);
    let updateSql = null;
    if (behavior === "favorite") {
      updateSql =
        "UPDATE user_tags SET weight = LEAST(1.0, weight + $1 * $2 * (1 - weight)), update_count = update_count + 1, last_updated = NOW() WHERE user_id = $3 AND tag_id = $4";
    } else if (behavior === "complete") {
      updateSql =
        "UPDATE user_tags SET weight = LEAST(1.0, weight + $1 * $2 * (1 - weight)), update_count = update_count + 1, last_updated = NOW() WHERE user_id = $3 AND tag_id = $4";
    } else if (isLateSkip) {
      updateSql =
        "UPDATE user_tags SET weight = GREATEST(0.0, weight - $1 * $2 * weight), update_count = update_count + 1, last_updated = NOW() WHERE user_id = $3 AND tag_id = $4";
    } else {
      updateSql =
        "UPDATE user_tags SET weight = GREATEST(0.0, weight - $1 * $2 * weight), update_count = update_count + 1, last_updated = NOW() WHERE user_id = $3 AND tag_id = $4";
    }

    const coef =
      behavior === "favorite"
        ? COEF_FAVORITE
        : behavior === "complete"
        ? COEF_COMPLETE
        : isLateSkip
        ? COEF_SKIP_LATE
        : COEF_SKIP_EARLY;

    await query(updateSql, [coef, relevance, user_id, row.tag_id]);
  }

  const totalUpdates = await query(
    "SELECT COALESCE(SUM(update_count), 0) AS total FROM user_tags WHERE user_id = $1",
    [user_id]
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
    "SELECT s.id, s.title, s.cover_url, s.prompt, sa.audio_url\n     FROM songs s\n     LEFT JOIN LATERAL (\n       SELECT audio_url FROM song_assets WHERE song_id = s.id ORDER BY id DESC LIMIT 1\n     ) sa ON true\n     WHERE s.user_id = $1\n     ORDER BY s.created_at DESC\n     LIMIT 50",
    [user_id]
  );
  return { items: rows };
});

const port = Number(process.env.PORT || 8080);
app.listen({ port, host: "0.0.0.0" });


