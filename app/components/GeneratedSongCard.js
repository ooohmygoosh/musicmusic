import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SongArtwork } from "./SongArtwork";

export const GeneratedSongCard = memo(function GeneratedSongCard({
  availabilityText,
  createdAtText,
  metadataText,
  onPress,
  song,
  subtitle
}) {
  return (
    <View style={styles.box}>
      <TouchableOpacity style={styles.listItem} onPress={onPress}>
        <View style={styles.songListMain}>
          <SongArtwork uri={song.cover_url} size={56} radius={18} label={song.title || "TPY"} />
          <View style={styles.songListText}>
            <Text style={styles.listTitle}>{song.title || "Untitled"}</Text>
            <Text style={styles.listSub} numberOfLines={1}>{subtitle}</Text>
            <Text style={styles.listSub} numberOfLines={1}>{availabilityText}</Text>
          </View>
        </View>
        <Text style={styles.chevron}>{">"}</Text>
      </TouchableOpacity>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{metadataText}</Text>
        <Text style={styles.metaText}>{createdAtText}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10,
    padding: 10
  },
  listItem: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
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
  },
  metaRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginTop: 10,
    paddingHorizontal: 4
  },
  metaText: {
    color: "rgba(255,255,255,0.64)",
    flex: 1,
    fontSize: 12
  }
});
