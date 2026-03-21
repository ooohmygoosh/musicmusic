import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Audio } from "expo-av";

const AUDIO_LOAD_TIMEOUT_MS = 9000;
const FETCH_TIMEOUT_MS = 10000;
const OPERATION_TIMEOUT_MS = 15000;
const FAILED_KEY_TTL_MS = 2 * 60 * 1000;
const MAX_RECOVER_STEPS = 4;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(promise, ms, message) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message || "operation timeout")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const data = await parseJsonSafe(res);
    return { res, data };
  } finally {
    clearTimeout(timer);
  }
}

function queueKeyOf(song) {
  return song?.queue_id || song?.id || song?.audio_url || null;
}

function queueOrderOf(song) {
  const v = Number(song?.queue_id);
  return Number.isFinite(v) ? v : null;
}

function isAudioUrlLikelyExpired(url) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
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

function isBlockedKey(failedMap, key) {
  if (!key || !failedMap?.has(key)) return false;
  const failedAt = Number(failedMap.get(key) || 0);
  if (!Number.isFinite(failedAt)) {
    failedMap.delete(key);
    return false;
  }
  if (Date.now() - failedAt > FAILED_KEY_TTL_MS) {
    failedMap.delete(key);
    return false;
  }
  return true;
}

function normalizeQueueSongs(list, failedMap) {
  const seen = new Set();
  const items = [];
  for (const raw of list || []) {
    if (!raw || !raw.audio_url) continue;
    if (isAudioUrlLikelyExpired(raw.audio_url)) continue;
    const key = queueKeyOf(raw);
    if (!key || seen.has(key)) continue;
    if (isBlockedKey(failedMap, key)) continue;
    seen.add(key);
    items.push(raw);
  }
  return items;
}

function firstPlayable(items, failedMap) {
  for (const song of items || []) {
    if (!song?.audio_url) continue;
    if (isAudioUrlLikelyExpired(song.audio_url)) continue;
    const key = queueKeyOf(song);
    if (!key || isBlockedKey(failedMap, key)) continue;
    return song;
  }
  return null;
}

function findByQueueKey(items, sample) {
  const key = queueKeyOf(sample);
  if (!key) return null;
  return (items || []).find((x) => queueKeyOf(x) === key) || null;
}

function pickNextAfterCursor(items, cursorQueueId, failedMap) {
  const cursor = Number(cursorQueueId);
  if (!Array.isArray(items) || items.length === 0) return null;
  if (!Number.isFinite(cursor)) return firstPlayable(items, failedMap);

  for (const item of items) {
    const order = queueOrderOf(item);
    if (!Number.isFinite(order) || order <= cursor) continue;
    const key = queueKeyOf(item);
    if (!key || isBlockedKey(failedMap, key)) continue;
    if (isAudioUrlLikelyExpired(item.audio_url)) continue;
    return item;
  }

  return null;
}

export function usePlaybackEngine({ apiBase, userId, onNeedsGeneration }) {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [playback, setPlayback] = useState({ position: 0, duration: 1, isPlaying: false });
  const [recommendation, setRecommendation] = useState({ mode: "stable", skipStreak: 0, needsGeneration: false });
  const [status, setStatus] = useState("idle");
  const [lastError, setLastError] = useState("");

  const queueRef = useRef(queue);
  const currentRef = useRef(current);
  const soundRef = useRef(null);
  const operationRef = useRef(Promise.resolve());
  const mountedRef = useRef(false);
  const completeHandledKeyRef = useRef(null);
  const nextRef = useRef(async () => false);
  const playSongInternalRef = useRef(async () => false);
  const failedQueueKeyAtRef = useRef(new Map());
  const serverCurrentRef = useRef(null);
  const serverNextRef = useRef(null);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const runSerial = useCallback((task) => {
    const wrapped = async () => {
      try {
        return await withTimeout(Promise.resolve().then(task), OPERATION_TIMEOUT_MS, "player operation timeout");
      } catch (err) {
        const message = String(err?.message || err || "player operation failed");
        setLastError(message);
        setStatus((prev) => (prev === "idle" ? "idle" : "error"));
        return false;
      }
    };

    const runner = operationRef.current.then(wrapped, wrapped);
    operationRef.current = runner.then(() => undefined, () => undefined);
    return runner;
  }, []);

  const unloadCurrentSound = useCallback(async () => {
    if (!soundRef.current) return;
    const sound = soundRef.current;
    soundRef.current = null;
    await sound.stopAsync().catch(() => {});
    await sound.unloadAsync().catch(() => {});
  }, []);

  const requestRecommendations = useCallback(async (options = {}) => {
    if (!userId) {
      return {
        items: [],
        serverCurrent: null,
        serverNext: null,
        needsGeneration: false,
        mode: "stable",
        skipStreak: 0
      };
    }

    const query = new URLSearchParams({
      user_id: String(userId),
      buffer: String(options.buffer || 8)
    });
    if (options.cursorQueueId) query.set("cursor_queue_id", String(options.cursorQueueId));

    const { res, data } = await fetchJsonWithTimeout(`${apiBase}/recommend/next?${query.toString()}`);
    if (!res.ok) {
      throw new Error(data.error || "recommendation fetch failed");
    }

    const items = normalizeQueueSongs(data.buffer || [], failedQueueKeyAtRef.current);
    const serverCurrent = findByQueueKey(items, data.current_playing) || findByQueueKey(items, data.next);
    const serverNext = findByQueueKey(items, data.next_prepared) || null;

    serverCurrentRef.current = serverCurrent;
    serverNextRef.current = serverNext;

    const nextRecommendation = {
      mode: String(data.mode || "stable"),
      skipStreak: Number(data.skip_streak || 0),
      needsGeneration: Boolean(data.needs_generation)
    };

    setRecommendation(nextRecommendation);
    setQueue(items);

    const localCurrent = currentRef.current;
    const localCurrentInItems = findByQueueKey(items, localCurrent);
    if (localCurrentInItems) {
      setCurrent(localCurrentInItems);
    } else if (serverCurrent) {
      setCurrent(serverCurrent);
    } else {
      setCurrent(firstPlayable(items, failedQueueKeyAtRef.current));
    }

    if (items.length > 0) {
      setStatus((prev) => (prev === "paused" ? "paused" : "ready"));
    } else if (nextRecommendation.needsGeneration) {
      setStatus("empty");
      if (onNeedsGeneration) onNeedsGeneration();
    } else {
      setStatus("empty");
    }

    return {
      items,
      serverCurrent,
      serverNext,
      needsGeneration: nextRecommendation.needsGeneration,
      mode: nextRecommendation.mode,
      skipStreak: nextRecommendation.skipStreak
    };
  }, [apiBase, onNeedsGeneration, userId]);

  const refresh = useCallback(async (options = {}) => {
    return runSerial(async () => requestRecommendations(options));
  }, [requestRecommendations, runSerial]);

  const sendFeedback = useCallback(async (song, action) => {
    if (!userId || !song?.id || !action) return;
    await withTimeout(
      fetch(`${apiBase}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          song_id: song.id,
          queue_id: song.queue_id || null,
          action,
          played_seconds: Math.floor((playback.position || 0) / 1000)
        })
      }),
      FETCH_TIMEOUT_MS,
      "feedback timeout"
    ).catch(() => {});
  }, [apiBase, playback.position, userId]);

  const markSongFailed = useCallback((song) => {
    const key = queueKeyOf(song);
    if (!key) return;
    failedQueueKeyAtRef.current.set(key, Date.now());
    setQueue((prev) => prev.filter((item) => queueKeyOf(item) !== key));
  }, []);

  const playSongInternal = useCallback(async (song, options = {}) => {
    if (!song?.audio_url) return false;
    if (isAudioUrlLikelyExpired(song.audio_url)) {
      markSongFailed(song);
      return false;
    }

    const songKey = queueKeyOf(song);
    if (isBlockedKey(failedQueueKeyAtRef.current, songKey)) return false;

    setStatus("loading");
    setLastError("");
    completeHandledKeyRef.current = null;
    await unloadCurrentSound();

    try {
      const created = await withTimeout(
        Audio.Sound.createAsync(
          { uri: song.audio_url },
          { shouldPlay: false, progressUpdateIntervalMillis: 250 },
          (soundStatus) => {
            if (!mountedRef.current || !soundStatus?.isLoaded) return;
            setPlayback((prev) => ({
              position: soundStatus.positionMillis || 0,
              duration: soundStatus.durationMillis || prev.duration || 1,
              isPlaying: Boolean(soundStatus.isPlaying)
            }));

            if (soundStatus.didJustFinish) {
              const doneKey = queueKeyOf(currentRef.current);
              if (!doneKey || completeHandledKeyRef.current === doneKey) return;
              completeHandledKeyRef.current = doneKey;
              nextRef.current("complete").catch(() => {});
            }
          }
        ),
        AUDIO_LOAD_TIMEOUT_MS,
        "audio load timeout"
      );

      soundRef.current = created.sound;
      await withTimeout(created.sound.playAsync(), 5000, "audio play timeout");
      setCurrent(song);
      setPlayback({ position: 0, duration: 1, isPlaying: true });
      setStatus("playing");
      return true;
    } catch (err) {
      const recoverDepth = Number(options.recoverDepth || 0);
      setLastError(String(err));
      markSongFailed(song);
      await unloadCurrentSound();

      if (recoverDepth >= MAX_RECOVER_STEPS || options.allowRecover === false) {
        setStatus("error");
        return false;
      }

      const refreshed = await requestRecommendations({
        cursorQueueId: song.queue_id || null,
        buffer: 8
      }).catch(() => ({ items: [] }));

      const nextSong = pickNextAfterCursor(refreshed.items || [], song.queue_id, failedQueueKeyAtRef.current);
      if (nextSong) {
        return playSongInternalRef.current(nextSong, {
          recoverDepth: recoverDepth + 1,
          allowRecover: true
        });
      }

      setCurrent(null);
      setPlayback({ position: 0, duration: 1, isPlaying: false });
      setStatus("empty");
      return false;
    }
  }, [markSongFailed, requestRecommendations, unloadCurrentSound]);

  playSongInternalRef.current = playSongInternal;

  const playSong = useCallback(async (song) => {
    return runSerial(async () => playSongInternalRef.current(song, { allowRecover: true, recoverDepth: 0 }));
  }, [runSerial]);

  const togglePlay = useCallback(async () => {
    return runSerial(async () => {
      const song = currentRef.current;

      if (!song) {
        const refreshed = await requestRecommendations({ buffer: 8 }).catch(() => ({ items: [] }));
        const first = refreshed.serverCurrent || firstPlayable(refreshed.items, failedQueueKeyAtRef.current);
        if (!first) {
          setStatus("empty");
          return false;
        }
        return playSongInternalRef.current(first, { allowRecover: true, recoverDepth: 0 });
      }

      if (!soundRef.current) {
        return playSongInternalRef.current(song, { allowRecover: true, recoverDepth: 0 });
      }

      const isPlaying = playback.isPlaying;
      if (isPlaying) {
        await soundRef.current.pauseAsync().catch(() => {});
        setStatus("paused");
      } else {
        await soundRef.current.playAsync().catch(() => {});
        setStatus("playing");
      }
      return true;
    });
  }, [playback.isPlaying, requestRecommendations, runSerial]);

  const next = useCallback(async (action = "skip") => {
    return runSerial(async () => {
      const song = currentRef.current;

      if (!song) {
        const refreshed = await requestRecommendations({ buffer: 8 }).catch(() => ({ items: [] }));
        const first = refreshed.serverCurrent || firstPlayable(refreshed.items, failedQueueKeyAtRef.current);
        if (!first) {
          setStatus("empty");
          return false;
        }
        return playSongInternalRef.current(first, { allowRecover: true, recoverDepth: 0 });
      }

      await sendFeedback(song, action);

      const refreshed = await requestRecommendations({
        cursorQueueId: song.queue_id || null,
        buffer: 8
      }).catch(() => ({ items: [], needsGeneration: false }));

      const fromServerPrepared = refreshed.serverNext;
      const fromCursor = pickNextAfterCursor(refreshed.items || [], song.queue_id, failedQueueKeyAtRef.current);
      const candidate = fromServerPrepared || fromCursor;

      if (candidate) {
        return playSongInternalRef.current(candidate, { allowRecover: true, recoverDepth: 0 });
      }

      await unloadCurrentSound();
      setCurrent(null);
      setPlayback({ position: 0, duration: 1, isPlaying: false });
      setStatus("empty");

      if (refreshed.needsGeneration && onNeedsGeneration) {
        onNeedsGeneration();
      }
      return false;
    });
  }, [onNeedsGeneration, requestRecommendations, runSerial, sendFeedback, unloadCurrentSound]);

  nextRef.current = next;

  const likeCurrent = useCallback(async () => {
    const song = currentRef.current;
    if (!song) return false;
    await sendFeedback(song, "like");
    return true;
  }, [sendFeedback]);

  const appendQueue = useCallback((list, source = "manual") => {
    const base = Array.isArray(list) ? list : [list];
    const now = Date.now();
    const manual = base
      .filter(Boolean)
      .map((song, idx) => ({
        ...song,
        queue_id: song.queue_id || `${source}-${song.id || "x"}-${now}-${idx}`,
        source
      }));

    setQueue((prev) => normalizeQueueSongs([...prev, ...manual], failedQueueKeyAtRef.current));
    if (!currentRef.current && manual.length > 0) {
      const first = firstPlayable(manual, failedQueueKeyAtRef.current);
      if (first) setCurrent(first);
    }
  }, []);

  const hardReset = useCallback(async () => {
    return runSerial(async () => {
      await unloadCurrentSound();
      failedQueueKeyAtRef.current.clear();
      serverCurrentRef.current = null;
      serverNextRef.current = null;
      setQueue([]);
      setCurrent(null);
      setPlayback({ position: 0, duration: 1, isPlaying: false });
      setRecommendation({ mode: "stable", skipStreak: 0, needsGeneration: false });
      setLastError("");
      setStatus("idle");
      return true;
    });
  }, [runSerial, unloadCurrentSound]);

  useEffect(() => {
    mountedRef.current = true;
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true
    }).catch(() => {});

    return () => {
      mountedRef.current = false;
      unloadCurrentSound().catch(() => {});
    };
  }, [unloadCurrentSound]);

  useEffect(() => {
    if (!userId) {
      setQueue([]);
      setCurrent(null);
      setPlayback({ position: 0, duration: 1, isPlaying: false });
      setStatus("idle");
      setLastError("");
      return;
    }

    let active = true;
    setStatus("loading");

    (async () => {
      await wait(20);
      if (!active) return;
      await requestRecommendations({ buffer: 8 }).catch((err) => {
        if (!active) return;
        setLastError(String(err));
        setStatus("error");
      });
    })();

    return () => {
      active = false;
    };
  }, [requestRecommendations, userId]);

  return useMemo(() => ({
    queue,
    current,
    playback,
    recommendation,
    status,
    lastError,
    refresh,
    playSong,
    togglePlay,
    next,
    likeCurrent,
    appendQueue,
    hardReset
  }), [
    appendQueue,
    current,
    hardReset,
    lastError,
    likeCurrent,
    next,
    playback,
    playSong,
    queue,
    recommendation,
    refresh,
    status,
    togglePlay
  ]);
}
