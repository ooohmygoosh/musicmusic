import "dotenv/config";
import Fastify from "fastify";
import { query } from "./db.js";

const app = Fastify({ logger: true });

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const TPY_BASE_URL = process.env.TPY_BASE_URL || "https://api.tianpuyue.cn";
const TPY_API_KEY = process.env.TPY_API_KEY || "";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "DeepSeek-V3.2-Exp";
const DEEPSEEK_ENABLED = process.env.DEEPSEEK_ENABLED === "true";
const COVER_IMAGE_API_KEY = process.env.COVER_IMAGE_API_KEY || "";
const COVER_IMAGE_BASE_URL = (process.env.COVER_IMAGE_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3").replace(/\/$/, "");
const COVER_IMAGE_MODEL = process.env.COVER_IMAGE_MODEL || "doubao-seedream-4-0-250828";
const COVER_IMAGE_SIZE = process.env.COVER_IMAGE_SIZE || "1024x1024";
const COVER_IMAGE_ENABLED = process.env.COVER_IMAGE_ENABLED === "true";

const DEFAULT_TAG_WEIGHT = 0.3;
const SELECTED_TAG_WEIGHT = 0.7;
const COEF_FAVORITE = 0.15;
const COEF_SKIP_EARLY = 0.2;
const COEF_SKIP_LATE = 0.1;
const COEF_COMPLETE = 0.05;
const NORMALIZE_EVERY = 10;
const MAX_TAGS_TOTAL = 6;
const MAX_PER_TYPE = 2;
const REUSE_SIMILARITY_MIN = Number(process.env.REUSE_SIMILARITY_MIN || 0.38);
const PREFETCH_REUSE_SIMILARITY_MIN = Number(process.env.PREFETCH_REUSE_SIMILARITY_MIN || 0.28);
const INIT_REUSE_SIMILARITY_MIN = Number(process.env.INIT_REUSE_SIMILARITY_MIN || 0.3);

const PROMPT_GUIDE = {
  "\u60c5\u7eea": "Describe the emotional tone and energy arc.",
  "\u4e50\u5668": "Describe the lead instruments and arrangement texture.",
  "\u98ce\u683c": "Describe genre, era feeling, and production direction.",
  "\u573a\u666f": "Describe listening scene and atmosphere imagery.",
  "\u8282\u594f": "Describe tempo, groove, and pacing.",
  "\u4eba\u58f0": "Describe vocal style, timbre, and performance intensity."
};

const DEEPSEEK_PRODUCT_REQUIREMENTS = [
  "\u8fd9\u662f\u4e00\u4e2a\u901a\u8fc7\u63a8\u8350\u5e2e\u52a9\u7528\u6237\u9010\u6b65\u627e\u5230\u81ea\u5df1\u559c\u6b22\u97f3\u4e50\u7c7b\u578b\u7684\u4ea7\u54c1\u3002",
  "\u8bf7\u4fdd\u7559\u7528\u6237\u6807\u7b7e\u7684\u6838\u5fc3\u542b\u4e49\uff0c\u5e76\u628a\u6807\u7b7e\u81ea\u7136\u878d\u5165\u5230\u6700\u7ec8\u4e2d\u6587\u97f3\u4e50\u751f\u6210\u63d0\u793a\u8bcd\u91cc\u3002",
  "\u8f93\u51fa\u7684\u63d0\u793a\u8bcd\u8981\u66f4\u9002\u5408\u76f4\u63a5\u53d1\u7ed9\u5929\u8c31\u4e50\uff0c\u7528\u4e8e\u751f\u6210\u66f4\u5b8c\u6574\u3001\u66f4\u8010\u542c\u3001\u66f4\u6709\u8bb0\u5fc6\u70b9\u7684\u4f5c\u54c1\u3002",
  "\u8bf7\u8865\u5145\u5408\u7406\u7684\u7f16\u66f2\u3001\u8282\u594f\u3001\u60c5\u7eea\u8d70\u5411\u3001\u6c1b\u56f4\u3001\u4e3b\u526f\u6bb5\u843d\u5c42\u6b21\u548c\u542c\u611f\u63cf\u8ff0\uff0c\u4f46\u4e0d\u8981\u504f\u79bb\u7528\u6237\u6807\u7b7e\u3002",
  "\u5982\u679c\u6807\u7b7e\u504f\u5c11\uff0c\u8bf7\u5728\u4e0d\u8fdd\u80cc\u6807\u7b7e\u7684\u524d\u63d0\u4e0b\u8865\u8db3\u98ce\u683c\u3001\u901f\u5ea6\u3001\u4e50\u5668\u5c42\u6b21\u3001\u573a\u666f\u611f\u3002",
  "\u6807\u9898\u8981\u81ea\u7136\u3001\u7b80\u6d01\u3001\u50cf\u771f\u5b9e\u6b4c\u66f2\u540d\u3002",
  "\u5c01\u9762\u63cf\u8ff0\u8981\u9002\u5408\u540e\u7eed\u505a\u97f3\u4e50\u5c01\u9762\u56fe\uff0c\u7a81\u51fa\u6c1b\u56f4\u548c\u4e3b\u4f53\u610f\u8c61\u3002"
].join(" ");

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

app.get("/admin/tag-blacklist", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { rows } = await query("SELECT * FROM tag_blacklist ORDER BY created_at DESC, id DESC");
  return { items: rows };
});

app.post("/admin/tag-blacklist", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { word, reason } = request.body || {};
  const cleanWord = String(word || "").trim();
  if (!cleanWord) {
    reply.code(400).send({ error: "word required" });
    return;
  }
  const { rows } = await query(
    "INSERT INTO tag_blacklist (word, reason) VALUES ($1, $2) ON CONFLICT (word) DO UPDATE SET reason = COALESCE(EXCLUDED.reason, tag_blacklist.reason) RETURNING *",
    [cleanWord, reason ? String(reason).trim() : null]
  );
  return { item: rows[0] };
});

app.delete("/admin/tag-blacklist/:id", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { id } = request.params;
  await query("DELETE FROM tag_blacklist WHERE id = $1", [Number(id)]);
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

  const user = await query("SELECT id, device_id, display_name, created_at, last_seen_at, is_active FROM users WHERE id = $1", [userId]);

  const favorites = await query(
    "SELECT f.created_at, s.id AS song_id, COALESCE(qm.display_title, s.title) AS title, COALESCE(qm.display_cover_url, s.cover_url) AS cover_url, s.prompt, COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tags, COALESCE(array_remove(array_agg(DISTINCT p.name), NULL), '{}') AS playlists FROM feedback f JOIN songs s ON s.id = f.song_id LEFT JOIN LATERAL (SELECT display_title, display_cover_url FROM user_song_queue q WHERE q.user_id = f.user_id AND q.song_id = s.id AND (q.display_title IS NOT NULL OR q.display_cover_url IS NOT NULL) ORDER BY q.created_at DESC, q.id DESC LIMIT 1) qm ON true LEFT JOIN song_tags st ON st.song_id = s.id LEFT JOIN tags t ON t.id = st.tag_id LEFT JOIN playlist_songs ps ON ps.song_id = s.id LEFT JOIN playlists p ON p.id = ps.playlist_id AND p.user_id = f.user_id WHERE f.user_id = $1 AND f.action = 'like' GROUP BY f.id, s.id, qm.display_title, qm.display_cover_url ORDER BY f.created_at DESC LIMIT 100",
    [userId]
  );

  const songs = await query(
    "SELECT x.song_id, x.title, x.cover_url, x.prompt, x.created_at, x.source, x.tags FROM (SELECT DISTINCT ON (q.id) s.id AS song_id, COALESCE(q.display_title, s.title) AS title, COALESCE(q.display_cover_url, s.cover_url) AS cover_url, s.prompt, q.created_at, q.source, COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tags FROM user_song_queue q JOIN songs s ON s.id = q.song_id LEFT JOIN song_tags st ON st.song_id = s.id LEFT JOIN tags t ON t.id = st.tag_id WHERE q.user_id = $1 GROUP BY q.id, s.id, q.display_title, q.display_cover_url, q.created_at, q.source ORDER BY q.id, q.created_at DESC) x ORDER BY x.created_at DESC LIMIT 100",
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
  const { q, available, type } = request.query || {};
  const search = q ? `%${String(q).trim()}%` : null;
  const availableFilter =
    available === "true" ? true : available === "false" ? false : null;
  const typeFilter = type ? String(type).trim() : null;

  const { rows } = await query(
    "SELECT lib.id, lib.title, lib.cover_url, lib.prompt, lib.base_prompt, lib.cover_hint, lib.model, lib.duration, lib.style, lib.is_available, lib.reuse_count, COUNT(DISTINCT all_s.id)::int AS copies, COUNT(DISTINCT qd.id)::int AS deliveries, COUNT(DISTINCT CASE WHEN f.action = 'like' THEN f.id END)::int AS likes, COUNT(DISTINCT CASE WHEN f.action = 'skip' THEN f.id END)::int AS skips, COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tags, COALESCE(array_remove(array_agg(DISTINCT t.type), NULL), '{}') AS tag_types, COALESCE((array_remove(array_agg(DISTINCT t.type), NULL))[1], 'Uncategorized') AS primary_type, sa.audio_url FROM songs lib LEFT JOIN songs all_s ON COALESCE(all_s.source_song_id, all_s.id) = lib.id LEFT JOIN feedback f ON f.song_id = all_s.id LEFT JOIN user_song_queue qd ON qd.song_id = all_s.id LEFT JOIN song_tags st ON st.song_id = lib.id LEFT JOIN tags t ON t.id = st.tag_id LEFT JOIN LATERAL (SELECT audio_url FROM song_assets WHERE song_id = lib.id ORDER BY id DESC LIMIT 1) sa ON true WHERE lib.source_song_id IS NULL AND ($1::text IS NULL OR lib.title ILIKE $1 OR lib.prompt ILIKE $1 OR lib.base_prompt ILIKE $1 OR EXISTS (SELECT 1 FROM song_tags st2 JOIN tags t2 ON t2.id = st2.tag_id WHERE st2.song_id = lib.id AND (t2.name ILIKE $1 OR t2.type ILIKE $1))) AND ($2::boolean IS NULL OR lib.is_available = $2) AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM song_tags st3 JOIN tags t3 ON t3.id = st3.tag_id WHERE st3.song_id = lib.id AND t3.type = $3)) GROUP BY lib.id, sa.audio_url ORDER BY likes DESC, lib.reuse_count DESC, deliveries DESC, lib.created_at DESC LIMIT 300",
    [search, availableFilter, typeFilter]
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

  const allowedTagIds = [];
  for (const tagId of tag_ids) {
    const tagLookup = await query("SELECT id, name FROM tags WHERE id = $1 LIMIT 1", [Number(tagId)]);
    const tag = tagLookup.rows[0];
    if (!tag) continue;
    if (await isBlockedTag(tag.name)) continue;
    allowedTagIds.push(Number(tag.id));
  }

  if (allowedTagIds.length === 0) {
    reply.code(400).send({ error: "all selected tags are blocked" });
    return;
  }

  await ensureUserTagWeights(user_id);

  await query(
    "UPDATE user_tags SET weight = $1, initial_weight = $1, update_count = 0, last_updated = NOW() WHERE user_id = $2 AND tag_id = ANY($3)",
    [SELECTED_TAG_WEIGHT, user_id, allowedTagIds]
  );

  await normalizeUserWeights(user_id);

  const seededSongs = await findReusableSongs(user_id, allowedTagIds, 4, INIT_REUSE_SIMILARITY_MIN);
  for (const song of seededSongs) {
    await queueSongForUser(user_id, song.id, null, 'seeded');
    await query("UPDATE songs SET reuse_count = reuse_count + 1 WHERE id = $1", [Number(song.id)]);
  }

  return {
    ok: true,
    seeded_song_ids: seededSongs.map((song) => Number(song.id))
  };
});

app.post("/user-tags", async (request, reply) => {
  const { user_id, name, type } = request.body || {};
  if (!user_id || !name) {
    reply.code(400).send({ error: "user_id and name required" });
    return;
  }
  const cleanName = String(name).trim();
  const cleanType = type ? String(type).trim() : "";
  if (!cleanName) {
    reply.code(400).send({ error: "name required" });
    return;
  }
  if (await isBlockedTag(cleanName)) {
    reply.code(400).send({ error: "tag blocked by blacklist" });
    return;
  }

  let existing = await query(
    cleanType
      ? "SELECT id, name, type FROM tags WHERE LOWER(name) = LOWER($1) AND LOWER(type) = LOWER($2) LIMIT 1"
      : "SELECT id, name, type FROM tags WHERE LOWER(name) = LOWER($1) ORDER BY is_system DESC, sort_order ASC, id ASC LIMIT 1",
    cleanType ? [cleanName, cleanType] : [cleanName]
  );

  let tag = existing.rows[0];
  if (!tag) {
    if (!cleanType) {
      reply.code(400).send({ error: "type required for new tag" });
      return;
    }
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
  const parsedWeight = Number(weight);
  if (!user_id || !tag_id || !Number.isFinite(parsedWeight)) {
    reply.code(400).send({ error: "user_id, tag_id, weight required" });
    return;
  }
  const clamped = Math.max(0, Math.min(1, parsedWeight));
  const isActive = clamped > 0;
  const { rows } = await query(
    "UPDATE user_tags SET weight = $1, is_active = $2, last_updated = NOW() WHERE user_id = $3 AND tag_id = $4 RETURNING user_id, tag_id, weight, is_active, last_updated",
    [clamped, isActive, Number(user_id), Number(tag_id)]
  );
  if (!rows[0]) {
    reply.code(404).send({ error: "user tag relation not found" });
    return;
  }
  return { ok: true, item: rows[0] };
});

app.get("/favorites", async (request, reply) => {
  const { user_id } = request.query || {};
  if (!user_id) {
    reply.code(400).send({ error: "user_id required" });
    return;
  }
  const { rows } = await query(
    "SELECT s.id, COALESCE(qm.display_title, s.title) AS title, COALESCE(qm.display_cover_url, s.cover_url) AS cover_url, s.prompt, sa.audio_url, f.created_at, COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tags FROM feedback f JOIN songs s ON s.id = f.song_id LEFT JOIN LATERAL (SELECT display_title, display_cover_url FROM user_song_queue q WHERE q.user_id = f.user_id AND q.song_id = s.id AND (q.display_title IS NOT NULL OR q.display_cover_url IS NOT NULL) ORDER BY q.created_at DESC, q.id DESC LIMIT 1) qm ON true LEFT JOIN LATERAL (SELECT audio_url FROM song_assets WHERE song_id = s.id ORDER BY id DESC LIMIT 1) sa ON true LEFT JOIN song_tags st ON st.song_id = s.id LEFT JOIN tags t ON t.id = st.tag_id WHERE f.user_id = $1 AND f.action = 'like' GROUP BY s.id, qm.display_title, qm.display_cover_url, sa.audio_url, f.created_at ORDER BY f.created_at DESC LIMIT 100",
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
    "SELECT s.id, COALESCE(qm.display_title, s.title) AS title, COALESCE(qm.display_cover_url, s.cover_url) AS cover_url, s.prompt, sa.audio_url, ps.created_at, COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tags FROM playlist_songs ps JOIN playlists p ON p.id = ps.playlist_id JOIN songs s ON s.id = ps.song_id LEFT JOIN LATERAL (SELECT display_title, display_cover_url FROM user_song_queue q WHERE q.user_id = p.user_id AND q.song_id = s.id AND (q.display_title IS NOT NULL OR q.display_cover_url IS NOT NULL) ORDER BY q.created_at DESC, q.id DESC LIMIT 1) qm ON true LEFT JOIN LATERAL (SELECT audio_url FROM song_assets WHERE song_id = s.id ORDER BY id DESC LIMIT 1) sa ON true LEFT JOIN song_tags st ON st.song_id = s.id LEFT JOIN tags t ON t.id = st.tag_id WHERE ps.playlist_id = $1 GROUP BY s.id, qm.display_title, qm.display_cover_url, sa.audio_url, ps.created_at ORDER BY ps.created_at DESC",
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
    app.log.info(
      {
        model: DEEPSEEK_MODEL,
        base_prompt: basePrompt,
        tags: tagSummary
      },
      "deepseek prompt optimization started"
    );

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
              "\u4f60\u662f\u97f3\u4e50\u751f\u6210\u63d0\u793a\u8bcd\u4f18\u5316\u52a9\u624b\u3002\u4f60\u7684\u4efb\u52a1\u662f\u6839\u636e\u7528\u6237\u6807\u7b7e\u548c\u4ea7\u54c1\u9700\u6c42\uff0c\u628a\u6807\u7b7e\u6574\u7406\u6210\u66f4\u9002\u5408\u76f4\u63a5\u53d1\u9001\u7ed9\u5929\u8c31\u4e50\u7684\u4e2d\u6587\u97f3\u4e50\u751f\u6210\u63d0\u793a\u8bcd\u3002\u4e0d\u8981\u89e3\u91ca\uff0c\u4e0d\u8981\u8f93\u51fa Markdown\uff0c\u53ea\u8fd4\u56de JSON\u3002"
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "\u6839\u636e\u4ea7\u54c1\u9700\u6c42\u548c\u7528\u6237\u6807\u7b7e\uff0c\u751f\u6210\u66f4\u9002\u5408\u53d1\u9001\u7ed9\u5929\u8c31\u4e50\u7684\u4e2d\u6587\u97f3\u4e50 prompt",
              product_requirements: DEEPSEEK_PRODUCT_REQUIREMENTS,
              base_prompt: basePrompt,
              tags: tagSummary,
              grouped_tags: groupedGuide,
              output_schema: {
                prompt: "1-3 \u53e5\u4e2d\u6587\u97f3\u4e50\u751f\u6210\u63d0\u793a\u8bcd\uff0c\u76f4\u63a5\u53d1\u9001\u7ed9\u5929\u8c31\u4e50",
                title_hint: "\u7b80\u77ed\u81ea\u7136\u7684\u4e2d\u6587\u6b4c\u540d\u5efa\u8bae",
                cover_hint: "\u9002\u5408\u4f5c\u4e3a\u6b4c\u66f2\u5c01\u9762\u7684\u4e2d\u6587\u753b\u9762\u63cf\u8ff0"
              },
              constraints: [
                "\u4fdd\u7559\u6807\u7b7e\u6838\u5fc3\u542b\u4e49\u5e76\u81ea\u7136\u878d\u5165 prompt",
                "\u8865\u5145\u5408\u7406\u7684\u66f2\u98ce\u3001\u8282\u594f\u3001\u7f16\u66f2\u5c42\u6b21\u3001\u60c5\u7eea\u8d70\u5411\u3001\u6c1b\u56f4\u548c\u573a\u666f",
                "\u4e0d\u8981\u8f93\u51fa\u5217\u8868\uff0c\u4e0d\u8981\u89e3\u91ca",
                "\u63d0\u793a\u8bcd\u63a7\u5236\u5728 180 \u4e2a\u4e2d\u6587\u5b57\u7b26\u4ee5\u5185"
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

    const result = {
      prompt: String(parsed?.prompt || "").trim() || basePrompt,
      title_hint: String(parsed?.title_hint || "").trim(),
      cover_hint: String(parsed?.cover_hint || "").trim()
    };

    app.log.info({ model: DEEPSEEK_MODEL, result }, "deepseek prompt optimization succeeded");
    return result;
  } catch (error) {
    app.log.warn({ err: String(error) }, "deepseek prompt optimization error");
    return { prompt: basePrompt, title_hint: "", cover_hint: "" };
  }
}

function normalizeTitle(title, fallback = null) {
  const value = String(title || "").trim();
  if (!value) return fallback;
  return value.slice(0, 40);
}

function buildCoverPrompt({ title, coverHint, prompt }) {
  const parts = [
    String(coverHint || "").trim(),
    title ? "单曲名：《" + title + "》。" : "",
    "请生成一张正方形音乐封面插图，不要任何文字、logo、水印或排版。",
    "只保留一个明确主体与氛围背景，突出色彩、光感、层次和情绪，适合音乐流媒体封面。",
    prompt ? "音乐气质参考：" + String(prompt).trim() : ""
  ];
  return parts.filter(Boolean).join(" ");
}

async function generateCoverImage({ title, coverHint, prompt }) {
  if (!COVER_IMAGE_ENABLED || !COVER_IMAGE_API_KEY || !String(coverHint || "").trim()) return null;

  try {
    const response = await fetch(COVER_IMAGE_BASE_URL + "/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + COVER_IMAGE_API_KEY
      },
      body: JSON.stringify({
        model: COVER_IMAGE_MODEL,
        prompt: buildCoverPrompt({ title, coverHint, prompt }),
        size: COVER_IMAGE_SIZE,
        response_format: "url",
        watermark: false
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      app.log.warn({ status: response.status, data }, "cover generation failed");
      return null;
    }

    const asset = data?.data?.[0] || data?.images?.[0] || data?.output?.[0] || data?.result || null;
    const url = typeof asset?.url === "string" && asset.url.trim() ? asset.url.trim() : null;
    const b64 = typeof asset?.b64_json === "string" && asset.b64_json.trim()
      ? "data:image/png;base64," + asset.b64_json.trim()
      : null;
    const coverUrl = url || b64;

    if (!coverUrl) {
      app.log.warn({ data }, "cover generation returned no image asset");
      return null;
    }

    return {
      cover_url: coverUrl,
      provider_model: data?.model || COVER_IMAGE_MODEL
    };
  } catch (error) {
    app.log.warn({ err: String(error) }, "cover generation error");
    return null;
  }
}

async function getGenerationJobDetail(jobId) {
  const { rows } = await query(
    "SELECT g.id, g.user_id, g.prompt, g.base_prompt, g.title_hint, g.cover_hint, g.status, g.error, g.item_ids, g.created_at, s.id AS song_id, COALESCE(q.display_title, s.title) AS title, COALESCE(q.display_cover_url, s.cover_url) AS cover_url, sa.audio_url, q.source, COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tags FROM generation_jobs g LEFT JOIN LATERAL (SELECT id, song_id, source, display_title, display_cover_url FROM user_song_queue WHERE generation_job_id = g.id ORDER BY created_at DESC, id DESC LIMIT 1) q ON true LEFT JOIN songs s ON s.id = q.song_id LEFT JOIN LATERAL (SELECT audio_url FROM song_assets WHERE song_id = s.id ORDER BY id DESC LIMIT 1) sa ON true LEFT JOIN song_tags st ON st.song_id = s.id LEFT JOIN tags t ON t.id = st.tag_id WHERE g.id = $1 GROUP BY g.id, s.id, q.display_title, q.display_cover_url, sa.audio_url, q.source ORDER BY s.id DESC NULLS LAST LIMIT 1",
    [Number(jobId)]
  );
  return rows[0] || null;
}

async function isBlockedTag(name) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return false;
  const { rows } = await query(
    "SELECT id FROM tag_blacklist WHERE LOWER(word) = LOWER($1) LIMIT 1",
    [cleanName]
  );
  return rows.length > 0;
}
async function getUserExcludedSongIds(userId) {
  const { rows } = await query(
    "SELECT DISTINCT song_id FROM (SELECT song_id, created_at FROM user_song_queue WHERE user_id = $1 ORDER BY created_at DESC LIMIT 12) recent UNION SELECT DISTINCT song_id FROM feedback WHERE user_id = $1 AND action = 'skip' ORDER BY song_id",
    [Number(userId)]
  );
  return rows.map((row) => Number(row.song_id)).filter(Boolean);
}

async function queueSongForUser(userId, songId, jobId, source, options = {}) {
  const { displayTitle = null, displayCoverUrl = null } = options;
  const { rows } = await query(
    "INSERT INTO user_song_queue (user_id, song_id, generation_job_id, source, display_title, display_cover_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    [
      Number(userId),
      Number(songId),
      jobId ? Number(jobId) : null,
      source,
      displayTitle || null,
      displayCoverUrl || null
    ]
  );
  return rows[0] || null;
}

async function findReusableSongs(userId, tagIds, limit = 1, threshold = REUSE_SIMILARITY_MIN) {
  if (!Array.isArray(tagIds) || tagIds.length === 0) return [];
  const excludedSongIds = await getUserExcludedSongIds(userId);
  const { rows } = await query(
    "SELECT s.id, s.title, s.cover_url, s.cover_hint, s.prompt, s.model, s.duration, s.style, s.reuse_count, COUNT(DISTINCT st.tag_id)::int AS song_tag_count, COUNT(DISTINCT CASE WHEN st.tag_id = ANY($1::int[]) THEN st.tag_id END)::int AS matched_tag_count, (COUNT(DISTINCT CASE WHEN st.tag_id = ANY($1::int[]) THEN st.tag_id END)::float / GREATEST(COUNT(DISTINCT st.tag_id), $2)) AS similarity FROM songs s JOIN song_assets sa ON sa.song_id = s.id AND sa.audio_url IS NOT NULL LEFT JOIN song_tags st ON st.song_id = s.id WHERE s.source_song_id IS NULL AND COALESCE(s.is_available, true) = true AND ($4::int[] = '{}'::int[] OR NOT (s.id = ANY($4::int[]))) GROUP BY s.id HAVING COUNT(DISTINCT CASE WHEN st.tag_id = ANY($1::int[]) THEN st.tag_id END) > 0 AND (COUNT(DISTINCT CASE WHEN st.tag_id = ANY($1::int[]) THEN st.tag_id END)::float / GREATEST(COUNT(DISTINCT st.tag_id), $2)) >= $3 ORDER BY similarity DESC, matched_tag_count DESC, s.reuse_count DESC, s.created_at DESC LIMIT $5",
    [tagIds, tagIds.length, threshold, excludedSongIds, Number(limit)]
  );
  const result = [];
  for (const row of rows) {
    const asset = await query(
      "SELECT item_id, audio_url FROM song_assets WHERE song_id = $1 ORDER BY id DESC LIMIT 1",
      [row.id]
    );
    if (asset.rows[0]) result.push({ ...row, asset: asset.rows[0] });
  }
  return result;
}

async function findReusableSong(userId, tagIds, threshold = REUSE_SIMILARITY_MIN) {
  const rows = await findReusableSongs(userId, tagIds, 1, threshold);
  return rows[0] || null;
}
async function reuseSongForUser(job, librarySong) {
  const displayTitle = normalizeTitle(job.title_hint || librarySong.title || null, librarySong.title || null);
  const generatedCover = await generateCoverImage({
    title: displayTitle || librarySong.title || null,
    coverHint: job.cover_hint || librarySong.cover_hint || librarySong.prompt || job.prompt,
    prompt: job.prompt || librarySong.prompt || null
  });
  const displayCoverUrl = generatedCover?.cover_url || librarySong.cover_url || null;

  await queueSongForUser(job.user_id, librarySong.id, job.id, 'reused', {
    displayTitle,
    displayCoverUrl
  });

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
  const { user_id, instrumental = true, model, prefetch = false } = request.body || {};
  if (!user_id) {
    reply.code(400).send({ error: "user_id required" });
    return;
  }

  const activeJobLookup = await query(
    "SELECT id FROM generation_jobs WHERE user_id = $1 AND status IN ('pending', 'submitted') ORDER BY id DESC LIMIT 1",
    [Number(user_id)]
  );
  if (activeJobLookup.rows[0]?.id) {
    const activeJob = await getGenerationJobDetail(activeJobLookup.rows[0].id);
    return {
      job_id: Number(activeJobLookup.rows[0].id),
      existing: true,
      status: activeJob?.status || 'pending',
      prompt: activeJob?.prompt || null,
      base_prompt: activeJob?.base_prompt || null,
      title_hint: activeJob?.title_hint || null,
      cover_hint: activeJob?.cover_hint || null,
      song_id: activeJob?.song_id || null,
      song: activeJob?.song_id ? {
        id: activeJob.song_id,
        title: activeJob.title,
        cover_url: activeJob.cover_url,
        audio_url: activeJob.audio_url,
        tags: activeJob.tags || []
      } : null
    };
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

  const reusableSong = await findReusableSong(
    user_id,
    tagIds,
    prefetch ? PREFETCH_REUSE_SIMILARITY_MIN : REUSE_SIMILARITY_MIN
  );
  if (reusableSong) {
    const songId = await reuseSongForUser(job, reusableSong);
    return {
      job_id: job.id,
      item_ids: reusableSong.asset.item_id ? [reusableSong.asset.item_id] : [],
      prompt,
      reused: true,
      song_id: songId,
      matched_song_id: reusableSong.id,
      similarity: Number(reusableSong.similarity || 0),
      status: 'reused'
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

  return { job_id: job.id, item_ids: itemIds, prompt, base_prompt, title_hint, cover_hint, reused: false, status: 'submitted' };
});

app.get("/generation-jobs/:id", async (request, reply) => {
  const { id } = request.params;
  const detail = await getGenerationJobDetail(id);
  if (!detail) {
    reply.code(404).send({ error: "generation job not found" });
    return;
  }
  return {
    item: {
      id: detail.id,
      user_id: detail.user_id,
      status: detail.status,
      prompt: detail.prompt,
      base_prompt: detail.base_prompt,
      title_hint: detail.title_hint,
      cover_hint: detail.cover_hint,
      error: detail.error,
      item_ids: detail.item_ids || [],
      created_at: detail.created_at,
      song: detail.song_id ? {
        id: detail.song_id,
        title: detail.title,
        cover_url: detail.cover_url,
        audio_url: detail.audio_url,
        tags: detail.tags || [],
        source: detail.source || null
      } : null
    }
  };
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
        const displayTitle = normalizeTitle(job.title_hint || s?.title || null, s?.title || null);
        const generatedCover = await generateCoverImage({
          title: displayTitle,
          coverHint: job.cover_hint || job.prompt,
          prompt: job.prompt
        });
        const coverUrl = generatedCover?.cover_url || s?.cover_url || s?.image_url || s?.cover || null;
        const song = await query(
          "INSERT INTO songs (user_id, prompt, base_prompt, title, cover_url, cover_hint, model, duration, style, generation_mode) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'generated') RETURNING id",
          [
            job.user_id,
            job.prompt,
            job.base_prompt || job.prompt,
            displayTitle,
            coverUrl,
            job.cover_hint || null,
            generatedCover?.provider_model || s?.model || null,
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
        await queueSongForUser(job.user_id, songId, job.id, 'generated', {
          displayTitle,
          displayCoverUrl: coverUrl
        });
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
    "UPDATE user_song_queue SET acted_at = NOW(), is_hidden = CASE WHEN $1 IN ('skip', 'complete') THEN true ELSE is_hidden END WHERE user_id = $2 AND song_id = $3 AND COALESCE(is_hidden, false) = false",
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
      ? "UPDATE user_tags SET weight = LEAST(1.0, weight + $1::numeric * $2::numeric * (1 - weight)), update_count = update_count + 1, last_updated = NOW() WHERE user_id = $3 AND tag_id = $4"
      : "UPDATE user_tags SET weight = GREATEST(0.0, weight - $1::numeric * $2::numeric * weight), update_count = update_count + 1, last_updated = NOW() WHERE user_id = $3 AND tag_id = $4";
    try {
      await query(updateSql, [coef, relevance, Number(user_id), row.tag_id]);
    } catch (err) {
      request.log.error({ err: String(err), user_id, song_id, action: normalizedAction, tag_id: row.tag_id }, "feedback weight update failed");
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
  const { user_id, include_history } = request.query || {};
  if (!user_id) {
    reply.code(400).send({ error: "user_id required" });
    return;
  }
  const includeHistory = String(include_history || "").toLowerCase() === "true";
  const { rows } = await query(
    "SELECT q.id AS queue_id, s.id, COALESCE(q.display_title, s.title) AS title, COALESCE(q.display_cover_url, s.cover_url) AS cover_url, s.prompt, sa.audio_url, q.created_at, q.source, COALESCE(q.is_hidden, false) AS is_hidden, q.acted_at, COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tags FROM user_song_queue q JOIN songs s ON s.id = q.song_id LEFT JOIN LATERAL (SELECT audio_url FROM song_assets WHERE song_id = s.id ORDER BY id DESC LIMIT 1) sa ON true LEFT JOIN song_tags st ON st.song_id = s.id LEFT JOIN tags t ON t.id = st.tag_id WHERE q.user_id = $1 AND ($2::boolean = true OR COALESCE(q.is_hidden, false) = false) GROUP BY q.id, s.id, q.display_title, q.display_cover_url, s.prompt, sa.audio_url, q.created_at, q.source, q.is_hidden, q.acted_at ORDER BY q.created_at ASC, q.id ASC",
    [Number(user_id), includeHistory]
  );
  return { items: rows.slice(-50) };
});

const port = Number(process.env.PORT || 8080);
app.listen({ port, host: "0.0.0.0" });


