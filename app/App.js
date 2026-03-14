import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  ScrollView,
  Animated,
  useWindowDimensions,
  Alert
} from "react-native";
import { Audio } from "expo-av";
import { API_BASE } from "./config";

function TagChip({ tag, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={() => onPress(tag)}
      style={[styles.tag, selected && styles.tagSelected]}
    >
      <Text style={[styles.tagText, selected && styles.tagTextSelected]}>{tag.name}</Text>
    </TouchableOpacity>
  );
}

function formatTime(ms) {
  if (!ms || Number.isNaN(ms)) return "0:00";
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function ScreenTitle({ title, subtitle }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState("player");
  const [deviceId, setDeviceId] = useState("demo-device");
  const [userId, setUserId] = useState(null);
  const [tags, setTags] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [health, setHealth] = useState({ loading: false, ok: null, message: "" });
  const [songs, setSongs] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [current, setCurrent] = useState(null);
  const [sound, setSound] = useState(null);
  const [currentSoundId, setCurrentSoundId] = useState(null);
  const [playback, setPlayback] = useState({ position: 0, duration: 1, isPlaying: false });
  const [newTagName, setNewTagName] = useState("");
  const [newTagType, setNewTagType] = useState("");
  const [tagMessage, setTagMessage] = useState("");
  const [profileTags, setProfileTags] = useState([]);
  const [galaxyNodes, setGalaxyNodes] = useState([]);

  const completeSentFor = useRef(null);
  const autoNextLock = useRef(false);

  const loadTags = async () => {
    const res = await fetch(`${API_BASE}/tags`);
    const data = await res.json();
    setTags(data.items || []);
  };

  useEffect(() => {
    loadTags().catch(() => setTags([]));
  }, []);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const toggleTag = (tag) => {
    const next = new Set(selected);
    if (next.has(tag.id)) next.delete(tag.id);
    else next.add(tag.id);
    setSelected(next);
  };

  const ensureUser = async () => {
    const res = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId })
    });
    const data = await res.json();
    setUserId(data.user.id);
    return data.user.id;
  };

  const initTags = async () => {
    const uid = userId || (await ensureUser());
    await fetch(`${API_BASE}/init-tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: uid, tag_ids: selectedIds })
    });
  };

  const submitUserTag = async () => {
    setTagMessage("");
    if (!newTagName.trim() || !newTagType.trim()) {
      setTagMessage("请填写标签名称和类型");
      return;
    }
    const uid = userId || (await ensureUser());
    const res = await fetch(`${API_BASE}/user-tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: uid, name: newTagName.trim(), type: newTagType.trim() })
    });
    const data = await res.json();
    if (!res.ok) {
      setTagMessage(data.error || "添加失败");
      return;
    }
    await loadTags();
    if (data.tag?.id) {
      const next = new Set(selected);
      next.add(data.tag.id);
      setSelected(next);
    }
    setNewTagName("");
    setNewTagType("");
    setTagMessage("已添加标签");
  };

  const loadProfileTags = async (uid = userId) => {
    if (!uid) return;
    const res = await fetch(`${API_BASE}/user-tags?user_id=${uid}`);
    const data = await res.json();
    const items = data.items || [];
    setProfileTags(items.filter((item) => item.is_active !== false));
  };

  const removeProfileTag = async (tag) => {
    if (!userId) return;
    Alert.alert("移除标签", `确定移除 ${tag.name} 吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "移除",
        style: "destructive",
        onPress: async () => {
          await fetch(`${API_BASE}/user-tags/remove`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, tag_id: tag.tag_id })
          });
          await loadProfileTags();
        }
      }
    ]);
  };

  const generate = async () => {
    const uid = userId || (await ensureUser());
    await fetch(`${API_BASE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: uid, instrumental: true })
    });
    await refreshSongs(uid, { setCurrent: true });
  };

  const refreshSongs = async (uid = userId, options = {}) => {
    if (!uid) return [];
    const res = await fetch(`${API_BASE}/songs?user_id=${uid}`);
    const data = await res.json();
    const items = data.items || [];
    setSongs(items);
    if (options.setCurrent && items.length > 0) {
      setCurrent(items[0]);
    }
    if (!current && items.length > 0) {
      setCurrent(items[0]);
    }
    return items;
  };

  const refreshFavorites = async (uid = userId) => {
    if (!uid) return [];
    const res = await fetch(`${API_BASE}/favorites?user_id=${uid}`);
    const data = await res.json();
    const items = data.items || [];
    setFavorites(items);
    return items;
  };

  const testConnection = async () => {
    setHealth({ loading: true, ok: null, message: "" });
    try {
      const res = await fetch(`${API_BASE}/tags`);
      const data = await res.json();
      setHealth({
        loading: false,
        ok: res.ok,
        message: `API: ${API_BASE} | tags: ${data.items ? data.items.length : 0}`
      });
    } catch (err) {
      setHealth({
        loading: false,
        ok: false,
        message: `API: ${API_BASE} | error: ${String(err)}`
      });
    }
  };

  const attachStatus = (status) => {
    if (!status?.isLoaded) return;
    setPlayback({
      position: status.positionMillis || 0,
      duration: status.durationMillis || 1,
      isPlaying: status.isPlaying
    });

    if (status.didJustFinish && current) {
      if (completeSentFor.current !== current.id) {
        completeSentFor.current = current.id;
        handleAutoNext("complete").catch(() => {});
      }
    }
  };

  const play = async (song) => {
    if (!song?.audio_url) return;
    if (sound) await sound.unloadAsync();
    completeSentFor.current = null;
    const { sound: nextSound } = await Audio.Sound.createAsync(
      { uri: song.audio_url },
      { shouldPlay: true, progressUpdateIntervalMillis: 1000 },
      attachStatus
    );
    setSound(nextSound);
    setCurrentSoundId(song.id);
  };

  const togglePlay = async () => {
    if (!current) return;
    if (!sound || currentSoundId !== current.id) {
      await play(current);
      return;
    }
    if (playback.isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  };

  const goNext = async () => {
    if (!songs.length || !current) return;
    const index = songs.findIndex((s) => s.id === current.id);
    const next = songs[index + 1] || songs[0];
    setCurrent(next);
    if (next) await play(next);
  };

  const feedback = async (action) => {
    if (!userId || !current) return;
    const playedSeconds = Math.floor((playback.position || 0) / 1000);
    await fetch(`${API_BASE}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        song_id: current.id,
        action,
        played_seconds: playedSeconds
      })
    });
  };

  const handleAutoNext = async (action) => {
    if (!userId || !current || autoNextLock.current) return;
    autoNextLock.current = true;
    try {
      await feedback(action);
      await fetch(`${API_BASE}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, instrumental: true })
      });
      const items = await refreshSongs(userId, { setCurrent: true });
      if (items.length > 0) {
        await play(items[0]);
      }
    } finally {
      autoNextLock.current = false;
    }
  };

  useEffect(() => {
    if (activeTab === "favorites") {
      const uid = userId;
      if (uid) refreshFavorites(uid).catch(() => {});
    }
    if (activeTab === "galaxy") {
      const uid = userId;
      if (uid) loadProfileTags(uid).catch(() => {});
    }
  }, [activeTab, userId]);

  useEffect(() => {
    const height = 360;
    const nodes = profileTags.map((tag, index) => {
      const size = 16 + Math.max(0, Math.min(1, Number(tag.weight || 0))) * 52;
      const startX = Math.random() * (width - size - 20) + 10;
      const startY = Math.random() * (height - size - 20) + 10;
      const dx = (Math.random() - 0.5) * 40;
      const dy = (Math.random() - 0.5) * 30;
      const animX = new Animated.Value(startX);
      const animY = new Animated.Value(startY);
      Animated.loop(
        Animated.sequence([
          Animated.timing(animX, { toValue: startX + dx, duration: 7000 + index * 200, useNativeDriver: false }),
          Animated.timing(animX, { toValue: startX - dx, duration: 7000 + index * 200, useNativeDriver: false })
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(animY, { toValue: startY + dy, duration: 8000 + index * 150, useNativeDriver: false }),
          Animated.timing(animY, { toValue: startY - dy, duration: 8000 + index * 150, useNativeDriver: false })
        ])
      ).start();
      return { tag, size, animX, animY };
    });
    setGalaxyNodes(nodes);
  }, [profileTags, width]);

  const progressPercent = Math.min(1, (playback.position || 0) / (playback.duration || 1));

  const renderPlayer = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.screenPadding}>
      <ScreenTitle title="现在播放" subtitle="你的 AI 音乐正在流动" />
      <View style={styles.section}>
        <TouchableOpacity style={styles.primary} onPress={generate}>
          <Text style={styles.primaryText}>生成新音乐</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.playerCard}>
        <View style={styles.coverWrap}>
          <View style={styles.cover}>
            <Text style={styles.coverText}>TPY</Text>
          </View>
        </View>
        <Text style={styles.playerTitle}>{current ? "AI 生成曲" : "暂无歌曲"}</Text>
        <Text style={styles.playerSub} numberOfLines={2}>
          {current ? current.prompt : "请先生成音乐"}
        </Text>

        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent * 100}%` }]} />
          </View>
          <View style={styles.progressTimeRow}>
            <Text style={styles.progressText}>{formatTime(playback.position)}</Text>
            <Text style={styles.progressText}>{formatTime(playback.duration)}</Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.controlBtn} onPress={() => feedback("like")}>
            <Text style={styles.controlText}>收藏</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
            <Text style={styles.playText}>{playback.isPlaying ? "暂停" : "播放"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={() => handleAutoNext("skip")}>
            <Text style={styles.controlText}>跳过</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.secondary} onPress={goNext}>
          <Text style={styles.secondaryText}>下一首</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>播放列表</Text>
          <TouchableOpacity style={styles.secondarySmall} onPress={() => refreshSongs()}>
            <Text style={styles.secondaryText}>刷新</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={songs}
          keyExtractor={(item) => String(item.id)}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.listItem} onPress={() => setCurrent(item)}>
              <View>
                <Text style={styles.listTitle}>#{item.id}</Text>
                <Text style={styles.listSub} numberOfLines={1}>{item.prompt}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </ScrollView>
  );

  const renderFavorites = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.screenPadding}>
      <ScreenTitle title="收藏歌单" subtitle="你喜欢的都在这里" />
      <View style={styles.sectionHeader}>
        <TouchableOpacity style={styles.secondarySmall} onPress={() => refreshFavorites()}>
          <Text style={styles.secondaryText}>刷新</Text>
        </TouchableOpacity>
      </View>
      {favorites.length === 0 ? (
        <Text style={styles.placeholder}>暂无收藏歌曲</Text>
      ) : (
        favorites.map((item) => (
          <TouchableOpacity key={item.id} style={styles.listItem} onPress={() => setCurrent(item)}>
            <View>
              <Text style={styles.listTitle}>#{item.id}</Text>
              <Text style={styles.listSub} numberOfLines={1}>{item.prompt}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );

  const renderGalaxy = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.screenPadding}>
      <ScreenTitle title="标签画像" subtitle="星系代表你的喜好分布" />
      <Text style={styles.hintText}>点击星球可移除标签，大小代表喜爱程度</Text>
      <View style={styles.galaxyWrap}>
        {galaxyNodes.map((node) => (
          <Animated.View
            key={node.tag.tag_id}
            style={[
              styles.galaxyNode,
              {
                width: node.size,
                height: node.size,
                borderRadius: node.size / 2,
                transform: [{ translateX: node.animX }, { translateY: node.animY }]
              }
            ]}
          >
            <TouchableOpacity
              style={styles.galaxyInner}
              onPress={() => removeProfileTag(node.tag)}
            >
              <Text style={styles.galaxyText}>{node.tag.name}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>标签列表</Text>
          <TouchableOpacity style={styles.secondarySmall} onPress={() => loadProfileTags()}>
            <Text style={styles.secondaryText}>刷新</Text>
          </TouchableOpacity>
        </View>
        {profileTags.map((tag) => (
          <View key={tag.tag_id} style={styles.profileItem}>
            <View>
              <Text style={styles.profileTitle}>{tag.name}</Text>
              <Text style={styles.profileSub}>{tag.type} · 权重 {Number(tag.weight || 0).toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={styles.removeBtn} onPress={() => removeProfileTag(tag)}>
              <Text style={styles.removeText}>移除</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderSettings = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.screenPadding}>
      <ScreenTitle title="设置" subtitle="个性化你的音乐偏好" />
      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>设备信息</Text>
        <TextInput value={deviceId} onChangeText={setDeviceId} style={styles.input} />
      </View>

      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>标签初始化</Text>
        <FlatList
          data={tags}
          keyExtractor={(item) => String(item.id)}
          numColumns={3}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TagChip tag={item} selected={selected.has(item.id)} onPress={toggleTag} />
          )}
        />
        <TouchableOpacity style={styles.primary} onPress={initTags}>
          <Text style={styles.primaryText}>初始化标签池</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>新增标签</Text>
        <View style={styles.row}>
          <TextInput
            value={newTagName}
            onChangeText={setNewTagName}
            placeholder="标签名称"
            style={[styles.input, styles.flex]}
          />
          <TextInput
            value={newTagType}
            onChangeText={setNewTagType}
            placeholder="标签类型（情绪/风格/乐器等）"
            style={[styles.input, styles.flex]}
          />
        </View>
        <TouchableOpacity style={styles.secondary} onPress={submitUserTag}>
          <Text style={styles.secondaryText}>提交标签</Text>
        </TouchableOpacity>
        {tagMessage ? <Text style={styles.hintText}>{tagMessage}</Text> : null}
      </View>

      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>连接测试</Text>
        <TouchableOpacity style={styles.secondary} onPress={testConnection}>
          <Text style={styles.secondaryText}>测试 API 连接</Text>
        </TouchableOpacity>
        {health.message ? (
          <Text style={health.ok ? styles.okText : styles.errorText}>{health.message}</Text>
        ) : null}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content}>
        {activeTab === "player" && renderPlayer()}
        {activeTab === "favorites" && renderFavorites()}
        {activeTab === "galaxy" && renderGalaxy()}
        {activeTab === "settings" && renderSettings()}
      </View>
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab("player")}>
          <Text style={[styles.tabText, activeTab === "player" && styles.tabTextActive]}>播放</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab("favorites")}>
          <Text style={[styles.tabText, activeTab === "favorites" && styles.tabTextActive]}>收藏</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab("galaxy")}>
          <Text style={[styles.tabText, activeTab === "galaxy" && styles.tabTextActive]}>标签画像</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab("settings")}>
          <Text style={[styles.tabText, activeTab === "settings" && styles.tabTextActive]}>设置</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F2F2F7" },
  content: { flex: 1 },
  screenPadding: { padding: 16, paddingBottom: 32 },
  titleBlock: { marginBottom: 12 },
  title: { fontSize: 28, fontWeight: "700", color: "#1C1C1E" },
  subtitle: { fontSize: 13, color: "#8E8E93", marginTop: 4 },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#1C1C1E" },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    marginBottom: 8,
    color: "#1C1C1E"
  },
  tag: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    margin: 4
  },
  tagSelected: { backgroundColor: "#007AFF", borderColor: "#007AFF" },
  tagText: { fontSize: 12, color: "#1C1C1E" },
  tagTextSelected: { color: "#fff" },
  primary: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8
  },
  primaryText: { color: "#fff", fontWeight: "600" },
  secondary: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    alignItems: "center"
  },
  secondaryText: { color: "#007AFF", fontWeight: "600" },
  secondarySmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E5EA"
  },
  okText: { color: "#34C759", marginTop: 6, fontSize: 12 },
  errorText: { color: "#FF3B30", marginTop: 6, fontSize: 12 },
  hintText: { color: "#8E8E93", marginTop: 4, fontSize: 12 },
  row: { flexDirection: "row", gap: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  flex: { flex: 1 },
  playerCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    marginBottom: 16
  },
  coverWrap: { alignItems: "center", marginBottom: 12 },
  cover: {
    width: 150,
    height: 150,
    borderRadius: 24,
    backgroundColor: "#1C1C1E",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 6
  },
  coverText: { color: "#fff", fontSize: 22, fontWeight: "700" },
  playerTitle: { fontSize: 18, fontWeight: "700", textAlign: "center", color: "#1C1C1E" },
  playerSub: { fontSize: 12, color: "#8E8E93", textAlign: "center", marginTop: 4 },
  progressWrap: { marginTop: 12 },
  progressTrack: {
    height: 6,
    backgroundColor: "#E5E5EA",
    borderRadius: 999,
    overflow: "hidden"
  },
  progressFill: { height: 6, backgroundColor: "#007AFF" },
  progressTimeRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  progressText: { fontSize: 11, color: "#8E8E93" },
  controlsRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 12 },
  controlBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    backgroundColor: "#fff",
    alignItems: "center",
    marginHorizontal: 4
  },
  controlText: { fontSize: 12, color: "#1C1C1E" },
  playBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 999,
    backgroundColor: "#007AFF",
    alignItems: "center",
    marginHorizontal: 4
  },
  playText: { color: "#fff", fontWeight: "600" },
  listItem: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  listTitle: { fontSize: 12, fontWeight: "700", color: "#1C1C1E" },
  listSub: { fontSize: 11, color: "#8E8E93" },
  chevron: { fontSize: 18, color: "#C7C7CC" },
  placeholder: { color: "#8E8E93", marginTop: 8 },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
    backgroundColor: "#fff"
  },
  tabItem: { paddingVertical: 6, paddingHorizontal: 8 },
  tabText: { fontSize: 12, color: "#8E8E93" },
  tabTextActive: { color: "#007AFF", fontWeight: "700" },
  galaxyWrap: {
    height: 360,
    borderRadius: 20,
    backgroundColor: "#0B0B17",
    marginBottom: 16,
    overflow: "hidden"
  },
  galaxyNode: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center"
  },
  galaxyInner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(120, 200, 255, 0.85)",
    borderRadius: 999,
    padding: 4
  },
  galaxyText: { fontSize: 10, color: "#0B1B2B", fontWeight: "700" },
  profileItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA"
  },
  profileTitle: { fontSize: 14, fontWeight: "600", color: "#1C1C1E" },
  profileSub: { fontSize: 12, color: "#8E8E93", marginTop: 4 },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#FFE5E5"
  },
  removeText: { color: "#FF3B30", fontWeight: "600" },
  groupCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    marginBottom: 16
  },
  groupTitle: { fontSize: 14, fontWeight: "600", color: "#1C1C1E", marginBottom: 8 }
});
