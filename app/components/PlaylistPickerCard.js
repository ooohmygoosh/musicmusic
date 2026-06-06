import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export const PlaylistPickerCard = memo(function PlaylistPickerCard({
  cancelLabel,
  getSongsCountLabel,
  onCancel,
  onSelect,
  playlists,
  title
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {playlists.map((playlist) => (
        <TouchableOpacity key={playlist.id} style={styles.listItem} onPress={() => onSelect(playlist)}>
          <View>
            <Text style={styles.listTitle}>{playlist.name}</Text>
            <Text style={styles.listSub}>{getSongsCountLabel(playlist.song_count || 0)}</Text>
          </View>
          <Text style={styles.chevron}>{">"}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.secondarySoft} onPress={onCancel}>
        <Text style={styles.secondaryText}>{cancelLabel}</Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(11,17,27,0.58)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 18,
    padding: 18
  },
  title: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginBottom: 12
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
  secondarySoft: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14
  },
  secondaryText: {
    color: "#F8FAFD",
    fontSize: 14,
    fontWeight: "700"
  }
});
