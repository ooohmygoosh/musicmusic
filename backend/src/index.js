import "dotenv/config";
import crypto from "crypto";
import Fastify from "fastify";
import { query, withTransaction } from "./db.js";

const app = Fastify({ logger: true });

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const TPY_BASE_URL = process.env.TPY_BASE_URL || "https://api.tianpuyue.cn";
const TPY_API_KEY = process.env.TPY_API_KEY || "";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "DeepSeek-V3.2-Exp";
const DEEPSEEK_ENABLED = process.env.DEEPSEEK_ENABLED !== "false";
const COVER_IMAGE_API_KEY = process.env.COVER_IMAGE_API_KEY || "";
const COVER_IMAGE_BASE_URL = (process.env.COVER_IMAGE_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3").replace(/\/$/, "");
const COVER_IMAGE_MODEL = process.env.COVER_IMAGE_MODEL || "doubao-seedream-4-0-250828";
const COVER_IMAGE_SIZE = process.env.COVER_IMAGE_SIZE || "1024x1024";
const COVER_IMAGE_ENABLED = process.env.COVER_IMAGE_ENABLED === "true";
const CREATOR_EARNING_PER_DELIVERY = Number(process.env.CREATOR_EARNING_PER_DELIVERY || 0.02);
const CREATOR_EARNING_PER_LIKE = Number(process.env.CREATOR_EARNING_PER_LIKE || 0.2);

const MIN_RAW_SCORE = Number(process.env.MIN_RAW_SCORE || -50);
const DEFAULT_TAG_RAW_SCORE = Number(process.env.DEFAULT_TAG_RAW_SCORE || 0);
const SELECTED_TAG_RAW_SCORE = Number(process.env.SELECTED_TAG_RAW_SCORE || 18);
const ANCHOR_TAG_RAW_SCORE = Number(process.env.ANCHOR_TAG_RAW_SCORE || 26);
const ANCHOR_FLOOR = Number(process.env.ANCHOR_FLOOR || 0.3);
const SOFTMAX_TEMPERATURE = Number(process.env.SOFTMAX_TEMPERATURE || 12);
const FAVORITE_RAW_DELTA = Number(process.env.FAVORITE_RAW_DELTA || 11);
const COMPLETE_RAW_DELTA = Number(process.env.COMPLETE_RAW_DELTA || 3.5);
const SKIP_EARLY_RAW_DELTA = Number(process.env.SKIP_EARLY_RAW_DELTA || -8);
const SKIP_LATE_RAW_DELTA = Number(process.env.SKIP_LATE_RAW_DELTA || -4);
const MANUAL_WEIGHT_SCALE = Number(process.env.MANUAL_WEIGHT_SCALE || 36);
const NORMAL_QUEUE_TARGET = Number(process.env.NORMAL_QUEUE_TARGET || 2);
const EXPLORE_QUEUE_TARGET = Number(process.env.EXPLORE_QUEUE_TARGET || 5);
const MAX_TAGS_TOTAL = 6;
const MAX_CORE_TAGS = 3;
const MAX_SUPPORT_TAGS = 2;
const MAX_PER_TYPE = 1;
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

function normalizeAccountId(value) {
  return String(value || "").trim().toLowerCase();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const raw = String(stored || "");
  const [salt, originalHash] = raw.split(":");
  if (!salt || !originalHash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 64).toString("hex");
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(originalHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function ensureRuntimeSchema() {
  await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS display_name TEXT,
      ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS account_id TEXT,
      ADD COLUMN IF NOT EXISTS password_hash TEXT,
      ADD COLUMN IF NOT EXISTS avatar TEXT
  `);
  await query(`
    UPDATE users
    SET account_id = LOWER(device_id)
    WHERE account_id IS NULL AND device_id IS NOT NULL
  `);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account_id_unique ON users(account_id) WHERE account_id IS NOT NULL`);
  await query(`
    ALTER TABLE user_tags
      ADD COLUMN IF NOT EXISTS raw_score NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS softmax_weight NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_anchor BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS anchor_floor NUMERIC DEFAULT 0.3
  `);
  await query(`
    UPDATE user_tags
    SET raw_score = COALESCE(raw_score, ROUND(COALESCE(weight, 0) * 36)),
        softmax_weight = COALESCE(softmax_weight, COALESCE(weight, 0)),
        anchor_floor = COALESCE(anchor_floor, 0.3)
  `);
  await query(`
    ALTER TABLE generation_jobs
      ADD COLUMN IF NOT EXISTS strategy_mode TEXT,
      ADD COLUMN IF NOT EXISTS exploration_level TEXT,
      ADD COLUMN IF NOT EXISTS prompt_debug JSONB
  `);
  await query(`
    ALTER TABLE user_song_queue
      ADD COLUMN IF NOT EXISTS queue_bucket TEXT
  `);
}

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

function normalizeIdList(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
}

function normalizeWordList(values) {
  const raw = Array.isArray(values)
    ? values
    : String(values || "")
      .split(/[\n,\uFF0C;\uFF1B]+/)
      .map((value) => value.trim());
  return [...new Set(raw.map((value) => String(value || "").trim()).filter(Boolean))];
}

function estimateCreatorIncome(deliveries = 0, likes = 0) {
  return Number((Number(deliveries || 0) * CREATOR_EARNING_PER_DELIVERY + Number(likes || 0) * CREATOR_EARNING_PER_LIKE).toFixed(2));
}

async function getUserCreatedSongs(userId, options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit || 100), 200));
  const search = options.search ? `%${String(options.search).trim()}%` : null;
  const { rows } = await query(
    `SELECT lib.id,
      lib.user_id,
      lib.created_at,
      lib.title,
      lib.cover_url,
      lib.prompt,
      lib.base_prompt,
      lib.cover_hint,
      lib.model,
      lib.duration,
      lib.style,
      lib.generation_mode,
      lib.is_available,
      COUNT(DISTINCT delivered.id)::int AS copies,
      COUNT(DISTINCT q.id)::int AS deliveries,
      COUNT(DISTINCT CASE WHEN f.action = 'like' THEN f.id END)::int AS likes,
      COUNT(DISTINCT CASE WHEN f.action = 'skip' THEN f.id END)::int AS skips,
      COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tags,
      COALESCE(array_remove(array_agg(DISTINCT t.type), NULL), '{}') AS tag_types,
      sa.audio_url
    FROM songs lib
    LEFT JOIN songs delivered ON COALESCE(delivered.source_song_id, delivered.id) = lib.id
    LEFT JOIN feedback f ON f.song_id = delivered.id
    LEFT JOIN user_song_queue q ON q.song_id = delivered.id
    LEFT JOIN song_tags st ON st.song_id = lib.id
    LEFT JOIN tags t ON t.id = st.tag_id
    LEFT JOIN LATERAL (
      SELECT audio_url FROM song_assets WHERE song_id = lib.id ORDER BY id DESC LIMIT 1
    ) sa ON true
    WHERE lib.user_id = $1
      AND lib.source_song_id IS NULL
      AND ($2::text IS NULL OR lib.title ILIKE $2 OR lib.prompt ILIKE $2 OR lib.base_prompt ILIKE $2)
    GROUP BY lib.id, sa.audio_url
    ORDER BY lib.created_at DESC
    LIMIT $3`,
    [Number(userId), search, limit]
  );
  return rows;
}

async function getUserAdminMetrics(userId) {
  const { rows } = await query(
    `SELECT
      COALESCE((SELECT COUNT(*) FROM feedback WHERE user_id = $1), 0)::int AS feedback_count,
      COALESCE((SELECT COUNT(*) FROM feedback WHERE user_id = $1 AND action = 'like'), 0)::int AS like_count,
      COALESCE((SELECT COUNT(*) FROM feedback WHERE user_id = $1 AND action = 'skip'), 0)::int AS skip_count,
      COALESCE((SELECT COUNT(*) FROM user_song_queue WHERE user_id = $1 AND COALESCE(is_hidden, false) = false), 0)::int AS queued_song_count,
      COALESCE((SELECT COUNT(*) FROM playlists WHERE user_id = $1), 0)::int AS playlist_count,
      COALESCE((SELECT COUNT(*) FROM user_tags WHERE user_id = $1 AND COALESCE(is_active, true) = true), 0)::int AS active_tag_count,
      COALESCE((SELECT COUNT(*) FROM generation_jobs WHERE user_id = $1), 0)::int AS generation_job_count,
      COALESCE((SELECT COUNT(*) FROM songs s WHERE s.user_id = $1 AND s.source_song_id IS NULL), 0)::int AS created_song_count,
      COALESCE((SELECT COUNT(*) FROM user_song_queue q JOIN songs delivered ON delivered.id = q.song_id JOIN songs root ON root.id = COALESCE(delivered.source_song_id, delivered.id) WHERE root.user_id = $1 AND root.source_song_id IS NULL), 0)::int AS creator_delivery_count,
      COALESCE((SELECT COUNT(*) FROM feedback f JOIN songs delivered ON delivered.id = f.song_id JOIN songs root ON root.id = COALESCE(delivered.source_song_id, delivered.id) WHERE root.user_id = $1 AND root.source_song_id IS NULL AND f.action = 'like'), 0)::int AS creator_like_count,
      COALESCE((SELECT COUNT(*) FROM feedback f JOIN songs delivered ON delivered.id = f.song_id JOIN songs root ON root.id = COALESCE(delivered.source_song_id, delivered.id) WHERE root.user_id = $1 AND root.source_song_id IS NULL AND f.action = 'skip'), 0)::int AS creator_skip_count`,
    [Number(userId)]
  );
  const metrics = rows[0] || {};
  return {
    ...metrics,
    estimated_income: estimateCreatorIncome(metrics.creator_delivery_count, metrics.creator_like_count)
  };
}

async function deleteLibrarySongs(rootSongIds) {
  return withTransaction(async (client) => {
    const roots = await client.query(
      `SELECT id
       FROM songs
       WHERE id = ANY($1::int[])
         AND source_song_id IS NULL`,
      [rootSongIds]
    );
    const existingRootIds = roots.rows.map((row) => Number(row.id)).filter(Boolean);
    if (existingRootIds.length === 0) {
      return { deleted_root_ids: [], deleted_song_ids: [] };
    }

    const related = await client.query(
      `SELECT id
       FROM songs
       WHERE COALESCE(source_song_id, id) = ANY($1::int[])`,
      [existingRootIds]
    );
    const deletedSongIds = related.rows.map((row) => Number(row.id)).filter(Boolean);
    if (deletedSongIds.length > 0) {
      await client.query(`DELETE FROM songs WHERE id = ANY($1::int[])`, [deletedSongIds]);
    }

    return {
      deleted_root_ids: existingRootIds,
      deleted_song_ids: deletedSongIds
    };
  });
}

app.get("/admin/tags", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { rows } = await query("SELECT * FROM tags ORDER BY type ASC, sort_order ASC, id ASC");
  return { items: rows };
});

app.post("/admin/tags", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { name, type, description, sort_order, is_active } = request.body || {};
  const cleanName = String(name || "").trim();
  const cleanType = String(type || "").trim();
  if (!cleanName || !cleanType) {
    reply.code(400).send({ error: "name and type required" });
    return;
  }
  const { rows } = await query(
    "INSERT INTO tags (name, type, description, sort_order, is_active) VALUES ($1, $2, $3, COALESCE($4, 0), COALESCE($5, true)) RETURNING *",
    [cleanName, cleanType, description ? String(description).trim() : null, sort_order ?? 0, is_active]
  );
  return { item: rows[0] };
});

app.patch("/admin/tags/:id", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { id } = request.params;
  const { name, type, is_active, description, sort_order } = request.body || {};
  const { rows } = await query(
    "UPDATE tags SET name = COALESCE(NULLIF($1, ''), name), type = COALESCE(NULLIF($2, ''), type), is_active = COALESCE($3, is_active), description = COALESCE($4, description), sort_order = COALESCE($5, sort_order) WHERE id = $6 RETURNING *",
    [name, type, is_active, description, sort_order, id]
  );
  return { item: rows[0] || null };
});

app.delete("/admin/tags/:id", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { id } = request.params;
  await query("DELETE FROM tags WHERE id = $1", [Number(id)]);
  return { ok: true };
});

app.post("/admin/tags/batch-delete", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const ids = normalizeIdList(request.body?.ids || request.body?.tag_ids);
  const addToBlacklist = request.body?.add_to_blacklist === true;
  const softDelete = request.body?.soft_delete === true;
  const blacklistReason = String(request.body?.blacklist_reason || request.body?.reason || "").trim() || null;
  if (ids.length === 0) {
    reply.code(400).send({ error: "ids required" });
    return;
  }

  const result = await withTransaction(async (client) => {
    const tagLookup = await client.query(
      "SELECT id, name FROM tags WHERE id = ANY($1::int[])",
      [ids]
    );
    const items = tagLookup.rows || [];
    if (items.length === 0) {
      return { deleted_count: 0, ids: [], blacklisted_words: [] };
    }

    if (addToBlacklist) {
      for (const item of items) {
        await client.query(
          "INSERT INTO tag_blacklist (word, reason) VALUES ($1, $2) ON CONFLICT (word) DO UPDATE SET reason = COALESCE(EXCLUDED.reason, tag_blacklist.reason)",
          [item.name, blacklistReason]
        );
      }
    }

    if (softDelete) {
      await client.query(
        "UPDATE tags SET is_active = false WHERE id = ANY($1::int[])",
        [items.map((item) => Number(item.id))]
      );
    } else {
      await client.query(
        "DELETE FROM tags WHERE id = ANY($1::int[])",
        [items.map((item) => Number(item.id))]
      );
    }

    return {
      deleted_count: items.length,
      ids: items.map((item) => Number(item.id)),
      blacklisted_words: addToBlacklist ? items.map((item) => item.name) : []
    };
  });

  return { ok: true, ...result };
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

app.post("/admin/tag-blacklist/batch", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const words = normalizeWordList(request.body?.words || request.body?.text);
  const reason = String(request.body?.reason || "").trim() || null;
  if (words.length === 0) {
    reply.code(400).send({ error: "words required" });
    return;
  }

  const items = [];
  for (const word of words) {
    const { rows } = await query(
      "INSERT INTO tag_blacklist (word, reason) VALUES ($1, $2) ON CONFLICT (word) DO UPDATE SET reason = COALESCE(EXCLUDED.reason, tag_blacklist.reason) RETURNING *",
      [word, reason]
    );
    if (rows[0]) items.push(rows[0]);
  }
  return { ok: true, count: items.length, items };
});

app.delete("/admin/tag-blacklist/:id", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { id } = request.params;
  await query("DELETE FROM tag_blacklist WHERE id = $1", [Number(id)]);
  return { ok: true };
});

app.get("/admin/users", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { rows } = await query("SELECT id, device_id, account_id, display_name, avatar, created_at, last_seen_at, is_active, (password_hash IS NOT NULL AND password_hash <> '') AS has_password FROM users ORDER BY created_at DESC");
  return { items: rows };
});

app.patch("/admin/users/:id", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { id } = request.params;
  const { display_name, is_active } = request.body || {};
  const { rows } = await query(
    "UPDATE users SET display_name = COALESCE(NULLIF($1, ''), display_name), is_active = COALESCE($2, is_active), last_seen_at = COALESCE(last_seen_at, NOW()) WHERE id = $3 RETURNING id, device_id, account_id, display_name, avatar, created_at, last_seen_at, is_active, (password_hash IS NOT NULL AND password_hash <> '') AS has_password",
    [display_name, is_active, Number(id)]
  );
  return { item: rows[0] || null };
});

app.get("/admin/user-summary", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { rows } = await query(
    `SELECT
      u.id,
      u.device_id,
      u.account_id,
      u.avatar,
      COALESCE(u.display_name, u.account_id, u.device_id) AS display_name,
      u.created_at,
      u.last_seen_at,
      u.is_active,
      (u.password_hash IS NOT NULL AND u.password_hash <> '') AS has_password,
      COALESCE((SELECT COUNT(*) FROM feedback WHERE user_id = u.id), 0)::int AS feedback_count,
      COALESCE((SELECT COUNT(*) FROM feedback WHERE user_id = u.id AND action = 'like'), 0)::int AS like_count,
      COALESCE((SELECT COUNT(*) FROM feedback WHERE user_id = u.id AND action = 'skip'), 0)::int AS skip_count,
      COALESCE((SELECT COUNT(*) FROM user_song_queue WHERE user_id = u.id AND COALESCE(is_hidden, false) = false), 0)::int AS queued_songs,
      COALESCE((SELECT COUNT(*) FROM playlists WHERE user_id = u.id), 0)::int AS playlist_count,
      COALESCE((SELECT COUNT(*) FROM user_tags WHERE user_id = u.id AND COALESCE(is_active, true) = true), 0)::int AS active_tag_count,
      COALESCE((SELECT COUNT(*) FROM songs s WHERE s.user_id = u.id AND s.source_song_id IS NULL), 0)::int AS created_song_count,
      COALESCE((SELECT COUNT(*) FROM user_song_queue q JOIN songs delivered ON delivered.id = q.song_id JOIN songs root ON root.id = COALESCE(delivered.source_song_id, delivered.id) WHERE root.user_id = u.id AND root.source_song_id IS NULL), 0)::int AS creator_delivery_count,
      COALESCE((SELECT COUNT(*) FROM feedback f JOIN songs delivered ON delivered.id = f.song_id JOIN songs root ON root.id = COALESCE(delivered.source_song_id, delivered.id) WHERE root.user_id = u.id AND root.source_song_id IS NULL AND f.action = 'like'), 0)::int AS creator_like_count
    FROM users u
    ORDER BY COALESCE(u.last_seen_at, u.created_at) DESC, u.created_at DESC`
  );
  return {
    items: rows.map((row) => ({
      ...row,
      estimated_income: estimateCreatorIncome(row.creator_delivery_count, row.creator_like_count)
    }))
  };
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

  const [user, metrics, favorites, queueHistory, createdSongs, tagWeights] = await Promise.all([
    query("SELECT id, device_id, account_id, display_name, avatar, created_at, last_seen_at, is_active, (password_hash IS NOT NULL AND password_hash <> '') AS has_password FROM users WHERE id = $1", [userId]),
    getUserAdminMetrics(userId),
    query(
      "SELECT f.created_at, s.id AS song_id, COALESCE(qm.display_title, s.title) AS title, COALESCE(qm.display_cover_url, s.cover_url) AS cover_url, s.prompt, COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tags, COALESCE(array_remove(array_agg(DISTINCT p.name), NULL), '{}') AS playlists FROM feedback f JOIN songs s ON s.id = f.song_id LEFT JOIN LATERAL (SELECT display_title, display_cover_url FROM user_song_queue q WHERE q.user_id = f.user_id AND q.song_id = s.id AND (q.display_title IS NOT NULL OR q.display_cover_url IS NOT NULL) ORDER BY q.created_at DESC, q.id DESC LIMIT 1) qm ON true LEFT JOIN song_tags st ON st.song_id = s.id LEFT JOIN tags t ON t.id = st.tag_id LEFT JOIN playlist_songs ps ON ps.song_id = s.id LEFT JOIN playlists p ON p.id = ps.playlist_id AND p.user_id = f.user_id WHERE f.user_id = $1 AND f.action = 'like' GROUP BY f.id, s.id, qm.display_title, qm.display_cover_url ORDER BY f.created_at DESC LIMIT 100",
      [userId]
    ),
    query(
      "SELECT x.song_id, x.title, x.cover_url, x.prompt, x.created_at, x.source, x.tags FROM (SELECT DISTINCT ON (q.id) s.id AS song_id, COALESCE(q.display_title, s.title) AS title, COALESCE(q.display_cover_url, s.cover_url) AS cover_url, s.prompt, q.created_at, q.source, COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tags FROM user_song_queue q JOIN songs s ON s.id = q.song_id LEFT JOIN song_tags st ON st.song_id = s.id LEFT JOIN tags t ON t.id = st.tag_id WHERE q.user_id = $1 GROUP BY q.id, s.id, q.display_title, q.display_cover_url, q.created_at, q.source ORDER BY q.id, q.created_at DESC) x ORDER BY x.created_at DESC LIMIT 100",
      [userId]
    ),
    getUserCreatedSongs(userId, { limit: 100 }),
    query(
      "SELECT t.id AS tag_id, t.name, t.type, ut.weight, ut.last_updated FROM user_tags ut JOIN tags t ON t.id = ut.tag_id WHERE ut.user_id = $1 AND COALESCE(ut.is_active, true) = true ORDER BY ut.weight DESC",
      [userId]
    )
  ]);

  return {
    user: user.rows[0] || { id: userId },
    metrics,
    favorites: favorites.rows || [],
    songs: queueHistory.rows || [],
    queue_history: queueHistory.rows || [],
    created_songs: createdSongs || [],
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
  const { q, available, type, creator_user_id } = request.query || {};
  const search = q ? `%${String(q).trim()}%` : null;
  const availableFilter =
    available === "true" ? true : available === "false" ? false : null;
  const typeFilter = type ? String(type).trim() : null;
  const creatorUserId = creator_user_id ? Number(creator_user_id) : null;

  const { rows } = await query(
    `SELECT lib.id,
      lib.user_id AS creator_user_id,
      COALESCE(u.display_name, u.account_id, u.device_id) AS creator_name,
      lib.created_at,
      lib.generation_mode,
      lib.title,
      lib.cover_url,
      lib.prompt,
      lib.base_prompt,
      lib.cover_hint,
      lib.model,
      lib.duration,
      lib.style,
      lib.is_available,
      lib.reuse_count,
      COUNT(DISTINCT all_s.id)::int AS copies,
      COUNT(DISTINCT qd.id)::int AS deliveries,
      COUNT(DISTINCT CASE WHEN f.action = 'like' THEN f.id END)::int AS likes,
      COUNT(DISTINCT CASE WHEN f.action = 'skip' THEN f.id END)::int AS skips,
      COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tags,
      COALESCE(array_remove(array_agg(DISTINCT t.type), NULL), '{}') AS tag_types,
      COALESCE((array_remove(array_agg(DISTINCT t.type), NULL))[1], 'Uncategorized') AS primary_type,
      sa.audio_url
    FROM songs lib
    LEFT JOIN users u ON u.id = lib.user_id
    LEFT JOIN songs all_s ON COALESCE(all_s.source_song_id, all_s.id) = lib.id
    LEFT JOIN feedback f ON f.song_id = all_s.id
    LEFT JOIN user_song_queue qd ON qd.song_id = all_s.id
    LEFT JOIN song_tags st ON st.song_id = lib.id
    LEFT JOIN tags t ON t.id = st.tag_id
    LEFT JOIN LATERAL (SELECT audio_url FROM song_assets WHERE song_id = lib.id ORDER BY id DESC LIMIT 1) sa ON true
    WHERE lib.source_song_id IS NULL
      AND ($1::text IS NULL OR lib.title ILIKE $1 OR lib.prompt ILIKE $1 OR lib.base_prompt ILIKE $1 OR COALESCE(u.display_name, u.account_id, u.device_id) ILIKE $1 OR EXISTS (SELECT 1 FROM song_tags st2 JOIN tags t2 ON t2.id = st2.tag_id WHERE st2.song_id = lib.id AND (t2.name ILIKE $1 OR t2.type ILIKE $1)))
      AND ($2::boolean IS NULL OR lib.is_available = $2)
      AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM song_tags st3 JOIN tags t3 ON t3.id = st3.tag_id WHERE st3.song_id = lib.id AND t3.type = $3))
      AND ($4::int IS NULL OR lib.user_id = $4)
    GROUP BY lib.id, u.display_name, u.account_id, u.device_id, sa.audio_url
    ORDER BY likes DESC, lib.reuse_count DESC, deliveries DESC, lib.created_at DESC
    LIMIT 300`,
    [search, availableFilter, typeFilter, creatorUserId]
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

app.post("/admin/library-songs/batch-delete", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const ids = normalizeIdList(request.body?.ids || request.body?.song_ids);
  if (ids.length === 0) {
    reply.code(400).send({ error: "ids required" });
    return;
  }
  const result = await deleteLibrarySongs(ids);
  return {
    ok: true,
    deleted_root_count: result.deleted_root_ids.length,
    deleted_song_count: result.deleted_song_ids.length,
    deleted_root_ids: result.deleted_root_ids,
    deleted_song_ids: result.deleted_song_ids
  };
});app.post("/auth/register", async (request, reply) => {
  const { account_id, password, display_name, avatar } = request.body || {};
  const accountId = normalizeAccountId(account_id);
  const cleanName = String(display_name || "").trim();
  const cleanAvatar = String(avatar || "").trim();
  const rawPassword = String(password || "");

  if (!accountId || !cleanName || !cleanAvatar || !rawPassword) {
    reply.code(400).send({ error: "account_id, password, display_name, avatar required" });
    return;
  }
  if (!/^[a-z0-9._-]{3,32}$/.test(accountId)) {
    reply.code(400).send({ error: "account_id must be 3-32 chars: letters, numbers, dot, underscore, hyphen" });
    return;
  }
  if (rawPassword.length < 6) {
    reply.code(400).send({ error: "password must be at least 6 characters" });
    return;
  }

  const existing = await query("SELECT id FROM users WHERE account_id = $1 LIMIT 1", [accountId]);
  if (existing.rows.length > 0) {
    reply.code(409).send({ error: "account already exists" });
    return;
  }

  const { rows } = await query(
    "INSERT INTO users (device_id, account_id, password_hash, display_name, avatar, last_seen_at, is_active) VALUES ($1, $2, $3, $4, $5, NOW(), true) RETURNING id, device_id, account_id, display_name, avatar, created_at, last_seen_at, is_active",
    [accountId, accountId, hashPassword(rawPassword), cleanName, cleanAvatar]
  );
  return { user: rows[0] };
});

app.post("/auth/login", async (request, reply) => {
  const { account_id, password } = request.body || {};
  const accountId = normalizeAccountId(account_id);
  const rawPassword = String(password || "");
  if (!accountId || !rawPassword) {
    reply.code(400).send({ error: "account_id and password required" });
    return;
  }

  const { rows } = await query(
    "SELECT id, device_id, account_id, display_name, avatar, password_hash, created_at, last_seen_at, is_active FROM users WHERE account_id = $1 LIMIT 1",
    [accountId]
  );
  const user = rows[0];
  if (!user || !user.password_hash || !verifyPassword(rawPassword, user.password_hash) || user.is_active === false) {
    reply.code(401).send({ error: "invalid account or password" });
    return;
  }

  const touched = await query(
    "UPDATE users SET last_seen_at = NOW(), is_active = true WHERE id = $1 RETURNING id, device_id, account_id, display_name, avatar, created_at, last_seen_at, is_active",
    [Number(user.id)]
  );
  return { user: touched.rows[0] };
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
    "UPDATE user_tags SET is_active = false, is_anchor = false, weight = 0, softmax_weight = 0, raw_score = $1, update_count = 0, last_updated = NOW() WHERE user_id = $2",
    [MIN_RAW_SCORE, Number(user_id)]
  );

  const anchorTagId = allowedTagIds[0];
  for (const tagId of allowedTagIds) {
    const isAnchor = Number(tagId) === Number(anchorTagId);
    await query(
      "UPDATE user_tags SET raw_score = $1, initial_weight = $2, softmax_weight = 0, weight = 0, update_count = 0, last_updated = NOW(), is_active = true, is_anchor = $3, anchor_floor = $4 WHERE user_id = $5 AND tag_id = $6",
      [isAnchor ? ANCHOR_TAG_RAW_SCORE : SELECTED_TAG_RAW_SCORE, isAnchor ? ANCHOR_FLOOR : 0, isAnchor, ANCHOR_FLOOR, Number(user_id), Number(tagId)]
    );
  }

  await normalizeUserWeights(user_id);

  const seededSongs = await findReusableSongs(user_id, allowedTagIds, 4, INIT_REUSE_SIMILARITY_MIN);
  for (const song of seededSongs) {
    await queueSongForUser(user_id, song.id, null, 'seeded', { queueBucket: 'stable' });
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
  const anchorLookup = await query(
    "SELECT tag_id FROM user_tags WHERE user_id = $1 AND COALESCE(is_active, true) = true AND COALESCE(is_anchor, false) = true LIMIT 1",
    [Number(user_id)]
  );
  const shouldAnchor = anchorLookup.rows.length === 0;
  await query(
    "UPDATE user_tags SET raw_score = $1, initial_weight = $2, softmax_weight = 0, weight = 0, update_count = 0, last_updated = NOW(), is_active = true, is_anchor = $3, anchor_floor = $4 WHERE user_id = $5 AND tag_id = $6",
    [shouldAnchor ? ANCHOR_TAG_RAW_SCORE : SELECTED_TAG_RAW_SCORE, shouldAnchor ? ANCHOR_FLOOR : 0, shouldAnchor, ANCHOR_FLOOR, Number(user_id), Number(tag.id)]
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
    "SELECT t.id AS tag_id, t.name, t.type, ut.weight, COALESCE(ut.softmax_weight, ut.weight, 0) AS softmax_weight, COALESCE(ut.raw_score, 0) AS raw_score, COALESCE(ut.is_anchor, false) AS is_anchor, COALESCE(ut.anchor_floor, 0) AS anchor_floor, COALESCE(ut.is_active, true) AS is_active FROM user_tags ut JOIN tags t ON t.id = ut.tag_id WHERE ut.user_id = $1 ORDER BY COALESCE(ut.is_anchor, false) DESC, COALESCE(ut.softmax_weight, ut.weight, 0) DESC, COALESCE(ut.raw_score, 0) DESC",
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
    "UPDATE user_tags SET is_active = false, is_anchor = false, weight = 0, softmax_weight = 0, raw_score = $1, last_updated = NOW() WHERE user_id = $2 AND tag_id = $3",
    [MIN_RAW_SCORE, Number(user_id), Number(tag_id)]
  );
  await normalizeUserWeights(user_id);
  return { ok: true };
});

app.post("/user-tags/weight", async (request, reply) => {
  const { user_id, tag_id, weight, is_anchor } = request.body || {};
  const parsedWeight = Number(weight);
  if (!user_id || !tag_id || !Number.isFinite(parsedWeight)) {
    reply.code(400).send({ error: "user_id, tag_id, weight required" });
    return;
  }

  await ensureUserTagWeights(user_id);
  const currentLookup = await query(
    "SELECT tag_id, COALESCE(raw_score, 0) AS raw_score, COALESCE(is_anchor, false) AS is_anchor FROM user_tags WHERE user_id = $1 AND tag_id = $2 LIMIT 1",
    [Number(user_id), Number(tag_id)]
  );
  const current = currentLookup.rows[0];
  if (!current) {
    reply.code(404).send({ error: "user tag relation not found" });
    return;
  }

  const clampedWeight = clampNumber(parsedWeight, 0, 1);
  if (clampedWeight <= 0) {
    await query(
      "UPDATE user_tags SET is_active = false, is_anchor = false, weight = 0, softmax_weight = 0, raw_score = $1, update_count = update_count + 1, last_updated = NOW() WHERE user_id = $2 AND tag_id = $3",
      [MIN_RAW_SCORE, Number(user_id), Number(tag_id)]
    );
    await normalizeUserWeights(user_id);
    return { ok: true, item: null };
  }

  const peers = await query(
    "SELECT COALESCE(raw_score, 0) AS raw_score FROM user_tags WHERE user_id = $1 AND tag_id <> $2 AND COALESCE(is_active, true) = true",
    [Number(user_id), Number(tag_id)]
  );
  const targetRawScore = estimateRawScoreFromShare(clampedWeight, peers.rows.map((row) => Number(row.raw_score || 0)));
  const nextAnchor = typeof is_anchor === "boolean" ? Boolean(is_anchor) : (clampedWeight >= ANCHOR_FLOOR ? true : Boolean(current.is_anchor));

  await query(
    "UPDATE user_tags SET raw_score = $1, is_active = true, is_anchor = $2, anchor_floor = $3, update_count = update_count + 1, last_updated = NOW() WHERE user_id = $4 AND tag_id = $5",
    [targetRawScore, nextAnchor, nextAnchor ? ANCHOR_FLOOR : 0, Number(user_id), Number(tag_id)]
  );
  await normalizeUserWeights(user_id);

  const { rows } = await query(
    "SELECT user_id, tag_id, weight, softmax_weight, raw_score, is_anchor, anchor_floor, is_active, last_updated FROM user_tags WHERE user_id = $1 AND tag_id = $2 LIMIT 1",
    [Number(user_id), Number(tag_id)]
  );
  return { ok: true, item: rows[0] || null };
});

app.get("/my-created-songs", async (request, reply) => {
  const { user_id, limit, q } = request.query || {};
  if (!user_id) {
    reply.code(400).send({ error: "user_id required" });
    return;
  }
  const items = await getUserCreatedSongs(Number(user_id), { limit, search: q });
  return { items };
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

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function roundWeight(value) {
  return Number(Number(value || 0).toFixed(4));
}

function clampRawScore(value) {
  return Math.max(MIN_RAW_SCORE, Number(Number(value || 0).toFixed(3)));
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) return DEFAULT_TAG_RAW_SCORE;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function lowerName(value) {
  return String(value || "").trim().toLowerCase();
}

function parseJsonObject(content) {
  const raw = String(content || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function tagsConflict(a, b) {
  const left = lowerName(a?.name);
  const right = lowerName(b?.name);
  if (!left || !right || left === right) return false;
  const conflicts = [
    ["\u52a9\u7720", "\u5065\u8eab\u623f"],
    ["\u51a5\u60f3", "\u786c\u6838"],
    ["\u5b89\u9759", "\u70b8\u88c2"],
    ["\u94a2\u7434\u72ec\u594f", "\u91cd\u91d1\u5c5e"],
    ["lofi", "180bpm"]
  ];
  return conflicts.some((pair) => pair.includes(left) && pair.includes(right));
}

async function getRecentTagIds(userId, limit = 8) {
  const { rows } = await query(
    "SELECT DISTINCT st.tag_id FROM (SELECT song_id FROM user_song_queue WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2) q JOIN song_tags st ON st.song_id = q.song_id",
    [Number(userId), limit]
  );
  return new Set(rows.map((row) => Number(row.tag_id)).filter(Boolean));
}

async function getRecentlyAdjustedTagIds(userId, minutes = 20) {
  const { rows } = await query(
    "SELECT tag_id FROM user_tags WHERE user_id = $1 AND COALESCE(is_active, true) = true AND COALESCE(update_count, 0) > 0 AND last_updated >= NOW() - ($2 * INTERVAL '1 minute') ORDER BY last_updated DESC LIMIT 12",
    [Number(userId), Number(minutes)]
  );
  return new Set(rows.map((row) => Number(row.tag_id)).filter(Boolean));
}

async function getRecentFeedbackActions(userId, limit = 6) {
  const { rows } = await query(
    "SELECT action FROM feedback WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2",
    [Number(userId), Number(limit)]
  );
  return rows.map((row) => String(row.action || "").toLowerCase()).filter(Boolean);
}

async function ensureUserTagWeights(userId) {
  const { rows } = await query("SELECT id FROM tags WHERE is_active = true ORDER BY id");
  if (rows.length === 0) return;
  const tagIds = rows.map((row) => Number(row.id)).filter(Boolean);

  await query(
    "INSERT INTO user_tags (user_id, tag_id, weight, initial_weight, raw_score, softmax_weight, is_anchor, anchor_floor) SELECT $1, t.id, 0, 0, $2, 0, false, $3 FROM tags t WHERE t.is_active = true ON CONFLICT (user_id, tag_id) DO NOTHING",
    [Number(userId), DEFAULT_TAG_RAW_SCORE, ANCHOR_FLOOR]
  );

  await query(
    "UPDATE user_tags SET is_active = false, is_anchor = false, weight = 0, softmax_weight = 0 WHERE user_id = $1 AND tag_id <> ALL($2::int[])",
    [Number(userId), tagIds]
  );
}
async function normalizeUserWeights(userId) {
  const { rows } = await query(
    "SELECT tag_id, COALESCE(raw_score, 0) AS raw_score, COALESCE(is_anchor, false) AS is_anchor, COALESCE(anchor_floor, $2) AS anchor_floor FROM user_tags WHERE user_id = $1 AND COALESCE(is_active, true) = true ORDER BY COALESCE(is_anchor, false) DESC, COALESCE(raw_score, 0) DESC, tag_id ASC",
    [Number(userId), ANCHOR_FLOOR]
  );
  if (rows.length === 0) return;

  const working = rows.map((row) => ({
    tag_id: Number(row.tag_id),
    raw_score: clampRawScore(row.raw_score),
    is_anchor: Boolean(row.is_anchor),
    anchor_floor: clampNumber(row.anchor_floor || ANCHOR_FLOOR, 0, 0.8)
  }));

  const primaryAnchor = working.find((row) => row.is_anchor) || working[0];
  const anchorTagId = primaryAnchor ? Number(primaryAnchor.tag_id) : null;
  const maxRaw = Math.max(...working.map((row) => Number(row.raw_score || 0)));
  const scores = working.map((row) => Math.exp((Number(row.raw_score || 0) - maxRaw) / SOFTMAX_TEMPERATURE));
  const total = scores.reduce((sum, value) => sum + value, 0) || 1;
  const shares = scores.map((value) => value / total);

  if (anchorTagId && working.length > 1) {
    const anchorIndex = working.findIndex((row) => Number(row.tag_id) === anchorTagId);
    const floor = clampNumber(primaryAnchor.anchor_floor || ANCHOR_FLOOR, 0, 0.8);
    if (anchorIndex >= 0 && shares[anchorIndex] < floor) {
      const otherTotal = shares.reduce((sum, value, index) => index === anchorIndex ? sum : sum + value, 0);
      const scale = otherTotal > 0 ? (1 - floor) / otherTotal : 0;
      for (let index = 0; index < shares.length; index += 1) {
        shares[index] = index === anchorIndex ? floor : shares[index] * scale;
      }
    }
  }

  for (let index = 0; index < working.length; index += 1) {
    const row = working[index];
    await query(
      "UPDATE user_tags SET raw_score = $1, weight = $2, softmax_weight = $2, is_anchor = $3, anchor_floor = $4, last_updated = NOW() WHERE user_id = $5 AND tag_id = $6",
      [
        clampRawScore(row.raw_score),
        roundWeight(shares[index]),
        anchorTagId ? Number(row.tag_id) === anchorTagId : index === 0,
        Number(row.tag_id) === anchorTagId ? clampNumber(primaryAnchor.anchor_floor || ANCHOR_FLOOR, 0, 0.8) : 0,
        Number(userId),
        Number(row.tag_id)
      ]
    );
  }
}

function estimateRawScoreFromShare(targetShare, peerRawScores = []) {
  const safeShare = clampNumber(targetShare, 0.01, 0.99);
  const peerCount = Math.max(1, peerRawScores.length);
  const baseline = average(peerRawScores);
  const otherShare = Math.max(0.01, 1 - safeShare);
  const ratio = safeShare / (otherShare / peerCount);
  return clampRawScore(baseline + Math.log(ratio) * SOFTMAX_TEMPERATURE);
}

function describeWeightedTag(tag) {
  return `${tag.name}(${Math.round(Number(tag.softmax_weight || 0) * 100)}%)`;
}

function determineStrategy(requestedMode, skipStreak, recentActions, adjustedCount) {
  const mode = String(requestedMode || "").trim().toLowerCase();
  const cleanSkipStreak = Math.max(0, Number(skipStreak || 0));
  const actionWindow = Array.isArray(recentActions) ? recentActions.slice(0, 3) : [];
  const completedRun = actionWindow.length === 3 && actionWindow.every((action) => action === "complete" || action === "like");

  if (cleanSkipStreak >= 2) return { strategyMode: "explore", explorationLevel: "deep" };
  if (mode === "stable") return { strategyMode: "stable", explorationLevel: "none" };
  if (mode === "explore" && adjustedCount > 0) return { strategyMode: "explore", explorationLevel: "medium" };
  if (mode === "explore" && completedRun) return { strategyMode: "explore", explorationLevel: "light" };
  if (adjustedCount > 0) return { strategyMode: "explore", explorationLevel: "medium" };
  if (completedRun) return { strategyMode: "explore", explorationLevel: "light" };
  return { strategyMode: "stable", explorationLevel: "none" };
}

function chooseTagPlan(tags, options = {}) {
  const recentTagIds = options.recentTagIds || new Set();
  const adjustedTagIds = options.adjustedTagIds || new Set();
  const strategyMode = options.strategyMode || "stable";
  const explorationLevel = options.explorationLevel || "none";
  const ordered = [...tags].sort((a, b) => Number(b.softmax_weight || 0) - Number(a.softmax_weight || 0) || Number(b.raw_score || 0) - Number(a.raw_score || 0));
  const anchor = ordered.find((tag) => tag.is_anchor) || ordered[0] || null;
  if (!anchor) return { anchor: null, coreTags: [], supportTags: [], strategyMode, explorationLevel };

  const remaining = ordered.filter((tag) => Number(tag.id) !== Number(anchor.id));
  const selectedIds = new Set([Number(anchor.id)]);
  const coreTags = [];
  const supportTags = [];
  const coreTypes = new Set(anchor.type ? [anchor.type] : []);
  const stableScore = (tag) => Number(tag.softmax_weight || 0) * 1.15 + (recentTagIds.has(Number(tag.id)) ? 0 : 0.18) + (adjustedTagIds.has(Number(tag.id)) ? 0.12 : 0);
  const exploreScore = (tag) => (1 - Number(tag.softmax_weight || 0)) + (recentTagIds.has(Number(tag.id)) ? 0 : 0.25) + (adjustedTagIds.has(Number(tag.id)) ? 0.3 : 0) - (tag.type && anchor.type && tag.type === anchor.type ? 0.45 : 0);
  const addTag = (bucket, tag, enforceType) => {
    if (!tag || selectedIds.has(Number(tag.id))) return false;
    if (enforceType && tag.type && coreTypes.has(tag.type)) return false;
    if ([anchor, ...coreTags].some((picked) => tagsConflict(picked, tag))) return false;
    selectedIds.add(Number(tag.id));
    bucket.push(tag);
    if (bucket === coreTags && tag.type) coreTypes.add(tag.type);
    return true;
  };

  const desiredCoreCount = strategyMode === "stable" ? MAX_CORE_TAGS : explorationLevel === "deep" ? 2 : 2;
  const primaryCorePool = [...remaining].sort((a, b) => ((strategyMode === "explore" ? exploreScore(b) - exploreScore(a) : stableScore(b) - stableScore(a)) || Number(b.softmax_weight || 0) - Number(a.softmax_weight || 0)));
  for (const tag of primaryCorePool) {
    if (coreTags.length >= desiredCoreCount) break;
    addTag(coreTags, tag, true);
  }

  if (coreTags.length < Math.min(2, desiredCoreCount)) {
    const stablePool = [...remaining].sort((a, b) => stableScore(b) - stableScore(a) || Number(b.softmax_weight || 0) - Number(a.softmax_weight || 0));
    for (const tag of stablePool) {
      if (coreTags.length >= Math.min(2, desiredCoreCount)) break;
      addTag(coreTags, tag, true);
    }
  }

  const supportPool = [...remaining]
    .filter((tag) => !selectedIds.has(Number(tag.id)))
    .sort((a, b) => stableScore(b) - stableScore(a) || Number(b.softmax_weight || 0) - Number(a.softmax_weight || 0));
  for (const tag of supportPool) {
    if (supportTags.length >= MAX_SUPPORT_TAGS || 1 + coreTags.length + supportTags.length >= MAX_TAGS_TOTAL) break;
    addTag(supportTags, tag, false);
  }

  return { anchor, coreTags, supportTags, strategyMode, explorationLevel };
}

function buildPromptBase(plan) {
  const anchor = plan.anchor;
  const coreTags = plan.coreTags || [];
  const supportTags = plan.supportTags || [];
  if (!anchor) return "";

  const anchorLead = `Lead with ${anchor.name} as the absolute anchor. The whole song must stay centered on ${anchor.name} from start to finish, and close by reinforcing that anchor again.`;
  const coreLine = coreTags.length > 0
    ? `Core constraints: ${coreTags.map(describeWeightedTag).join(", ")}. Keep them clear, compatible, and musically coherent.`
    : "Keep a single dominant anchor and avoid noisy or conflicting additions.";
  const supportLine = supportTags.length > 0
    ? `Weak support only: ${supportTags.map(describeWeightedTag).join(", ")}. Use them as texture and detail, not as the new center.`
    : "Keep support elements restrained and use them only to improve depth, space, and replay value.";
  const strategyLine = plan.strategyMode === "explore"
    ? plan.explorationLevel === "deep"
      ? `Deep exploration is allowed, but it still must not drift away from ${anchor.name}.`
      : plan.explorationLevel === "medium"
        ? "Use moderate exploration by moving recently boosted preferences into the core layer without losing control."
        : "Use light exploration with a small fresh accent while preserving the anchor."
    : "Stay in stable mode and prioritize precision over novelty.";

  return [anchorLead, coreLine, supportLine, strategyLine].join(" ");
}

function buildFallbackHints(plan) {
  const anchor = plan.anchor;
  const leadCore = plan.coreTags?.[0] || null;
  return {
    title_hint: [anchor?.name, leadCore?.name].filter(Boolean).join(" · ").slice(0, 24),
    cover_hint: [
      anchor ? `${anchor.name} as the primary visual atmosphere` : "",
      leadCore ? `with ${leadCore.name} as the supporting imagery` : "",
      plan.supportTags?.length ? `plus light details from ${plan.supportTags.map((tag) => tag.name).join(", ")}` : ""
    ].filter(Boolean).join(", ")
  };
}

async function buildPrompt(userId, options = {}) {
  await ensureUserTagWeights(userId);
  await normalizeUserWeights(userId);
  const { rows } = await query(
    "SELECT t.id, t.name, t.type, ut.weight, COALESCE(ut.softmax_weight, ut.weight, 0) AS softmax_weight, COALESCE(ut.raw_score, 0) AS raw_score, COALESCE(ut.is_anchor, false) AS is_anchor, COALESCE(ut.anchor_floor, $2) AS anchor_floor FROM user_tags ut JOIN tags t ON t.id = ut.tag_id WHERE ut.user_id = $1 AND t.is_active = true AND COALESCE(ut.is_active, true) = true ORDER BY COALESCE(ut.softmax_weight, ut.weight, 0) DESC, COALESCE(ut.raw_score, 0) DESC",
    [Number(userId), ANCHOR_FLOOR]
  );
  if (rows.length === 0) {
    return { prompt: "", tagIds: [], base_prompt: "", title_hint: "", cover_hint: "", strategy_mode: "stable", exploration_level: "none", prompt_debug: {} };
  }

  const [recentTagIds, adjustedTagIds, recentActions] = await Promise.all([
    getRecentTagIds(userId, 8),
    getRecentlyAdjustedTagIds(userId, 20),
    getRecentFeedbackActions(userId, 6)
  ]);

  const strategy = determineStrategy(options.requestedMode, options.skipStreak, recentActions, adjustedTagIds.size);
  const plan = chooseTagPlan(rows, { recentTagIds, adjustedTagIds, strategyMode: strategy.strategyMode, explorationLevel: strategy.explorationLevel });
  const tagIds = [plan.anchor, ...(plan.coreTags || []), ...(plan.supportTags || [])].filter(Boolean).map((tag) => Number(tag.id));
  const basePrompt = buildPromptBase(plan);
  const fallbackHints = buildFallbackHints(plan);
  const optimized = await optimizePromptWithDeepSeek(plan, basePrompt);

  return {
    prompt: optimized.prompt || basePrompt,
    tagIds,
    base_prompt: basePrompt,
    title_hint: optimized.title_hint || fallbackHints.title_hint || "",
    cover_hint: optimized.cover_hint || fallbackHints.cover_hint || "",
    strategy_mode: strategy.strategyMode,
    exploration_level: strategy.explorationLevel,
    prompt_debug: {
      strategy_mode: strategy.strategyMode,
      exploration_level: strategy.explorationLevel,
      anchor: plan.anchor ? { id: plan.anchor.id, name: plan.anchor.name, weight: Number(plan.anchor.softmax_weight || 0), raw_score: Number(plan.anchor.raw_score || 0) } : null,
      core_tags: (plan.coreTags || []).map((tag) => ({ id: tag.id, name: tag.name, type: tag.type, weight: Number(tag.softmax_weight || 0), raw_score: Number(tag.raw_score || 0) })),
      support_tags: (plan.supportTags || []).map((tag) => ({ id: tag.id, name: tag.name, type: tag.type, weight: Number(tag.softmax_weight || 0), raw_score: Number(tag.raw_score || 0) })),
      recent_tag_ids: Array.from(recentTagIds),
      adjusted_tag_ids: Array.from(adjustedTagIds),
      recent_actions: recentActions
    }
  };
}

async function optimizePromptWithDeepSeek(plan, basePrompt) {
  if (!DEEPSEEK_ENABLED || !DEEPSEEK_API_KEY || !plan?.anchor || !String(basePrompt || "").trim()) {
    return { prompt: basePrompt, title_hint: "", cover_hint: "" };
  }

  const payload = {
    task: "Generate a concise music prompt from anchor, core constraints, weak support tags, and exploration level.",
    product_requirements: DEEPSEEK_PRODUCT_REQUIREMENTS,
    strategy_mode: plan.strategyMode,
    exploration_level: plan.explorationLevel,
    anchor: plan.anchor ? { type: plan.anchor.type, name: plan.anchor.name, weight: Number(plan.anchor.softmax_weight || 0), raw_score: Number(plan.anchor.raw_score || 0) } : null,
    core_tags: (plan.coreTags || []).map((tag) => ({ type: tag.type, name: tag.name, weight: Number(tag.softmax_weight || 0), raw_score: Number(tag.raw_score || 0), usage: PROMPT_GUIDE[tag.type] || "Keep it musically actionable" })),
    support_tags: (plan.supportTags || []).map((tag) => ({ type: tag.type, name: tag.name, weight: Number(tag.softmax_weight || 0), raw_score: Number(tag.raw_score || 0), usage: PROMPT_GUIDE[tag.type] || "Keep it musically actionable" })),
    base_prompt: basePrompt,
    output_schema: {
      prompt: "1-3 sentences. Start with the anchor, put core constraints in the middle, keep support tags late, and end by reinforcing the anchor.",
      title_hint: "Short natural song title suggestion.",
      cover_hint: "Short cover-art direction."
    }
  };

  try {
    app.log.info({ model: DEEPSEEK_MODEL, payload }, "deepseek prompt optimization started");
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: plan.strategyMode === "explore" ? 0.85 : 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a music prompt optimizer. Reply with JSON only." },
          { role: "user", content: JSON.stringify(payload) }
        ]
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      app.log.warn({ status: response.status, data }, "deepseek prompt optimization failed");
      return { prompt: basePrompt, title_hint: "", cover_hint: "" };
    }

    const parsed = parseJsonObject(data?.choices?.[0]?.message?.content);
    if (!parsed) {
      app.log.warn({ data }, "deepseek prompt optimization returned invalid json");
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

async function getUserExcludedSongIds(userId) {
  const { rows } = await query(
    "SELECT DISTINCT root_id FROM (SELECT COALESCE(s.source_song_id, s.id) AS root_id FROM user_song_queue q JOIN songs s ON s.id = q.song_id WHERE q.user_id = $1 UNION SELECT COALESCE(s.source_song_id, s.id) AS root_id FROM feedback f JOIN songs s ON s.id = f.song_id WHERE f.user_id = $1) history WHERE root_id IS NOT NULL",
    [Number(userId)]
  );
  return rows.map((row) => Number(row.root_id)).filter(Boolean);
}

async function queueSongForUser(userId, songId, jobId, source, options = {}) {
  const { displayTitle = null, displayCoverUrl = null, queueBucket = null } = options;
  const { rows } = await query(
    "INSERT INTO user_song_queue (user_id, song_id, generation_job_id, source, display_title, display_cover_url, queue_bucket) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
    [Number(userId), Number(songId), jobId ? Number(jobId) : null, source, displayTitle || null, displayCoverUrl || null, queueBucket || null]
  );
  return rows[0] || null;
}

async function findReusableSongs(userId, tagIds, limit = 1, threshold = REUSE_SIMILARITY_MIN) {
  if (!Array.isArray(tagIds) || tagIds.length === 0) return [];
  const excludedSongIds = await getUserExcludedSongIds(userId);
  const { rows } = await query(
    "SELECT s.id, s.title, s.cover_url, s.cover_hint, s.prompt, s.model, s.duration, s.style, s.reuse_count, COALESCE(s.source_song_id, s.id) AS root_id, COUNT(DISTINCT st.tag_id)::int AS song_tag_count, COUNT(DISTINCT CASE WHEN st.tag_id = ANY($1::int[]) THEN st.tag_id END)::int AS matched_tag_count, (COUNT(DISTINCT CASE WHEN st.tag_id = ANY($1::int[]) THEN st.tag_id END)::float / GREATEST(COUNT(DISTINCT st.tag_id), $2)) AS similarity FROM songs s JOIN song_assets sa ON sa.song_id = s.id AND sa.audio_url IS NOT NULL LEFT JOIN song_tags st ON st.song_id = s.id WHERE s.source_song_id IS NULL AND COALESCE(s.is_available, true) = true AND ($4::int[] = '{}'::int[] OR NOT (COALESCE(s.source_song_id, s.id) = ANY($4::int[]))) GROUP BY s.id HAVING COUNT(DISTINCT CASE WHEN st.tag_id = ANY($1::int[]) THEN st.tag_id END) > 0 AND (COUNT(DISTINCT CASE WHEN st.tag_id = ANY($1::int[]) THEN st.tag_id END)::float / GREATEST(COUNT(DISTINCT st.tag_id), $2)) >= $3 ORDER BY similarity DESC, matched_tag_count DESC, s.reuse_count ASC, s.created_at DESC LIMIT $5",
    [tagIds, tagIds.length, threshold, excludedSongIds, Number(limit)]
  );
  const result = [];
  for (const row of rows) {
    const asset = await query("SELECT item_id, audio_url FROM song_assets WHERE song_id = $1 ORDER BY id DESC LIMIT 1", [row.id]);
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
    displayCoverUrl,
    queueBucket: job.strategy_mode || 'stable'
  });
  await query("UPDATE songs SET reuse_count = reuse_count + 1 WHERE id = $1", [Number(librarySong.id)]);
  await query("UPDATE generation_jobs SET status = 'reused', item_ids = $1 WHERE id = $2", [[librarySong.asset.item_id].filter(Boolean), Number(job.id)]);
  return librarySong.id;
}
function normalizeTitle(title, fallback = null) {
  const value = String(title || "").trim();
  if (!value) return fallback;
  return value.slice(0, 40);
}

function buildCoverPrompt({ title, coverHint, prompt }) {
  const parts = [
    String(coverHint || "").trim(),
    title ? "Song title: " + title + "." : "",
    "Create a square music cover illustration with no text, logo, watermark, or layout elements.",
    "Keep one clear focal subject with an atmospheric background, rich color, lighting, and depth suitable for a streaming cover.",
    prompt ? "Music direction: " + String(prompt).trim() : ""
  ];
  return parts.filter(Boolean).join(" " );
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
    "SELECT g.id, g.user_id, g.prompt, g.base_prompt, g.title_hint, g.cover_hint, g.status, g.error, g.item_ids, g.created_at, g.strategy_mode, g.exploration_level, g.prompt_debug, s.id AS song_id, COALESCE(q.display_title, s.title) AS title, COALESCE(q.display_cover_url, s.cover_url) AS cover_url, sa.audio_url, q.source, q.queue_bucket, COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tags FROM generation_jobs g LEFT JOIN LATERAL (SELECT id, song_id, source, display_title, display_cover_url, queue_bucket FROM user_song_queue WHERE generation_job_id = g.id ORDER BY created_at DESC, id DESC LIMIT 1) q ON true LEFT JOIN songs s ON s.id = q.song_id LEFT JOIN LATERAL (SELECT audio_url FROM song_assets WHERE song_id = s.id ORDER BY id DESC LIMIT 1) sa ON true LEFT JOIN song_tags st ON st.song_id = s.id LEFT JOIN tags t ON t.id = st.tag_id WHERE g.id = $1 GROUP BY g.id, s.id, q.display_title, q.display_cover_url, sa.audio_url, q.source, q.queue_bucket ORDER BY s.id DESC NULLS LAST LIMIT 1",
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
app.post("/generate", async (request, reply) => {
  const { user_id, instrumental = true, model, prefetch = false, play_mode, skip_streak, queue_depth } = request.body || {};
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
      strategy_mode: activeJob?.strategy_mode || null,
      exploration_level: activeJob?.exploration_level || null,
      song_id: activeJob?.song_id || null,
      song: activeJob?.song_id ? { id: activeJob.song_id, title: activeJob.title, cover_url: activeJob.cover_url, audio_url: activeJob.audio_url, tags: activeJob.tags || [] } : null
    };
  }

  const skipStreak = Math.max(0, Number(skip_streak || 0));
  const queueDepth = Math.max(0, Number(queue_depth || 0));
  const promptPayload = await buildPrompt(user_id, { requestedMode: play_mode, skipStreak, queueDepth, prefetch: Boolean(prefetch) });
  const { prompt, tagIds, base_prompt, title_hint, cover_hint, strategy_mode, exploration_level, prompt_debug } = promptPayload;
  if (!prompt) {
    reply.code(400).send({ error: "no tags found for user" });
    return;
  }

  const queueTarget = strategy_mode === 'explore' ? EXPLORE_QUEUE_TARGET : NORMAL_QUEUE_TARGET;
  const { rows } = await query(
    "INSERT INTO generation_jobs (user_id, prompt, base_prompt, title_hint, cover_hint, status, tag_ids, strategy_mode, exploration_level, prompt_debug) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9::jsonb) RETURNING *",
    [user_id, prompt, base_prompt || prompt, title_hint || null, cover_hint || null, tagIds, strategy_mode, exploration_level, JSON.stringify(prompt_debug || {})]
  );
  const job = rows[0];

  const reusableSongs = await findReusableSongs(user_id, tagIds, 3, prefetch ? PREFETCH_REUSE_SIMILARITY_MIN : REUSE_SIMILARITY_MIN);
  const reusableSong = reusableSongs[0] || null;
  const shouldForceFresh = strategy_mode === 'explore' || skipStreak >= 2 || (Boolean(prefetch) && reusableSongs.length < 3);

  if (reusableSong && !shouldForceFresh) {
    const songId = await reuseSongForUser(job, reusableSong);
    return {
      job_id: job.id,
      item_ids: reusableSong.asset.item_id ? [reusableSong.asset.item_id] : [],
      prompt,
      base_prompt,
      title_hint,
      cover_hint,
      reused: true,
      song_id: songId,
      matched_song_id: reusableSong.id,
      similarity: Number(reusableSong.similarity || 0),
      status: 'reused',
      strategy_mode,
      exploration_level,
      queue_target: queueTarget,
      queue_depth: queueDepth
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

  const modelToUse = model || (instrumental ? process.env.TPY_MODEL_INSTRUMENTAL || "TemPolor i3" : process.env.TPY_MODEL_SONG || "TemPolor v3");
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
    await query("UPDATE generation_jobs SET status = 'failed', error = $1 WHERE id = $2", [String(err), job.id]);
    reply.code(502).send({ error: "tianpuyue request failed", detail: String(err) });
    return;
  }

  if (!res.ok) {
    await query("UPDATE generation_jobs SET status = 'failed', error = $1 WHERE id = $2", [JSON.stringify(data), job.id]);
    reply.code(502).send({ error: "tianpuyue request failed", detail: data });
    return;
  }

  const itemIds = data?.data?.item_ids || [];
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    await query("UPDATE generation_jobs SET status = 'failed', error = $1 WHERE id = $2", [JSON.stringify(data), job.id]);
    reply.code(502).send({ error: "tianpuyue returned no item_ids", detail: data });
    return;
  }

  await query("UPDATE generation_jobs SET status = 'submitted', item_ids = $1 WHERE id = $2", [itemIds, job.id]);
  return {
    job_id: job.id,
    item_ids: itemIds,
    prompt,
    base_prompt,
    title_hint,
    cover_hint,
    reused: false,
    status: 'submitted',
    strategy_mode,
    exploration_level,
    queue_target: queueTarget,
    queue_depth: queueDepth
  };
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
      strategy_mode: detail.strategy_mode || null,
      exploration_level: detail.exploration_level || null,
      prompt_debug: detail.prompt_debug || null,
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
        "UPDATE generation_jobs SET status = 'done' WHERE $1 = ANY(item_ids) RETURNING id, user_id, prompt, base_prompt, title_hint, cover_hint, tag_ids, strategy_mode",
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
          displayCoverUrl: coverUrl,
          queueBucket: job.strategy_mode || 'stable'
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
  const rawDelta = normalizedAction === "like"
    ? FAVORITE_RAW_DELTA
    : normalizedAction === "complete"
      ? COMPLETE_RAW_DELTA
      : seconds >= 30
        ? SKIP_LATE_RAW_DELTA
        : SKIP_EARLY_RAW_DELTA;

  try {
    await query(
      "INSERT INTO feedback (user_id, song_id, action, score) VALUES ($1, $2, $3, $4)",
      [Number(user_id), Number(song_id), normalizedAction, rawDelta]
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
    "SELECT st.tag_id, COALESCE(st.relevance, 1.0) AS relevance, COALESCE(ut.is_anchor, false) AS is_anchor FROM song_tags st LEFT JOIN user_tags ut ON ut.user_id = $2 AND ut.tag_id = st.tag_id WHERE st.song_id = $1",
    [Number(song_id), Number(user_id)]
  );

  for (const row of rows) {
    const relevance = Number(row.relevance || 1.0);
    const anchorBoost = normalizedAction === "like" && row.is_anchor ? 1.12 : 1;
    const delta = rawDelta * relevance * anchorBoost;
    try {
      await query(
        "UPDATE user_tags SET raw_score = GREATEST($1, COALESCE(raw_score, 0) + $2::numeric), is_active = true, update_count = update_count + 1, last_updated = NOW() WHERE user_id = $3 AND tag_id = $4",
        [MIN_RAW_SCORE, delta, Number(user_id), Number(row.tag_id)]
      );
    } catch (err) {
      request.log.error({ err: String(err), user_id, song_id, action: normalizedAction, tag_id: row.tag_id }, "feedback weight update failed");
      reply.code(500).send({ error: "feedback update failed", detail: String(err) });
      return;
    }
  }

  await normalizeUserWeights(user_id);
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
    "SELECT q.id AS queue_id, s.id, COALESCE(q.display_title, s.title) AS title, COALESCE(q.display_cover_url, s.cover_url) AS cover_url, s.prompt, sa.audio_url, q.created_at, q.source, q.queue_bucket, COALESCE(q.is_hidden, false) AS is_hidden, q.acted_at, COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tags FROM user_song_queue q JOIN songs s ON s.id = q.song_id LEFT JOIN LATERAL (SELECT audio_url FROM song_assets WHERE song_id = s.id ORDER BY id DESC LIMIT 1) sa ON true LEFT JOIN song_tags st ON st.song_id = s.id LEFT JOIN tags t ON t.id = st.tag_id WHERE q.user_id = $1 AND ($2::boolean = true OR COALESCE(q.is_hidden, false) = false) GROUP BY q.id, s.id, q.display_title, q.display_cover_url, s.prompt, sa.audio_url, q.created_at, q.source, q.queue_bucket, q.is_hidden, q.acted_at ORDER BY q.created_at ASC, q.id ASC",
    [Number(user_id), includeHistory]
  );
  return { items: rows.slice(-50) };
});

const port = Number(process.env.PORT || 8080);

await ensureRuntimeSchema();
app.listen({ port, host: "0.0.0.0" });



