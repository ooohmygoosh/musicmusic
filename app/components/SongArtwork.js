import React, { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

export const SongArtwork = memo(function SongArtwork({ uri, size = 56, radius, label = "TPY" }) {
  const borderRadius = radius ?? Math.round(size * 0.18);
  const textLabel = String(label || "TPY").slice(0, 3);

  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius }]}>
      {uri ? (
        <Image source={{ uri }} style={[styles.image, { borderRadius }]} resizeMode="cover" />
      ) : (
        <View style={[styles.placeholder, { borderRadius }]}>
          <View style={styles.glowA} />
          <View style={styles.glowB} />
          <View style={styles.glowC} />
          <Text style={[styles.label, { fontSize: Math.max(16, Math.round(size * 0.16)) }]}>{textLabel}</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    backgroundColor: "#18181C",
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    overflow: "hidden"
  },
  image: {
    height: "100%",
    width: "100%"
  },
  placeholder: {
    alignItems: "center",
    backgroundColor: "#18181C",
    flex: 1,
    justifyContent: "center",
    overflow: "hidden"
  },
  glowA: {
    backgroundColor: "#4E67C8",
    borderRadius: 999,
    height: "76%",
    position: "absolute",
    right: -10,
    top: -18,
    width: "76%"
  },
  glowB: {
    backgroundColor: "#F19472",
    borderRadius: 999,
    bottom: -14,
    height: "58%",
    left: -10,
    position: "absolute",
    width: "58%"
  },
  glowC: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    height: "34%",
    left: "24%",
    position: "absolute",
    top: "30%",
    width: "34%"
  },
  label: {
    color: "#FFFFFF",
    fontWeight: "800",
    letterSpacing: 0.8
  }
});
