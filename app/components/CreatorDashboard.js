import React, { memo } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

function money(value) {
  const amount = Number(value || 0);
  return `$${amount.toFixed(2)}`;
}

function StatCell({ label, value }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CreatorSongRow({ song, onQueueSong }) {
  return (
    <TouchableOpacity style={styles.songRow} onPress={() => onQueueSong(song)}>
      <View style={styles.songArt}>
        <Text style={styles.songArtText}>{String(song.title || "V").slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.songText}>
        <Text style={styles.songTitle} numberOfLines={1}>{song.title || "Untitled"}</Text>
        <Text style={styles.songMeta} numberOfLines={1}>
          {`${Number(song.effective_plays || 0)} effective plays - ${money(song.estimated_revenue)}`}
        </Text>
      </View>
      <Text style={styles.songAction}>+</Text>
    </TouchableOpacity>
  );
}

export const CreatorDashboard = memo(function CreatorDashboard({
  dashboard,
  loading,
  error,
  onRefresh,
  onQueueSong
}) {
  const totals = dashboard?.totals || {};
  const songs = dashboard?.songs || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>CREATOR SIGNAL</Text>
          <Text style={styles.title}>创作者中心</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          {loading ? <ActivityIndicator color="#0E1420" /> : <Text style={styles.refreshText}>刷新</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.signalPanel}>
        <Text style={styles.panelLabel}>本期模拟分账</Text>
        <Text style={styles.revenueValue}>{money(totals.estimated_revenue)}</Text>
        <View style={styles.shareTrack}>
          <View style={[styles.shareFill, { width: "70%" }]} />
        </View>
        <View style={styles.shareRow}>
          <Text style={styles.shareText}>{`创作者 ${money(totals.creator_share)}`}</Text>
          <Text style={styles.shareText}>{`平台 ${money(totals.platform_share)}`}</Text>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.statsGrid}>
        <StatCell label="总播放" value={String(Number(totals.plays || 0))} />
        <StatCell label="有效播放" value={String(Number(totals.effective_plays || 0))} />
        <StatCell label="作品数" value={String(songs.length)} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>我的 AI 音乐</Text>
        <Text style={styles.sectionMeta}>只显示预估收益，不提供提现</Text>
      </View>

      {songs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>还没有可统计作品</Text>
          <Text style={styles.emptyText}>先在画像页生成音乐，后续有效播放会进入这里。</Text>
        </View>
      ) : songs.map((song) => (
        <CreatorSongRow key={String(song.id)} song={song} onQueueSong={onQueueSong} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 14,
    paddingBottom: 108
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  eyebrow: {
    color: "#8DA0B8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2
  },
  title: {
    color: "#F5F8FF",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4
  },
  refreshButton: {
    alignItems: "center",
    backgroundColor: "#BFE7FF",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 72,
    paddingHorizontal: 14
  },
  refreshText: {
    color: "#0E1420",
    fontSize: 14,
    fontWeight: "900"
  },
  signalPanel: {
    backgroundColor: "rgba(10, 16, 28, 0.86)",
    borderColor: "rgba(128, 212, 255, 0.26)",
    borderRadius: 8,
    borderWidth: 1,
    padding: 18
  },
  panelLabel: {
    color: "#91A7C2",
    fontSize: 13,
    fontWeight: "700"
  },
  revenueValue: {
    color: "#F8FEFF",
    fontSize: 42,
    fontWeight: "900",
    marginTop: 8
  },
  shareTrack: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 999,
    height: 8,
    marginTop: 18,
    overflow: "hidden"
  },
  shareFill: {
    backgroundColor: "#9AF7C8",
    height: "100%"
  },
  shareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10
  },
  shareText: {
    color: "#C9D8EA",
    fontSize: 12,
    fontWeight: "700"
  },
  errorText: {
    color: "#FF9AA8",
    fontSize: 13,
    fontWeight: "700"
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10
  },
  statCell: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    flex: 1,
    minHeight: 74,
    padding: 12
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900"
  },
  statLabel: {
    color: "#9EADC0",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4
  },
  sectionHeader: {
    marginTop: 8
  },
  sectionTitle: {
    color: "#F7FAFF",
    fontSize: 18,
    fontWeight: "900"
  },
  sectionMeta: {
    color: "#8FA1B7",
    fontSize: 12,
    marginTop: 4
  },
  emptyBox: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 8,
    padding: 16
  },
  emptyTitle: {
    color: "#F7FAFF",
    fontSize: 16,
    fontWeight: "900"
  },
  emptyText: {
    color: "#A9B8CA",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6
  },
  songRow: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    flexDirection: "row",
    minHeight: 72,
    padding: 10
  },
  songArt: {
    alignItems: "center",
    backgroundColor: "#1E2B40",
    borderRadius: 8,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  songArtText: {
    color: "#BFE7FF",
    fontSize: 18,
    fontWeight: "900"
  },
  songText: {
    flex: 1,
    marginLeft: 12
  },
  songTitle: {
    color: "#F7FAFF",
    fontSize: 15,
    fontWeight: "900"
  },
  songMeta: {
    color: "#9EADC0",
    fontSize: 12,
    marginTop: 4
  },
  songAction: {
    color: "#BFE7FF",
    fontSize: 28,
    fontWeight: "700",
    minWidth: 44,
    textAlign: "center"
  }
});
