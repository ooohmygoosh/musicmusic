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

function findQueueIndex(items, sample) {
  const key = queueKeyOf(sample);
  if (!key) return -1;
  return (items || []).findIndex((item) => queueKeyOf(item) === key);
}

function firstPlayableFromIndex(items, startIndex, failedMap) {
  if (!Array.isArray(items) || items.length === 0) return null;
  for (let i = Math.max(0, Number(startIndex) || 0); i < items.length; i += 1) {
    const item = items[i];
    if (!item?.audio_url) continue;
    if (isAudioUrlLikelyExpired(item.audio_url)) continue;
    const key = queueKeyOf(item);
    if (!key || isBlockedKey(failedMap, key)) continue;
    return item;
  }
  return null;
}

function isPlayableSong(song, failedMap) {
  if (!song?.audio_url) return false;
  if (isAudioUrlLikelyExpired(song.audio_url)) return false;
  const key = queueKeyOf(song);
  if (!key || isBlockedKey(failedMap, key)) return false;
  return true;
}

function findPlayableAfterSong(items, currentSong, serverNext, failedMap) {
  if (!Array.isArray(items) || items.length === 0) return null;
  if (!currentSong) {
    if (isPlayableSong(serverNext, failedMap)) return serverNext;
    return firstPlayable(items, failedMap);
  }

  const currentIndex = findQueueIndex(items, currentSong);
  const localNext = firstPlayableFromIndex(items, currentIndex + 1, failedMap);
  if (localNext && queueKeyOf(localNext) !== queueKeyOf(currentSong)) return localNext;

  if (isPlayableSong(serverNext, failedMap) && queueKeyOf(serverNext) !== queueKeyOf(currentSong)) {
    return serverNext;
  }

  const afterCursor = pickNextAfterCursor(items, currentSong.queue_id, failedMap);
  if (afterCursor && queueKeyOf(afterCursor) !== queueKeyOf(currentSong)) return afterCursor;

  return null;
}

function mergeQueueHistory(existing, incoming, failedMap) {
  const prev = normalizeQueueSongs(existing || [], failedMap);
  const next = normalizeQueueSongs(incoming || [], failedMap);
  if (prev.length === 0) return next;
  if (next.length === 0) return prev;

  const nextByKey = new Map(next.map((item) => [queueKeyOf(item), item]));
  const seen = new Set();
  const merged = [];

  for (const item of prev) {
    const key = queueKeyOf(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(nextByKey.get(key) || item);
  }

  for (const item of next) {
    const key = queueKeyOf(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
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
  const [recommendation, setRecommendation] = useState({ mode: "stable", skipStreak: 0, needsGeneration: false, hasPendingGeneration: false });
  const [status, setStatus] = useState("idle");
  const [lastError, setLastError] = useState("");

  const queueRef = useRef(queue);
  const currentRef = useRef(current);
  const soundRef = useRef(null);
  const operationRef = useRef(Promise.resolve());
  const interactiveLockRef = useRef(false);
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

    const incomingItems = normalizeQueueSongs(data.buffer || [], failedQueueKeyAtRef.current);
    const mergedItems = mergeQueueHistory(queueRef.current, incomingItems, failedQueueKeyAtRef.current);
    const serverCurrent = findByQueueKey(mergedItems, data.current_playing) || findByQueueKey(mergedItems, data.next);
    const serverNext = findByQueueKey(mergedItems, data.next_prepared) || null;

    serverCurrentRef.current = serverCurrent;
    serverNextRef.current = serverNext;

    const nextRecommendation = {
      mode: String(data.mode || "stable"),
      skipStreak: Number(data.skip_streak || 0),
      needsGeneration: Boolean(data.needs_generation),
      hasPendingGeneration: Boolean(data.has_pending_generation)
    };

    setRecommendation(nextRecommendation);
    setQueue(mergedItems);

    const localCurrent = currentRef.current;
    const localCurrentInItems = findByQueueKey(mergedItems, localCurrent);
    if (localCurrentInItems) {
      setCurrent(localCurrentInItems);
    } else if (serverCurrent) {
      setCurrent(serverCurrent);
    } else {
      setCurrent(firstPlayable(mergedItems, failedQueueKeyAtRef.current));
    }

    if (mergedItems.length > 0) {
      setStatus((prev) => (prev === "paused" ? "paused" : "ready"));
    } else if (nextRecommendation.needsGeneration) {
      setStatus("empty");
      if (onNeedsGeneration) onNeedsGeneration();
    } else {
      setStatus("empty");
    }

    return {
      items: mergedItems,
      serverCurrent,
      serverNext,
      needsGeneration: nextRecommendation.needsGeneration,
      hasPendingGeneration: nextRecommendation.hasPendingGeneration,
      mode: nextRecommendation.mode,
      skipStreak: nextRecommendation.skipStreak
    };
  }, [apiBase, onNeedsGeneration, userId]);

  const refresh = useCallback(async (options = {}) => {
    return runSerial(async () => requestRecommendations(options));
  }, [requestRecommendations, runSerial]);

  const enterWaitingState = useCallback(async (options = {}) => {
    await unloadCurrentSound();
    serverCurrentRef.current = null;
    serverNextRef.current = null;
    setCurrent(null);
    setPlayback({ position: 0, duration: 1, isPlaying: false });
    setStatus(options.hasPendingGeneration ? "loading" : "empty");

    if ((options.needsGeneration || options.hasPendingGeneration) && onNeedsGeneration) {
      onNeedsGeneration();
    }
    return false;
  }, [onNeedsGeneration, unloadCurrentSound]);

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

  const advanceToCandidate = useCallback(async (candidate, options = {}) => {
    const sourceSong = options.sourceSong || null;
    const action = options.action || null;
    const preferRefresh = options.preferRefresh !== false;
    const feedbackPromise = sourceSong && action ? sendFeedback(sourceSong, action) : Promise.resolve();

    if (candidate) {
      const played = await playSongInternalRef.current(candidate, { allowRecover: true, recoverDepth: 0 });
      await feedbackPromise;

      if (played) {
        if (preferRefresh) {
          requestRecommendations({
            cursorQueueId: sourceSong?.queue_id || null,
            buffer: 8
          }).catch(() => ({ items: [], needsGeneration: false, hasPendingGeneration: false }));
        }
        return true;
      }
    } else {
      await feedbackPromise;
    }

    const refreshed = await requestRecommendations({
      cursorQueueId: sourceSong?.queue_id || null,
      buffer: 8
    }).catch(() => ({ items: [], serverCurrent: null, serverNext: null, needsGeneration: false, hasPendingGeneration: false }));

    const refreshedCandidate = candidate
      ? findByQueueKey(refreshed.items || [], candidate) || findPlayableAfterSong(refreshed.items || [], sourceSong, refreshed.serverNext, failedQueueKeyAtRef.current)
      : findPlayableAfterSong(refreshed.items || [], sourceSong, refreshed.serverNext, failedQueueKeyAtRef.current);

    if (refreshedCandidate) {
      return playSongInternalRef.current(refreshedCandidate, { allowRecover: true, recoverDepth: 0 });
    }

    return enterWaitingState({
      hasPendingGeneration: refreshed.hasPendingGeneration,
      needsGeneration: refreshed.needsGeneration
    });
  }, [enterWaitingState, requestRecommendations, sendFeedback]);

  const playSong = useCallback(async (song) => {
    if (interactiveLockRef.current) return false;
    interactiveLockRef.current = true;
    try {
      return await runSerial(async () => playSongInternalRef.current(song, { allowRecover: true, recoverDepth: 0 }));
    } finally {
      interactiveLockRef.current = false;
    }
  }, [runSerial]);

  const togglePlay = useCallback(async () => {
    if (interactiveLockRef.current) return false;
    interactiveLockRef.current = true;
    try {
      return await runSerial(async () => {
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
    } finally {
      interactiveLockRef.current = false;
    }
  }, [playback.isPlaying, requestRecommendations, runSerial]);

  const next = useCallback(async (action = "skip") => {
    const isInteractiveAction = action !== "complete";
    if (isInteractiveAction && interactiveLockRef.current) return false;
    if (isInteractiveAction) interactiveLockRef.current = true;
    try {
      return await runSerial(async () => {
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

        const queueSnapshot = queueRef.current || [];
        const candidate = findPlayableAfterSong(queueSnapshot, song, serverNextRef.current, failedQueueKeyAtRef.current);
        if (!candidate) setStatus("loading");

        return advanceToCandidate(candidate, {
          sourceSong: song,
          action
        });
      });
    } finally {
      if (isInteractiveAction) interactiveLockRef.current = false;
    }
  }, [advanceToCandidate, requestRecommendations, runSerial]);

  nextRef.current = next;

  const likeCurrent = useCallback(async () => {
    const song = currentRef.current;
    if (!song) return false;
    await sendFeedback(song, "like");
    return true;
  }, [sendFeedback]);

  const materializeQueueSongs = useCallback((list, source = "manual") => {
    const base = Array.isArray(list) ? list : [list];
    const now = Date.now();
    return base
      .filter(Boolean)
      .map((song, idx) => ({
        ...song,
        queue_id: song.queue_id || `${source}-${song.id || "x"}-${now}-${idx}`,
        source
      }));
  }, []);

  const appendQueue = useCallback((list, source = "manual") => {
    const manual = materializeQueueSongs(list, source);
    setQueue((prev) => normalizeQueueSongs([...prev, ...manual], failedQueueKeyAtRef.current));
    if (!currentRef.current && manual.length > 0) {
      const first = firstPlayable(manual, failedQueueKeyAtRef.current);
      if (first) setCurrent(first);
    }
    return manual;
  }, [materializeQueueSongs]);

  const insertQueueNext = useCallback((list, source = "manual") => {
    const manual = materializeQueueSongs(list, source);
    setQueue((prev) => {
      const currentIndex = findQueueIndex(prev, currentRef.current);
      const insertAt = currentIndex >= 0 ? currentIndex + 1 : prev.length;
      return normalizeQueueSongs([...prev.slice(0, insertAt), ...manual, ...prev.slice(insertAt)], failedQueueKeyAtRef.current);
    });
    if (!currentRef.current && manual.length > 0) {
      const first = firstPlayable(manual, failedQueueKeyAtRef.current);
      if (first) setCurrent(first);
    }
    return manual;
  }, [materializeQueueSongs]);

  const insertQueueNextAndPlay = useCallback(async (list, source = "manual-next") => {
    const manual = materializeQueueSongs(list, source);
    const firstInserted = firstPlayable(manual, failedQueueKeyAtRef.current);
    if (manual.length === 0 || !firstInserted) return manual;

    setQueue((prev) => {
      const currentIndex = findQueueIndex(prev, currentRef.current);
      const insertAt = currentIndex >= 0 ? currentIndex + 1 : prev.length;
      return normalizeQueueSongs([...prev.slice(0, insertAt), ...manual, ...prev.slice(insertAt)], failedQueueKeyAtRef.current);
    });

    if (interactiveLockRef.current) return manual;
    interactiveLockRef.current = true;
    try {
      await runSerial(async () => {
        const sourceSong = currentRef.current;
        if (!sourceSong) {
          return playSongInternalRef.current(firstInserted, { allowRecover: true, recoverDepth: 0 });
        }

        return advanceToCandidate(firstInserted, {
          sourceSong,
          action: "skip"
        });
      });
    } finally {
      interactiveLockRef.current = false;
    }

    return manual;
  }, [advanceToCandidate, materializeQueueSongs, runSerial]);

  const hardReset = useCallback(async () => {
    return runSerial(async () => {
      await unloadCurrentSound();
      failedQueueKeyAtRef.current.clear();
      serverCurrentRef.current = null;
      serverNextRef.current = null;
      setQueue([]);
      setCurrent(null);
      setPlayback({ position: 0, duration: 1, isPlaying: false });
      setRecommendation({ mode: "stable", skipStreak: 0, needsGeneration: false, hasPendingGeneration: false });
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
    insertQueueNext,
    insertQueueNextAndPlay,
    hardReset
  }), [
    appendQueue,
    current,
    hardReset,
    insertQueueNext,
    insertQueueNextAndPlay,
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
