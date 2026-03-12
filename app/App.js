import React, { useEffect, useMemo, useState } from "react";
import { SafeAreaView, View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet } from "react-native";
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

export default function App() {
  const [deviceId, setDeviceId] = useState("demo-device");
  const [userId, setUserId] = useState(null);
  const [tags, setTags] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [songs, setSongs] = useState([]);
  const [current, setCurrent] = useState(null);
  const [sound, setSound] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/tags`)
      .then((r) => r.json())
      .then((d) => setTags(d.items || []))
      .catch(() => setTags([]));
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

  const generate = async () => {
    const uid = userId || (await ensureUser());
    await fetch(`${API_BASE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: uid, instrumental: true })
    });
    await refreshSongs(uid);
  };

  const refreshSongs = async (uid = userId) => {
    if (!uid) return;
    const res = await fetch(`${API_BASE}/songs?user_id=${uid}`);
    const data = await res.json();
    setSongs(data.items || []);
    if (data.items && data.items.length > 0) {
      setCurrent(data.items[0]);
    }
  };

  const play = async (song) => {
    if (!song?.audio_url) return;
    if (sound) await sound.unloadAsync();
    const { sound: nextSound } = await Audio.Sound.createAsync(
      { uri: song.audio_url },
      { shouldPlay: true }
    );
    setSound(nextSound);
  };

  const feedback = async (action) => {
    if (!userId || !current) return;
    await fetch(`${API_BASE}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, song_id: current.id, action })
    });
    await refreshSongs(userId);
  };

  return (
    <SafeAreaView style={styles.page}>
      <Text style={styles.title}>TPY 音乐生成</Text>

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
          renderItem={({ item }) => (
            <TagChip tag={item} selected={selected.has(item.id)} onPress={toggleTag} />
          )}
        />
        <TouchableOpacity style={styles.primary} onPress={initTags}>
          <Text style={styles.primaryText}>初始化标签池</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.primary} onPress={generate}>
          <Text style={styles.primaryText}>生成音乐</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>当前歌曲</Text>
        {current ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>#{current.id}</Text>
            <Text style={styles.cardSub}>{current.prompt}</Text>
            <View style={styles.row}>
              <TouchableOpacity style={styles.secondary} onPress={() => play(current)}>
                <Text>播放</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondary} onPress={() => feedback("like")}>
                <Text>收藏</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondary} onPress={() => feedback("skip")}>
                <Text>跳过</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={styles.placeholder}>暂无歌曲</Text>
        )}
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.secondary} onPress={() => refreshSongs()}>
          <Text>刷新歌曲列表</Text>
        </TouchableOpacity>
        <FlatList
          data={songs}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <Text style={styles.listItem}>#{item.id} {item.prompt}</Text>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 16, backgroundColor: "#f7f2ea" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  section: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e4dccc"
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
    borderColor: "#e4dccc"
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e4dccc"
  },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardSub: { fontSize: 12, color: "#666", marginVertical: 6 },
  row: { flexDirection: "row", gap: 8 },
  placeholder: { color: "#888" },
  listItem: { fontSize: 12, marginVertical: 2 }
});
