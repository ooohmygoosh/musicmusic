import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SongArtwork } from "./SongArtwork";

export const NowPlayingCard = memo(function NowPlayingCard({
  current,
  displayedPosition,
  duration,
  emptyActionText,
  favoriteLabel,
  formatTime,
  nextLabel,
  onFavorite,
  onNext,
  onOpenPortrait,
  onProgressLayout,
  onTogglePlay,
  pauseLabel,
  playLabel,
  progressHandlers,
  progressPercent,
  progressTrackRef,
  refreshLabel,
  showEmptyAction,
  isPlaying,
  subtitle
}) {
  const percent = Math.min(1, Math.max(0, Number(progressPercent) || 0));

  return (
    <View style={styles.card}>
      <View style={styles.coverWrap}>
        <SongArtwork uri={current?.cover_url} size={228} radius={34} label={current?.title || "TPY"} />
      </View>
      <Text style={styles.title}>{current?.title || "No song yet"}</Text>
      <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
      {showEmptyAction ? (
        <TouchableOpacity style={styles.secondarySoft} onPress={onOpenPortrait}>
          <Text style={styles.secondaryText}>{emptyActionText}</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.progressWrap}>
        <View style={styles.progressTrackShell} {...progressHandlers}>
          <View ref={progressTrackRef} onLayout={onProgressLayout} style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percent * 100}%` }]} />
            {current ? (
              <View style={[styles.progressThumb, { left: `${percent * 100}%`, marginLeft: -10 }]} />
            ) : null}
          </View>
        </View>
        <View style={styles.progressTimeRow}>
          <Text style={styles.progressText}>{formatTime(displayedPosition)}</Text>
          <Text style={styles.progressText}>{formatTime(duration)}</Text>
        </View>
      </View>

      <View style={styles.controlsRow}>
        <TouchableOpacity style={styles.controlBtn} onPress={onFavorite}>
          <Text style={styles.controlText}>{favoriteLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.playBtn} onPress={onTogglePlay}>
          <Text style={styles.playText}>{current ? (isPlaying ? pauseLabel : playLabel) : refreshLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={onNext}>
          <Text style={styles.controlText}>{nextLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(11,17,27,0.58)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 32,
    borderWidth: 1,
    marginBottom: 18,
    padding: 22
  },
  coverWrap: {
    alignItems: "center",
    marginBottom: 18
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
    textAlign: "center"
  },
  subtitle: {
    color: "rgba(236,240,246,0.7)",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: "center"
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
  progressWrap: {
    marginTop: 22
  },
  progressTrackShell: {
    marginHorizontal: -4,
    paddingVertical: 10
  },
  progressTrack: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    height: 8,
    overflow: "visible",
    position: "relative"
  },
  progressFill: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0
  },
  progressThumb: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    elevation: 5,
    height: 20,
    position: "absolute",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    top: -6,
    width: 20
  },
  progressTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8
  },
  progressText: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 12,
    fontVariant: ["tabular-nums"]
  },
  controlsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22
  },
  controlBtn: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 15
  },
  controlText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700"
  },
  playBtn: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    flex: 1,
    paddingVertical: 15
  },
  playText: {
    color: "#111217",
    fontSize: 15,
    fontWeight: "800"
  }
});
