import React, { useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView, View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Animated, Easing, useWindowDimensions, Alert, PanResponder, ActivityIndicator } from "react-native";
import { Audio } from "expo-av";
import { API_BASE } from "./config";

const TABS = [
  { key: "player", label: "播放", icon: "◉" },
  { key: "favorites", label: "收藏", icon: "♡" },
  { key: "galaxy", label: "画像", icon: "✦" },
  { key: "settings", label: "设置", icon: "⌘" }
];

const TYPE_COLORS = {
  情绪: ["#F58F73", "#FFF1EB", "#5B281E"],
  风格: ["#6C87E8", "#EAF0FF", "#243563"],
  乐器: ["#69B884", "#E7FFF0", "#1D5230"],
  场景: ["#D4A24D", "#FFF4DB", "#634410"],
  节奏: ["#9A78E6", "#F2EBFF", "#473171"]
};

const CATEGORY_ORDER = ["情绪", "风格", "乐器", "场景", "节奏"];
const COLLAPSED_WEIGHT_LIMIT = 6;
const EXPANDED_WEIGHT_LIMIT = 15;

function formatTime(ms) {
  if (!ms || Number.isNaN(ms)) return "0:00";
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function typePalette(type) {
  return TYPE_COLORS[type] || ["#82B9FF", "#EAF5FF", "#26496F"];
}

function uniqueTagNames(tags) {
  return Array.from(new Set((tags || []).filter(Boolean)));
}

function fallbackTagText(prompt) {
  if (!prompt) return "";
  return String(prompt)
    .replace(/([\u4e00-\u9fa5A-Za-z]+)\s*:\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function songTagText(song) {
  const names = uniqueTagNames(song?.tags);
  if (names.length > 0) return names.join(" · ");
  return "标签整理中";
}

function buildGalaxyNodes(tags, stageSize) {
  const width = Math.max(280, stageSize.width || 0);
  const height = Math.max(320, stageSize.height || 0);
  const centerX = width / 2;
  const centerY = height / 2 + 28;
  const expanded = tags.slice(0, EXPANDED_WEIGHT_LIMIT);
  const compact = tags.slice(EXPANDED_WEIGHT_LIMIT);

  const expandedNodes = expanded.map((tag, index) => {
    const palette = typePalette(tag.type);
    const ringIndex = index < 5 ? 0 : index < 10 ? 1 : 2;
    const ringCounts = [Math.min(5, expanded.length), Math.max(0, Math.min(5, expanded.length - 5)), Math.max(0, Math.min(5, expanded.length - 10))];
    const indexInRing = ringIndex === 0 ? index : ringIndex === 1 ? index - 5 : index - 10;
    const ringCount = Math.max(1, ringCounts[ringIndex] || 1);
    const radius = [62, 108, 148][ringIndex];
    const angle = (-Math.PI / 2) + ((Math.PI * 2) / ringCount) * indexInRing + ringIndex * 0.18;
    const size = 58 + Math.min(40, Number(tag.weight || 0) * 48);
    const baseX = centerX + Math.cos(angle) * radius - size / 2;
    const baseY = centerY + Math.sin(angle) * radius - size / 2;
    return {
      tag,
      compact: false,
      size,
      baseX,
      baseY,
      ring: radius,
      angle,
      centerX,
      centerY,
      orbitDuration: 32000 + ringIndex * 5000 + index * 900,
      orbitDirection: index % 2 === 0 ? 1 : -1,
      seed: index + 1,
      color: palette[0],
      glow: palette[1],
      text: palette[2]
    };
  });

  const compactNodes = compact.map((tag, index) => {
    const palette = typePalette(tag.type);
    const ring = 188 + (index % 5) * 20;
    const angle = ((Math.PI * 2) / Math.max(compact.length, 10)) * index + (index % 2) * 0.18;
    const size = 6 + Math.min(8, Number(tag.weight || 0) * 10);
    return {
      tag,
      compact: true,
      size,
      ring,
      angle,
      seed: index + 1,
      color: palette[0],
      glow: palette[1],
      text: palette[2],
      centerX,
      centerY
    };
  });

  return [...expandedNodes, ...compactNodes];
}

function ScreenTitle({ eyebrow, title, subtitle }) {
  return (
    <View style={styles.titleBlock}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function SeedTag({ item, selected, onPress }) {
  return (
    <TouchableOpacity onPress={() => onPress(item)} style={[styles.seedTag, selected && styles.seedTagSelected]}>
      <Text style={[styles.seedType, selected && styles.seedTypeSelected]}>{item.type}</Text>
      <Text style={[styles.seedName, selected && styles.seedNameSelected]}>{item.name}</Text>
    </TouchableOpacity>
  );
}

function GalaxyDust({ node }) {
  const angle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const orbit = Animated.loop(Animated.timing(angle, {
      toValue: 1,
      duration: 26000 + node.seed * 1100,
      easing: Easing.linear,
      useNativeDriver: true
    }));
    orbit.start();
    return () => orbit.stop();
  }, [angle, node.seed]);

  const rotate = angle.interpolate({ inputRange: [0, 1], outputRange: [node.angle + "rad", node.angle + Math.PI * 2 + "rad"] });

  return (
    <Animated.View pointerEvents="none" style={[styles.dustOrbit, { width: node.ring * 2, height: node.ring * 2, marginLeft: -node.ring, marginTop: -node.ring, left: node.centerX, top: node.centerY, transform: [{ rotate }] }]}>
      <View style={[styles.dustParticle, { width: node.size, height: node.size, borderRadius: node.size / 2, backgroundColor: node.color, shadowColor: node.color }]} />
    </Animated.View>
  );
}

function GalaxyNode({ node, onDrop }) {
  const orbit = useRef(new Animated.Value(0)).current;
  const pan = useRef(new Animated.ValueXY({ x: node.baseX, y: node.baseY })).current;
  const dragOrigin = useRef({ x: node.baseX, y: node.baseY });
  const currentPoint = useRef({ x: node.baseX, y: node.baseY });
  const homePoint = useRef({ x: node.baseX, y: node.baseY });
  const isDragging = useRef(false);
  const orbitLoop = useRef(null);

  useEffect(() => {
    const syncHome = (progress = 0) => {
      const theta = node.angle + progress * Math.PI * 2 * node.orbitDirection;
      const next = {
        x: node.centerX + Math.cos(theta) * node.ring - node.size / 2,
        y: node.centerY + Math.sin(theta) * node.ring - node.size / 2
      };
      homePoint.current = next;
      if (!isDragging.current) {
        currentPoint.current = next;
        pan.setValue(next);
      }
    };

    syncHome(0);
    const orbitId = orbit.addListener(({ value }) => syncHome(value));
    const pxId = pan.x.addListener(({ value }) => { currentPoint.current = { ...currentPoint.current, x: value }; });
    const pyId = pan.y.addListener(({ value }) => { currentPoint.current = { ...currentPoint.current, y: value }; });

    const startOrbit = () => {
      orbit.setValue(0);
      orbitLoop.current = Animated.loop(Animated.timing(orbit, {
        toValue: 1,
        duration: node.orbitDuration,
        easing: Easing.linear,
        useNativeDriver: false
      }));
      orbitLoop.current.start();
    };

    startOrbit();

    return () => {
      orbitLoop.current?.stop();
      orbit.removeListener(orbitId);
      pan.x.removeListener(pxId);
      pan.y.removeListener(pyId);
    };
  }, [node.angle, node.centerX, node.centerY, node.orbitDirection, node.orbitDuration, node.ring, node.size, orbit, pan]);

  const resumeOrbit = () => {
    orbitLoop.current?.stop();
    orbit.setValue(0);
    orbitLoop.current = Animated.loop(Animated.timing(orbit, {
      toValue: 1,
      duration: node.orbitDuration,
      easing: Easing.linear,
      useNativeDriver: false
    }));
    orbitLoop.current.start();
  };

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      isDragging.current = true;
      orbitLoop.current?.stop();
      dragOrigin.current = { ...currentPoint.current };
    },
    onPanResponderMove: (_, g) => pan.setValue({ x: dragOrigin.current.x + g.dx, y: dragOrigin.current.y + g.dy }),
    onPanResponderRelease: () => {
      const cx = currentPoint.current.x + node.size / 2;
      const cy = currentPoint.current.y + node.size / 2;
      onDrop(cx, cy, node.tag);
      Animated.spring(pan, { toValue: homePoint.current, friction: 9, tension: 42, useNativeDriver: false }).start(() => {
        currentPoint.current = { ...homePoint.current };
        isDragging.current = false;
        resumeOrbit();
      });
    },
    onPanResponderTerminate: () => {
      Animated.spring(pan, { toValue: homePoint.current, friction: 9, tension: 42, useNativeDriver: false }).start(() => {
        currentPoint.current = { ...homePoint.current };
        isDragging.current = false;
        resumeOrbit();
      });
    }
  })).current;

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        styles.node,
        {
          width: node.size,
          height: node.size,
          borderRadius: node.size / 2,
          backgroundColor: node.color,
          shadowColor: node.color,
          transform: [{ translateX: pan.x }, { translateY: pan.y }]
        }
      ]}
    >
      <View style={[styles.nodeGlow, { backgroundColor: node.glow }]} />
      <Text style={[styles.nodeName, { color: node.text }]} numberOfLines={2}>{node.tag.name}</Text>
    </Animated.View>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState("player");
  const [authMode, setAuthMode] = useState("login");
  const [accountId, setAccountId] = useState("demo-device");
  const [accountName, setAccountName] = useState("");
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [tags, setTags] = useState([]);
  const [seedSelection, setSeedSelection] = useState(new Set());
  const [profileTags, setProfileTags] = useState([]);
  const [songs, setSongs] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [playlistSongs, setPlaylistSongs] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [current, setCurrent] = useState(null);
  const [sound, setSound] = useState(null);
  const [currentSoundId, setCurrentSoundId] = useState(null);
  const [playback, setPlayback] = useState({ position: 0, duration: 1, isPlaying: false });
  const [showQueue, setShowQueue] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [pendingTagName, setPendingTagName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(CATEGORY_ORDER[0] || "");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [tagMessage, setTagMessage] = useState("");
  const [showAllWeights, setShowAllWeights] = useState(false);
  const [health, setHealth] = useState({ loading: false, ok: null, message: "" });
  const [stageSize, setStageSize] = useState({ width: 1, height: 1 });
  const [galaxyNodes, setGalaxyNodes] = useState([]);
  const [progressLayout, setProgressLayout] = useState(null);
  const progressTrackRef = useRef(null);
  const completeSentFor = useRef(null);
  const autoNextLock = useRef(false);
  const userId = session?.userId || null;
  const displayName = session?.name || session?.deviceId || "访客";

  const groupedTags = useMemo(() => {
    const map = new Map();
    for (const tag of tags) {
      const list = map.get(tag.type) || [];
      list.push(tag);
      map.set(tag.type, list);
    }
    return Array.from(map.entries());
  }, [tags]);

  const activeProfileTags = useMemo(() => profileTags.filter((item) => item.is_active !== false && Number(item.weight || 0) > 0), [profileTags]);
  const existingTagMatch = useMemo(() => {
    const clean = newTagName.trim().toLowerCase();
    if (!clean) return null;
    return tags.find((tag) => String(tag.name || "").trim().toLowerCase() === clean) || null;
  }, [newTagName, tags]);
  const onboardingGroups = useMemo(() => CATEGORY_ORDER.map((type) => [type, groupedTags.find(([groupType]) => groupType === type)?.[1] || []]).filter(([, items]) => items.length > 0), [groupedTags]);
  const currentOnboarding = onboardingGroups[Math.min(onboardingStep, Math.max(0, onboardingGroups.length - 1))] || null;
  const visibleWeightTags = useMemo(() => activeProfileTags.slice(0, showAllWeights ? EXPANDED_WEIGHT_LIMIT : COLLAPSED_WEIGHT_LIMIT), [activeProfileTags, showAllWeights]);

  const loadTags = async () => {
    const res = await fetch(`${API_BASE}/tags`);
    const data = await res.json();
    setTags(data.items || []);
  };

  const ensureUser = async (device = accountId.trim(), displayName = accountName.trim()) => {
    const res = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: device, display_name: displayName || undefined })
    });
    const data = await res.json();
    return data.user;
  };

  const loadProfileTags = async (uid) => {
    if (!uid) return [];
    const res = await fetch(`${API_BASE}/user-tags?user_id=${uid}`);
    const data = await res.json();
    const items = data.items || [];
    setProfileTags(items);
    return items;
  };

  const refreshSongs = async (uid, options = {}) => {
    if (!uid) return [];
    const res = await fetch(`${API_BASE}/songs?user_id=${uid}&include_history=true`);
    const data = await res.json();
    const seen = new Set();
    const items = (data.items || []).filter((item) => {
      const key = item.id || item.audio_url;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setSongs(items);
    if (items.length > 0) {
      if (options.preferSongId) {
        const preferred = items.find((item) => Number(item.id) === Number(options.preferSongId));
        if (preferred) setCurrent(preferred);
      } else if (!current || !items.some((item) => Number(item.id) === Number(current.id))) {
        setCurrent(items[0]);
      }
    }
    return items;
  };

  const refreshFavorites = async (uid) => {
    if (!uid) return [];
    const res = await fetch(`${API_BASE}/favorites?user_id=${uid}`);
    const data = await res.json();
    setFavorites(data.items || []);
    return data.items || [];
  };

  const loadPlaylists = async (uid) => {
    if (!uid) return [];
    const res = await fetch(`${API_BASE}/playlists?user_id=${uid}`);
    const data = await res.json();
    setPlaylists(data.items || []);
    return data.items || [];
  };

  const loadPlaylistSongs = async (playlistId) => {
    if (!playlistId) return [];
    const res = await fetch(`${API_BASE}/playlists/${playlistId}/songs`);
    const data = await res.json();
    setPlaylistSongs(data.items || []);
    return data.items || [];
  };

  const bootstrapUser = async (user, nameOverride) => {
    setSession({ userId: user.id, deviceId: user.device_id, name: nameOverride || accountName.trim() || user.device_id });
    const profile = await loadProfileTags(user.id);
    await Promise.all([refreshSongs(user.id, { preferLatest: true }), refreshFavorites(user.id), loadPlaylists(user.id)]);
    const active = (profile || []).filter((item) => item.is_active !== false && Number(item.weight || 0) > 0);
    setNeedsOnboarding(active.length === 0);
    setOnboardingStep(0);
  };

  useEffect(() => { loadTags().catch(() => setTags([])); }, []);
  useEffect(() => () => { if (sound) sound.unloadAsync().catch(() => {}); }, [sound]);

  useEffect(() => {
    setGalaxyNodes(buildGalaxyNodes(activeProfileTags, stageSize));
  }, [activeProfileTags, stageSize, width]);
  const submitAuth = async () => {
    const cleanId = accountId.trim();
    const cleanName = accountName.trim();
    if (!cleanId) return Alert.alert("还差一步", "请输入账户 ID");
    if (authMode === "register" && !cleanName) return Alert.alert("还差一步", "注册时请填写昵称");
    setAuthLoading(true);
    try {
      const user = await ensureUser(cleanId, cleanName);
      await bootstrapUser(user, cleanName || cleanId);
    } catch (err) {
      Alert.alert("连接失败", String(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const submitOnboarding = async () => {
    if (!userId || seedSelection.size === 0) return Alert.alert("请选择标签", "至少先选一个标签方向");
    await fetch(`${API_BASE}/init-tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, tag_ids: Array.from(seedSelection) })
    });
    await loadProfileTags(userId);
    await refreshSongs(userId);
    await refreshFavorites(userId);
    await loadPlaylists(userId);
    setNeedsOnboarding(false);
    setOnboardingStep(0);
    setActiveTab("player");
  };

  const persistWeight = async (tagId, weight) => {
    if (!userId) return;
    await fetch(`${API_BASE}/user-tags/weight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, tag_id: tagId, weight })
    });
  };

  const persistRemoveProfileTag = async (tag) => {
    if (!userId) return;
    await fetch(`${API_BASE}/user-tags/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, tag_id: tag.tag_id })
    });
  };

  const animateTagWeightChange = (tag, nextWeight, mode = "update") => {
    const startWeight = Number(tag.weight || 0);
    const endWeight = Math.max(0, Math.min(1, nextWeight));
    const steps = 10;
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      const ratio = step / steps;
      const eased = 1 - Math.pow(1 - ratio, 2);
      const value = startWeight + (endWeight - startWeight) * eased;
      setProfileTags((prev) => prev.map((item) => item.tag_id === tag.tag_id ? { ...item, weight: value, is_active: mode === "remove" ? true : item.is_active } : item));
      if (step >= steps) {
        clearInterval(timer);
        if (mode === "remove") {
          persistRemoveProfileTag(tag).then(() => loadProfileTags(userId)).catch(() => loadProfileTags(userId));
        } else {
          persistWeight(tag.tag_id, endWeight).then(() => loadProfileTags(userId)).catch(() => loadProfileTags(userId));
        }
      }
    }, 40);
  };

  const handleGalaxyDrop = (x, y, tag) => {
    const zoneHeight = 78;
    const third = stageSize.width / 3;
    if (y > 18 && y < 18 + zoneHeight) {
      if (x < third) { animateTagWeightChange(tag, 0, "remove"); return "delete"; }
      if (x < third * 2) { animateTagWeightChange(tag, Math.max(0.03, Number(tag.weight || 0) * 0.82)); return "weaken"; }
      animateTagWeightChange(tag, Math.min(1, Number(tag.weight || 0) * 1.08 + 0.04));
      return "boost";
    }
    return null;
  };

  const submitNamedTag = async (name, chosenType) => {
    const cleanName = String(name || "").trim();
    if (!userId || !cleanName) return setTagMessage("请输入标签名称");
    const res = await fetch(`${API_BASE}/user-tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, name: cleanName, type: chosenType || undefined })
    });
    const data = await res.json();
    if (!res.ok) return setTagMessage(data.error || "添加失败");
    setNewTagName("");
    setPendingTagName("");
    setShowCategoryPicker(false);
    setTagMessage(existingTagMatch ? "已加入当前画像" : "标签已提交，会在探索到它后进入画像");
    await loadTags();
    await loadProfileTags(userId);
  };

  const submitUserTag = async () => {
    setTagMessage("");
    const cleanName = newTagName.trim();
    if (!userId || !cleanName) return setTagMessage("请输入标签名称");
    if (existingTagMatch) return submitNamedTag(cleanName, existingTagMatch.type);
    setPendingTagName(cleanName);
    setSelectedCategory(CATEGORY_ORDER[0] || "情绪");
    setShowCategoryPicker(true);
  };

  const confirmCustomTagType = async () => {
    if (!pendingTagName) return;
    await submitNamedTag(pendingTagName, selectedCategory);
  };

  const generate = async () => {
    if (!userId) return;
    await fetch(`${API_BASE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, instrumental: true })
    });
    await refreshSongs(userId);
  };

  const attachStatus = (status) => {
    if (!status?.isLoaded) return;
    setPlayback({ position: status.positionMillis || 0, duration: status.durationMillis || 1, isPlaying: status.isPlaying });
    if (status.didJustFinish && current && completeSentFor.current !== current.id) {
      completeSentFor.current = current.id;
      handleAutoNext("complete").catch(() => {});
    }
  };

  const play = async (song) => {
    if (!song?.audio_url) return;
    if (sound) await sound.unloadAsync().catch(() => {});
    completeSentFor.current = null;
    const created = await Audio.Sound.createAsync({ uri: song.audio_url }, { shouldPlay: true, progressUpdateIntervalMillis: 1000 }, attachStatus);
    setSound(created.sound);
    setCurrent(song);
    setCurrentSoundId(song.id);
  };

  const togglePlay = async () => {
    if (!current) return generate();
    if (!sound || currentSoundId !== current.id) return play(current);
    if (playback.isPlaying) await sound.pauseAsync();
    else await sound.playAsync();
  };

  const feedback = async (action) => {
    if (!userId || !current) return;
    try {
      await fetch(`${API_BASE}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, song_id: current.id, action, played_seconds: Math.floor((playback.position || 0) / 1000) })
      });
    } catch {}
  };

  const handleAutoNext = async (action) => {
    if (!userId || autoNextLock.current) return;
    autoNextLock.current = true;
    try {
      await feedback(action);
      const currentId = current?.id;
      const index = currentId ? songs.findIndex((item) => Number(item.id) === Number(currentId)) : -1;
      if (index >= 0 && index < songs.length - 1) return play(songs[index + 1]);
      await generate();
      const fresh = await refreshSongs(userId);
      const refreshedIndex = currentId ? fresh.findIndex((item) => Number(item.id) === Number(currentId)) : -1;
      if (refreshedIndex >= 0 && refreshedIndex < fresh.length - 1) await play(fresh[refreshedIndex + 1]);
    } finally { autoNextLock.current = false; }
  };

  const handleNext = async () => {
    if (!current) return generate();
    const index = songs.findIndex((item) => Number(item.id) === Number(current.id));
    if (index >= 0 && index < songs.length - 1) return play(songs[index + 1]);
    await handleAutoNext("skip");
  };

  const appendPlaylistToQueue = async (playlistId, startSongId) => {
    if (!playlistId) return;
    const list = selectedPlaylistId === playlistId && playlistSongs.length ? playlistSongs : await loadPlaylistSongs(playlistId);
    if (!list.length) return;
    const startIndex = list.findIndex((item) => Number(item.id) === Number(startSongId));
    const ordered = startIndex >= 0 ? [...list.slice(startIndex), ...list.slice(0, startIndex)] : list;
    const seen = new Set();
    const queueItems = ordered.filter((item) => {
      const key = Number(item.id || 0);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setSongs((prev) => {
      const remaining = prev.filter((item) => !queueItems.some((queued) => Number(queued.id) === Number(item.id)));
      return [...remaining, ...queueItems];
    });
    const target = queueItems.find((item) => Number(item.id) === Number(startSongId)) || queueItems[0];
    if (target) await play(target);
    setShowQueue(true);
    setActiveTab("player");
  };
  const createPlaylist = async () => {
    if (!userId || !newPlaylistName.trim()) return;
    await fetch(`${API_BASE}/playlists`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId, name: newPlaylistName.trim() }) });
    setNewPlaylistName("");
    await loadPlaylists(userId);
  };

  const addSongToPlaylist = async (playlistId, song = current) => {
    if (!song || !playlistId) return;
    await fetch(`${API_BASE}/playlists/${playlistId}/add`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ song_id: song.id }) });
  };

  const testConnection = async () => {
    setHealth({ loading: true, ok: null, message: "" });
    try {
      const res = await fetch(`${API_BASE}/tags`);
      const data = await res.json();
      setHealth({ loading: false, ok: res.ok, message: `API: ${API_BASE} | 标签数 ${data.items ? data.items.length : 0}` });
    } catch (err) {
      setHealth({ loading: false, ok: false, message: `API: ${API_BASE} | ${String(err)}` });
    }
  };

  const logout = async () => {
    if (sound) await sound.unloadAsync().catch(() => {});
    setSession(null); setNeedsOnboarding(false); setSeedSelection(new Set()); setOnboardingStep(0);
    setProfileTags([]); setSongs([]); setFavorites([]); setPlaylists([]); setPlaylistSongs([]); setCurrent(null);
    setActiveTab("player"); setShowPlaylistPicker(false);
  };

  const progressResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => {
      if (!progressLayout || !sound) return;
      const localX = Math.min(progressLayout.width, Math.max(0, g.moveX - progressLayout.pageX));
      const percent = progressLayout.width > 0 ? localX / progressLayout.width : 0;
      setPlayback((prev) => ({ ...prev, position: Math.floor(percent * (playback.duration || 0)) }));
    },
    onPanResponderRelease: async (_, g) => {
      if (!progressLayout || !sound) return;
      const localX = Math.min(progressLayout.width, Math.max(0, g.moveX - progressLayout.pageX));
      const percent = progressLayout.width > 0 ? localX / progressLayout.width : 0;
      await sound.setPositionAsync(Math.floor(percent * (playback.duration || 0)));
    }
  })).current;

  const renderAuth = () => (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.authShell} showsVerticalScrollIndicator={false}>
        <View style={styles.authBlobA} /><View style={styles.authBlobB} />
        <View style={styles.authCard}>
          <Text style={styles.authEyebrow}>TPY MUSIC</Text>
          <Text style={styles.authTitle}>先登录，再把你的音乐世界接回来</Text>
          <Text style={styles.authSubtitle}>这一版先做轻量账户系统：我们用账户 ID 识别用户。登录后会直接拉回标签、收藏、歌单与历史歌曲。</Text>
          <View style={styles.authModeRow}>
            <TouchableOpacity style={[styles.authMode, authMode === "login" && styles.authModeActive]} onPress={() => setAuthMode("login")}><Text style={[styles.authModeText, authMode === "login" && styles.authModeTextActive]}>登录</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.authMode, authMode === "register" && styles.authModeActive]} onPress={() => setAuthMode("register")}><Text style={[styles.authModeText, authMode === "register" && styles.authModeTextActive]}>注册</Text></TouchableOpacity>
          </View>
          {authMode === "register" ? <TextInput value={accountName} onChangeText={setAccountName} placeholder="昵称" placeholderTextColor="#9D978E" style={styles.input} /> : null}
          <TextInput value={accountId} onChangeText={setAccountId} placeholder="账户 ID，例如 demo-device" placeholderTextColor="#9D978E" autoCapitalize="none" style={styles.input} />
          <TouchableOpacity style={styles.primary} onPress={submitAuth} disabled={authLoading}>
            {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{authMode === "login" ? "登录并恢复数据" : "注册并继续"}</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  const renderOnboarding = () => (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>
        <ScreenTitle eyebrow="首次进入" title="先按类别建立你的初始标签池" subtitle="每次只专注一个类别，选中的标签会直接成为你的起点，后续新标签再通过探索和自定义慢慢扩展。" />
        <View style={styles.groupCard}>
          <View style={styles.onboardingProgressHeader}>
            <Text style={styles.groupTitle}>{currentOnboarding ? currentOnboarding[0] : "已完成"}</Text>
            <Text style={styles.hintText}>第 {Math.min(onboardingStep + 1, onboardingGroups.length || 1)} / {Math.max(1, onboardingGroups.length)} 类</Text>
          </View>
          <View style={styles.onboardingProgressTrack}>
            <View style={[styles.onboardingProgressFill, { width: String(((Math.min(onboardingStep + 1, onboardingGroups.length || 1)) / Math.max(1, onboardingGroups.length)) * 100) + "%" }]} />
          </View>
          {currentOnboarding ? <View style={styles.seedWrap}>
            {currentOnboarding[1].map((item) => <SeedTag key={item.id} item={item} selected={seedSelection.has(item.id)} onPress={(tag) => {
              const next = new Set(seedSelection);
              if (next.has(tag.id)) next.delete(tag.id); else next.add(tag.id);
              setSeedSelection(next);
            }} />)}
          </View> : <Text style={styles.placeholder}>标签类别已全部选择完成</Text>}
          <View style={styles.rowGap}>
            <TouchableOpacity style={[styles.secondarySoft, styles.flex]} onPress={() => setOnboardingStep((prev) => Math.max(0, prev - 1))}>
              <Text style={styles.secondaryText}>上一步</Text>
            </TouchableOpacity>
            {onboardingStep < onboardingGroups.length - 1 ? <TouchableOpacity style={[styles.primary, styles.flex]} onPress={() => setOnboardingStep((prev) => Math.min(onboardingGroups.length - 1, prev + 1))}><Text style={styles.primaryText}>下一个类别</Text></TouchableOpacity> : <TouchableOpacity style={[styles.primary, styles.flex]} onPress={submitOnboarding}><Text style={styles.primaryText}>完成选择并进入 App</Text></TouchableOpacity>}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
  const renderPlayer = () => (
    <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>
      <ScreenTitle eyebrow={`你好，${displayName}`} title="现在播放" subtitle="登录后会自动带出你的歌曲与偏好，不用再等到生成时才识别用户。" />
      <View style={styles.playerCard}>
                <View style={styles.coverWrap}><View style={styles.cover}><View style={styles.coverGlowA} /><View style={styles.coverGlowB} /><View style={styles.coverGlowC} /><Text style={styles.coverText}>TPY</Text></View></View>
        <Text style={styles.playerTitle}>{current?.title || "暂无歌曲"}</Text>
        <Text style={styles.playerSub} numberOfLines={2}>{songTagText(current)}</Text>
        <View style={styles.progressWrap}>
          <View ref={progressTrackRef} style={styles.progressTrack} onLayout={() => {
            if (!progressTrackRef.current) return;
            progressTrackRef.current.measure((x, y, w, h, pageX, pageY) => setProgressLayout({ width: w, pageX, pageY }));
          }} {...progressResponder.panHandlers}>
            <View style={[styles.progressFill, { width: `${Math.min(1, (playback.position || 0) / (playback.duration || 1)) * 100}%` }]} />
          </View>
          <View style={styles.progressTimeRow}><Text style={styles.progressText}>{formatTime(playback.position)}</Text><Text style={styles.progressText}>{formatTime(playback.duration)}</Text></View>
        </View>
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.controlBtn} onPress={async () => {
            if (!current) return;
            await feedback("like");
            const list = await loadPlaylists(userId);
            if (list.length === 0) { Alert.alert("还没有歌单", "先去收藏页创建一个歌单吧。"); setActiveTab("favorites"); return; }
            setShowPlaylistPicker(true);
          }}><Text style={styles.controlText}>收藏</Text></TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={togglePlay}><Text style={styles.playText}>{current ? (playback.isPlaying ? "暂停" : "播放") : "生成"}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={handleNext}><Text style={styles.controlText}>下一曲</Text></TouchableOpacity>
        </View>
      </View>
      {showPlaylistPicker ? <View style={styles.groupCard}><Text style={styles.groupTitle}>收藏到哪个歌单？</Text>{playlists.map((p) => <TouchableOpacity key={p.id} style={styles.listItem} onPress={async () => { await addSongToPlaylist(p.id); if (selectedPlaylistId === p.id) await loadPlaylistSongs(p.id); setShowPlaylistPicker(false); }}><View><Text style={styles.listTitle}>{p.name}</Text><Text style={styles.listSub}>歌曲 {p.song_count || 0}</Text></View><Text style={styles.chevron}>›</Text></TouchableOpacity>)}<TouchableOpacity style={styles.secondarySoft} onPress={() => setShowPlaylistPicker(false)}><Text style={styles.secondaryText}>取消</Text></TouchableOpacity></View> : null}
      <View style={styles.section}><TouchableOpacity style={styles.queueToggle} onPress={() => setShowQueue((prev) => !prev)}><View><Text style={styles.queueLabel}>播放队列</Text><Text style={styles.queueHint}>有下一首就切换，没有就自动生成</Text></View><Text style={styles.queueAction}>{showQueue ? "收起" : "展开"}</Text></TouchableOpacity>{showQueue ? songs.map((item) => <TouchableOpacity key={item.id} style={styles.listItem} onPress={() => play(item)}><View style={styles.flex}><Text style={styles.listTitle}>{item.title || "未命名歌曲"}</Text><Text style={styles.listSub} numberOfLines={1}>{songTagText(item)}</Text></View><Text style={styles.chevron}>›</Text></TouchableOpacity>) : null}</View>
    </ScrollView>
  );

  const renderFavorites = () => (
    <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>
      <ScreenTitle eyebrow="你的收藏" title="歌单与喜欢的歌曲" subtitle="播放器负责听，这里负责沉淀内容。" />
      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>新建歌单</Text>
        <TextInput value={newPlaylistName} onChangeText={setNewPlaylistName} placeholder="比如：深夜情绪 / 周末通勤" placeholderTextColor="#9D978E" style={styles.input} />
        <TouchableOpacity style={styles.primary} onPress={createPlaylist}><Text style={styles.primaryText}>创建歌单</Text></TouchableOpacity>
      </View>
      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>我的歌单</Text>
        {playlists.length === 0 ? <Text style={styles.placeholder}>还没有歌单</Text> : playlists.map((p) => <TouchableOpacity key={p.id} style={styles.listItem} onPress={async () => { setSelectedPlaylistId(p.id); await loadPlaylistSongs(p.id); }}><View><Text style={styles.listTitle}>{p.name}</Text><Text style={styles.listSub}>歌曲 {p.song_count || 0}</Text></View><Text style={styles.chevron}>›</Text></TouchableOpacity>)}
      </View>
      {selectedPlaylistId ? <View style={styles.groupCard}><Text style={styles.groupTitle}>当前歌单内容</Text>{playlistSongs.length === 0 ? <Text style={styles.placeholder}>这个歌单还没有歌曲</Text> : playlistSongs.map((song) => <TouchableOpacity key={song.id} style={styles.listItem} onPress={() => appendPlaylistToQueue(selectedPlaylistId, song.id)}><View style={styles.flex}><Text style={styles.listTitle}>{song.title || "未命名歌曲"}</Text><Text style={styles.listSub} numberOfLines={1}>{songTagText(song)}</Text></View><Text style={styles.chevron}>›</Text></TouchableOpacity>)}</View> : null}
      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>收藏记录</Text>
        {favorites.length === 0 ? <Text style={styles.placeholder}>还没有收藏歌曲</Text> : favorites.map((song) => <TouchableOpacity key={`${song.id}-${song.created_at || "fav"}`} style={styles.listItem} onPress={() => play(song)}><View style={styles.flex}><Text style={styles.listTitle}>{song.title || "未命名歌曲"}</Text><Text style={styles.listSub} numberOfLines={1}>{songTagText(song)}</Text></View><Text style={styles.chevron}>›</Text></TouchableOpacity>)}
      </View>
    </ScrollView>
  );

  const renderGalaxy = () => (
    <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>
      <ScreenTitle eyebrow="标签画像" title="把偏好养成一片真正会呼吸的星系" subtitle="大标签可拖动到顶部功能区，背景里的微光标签会围绕轨道缓慢运行，等待被再次探索。" />
      <View style={styles.galaxyFrame} onLayout={(event) => setStageSize(event.nativeEvent.layout)}>
        <View style={styles.galaxyAuraOne} /><View style={styles.galaxyAuraTwo} /><View style={styles.galaxyAuraThree} />
        <View style={styles.zoneRow}>
          <View style={[styles.zoneCard, styles.zoneDelete]}><Text style={styles.zoneMini}>删除</Text><Text style={styles.zoneText}>移出画像</Text></View>
          <View style={[styles.zoneCard, styles.zoneWeaken]}><Text style={styles.zoneMini}>弱化</Text><Text style={styles.zoneText}>轻一点</Text></View>
          <View style={[styles.zoneCard, styles.zoneBoost]}><Text style={styles.zoneMini}>增强</Text><Text style={styles.zoneText}>更靠近你</Text></View>
        </View>
        <View style={styles.orbitA} /><View style={styles.orbitB} /><View style={styles.orbitC} />
        {galaxyNodes.length === 0 ? <View style={styles.emptyGalaxy}><Text style={styles.emptyGalaxyTitle}>还没有标签星球</Text><Text style={styles.emptyGalaxyText}>先在下方加入标签，或者重新进行首次标签选择。</Text></View> : <>
          {galaxyNodes.filter((node) => node.compact).map((node) => <GalaxyDust key={"dust-" + node.tag.tag_id} node={node} />)}
          {galaxyNodes.filter((node) => !node.compact).map((node) => <GalaxyNode key={node.tag.tag_id} node={node} onDrop={handleGalaxyDrop} />)}
        </>}
      </View>
      <View style={styles.groupCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.groupTitle}>当前画像权重</Text>
          {activeProfileTags.length > COLLAPSED_WEIGHT_LIMIT ? <TouchableOpacity onPress={() => setShowAllWeights((prev) => !prev)}><Text style={styles.queueAction}>{showAllWeights ? "收起" : "查看更多"}</Text></TouchableOpacity> : null}
        </View>
        {activeProfileTags.length === 0 ? <Text style={styles.placeholder}>暂无画像标签</Text> : visibleWeightTags.map((tag) => <View key={tag.tag_id} style={styles.weightRow}><Text style={styles.weightTitle}>{tag.name}</Text><View style={styles.weightTrack}><View style={[styles.weightFill, { width: String(Math.max(10, Number(tag.weight || 0) * 100)) + "%" }]} /></View></View>)}
      </View>
      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>新增标签</Text>
        <TextInput value={newTagName} onChangeText={setNewTagName} placeholder="标签名称" placeholderTextColor="#9D978E" style={styles.input} />
        {existingTagMatch ? <Text style={styles.hintText}>已识别到现有标签分类：{existingTagMatch.type}，会直接加入你的画像。</Text> : <Text style={styles.hintText}>如果这是一个全新的标签，提交后会在下方选择类别。</Text>}
        <TouchableOpacity style={styles.primary} onPress={submitUserTag}><Text style={styles.primaryText}>加入我的画像</Text></TouchableOpacity>
        {showCategoryPicker ? <View style={styles.categoryPickerCard}><Text style={styles.categoryPickerTitle}>给“{pendingTagName}”选择一个类别</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPickerRow}>{CATEGORY_ORDER.map((type) => <TouchableOpacity key={type} style={[styles.categoryChip, selectedCategory === type && styles.categoryChipActive]} onPress={() => setSelectedCategory(type)}><Text style={[styles.categoryChipText, selectedCategory === type && styles.categoryChipTextActive]}>{type}</Text></TouchableOpacity>)}</ScrollView><View style={styles.rowGap}><TouchableOpacity style={[styles.secondarySoft, styles.flex]} onPress={() => { setShowCategoryPicker(false); setPendingTagName(""); }}><Text style={styles.secondaryText}>取消</Text></TouchableOpacity><TouchableOpacity style={[styles.primary, styles.flex]} onPress={confirmCustomTagType}><Text style={styles.primaryText}>确认分类</Text></TouchableOpacity></View></View> : null}
        {tagMessage ? <Text style={styles.hintText}>{tagMessage}</Text> : null}
      </View>
    </ScrollView>
  );  const renderSettings = () => (
    <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>
      <ScreenTitle eyebrow="账户中心" title="设置与连接状态" subtitle="这是一版简单账户系统，先保证用户能快速回到自己的数据。" />
      <View style={styles.groupCard}><Text style={styles.groupTitle}>当前账户</Text><View style={styles.accountCard}><Text style={styles.accountName}>{displayName}</Text><Text style={styles.accountMeta}>账户 ID：{session?.deviceId}</Text><Text style={styles.accountMeta}>用户 ID：{session?.userId}</Text></View></View>
      <View style={styles.groupCard}><Text style={styles.groupTitle}>接口状态</Text><TouchableOpacity style={styles.secondarySoft} onPress={testConnection}><Text style={styles.secondaryText}>{health.loading ? "测试中..." : "测试 API 连接"}</Text></TouchableOpacity>{health.message ? <Text style={health.ok ? styles.okText : styles.errorText}>{health.message}</Text> : null}</View>
      <View style={styles.groupCard}><Text style={styles.groupTitle}>账户操作</Text><TouchableOpacity style={styles.dangerButton} onPress={logout}><Text style={styles.dangerText}>退出当前账户</Text></TouchableOpacity></View>
    </ScrollView>
  );

  if (!session) return renderAuth();
  if (needsOnboarding) return renderOnboarding();

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content}>
        {activeTab === "player" && renderPlayer()}
        {activeTab === "favorites" && renderFavorites()}
        {activeTab === "galaxy" && renderGalaxy()}
        {activeTab === "settings" && renderSettings()}
      </View>
      <View style={styles.tabBarShell}><View style={styles.tabBar}>{TABS.map((tab) => <TouchableOpacity key={tab.key} style={styles.tabItem} onPress={() => setActiveTab(tab.key)}><Text style={[styles.tabIcon, activeTab === tab.key && styles.tabIconActive]}>{tab.icon}</Text><Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text></TouchableOpacity>)}</View></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F6F3EC" },
  content: { flex: 1 },
  screenPadding: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 120 },
  titleBlock: { marginBottom: 18 }, eyebrow: { fontSize: 11, fontWeight: "800", color: "#7A746B", letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 8 }, title: { fontSize: 34, fontWeight: "800", color: "#181613", letterSpacing: -0.9 }, subtitle: { fontSize: 15, color: "#756F66", lineHeight: 22, marginTop: 8 },
  authShell: { flexGrow: 1, justifyContent: "center", padding: 20 }, authBlobA: { position: "absolute", width: 280, height: 280, borderRadius: 999, backgroundColor: "rgba(105,147,255,0.18)", top: 80, right: -80 }, authBlobB: { position: "absolute", width: 220, height: 220, borderRadius: 999, backgroundColor: "rgba(243,147,110,0.18)", bottom: 90, left: -50 },
  authCard: { backgroundColor: "rgba(255,255,255,0.82)", borderRadius: 30, padding: 22, shadowColor: "#4D4336", shadowOpacity: 0.14, shadowOffset: { width: 0, height: 18 }, shadowRadius: 28, elevation: 10 }, authEyebrow: { fontSize: 12, fontWeight: "800", color: "#7A746B", letterSpacing: 1.8, marginBottom: 12 }, authTitle: { fontSize: 31, fontWeight: "800", color: "#181613", lineHeight: 38, letterSpacing: -0.9 }, authSubtitle: { fontSize: 15, color: "#756F66", lineHeight: 22, marginTop: 10, marginBottom: 16 },
  authModeRow: { flexDirection: "row", backgroundColor: "#ECE6DD", borderRadius: 18, padding: 4, marginBottom: 14 }, authMode: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 14 }, authModeActive: { backgroundColor: "#FFFFFF" }, authModeText: { color: "#8B8378", fontWeight: "700" }, authModeTextActive: { color: "#181613" },
  input: { backgroundColor: "#FFFDFC", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 15, marginBottom: 10, color: "#181613", shadowColor: "#D9D1C6", shadowOpacity: 0.08, shadowOffset: { width: 0, height: 8 }, shadowRadius: 18, elevation: 2 },
  primary: { backgroundColor: "#111217", borderRadius: 20, paddingVertical: 16, alignItems: "center", marginTop: 6, shadowColor: "#111", shadowOpacity: 0.18, shadowOffset: { width: 0, height: 12 }, shadowRadius: 20, elevation: 8 }, primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  secondarySoft: { backgroundColor: "rgba(255,255,255,0.8)", borderRadius: 18, paddingVertical: 14, alignItems: "center" }, secondaryText: { color: "#181613", fontSize: 14, fontWeight: "700" },
  groupCard: { backgroundColor: "rgba(255,252,247,0.94)", borderRadius: 28, padding: 18, marginBottom: 18, shadowColor: "#D8D1C6", shadowOpacity: 0.08, shadowOffset: { width: 0, height: 10 }, shadowRadius: 20, elevation: 3 }, groupTitle: { color: "#181613", fontSize: 21, fontWeight: "800", marginBottom: 12, letterSpacing: -0.4 },
  seedWrap: { flexDirection: "row", flexWrap: "wrap" }, seedTag: { backgroundColor: "#F7F3ED", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, marginRight: 8, marginBottom: 8, minWidth: 110 }, seedTagSelected: { backgroundColor: "#111217" }, seedType: { color: "#8A8175", fontSize: 11, fontWeight: "700", marginBottom: 5 }, seedTypeSelected: { color: "rgba(255,255,255,0.7)" }, seedName: { color: "#181613", fontSize: 14, fontWeight: "800" }, seedNameSelected: { color: "#FFFFFF" },
  playerCard: { backgroundColor: "rgba(255,252,247,0.96)", borderRadius: 32, padding: 22, marginBottom: 18, shadowColor: "#D8D1C6", shadowOpacity: 0.08, shadowOffset: { width: 0, height: 12 }, shadowRadius: 18, elevation: 3 }, 
  coverWrap: { alignItems: "center", marginBottom: 18 }, cover: { width: 228, height: 228, borderRadius: 34, alignItems: "center", justifyContent: "center", backgroundColor: "#18181C", overflow: "hidden" }, coverGlowA: { position: "absolute", width: 180, height: 180, borderRadius: 999, backgroundColor: "#4E67C8", top: -34, right: -20 }, coverGlowB: { position: "absolute", width: 140, height: 140, borderRadius: 999, backgroundColor: "#F19472", bottom: -18, left: -16 }, coverGlowC: { position: "absolute", width: 76, height: 76, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", top: 40, left: 42 }, coverText: { color: "#FFFFFF", fontSize: 34, fontWeight: "800", letterSpacing: 1.2 },
  playerTitle: { color: "#181613", fontSize: 30, fontWeight: "800", textAlign: "center", letterSpacing: -0.8 }, playerSub: { color: "#6F6A62", fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8 }, progressWrap: { marginTop: 22 }, progressTrack: { height: 10, borderRadius: 999, backgroundColor: "#E9E3D9", overflow: "hidden" }, progressFill: { height: 10, borderRadius: 999, backgroundColor: "#111217" }, progressTimeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 }, progressText: { color: "#7B746A", fontSize: 12, fontVariant: ["tabular-nums"] },
  controlsRow: { flexDirection: "row", gap: 10, marginTop: 22 }, controlBtn: { flex: 1, backgroundColor: "#FFFCF8", borderRadius: 18, paddingVertical: 15, alignItems: "center", shadowColor: "#D9D0C4", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 6 }, shadowRadius: 12, elevation: 2 }, controlText: { color: "#181613", fontSize: 15, fontWeight: "700" }, playBtn: { flex: 1, backgroundColor: "#111217", borderRadius: 18, paddingVertical: 15, alignItems: "center" }, playText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  section: { marginBottom: 18 }, queueToggle: { backgroundColor: "rgba(255,252,247,0.94)", borderRadius: 24, padding: 18, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", shadowColor: "#D8D1C6", shadowOpacity: 0.07, shadowOffset: { width: 0, height: 8 }, shadowRadius: 14, elevation: 2 }, queueLabel: { color: "#181613", fontSize: 18, fontWeight: "800" }, queueHint: { color: "#7A746B", fontSize: 13, marginTop: 4 }, queueAction: { color: "#6C675F", fontSize: 14, fontWeight: "700" },
  listItem: { backgroundColor: "#FFFCF8", borderRadius: 22, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#DDD5CA", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 6 }, shadowRadius: 12, elevation: 2 }, listTitle: { color: "#181613", fontSize: 15, fontWeight: "700" }, listSub: { color: "#766F67", fontSize: 13, marginTop: 4, lineHeight: 18 }, chevron: { color: "#B0A89C", fontSize: 20, marginLeft: 12 }, placeholder: { color: "#8C867E", fontSize: 14 },
  galaxyFrame: { height: 430, borderRadius: 32, overflow: "hidden", backgroundColor: "#11131C", marginBottom: 18 }, galaxyAuraOne: { position: "absolute", width: 220, height: 220, borderRadius: 999, backgroundColor: "rgba(83,120,255,0.28)", top: 80, right: -40 }, galaxyAuraTwo: { position: "absolute", width: 170, height: 170, borderRadius: 999, backgroundColor: "rgba(247,141,112,0.22)", bottom: 28, left: -24 }, galaxyAuraThree: { position: "absolute", width: 130, height: 130, borderRadius: 999, backgroundColor: "rgba(141,222,177,0.18)", top: 160, left: 40 }, orbitA: { position: "absolute", width: 280, height: 280, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", top: 110, left: 48 }, orbitB: { position: "absolute", width: 180, height: 180, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", top: 160, left: 110 }, orbitC: { position: "absolute", width: 360, height: 360, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)", top: 70, left: 8 },
  zoneRow: { position: "absolute", top: 16, left: 14, right: 14, flexDirection: "row", gap: 10, zIndex: 2 }, zoneCard: { flex: 1, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 10 }, zoneDelete: { backgroundColor: "rgba(104,28,28,0.84)" }, zoneWeaken: { backgroundColor: "rgba(37,58,86,0.86)" }, zoneBoost: { backgroundColor: "rgba(25,75,42,0.88)" }, zoneMini: { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "700", letterSpacing: 1 }, zoneText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", marginTop: 4 },
  emptyGalaxy: { position: "absolute", left: 26, right: 26, bottom: 42, backgroundColor: "rgba(255,255,255,0.08)", padding: 18, borderRadius: 22 }, emptyGalaxyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" }, emptyGalaxyText: { color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 20, marginTop: 6 },
  dustOrbit: { position: "absolute", alignItems: "center" }, dustParticle: { position: "absolute", top: 0, left: "50%", marginLeft: -4, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 0 }, shadowRadius: 8, opacity: 0.72 },
  node: { position: "absolute", justifyContent: "center", alignItems: "center", shadowOpacity: 0.24, shadowOffset: { width: 0, height: 10 }, shadowRadius: 16, elevation: 8, padding: 10 }, nodeGlow: { position: "absolute", width: 40, height: 40, borderRadius: 999, top: 8, right: 8, opacity: 0.28 }, nodeName: { fontSize: 13, fontWeight: "800", lineHeight: 17, textAlign: "center", paddingHorizontal: 8 }, categoryPickerCard: { marginTop: 14, backgroundColor: "#F7F2EA", borderRadius: 22, padding: 14 }, categoryPickerTitle: { color: "#181613", fontSize: 15, fontWeight: "700", marginBottom: 12 }, categoryPickerRow: { paddingRight: 8 }, categoryChip: { backgroundColor: "#ECE4D9", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, marginRight: 10 }, categoryChipActive: { backgroundColor: "#111217" }, categoryChipText: { color: "#6E675F", fontSize: 14, fontWeight: "700" }, categoryChipTextActive: { color: "#FFFFFF" },
  onboardingProgressHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, onboardingProgressTrack: { height: 10, borderRadius: 999, backgroundColor: "#ECE4D9", overflow: "hidden", marginBottom: 16 }, onboardingProgressFill: { height: 10, borderRadius: 999, backgroundColor: "#111217" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }, weightRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 }, weightTitle: { color: "#181613", fontSize: 14, fontWeight: "700", width: 88 }, weightSub: { color: "#8A8175", fontSize: 12, marginTop: 3 }, weightTrack: { flex: 1, height: 10, borderRadius: 999, backgroundColor: "#ECE4D9", overflow: "hidden", marginLeft: 12 }, weightFill: { height: 10, borderRadius: 999, backgroundColor: "#111217" },
  accountCard: { backgroundColor: "#F7F3ED", borderRadius: 22, padding: 16 }, accountName: { color: "#181613", fontSize: 22, fontWeight: "800", marginBottom: 8 }, accountMeta: { color: "#70685E", fontSize: 14, marginTop: 3 },
  dangerButton: { backgroundColor: "#5A1A1A", borderRadius: 18, paddingVertical: 15, alignItems: "center" }, dangerText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" }, hintText: { color: "#7A746B", fontSize: 13, lineHeight: 20, marginTop: 10 }, okText: { color: "#1D8A4A", marginTop: 10, fontSize: 13 }, errorText: { color: "#B23B2C", marginTop: 10, fontSize: 13 },
  tabBarShell: { position: "absolute", left: 0, right: 0, bottom: 12, alignItems: "center" }, tabBar: { flexDirection: "row", width: "92%", backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 28, paddingHorizontal: 10, paddingVertical: 12, shadowColor: "#000", shadowOpacity: 0.1, shadowOffset: { width: 0, height: 12 }, shadowRadius: 26, elevation: 10 }, tabItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 6 }, tabIcon: { fontSize: 16, color: "#938E85", marginBottom: 4 }, tabIconActive: { color: "#171512" }, tabText: { fontSize: 11, color: "#938E85", fontWeight: "600" }, tabTextActive: { color: "#171512", fontWeight: "800" },
  rowGap: { flexDirection: "row", gap: 10 }, flex: { flex: 1 }
});


































