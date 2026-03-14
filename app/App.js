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
      const size = 18 + Math.max(0, Math.min(1, Number(tag.weight || 0))) * 46;
      const startX = Math.random() * (width - size - 20) + 10;
      const startY = Math.random() * (height - size - 20) + 10;
      const dx = (Math.random() - 0.5) * 40;
      const dy = (Math.random() - 0.5) * 30;
      const animX = new Animated.Value(startX);
      const animY = new Animated.Value(startY);
      Animated.loop(
        Animated.sequence([
          Animated.timing(animX, { toValue: startX + dx, duration: 6000 + index * 200, useNativeDriver: false }),
          Animated.timing(animX, { toValue: startX - dx, duration: 6000 + index * 200, useNativeDriver: false })
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(animY, { toValue: startY + dy, duration: 7000 + index * 150, useNativeDriver: false }),
          Animated.timing(animY, { toValue: startY - dy, duration: 7000 + index * 150, useNativeDriver: false })
        ])
      ).start();
      return { tag, size, animX, animY };
    });
    setGalaxyNodes(nodes);
  }, [profileTags, width]);

  const progressPercent = Math.min(1, (playback.position || 0) / (playback.duration || 1));

  const renderPlayer = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>音乐播放</Text>
      <View style={styles.section}>
        <TouchableOpacity style={styles.primary} onPress={generate}>
          <Text style={styles.primaryText}>生成音乐</Text>
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
          <Text>下一首</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>播放列表</Text>
          <TouchableOpacity style={styles.secondarySmall} onPress={() => refreshSongs()}>
            <Text>刷新</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={songs}
          keyExtractor={(item) => String(item.id)}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.listItem} onPress={() => setCurrent(item)}>
              <Text style={styles.listTitle}>#{item.id}</Text>
              <Text style={styles.listSub} numberOfLines={1}>{item.prompt}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </ScrollView>
  );

  const renderFavorites = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeader}>
        <Text style={styles.title}>收藏歌单</Text>
        <TouchableOpacity style={styles.secondarySmall} onPress={() => refreshFavorites()}>
          <Text>刷新</Text>
        </TouchableOpacity>
      </View>
      {favorites.length === 0 ? (
        <Text style={styles.placeholder}>暂无收藏歌曲</Text>
      ) : (
        favorites.map((item) => (
          <TouchableOpacity key={item.id} style={styles.listItem} onPress={() => setCurrent(item)}>
            <Text style={styles.listTitle}>#{item.id}</Text>
            <Text style={styles.listSub} numberOfLines={1}>{item.prompt}</Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );

  const renderGalaxy = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>标签画像</Text>
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
          <Text style={styles.label}>标签列表</Text>
          <TouchableOpacity style={styles.secondarySmall} onPress={() => loadProfileTags()}>
            <Text>刷新</Text>
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
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>用户设置</Text>
      <View style={styles.section}>
        <Text style={styles.label}>设备ID</Text>
        <TextInput value={deviceId} onChangeText={setDeviceId} style={styles.input} />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>选择标签</Text>
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

      <View style={styles.section}>
        <Text style={styles.label}>添加自定义标签</Text>
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
          <Text>提交标签</Text>
        </TouchableOpacity>
        {tagMessage ? <Text style={styles.hintText}>{tagMessage}</Text> : null}
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.secondary} onPress={testConnection}>
          <Text>连接测试</Text>
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
  page: { flex: 1, backgroundColor: "#f7f2ea" },
  content: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e4dccc",
    marginBottom: 8
  },
  tag: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4dccc",
    margin: 4
  },
  tagSelected: { backgroundColor: "#2e5d4b", borderColor: "#2e5d4b" },
  tagText: { fontSize: 12 },
  tagTextSelected: { color: "#fff" },
  primary: {
    backgroundColor: "#2e5d4b",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8
  },
  primaryText: { color: "#fff", fontWeight: "600" },
  secondary: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4dccc",
    alignItems: "center"
  },
  secondarySmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4dccc"
  },
  okText: { color: "#2e5d4b", marginTop: 6, fontSize: 12 },
  errorText: { color: "#b00020", marginTop: 6, fontSize: 12 },
  hintText: { color: "#666", marginTop: 4, fontSize: 12 },
  row: { flexDirection: "row", gap: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  flex: { flex: 1 },
  playerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e4dccc",
    marginBottom: 16
  },
  coverWrap: { alignItems: "center", marginBottom: 12 },
  cover: {
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "#2e5d4b",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 4
  },
  coverText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  playerTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  playerSub: { fontSize: 12, color: "#666", textAlign: "center", marginTop: 4 },
  progressWrap: { marginTop: 12 },
  progressTrack: {
    height: 6,
    backgroundColor: "#efe6d7",
    borderRadius: 999,
    overflow: "hidden"
  },
  progressFill: { height: 6, backgroundColor: "#2e5d4b" },
  progressTimeRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  progressText: { fontSize: 11, color: "#777" },
  controlsRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 12 },
  controlBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4dccc",
    backgroundColor: "#fff",
    alignItems: "center",
    marginHorizontal: 4
  },
  controlText: { fontSize: 12 },
  playBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 999,
    backgroundColor: "#2e5d4b",
    alignItems: "center",
    marginHorizontal: 4
  },
  playText: { color: "#fff", fontWeight: "600" },
  listItem: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e4dccc",
    marginBottom: 6
  },
  listTitle: { fontSize: 12, fontWeight: "700" },
  listSub: { fontSize: 11, color: "#666" },
  placeholder: { color: "#888", marginTop: 8 },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#e6ddce",
    backgroundColor: "#fff"
  },
  tabItem: { paddingVertical: 6, paddingHorizontal: 8 },
  tabText: { fontSize: 12, color: "#666" },
  tabTextActive: { color: "#2e5d4b", fontWeight: "700" },
  galaxyWrap: {
    height: 360,
    borderRadius: 16,
    backgroundColor: "#141622",
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
    backgroundColor: "rgba(93, 195, 255, 0.85)",
    borderRadius: 999,
    padding: 4
  },
  galaxyText: { fontSize: 10, color: "#0b1c2e", fontWeight: "700" },
  profileItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eadfce"
  },
  profileTitle: { fontSize: 14, fontWeight: "600" },
  profileSub: { fontSize: 12, color: "#666", marginTop: 4 },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f3e7e7"
  },
  removeText: { color: "#a33" }
});
