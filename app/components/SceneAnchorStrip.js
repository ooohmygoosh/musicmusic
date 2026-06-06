import React, { memo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export const SceneAnchorStrip = memo(function SceneAnchorStrip({
  activeAnchor,
  label,
  onSelect,
  sceneOptions
}) {
  const activeId = Number(activeAnchor?.tag_id || activeAnchor?.id || 0);

  return (
    <View style={styles.strip}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {sceneOptions.length > 0 ? sceneOptions.map((tag) => {
          const selected = activeId === Number(tag.id);
          return (
            <TouchableOpacity
              key={String(tag.id)}
              style={[styles.chip, selected && styles.chipActive]}
              onPress={() => onSelect(tag)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{tag.name}</Text>
            </TouchableOpacity>
          );
        }) : [0, 1, 2].map((index) => (
          <View key={`scene-skeleton-${index}`} style={styles.chipSkeleton} />
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  strip: {
    backgroundColor: "rgba(11,17,27,0.58)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 12,
    padding: 18
  },
  label: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12
  },
  chipRow: {
    gap: 10,
    paddingRight: 10
  },
  chip: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  chipActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF"
  },
  chipText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "700"
  },
  chipTextActive: {
    color: "#0B111B"
  },
  chipSkeleton: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    height: 38,
    width: 82
  }
});
