import React, { memo } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export const NewPlaylistCard = memo(function NewPlaylistCard({
  buttonLabel,
  onChangeName,
  onCreate,
  placeholder,
  title,
  value
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeName}
        placeholder={placeholder}
        placeholderTextColor="#B9C2CE"
        style={styles.input}
      />
      <TouchableOpacity style={styles.primary} onPress={onCreate}>
        <Text style={styles.primaryText}>{buttonLabel}</Text>
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
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    color: "#FFFFFF",
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 15
  },
  primary: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 20,
    elevation: 8,
    marginTop: 6,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 20
  },
  primaryText: {
    color: "#111217",
    fontSize: 15,
    fontWeight: "800"
  }
});
