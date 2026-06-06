import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SongArtwork } from "./SongArtwork";

function QueueSkeleton({ standalone = false }) {
  return (
    <View style={standalone ? styles.skeletonStandalone : [styles.listItem, styles.skeletonItem]}>
      <View style={styles.songListMain}>
        <View style={styles.skeletonArtwork} />
        <View style={styles.songListText}>
          <View style={[styles.skeletonLine, styles.skeletonLinePrimary]} />
          <View style={[styles.skeletonLine, styles.skeletonLineSecondary]} />
        </View>
      </View>
    </View>
  );
}

export const PlaybackQueue = memo(function PlaybackQueue({
  current,
  emptyText,
  getQueueKey,
  getSongSubtitle,
  items,
  onPlay,
  showSkeleton
}) {
  if (!items?.length) {
    return (
      <View style={styles.emptyBox}>
        {showSkeleton ? <QueueSkeleton standalone /> : <Text style={styles.placeholder}>{emptyText}</Text>}
      </View>
    );
  }

  const currentKey = getQueueKey(current);

  return (
    <View style={[styles.viewport, styles.content]}>
      {items.map((item) => {
        const itemKey = getQueueKey(item);
        return (
          <TouchableOpacity
            key={String(itemKey)}
            style={[styles.listItem, currentKey === itemKey && styles.currentItem]}
            onPress={() => onPlay(item)}
          >
            <View style={styles.songListMain}>
              <SongArtwork uri={item.cover_url} size={56} radius={18} label={item.title || "TPY"} />
              <View style={styles.songListText}>
                <Text style={styles.listTitle}>{item.title || "Untitled"}</Text>
                <Text style={styles.listSub} numberOfLines={1}>{getSongSubtitle(item)}</Text>
              </View>
            </View>
            <Text style={styles.chevron}>{">"}</Text>
          </TouchableOpacity>
        );
      })}
      {showSkeleton ? <QueueSkeleton /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  viewport: {
    maxHeight: 392,
    position: "relative"
  },
  content: {
    paddingBottom: 4
  },
  listItem: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    padding: 16
  },
  currentItem: {
    borderColor: "rgba(255,255,255,0.28)"
  },
  emptyBox: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    padding: 14
  },
  placeholder: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 14
  },
  skeletonItem: {
    opacity: 0.78
  },
  skeletonStandalone: {
    alignItems: "center",
    flexDirection: "row"
  },
  skeletonArtwork: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    height: 56,
    width: 56
  },
  skeletonLine: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999
  },
  skeletonLinePrimary: {
    height: 16,
    width: "72%"
  },
  skeletonLineSecondary: {
    height: 12,
    marginTop: 10,
    width: "54%"
  },
  songListMain: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row"
  },
  songListText: {
    flex: 1,
    marginLeft: 12
  },
  listTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700"
  },
  listSub: {
    color: "rgba(255,255,255,0.64)",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4
  },
  chevron: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 20,
    marginLeft: 12
  }
});
