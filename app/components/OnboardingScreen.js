import React, { memo } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

function ScreenTitle({ title, subtitle }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function SeedTag({ item, selected, onPress }) {
  return (
    <TouchableOpacity onPress={() => onPress(item)} style={[styles.seedTag, selected && styles.seedTagSelected]}>
      <Text style={[styles.seedType, selected && styles.seedTypeSelected]}>{item.type}</Text>
      <Text style={[styles.seedName, selected && styles.seedNameSelected]}>{item.name}</Text>
    </TouchableOpacity>
  );
}

export const OnboardingScreen = memo(function OnboardingScreen({
  backdrop,
  currentGroup,
  groupCount,
  onBack,
  onNext,
  onSubmit,
  onToggleSeed,
  seedSelection,
  step,
  t
}) {
  const safeGroupCount = Math.max(1, groupCount || 0);
  const currentStep = Math.min(step + 1, groupCount || 1);
  const progress = `${(currentStep / safeGroupCount) * 100}%`;

  return (
    <SafeAreaView style={styles.page}>
      {backdrop}
      <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>
        <ScreenTitle title={t("pickInitialTags")} subtitle={t("pickInitialTagsSub")} />
        <View style={styles.groupCard}>
          <View style={styles.onboardingProgressHeader}>
            <Text style={styles.groupTitle}>{currentGroup ? currentGroup[0] : t("done")}</Text>
            <Text style={styles.hintText}>
              {t("stepLabel", { current: currentStep, total: safeGroupCount })}
            </Text>
          </View>
          <View style={styles.onboardingProgressTrack}>
            <View style={[styles.onboardingProgressFill, { width: progress }]} />
          </View>
          {currentGroup ? (
            <View style={styles.seedWrap}>
              {currentGroup[1].map((item) => (
                <SeedTag
                  key={item.id}
                  item={item}
                  selected={seedSelection.has(item.id)}
                  onPress={onToggleSeed}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.placeholder}>{t("allCategoriesCompleted")}</Text>
          )}
          <View style={styles.rowGap}>
            <TouchableOpacity style={[styles.secondarySoft, styles.flex]} onPress={onBack}>
              <Text style={styles.secondaryText}>{t("back")}</Text>
            </TouchableOpacity>
            {step < groupCount - 1 ? (
              <TouchableOpacity style={[styles.primary, styles.flex]} onPress={onNext}>
                <Text style={styles.primaryText}>{t("next")}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.primary, styles.flex]} onPress={onSubmit}>
                <Text style={styles.primaryText}>{t("enterApp")}</Text>
              </TouchableOpacity>
            )}
          </View>
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
  screenPadding: {
    paddingBottom: 120,
    paddingHorizontal: 18,
    paddingTop: 12
  },
  titleBlock: {
    marginBottom: 18
  },
  title: {
    color: "#F3F6FA",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.9
  },
  subtitle: {
    color: "rgba(232,238,246,0.74)",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8
  },
  groupCard: {
    backgroundColor: "rgba(11,17,27,0.58)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 18,
    padding: 18
  },
  groupTitle: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginBottom: 12
  },
  onboardingProgressHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  onboardingProgressTrack: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    height: 10,
    marginBottom: 16,
    overflow: "hidden"
  },
  onboardingProgressFill: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    height: 10
  },
  seedWrap: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  seedTag: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    marginBottom: 8,
    marginRight: 8,
    minWidth: 110,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  seedTagSelected: {
    backgroundColor: "rgba(255,255,255,0.92)"
  },
  seedType: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 5
  },
  seedTypeSelected: {
    color: "rgba(17,18,23,0.6)"
  },
  seedName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800"
  },
  seedNameSelected: {
    color: "#111217"
  },
  placeholder: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 14
  },
  rowGap: {
    flexDirection: "row",
    gap: 10
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
  },
  hintText: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10
  },
  flex: {
    flex: 1
  }
});
