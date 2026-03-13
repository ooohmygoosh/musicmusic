import "dotenv/config";
import Fastify from "fastify";
import { query } from "./db.js";

const app = Fastify({ logger: true });

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const TPY_BASE_URL = process.env.TPY_BASE_URL || "https://api.tianpuyue.cn";
const TPY_API_KEY = process.env.TPY_API_KEY || "";

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

app.get("/admin/feedback", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { user_id } = request.query || {};
  const { rows } = await query(
    "SELECT * FROM feedback WHERE ($1::int IS NULL OR user_id = $1) ORDER BY created_at DESC LIMIT 200",
    [user_id ? Number(user_id) : null]
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
  await query("DELETE FROM user_tags WHERE user_id = $1", [user_id]);
  for (const tagId of tag_ids) {
    await query(
      "INSERT INTO user_tags (user_id, tag_id, weight) VALUES ($1, $2, 1.0)",
      [user_id, tagId]
    );
  }
  return { ok: true };
});

function pickTagsWeighted(tags, maxCount) {
  const pool = [...tags];
  const picked = [];
  const total = () => pool.reduce((sum, t) => sum + t.weight, 0);
  while (pool.length > 0 && picked.length < maxCount) {
    const r = Math.random() * total();
    let acc = 0;
    let idx = 0;
    for (; idx < pool.length; idx += 1) {
      acc += pool[idx].weight;
      if (acc >= r) break;
    }
    const chosen = pool.splice(idx, 1)[0];
    picked.push(chosen);
  }
  return picked;
}

async function buildPrompt(userId) {
  const { rows } = await query(
    "SELECT t.name, t.type, ut.weight FROM user_tags ut JOIN tags t ON t.id = ut.tag_id WHERE ut.user_id = $1 AND t.is_active = true",
    [userId]
  );
  if (rows.length === 0) return "";

  // 80% exploitation + 20% exploration
  const sorted = [...rows].sort((a, b) => b.weight - a.weight);
  const topCount = Math.max(1, Math.ceil(rows.length * 0.8));
  const exploreCount = Math.max(1, Math.ceil(rows.length * 0.2));
  const top = sorted.slice(0, topCount);
  const explore = pickTagsWeighted(sorted.slice(topCount), exploreCount);
  const chosen = [...top, ...explore];

  const byType = new Map();
  for (const tag of chosen) {
    const list = byType.get(tag.type) || [];
    list.push(tag.name);
    byType.set(tag.type, list);
  }

  const parts = [];
  for (const [type, list] of byType.entries()) {
    parts.push(`${type}: ${list.join(", ")}`);
  }
  return parts.join(", ");
}

app.post("/generate", async (request, reply) => {
  const { user_id, instrumental = true, model } = request.body || {};
  if (!user_id) {
    reply.code(400).send({ error: "user_id required" });
    return;
  }

  const prompt = await buildPrompt(user_id);
  if (!prompt) {
    reply.code(400).send({ error: "no tags found for user" });
    return;
  }

  const { rows } = await query(
    "INSERT INTO generation_jobs (user_id, prompt, status) VALUES ($1, $2, 'pending') RETURNING *",
    [user_id, prompt]
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

  const payload = {
    model: model || "TemPolor v3",
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
});app.post("/callback/tpy", async (request, reply) => {
  // Store callback payload for traceability
  const payload = request.body || {};
  await query(
    "INSERT INTO tpy_callbacks (payload) VALUES ($1)",
    [payload]
  );

  const songs = Array.isArray(payload?.songs) ? payload.songs : [];
  for (const s of songs) {
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
      const { rows } = await query(
        "UPDATE generation_jobs SET status = 'done' WHERE $1 = ANY(item_ids) RETURNING id, user_id, prompt",
        [itemId]
      );
      if (rows.length > 0) {
        const job = rows[0];
        const song = await query(
          "INSERT INTO songs (user_id, prompt) VALUES ($1, $2) RETURNING id",
          [job.user_id, job.prompt]
        );
        await query(
          "INSERT INTO song_assets (song_id, item_id, audio_url) VALUES ($1, $2, $3)",
          [song.rows[0].id, itemId, audioUrl]
        );
      }
    }
  }

  reply.send("success");
});app.post("/feedback", async (request, reply) => {
  const { user_id, song_id, action } = request.body || {};
  if (!user_id || !song_id || !action) {
    reply.code(400).send({ error: "user_id, song_id, action required" });
    return;
  }

  const score = action === "like" ? 1.0 : action === "skip" ? -0.7 : 0;
  await query(
    "INSERT INTO feedback (user_id, song_id, action, score) VALUES ($1, $2, $3, $4)",
    [user_id, song_id, action, score]
  );

  const { rows } = await query(
    "SELECT tag_id FROM song_tags WHERE song_id = $1",
    [song_id]
  );
  for (const row of rows) {
    await query(
      "UPDATE user_tags SET weight = GREATEST(0.1, weight + $1), updated_at = NOW() WHERE user_id = $2 AND tag_id = $3",
      [score, user_id, row.tag_id]
    );
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
    "SELECT s.id, s.prompt, sa.audio_url\n     FROM songs s\n     LEFT JOIN LATERAL (\n       SELECT audio_url FROM song_assets WHERE song_id = s.id ORDER BY id DESC LIMIT 1\n     ) sa ON true\n     WHERE s.user_id = $1\n     ORDER BY s.created_at DESC\n     LIMIT 50",
    [user_id]
  );
  return { items: rows };
});

const port = Number(process.env.PORT || 8080);
app.listen({ port, host: "0.0.0.0" });


