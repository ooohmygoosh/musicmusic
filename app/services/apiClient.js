import { API_BASE } from "../config";

const DEFAULT_TIMEOUT_MS = 10000;

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function buildUrl(path, query) {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request(path, options = {}) {
  const { query, body, errorMessage = "request failed", timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(buildUrl(path, query), {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : null),
        ...(fetchOptions.headers || {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await readJson(res);
    if (!res.ok) throw new Error(data.error || data.detail || errorMessage);
    return data;
  } catch (err) {
    if (err?.name === "AbortError") throw new Error(`${errorMessage}: timeout`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function listTags() {
  return request("/tags", { errorMessage: "tags fetch failed" });
}

export function registerAccount({ accountId, displayName, password, avatar }) {
  return request("/auth/register", {
    method: "POST",
    body: {
      account_id: accountId,
      display_name: displayName,
      password,
      avatar
    },
    errorMessage: "register failed"
  });
}

export function loginAccount({ accountId, password }) {
  return request("/auth/login", {
    method: "POST",
    body: {
      account_id: accountId,
      password
    },
    errorMessage: "login failed"
  });
}

export function listUserTags(userId) {
  return request("/user-tags", {
    query: { user_id: userId },
    errorMessage: "profile tags fetch failed"
  });
}

export function listRecommendations(userId, options = {}) {
  return request("/recommend/next", {
    query: {
      user_id: userId,
      buffer: options.buffer || 8,
      cursor_queue_id: options.cursorQueueId
    },
    errorMessage: "recommendation fetch failed"
  });
}

export function listSongHistory(userId) {
  return request("/songs", {
    query: { user_id: userId, include_history: true },
    errorMessage: "song history fetch failed"
  });
}

export function listFavorites(userId) {
  return request("/favorites", {
    query: { user_id: userId },
    errorMessage: "favorites fetch failed"
  });
}

export function listMySongs(userId) {
  return request("/my-songs", {
    query: { user_id: userId },
    errorMessage: "my songs fetch failed"
  });
}

export function getCreatorDashboard(userId) {
  return request("/creator/dashboard", {
    query: { user_id: userId },
    errorMessage: "creator dashboard fetch failed"
  });
}

export function listPlaylists(userId) {
  return request("/playlists", {
    query: { user_id: userId },
    errorMessage: "playlists fetch failed"
  });
}

export function listPlaylistSongs(playlistId) {
  return request(`/playlists/${playlistId}/songs`, {
    errorMessage: "playlist songs fetch failed"
  });
}

export function initUserTags(userId, tagIds) {
  return request("/init-tags", {
    method: "POST",
    body: { user_id: userId, tag_ids: tagIds },
    errorMessage: "init tags failed"
  });
}

export function updateUserTagWeight(userId, tagId, weight) {
  return request("/user-tags/weight", {
    method: "POST",
    body: { user_id: userId, tag_id: Number(tagId), weight: Number(weight) },
    errorMessage: "weight update failed"
  });
}

export function setUserSceneAnchor(userId, tagId) {
  return request("/user-tags/anchor", {
    method: "POST",
    body: { user_id: userId, tag_id: Number(tagId) },
    errorMessage: "anchor update failed"
  });
}

export function addUserTag(userId, name, type) {
  return request("/user-tags", {
    method: "POST",
    body: { user_id: userId, name, type: type || undefined },
    errorMessage: "tag add failed"
  });
}

export function createGenerationJob(userId, options = {}) {
  return request("/generate", {
    method: "POST",
    timeoutMs: 30000,
    body: {
      user_id: userId,
      instrumental: options.instrumental !== false,
      prefetch: Boolean(options.prefetch)
    },
    errorMessage: "generate failed"
  });
}

export function getGenerationJob(jobId) {
  return request(`/generation-jobs/${jobId}`, {
    errorMessage: "generation job lookup failed"
  });
}

export function createPlaylist(userId, name) {
  return request("/playlists", {
    method: "POST",
    body: { user_id: userId, name },
    errorMessage: "playlist create failed"
  });
}

export function addPlaylistSong(playlistId, songId) {
  return request(`/playlists/${playlistId}/add`, {
    method: "POST",
    body: { song_id: songId },
    errorMessage: "playlist add failed"
  });
}
