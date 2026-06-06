import React, { memo } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

export const AuthScreen = memo(function AuthScreen({
  accountId,
  accountName,
  accountPassword,
  accountPasswordConfirm,
  avatars,
  backdrop,
  language,
  loading,
  mode,
  onAccountIdChange,
  onAccountNameChange,
  onAccountPasswordChange,
  onAccountPasswordConfirmChange,
  onAvatarChange,
  onModeChange,
  onSubmit,
  selectedAvatar,
  t
}) {
  const isRegister = mode === "register";

  return (
    <SafeAreaView style={styles.page}>
      {backdrop}
      <ScrollView contentContainerStyle={styles.authShell} showsVerticalScrollIndicator={false}>
        <View style={styles.authCard}>
          <View style={styles.authModeRow}>
            <TouchableOpacity
              style={[styles.authMode, mode === "login" && styles.authModeActive]}
              onPress={() => onModeChange("login")}
            >
              <Text style={[styles.authModeText, mode === "login" && styles.authModeTextActive]}>
                {language === "en" ? "Login" : "\u767b\u5f55"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.authMode, isRegister && styles.authModeActive]}
              onPress={() => onModeChange("register")}
            >
              <Text style={[styles.authModeText, isRegister && styles.authModeTextActive]}>
                {language === "en" ? "Register" : "\u6ce8\u518c"}
              </Text>
            </TouchableOpacity>
          </View>

          {isRegister ? (
            <>
              <TextInput
                value={accountName}
                onChangeText={onAccountNameChange}
                placeholder={t("username")}
                placeholderTextColor="#B9C2CE"
                style={styles.input}
              />
              <Text style={styles.avatarPickerLabel}>{t("chooseAvatar")}</Text>
              <View style={styles.avatarPickerRow}>
                {avatars.map((avatar) => (
                  <TouchableOpacity
                    key={avatar}
                    style={[styles.avatarChip, selectedAvatar === avatar && styles.avatarChipActive]}
                    onPress={() => onAvatarChange(avatar)}
                  >
                    <Text style={styles.avatarChipText}>{avatar}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}

          <TextInput
            value={accountId}
            onChangeText={onAccountIdChange}
            placeholder={t("accountId")}
            placeholderTextColor="#B9C2CE"
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            value={accountPassword}
            onChangeText={onAccountPasswordChange}
            placeholder={t("password")}
            placeholderTextColor="#B9C2CE"
            secureTextEntry
            style={styles.input}
          />
          {isRegister ? (
            <TextInput
              value={accountPasswordConfirm}
              onChangeText={onAccountPasswordConfirmChange}
              placeholder={t("confirmPassword")}
              placeholderTextColor="#B9C2CE"
              secureTextEntry
              style={styles.input}
            />
          ) : null}
          <TouchableOpacity style={styles.primary} onPress={onSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>{mode === "login" ? t("loginRestore") : t("registerContinue")}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#0B1018",
    flex: 1
  },
  authShell: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20
  },
  authCard: {
    backgroundColor: "rgba(12,18,28,0.76)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 30,
    borderWidth: 1,
    elevation: 10,
    padding: 22,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 28
  },
  authModeRow: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    flexDirection: "row",
    marginBottom: 14,
    padding: 4
  },
  authMode: {
    alignItems: "center",
    borderRadius: 14,
    flex: 1,
    paddingVertical: 10
  },
  authModeActive: {
    backgroundColor: "rgba(255,255,255,0.14)"
  },
  authModeText: {
    color: "rgba(255,255,255,0.56)",
    fontWeight: "700"
  },
  authModeTextActive: {
    color: "#FFFFFF"
  },
  avatarPickerLabel: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 2
  },
  avatarPickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12
  },
  avatarChip: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    marginBottom: 10,
    marginRight: 10,
    width: 44
  },
  avatarChipActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.3)"
  },
  avatarChipText: {
    fontSize: 22
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
