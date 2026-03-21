import "dotenv/config";
import crypto from "crypto";
import Fastify from "fastify";
import fs from "fs/promises";
import path from "path";
import Redis from "ioredis";
import { query } from "./db.js";

const app = Fastify({ logger: true });

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const TPY_BASE_URL = process.env.TPY_BASE_URL || "https://api.tianpuyue.cn";
const TPY_API_KEY = process.env.TPY_API_KEY || "";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const DEEPSEEK_ENABLED = (process.env.DEEPSEEK_ENABLED
  ? process.env.DEEPSEEK_ENABLED === "true"
  : Boolean(DEEPSEEK_API_KEY));
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
const PROMPT_ANCHOR_MIN_WEIGHT = Number(process.env.PROMPT_ANCHOR_MIN_WEIGHT || 0.3);
const PROMPT_CORE_MIN_WEIGHT = Number(process.env.PROMPT_CORE_MIN_WEIGHT || 0.15);
const PROMPT_WEAK_MAX_WEIGHT = Number(process.env.PROMPT_WEAK_MAX_WEIGHT || 0.1);
const PROMPT_CORE_MAX_COUNT = Number(process.env.PROMPT_CORE_MAX_COUNT || 3);
const PROMPT_WEAK_MAX_COUNT = Number(process.env.PROMPT_WEAK_MAX_COUNT || 4);
const REUSE_SIMILARITY_MIN = Number(process.env.REUSE_SIMILARITY_MIN || 0.38);
const PREFETCH_REUSE_SIMILARITY_MIN = Number(process.env.PREFETCH_REUSE_SIMILARITY_MIN || 0.28);
const INIT_REUSE_SIMILARITY_MIN = Number(process.env.INIT_REUSE_SIMILARITY_MIN || 0.3);
const ACTIVE_JOB_STALE_MS = Number(process.env.ACTIVE_JOB_STALE_MS || 10 * 60 * 1000);
const ASSET_STORAGE_DIR = process.env.ASSET_STORAGE_DIR || "/app/storage";
const CALLBACK_BASE = (process.env.CALLBACK_BASE || "").replace(/\/$/, "");
const ASSET_PUBLIC_BASE = (process.env.ASSET_PUBLIC_BASE || (CALLBACK_BASE ? `${CALLBACK_BASE}${/\/api$/i.test(CALLBACK_BASE) ? "" : "/api"}/assets` : "/assets")).replace(/\/$/, "");
const ASSET_DOWNLOAD_TIMEOUT_MS = Number(process.env.ASSET_DOWNLOAD_TIMEOUT_MS || 20 * 1000);
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const EXPLORE_POOL_SIZE = Number(process.env.EXPLORE_POOL_SIZE || 5);
const EXPLORE_SNIPPET_SECONDS_MIN = Number(process.env.EXPLORE_SNIPPET_SECONDS_MIN || 60);
const EXPLORE_SNIPPET_SECONDS_MAX = Number(process.env.EXPLORE_SNIPPET_SECONDS_MAX || 90);

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

let redis = null;
function createRedisClient() {
  if (redis) return redis;
  try {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true
    });
    redis.on("error", (err) => {
      app.log.warn({ err: String(err) }, "redis unavailable");
    });
    redis.connect().catch(() => {});
    return redis;
  } catch (err) {
    app.log.warn({ err: String(err) }, "redis init failed");
    redis = null;
    return null;
  }
}

function redisKeysForUser(userId) {
  const uid = Number(userId);
  return {
    current: `recommend:${uid}:current_playing`,
    next: `recommend:${uid}:next_prepared`,
    explorePool: `recommend:${uid}:explore_pool`
  };
}

async function cacheStableRuntime(userId, ordered) {
  const r = createRedisClient();
  if (!r) return;
  const keys = redisKeysForUser(userId);
  const current = ordered[0] || null;
  const next = ordered[1] || null;
  try {
    await r.multi()
      .set(keys.current, JSON.stringify(current || null), "EX", 600)
      .set(keys.next, JSON.stringify(next || null), "EX", 600)
      .del(keys.explorePool)
      .exec();
  } catch {
    // ignore redis write errors
  }
}

function tagSet(song) {
  return new Set((song?.tags || []).map((x) => String(x || "").trim()).filter(Boolean));
}

function jaccardDistance(a, b) {
  if (!a || !b || (a.size === 0 && b.size === 0)) return 0;
  const union = new Set([...a, ...b]);
  let inter = 0;
  for (const item of a) {
    if (b.has(item)) inter += 1;
  }
  return 1 - inter / Math.max(1, union.size);
}

function buildExplorePool(items, size = EXPLORE_POOL_SIZE) {
  const pool = [];
  const candidates = [...(items || [])];
  if (candidates.length === 0) return pool;

  pool.push(candidates.shift());
  while (pool.length < size && candidates.length > 0) {
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < candidates.length; i += 1) {
      const cand = candidates[i];
      const candTags = tagSet(cand);
      let score = 0;
      for (const existing of pool) {
        score += jaccardDistance(candTags, tagSet(existing));
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    pool.push(candidates.splice(bestIdx, 1)[0]);
  }
  return pool;
}

async function cacheExploreRuntime(userId, pool) {
  const r = createRedisClient();
  if (!r) return;
  const keys = redisKeysForUser(userId);
  try {
    const payload = (pool || []).map((item) => JSON.stringify(item));
    const multi = r.multi().del(keys.explorePool).del(keys.current).del(keys.next);
    if (payload.length > 0) {
      multi.rpush(keys.explorePool, ...payload).expire(keys.explorePool, 600);
    }
    await multi.exec();
  } catch {
    // ignore redis write errors
  }
}

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

function isAudioUrlLikelyExpired(url) {
  const raw = String(url || "").trim();
  if (!raw) return true;
  try {
    const parsed = new URL(raw);
    const authKey = parsed.searchParams.get("auth_key");
    if (authKey) {
      const expiresAt = Number(String(authKey).split("-")[0] || 0);
      if (Number.isFinite(expiresAt) && expiresAt > 0) {
        return Math.floor(Date.now() / 1000) >= expiresAt;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function safeAssetExt(kind, sourceUrl, contentType) {
  const normalizedKind = kind === "cover" ? "cover" : "audio";
  const byType = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/ogg": ".ogg",
    "audio/aac": ".aac",
    "audio/flac": ".flac",
    "audio/mp4": ".m4a",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
  };
  const cleanType = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (byType[cleanType]) return byType[cleanType];

  try {
    const pathname = new URL(String(sourceUrl || "")).pathname || "";
    const ext = path.extname(pathname || "").toLowerCase();
    if (/^\.[a-z0-9]{1,8}$/.test(ext)) return ext;
  } catch {
    // ignore invalid URL
  }

  return normalizedKind === "cover" ? ".jpg" : ".mp3";
}

function guessContentTypeByExt(fileName) {
  const ext = String(path.extname(fileName || "")).toLowerCase();
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".aac") return "audio/aac";
  if (ext === ".flac") return "audio/flac";
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(String(url || "").trim());
}

function decodeDataUri(dataUri) {
  const raw = String(dataUri || "").trim();
  const matched = raw.match(/^data:([^;,]+);base64,(.+)$/i);
  if (!matched) return null;
  const contentType = matched[1] || "application/octet-stream";
  const b64 = matched[2] || "";
  if (!b64) return null;
  try {
    return { contentType, buffer: Buffer.from(b64, "base64") };
  } catch {
    return null;
  }
}

async function ensureAssetStorageDirs() {
  await fs.mkdir(path.join(ASSET_STORAGE_DIR, "audio"), { recursive: true });
  await fs.mkdir(path.join(ASSET_STORAGE_DIR, "cover"), { recursive: true });
}

function assetPublicUrl(kind, fileName) {
  return `${ASSET_PUBLIC_BASE}/${kind}/${fileName}`;
}

async function fetchRemoteBinary(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASSET_DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`asset download failed: ${res.status}`);
    }
    const arr = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arr),
      contentType: res.headers.get("content-type") || ""
    };
  } finally {
    clearTimeout(timer);
  }
}

async function persistBinaryAsset(kind, buffer, sourceUrl, contentType) {
  if (!buffer || buffer.length === 0) {
    throw new Error("asset buffer is empty");
  }
  const safeKind = kind === "cover" ? "cover" : "audio";
  const ext = safeAssetExt(safeKind, sourceUrl, contentType);
  const digest = crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 20);
  const fileName = `${digest}${ext}`;
  const dir = path.join(ASSET_STORAGE_DIR, safeKind);
  const filePath = path.join(dir, fileName);
  await fs.mkdir(dir, { recursive: true });
  await fs.access(filePath).catch(async () => {
    await fs.writeFile(filePath, buffer);
  });
  return assetPublicUrl(safeKind, fileName);
}

async function persistRemoteAsset(url, kind) {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (!isHttpUrl(raw)) return raw;
  const downloaded = await fetchRemoteBinary(raw);
  return persistBinaryAsset(kind, downloaded.buffer, raw, downloaded.contentType);
}

async function persistCoverAsset(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (/^data:/i.test(raw)) {
    const parsed = decodeDataUri(raw);
    if (!parsed) return raw;
    return persistBinaryAsset("cover", parsed.buffer, "inline-data-uri", parsed.contentType);
  }
  return persistRemoteAsset(raw, "cover");
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

app.get("/assets/:kind/:name", async (request, reply) => {
  const { kind, name } = request.params || {};
  const safeKind = String(kind || "").toLowerCase();
  if (!["audio", "cover"].includes(safeKind)) {
    reply.code(404).send({ error: "asset kind not found" });
    return;
  }

  const safeName = String(name || "").trim();
  if (!/^[a-zA-Z0-9._-]+$/.test(safeName)) {
    reply.code(400).send({ error: "invalid asset name" });
    return;
  }

  const baseDir = path.resolve(path.join(ASSET_STORAGE_DIR, safeKind));
  const filePath = path.resolve(path.join(baseDir, safeName));
  if (!filePath.startsWith(baseDir + path.sep) && filePath !== baseDir) {
    reply.code(400).send({ error: "invalid asset path" });
    return;
  }

  try {
    const binary = await fs.readFile(filePath);
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    reply.type(guessContentTypeByExt(safeName));
    return reply.send(binary);
  } catch {
    reply.code(404).send({ error: "asset not found" });
  }
});
function resolveLocalAssetPathFromUrl(rawUrl) {
  const input = String(rawUrl || "").trim();
  if (!input) return null;

  let pathname = "";
  try {
    pathname = new URL(input).pathname || "";
  } catch {
    if (input.startsWith("/")) pathname = input;
  }

  if (!pathname) return null;
  const m = pathname.match(/\/assets\/(audio|cover)\/([A-Za-z0-9._-]+)$/i);
  if (!m) return null;

  const kind = String(m[1] || "").toLowerCase();
  const fileName = String(m[2] || "");
  if (!kind || !fileName) return null;

  const baseDir = path.resolve(path.join(ASSET_STORAGE_DIR, kind));
  const filePath = path.resolve(path.join(baseDir, fileName));
  if (!filePath.startsWith(baseDir + path.sep) && filePath !== baseDir) return null;

  return filePath;
}

async function deleteLocalAssetByUrl(rawUrl) {
  const filePath = resolveLocalAssetPathFromUrl(rawUrl);
  if (!filePath) return { deleted: false, reason: "not_local_asset" };
  try {
    await fs.unlink(filePath);
    return { deleted: true };
  } catch (error) {
    if (error?.code === "ENOENT") return { deleted: false, reason: "not_found" };
    return { deleted: false, reason: String(error) };
  }
}

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
  const { rows } = await query("SELECT id, device_id, account_id, display_name, avatar, created_at, last_seen_at, is_active FROM users ORDER BY created_at DESC");
  return { items: rows };
});

app.patch("/admin/users/:id", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { id } = request.params;
  const { display_name, is_active } = request.body || {};
  const { rows } = await query(
    "UPDATE users SET display_name = COALESCE(NULLIF($1, ''), display_name), is_active = COALESCE($2, is_active), last_seen_at = COALESCE(last_seen_at, NOW()) WHERE id = $3 RETURNING id, device_id, account_id, display_name, avatar, created_at, last_seen_at, is_active",
    [display_name, is_active, Number(id)]
  );
  return { item: rows[0] || null };
});

app.get("/admin/user-summary", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const { rows } = await query(
    "SELECT u.id, u.device_id, u.account_id, u.avatar, COALESCE(u.display_name, u.account_id, u.device_id) AS display_name, u.created_at, u.last_seen_at, u.is_active, COUNT(DISTINCT f.id)::int AS feedback_count, COUNT(DISTINCT CASE WHEN f.action = 'like' THEN f.id END)::int AS like_count, COUNT(DISTINCT CASE WHEN f.action = 'skip' THEN f.id END)::int AS skip_count, COUNT(DISTINCT q.song_id)::int AS queued_songs, COUNT(DISTINCT p.id)::int AS playlist_count, COUNT(DISTINCT ut.tag_id) FILTER (WHERE COALESCE(ut.is_active, true) = true)::int AS active_tag_count FROM users u LEFT JOIN feedback f ON f.user_id = u.id LEFT JOIN user_song_queue q ON q.user_id = u.id LEFT JOIN playlists p ON p.user_id = u.id LEFT JOIN user_tags ut ON ut.user_id = u.id GROUP BY u.id ORDER BY COALESCE(u.last_seen_at, u.created_at) DESC, u.created_at DESC"
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

  const user = await query("SELECT id, device_id, account_id, display_name, avatar, created_at, last_seen_at, is_active FROM users WHERE id = $1", [userId]);

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
app.post("/admin/library-songs/bulk-delete", async (request, reply) => {
  if (!requireAdmin(request, reply)) return;
  const songIds = Array.isArray(request.body?.song_ids) ? request.body.song_ids : [];
  const ids = [...new Set(songIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  if (ids.length === 0) {
    reply.code(400).send({ error: "song_ids required" });
    return;
  }

  const { rows: songs } = await query(
    "SELECT id, cover_url FROM songs WHERE source_song_id IS NULL AND id = ANY($1::int[])",
    [ids]
  );
  const rootIds = songs.map((row) => Number(row.id));
  if (rootIds.length === 0) {
    return { ok: true, affected: 0, files_deleted: 0, files_failed: 0 };
  }

  const { rows: allSongRows } = await query(
    "SELECT id, cover_url FROM songs WHERE id = ANY($1::int[]) OR source_song_id = ANY($1::int[])",
    [rootIds]
  );
  const targetIds = allSongRows.map((row) => Number(row.id));

  const { rows: assets } = await query(
    "SELECT song_id, audio_url FROM song_assets WHERE song_id = ANY($1::int[])",
    [targetIds]
  );

  const candidateUrls = [];
  for (const row of allSongRows) {
    if (row.cover_url) candidateUrls.push(String(row.cover_url));
  }
  for (const row of assets) {
    if (row.audio_url) candidateUrls.push(String(row.audio_url));
  }

  let filesDeleted = 0;
  let filesFailed = 0;
  const seen = new Set();
  for (const url of candidateUrls) {
    if (seen.has(url)) continue;
    seen.add(url);
    const result = await deleteLocalAssetByUrl(url);
    if (result.deleted) filesDeleted += 1;
    else if (result.reason && result.reason !== "not_local_asset" && result.reason !== "not_found") filesFailed += 1;
  }

  await query("DELETE FROM songs WHERE id = ANY($1::int[])", [targetIds]);

  return {
    ok: true,
    affected: targetIds.length,
    files_deleted: filesDeleted,
    files_failed: filesFailed
  };
});
app.post("/auth/register", async (request, reply) => {
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

function isSceneTag(tag) {
  const rawType = String(tag?.type || "").trim();
  const type = rawType.toLowerCase();
  const name = String(tag?.name || "").trim();
  if (!rawType && !name) return false;

  if (type.includes("scene")) return true;
  if (rawType.includes("\u573a\u666f")) return true;

  const sceneNameHints = new Set([
    "\u6df1\u591c\u5de5\u4f5c", "\u5065\u8eab\u623f", "\u5496\u5561\u9986", "\u7761\u7720", "\u9a7e\u8f66",
    "\u591c\u665a", "\u5b66\u4e60", "\u901a\u52e4", "\u6e05\u6668", "\u96e8\u5929", "\u5de5\u4f5c", "\u795e\u79d8"
  ]);
  return sceneNameHints.has(name);
}

function choosePrimaryAnchor(sortedTags) {
  if (!Array.isArray(sortedTags) || sortedTags.length === 0) return null;

  const sceneTags = sortedTags.filter((tag) => isSceneTag(tag));
  const strongScene = sceneTags.find((tag) => Number(tag.weight || 0) >= PROMPT_ANCHOR_MIN_WEIGHT);
  if (strongScene) return strongScene;
  if (sceneTags.length > 0) return sceneTags[0];

  const strongAny = sortedTags.find((tag) => Number(tag.weight || 0) >= PROMPT_ANCHOR_MIN_WEIGHT);
  return strongAny || sortedTags[0] || null;
}

function pickSceneAnchor(sortedTags) {
  if (!Array.isArray(sortedTags) || sortedTags.length === 0) return null;
  const sceneTags = sortedTags.filter((tag) => isSceneTag(tag));
  if (sceneTags.length === 0) return null;
  return sceneTags.sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0))[0] || null;
}

function pickCoreConstraintTags(sortedTags, anchorTag, selectedIds) {
  const core = [];
  const usedTypes = new Set(anchorTag?.type ? [String(anchorTag.type)] : []);
  const targetCount = Math.min(
    PROMPT_CORE_MAX_COUNT,
    Math.max(1, Math.min(3, (sortedTags || []).length - (anchorTag ? 1 : 0)))
  );

  const candidates = (sortedTags || []).filter((tag) => !selectedIds.has(Number(tag.id)));
  const primary = candidates.filter((tag) => Number(tag.weight || 0) >= PROMPT_CORE_MIN_WEIGHT);
  const fallback = candidates.filter((tag) => Number(tag.weight || 0) < PROMPT_CORE_MIN_WEIGHT);

  const take = (pool) => {
    for (const tag of pool) {
      if (core.length >= targetCount) break;
      const type = String(tag.type || "");
      if (!type || usedTypes.has(type)) continue;
      core.push(tag);
      usedTypes.add(type);
      selectedIds.add(Number(tag.id));
    }
  };

  take(primary);
  if (core.length < targetCount) take(fallback);
  return core;
}

function pickWeakSupplementTags(sortedTags, selectedIds) {
  const rest = (sortedTags || []).filter((tag) => !selectedIds.has(Number(tag.id)));
  if (rest.length === 0) return [];

  const weakFirst = rest
    .filter((tag) => Number(tag.weight || 0) <= PROMPT_WEAK_MAX_WEIGHT)
    .sort((a, b) => Number(a.weight || 0) - Number(b.weight || 0));

  const fallback = rest
    .filter((tag) => Number(tag.weight || 0) > PROMPT_WEAK_MAX_WEIGHT)
    .sort((a, b) => Number(a.weight || 0) - Number(b.weight || 0));

  const picked = [];
  for (const tag of [...weakFirst, ...fallback]) {
    if (picked.length >= PROMPT_WEAK_MAX_COUNT) break;
    picked.push(tag);
    selectedIds.add(Number(tag.id));
  }

  return picked;
}

function buildCoreConstraintPhrase(tag) {
  const name = String(tag?.name || "").trim();
  const rawType = String(tag?.type || "").trim();
  const type = rawType.toLowerCase();
  if (!name) return "";

  if (type.includes("style") || rawType.includes("\u98ce\u683c")) return `style: ${name}`;
  if (type.includes("mood") || rawType.includes("\u60c5\u7eea")) return `mood: ${name}`;
  if (type.includes("instrument") || rawType.includes("\u4e50\u5668")) return `instrument focus: ${name}`;
  if (type.includes("tempo") || rawType.includes("\u8282\u594f")) return `tempo: ${name}`;
  if (isSceneTag(tag)) return `scene extension: ${name}`;
  return `focus: ${name}`;
}

function buildWeakSupplementPhrase(tag) {
  const name = String(tag?.name || "").trim();
  if (!name) return "";
  return `optional accent: ${name}`;
}

function buildNaturalLanguagePrompt({ anchorTag, coreTags, weakTags }) {
  const anchorName = String(anchorTag?.name || "").trim() || "daily listening";
  const anchorIsScene = isSceneTag(anchorTag);

  const anchorSentence = anchorIsScene
    ? `Must be a background track for scene ${anchorName}; keep this scene as absolute core from start to end, and restate scene ${anchorName} in the ending.`
    : `Must center on ${anchorName}; keep it as the absolute core from start to end and restate ${anchorName} in the ending.`;

  const coreParts = (coreTags || []).map(buildCoreConstraintPhrase).filter(Boolean);
  const coreSentence = coreParts.length > 0
    ? `Core constraints: ${coreParts.join(", ")}.`
    : "Core constraints: clear structure, smooth melody, and high replayability.";

  const weakParts = (weakTags || []).map(buildWeakSupplementPhrase).filter(Boolean);
  const weakSentence = weakParts.length > 0
    ? `Weak supplements: ${weakParts.join(", ")}.`
    : "Weak supplements: add only subtle decorations without breaking anchor and core constraints.";

  return [anchorSentence, coreSentence, weakSentence].join("\n");
}

function buildFallbackTitleHint(anchorTag, coreTags) {
  const anchorName = String(anchorTag?.name || "").trim();
  const firstCore = String((coreTags || [])[0]?.name || "").trim();
  const secondCore = String((coreTags || [])[1]?.name || "").trim();
  const parts = [anchorName, firstCore || secondCore].filter(Boolean);
  const title = parts.join(" ");
  return (title || "New Track").slice(0, 24);
}

function buildFallbackCoverHint(anchorTag, coreTags, weakTags) {
  const anchorName = String(anchorTag?.name || "").trim();
  const coreNames = (coreTags || []).map((tag) => String(tag.name || "").trim()).filter(Boolean);
  const weakNames = (weakTags || []).map((tag) => String(tag.name || "").trim()).filter(Boolean);
  return [
    `Cover centered on scene: ${anchorName || "music atmosphere"}.`,
    coreNames.length > 0
      ? `Primary visual elements: ${coreNames.join(", ")}.`
      : "Highlight melody and spatial depth.",
    weakNames.length > 0
      ? `Optional accents: ${weakNames.join(", ")}.`
      : "Keep background restrained and clean."
  ].join(" ");
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

  const sorted = [...rows].sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0));
  const sceneAnchor = pickSceneAnchor(sorted);
  const anchorTag = sceneAnchor || choosePrimaryAnchor(sorted);
  if (!anchorTag) {
    return {
      prompt: "",
      tagIds: [],
      base_prompt: "",
      title_hint: "",
      cover_hint: ""
    };
  }

  const selectedIds = new Set([Number(anchorTag.id)]);
  const coreTags = pickCoreConstraintTags(sorted, anchorTag, selectedIds);
  const weakTags = pickWeakSupplementTags(sorted, selectedIds);
  const chosen = [anchorTag, ...coreTags, ...weakTags];
  const tagIds = chosen.map((tag) => Number(tag.id));

  const basePrompt = buildNaturalLanguagePrompt({
    anchorTag,
    coreTags,
    weakTags
  });
  const fallbackTitleHint = buildFallbackTitleHint(anchorTag, coreTags);
  const fallbackCoverHint = buildFallbackCoverHint(anchorTag, coreTags, weakTags);

  const optimized = await optimizePromptWithDeepSeek({
    chosenTags: chosen,
    basePrompt,
    anchorTag,
    sceneAnchor,
    coreTags,
    weakTags,
    fallbackTitleHint,
    fallbackCoverHint
  });

  return {
    prompt: optimized.prompt || basePrompt,
    tagIds,
    base_prompt: basePrompt,
    title_hint: optimized.title_hint || fallbackTitleHint,
    cover_hint: optimized.cover_hint || fallbackCoverHint
  };
}

async function optimizePromptWithDeepSeek({
  chosenTags,
  basePrompt,
  anchorTag,
  sceneAnchor,
  coreTags,
  weakTags,
  fallbackTitleHint,
  fallbackCoverHint
}) {
  const fallback = {
    prompt: basePrompt,
    title_hint: fallbackTitleHint || "",
    cover_hint: fallbackCoverHint || ""
  };

  if (!Array.isArray(chosenTags) || chosenTags.length === 0) {
    return fallback;
  }

  if (!DEEPSEEK_ENABLED) {
    app.log.info("deepseek skipped: DEEPSEEK_ENABLED is false");
    return fallback;
  }

  if (!DEEPSEEK_API_KEY) {
    app.log.warn("deepseek skipped: DEEPSEEK_API_KEY missing");
    return fallback;
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

  const parseJsonObject = (rawText) => {
    const clean = String(rawText || "").trim();
    if (!clean) return null;
    try {
      return JSON.parse(clean);
    } catch {
      const start = clean.indexOf("{");
      const end = clean.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(clean.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  };

  try {
    app.log.info(
      {
        model: DEEPSEEK_MODEL,
        base_prompt: basePrompt,
        tags: tagSummary
      },
      "deepseek prompt optimization started"
    );

    const requestPayload = {
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You optimize music generation prompts. Return strict JSON only. No markdown, no code block, no explanation."
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Rewrite prompt into a stronger natural-language music generation prompt while preserving user tags.",
            product_requirements: DEEPSEEK_PRODUCT_REQUIREMENTS,
            base_prompt: basePrompt,
            anchor_rule: "Put anchor in sentence one and restate it in ending with hard constraints.",
            scene_priority_rule: "If any scene tag exists, scene must be the only anchor in sentence one and cannot be replaced by style or instrument.",
            core_rule: "Put 2-3 core constraints in sentence two using explicit wording.",
            weak_rule: "Put weak supplements in sentence three using soft wording.",
            anchor_tag: anchorTag
              ? { type: anchorTag.type, name: anchorTag.name, weight: Number(anchorTag.weight || 0) }
              : null,
            scene_anchor: sceneAnchor
              ? { type: sceneAnchor.type, name: sceneAnchor.name, weight: Number(sceneAnchor.weight || 0) }
              : null,
            core_tags: (coreTags || []).map((tag) => ({ type: tag.type, name: tag.name, weight: Number(tag.weight || 0) })),
            weak_tags: (weakTags || []).map((tag) => ({ type: tag.type, name: tag.name, weight: Number(tag.weight || 0) })),
            tags: tagSummary,
            grouped_tags: groupedGuide,
            output_schema: {
              prompt: "A complete natural-language music generation prompt",
              title_hint: "Short song title hint",
              cover_hint: "Short visual cover description"
            },
            constraints: [
              "Keep anchor/core/weak hierarchy clear.",
              "Do not contradict scene anchor.",
              "Return JSON object with keys: prompt, title_hint, cover_hint."
            ]
          })
        }
      ]
    };

    const modelCandidates = [...new Set([
      String(DEEPSEEK_MODEL || "").trim(),
      "deepseek-chat"
    ].filter(Boolean))];

    let data = null;
    let usedModel = modelCandidates[0] || "deepseek-chat";

    for (const modelName of modelCandidates) {
      usedModel = modelName;
      const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: modelName,
          ...requestPayload
        })
      });

      if (response.ok) {
        data = await response.json().catch(() => null);
        break;
      }

      const failText = await response.text().catch(() => "");
      app.log.warn(
        {
          status: response.status,
          model: modelName,
          body: String(failText || "").slice(0, 800)
        },
        "deepseek prompt optimization failed"
      );

      if (response.status !== 400) {
        return fallback;
      }
    }

    if (!data) return fallback;

    if (usedModel !== DEEPSEEK_MODEL) {
      app.log.info({ requested_model: DEEPSEEK_MODEL, used_model: usedModel }, "deepseek model fallback applied");
    }

    const content = data?.choices?.[0]?.message?.content;
    const parsed = parseJsonObject(content);
    if (!parsed) {
      app.log.warn({ content: String(content || "").slice(0, 800) }, "deepseek prompt parse failed");
      return fallback;
    }

    const optimizedPrompt = String(parsed?.prompt || "").trim();
    const sceneName = String(sceneAnchor?.name || "").trim();
    const sceneMatched = sceneName ? optimizedPrompt.includes(sceneName) : true;

    const result = {
      prompt: optimizedPrompt && sceneMatched ? optimizedPrompt : basePrompt,
      title_hint: String(parsed?.title_hint || "").trim() || fallback.title_hint,
      cover_hint: String(parsed?.cover_hint || "").trim() || fallback.cover_hint
    };

    app.log.info({ requested_model: DEEPSEEK_MODEL, used_model: usedModel, result }, "deepseek prompt optimization succeeded");
    return result;
  } catch (error) {
    app.log.warn({ err: String(error) }, "deepseek prompt optimization error");
    return fallback;
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
    title ? `Song title: ${title}.` : "",
    "Create a square music cover illustration with no text, logo, watermark, or typography.",
    "Keep one clear subject and an atmospheric background with strong color, light, layering, and mood.",
    prompt ? `Music mood reference: ${String(prompt).trim()}` : ""
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
  const numericUserId = Number(userId);
  const numericSongId = Number(songId);
  const numericJobId = jobId ? Number(jobId) : null;
  const { displayTitle = null, displayCoverUrl = null } = options;

  if (numericJobId) {
    const existing = await query(
      "SELECT id FROM user_song_queue WHERE user_id = $1 AND song_id = $2 AND generation_job_id = $3 ORDER BY id DESC LIMIT 1",
      [numericUserId, numericSongId, numericJobId]
    );
    if (existing.rows[0]) return existing.rows[0];
  }

  const { rows } = await query(
    "INSERT INTO user_song_queue (user_id, song_id, generation_job_id, source, display_title, display_cover_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    [
      numericUserId,
      numericSongId,
      numericJobId,
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
  const rawDisplayCoverUrl = generatedCover?.cover_url || librarySong.cover_url || null;
  const displayCoverUrl = rawDisplayCoverUrl
    ? await persistCoverAsset(rawDisplayCoverUrl).catch(() => rawDisplayCoverUrl)
    : null;

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

  const userCheck = await query("SELECT id FROM users WHERE id = $1 LIMIT 1", [Number(user_id)]);
  if (userCheck.rows.length === 0) {
    reply.code(404).send({ error: "user not found" });
    return;
  }

  const activeJobLookup = await query(
    "SELECT id, created_at FROM generation_jobs WHERE user_id = $1 AND status IN ('pending', 'submitted') ORDER BY id DESC LIMIT 1",
    [Number(user_id)]
  );
  if (activeJobLookup.rows[0]?.id) {
    const active = activeJobLookup.rows[0];
    const createdMs = new Date(active.created_at).getTime();
    const isStale = Number.isFinite(createdMs) ? (Date.now() - createdMs > ACTIVE_JOB_STALE_MS) : false;

    if (isStale) {
      await query(
        "UPDATE generation_jobs SET status = 'failed', error = $1 WHERE id = $2",
        ['stale pending/submitted job timed out', Number(active.id)]
      );
    } else {
      const activeJob = await getGenerationJobDetail(active.id);
      return {
        job_id: Number(active.id),
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

  const clipDuration = prefetch
    ? Math.max(EXPLORE_SNIPPET_SECONDS_MIN, Math.min(EXPLORE_SNIPPET_SECONDS_MAX, EXPLORE_SNIPPET_SECONDS_MIN + Math.floor(Math.random() * (EXPLORE_SNIPPET_SECONDS_MAX - EXPLORE_SNIPPET_SECONDS_MIN + 1))))
    : null;

  const payload = {
    model: modelToUse,
    prompt,
    callback_url: `${process.env.CALLBACK_BASE}/callback/tpy`
  };
  if (clipDuration) {
    payload.duration = clipDuration;
  }

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

    if (!(itemId && audioUrl)) continue;

    let persistedAudioUrl = null;
    try {
      persistedAudioUrl = await persistRemoteAsset(audioUrl, "audio");
    } catch (error) {
      app.log.warn({ item_id: itemId, err: String(error) }, "audio persist failed");
      if (itemId) {
        await query(
          "UPDATE generation_jobs SET status = 'failed', error = $1 WHERE $2 = ANY(item_ids)",
          ["audio persist failed", itemId]
        );
      }
      continue;
    }

    const existingAsset = await query(
      "SELECT song_id FROM song_assets WHERE item_id = $1 LIMIT 1",
      [itemId]
    );
    if (existingAsset.rows.length > 0) {
      await query(
        "UPDATE song_assets SET audio_url = COALESCE($1, audio_url) WHERE item_id = $2",
        [persistedAudioUrl, itemId]
      );
      continue;
    }

    const existingByAudio = await query(
      "SELECT sa.song_id, s.title, s.cover_url FROM song_assets sa JOIN songs s ON s.id = sa.song_id WHERE sa.audio_url = $1 ORDER BY sa.id ASC LIMIT 1",
      [persistedAudioUrl]
    );

    if (existingByAudio.rows.length > 0) {
      const existingSong = existingByAudio.rows[0];

      const matchedJobs = await query(
        "UPDATE generation_jobs SET status = 'reused', item_ids = $1 WHERE $2 = ANY(item_ids) AND status IN ('pending', 'submitted') RETURNING id, user_id, title_hint",
        [[itemId], itemId]
      );

      for (const job of matchedJobs.rows) {
        const displayTitle = normalizeTitle(job.title_hint || existingSong.title || null, existingSong.title || null);
        await queueSongForUser(job.user_id, Number(existingSong.song_id), job.id, 'reused', {
          displayTitle,
          displayCoverUrl: existingSong.cover_url || null
        });
        await query(
          "UPDATE songs SET reuse_count = reuse_count + 1 WHERE id = $1",
          [Number(existingSong.song_id)]
        );
      }

      continue;
    }

    const { rows } = await query(
      "UPDATE generation_jobs SET status = 'processing' WHERE $1 = ANY(item_ids) AND status IN ('pending', 'submitted') RETURNING id, user_id, prompt, base_prompt, title_hint, cover_hint, tag_ids",
      [itemId]
    );

    if (rows.length === 0) {
      continue;
    }

    const job = rows[0];
    const displayTitle = normalizeTitle(job.title_hint || s?.title || null, s?.title || null);
    const generatedCover = await generateCoverImage({
      title: displayTitle,
      coverHint: job.cover_hint || job.prompt,
      prompt: job.prompt
    });
    const rawCoverUrl = generatedCover?.cover_url || s?.cover_url || s?.image_url || s?.cover || null;
    const coverUrl = rawCoverUrl
      ? await persistCoverAsset(rawCoverUrl).catch(() => rawCoverUrl)
      : null;

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
    const songId = Number(song.rows[0].id);

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
      [songId, itemId, persistedAudioUrl]
    );

    await queueSongForUser(job.user_id, songId, job.id, 'generated', {
      displayTitle,
      displayCoverUrl: coverUrl
    });

    await query(
      "UPDATE generation_jobs SET status = 'done', error = NULL WHERE id = $1 AND status IN ('processing', 'pending', 'submitted')",
      [Number(job.id)]
    );
  }

  reply.send("success");
});

app.post("/feedback", async (request, reply) => {
  const { user_id, song_id, queue_id, action, played_seconds } = request.body || {};
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
  }  if (queue_id && Number.isFinite(Number(queue_id))) {
    await query(
      "UPDATE user_song_queue SET acted_at = NOW(), is_hidden = CASE WHEN $1 IN ('skip', 'complete') THEN true ELSE is_hidden END WHERE id = $2 AND user_id = $3",
      [normalizedAction, Number(queue_id), Number(user_id)]
    );
  } else {
    await query(
      "UPDATE user_song_queue SET acted_at = NOW(), is_hidden = CASE WHEN $1 IN ('skip', 'complete') THEN true ELSE is_hidden END WHERE id = (SELECT q.id FROM user_song_queue q WHERE q.user_id = $2 AND q.song_id = $3 AND COALESCE(q.is_hidden, false) = false ORDER BY q.created_at DESC, q.id DESC LIMIT 1)",
      [normalizedAction, Number(user_id), Number(song_id)]
    );
  }

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

async function getExploreState(userId) {
  const { rows } = await query(
    "SELECT action, created_at FROM feedback WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20",
    [Number(userId)]
  );

  let skipStreak = 0;
  for (const row of rows) {
    if (String(row.action || "").toLowerCase() === "skip") {
      skipStreak += 1;
      continue;
    }
    break;
  }

  if (skipStreak >= 2) {
    return { mode: "explore_deep", skip_streak: skipStreak };
  }
  return { mode: "stable", skip_streak: skipStreak };
}

async function getPlayableQueue(userId) {
  const { rows } = await query(
    "SELECT q.id AS queue_id, s.id, COALESCE(q.display_title, s.title) AS title, COALESCE(q.display_cover_url, s.cover_url) AS cover_url, s.prompt, sa.audio_url, q.created_at, q.source, COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tags FROM user_song_queue q JOIN songs s ON s.id = q.song_id JOIN LATERAL (SELECT audio_url FROM song_assets WHERE song_id = s.id AND audio_url IS NOT NULL ORDER BY id DESC LIMIT 1) sa ON true LEFT JOIN song_tags st ON st.song_id = s.id LEFT JOIN tags t ON t.id = st.tag_id WHERE q.user_id = $1 AND COALESCE(q.is_hidden, false) = false GROUP BY q.id, s.id, q.display_title, q.display_cover_url, s.prompt, sa.audio_url, q.created_at, q.source ORDER BY q.created_at ASC, q.id ASC",
    [Number(userId)]
  );
  return rows.filter((row) => row.audio_url && !isAudioUrlLikelyExpired(row.audio_url));
}

function rotateQueueFromCursor(items, cursorQueueId) {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (!Number.isFinite(Number(cursorQueueId))) return items;

  const cursor = Number(cursorQueueId);
  const nextIndex = items.findIndex((item) => Number(item.queue_id) > cursor);
  if (nextIndex < 0) return items;
  return [...items.slice(nextIndex), ...items.slice(0, nextIndex)];
}

app.get("/recommend/next", async (request, reply) => {
  const { user_id, cursor_queue_id, buffer } = request.query || {};
  if (!user_id) {
    reply.code(400).send({ error: "user_id required" });
    return;
  }

  const queue = await getPlayableQueue(user_id);
  const ordered = rotateQueueFromCursor(queue, cursor_queue_id);
  const bufferSize = Math.max(1, Math.min(20, Number(buffer || 5)));

  const pendingJob = await query(
    "SELECT id, created_at FROM generation_jobs WHERE user_id = $1 AND status IN ('pending', 'submitted') ORDER BY id DESC LIMIT 1",
    [Number(user_id)]
  );

  let hasPendingGeneration = pendingJob.rows.length > 0;
  if (hasPendingGeneration) {
    const pending = pendingJob.rows[0];
    const createdMs = new Date(pending.created_at).getTime();
    const isStale = Number.isFinite(createdMs) ? (Date.now() - createdMs > ACTIVE_JOB_STALE_MS) : false;
    if (isStale) {
      await query(
        "UPDATE generation_jobs SET status = 'failed', error = $1 WHERE id = $2",
        ['stale pending/submitted job timed out', Number(pending.id)]
      );
      hasPendingGeneration = false;
    }
  }

  const explore = await getExploreState(user_id);


  let runtimeBuffer = ordered.slice(0, bufferSize);
  let nextItem = runtimeBuffer[0] || null;
  let currentPlaying = ordered[0] || null;
  let nextPrepared = ordered[1] || null;

  if (explore.mode === "explore_deep") {
    const pool = buildExplorePool(ordered, Math.min(EXPLORE_POOL_SIZE, bufferSize));
    runtimeBuffer = pool.slice(0, bufferSize);
    nextItem = runtimeBuffer[0] || null;
    currentPlaying = nextItem;
    nextPrepared = runtimeBuffer[1] || null;
    await cacheExploreRuntime(user_id, runtimeBuffer);
  } else {
    await cacheStableRuntime(user_id, ordered);
  }

  return {
    mode: explore.mode,
    skip_streak: explore.skip_streak,
    next: nextItem,
    buffer: runtimeBuffer,
    current_playing: currentPlaying,
    next_prepared: nextPrepared,
    standby_pool_size: explore.mode === "explore_deep" ? runtimeBuffer.length : 0,
    playable_count: queue.length,
    has_pending_generation: hasPendingGeneration,
    needs_generation: queue.length < 2 && !hasPendingGeneration
  };
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

await ensureRuntimeSchema();
await ensureAssetStorageDirs();
app.listen({ port, host: "0.0.0.0" });







