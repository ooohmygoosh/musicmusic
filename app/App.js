import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Audio } from "expo-av";
import { API_BASE } from "./config";

const TABS = ["player", "favorites", "profile", "settings"];
const TYPES = ["情绪", "风格", "乐器", "场景", "节奏", "人声"];
const COLORS = {
  情绪: "#FF9681",
  风格: "#7D8CFF",
  乐器: "#73B48A",
  场景: "#F6B56D",
  节奏: "#68A9DC",
  人声: "#B496FF",
  其他: "#E39C7B"
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const normalizeTags = (tags) => Array.isArray(tags) ? tags.filter(Boolean).map((t) => String(t).trim()).filter(Boolean) : [];
const fmt = (ms) => {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};
const colorFor = (type) => COLORS[type] || COLORS["其他"];

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.error || data?.detail || data?.raw || `请求失败：${res.status}`);
  return data;
}

function Backdrop({ tags }) {
  const blobs = useMemo(() => {
    const top = (tags || []).filter((x) => x?.is_active !== false).slice(0, 6);
    const pos = [
      { top: -40, left: -50 },
      { top: 60, right: -60 },
      { top: 240, left: 10 },
      { top: 320, right: -30 },
      { bottom: 170, left: -40 },
      { bottom: 110, right: -50 }
    ];
    return top.map((item, i) => ({
      id: item.tag_id || `${item.name}-${i}`,
      color: colorFor(item.type),
      size: 180 + clamp(Number(item.weight || 0.3), 0.15, 1) * 160,
      ...pos[i % pos.length]
    }));
  }, [tags]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.bgBase} />
      {blobs.map((blob) => (
        <View
          key={blob.id}
          style={[
            styles.blob,
            {
              width: blob.size,
              height: blob.size,
              borderRadius: blob.size / 2,
              backgroundColor: blob.color,
              top: blob.top,
              left: blob.left,
              right: blob.right,
              bottom: blob.bottom
            }
          ]}
        />
      ))}
      <View style={styles.bgVeil} />
    </View>
  );
}

function Section({ title, sub, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {!!sub && <Text style={styles.cardSub}>{sub}</Text>}
      <View style={{ marginTop: 12 }}>{children}</View>
    </View>
  );
}

function AuthScreen({
  mode,
  setMode,
  deviceId,
  setDeviceId,
  displayName,
  setDisplayName,
  submitting,
  onSubmit
}) {
  return (
    <SafeAreaView style={styles.authShell}>
      <View style={styles.authCard}>
        <Text style={styles.heroEyebrow}>TPY MUSIC</Text>
        <Text style={styles.heroTitle}>重新开始，一版稳定的新界面。</Text>
        <Text style={styles.heroSubtitle}>先把登录、选标签、播放、收藏、画像这些核心流程稳稳跑起来。</Text>
        <View style={styles.segmentRow}>
          <TouchableOpacity style={[styles.segmentButton, mode === "login" && styles.segmentButtonActive]} onPress={() => setMode("login")}>
            <Text style={[styles.segmentText, mode === "login" && styles.segmentTextActive]}>登录</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segmentButton, mode === "register" && styles.segmentButtonActive]} onPress={() => setMode("register")}>
            <Text style={[styles.segmentText, mode === "register" && styles.segmentTextActive]}>注册</Text>
          </TouchableOpacity>
        </View>
        <TextInput value={deviceId} onChangeText={setDeviceId} placeholder="设备标识 / 用户名" placeholderTextColor="#8D877D" style={styles.input} autoCapitalize="none" />
        <TextInput value={displayName} onChangeText={setDisplayName} placeholder="显示名称" placeholderTextColor="#8D877D" style={styles.input} />
        <TouchableOpacity style={styles.primaryButton} onPress={onSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>{mode === "login" ? "进入应用" : "创建账户"}</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function OnboardingScreen({ tags, typeIndex, selected, toggleTag, onBack, onNext, onFinish }) {
  const currentType = TYPES[typeIndex];
  const options = tags.filter((tag) => tag.type === currentType);
  const progress = (typeIndex + 1) / TYPES.length;
  return (
    <SafeAreaView style={styles.authShell}>
      <View style={styles.authCard}>
        <Text style={styles.heroEyebrow}>初始标签</Text>
        <Text style={styles.heroTitle}>先选你现在最在意的 {currentType}</Text>
        <Text style={styles.heroSubtitle}>只会把你选中的标签加入画像，其他内容后面通过探索和手动添加慢慢补进来。</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
        <Text style={styles.progressText}>第 {typeIndex + 1} / {TYPES.length} 类</Text>
        <ScrollView style={styles.selectionList} contentContainerStyle={styles.selectionListContent}>
          {options.map((tag) => {
            const checked = selected.includes(tag.id);
            return (
              <TouchableOpacity key={tag.id} style={[styles.choiceChip, checked && styles.choiceChipActive]} onPress={() => toggleTag(tag.id)}>
                <Text style={[styles.choiceChipText, checked && styles.choiceChipTextActive]}>{tag.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={styles.onboardingActions}>
          <TouchableOpacity style={styles.ghostButton} onPress={onBack} disabled={typeIndex === 0}>
            <Text style={styles.ghostButtonText}>上一步</Text>
          </TouchableOpacity>
          {typeIndex < TYPES.length - 1 ? (
            <TouchableOpacity style={styles.primaryButtonCompact} onPress={onNext}>
              <Text style={styles.primaryButtonText}>下一个类别</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryButtonCompact} onPress={onFinish}>
              <Text style={styles.primaryButtonText}>完成并进入</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const soundRef = useRef(null);
  const autoPlayRef = useRef(false);
  const jobPollRef = useRef(null);
  const feedbackRef = useRef({ inFlight: false, key: "", finishedSongId: null });
  const [mode, setMode] = useState("login");
  const [deviceId, setDeviceId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("player");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const [needInit, setNeedInit] = useState(false);
  const [step, setStep] = useState(0);
  const [initTagIds, setInitTagIds] = useState([]);
  const [songs, setSongs] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [favorites, setFavorites] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [userTags, setUserTags] = useState([]);
  const [posMs, setPosMs] = useState(0);
  const [durMs, setDurMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationJobId, setGenerationJobId] = useState(null);
  const [generationStatus, setGenerationStatus] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const [tagName, setTagName] = useState("");
  const [askType, setAskType] = useState(false);
  const [pendingTag, setPendingTag] = useState("");
  const [selectedType, setSelectedType] = useState(TYPES[0]);
  const [favoritePickerOpen, setFavoritePickerOpen] = useState(false);
  const [expandedPlaylistId, setExpandedPlaylistId] = useState(null);
  const [playlistSongs, setPlaylistSongs] = useState({});
  const [playlistLoadingId, setPlaylistLoadingId] = useState(null);

  const currentSong = songs[currentIndex] || null;
  const sortedUserTags = useMemo(() => [...(userTags || [])].sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0)), [userTags]);

  useEffect(() => { loadTags(); return () => { stopJobPolling(); unload(); }; }, []);
  useEffect(() => { if (user && !needInit) refreshAll(); }, [user?.id, needInit]);
  useEffect(() => { prepareSound(); return () => {}; }, [currentSong?.id, currentSong?.audio_url]);
  useEffect(() => { feedbackRef.current.finishedSongId = null; }, [currentSong?.id]);

  function stopJobPolling() {
    if (jobPollRef.current) {
      clearInterval(jobPollRef.current);
      jobPollRef.current = null;
    }
  }

  async function unload() {
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  }

  async function playSongAt(index, shouldAutoPlay = true) {
    autoPlayRef.current = shouldAutoPlay;
    if (index === currentIndex) {
      if (soundRef.current) {
        try {
          await soundRef.current.setPositionAsync(0);
          if (shouldAutoPlay) {
            await soundRef.current.playAsync();
            setPlaying(true);
          }
        } catch {
          await prepareSound();
        }
      } else {
        await prepareSound();
      }
      return;
    }
    setCurrentIndex(index);
  }

  async function prepareSound() {
    if (!currentSong?.audio_url) {
      await unload();
      setPlaying(false); setPosMs(0); setDurMs(0);
      return;
    }
    try {
      const shouldPlay = autoPlayRef.current;
      autoPlayRef.current = false;
      await unload();
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: currentSong.audio_url },
        { shouldPlay },
        (s) => {
          if (!s.isLoaded) return;
          setPosMs(s.positionMillis || 0);
          setDurMs(s.durationMillis || 0);
          setPlaying(!!s.isPlaying);
          if (s.didJustFinish && feedbackRef.current.finishedSongId !== currentSong?.id) {
            feedbackRef.current.finishedSongId = currentSong?.id;
            handleFeedback("complete", { silent: true });
          }
        }
      );
      soundRef.current = sound;
      setPosMs(status.positionMillis || 0);
      setDurMs(status.durationMillis || 0);
      setPlaying(!!status.isPlaying);
    } catch (e) {
      setNotice("音频加载失败");
    }
  }
  async function loadTags() {
    try {
      const data = await api("/tags");
      setAllTags(data?.items || []);
    } catch (e) {
      setNotice(e.message);
    }
  }

  async function refreshAll() {
    if (!user?.id) return [];
    setBusy(true);
    try {
      const [songRes, favRes, utRes, plRes] = await Promise.all([
        api(`/songs?user_id=${user.id}&include_history=true`),
        api(`/favorites?user_id=${user.id}`),
        api(`/user-tags?user_id=${user.id}`),
        api(`/playlists?user_id=${user.id}`)
      ]);
      const nextSongs = songRes?.items || [];
      setSongs(nextSongs);
      setCurrentIndex((v) => clamp(v, 0, Math.max(0, nextSongs.length - 1)));
      setFavorites(favRes?.items || []);
      setUserTags(utRes?.items || []);
      setPlaylists(plRes?.items || []);
      return nextSongs;
    } catch (e) {
      setNotice(e.message);
      return [];
    } finally {
      setBusy(false);
    }
  }

  function findSongIndex(songId, nextSongs = songs) {
    return (nextSongs || []).findIndex((item) => Number(item.id) === Number(songId));
  }

  function getNextPlayableIndex(fromIndex, nextSongs = songs) {
    const list = nextSongs || [];
    for (let i = fromIndex + 1; i < list.length; i += 1) {
      if (!list[i]?.is_hidden) return i;
    }
    return -1;
  }

  function resolvePlaybackIndex(nextSongs, anchorIndex, preferredSongId = null) {
    if (preferredSongId) {
      const preferredIndex = findSongIndex(preferredSongId, nextSongs);
      if (preferredIndex >= 0) return preferredIndex;
    }
    const sequentialIndex = getNextPlayableIndex(anchorIndex, nextSongs);
    if (sequentialIndex >= 0) return sequentialIndex;
    return nextSongs.length ? nextSongs.length - 1 : -1;
  }

  function startJobPolling(jobId) {
    if (!jobId || !user?.id) return;
    stopJobPolling();
    setGenerationJobId(jobId);
    setGenerating(true);
    setGenerationStatus("等待天谱乐回调...");
    jobPollRef.current = setInterval(async () => {
      try {
        const data = await api(`/generation-jobs/${jobId}`);
        const item = data?.item;
        if (!item) return;
        if (item.status === "failed") {
          stopJobPolling();
          setGenerating(false);
          setGenerationStatus("");
          setGenerationJobId(null);
          Alert.alert("生成失败", item.error || "生成任务失败");
          return;
        }
        if (item.status === "done" || item.status === "reused") {
          stopJobPolling();
          setGenerating(false);
          setGenerationStatus(item.status === "reused" ? "已复用库存歌曲" : "生成完成，已加入播放列表");
          setGenerationJobId(null);
          const anchorIndex = currentIndex;
          const nextSongs = await refreshAll();
          const targetIndex = resolvePlaybackIndex(nextSongs, anchorIndex, item.song?.id || null);
          if (targetIndex >= 0) {
            await playSongAt(targetIndex, true);
          }
        }
      } catch (error) {
        setNotice(error.message);
      }
    }, 2500);
  }
  async function submitAuth() {
    if (!deviceId.trim()) {
      Alert.alert("提示", "请先填写设备标识或用户名。");
      return;
    }
    setBusy(true);
    try {
      const res = await api("/users", {
        method: "POST",
        body: JSON.stringify({ device_id: deviceId.trim(), display_name: displayName.trim() || deviceId.trim() })
      });
      setUser(res.user);
      if (mode === "register") {
        setNeedInit(true);
        setInitTagIds([]);
        setStep(0);
      } else {
        setNeedInit(false);
      }
    } catch (e) {
      Alert.alert("登录失败", e.message);
    } finally {
      setBusy(false);
    }
  }

  const currentType = TYPES[step];
  const initOptions = allTags.filter((tag) => tag.type === currentType);

  async function finishInit() {
    if (!initTagIds.length) {
      Alert.alert("还差一步", "至少选择一个初始标签。");
      return;
    }
    try {
      const data = await api("/init-tags", { method: "POST", body: JSON.stringify({ user_id: user.id, tag_ids: initTagIds }) });
      setNeedInit(false);
      const nextSongs = await refreshAll();
      const seededIds = data?.seeded_song_ids || [];
      if (seededIds.length) {
        const index = nextSongs.findIndex((item) => seededIds.includes(Number(item.id)));
        if (index >= 0) await playSongAt(index, true);
      }
    } catch (e) {
      Alert.alert("初始化失败", e.message);
    }
  }

  function toggleInit(id) {
    setInitTagIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function togglePlayback() {
    if (!soundRef.current) {
      if (!currentSong) {
        await generateSong();
      } else {
        autoPlayRef.current = true;
        await prepareSound();
      }
      return;
    }
    const status = await soundRef.current.getStatusAsync();
    if (status.isLoaded && status.isPlaying) {
      await soundRef.current.pauseAsync();
      setPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setPlaying(true);
    }
  }

  async function generateSong() {
    if (!user?.id || generating) return;
    setGenerating(true);
    setGenerationStatus("正在匹配库存和生成任务...");
    try {
      const data = await api("/generate", { method: "POST", body: JSON.stringify({ user_id: user.id, instrumental: true }) });
      if (data.reused) {
        setNotice("这次优先复用了库存歌曲。");
        setGenerating(false);
        setGenerationStatus("已复用库存歌曲");
        const anchorIndex = currentIndex;
        const nextSongs = await refreshAll();
        const targetIndex = resolvePlaybackIndex(nextSongs, anchorIndex, data.song_id || null);
        if (targetIndex >= 0) await playSongAt(targetIndex, true);
        return;
      }
      if (data.existing && data.job_id) {
        setNotice("已有生成任务正在处理中，我们继续等待这一首。");
        startJobPolling(data.job_id);
        return;
      }
      if (data.job_id) {
        setNotice("已经提交新的生成任务。");
        startJobPolling(data.job_id);
        return;
      }
      setGenerating(false);
      setGenerationStatus("");
    } catch (e) {
      setGenerating(false);
      setGenerationStatus("");
      Alert.alert("生成失败", e.message);
    }
  }

  async function handleFeedback(action, options = {}) {
    if (!user?.id || !currentSong?.id) return;
    const feedbackKey = `${currentSong.id}:${action}`;
    if (feedbackRef.current.inFlight || feedbackRef.current.key === feedbackKey) return;
    feedbackRef.current.inFlight = true;
    feedbackRef.current.key = feedbackKey;
    try {
      await api("/feedback", {
        method: "POST",
        body: JSON.stringify({ user_id: user.id, song_id: currentSong.id, action, played_seconds: Math.floor(posMs / 1000) })
      });
      const nextSongs = await refreshAll();
      if (action === "skip" || action === "complete") {
        const nextIndex = getNextPlayableIndex(currentIndex, nextSongs);
        if (nextIndex >= 0) await playSongAt(nextIndex, true);
        else await generateSong();
      }
    } catch (e) {
      if (!options.silent) Alert.alert("操作失败", e.message);
    } finally {
      feedbackRef.current.inFlight = false;
      setTimeout(() => {
        if (feedbackRef.current.key === feedbackKey) feedbackRef.current.key = "";
      }, 800);
    }
  }

  async function createPlaylist() {
    if (!playlistName.trim()) return;
    try {
      await api("/playlists", { method: "POST", body: JSON.stringify({ user_id: user.id, name: playlistName.trim() }) });
      setPlaylistName("");
      await refreshAll();
    } catch (e) {
      Alert.alert("创建歌单失败", e.message);
    }
  }

  async function addToPlaylist(playlistId, songId, options = {}) {
    try {
      await api(`/playlists/${playlistId}/add`, { method: "POST", body: JSON.stringify({ song_id: songId }) });
      if (!options.silent) Alert.alert("已加入歌单", "这首歌已经加入对应歌单。");
      if (expandedPlaylistId === playlistId) {
        const data = await api(`/playlists/${playlistId}/songs`);
        setPlaylistSongs((prev) => ({ ...prev, [playlistId]: data?.items || [] }));
      }
    } catch (e) {
      Alert.alert("加入失败", e.message);
    }
  }

  function openFavoritePicker() {
    if (!currentSong?.id) return;
    setFavoritePickerOpen((v) => !v);
  }

  async function saveCurrentSongToPlaylist(playlistId) {
    if (!currentSong?.id) return;
    try {
      await handleFeedback("like", { silent: false });
      await addToPlaylist(playlistId, currentSong.id, { silent: true });
      setFavoritePickerOpen(false);
      await refreshAll();
      Alert.alert("收藏成功", "已经收藏并加入你选择的歌单。");
    } catch (e) {
      Alert.alert("收藏失败", e.message);
    }
  }

  async function togglePlaylist(playlistId) {
    if (expandedPlaylistId === playlistId) {
      setExpandedPlaylistId(null);
      return;
    }
    setExpandedPlaylistId(playlistId);
    if (playlistSongs[playlistId]) return;
    setPlaylistLoadingId(playlistId);
    try {
      const data = await api(`/playlists/${playlistId}/songs`);
      setPlaylistSongs((prev) => ({ ...prev, [playlistId]: data?.items || [] }));
    } catch (e) {
      Alert.alert("歌单加载失败", e.message);
    } finally {
      setPlaylistLoadingId(null);
    }
  }
  async function submitTag() {
    const name = tagName.trim();
    if (!name) return;
    const existing = allTags.find((t) => String(t.name).toLowerCase() === name.toLowerCase());
    if (existing) return saveTag(name, existing.type);
    setPendingTag(name);
    setSelectedType(TYPES[0]);
    setAskType(true);
  }

  async function saveTag(name, type) {
    try {
      await api("/user-tags", { method: "POST", body: JSON.stringify({ user_id: user.id, name, type }) });
      setTagName("");
      setPendingTag("");
      setAskType(false);
      await refreshAll();
    } catch (e) {
      Alert.alert("添加标签失败", e.message);
    }
  }

  async function updateTag(tagId, mode) {
    const target = userTags.find((x) => x.tag_id === tagId);
    if (!target) return;
    try {
      if (mode === "remove") {
        await api("/user-tags/remove", { method: "POST", body: JSON.stringify({ user_id: user.id, tag_id: tagId }) });
      } else {
        const weight = mode === "up" ? clamp(Number(target.weight || 0.3) + 0.08, 0, 1) : clamp(Number(target.weight || 0.3) - 0.08, 0, 1);
        await api("/user-tags/weight", { method: "POST", body: JSON.stringify({ user_id: user.id, tag_id: tagId, weight }) });
      }
      await refreshAll();
    } catch (e) {
      Alert.alert("更新标签失败", e.message);
    }
  }

  const tagLine = (song) => {
    const tags = normalizeTags(song?.tags);
    return tags.length ? tags.slice(0, 4).join(" · ") : "标签整理中";
  };

  if (!user) {
    return (
      <AuthScreen
        mode={mode}
        setMode={setMode}
        deviceId={deviceId}
        setDeviceId={setDeviceId}
        displayName={displayName}
        setDisplayName={setDisplayName}
        submitting={busy}
        onSubmit={submitAuth}
      />
    );
  }

  if (needInit) {
    return (
      <OnboardingScreen
        tags={allTags}
        typeIndex={step}
        selected={initTagIds}
        toggleTag={toggleInit}
        onBack={() => setStep((s) => Math.max(0, s - 1))}
        onNext={() => setStep((s) => Math.min(TYPES.length - 1, s + 1))}
        onFinish={finishInit}
      />
    );
  }

  return (
    <SafeAreaView style={styles.shell}>
      <Backdrop tags={sortedUserTags} />
      <View style={styles.overlay}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{tab === "player" ? "音乐" : tab === "favorites" ? "收藏" : tab === "profile" ? "画像" : "设置"}</Text>
            <Text style={styles.headerSub}>{notice || "这版先把稳定性和主流程彻底拉回来。"}</Text>
          </View>
          {busy && <ActivityIndicator color="#1B1713" />}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {tab === "player" && (
            <>
              <Section title="正在播放" sub={currentSong ? "像一个真正的播放器一样稳定工作。" : "先生成一首歌，我们再往下听。"}>
                <View style={styles.cover}>
                  <Text style={styles.coverText}>TPY</Text>
                </View>
                <Text style={styles.songTitle}>{currentSong?.title || "暂无歌曲"}</Text>
                <Text style={styles.songSub}>{currentSong ? tagLine(currentSong) : "请先生成音乐"}</Text>{generationStatus ? <Text style={styles.waitText}>{generationStatus}</Text> : null}
                <View style={styles.bar}><View style={[styles.barFill, { width: durMs ? `${(posMs / durMs) * 100}%` : "0%" }]} /></View>
                <View style={styles.barMeta}><Text style={styles.mono}>{fmt(posMs)}</Text><Text style={styles.mono}>{fmt(durMs)}</Text></View>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.softBtn} onPress={openFavoritePicker}><Text style={styles.softText}>收藏</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.darkBtn} onPress={togglePlayback}><Text style={styles.darkText}>{generating ? "等待中" : playing ? "暂停" : currentSong ? "播放" : "生成"}</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.softBtn} onPress={() => handleFeedback("skip")}><Text style={styles.softText}>下一曲</Text></TouchableOpacity>
                </View>
                {favoritePickerOpen ? (
                  <View style={styles.inlinePicker}>
                    <Text style={styles.inlinePickerTitle}>滑动选择要收藏进哪个歌单</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsRow}>
                      {playlists.length ? playlists.map((pl) => (
                        <TouchableOpacity key={pl.id} style={styles.tagChip} onPress={() => saveCurrentSongToPlaylist(pl.id)}>
                          <Text style={styles.tagChipText}>{pl.name}</Text>
                        </TouchableOpacity>
                      )) : <Text style={styles.empty}>先去收藏页新建一个歌单。</Text>}
                    </ScrollView>
                  </View>
                ) : null}
              </Section>
              <Section title="播放列表" sub="会保留听过的歌，点任意一首就立即切换并自动播放。">
                {songs.length ? songs.map((song, index) => (
                  <Pressable key={`${song.id}-${song.created_at || index}`} style={[styles.listRow, song.is_hidden && styles.listRowMuted]} onPress={() => playSongAt(index, true)}>
                    <Text style={styles.listIndex}>{index + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listTitle}>{song.title || `歌曲 ${song.id}`}</Text>
                      <Text style={styles.listSub}>{tagLine(song)}</Text>
                    </View>
                    <Text style={styles.listMeta}>{song.is_hidden ? "已听过" : index === currentIndex ? "播放中" : "可播放"}</Text>
                  </Pressable>
                )) : <Text style={styles.empty}>还没有歌曲，先点上面的生成。</Text>}
              </Section>
            </>
          )}

          {tab === "favorites" && (
            <>
              <Section title="歌单" sub="点开歌单就能看到里面的歌曲，也可以直接从这里开始播放。">
                <View style={styles.rowGap}>
                  <TextInput value={playlistName} onChangeText={setPlaylistName} placeholder="新歌单名称" placeholderTextColor="#8D877D" style={[styles.input, { flex: 1 }]} />
                  <TouchableOpacity style={styles.darkBtnSmall} onPress={createPlaylist}><Text style={styles.darkText}>新建</Text></TouchableOpacity>
                </View>
                {playlists.length ? playlists.map((pl) => (
                  <View key={pl.id} style={styles.playlistBlock}>
                    <TouchableOpacity style={styles.pillRow} onPress={() => togglePlaylist(pl.id)}>
                      <Text style={styles.pillTitle}>{pl.name}</Text>
                      <Text style={styles.pillMeta}>{expandedPlaylistId === pl.id ? "收起" : `${pl.song_count} 首`}</Text>
                    </TouchableOpacity>
                    {expandedPlaylistId === pl.id ? (
                      <View style={styles.playlistSongs}>
                        {playlistLoadingId === pl.id ? (
                          <ActivityIndicator color="#1C1916" />
                        ) : (playlistSongs[pl.id] || []).length ? (
                          (playlistSongs[pl.id] || []).map((song) => (
                            <Pressable
                              key={`${pl.id}-${song.id}-${song.created_at || "x"}`}
                              style={styles.playlistSongRow}
                              onPress={() => {
                                const existingIndex = songs.findIndex((item) => Number(item.id) === Number(song.id));
                                if (existingIndex >= 0) {
                                  playSongAt(existingIndex, true);
                                  setTab("player");
                                }
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={styles.listTitle}>{song.title || `歌曲 ${song.id}`}</Text>
                                <Text style={styles.listSub}>{tagLine(song)}</Text>
                              </View>
                            </Pressable>
                          ))
                        ) : (
                          <Text style={styles.empty}>这个歌单里还没有歌曲。</Text>
                        )}
                      </View>
                    ) : null}
                  </View>
                )) : <Text style={styles.empty}>还没有歌单。</Text>}
              </Section>
              <Section title="收藏歌曲" sub="每一首喜欢的歌都可以放进不同歌单。">
                {favorites.length ? favorites.map((song) => (
                  <View key={`${song.id}-${song.created_at}`} style={styles.songCard}>
                    <Text style={styles.songCardTitle}>{song.title || `歌曲 ${song.id}`}</Text>
                    <Text style={styles.songCardSub}>{tagLine(song)}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsRow}>
                      {playlists.map((pl) => (
                        <TouchableOpacity key={`${song.id}-${pl.id}`} style={styles.tagChip} onPress={() => addToPlaylist(pl.id, song.id)}><Text style={styles.tagChipText}>加入 {pl.name}</Text></TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )) : <Text style={styles.empty}>你还没有收藏歌曲。</Text>}
              </Section>
            </>
          )}

          {tab === "profile" && (
            <>
              <Section title="标签画像" sub="这版先稳定展示和调整标签，不再保留旧的实验拖拽布局。">
                <View style={styles.tagWrap}>
                  {sortedUserTags.slice(0, 15).map((tag) => (
                    <View key={tag.tag_id} style={[styles.tagCard, { backgroundColor: colorFor(tag.type) }]}> 
                      <Text style={styles.tagType}>{tag.type}</Text>
                      <Text style={styles.tagName}>{tag.name}</Text>
                      <View style={styles.weightTrack}><View style={[styles.weightFill, { width: `${clamp(Number(tag.weight || 0.2), 0.1, 1) * 100}%` }]} /></View>
                      <View style={styles.tagActions}>
                        <TouchableOpacity onPress={() => updateTag(tag.tag_id, "down")}><Text style={styles.tagAction}>弱化</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => updateTag(tag.tag_id, "up")}><Text style={styles.tagAction}>增强</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => updateTag(tag.tag_id, "remove")}><Text style={styles.tagAction}>移除</Text></TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </Section>
              <Section title="提交新标签" sub="如果后台已有这个标签，会直接按已有分类加入；没有时再选分类。">
                <TextInput value={tagName} onChangeText={setTagName} placeholder="输入标签名称" placeholderTextColor="#8D877D" style={styles.input} />
                <TouchableOpacity style={styles.darkBtnFull} onPress={submitTag}><Text style={styles.darkText}>加入画像</Text></TouchableOpacity>
                {askType && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={styles.askText}>没有找到现成标签，请给“{pendingTag}”选择类别</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsRow}>
                      {TYPES.map((type) => (
                        <TouchableOpacity key={type} style={[styles.tagChip, selectedType === type && styles.tagChipActive]} onPress={() => setSelectedType(type)}><Text style={[styles.tagChipText, selectedType === type && styles.tagChipTextActive]}>{type}</Text></TouchableOpacity>
                      ))}
                    </ScrollView>
                    <TouchableOpacity style={styles.darkBtnFull} onPress={() => saveTag(pendingTag, selectedType)}><Text style={styles.darkText}>确认分类并加入</Text></TouchableOpacity>
                  </View>
                )}
              </Section>
            </>
          )}

          {tab === "settings" && (
            <>
              <Section title="当前账户" sub="这版先做成轻量账户系统，先把数据和流程跑顺。">
                <View style={styles.infoRow}><Text style={styles.infoLabel}>用户 ID</Text><Text style={styles.infoValue}>{user?.id || "-"}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>设备标识</Text><Text style={styles.infoValue}>{user?.device_id || "-"}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>显示名称</Text><Text style={styles.infoValue}>{user?.display_name || "-"}</Text></View>
              </Section>
              <Section title="数据概览" sub="先给你一个轻量但稳定的总览。">
                <View style={styles.stats}>
                  <View style={styles.stat}><Text style={styles.statNum}>{songs.length}</Text><Text style={styles.statText}>播放列表</Text></View>
                  <View style={styles.stat}><Text style={styles.statNum}>{favorites.length}</Text><Text style={styles.statText}>收藏歌曲</Text></View>
                  <View style={styles.stat}><Text style={styles.statNum}>{sortedUserTags.length}</Text><Text style={styles.statText}>活跃标签</Text></View>
                  <View style={styles.stat}><Text style={styles.statNum}>{playlists.length}</Text><Text style={styles.statText}>歌单数量</Text></View>
                </View>
              </Section>
              <Section title="维护操作" sub="如果界面或数据有延迟，可以从这里刷新。">
                <TouchableOpacity style={styles.softBtnFull} onPress={refreshAll}><Text style={styles.softText}>刷新全部数据</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.softBtnFull, { marginTop: 10 }]} onPress={() => { unload(); setUser(null); setSongs([]); setFavorites([]); setUserTags([]); setPlaylists([]); setTab("player"); }}><Text style={styles.softText}>退出当前账户</Text></TouchableOpacity>
              </Section>
            </>
          )}
        </ScrollView>

        <View style={styles.tabBar}>
          {TABS.map((item) => (
            <TouchableOpacity key={item} style={[styles.tabItem, tab === item && styles.tabItemActive]} onPress={() => setTab(item)}>
              <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item === "player" ? "播放" : item === "favorites" ? "收藏" : item === "profile" ? "画像" : "设置"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#EEE5D8" },
  overlay: { flex: 1, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: "#ECE2D4" },
  blob: { position: "absolute", transform: [{ scale: 1.15 }], opacity: 0.24 },
  bgVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,248,241,0.52)" },
  authShell: { flex: 1, backgroundColor: "#EEE5D8", padding: 20, justifyContent: "center" },
  authCard: { backgroundColor: "rgba(255,255,255,0.72)", borderRadius: 28, padding: 24, gap: 14 },
  heroEyebrow: { fontSize: 12, letterSpacing: 3, color: "#756C61", fontWeight: "700" },
  heroTitle: { fontSize: 34, lineHeight: 40, color: "#1B1713", fontWeight: "800" },
  heroSubtitle: { fontSize: 15, lineHeight: 22, color: "#5B554D" },
  segmentRow: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.58)", borderRadius: 18, padding: 4, gap: 4 },
  segmentButton: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 14 },
  segmentButtonActive: { backgroundColor: "#1C1916" },
  segmentText: { color: "#5A534B", fontWeight: "700" },
  segmentTextActive: { color: "#FFF" },
  input: { backgroundColor: "rgba(255,255,255,0.8)", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: "#221E1A" },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: "rgba(28,25,22,0.1)", overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#1C1916" },
  progressText: { color: "#6A645C", fontSize: 13, fontWeight: "600" },
  selectionList: { maxHeight: 280 },
  selectionListContent: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  choiceChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.8)" },
  choiceChipActive: { backgroundColor: "#1C1916" },
  choiceChipText: { color: "#4F483F", fontWeight: "700" },
  choiceChipTextActive: { color: "#FFF" },
  onboardingActions: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  ghostButton: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.65)" },
  ghostButtonText: { color: "#4D473F", fontWeight: "700" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, paddingBottom: 10 },
  headerTitle: { fontSize: 34, fontWeight: "800", color: "#1B1713" },
  headerSub: { marginTop: 4, color: "#5B554D", fontSize: 14, lineHeight: 20, maxWidth: 280 },
  content: { paddingBottom: 110 },
  card: { backgroundColor: "rgba(255,255,255,0.62)", borderRadius: 26, padding: 18, marginBottom: 16 },
  cardTitle: { fontSize: 24, fontWeight: "800", color: "#1B1713" },
  cardSub: { marginTop: 4, fontSize: 14, lineHeight: 20, color: "#6A645C" },
  cover: { width: 240, height: 240, alignSelf: "center", borderRadius: 40, backgroundColor: "#232126", alignItems: "center", justifyContent: "center" },
  coverText: { color: "#FFF", fontSize: 42, fontWeight: "800" },
  songTitle: { marginTop: 14, textAlign: "center", fontSize: 34, lineHeight: 40, color: "#1B1713", fontWeight: "800" },
  songSub: { textAlign: "center", color: "#5F5850", fontSize: 16, lineHeight: 24, marginTop: 6 },
  waitText: { textAlign: "center", color: "#7B6D5A", fontSize: 13, marginTop: 8 },
  bar: { height: 8, borderRadius: 999, backgroundColor: "rgba(28,25,22,0.10)", overflow: "hidden", marginTop: 14 },
  barFill: { height: "100%", backgroundColor: "#1C1916" },
  barMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  mono: { color: "#6B655D", fontSize: 13 },
  row: { flexDirection: "row", gap: 12, alignItems: "center", marginTop: 14 },
  rowGap: { flexDirection: "row", gap: 10, alignItems: "center" },
  softBtn: { minWidth: 92, backgroundColor: "rgba(255,255,255,0.75)", paddingVertical: 16, paddingHorizontal: 14, borderRadius: 22, alignItems: "center" },
  softBtnFull: { backgroundColor: "rgba(255,255,255,0.75)", paddingVertical: 16, borderRadius: 18, alignItems: "center" },
  softText: { color: "#1C1916", fontWeight: "800" },
  darkBtn: { flex: 1, backgroundColor: "#1C1916", paddingVertical: 16, borderRadius: 22, alignItems: "center" },
  darkBtnSmall: { backgroundColor: "#1C1916", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, alignItems: "center" },
  darkBtnFull: { backgroundColor: "#1C1916", paddingVertical: 16, borderRadius: 18, alignItems: "center", marginTop: 12 },
  darkText: { color: "#FFF", fontWeight: "800" },
  listRow: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(28,25,22,0.06)", alignItems: "center" },
  listRowMuted: { opacity: 0.72 },
  listIndex: { width: 28, color: "#514B44", fontWeight: "700", paddingTop: 2 },
  listMeta: { color: "#7B746C", fontSize: 12, fontWeight: "700" },
  listTitle: { color: "#1B1713", fontWeight: "700", fontSize: 16 },
  listSub: { marginTop: 4, color: "#6B655D" },
  empty: { color: "#6B655D", fontSize: 15, lineHeight: 22 },
  playlistBlock: { marginBottom: 10 },
  pillRow: { backgroundColor: "rgba(255,255,255,0.66)", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between" },
  playlistSongs: { paddingTop: 10, gap: 8 },
  playlistSongRow: { backgroundColor: "rgba(255,255,255,0.42)", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  pillTitle: { color: "#1D1814", fontWeight: "700" },
  pillMeta: { color: "#6B655D" },
  songCard: { backgroundColor: "rgba(255,255,255,0.58)", borderRadius: 22, padding: 16, marginBottom: 12 },
  songCardTitle: { color: "#1B1713", fontWeight: "800", fontSize: 18 },
  songCardSub: { color: "#6A645C", lineHeight: 20, marginTop: 6 },
  inlinePicker: { marginTop: 14, padding: 14, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.5)" },
  inlinePickerTitle: { color: "#4E473F", fontWeight: "700" },
  tagsRow: { gap: 10, paddingTop: 10 },
  tagChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.78)" },
  tagChipActive: { backgroundColor: "#1C1916" },
  tagChipText: { color: "#524B44", fontWeight: "700" },
  tagChipTextActive: { color: "#FFF" },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tagCard: { borderRadius: 22, padding: 14, minHeight: 108, width: "47%" },
  tagType: { color: "rgba(255,255,255,0.76)", fontSize: 12, fontWeight: "700" },
  tagName: { color: "#FFF", fontSize: 24, fontWeight: "800", marginTop: 8 },
  weightTrack: { marginTop: 12, height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.22)", overflow: "hidden" },
  weightFill: { height: "100%", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.9)" },
  tagActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  tagAction: { color: "#FFF", fontWeight: "700" },
  askText: { color: "#4E473F", lineHeight: 20, fontWeight: "600" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(28,25,22,0.06)" },
  infoLabel: { color: "#6A645C", fontWeight: "700" },
  infoValue: { color: "#1B1713", fontWeight: "700", maxWidth: 220, textAlign: "right" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  stat: { width: "48%", backgroundColor: "rgba(255,255,255,0.58)", borderRadius: 22, paddingVertical: 18, paddingHorizontal: 14 },
  statNum: { fontSize: 28, color: "#1B1713", fontWeight: "800" },
  statText: { marginTop: 6, color: "#6A645C" },
  tabBar: { position: "absolute", left: 12, right: 12, bottom: 10, backgroundColor: "rgba(255,255,255,0.84)", borderRadius: 28, padding: 8, flexDirection: "row", gap: 8 },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 22 },
  tabItemActive: { backgroundColor: "#1C1916" },
  tabText: { color: "#5A534B", fontWeight: "800" },
  tabTextActive: { color: "#FFF" }
});

































