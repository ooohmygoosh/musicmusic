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
  Alert,
  PanResponder
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

function GalaxyNode({ node, onDrop }) {
  const pan = useRef(new Animated.ValueXY({ x: node.baseX, y: node.baseY })).current;
  const bobX = useRef(new Animated.Value(0)).current;
  const bobY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    Animated.createAnimatedComponent({})
  );

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bobX, { toValue: node.driftX, duration: 7000, useNativeDriver: false }),
        Animated.timing(bobX, { toValue: -node.driftX, duration: 7000, useNativeDriver: false })
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(bobY, { toValue: node.driftY, duration: 8000, useNativeDriver: false }),
        Animated.timing(bobY, { toValue: -node.driftY, duration: 8000, useNativeDriver: false })
      ])
    ).start();
  }, [bobX, bobY, node.driftX, node.driftY]);

  const responder = useRef(
    Animated.createAnimatedComponent({})
  );

  const onPanResponderMove = (_, gesture) => {
    pan.setValue({ x: node.baseX + gesture.dx, y: node.baseY + gesture.dy });
  };

  const onPanResponderRelease = (_, gesture) => {
    const finalX = node.baseX + gesture.dx + node.size / 2;
    const finalY = node.baseY + gesture.dy + node.size / 2;
    const action = onDrop(finalX, finalY, node.tag);
    if (!action) {
      Animated.spring(pan, {
        toValue: { x: node.baseX, y: node.baseY },
        useNativeDriver: false
      }).start();
    }
  };

  const handlers = useRef(
    Animated.createAnimatedComponent({})
  );

  const responderHandlers = useRef(
    Animated.createAnimatedComponent({})
  );

  const panHandlers = useRef(
    Animated.createAnimatedComponent({})
  );

  const responderRef = useRef(
    require("react-native").PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove,
      onPanResponderRelease
    })
  ).current;

  return (
    <Animated.View
      {...responderRef.panHandlers}
      style={[
        styles.galaxyNode,
        {
          width: node.size,
          height: node.size,
          borderRadius: node.size / 2,
          transform: [
            { translateX: Animated.add(pan.x, bobX) },
            { translateY: Animated.add(pan.y, bobY) }
          ]
        }
      ]}
    >
      <View style={styles.galaxyInner}>
        <Text style={styles.galaxyText}>{node.tag.name}</Text>
      </View>
    </Animated.View>
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
  const [playlists, setPlaylists] = useState([]);
  const [playlistSongs, setPlaylistSongs] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [current, setCurrent] = useState(null);
  const [sound, setSound] = useState(null);
  const [currentSoundId, setCurrentSoundId] = useState(null);
  const [playback, setPlayback] = useState({ position: 0, duration: 1, isPlaying: false });
  const [newTagName, setNewTagName] = useState("");
  const [newTagType, setNewTagType] = useState("");
  const [tagMessage, setTagMessage] = useState("");
  const [profileTags, setProfileTags] = useState([]);
  const [galaxyNodes, setGalaxyNodes] = useState([]);
  const [showQueue, setShowQueue] = useState(false);
  const [deleteZone, setDeleteZone] = useState(null);
  const [weakenZone, setWeakenZone] = useState(null);
  const [boostZone, setBoostZone] = useState(null);
  const [favoriting, setFavoriting] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [progressLayout, setProgressLayout] = useState(null);

  const completeSentFor = useRef(null);
  const autoNextLock = useRef(false);
  const progressTrackRef = useRef(null);

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
    await loadProfileTags();
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
    await fetch(`${API_BASE}/user-tags/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, tag_id: tag.tag_id })
    });
    await loadProfileTags();
  };

  const weakenProfileTag = async (tag) => {
    if (!userId) return;
    const nextWeight = Math.max(0, Number(tag.weight || 0) * 0.5);
    await fetch(`${API_BASE}/user-tags/weight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, tag_id: tag.tag_id, weight: nextWeight })
    });
    await loadProfileTags();
  };

  const boostProfileTag = async (tag) => {
    if (!userId) return;
    const nextWeight = Math.min(1, Number(tag.weight || 0) * 1.25 + 0.05);
    await fetch(`${API_BASE}/user-tags/weight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, tag_id: tag.tag_id, weight: nextWeight })
    });
    await loadProfileTags();
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
    const seen = new Set();
    const deduped = items.filter((item) => {
      const key = item.id || item.audio_url;
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const ordered = [...deduped].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
    setSongs(ordered);
    if (options.setCurrent && ordered.length > 0) {
      setCurrent(ordered[ordered.length - 1]);
    }
    if (!current && ordered.length > 0) {
      setCurrent(ordered[0]);
    }
    return ordered;
  };

  const refreshFavorites = async (uid = userId) => {
    if (!uid) return [];
    const res = await fetch(`${API_BASE}/favorites?user_id=${uid}`);
    const data = await res.json();
    const items = data.items || [];
    setFavorites(items);
    return items;
  };

  const loadPlaylists = async (uid = userId) => {
    if (!uid) return [];
    const res = await fetch(`${API_BASE}/playlists?user_id=${uid}`);
    const data = await res.json();
    const items = data.items || [];
    setPlaylists(items);
    return items;
  };

  const createPlaylist = async () => {
    if (!userId || !newPlaylistName.trim()) return;
    await fetch(`${API_BASE}/playlists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, name: newPlaylistName.trim() })
    });
    setNewPlaylistName("");
    await loadPlaylists();
  };

  const loadPlaylistSongs = async (playlistId) => {
    if (!playlistId) return;
    const res = await fetch(`${API_BASE}/playlists/${playlistId}/songs`);
    const data = await res.json();
    setPlaylistSongs(data.items || []);
  };

  const addToPlaylist = async () => {
    if (!current || !selectedPlaylistId) return;
    await fetch(`${API_BASE}/playlists/${selectedPlaylistId}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ song_id: current.id })
    });
    await loadPlaylistSongs(selectedPlaylistId);
  };

  const addSongToPlaylist = async (playlistId, song = current) => {
    if (!song || !playlistId) return;
    await fetch(`${API_BASE}/playlists/${playlistId}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ song_id: song.id })
    });
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
    if (!current) {
      await generate();
      return;
    }
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

  const handleNext = async () => {
    if (!current) return;
    const index = songs.findIndex((s) => s.id === current.id);
    if (index >= 0 && index < songs.length - 1) {
      const next = songs[index + 1];
      setCurrent(next);
      await play(next);
      return;
    }
    await handleAutoNext("skip");
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
        await play(items[items.length - 1]);
      }
    } finally {
      autoNextLock.current = false;
    }
  };

  useEffect(() => {
    if (activeTab === "favorites") {
      const uid = userId;
      if (uid) {
        refreshFavorites(uid).catch(() => {});
        loadPlaylists(uid).catch(() => {});
      }
    }
    if (activeTab === "galaxy") {
      const uid = userId;
      if (uid) loadProfileTags(uid).catch(() => {});
    }
  }, [activeTab, userId]);

  useEffect(() => {
    const height = 360;
    const nodes = profileTags.map((tag) => {
      const size = 16 + Math.max(0, Math.min(1, Number(tag.weight || 0))) * 52;
      const startX = Math.random() * (width - size - 20) + 10;
      const startY = Math.random() * (height - size - 20) + 10;
      return {
        tag,
        size,
        baseX: startX,
        baseY: startY,
        driftX: (Math.random() - 0.5) * 40,
        driftY: (Math.random() - 0.5) * 30
      };
    });
    setGalaxyNodes(nodes);
  }, [profileTags, width]);

  const handleDrop = (x, y, tag) => {
    if (deleteZone && x >= deleteZone.x && x <= deleteZone.x + deleteZone.width && y >= deleteZone.y && y <= deleteZone.y + deleteZone.height) {
      removeProfileTag(tag);
      return "delete";
    }
    if (weakenZone && x >= weakenZone.x && x <= weakenZone.x + weakenZone.width && y >= weakenZone.y && y <= weakenZone.y + weakenZone.height) {
      weakenProfileTag(tag);
      return "weaken";
    }
    if (boostZone && x >= boostZone.x && x <= boostZone.x + boostZone.width && y >= boostZone.y && y <= boostZone.y + boostZone.height) {
      boostProfileTag(tag);
      return "boost";
    }
    return null;
  };

  const progressPercent = Math.min(1, (playback.position || 0) / (playback.duration || 1));
  const progressResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        if (!progressLayout || !sound || !current) return;
        const localX = Math.min(
          progressLayout.width,
          Math.max(0, gesture.moveX - progressLayout.pageX)
        );
        const percent = progressLayout.width > 0 ? localX / progressLayout.width : 0;
        const nextPos = Math.floor(percent * (playback.duration || 0));
        setPlayback((prev) => ({ ...prev, position: nextPos }));
      },
      onPanResponderRelease: async (_, gesture) => {
        if (!progressLayout || !sound || !current) return;
        const localX = Math.min(
          progressLayout.width,
          Math.max(0, gesture.moveX - progressLayout.pageX)
        );
        const percent = progressLayout.width > 0 ? localX / progressLayout.width : 0;
        const nextPos = Math.floor(percent * (playback.duration || 0));
        await sound.setPositionAsync(nextPos);
      }
    })
  ).current;

  const renderPlayer = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.screenPadding}>
      <ScreenTitle title="现在播放" subtitle="你的 AI 音乐正在流动" />

      <View style={styles.playerCard}>
        <View style={styles.coverWrap}>
          <View style={styles.cover}>
            <Text style={styles.coverText}>TPY</Text>
          </View>
        </View>
        <Text style={styles.playerTitle}>{current ? current.title || "AI 生成曲" : "暂无歌曲"}</Text>
        <Text style={styles.playerSub} numberOfLines={2}>
          {current ? current.prompt : "请先生成音乐"}
        </Text>

        <View style={styles.progressWrap}>
          <View
            ref={progressTrackRef}
            style={styles.progressTrack}
            onLayout={() => {
              if (!progressTrackRef.current) return;
              progressTrackRef.current.measure((x, y, width, height, pageX, pageY) => {
                setProgressLayout({ width, pageX, pageY });
              });
            }}
            {...progressResponder.panHandlers}
          >
            <View style={[styles.progressFill, { width: `${progressPercent * 100}%` }]} />
          </View>
          <View style={styles.progressTimeRow}>
            <Text style={styles.progressText}>{formatTime(playback.position)}</Text>
            <Text style={styles.progressText}>{formatTime(playback.duration)}</Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={async () => {
              if (!current || favoriting) return;
              setFavoriting(true);
              try {
                const uid = userId || (await ensureUser());
                await feedback("like");
                const list = await loadPlaylists(uid);
                if (list.length === 0) {
                  Alert.alert("暂无歌单", "请先创建歌单", [
                    { text: "去创建", onPress: () => setActiveTab("favorites") },
                    { text: "取消", style: "cancel" }
                  ]);
                  return;
                }
                setShowPlaylistPicker(true);
              } finally {
                setFavoriting(false);
              }
            }}
          >
            <Text style={styles.controlText}>收藏</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
            <Text style={styles.playText}>{current ? (playback.isPlaying ? "暂停" : "播放") : "生成"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={handleNext}>
            <Text style={styles.controlText}>下一曲</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showPlaylistPicker ? (
        <View style={styles.section}>
          <View style={styles.groupCard}>
            <Text style={styles.groupTitle}>选择歌单</Text>
            {playlists.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.listItem}
                onPress={async () => {
                  await addSongToPlaylist(p.id);
                  if (selectedPlaylistId === p.id) {
                    await loadPlaylistSongs(p.id);
                  }
                  setShowPlaylistPicker(false);
                }}
              >
                <View>
                  <Text style={styles.listTitle}>{p.name}</Text>
                  <Text style={styles.listSub}>歌曲 {p.song_count || 0}</Text>
                </View>
                <Text style={styles.chevron}>?</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.secondary} onPress={() => setShowPlaylistPicker(false)}>
              <Text style={styles.secondaryText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <TouchableOpacity style={styles.secondary} onPress={() => setShowQueue((prev) => !prev)}>
          <Text style={styles.secondaryText}>{showQueue ? "收起播放列表" : "展开播放列表"}</Text>
        </TouchableOpacity>
        {showQueue ? (
          <FlatList
            data={songs}
            keyExtractor={(item) => String(item.id)}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.listItem}
                onPress={async () => {
                  setCurrent(item);
                  await play(item);
                }}
              >
                <View>
                  <Text style={styles.listTitle}>{item.title || "AI 生成曲"}</Text>
                  <Text style={styles.listSub} numberOfLines={1}>{item.prompt}</Text>
                </View>
                <Text style={styles.chevron}>?</Text>
              </TouchableOpacity>
            )}
          />
        ) : null}
      </View>
    </ScrollView>
  );

  const renderFavorites = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.screenPadding}>
      <ScreenTitle title="收藏歌单" subtitle="创建你的专属歌单" />

      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>新建歌单</Text>
        <TextInput
          value={newPlaylistName}
          onChangeText={setNewPlaylistName}
          placeholder="歌单名称"
          style={styles.input}
        />
        <TouchableOpacity style={styles.primary} onPress={createPlaylist}>
          <Text style={styles.primaryText}>创建歌单</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>我的歌单</Text>
        {playlists.map((plist) => (
          <TouchableOpacity
            key={plist.id}
            style={styles.listItem}
            onPress={() => {
              setSelectedPlaylistId(plist.id);
              loadPlaylistSongs(plist.id);
            }}
          >
            <View>
              <Text style={styles.listTitle}>{plist.name}</Text>
              <Text style={styles.listSub}>歌曲 {plist.song_count || 0}</Text>
            </View>
            <Text style={styles.chevron}>?</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedPlaylistId ? (
        <View style={styles.groupCard}>
          <Text style={styles.groupTitle}>当前歌单</Text>
          <TouchableOpacity style={styles.secondary} onPress={addToPlaylist}>
            <Text style={styles.secondaryText}>把当前歌曲加入歌单</Text>
          </TouchableOpacity>
          {playlistSongs.length === 0 ? (
            <Text style={styles.placeholder}>暂无歌曲</Text>
          ) : (
            playlistSongs.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.listItem}
                onPress={async () => {
                  setCurrent(item);
                  await play(item);
                }}
              >
                <View>
                  <Text style={styles.listTitle}>{item.title || "AI 生成曲"}</Text>
                  <Text style={styles.listSub} numberOfLines={1}>{item.prompt}</Text>
                </View>
                <Text style={styles.chevron}>?</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : null}

      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>收藏记录</Text>
        {favorites.length === 0 ? (
          <Text style={styles.placeholder}>暂无收藏歌曲</Text>
        ) : (
          favorites.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.listItem}
              onPress={async () => {
                setCurrent(item);
                await play(item);
              }}
            >
              <View>
                <Text style={styles.listTitle}>{item.title || "AI 生成曲"}</Text>
                <Text style={styles.listSub} numberOfLines={1}>{item.prompt}</Text>
              </View>
              <Text style={styles.chevron}>?</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderGalaxy = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.screenPadding}>
      <ScreenTitle title="标签画像" subtitle="星系代表你的喜好分布" />
      <Text style={styles.hintText}>拖动星球到删除区可移除标签，拖到弱化区可降低权重，拖到增强区可提升权重</Text>

      <View style={styles.galaxyWrap}>
        <View style={styles.galaxyControls}>
          <View
            style={styles.galaxyZoneDelete}
            onLayout={(event) => setDeleteZone(event.nativeEvent.layout)}
          >
            <Text style={styles.zoneText}>删除区</Text>
          </View>
          <View
            style={styles.galaxyZoneWeaken}
            onLayout={(event) => setWeakenZone(event.nativeEvent.layout)}
          >
            <Text style={styles.zoneText}>弱化区</Text>
          </View>
          <View
            style={styles.galaxyZoneBoost}
            onLayout={(event) => setBoostZone(event.nativeEvent.layout)}
          >
            <Text style={styles.zoneText}>增强区</Text>
          </View>
        </View>
        {galaxyNodes.map((node) => (
          <GalaxyNode key={node.tag.tag_id} node={node} onDrop={handleDrop} />
        ))}
      </View>

      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>标签管理</Text>
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
    </ScrollView>
  );

  const renderSettings = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.screenPadding}>
      <ScreenTitle title="设置" subtitle="账号与连接信息" />
      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>设备信息</Text>
        <TextInput value={deviceId} onChangeText={setDeviceId} style={styles.input} />
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
  galaxyControls: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  galaxyZoneDelete: {
    flex: 1,
    marginRight: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#3A0E11",
    alignItems: "center"
  },
  galaxyZoneWeaken: {
    flex: 1,
    marginHorizontal: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#1C2B3A",
    alignItems: "center"
  },
  galaxyZoneBoost: {
    flex: 1,
    marginLeft: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#17311F",
    alignItems: "center"
  },
  zoneText: { color: "#fff", fontWeight: "600" },
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


















