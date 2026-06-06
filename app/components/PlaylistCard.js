import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SongArtwork } from "./SongArtwork";

export const PlaylistCard = memo(function PlaylistCard({
  emptyText,
  expanded,
  onInsertPlaylist,
  onInsertSong,
  onToggle,
  playlist,
  songCountLabel,
  songs,
  songSubtitle
}) {
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <TouchableOpacity style={styles.mainAction} onPress={onToggle}>
          <Text style={styles.title}>{playlist.name}</Text>
          <Text style={styles.sub}>{songCountLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.insertButton} onPress={onInsertPlaylist}>
          <Text style={styles.insertText}>+</Text>
        </TouchableOpacity>
      </View>

      {expanded ? (
        <View style={styles.songList}>
          {songs.length === 0 ? (
            <Text style={styles.placeholder}>{emptyText}</Text>
          ) : songs.map((song) => (
            <TouchableOpacity key={String(playlist.id) + "-" + String(song.id)} style={styles.songItem} onPress={() => onInsertSong(song)}>
              <View style={styles.songMain}>
                <SongArtwork uri={song.cover_url} size={56} radius={18} label={song.title || "TPY"} />
                <View style={styles.songText}>
                  <Text style={styles.title}>{song.title || "Untitled"}</Text>
                  <Text style={styles.sub} numberOfLines={1}>{songSubtitle(song)}</Text>
                </View>
              </View>
              <Text style={styles.chevron}>{">"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12
  },
  row: {
    alignItems: "center",
    flexDirection: "row"
  },
  mainAction: {
    flex: 1,
    justifyContent: "center",
    minHeight: 48
  },
  insertButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    height: 48,
    justifyContent: "center",
    marginLeft: 12,
    width: 48
  },
  insertText: {
    color: "#111217",
    fontSize: 24,
    lineHeight: 24,
    marginTop: -2
  },
  songList: {
    marginTop: 10
  },
  songItem: {
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
  songMain: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row"
  },
  songText: {
    flex: 1,
    marginLeft: 12
  },
  title: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700"
  },
  sub: {
    color: "rgba(255,255,255,0.64)",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4
  },
  placeholder: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 14
  },
  chevron: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 20,
    marginLeft: 12
  }
});
