import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export const BottomTabBar = memo(function BottomTabBar({
  activeTab,
  onTabPress,
  tabs
}) {
  return (
    <View style={styles.shell}>
      <View style={styles.bar}>
        {tabs.map((tab) => (
          <TouchableOpacity key={tab.key} style={styles.item} onPress={() => onTabPress(tab.key)}>
            <Text style={[styles.text, activeTab === tab.key && styles.textActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  shell: {
    alignItems: "center",
    bottom: 12,
    left: 0,
    position: "absolute",
    right: 0
  },
  bar: {
    backgroundColor: "rgba(14,18,28,0.86)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 12,
    width: "92%"
  },
  item: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingVertical: 8
  },
  text: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 12,
    fontWeight: "600"
  },
  textActive: {
    color: "#FFFFFF",
    fontWeight: "800"
  }
});
