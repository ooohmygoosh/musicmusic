import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Alert,
  PanResponder,
  ActivityIndicator,
  Image,
  FlatList
} from "react-native";
import { Audio } from "expo-av";
import { BlurMask, Canvas, Circle, Group } from "@shopify/react-native-skia";
import { API_BASE } from "./config";
import { usePlaybackEngine } from "./playback/usePlaybackEngine";

const TABS = [
  { key: "player", label: "\u6b4c\u66f2" },
  { key: "favorites", label: "\u6536\u85cf" },
  { key: "galaxy", label: "\u753b\u50cf" },
  { key: "settings", label: "\u8bbe\u7f6e" }
];

const TYPE_COLORS = {
  "\u573a\u666f": ["#FFC36A", "#FFD6A8", "#FFF8EA"],
  "\u60c5\u7eea": ["#FF8B7A", "#FFD98C", "#FFF3EE"],
  "\u98ce\u683c": ["#3E89FF", "#6CC8FF", "#EEF5FF"],
  "\u5176\u4ed6": ["#8E8AF6", "#D8D6FF", "#F5F4FF"]
};

const CATEGORY_ORDER = ["\u573a\u666f", "\u60c5\u7eea", "\u98ce\u683c", "\u5176\u4ed6"];
const MAX_PORTRAIT_TAGS = 15;
const PORTRAIT_MIN_SIZE = 14;
const PORTRAIT_MAX_SIZE = 108;
const PORTRAIT_ORIGIN_SIZE = 40;
const PORTRAIT_STEP_SIZE = 24;
const PORTRAIT_TOP_INSET = 82;
const PORTRAIT_SIDE_INSET = 10;
const PORTRAIT_BOTTOM_INSET = 164;
const REPULSION_GAP = 18;
const STABLE_SPRING = 0.028;
const STABLE_DAMPING = 0.72;
const BOUNCE_SPRING = 0.085;
const BOUNCE_DAMPING = 0.76;
const VELOCITY_EPSILON = 0.09;

const AUTH_AVATARS = ["\uD83C\uDFA7", "\uD83C\uDFB9", "\uD83C\uDF19", "\u2728", "\uD83D\uDD25", "\uD83C\uDF0A", "\uD83C\uDF08", "\uD83E\uDE90", "\uD83E\uDD8B", "\uD83C\uDFBC"];

const FALLBACK_BLOBS = [
  { x: 0.22, y: 0.18, r: 0.33, color: "rgba(255,138,122,0.48)" },
  { x: 0.82, y: 0.28, r: 0.24, color: "rgba(52,132,255,0.42)" },
  { x: 0.64, y: 0.72, r: 0.22, color: "rgba(155,123,255,0.34)" },
  { x: 0.18, y: 0.92, r: 0.2, color: "rgba(120,170,220,0.3)" },
  { x: 0.9, y: 0.76, r: 0.16, color: "rgba(255,196,107,0.28)" }
];


const LANGUAGE_OPTIONS = [
  { key: "zh", label: "\u4e2d\u6587" },
  { key: "en", label: "English" }
];

const I18N = {
  zh: {
    guest: "\u8bbf\u5ba2", missingAccountTitle: "\u7f3a\u5c11\u8d26\u53f7", missingAccountBody: "\u8bf7\u8f93\u5165\u8d26\u53f7 ID\u3002", missingPasswordTitle: "\u7f3a\u5c11\u5bc6\u7801", missingPasswordBody: "\u8bf7\u8f93\u5165\u5bc6\u7801\u3002", missingUsernameTitle: "\u7f3a\u5c11\u6635\u79f0", missingUsernameBody: "\u6ce8\u518c\u65f6\u8bf7\u5148\u8f93\u5165\u6635\u79f0\u3002", missingAvatarTitle: "\u7f3a\u5c11\u5934\u50cf", missingAvatarBody: "\u8bf7\u9009\u62e9\u4e00\u4e2a\u5934\u50cf\u3002", weakPasswordTitle: "\u5bc6\u7801\u592a\u77ed", weakPasswordBody: "\u5bc6\u7801\u81f3\u5c11\u9700\u8981 6 \u4f4d\u3002", passwordMismatchTitle: "\u5bc6\u7801\u4e0d\u4e00\u81f4", passwordMismatchBody: "\u4e24\u6b21\u8f93\u5165\u7684\u5bc6\u7801\u4e0d\u4e00\u81f4\u3002", loginFailed: "\u767b\u5f55\u5931\u8d25", registerFailed: "\u6ce8\u518c\u5931\u8d25", generationFailed: "\u751f\u6210\u5931\u8d25", noSongsReadyTitle: "\u6682\u65e0\u53ef\u64ad\u6b4c\u66f2", noSongsReadyBody: "\u8bf7\u5148\u5728\u753b\u50cf\u9875\u751f\u6210\u6b4c\u66f2\u3002", noPlaylistTitle: "\u8fd8\u6ca1\u6709\u6b4c\u5355", noPlaylistBody: "\u8bf7\u5148\u5230\u6536\u85cf\u9875\u521b\u5efa\u4e00\u4e2a\u6b4c\u5355\u3002", anchorUpdateFailed: "\u573a\u666f\u66f4\u65b0\u5931\u8d25", authEyebrow: "\u5929\u8c31\u4e50", authTitle: "\u767b\u5f55\u540e\u7ee7\u7eed\u4f60\u7684\u97f3\u4e50\u7a7a\u95f4", authSubtitle: "\u6ce8\u518c\u9700\u8f93\u5165\u6635\u79f0\u3001\u8d26\u53f7\u3001\u5bc6\u7801\u548c\u5934\u50cf\uff0c\u767b\u5f55\u53ea\u9700\u8d26\u53f7\u548c\u5bc6\u7801\u3002", loginRestore: "\u767b\u5f55", registerContinue: "\u6ce8\u518c", username: "\u6635\u79f0", chooseAvatar: "\u9009\u62e9\u5934\u50cf", accountId: "\u8d26\u53f7 ID", password: "\u5bc6\u7801", confirmPassword: "\u786e\u8ba4\u5bc6\u7801", pickInitialTags: "\u9009\u62e9\u521d\u59cb\u6807\u7b7e", pickInitialTagsSub: "\u8bf7\u81f3\u5c11\u4ece\u4e24\u4e2a\u4e0d\u540c\u5206\u7c7b\u4e2d\u9009\u62e9\u6807\u7b7e\u3002", done: "\u5df2\u5b8c\u6210", stepLabel: "\u7b2c {current} \u6b65 / \u5171 {total} \u6b65", allCategoriesCompleted: "\u6240\u6709\u5206\u7c7b\u5df2\u9009\u5b8c\u3002", back: "\u4e0a\u4e00\u6b65", next: "\u4e0b\u4e00\u6b65", enterApp: "\u8fdb\u5165 App", sceneAnchor: "\u573a\u666f", noPlayableSongs: "\u6682\u65e0\u53ef\u64ad\u6b4c\u66f2\uff0c\u8bf7\u5148\u53bb\u753b\u50cf\u9875\u751f\u6210\u3002", favorite: "\u6536\u85cf", play: "\u64ad\u653e", pause: "\u6682\u505c", refresh: "\u5237\u65b0", saveToPlaylist: "\u4fdd\u5b58\u5230\u6b4c\u5355", songsCount: "{count} \u9996", cancel: "\u53d6\u6d88", noSongsReady: "\u6682\u65e0\u6b4c\u66f2", newPlaylist: "\u65b0\u5efa\u6b4c\u5355", newPlaylistPlaceholder: "\u4f8b\u5982\uff1a\u591c\u665a\u901a\u52e4 / \u51cc\u6668", create: "\u521b\u5efa", myPlaylists: "\u6211\u7684\u6b4c\u5355", noPlaylistYet: "\u6682\u65e0\u6b4c\u5355\u3002", playlistEmpty: "\u8fd9\u4e2a\u6b4c\u5355\u8fd8\u662f\u7a7a\u7684\u3002", myGeneratedSongs: "\u6211\u751f\u6210\u7684\u6b4c", noGeneratedSongs: "\u8fd8\u6ca1\u6709\u751f\u6210\u6b4c\u66f2\uff0c\u53bb\u753b\u50cf\u9875\u751f\u6210\u5427\u3002", public: "\u516c\u5f00", private: "\u79c1\u6709", enabled: "\u542f\u7528", disabled: "\u505c\u7528", revenueOn: "\u5206\u8d26\u5f00\u542f", revenueOff: "\u5206\u8d26\u5173\u95ed", noTagsYet: "\u8fd8\u6ca1\u6709\u6807\u7b7e", noTagsYetSub: "\u53ef\u4ee5\u5728\u4e0b\u65b9\u6dfb\u52a0\u6807\u7b7e\uff0c\u6216\u5148\u5b8c\u6210\u521d\u59cb\u6807\u7b7e\u9009\u62e9\u3002", softer: "\u51cf\u5f31", lowerWeight: "\u964d\u4f4e\u6743\u91cd", stronger: "\u589e\u5f3a", raiseWeight: "\u63d0\u9ad8\u6743\u91cd", addTag: "\u6dfb\u52a0\u6807\u7b7e", expand: "\u5c55\u5f00", collapse: "\u6536\u8d77", tagName: "\u6807\u7b7e\u540d\u79f0", existingCategoryFound: "\u5df2\u6709\u5206\u7c7b\uff1a{type}\uff0c\u5c06\u76f4\u63a5\u52a0\u5165\u753b\u50cf\u3002", newTagHint: "\u5168\u65b0\u6807\u7b7e\u9700\u5148\u63d0\u4ea4\uff0c\u518d\u9009\u62e9\u6240\u5c5e\u5206\u7c7b\u3002", addToPortrait: "\u52a0\u5165\u6211\u7684\u753b\u50cf", chooseCategoryFor: "\u4e3a\u201c{tag}\u201d\u9009\u62e9\u5206\u7c7b", confirm: "\u786e\u5b9a", generateSongs: "\u751f\u6210\u6b4c\u66f2", generating: "\u751f\u6210\u4e2d...", generateFromPortrait: "\u6839\u636e\u753b\u50cf\u751f\u6210\u6b4c\u66f2", generated: "\u5df2\u751f\u6210", currentAccount: "\u5f53\u524d\u8d26\u53f7", accountAction: "\u8d26\u53f7\u64cd\u4f5c", logout: "\u9000\u51fa\u767b\u5f55", language: "\u8bed\u8a00", languageHint: "\u5f53\u524d\u53ea\u5207\u6362 App \u5185\u6587\u6848\u3002", tools: "\u5de5\u5177", expandPanel: "\u5c55\u5f00\u9762\u677f", collapsePanel: "\u6536\u8d77\u9762\u677f"
  },
  en: {
    guest: "Guest", missingAccountTitle: "Missing account", missingAccountBody: "Please enter your account ID.", missingPasswordTitle: "Missing password", missingPasswordBody: "Please enter your password.", missingUsernameTitle: "Missing username", missingUsernameBody: "Please enter a username for registration.", missingAvatarTitle: "Missing avatar", missingAvatarBody: "Please choose an avatar.", weakPasswordTitle: "Weak password", weakPasswordBody: "Password must be at least 6 characters.", passwordMismatchTitle: "Password mismatch", passwordMismatchBody: "The two passwords do not match.", loginFailed: "Login failed", registerFailed: "Register failed", generationFailed: "Generation failed", noSongsReadyTitle: "No songs ready", noSongsReadyBody: "Please generate songs in Portrait first.", noPlaylistTitle: "No playlist", noPlaylistBody: "Create one in Favorites first.", anchorUpdateFailed: "Scene update failed", authEyebrow: "TPY MUSIC", authTitle: "Sign in to restore your music space", authSubtitle: "Register with username, account, password and avatar. Login uses account and password.", loginRestore: "Login", registerContinue: "Register", username: "Username", chooseAvatar: "Choose avatar", accountId: "Account ID", password: "Password", confirmPassword: "Confirm password", pickInitialTags: "Pick initial tags", pickInitialTagsSub: "Please choose tags from at least two categories.", done: "Done", stepLabel: "Step {current} / {total}", allCategoriesCompleted: "All categories completed.", back: "Back", next: "Next", enterApp: "Enter App", sceneAnchor: "Scene", noPlayableSongs: "No playable songs. Go to Portrait to generate.", favorite: "Favorite", play: "Play", pause: "Pause", refresh: "Refresh", saveToPlaylist: "Save to playlist", songsCount: "Songs {count}", cancel: "Cancel", noSongsReady: "No songs ready.", newPlaylist: "New playlist", newPlaylistPlaceholder: "e.g. Late night / Commute", create: "Create", myPlaylists: "My playlists", noPlaylistYet: "No playlist yet.", playlistEmpty: "This playlist is empty.", myGeneratedSongs: "My generated songs", noGeneratedSongs: "No generated songs yet. Generate songs in Portrait first.", public: "Public", private: "Private", enabled: "Enabled", disabled: "Disabled", revenueOn: "Revenue on", revenueOff: "Revenue off", noTagsYet: "No tags yet", noTagsYetSub: "Add tags below, or complete onboarding tags first.", softer: "Softer", lowerWeight: "Lower weight", stronger: "Stronger", raiseWeight: "Raise weight", addTag: "Add tag", expand: "Expand", collapse: "Collapse", tagName: "Tag name", existingCategoryFound: "Existing category found: {type}. It will be added directly.", newTagHint: "For a new tag, submit first and then choose its category.", addToPortrait: "Add to my portrait", chooseCategoryFor: "Choose a category for \"{tag}\"", confirm: "Confirm", generateSongs: "Generate songs", generating: "Generating...", generateFromPortrait: "Generate songs from portrait", generated: "generated", currentAccount: "Current account", accountAction: "Account action", logout: "Log out", language: "Language", languageHint: "Switch UI copy inside the app.", tools: "Tools", expandPanel: "Expand panel", collapsePanel: "Collapse panel"
  }
};

function translate(language, key, vars = {}) {
  const base = I18N[language]?.[key] ?? I18N.zh[key] ?? key;
  return Object.entries(vars).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), base);
}


function formatTime(ms) {
  if (!ms || Number.isNaN(ms)) return "0:00";
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function typePalette(type) {
  return TYPE_COLORS[type] || ["#82B9FF", "#CCE3FF", "#EAF5FF"];
}

function uniqueTagNames(tags) {
  return Array.from(new Set((tags || []).filter(Boolean)));
}

function songTagText(song) {
  const names = uniqueTagNames(song?.tags);
  if (names.length > 0) return names.join(" \u00b7 ");
  return "\u6807\u7b7e\u6574\u7406\u4e2d";
}

function hexToRgba(hex, alpha) {
  const clean = String(hex || "#000000").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((ch) => ch + ch).join("") : clean;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(0,0,0,${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function queueKeyOf(song) {
  return song?.queue_id || song?.id;
}

function cloneQueueSong(song, source = "manual") {
  if (!song) return null;
  return { ...song, queue_id: `${source}-${song.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashString(input) {
  const text = String(input || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function deriveBlockSize(tag, index) {
  const scale = [78, 64, 46, 70, 34, 58, 74, 40, 52];
  const seed = hashString(`${tag.tag_id}-${tag.name}-${tag.type}-${index}`);
  return scale[seed % scale.length];
}

function weightDrivenBlockSize(tag, index, rankedTags) {
  const list = Array.isArray(rankedTags) ? rankedTags : [];
  const currentWeight = Number(tag?.weight || 0);
  const maxWeight = Math.max(...list.map((item) => Number(item?.weight || 0)), currentWeight, 0.0001);
  const minWeight = Math.min(...list.map((item) => Number(item?.weight || 0)), currentWeight);
  const spread = Math.max(0.0001, maxWeight - minWeight);
  const normalized = clamp((currentWeight - minWeight) / spread, 0, 1);
  const rankBoost = list.length <= 1 ? 1 : 1 - index / Math.max(1, list.length - 1);
  const blended = clamp(normalized * 0.72 + rankBoost * 0.28, 0, 1);
  return clamp(PORTRAIT_MIN_SIZE + blended * (PORTRAIT_MAX_SIZE - PORTRAIT_MIN_SIZE), PORTRAIT_MIN_SIZE, PORTRAIT_MAX_SIZE);
}

function sortProfileTags(tags) {
  return [...(tags || [])].sort((a, b) => {
    const activeDelta = Number(b?.is_active !== false) - Number(a?.is_active !== false);
    if (activeDelta !== 0) return activeDelta;
    const wa = Number(a?.weight || 0);
    const wb = Number(b?.weight || 0);
    if (wb !== wa) return wb - wa;
    return Number(b?.tag_id || 0) - Number(a?.tag_id || 0);
  });
}

function getBlockMetrics(block) {
  const label = String(block?.tag?.name || "");
  const visualHeight = clamp(block.currentSize * 1.3 + 18, 52, 126);
  const visualWidth = clamp(Math.max(96, visualHeight * 1.32, 58 + label.length * 16, block.currentSize * 2.15), 96, 260);
  return {
    width: visualWidth,
    height: visualHeight,
    radius: Math.max(visualWidth, visualHeight) * 0.42
  };
}

function getFuncZones(stageSize) {
  const width = Math.max(320, stageSize.width || 0);
  const zoneTop = 26;
  const zoneHeight = 64;
  const gap = 12;
  const zoneWidth = (width - PORTRAIT_SIDE_INSET * 2 - gap) / 2;
  return [
    { id: 2, key: "smaller", label: "Softer", hint: "Lower weight", x: PORTRAIT_SIDE_INSET, y: zoneTop, width: zoneWidth, height: zoneHeight },
    { id: 3, key: "bigger", label: "Stronger", hint: "Raise weight", x: PORTRAIT_SIDE_INSET + zoneWidth + gap, y: zoneTop, width: zoneWidth, height: zoneHeight }
  ];
}

function findZoneAtPoint(point, stageSize) {
  const zones = getFuncZones(stageSize);
  const tolerance = 16;
  const match = zones.find((zone) => (
    point.x >= zone.x - tolerance
    && point.x <= zone.x + zone.width + tolerance
    && point.y >= zone.y - tolerance
    && point.y <= zone.y + zone.height + tolerance
  ));
  return match ? match.id : -1;
}

function findZoneForBlock(block, point, stageSize) {
  return findZoneAtPoint(point, stageSize);
}

function sanitizeBlockPoint(block, point, stageSize) {
  const { width: blockWidth, height: blockHeight } = getBlockMetrics(block);
  const minX = PORTRAIT_SIDE_INSET + blockWidth / 2;
  const maxX = Math.max(minX, (stageSize.width || 0) - PORTRAIT_SIDE_INSET - blockWidth / 2);
  const minY = PORTRAIT_TOP_INSET + blockHeight / 2;
  const maxY = Math.max(minY, (stageSize.height || 0) - PORTRAIT_BOTTOM_INSET - blockHeight / 2);
  return {
    x: clamp(point.x, minX, maxX),
    y: clamp(point.y, minY, maxY)
  };
}

function sanitizeDragPoint(block, point, stageSize) {
  const { width: blockWidth, height: blockHeight } = getBlockMetrics(block);
  const zones = getFuncZones(stageSize);
  const topZoneY = zones.reduce((min, zone) => Math.min(min, zone.y), PORTRAIT_TOP_INSET);
  const minX = PORTRAIT_SIDE_INSET + blockWidth / 2;
  const maxX = Math.max(minX, (stageSize.width || 0) - PORTRAIT_SIDE_INSET - blockWidth / 2);
  const dragMinY = Math.min(PORTRAIT_TOP_INSET + blockHeight / 2, topZoneY + Math.min(28, blockHeight * 0.24));
  const dragMaxY = Math.max(dragMinY, (stageSize.height || 0) - PORTRAIT_BOTTOM_INSET - blockHeight / 2);
  return {
    x: clamp(point.x, minX, maxX),
    y: clamp(point.y, dragMinY, dragMaxY)
  };
}

function keepBlockInBounds(block, stageSize) {
  if (block.isExiting) {
    const metrics = getBlockMetrics(block);
    const minX = PORTRAIT_SIDE_INSET + metrics.width / 2;
    const maxX = Math.max(minX, (stageSize.width || 0) - PORTRAIT_SIDE_INSET - metrics.width / 2);
    block.currentPos = {
      x: clamp(block.currentPos.x, minX, maxX),
      y: clamp(block.currentPos.y, -280, (stageSize.height || 0) + 280)
    };
    block.anchorPos = {
      x: clamp(block.anchorPos.x, minX, maxX),
      y: clamp(block.anchorPos.y, -280, (stageSize.height || 0) + 280)
    };
    return;
  }

  if (block.isEntering) {
    const inside = sanitizeBlockPoint(block, block.currentPos, stageSize);
    block.currentPos = {
      x: inside.x,
      y: clamp(block.currentPos.y, PORTRAIT_TOP_INSET - 30, (stageSize.height || 0) + 280)
    };
    block.anchorPos = sanitizeBlockPoint(block, block.anchorPos, stageSize);
    return;
  }

  block.currentPos = sanitizeBlockPoint(block, block.currentPos, stageSize);
  block.anchorPos = sanitizeBlockPoint(block, block.anchorPos, stageSize);
}

function cloneBlock(block) {
  return {
    ...block,
    anchorPos: { ...block.anchorPos },
    currentPos: { ...block.currentPos },
    velocity: { ...block.velocity }
  };
}

function applyRepulsion(blocks, stageSize, strength = 0.16, passes = 2) {
  for (let pass = 0; pass < passes; pass += 1) {
    for (let i = 0; i < blocks.length; i += 1) {
      for (let j = i + 1; j < blocks.length; j += 1) {
        const a = blocks[i];
        const b = blocks[j];
        const aMetrics = getBlockMetrics(a);
        const bMetrics = getBlockMetrics(b);
        const dx = b.currentPos.x - a.currentPos.x;
        const dy = b.currentPos.y - a.currentPos.y;
        const dist = Math.max(0.001, Math.hypot(dx, dy));
        const minDist = aMetrics.radius + bMetrics.radius + REPULSION_GAP;
        if (dist >= minDist) continue;

        const ux = dx / dist;
        const uy = dy / dist;
        const overlap = minDist - dist;
        const push = overlap * strength;
        const aCanMove = !a.isDragging;
        const bCanMove = !b.isDragging;

        if (aCanMove && bCanMove) {
          a.currentPos.x -= ux * push * 0.5;
          a.currentPos.y -= uy * push * 0.5;
          b.currentPos.x += ux * push * 0.5;
          b.currentPos.y += uy * push * 0.5;
          a.velocity.x -= ux * push * 0.06;
          a.velocity.y -= uy * push * 0.06;
          b.velocity.x += ux * push * 0.06;
          b.velocity.y += uy * push * 0.06;
        } else if (!aCanMove && bCanMove) {
          b.currentPos.x += ux * push;
          b.currentPos.y += uy * push;
          b.velocity.x += ux * push * 0.08;
          b.velocity.y += uy * push * 0.08;
        } else if (aCanMove && !bCanMove) {
          a.currentPos.x -= ux * push;
          a.currentPos.y -= uy * push;
          a.velocity.x -= ux * push * 0.08;
          a.velocity.y -= uy * push * 0.08;
        }
      }
    }

    for (const block of blocks) {
      keepBlockInBounds(block, stageSize);
      block.velocity.x = clamp(block.velocity.x, -22, 22);
      block.velocity.y = clamp(block.velocity.y, -22, 22);
    }
  }
}

function buildPortraitBlocks(tags, stageSize, prevBlocks = []) {
  const width = Math.max(320, stageSize.width || 0);
  const height = Math.max(620, stageSize.height || 0);
  const sorted = [...(tags || [])].sort((a, b) => {
    const wa = Number(a?.weight || 0);
    const wb = Number(b?.weight || 0);
    if (wb !== wa) return wb - wa;
    return Number(b?.tag_id || 0) - Number(a?.tag_id || 0);
  });
  const limited = sorted.slice(0, MAX_PORTRAIT_TAGS);
  if (limited.length === 0) {
    return (prevBlocks || []).filter((block) => block.isExiting);
  }

  const prevMap = new Map(prevBlocks.map((block) => [block.id, block]));
  const activeIds = new Set(limited.map((tag) => tag.tag_id));
  const centerX = width / 2;
  const centerY = height * 0.53;

  const keepBlocks = limited.map((tag, index) => {
    const palette = typePalette(tag.type);
    const seed = hashString(String(tag.tag_id) + '-' + String(tag.name) + '-' + String(tag.type));
    const angle = index * 2.399963229728653 + (seed % 17) * 0.03;
    const ring = 92 + Math.floor(index / 3) * 74 + (seed % 28);
    const x = centerX + Math.cos(angle) * ring * 1.2;
    const y = centerY + Math.sin(angle) * ring * 0.88;
    const previous = prevMap.get(tag.tag_id);
    const rankedSize = weightDrivenBlockSize(tag, index, limited);
    const startSize = previous ? clamp(previous.currentSize, PORTRAIT_MIN_SIZE, PORTRAIT_MAX_SIZE) : rankedSize;

    const baseBlock = {
      id: tag.tag_id,
      tag,
      color: palette[0],
      glow: palette[1],
      text: '#FFFFFF',
      minSize: PORTRAIT_MIN_SIZE,
      maxSize: PORTRAIT_MAX_SIZE,
      originSize: PORTRAIT_ORIGIN_SIZE,
      currentSize: startSize,
      targetSize: rankedSize,
      flash: previous ? Number(previous.flash || 0) : 0,
      anchorPos: previous ? { ...previous.anchorPos } : { x, y },
      currentPos: previous ? { ...previous.currentPos } : { x, y },
      velocity: previous ? { ...previous.velocity } : { x: 0, y: 0 },
      isDragging: false,
      needBackToAnchor: previous ? previous.needBackToAnchor : false,
      isEntering: !previous,
      isExiting: false
    };

    baseBlock.anchorPos = sanitizeBlockPoint(baseBlock, { x, y }, stageSize);

    if (!previous) {
      const introX = clamp(baseBlock.anchorPos.x + (index % 2 === 0 ? -16 : 16), PORTRAIT_SIDE_INSET, width - PORTRAIT_SIDE_INSET);
      baseBlock.currentPos = {
        x: introX,
        y: height + 110 + (index % 3) * 26
      };
      baseBlock.velocity = { x: 0, y: -2.1 };
      baseBlock.needBackToAnchor = true;
    } else {
      baseBlock.currentPos = sanitizeBlockPoint(baseBlock, baseBlock.currentPos, stageSize);
      baseBlock.isEntering = Boolean(previous.isEntering && previous.currentPos.y > baseBlock.anchorPos.y + 6);
    }

    return baseBlock;
  });

  const exitingBlocks = (prevBlocks || [])
    .filter((block) => !activeIds.has(block.id))
    .map((block) => {
      const copied = {
        ...block,
        tag: block.tag,
        flash: Number(block.flash || 0),
        isDragging: false,
        isEntering: false,
        isExiting: true,
        needBackToAnchor: true,
        velocity: { x: block.velocity?.x || 0, y: Math.min(block.velocity?.y || -1.5, -1.5) }
      };
      const targetY = -Math.max(120, getBlockMetrics(copied).height + 36);
      copied.anchorPos = { x: copied.currentPos.x, y: targetY };
      return copied;
    });

  return [...exitingBlocks, ...keepBlocks];
}

function pickBlockAtPoint(blocks, point) {
  let best = null;
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i];
    const metrics = getBlockMetrics(block);
    const insideX = Math.abs(point.x - block.currentPos.x) <= metrics.width / 2;
    const insideY = Math.abs(point.y - block.currentPos.y) <= metrics.height / 2;
    if (!insideX || !insideY) continue;
    const dx = point.x - block.currentPos.x;
    const dy = point.y - block.currentPos.y;
    const score = Math.hypot(dx, dy) / metrics.radius;
    if (!best || score < best.score) best = { block, score };
  }
  return best ? best.block : null;
}

function ScreenTitle({ title, subtitle, light = false }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={[styles.title, light && styles.titleLight]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, light && styles.subtitleLight]}>{subtitle}</Text> : null}
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

function PortraitBackdrop({ blocks, stageSize }) {
  const width = Math.max(1, stageSize.width || 0);
  const height = Math.max(1, stageSize.height || 0);
  const source = (blocks || []).length > 0 ? blocks : FALLBACK_BLOBS.map((item, index) => ({
    id: `fallback-${index}`,
    color: item.color,
    glow: item.color,
    currentPos: { x: width * item.x, y: height * item.y },
    currentSize: clamp(item.r * 160, PORTRAIT_MIN_SIZE, PORTRAIT_MAX_SIZE),
    flash: 0,
    tag: { name: "" }
  }));

  return (
    <View pointerEvents="none" style={styles.backdropLayer}>
      <View style={styles.backdropBase} />
      <Canvas style={styles.backdropCanvas}>
        <Group blendMode="screen">
          {source.map((block) => {
            const radius = getBlockMetrics(block).radius;
            const seed = hashString(`${block.id}-${block.tag?.name || ""}`);
            const driftX = ((seed % 29) - 14) * 2.6;
            const driftY = (((seed >> 3) % 25) - 12) * 3.8;
            const bloomRadius = radius * 1.68;
            const mistRadius = radius * 1.3;
            const bloomX = clamp(block.currentPos.x + driftX, -width * 0.18, width * 1.18);
            const bloomY = clamp(block.currentPos.y + driftY, -height * 0.18, height * 1.22);
            const mistX = clamp(block.currentPos.x - driftX * 0.34, -width * 0.18, width * 1.18);
            const mistY = clamp(block.currentPos.y - driftY * 0.28, -height * 0.18, height * 1.22);
            return (
              <Group key={block.id}>
                <Circle cx={bloomX} cy={bloomY} r={bloomRadius * (1 + (block.flash || 0) * 0.08)} color={hexToRgba(block.color, 0.31 + (block.flash || 0) * 0.18)}>
                  <BlurMask blur={206} style="normal" />
                </Circle>
                <Circle cx={mistX} cy={mistY} r={mistRadius * (1 + (block.flash || 0) * 0.06)} color={hexToRgba(block.glow || block.color, 0.2 + (block.flash || 0) * 0.16)}>
                  <BlurMask blur={246} style="normal" />
                </Circle>
              </Group>
            );
          })}
        </Group>
        <Circle cx={width * 0.5} cy={height * 0.48} r={Math.max(width, height) * 0.28} color="rgba(6,10,16,0.08)">
          <BlurMask blur={190} style="normal" />
        </Circle>
      </Canvas>
      <View style={styles.backdropSoftener} />
    </View>
  );
}

function PortraitTag({ block, isDragging }) {
  const metrics = getBlockMetrics(block);
  const left = block.currentPos.x - metrics.width / 2;
  const top = block.currentPos.y - metrics.height / 2;
  const typeFontSize = clamp(10 + block.currentSize * 0.055, 10, 16);
  const tagFontSize = clamp(13 + block.currentSize * 0.085, 13, 24);

  return (
    <React.Fragment>
      <Text
        pointerEvents="none"
        style={[
          styles.tagType,
          styles.tagTypeFloating,
          {
            left: left + 18,
            top: top + 10,
            fontSize: typeFontSize,
            opacity: isDragging ? 0.96 : 0.82,
            transform: [{ scale: isDragging ? 1.04 : 1 }]
          }
        ]}
        numberOfLines={1}
      >
        {block.tag.type}
      </Text>
      <Text
        pointerEvents="none"
        style={[
          styles.tagText,
          styles.tagTextFloating,
          {
            left: left + 18,
            top: top + 28,
            maxWidth: Math.max(72, metrics.width - 36),
            fontSize: tagFontSize,
            opacity: isDragging ? 1 : 0.94,
            transform: [{ scale: isDragging ? 1.04 : 1 }]
          }
        ]}
        numberOfLines={1}
      >
        {block.tag.name}
      </Text>
    </React.Fragment>
  );
}

function SongArtwork({ uri, size = 56, radius, label = "TPY" }) {
  const borderRadius = radius ?? Math.round(size * 0.18);
  const textLabel = String(label || "TPY").slice(0, 3);

  return (
    <View style={[styles.artworkFrame, { width: size, height: size, borderRadius }]}> 
      {uri ? (
        <Image source={{ uri }} style={[styles.artworkImage, { borderRadius }]} resizeMode="cover" />
      ) : (
        <View style={[styles.artworkPlaceholder, { borderRadius }]}> 
          <View style={styles.artworkGlowA} />
          <View style={styles.artworkGlowB} />
          <View style={styles.artworkGlowC} />
          <Text style={[styles.artworkLabel, { fontSize: Math.max(16, Math.round(size * 0.16)) }]}>{textLabel}</Text>
        </View>
      )}
    </View>
  );
}

export default function App() {
  const { width, height } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState("player");
  const [language, setLanguage] = useState("zh");
  const [authMode, setAuthMode] = useState("login");
  const [accountId, setAccountId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AUTH_AVATARS[0]);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [tags, setTags] = useState([]);
  const [seedSelection, setSeedSelection] = useState(new Set());
  const [profileTags, setProfileTags] = useState([]);
  const [songs, setSongs] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [mySongs, setMySongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [playlistSongsMap, setPlaylistSongsMap] = useState({});
  const [playlistSongs, setPlaylistSongs] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [current, setCurrent] = useState(null);
  const [sound, setSound] = useState(null);
  const [currentSoundId, setCurrentSoundId] = useState(null);
  const [playback, setPlayback] = useState({ position: 0, duration: 1, isPlaying: false });
  const [generationLoading, setGenerationLoading] = useState(false);
  const [lastGeneratedSong, setLastGeneratedSong] = useState(null);
  const [recommendationState, setRecommendationState] = useState({
    mode: "stable",
    skipStreak: 0,
    needsGeneration: false
  });
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [pendingTagName, setPendingTagName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(CATEGORY_ORDER[0] || "");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [isTagSheetCollapsed, setIsTagSheetCollapsed] = useState(false);
  const [isGenerateSheetCollapsed, setIsGenerateSheetCollapsed] = useState(false);
  const [isUtilitySheetCollapsed, setIsUtilitySheetCollapsed] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [tagMessage, setTagMessage] = useState("");
  const [health, setHealth] = useState({ loading: false, ok: null, message: "" });
  const [portraitStageSize, setPortraitStageSize] = useState({ width: 1, height: 1 });
  const [portraitBlocks, setPortraitBlocks] = useState([]);
  const [activeZoneId, setActiveZoneId] = useState(-1);
  const [zonePulseId, setZonePulseId] = useState(-1);
  const [isPortraitDragging, setIsPortraitDragging] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreviewPosition, setSeekPreviewPosition] = useState(null);
  const activeZoneRef = useRef(-1);
  const zonePulseTimerRef = useRef(null);
  const blockPulseTimerRef = useRef(null);
  const [progressLayout, setProgressLayout] = useState(null);
  const progressTrackRef = useRef(null);
  const completeSentFor = useRef(null);
  const autoNextLock = useRef(false);
  const blocksRef = useRef([]);
  const stageSizeRef = useRef({ width: 1, height: 1 });
  const activeTabRef = useRef(activeTab);
  const draggingIdRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartBlockPosRef = useRef({ x: 0, y: 0 });

  const lastDragPointRef = useRef(null);
  const playbackRef = useRef(playback);
  const soundRef = useRef(sound);
  const progressLayoutRef = useRef(progressLayout);
  const seekingRef = useRef(false);
  const songsRef = useRef(songs);
  const queueListRef = useRef(null);
  const profileTagsRef = useRef(profileTags);
  const prefetchLockRef = useRef(false);
  const autoGenerateRef = useRef(async () => false);
  const userId = session?.userId || null;
  const userIdRef = useRef(userId);
  const displayName = session?.name || session?.accountId || session?.deviceId || translate(language, "guest");
  const t = useCallback((key, vars = {}) => translate(language, key, vars), [language]);
  const playbackEngine = usePlaybackEngine({
    apiBase: API_BASE,
    userId,
    onNeedsGeneration: () => {
      autoGenerateRef.current().catch(() => {});
    }
  });
    const effectiveStageSize = portraitStageSize.width > 20 && portraitStageSize.height > 20 ? portraitStageSize : { width, height: Math.max(620, height - 28) };

  const triggerZonePulse = useCallback((zoneId) => {
    if (zonePulseTimerRef.current) clearTimeout(zonePulseTimerRef.current);
    if (blockPulseTimerRef.current) clearTimeout(blockPulseTimerRef.current);
    setZonePulseId(zoneId);
    zonePulseTimerRef.current = setTimeout(() => {
      setZonePulseId(-1);
      zonePulseTimerRef.current = null;
    }, 120);
  }, []);

  const pulsePortraitBlock = useCallback((tagId) => {
    if (!Number.isFinite(Number(tagId))) return;
    if (blockPulseTimerRef.current) clearTimeout(blockPulseTimerRef.current);
    setPortraitBlocks((prev) => {
      const next = prev.map(cloneBlock);
      const target = next.find((item) => Number(item.id) === Number(tagId));
      if (!target) return prev;
      target.flash = 0.62;
      blocksRef.current = next;
      return next;
    });
    blockPulseTimerRef.current = setTimeout(() => {
      setPortraitBlocks((currentBlocks) => {
        const reset = currentBlocks.map(cloneBlock);
        const flashing = reset.find((item) => Number(item.id) === Number(tagId));
        if (!flashing) return currentBlocks;
        flashing.flash = 0;
        blocksRef.current = reset;
        return reset;
      });
      blockPulseTimerRef.current = null;
    }, 140);
  }, []);

  const refreshProfileSoon = useCallback(async () => {
    if (!userIdRef.current) return false;
    await loadProfileTags(userIdRef.current).catch(() => {});
    return true;
  }, []);

  const groupedTags = useMemo(() => {
    const map = new Map();
    for (const tag of tags) {
      const list = map.get(tag.type) || [];
      list.push(tag);
      map.set(tag.type, list);
    }
    return Array.from(map.entries());
  }, [tags]);

  const activeProfileTags = useMemo(
    () => sortProfileTags(profileTags.filter((item) => item.is_active !== false && Number(item.weight || 0) > 0)).slice(0, MAX_PORTRAIT_TAGS),
    [profileTags]
  );

  const sceneOptions = useMemo(() => {
    const merged = new Map();
    for (const tag of profileTags) {
      if (String(tag.type || "") !== "\u573a\u666f") continue;
      const id = Number(tag.tag_id || tag.id || 0);
      if (!id) continue;
      merged.set(id, { id, name: tag.name, type: tag.type });
    }
    for (const tag of tags) {
      if (String(tag.type || "") !== "\u573a\u666f") continue;
      const id = Number(tag.id || tag.tag_id || 0);
      if (!id || merged.has(id)) continue;
      merged.set(id, { id, name: tag.name, type: tag.type });
    }
    return Array.from(merged.values());
  }, [profileTags, tags]);

  const activeSceneAnchor = useMemo(
    () => sortProfileTags(profileTags.filter((item) => String(item.type || "") === "\u573a\u666f" && item.is_active !== false && Number(item.weight || 0) > 0))[0] || null,
    [profileTags]
  );

  const displayQueue = useMemo(() => {
    const history = Array.isArray(songs) ? songs : [];
    const liveQueue = Array.isArray(playbackEngine.queue) ? playbackEngine.queue : [];
    const ordered = [];
    const seen = new Set();

    const pushItem = (item) => {
      const key = String(queueKeyOf(item) || "");
      if (!key || seen.has(key)) return;
      seen.add(key);
      ordered.push(item);
    };

    history.forEach(pushItem);

    for (const liveItem of liveQueue) {
      const key = String(queueKeyOf(liveItem) || "");
      if (!key) continue;
      const index = ordered.findIndex((item) => String(queueKeyOf(item) || "") === key);
      if (index >= 0) {
        ordered[index] = { ...ordered[index], ...liveItem };
      } else {
        pushItem(liveItem);
      }
    }

    return ordered;
  }, [songs, playbackEngine.queue]);

  const currentQueueIndex = useMemo(() => {
    const playerCurrent = playbackEngine.current;
    if (!playerCurrent || displayQueue.length === 0) return -1;
    return displayQueue.findIndex((item) => queueKeyOf(item) === queueKeyOf(playerCurrent));
  }, [displayQueue, playbackEngine.current]);
  const existingTagMatch = useMemo(() => {
    const clean = newTagName.trim().toLowerCase();
    if (!clean) return null;
    return tags.find((tag) => String(tag.name || "").trim().toLowerCase() === clean) || null;
  }, [newTagName, tags]);

  const onboardingGroups = useMemo(
    () => CATEGORY_ORDER
      .map((type) => [type, groupedTags.find(([groupType]) => groupType === type)?.[1] || []])
      .filter(([, items]) => items.length > 0),
    [groupedTags]
  );

  const currentOnboarding = onboardingGroups[Math.min(onboardingStep, Math.max(0, onboardingGroups.length - 1))] || null;

  const selectedSeedCategoryCount = useMemo(() => {
    const picked = new Set();
    for (const [type, list] of onboardingGroups) {
      if (list.some((tag) => seedSelection.has(tag.id))) picked.add(type);
    }
    return picked.size;
  }, [onboardingGroups, seedSelection]);

  useEffect(() => { blocksRef.current = portraitBlocks; }, [portraitBlocks]);
  useEffect(() => { stageSizeRef.current = effectiveStageSize; }, [effectiveStageSize]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { playbackRef.current = playback; }, [playback]);
  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => { progressLayoutRef.current = progressLayout; }, [progressLayout]);
  useEffect(() => { seekingRef.current = isSeeking; }, [isSeeking]);
  useEffect(() => { songsRef.current = songs; }, [songs]);
  useEffect(() => { profileTagsRef.current = profileTags; }, [profileTags]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { activeZoneRef.current = activeZoneId; }, [activeZoneId]);
  useEffect(() => () => {
    if (zonePulseTimerRef.current) clearTimeout(zonePulseTimerRef.current);
    if (blockPulseTimerRef.current) clearTimeout(blockPulseTimerRef.current);
  }, []);

  useEffect(() => {
    if (activeTab !== "player" || currentQueueIndex < 0) return undefined;
    const timer = setTimeout(() => {
      queueListRef.current?.scrollToIndex?.({
        index: currentQueueIndex,
        animated: true,
        viewPosition: 0
      });
    }, 80);
    return () => clearTimeout(timer);
  }, [activeTab, currentQueueIndex]);

  const loadTags = async () => {
    const res = await fetch(`${API_BASE}/tags`);
    const data = await res.json();
    setTags(data.items || []);
  };

  const registerUser = async () => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: accountId.trim(),
        display_name: accountName.trim(),
        password: accountPassword,
        avatar: selectedAvatar
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "register failed");
    return data.user;
  };

  const loginUser = async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: accountId.trim(),
        password: accountPassword
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "login failed");
    return data.user;
  };

  const loadProfileTags = async (uid) => {
    if (!uid) return [];
    const res = await fetch(`${API_BASE}/user-tags?user_id=${uid}`);
    const data = await res.json();
    const items = data.items || [];
    setProfileTags(items);
    return items;
  };

  const refreshSongs = async (uid, options = {}) => {
    if (!uid) return [];
    const query = new URLSearchParams({ user_id: String(uid), buffer: String(options.buffer || 8) });
    if (options.cursorQueueId) query.set("cursor_queue_id", String(options.cursorQueueId));

    const res = await fetch(`${API_BASE}/recommend/next?${query.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "recommendation fetch failed");

    const seen = new Set();
    const items = (data.buffer || []).filter((item) => {
      if (!item?.audio_url) return false;
      const key = item.queue_id || item.id || item.audio_url;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    setRecommendationState({
      mode: String(data.mode || "stable"),
      skipStreak: Number(data.skip_streak || 0),
      needsGeneration: Boolean(data.needs_generation)
    });

    return items;
  };

  const refreshSongHistory = async (uid) => {
    if (!uid) return [];
    const res = await fetch(`${API_BASE}/songs?user_id=${uid}&include_history=true`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "song history fetch failed");
    const items = Array.isArray(data.items) ? data.items : [];
    setSongs(items);
    return items;
  };
  const refreshFavorites = async (uid) => {
    if (!uid) return [];
    const res = await fetch(`${API_BASE}/favorites?user_id=${uid}`);
    const data = await res.json();
    setFavorites(data.items || []);
    return data.items || [];
  };

  const refreshMySongs = async (uid) => {
    if (!uid) return [];
    const res = await fetch(`${API_BASE}/my-songs?user_id=${uid}`);
    const data = await res.json();
    setMySongs(data.items || []);
    return data.items || [];
  };

  const loadPlaylists = async (uid) => {
    if (!uid) return [];
    const res = await fetch(`${API_BASE}/playlists?user_id=${uid}`);
    const data = await res.json();
    setPlaylists(data.items || []);
    return data.items || [];
  };

  const loadPlaylistSongs = async (playlistId) => {
    if (!playlistId) return [];
    const res = await fetch(`${API_BASE}/playlists/${playlistId}/songs`);
    const data = await res.json();
    const items = data.items || [];
    setPlaylistSongs(items);
    setPlaylistSongsMap((prev) => ({ ...prev, [playlistId]: items }));
    return items;
  };

  const bootstrapUser = async (user, nameOverride) => {
    setSession({ userId: user.id, deviceId: user.device_id, accountId: user.account_id || user.device_id, name: nameOverride || user.display_name || accountName.trim() || user.account_id || user.device_id, avatar: user.avatar || selectedAvatar });
    const profile = await loadProfileTags(user.id);
    await Promise.all([playbackEngine.refresh({ buffer: 8 }), refreshSongHistory(user.id), refreshFavorites(user.id), refreshMySongs(user.id), loadPlaylists(user.id)]);
    const active = (profile || []).filter((item) => item.is_active !== false);
    setNeedsOnboarding(active.length === 0);
    setOnboardingStep(0);
  };

  const persistProfileTagWeight = async (tagId, weight) => {
    const uid = Number(userIdRef.current);
    if (!Number.isFinite(uid) || uid <= 0) return;
    const res = await fetch(API_BASE + "/user-tags/weight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: uid, tag_id: Number(tagId), weight: Number(weight) })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "weight update failed");
    }
    return res.json().catch(() => ({}));
  };

  const persistSceneAnchor = async (tagId) => {
    const uid = Number(userIdRef.current);
    if (!Number.isFinite(uid) || uid <= 0) return;
    const res = await fetch(API_BASE + "/user-tags/anchor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: uid, tag_id: Number(tagId) })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "anchor update failed");
    await loadProfileTags(uid);
    await playbackEngine.refresh({ buffer: 8 });
    return data;
  };

  const computeNextWeight = (currentWeight, zoneId) => {
    const value = clamp(Number(currentWeight || 0), 0, 1);
    if (zoneId === 2) {
      const lowered = value * 0.82 - 0.02;
      return lowered <= 0.015 ? 0 : Number(lowered.toFixed(3));
    }
    const raised = value + (1 - value) * 0.18 + 0.02;
    return Number(Math.min(1, raised).toFixed(3));
  };

  const applyProfileTagActionById = async (tagIdInput, zoneId, fallbackWeight = 0, options = {}) => {
    const { refreshAfter = true } = options;
    const tagId = Number(tagIdInput);
    if (!Number.isFinite(tagId) || zoneId === -1) return;
    const latestTags = profileTagsRef.current || [];
    const currentTag = latestTags.find((item) => Number(item.tag_id) === tagId);
    const baseWeight = currentTag?.weight ?? fallbackWeight;
    const nextWeight = computeNextWeight(baseWeight, zoneId);
    const nextActive = nextWeight > 0;

    setProfileTags((prev) => sortProfileTags(prev.map((item) => (
      Number(item.tag_id) === tagId ? { ...item, is_active: nextActive, weight: nextWeight } : item
    ))));

    try {
      await persistProfileTagWeight(tagId, nextWeight);
    } finally {
      if (refreshAfter) {
        await loadProfileTags(userIdRef.current);
      }
    }
  };
  useEffect(() => { loadTags().catch(() => setTags([])); }, []);

  useEffect(() => () => {
    if (soundRef.current) soundRef.current.unloadAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const next = buildPortraitBlocks(activeProfileTags, effectiveStageSize, blocksRef.current);
    blocksRef.current = next;
    setPortraitBlocks(next);
  }, [activeProfileTags, effectiveStageSize.width, effectiveStageSize.height]);

  useEffect(() => {
    let frameId;

    const tick = () => {
      const stage = stageSizeRef.current;
      const currentBlocks = blocksRef.current;
      if (currentBlocks.length > 0 && stage.width > 20 && stage.height > 20) {
        const next = currentBlocks.map(cloneBlock);

        for (const block of next) {
          if (block.isDragging) continue;
          const spring = block.needBackToAnchor ? BOUNCE_SPRING : STABLE_SPRING;
          const damping = block.needBackToAnchor ? BOUNCE_DAMPING : STABLE_DAMPING;
          const dx = block.anchorPos.x - block.currentPos.x;
          const dy = block.anchorPos.y - block.currentPos.y;
          block.velocity.x += dx * spring;
          block.velocity.y += dy * spring;
          block.velocity.x *= damping;
          block.velocity.y *= damping;
          if (Math.abs(block.velocity.x) < VELOCITY_EPSILON) block.velocity.x = 0;
          if (Math.abs(block.velocity.y) < VELOCITY_EPSILON) block.velocity.y = 0;
          block.currentPos.x += block.velocity.x;
          block.currentPos.y += block.velocity.y;
          block.currentSize += (block.targetSize - block.currentSize) * 0.25;
          block.flash = Math.max(0, Number(block.flash || 0) * 0.18 - 0.18);

          if (block.needBackToAnchor && Math.hypot(dx, dy) < 2 && Math.hypot(block.velocity.x, block.velocity.y) < 0.4) {
            block.currentPos = { ...block.anchorPos };
            block.velocity = { x: 0, y: 0 };
            block.needBackToAnchor = false;
          }

          keepBlockInBounds(block, stage);
        }
        applyRepulsion(next, stage, 0.082, 1);

        const settled = next.filter((block) => !(block.isExiting && block.currentPos.y <= -140));
        for (const block of settled) {
          if (block.isEntering && Math.abs(block.currentPos.y - block.anchorPos.y) < 8 && Math.hypot(block.velocity.x, block.velocity.y) < 0.65) {
            block.isEntering = false;
            block.needBackToAnchor = false;
            block.velocity = { x: 0, y: 0 };
          }
        }

        blocksRef.current = settled;
        setPortraitBlocks(settled);
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const moveDraggedBlock = (id, point) => {
    const stage = stageSizeRef.current;
    setPortraitBlocks((prev) => {
      const next = prev.map(cloneBlock);
      const target = next.find((item) => item.id === id);
      if (!target) return prev;
      const fallbackPoint = lastDragPointRef.current || target.currentPos;
      const isValidPoint = point
        && Number.isFinite(point.x)
        && Number.isFinite(point.y)
        && point.x >= -48
        && point.x <= stage.width + 48
        && point.y >= -48
        && point.y <= stage.height + 48;
      const candidatePoint = isValidPoint ? point : fallbackPoint;
      const settledPoint = sanitizeDragPoint(target, candidatePoint, stage);
      const zoneId = findZoneForBlock(target, settledPoint, stage);
      lastDragPointRef.current = settledPoint;
      activeZoneRef.current = zoneId;
      setActiveZoneId(zoneId);
      target.currentPos = settledPoint;
      target.velocity = { x: 0, y: 0 };
      target.isEntering = false;
      if (zoneId === -1) {
        target.anchorPos = settledPoint;
        target.needBackToAnchor = false;
      } else {
        target.needBackToAnchor = true;
      }
      applyRepulsion(next, stage, 0.11, 1);
      blocksRef.current = next;
      return next;
    });
  };

  const finishDraggedBlock = (id) => {
    const stage = stageSizeRef.current;
    const safePoint = lastDragPointRef.current || { x: stage.width / 2, y: stage.height / 2 };
    let affectedTagId = null;
    let affectedWeight = 0;
    let activeZone = activeZoneRef.current;

    setPortraitBlocks((prev) => {
      const next = prev.map(cloneBlock);
      const index = next.findIndex((item) => item.id === id);
      if (index < 0) return prev;
      const target = next[index];
      const dragPoint = sanitizeDragPoint(target, safePoint, stage);
      const zoneFromDragPoint = findZoneForBlock(target, dragPoint, stage);
      const zoneFromCurrentPos = findZoneForBlock(target, target.currentPos, stage);
      const zoneId = zoneFromDragPoint !== -1 ? zoneFromDragPoint : (zoneFromCurrentPos !== -1 ? zoneFromCurrentPos : activeZoneRef.current);
      const settledPoint = zoneId === -1 ? sanitizeBlockPoint(target, safePoint, stage) : dragPoint;
      activeZone = zoneId;
      affectedTagId = Number(target.id);
      affectedWeight = Number(target.tag?.weight || 0);
      target.currentPos = settledPoint;
      target.anchorPos = zoneId === -1 ? settledPoint : sanitizeBlockPoint(target, target.anchorPos, stage);
      target.isDragging = false;
      target.needBackToAnchor = zoneId !== -1;
      target.isEntering = false;
      target.velocity = { x: 0, y: 0 };
      applyRepulsion(next, stage, 0.11, 1);
      blocksRef.current = next;
      return next;
    });

    draggingIdRef.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
    dragStartBlockPosRef.current = { x: 0, y: 0 };
    lastDragPointRef.current = null;
    activeZoneRef.current = -1;
    setActiveZoneId(-1);
    setIsPortraitDragging(false);

    if (Number.isFinite(affectedTagId) && activeZone !== -1) {
      triggerZonePulse(activeZone);
      pulsePortraitBlock(affectedTagId);
      applyProfileTagActionById(affectedTagId, activeZone, affectedWeight).catch(() => {});
    }
  };

  const portraitResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (evt) => {
      if (activeTabRef.current !== "galaxy") return false;
      const point = { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY };
      return Boolean(pickBlockAtPoint(blocksRef.current, point));
    },
    onMoveShouldSetPanResponder: (_, gesture) => activeTabRef.current === "galaxy" && (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2),
    onPanResponderGrant: (evt) => {
      const point = { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY };
      const picked = pickBlockAtPoint(blocksRef.current, point);
      if (!picked) return;
      draggingIdRef.current = picked.id;

      setIsPortraitDragging(true);
      lastDragPointRef.current = { ...picked.currentPos };
      dragOffsetRef.current = { x: picked.currentPos.x - point.x, y: picked.currentPos.y - point.y };
      dragStartBlockPosRef.current = { ...picked.currentPos };
      setPortraitBlocks((prev) => {
        const next = prev.map(cloneBlock);
        const index = next.findIndex((item) => item.id === picked.id);
        if (index < 0) return prev;
        const [target] = next.splice(index, 1);
        target.isDragging = true;
        target.isEntering = false;
        target.velocity = { x: 0, y: 0 };
        target.needBackToAnchor = false;
        next.push(target);
        blocksRef.current = next;
        return next;
      });
    },
    onPanResponderMove: (_, gesture) => {
      const id = draggingIdRef.current;
      if (!id) return;
      const point = {
        x: dragStartBlockPosRef.current.x + (gesture?.dx || 0),
        y: dragStartBlockPosRef.current.y + (gesture?.dy || 0)
      };
      moveDraggedBlock(id, point);
    },
    onPanResponderRelease: () => {
      const id = draggingIdRef.current;
      if (!id) return;
      finishDraggedBlock(id);
    },
    onPanResponderTerminate: () => {
      const id = draggingIdRef.current;
      if (!id) return;
      finishDraggedBlock(id);
    }
  })).current;

  const submitAuth = async () => {
    const cleanId = accountId.trim().toLowerCase();
    const cleanName = accountName.trim();
    if (!cleanId) return Alert.alert(t("missingAccountTitle"), t("missingAccountBody"));
    if (!accountPassword) return Alert.alert(t("missingPasswordTitle"), t("missingPasswordBody"));
    if (authMode === "register") {
      if (!cleanName) return Alert.alert(t("missingUsernameTitle"), t("missingUsernameBody"));
      if (!selectedAvatar) return Alert.alert(t("missingAvatarTitle"), t("missingAvatarBody"));
      if (accountPassword.length < 6) return Alert.alert(t("weakPasswordTitle"), t("weakPasswordBody"));
      if (accountPassword !== accountPasswordConfirm) return Alert.alert(t("passwordMismatchTitle"), t("passwordMismatchBody"));
    }
    setAuthLoading(true);
    try {
      const user = authMode === "login" ? await loginUser() : await registerUser();
      await bootstrapUser(user, user.display_name || cleanName || cleanId);
      setAccountPassword("");
      setAccountPasswordConfirm("");
    } catch (err) {
      Alert.alert(authMode === "login" ? t("loginFailed") : t("registerFailed"), String(err.message || err));
    } finally {
      setAuthLoading(false);
    }
  };

  const submitOnboarding = async () => {
    if (!userId || seedSelection.size === 0) return Alert.alert("\u8bf7\u9009\u62e9\u6807\u7b7e", "\u81f3\u5c11\u5148\u9009\u4e00\u4e2a\u6807\u7b7e\u65b9\u5411");
    if (selectedSeedCategoryCount < 2) return Alert.alert("\u5206\u7c7b\u4e0d\u591f", "\u8bf7\u81f3\u5c11\u5728\u4e24\u4e2a\u4e0d\u540c\u5206\u7c7b\u4e2d\u9009\u62e9\u6807\u7b7e");
    await fetch(`${API_BASE}/init-tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, tag_ids: Array.from(seedSelection) })
    });
    await loadProfileTags(userId);
    await playbackEngine.refresh({ buffer: 8 });
    await refreshSongHistory(userId);
    await refreshFavorites(userId);
    await loadPlaylists(userId);
    setNeedsOnboarding(false);
    setOnboardingStep(0);
    setActiveTab("player");
  };

  const submitNamedTag = async (name, chosenType) => {
    const cleanName = String(name || "").trim();
    if (!userId || !cleanName) return setTagMessage("\u8bf7\u8f93\u5165\u6807\u7b7e\u540d\u79f0");
    const res = await fetch(`${API_BASE}/user-tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, name: cleanName, type: chosenType || undefined })
    });
    const data = await res.json();
    if (!res.ok) return setTagMessage(data.error || "\u6dfb\u52a0\u5931\u8d25");
    setNewTagName("");
    setPendingTagName("");
    setShowCategoryPicker(false);
    setTagMessage(existingTagMatch ? "\u5df2\u52a0\u5165\u5f53\u524d\u753b\u50cf" : "\u6807\u7b7e\u5df2\u63d0\u4ea4\uff0c\u4f1a\u5728\u63a2\u7d22\u5230\u5b83\u540e\u8fdb\u5165\u753b\u50cf");
    await loadTags();
    await loadProfileTags(userId);
  };

  const submitUserTag = async () => {
    setTagMessage("");
    const cleanName = newTagName.trim();
    if (!userId || !cleanName) return setTagMessage("\u8bf7\u8f93\u5165\u6807\u7b7e\u540d\u79f0");
    if (existingTagMatch) return submitNamedTag(cleanName, existingTagMatch.type);
    setPendingTagName(cleanName);
    setSelectedCategory(CATEGORY_ORDER[0] || "\u60c5\u7eea");
    setShowCategoryPicker(true);
  };

  const confirmCustomTagType = async () => {
    if (!pendingTagName) return;
    await submitNamedTag(pendingTagName, selectedCategory);
  };


  const generate = async (options = {}) => {
    const { prefetch = false, silent = false, preferLatest = !prefetch } = options;
    if (!userId || generationLoading) return songs;
    if (!prefetch) setGenerationLoading(true);
    try {
      const res = await fetch(`${API_BASE}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, instrumental: true, prefetch })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.detail || "generate failed");
      }

      const jobId = Number(data.job_id || 0);
      if (!jobId) {
        return refreshSongs(userId, { preferLatest });
      }

      const start = Date.now();
      while (Date.now() - start < 180000) {
        const jobRes = await fetch(`${API_BASE}/generation-jobs/${jobId}`);
        const jobData = await jobRes.json().catch(() => ({}));
        if (!jobRes.ok) {
          throw new Error(jobData.error || "generation job lookup failed");
        }
        const item = jobData.item || {};
        const status = String(item.status || data.status || "").toLowerCase();
        if (status === "failed") {
          throw new Error(item.error || data.error || "generation failed");
        }
        if ((status === "done" || status === "reused") && (item.song?.id || data.song_id)) {
          if (item.song) setLastGeneratedSong(item.song);
          await refreshMySongs(userId);
          await refreshSongHistory(userId);
          return refreshSongs(userId, { preferLatest });
        }
        await wait(3000);
      }

      throw new Error("generation timed out");
    } catch (err) {
      if (!silent) Alert.alert(t("generationFailed"), String(err));
      return songs;
    } finally {
      if (!prefetch) setGenerationLoading(false);
    }
  };


  useEffect(() => {
    autoGenerateRef.current = async () => {
      if (!userId || prefetchLockRef.current) return false;
      prefetchLockRef.current = true;
      try {
        await generate({ prefetch: true, silent: true, preferLatest: true });
        await playbackEngine.refresh({ buffer: 8 }).catch(() => []);
        return true;
      } finally {
        prefetchLockRef.current = false;
      }
    };
  }, [generate, playbackEngine, userId]);

  const getNextSongFromList = (baseSong, list) => {
    if (!baseSong || !Array.isArray(list) || list.length === 0) return null;
    const index = list.findIndex((item) => queueKeyOf(item) === queueKeyOf(baseSong));
    if (index >= 0 && index < list.length - 1) return list[index + 1];
    return null;
  };

  const ensureNextSongReady = async (playingSong) => {
    if (!userId || !playingSong) return;
    const queueSnapshot = songsRef.current || [];
    if (getNextSongFromList(playingSong, queueSnapshot)) return;
    try {
      await refreshSongs(userId, { cursorQueueId: queueKeyOf(playingSong), buffer: 8 });
    } catch {}
  };

  const attachStatus = (status) => {
    if (!status?.isLoaded) return;
    setPlayback((prev) => ({
      position: seekingRef.current ? prev.position : (status.positionMillis || 0),
      duration: status.durationMillis || prev.duration || 1,
      isPlaying: status.isPlaying
    }));
    if (!seekingRef.current) setSeekPreviewPosition(null);
    if (status.didJustFinish && current && completeSentFor.current !== current.id) {
      completeSentFor.current = current.id;
      handleAutoNext("complete").catch(() => {});
    }
  };

  const play = async (song) => {
    await playbackEngine.playSong(song);
  };

  const togglePlay = async () => {
    await playbackEngine.togglePlay();
  };

  const feedback = async (action) => {
    if (action === "like") {
      await playbackEngine.likeCurrent();
      return;
    }
    if (action === "skip" || action === "complete") {
      await playbackEngine.next(action);
    }
  };

  const handleQueueExhausted = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
    }
    setSound(null);
    setCurrent(null);
    setCurrentSoundId(null);
    setPlayback((prev) => ({ ...prev, position: 0, isPlaying: false }));

    const fresh = await refreshSongs(userId, { buffer: 8 }).catch(() => []);
    if (fresh.length > 0) {
      await play(fresh[0]);
      return true;
    }

    if (recommendationState.needsGeneration) {
      Alert.alert(t("noSongsReadyTitle"), t("noSongsReadyBody"));
      setActiveTab("galaxy");
    }
    return false;
  };

  const handleAutoNext = async (action) => {
    await playbackEngine.next(action === "complete" ? "complete" : "skip");
    await Promise.all([refreshProfileSoon(), refreshSongHistory(userId)]);
  };

  const handleNext = async () => {
    await playbackEngine.next("skip");
    await Promise.all([refreshProfileSoon(), refreshSongHistory(userId)]);
  };

  const createPlaylist = async () => {
    if (!userId || !newPlaylistName.trim()) return;
    await fetch(`${API_BASE}/playlists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, name: newPlaylistName.trim() })
    });
    setNewPlaylistName("");
    await loadPlaylists(userId);
  };

  const addSongToPlaylist = async (playlistId, song = playbackEngine.current) => {
    if (!song || !playlistId) return;
    await fetch(`${API_BASE}/playlists/${playlistId}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ song_id: song.id })
    });
  };

  const enqueueSongToTail = (song, source = "manual") => {
    playbackEngine.appendQueue(song, source);
  };

  const enqueueSongsToTail = (list, source = "playlist") => {
    playbackEngine.appendQueue(list, source);
  };

  const insertSongAsNext = async (song, source = "manual-next") => {
    await playbackEngine.insertQueueNextAndPlay(song, source);
  };

  const insertSongsAsNext = async (list, source = "playlist-next") => {
    await playbackEngine.insertQueueNextAndPlay(list, source);
  };

  const testConnection = async () => {
    setHealth({ loading: true, ok: null, message: "" });
    try {
      const res = await fetch(`${API_BASE}/tags`);
      const data = await res.json();
      setHealth({ loading: false, ok: res.ok, message: `API: ${API_BASE} | items: ${data.items ? data.items.length : 0}` });
    } catch (err) {
      setHealth({ loading: false, ok: false, message: `API: ${API_BASE} | ${String(err)}` });
    }
  };

  const refreshAllData = async () => {
    if (!userId) return;
    await Promise.all([loadTags(), loadProfileTags(userId), playbackEngine.refresh({ buffer: 8 }), refreshSongHistory(userId), refreshFavorites(userId), refreshMySongs(userId), loadPlaylists(userId)]);
    setHealth({ loading: false, ok: true, message: "\u6570\u636e\u5df2\u5237\u65b0" });
  };

  const logout = async () => {
    if (soundRef.current) await soundRef.current.unloadAsync().catch(() => {});
    setSound(null);
    setSession(null);
    setNeedsOnboarding(false);
    setSeedSelection(new Set());
    setOnboardingStep(0);
    setProfileTags([]);
    setSongs([]);
    setFavorites([]);
    setMySongs([]);
    setPlaylists([]);
    setPlaylistSongsMap({});
    setPlaylistSongs([]);
    setSelectedPlaylistId(null);
    setLastGeneratedSong(null);
    setZonePulseId(-1);
    setCurrent(null);
    setCurrentSoundId(null);
    setActiveTab("player");
    setShowPlaylistPicker(false);
    setPortraitBlocks([]);
    setAccountPassword("");
    setAccountPasswordConfirm("");
  };

  const measureProgressTrack = (callback) => {
    if (!progressTrackRef.current?.measureInWindow) {
      if (callback) callback(progressLayoutRef.current);
      return;
    }
    progressTrackRef.current.measureInWindow((pageX, pageY, trackWidth, trackHeight) => {
      const layout = { width: trackWidth, pageX, pageY, height: trackHeight };
      progressLayoutRef.current = layout;
      setProgressLayout(layout);
      if (callback) callback(layout);
    });
  };

  const getSeekPositionFromPageX = (pageX, layout = progressLayoutRef.current) => {
    if (!layout?.width) return playbackRef.current.position || 0;
    const localX = Math.min(layout.width, Math.max(0, pageX - layout.pageX));
    const percent = layout.width > 0 ? localX / layout.width : 0;
    return Math.floor(percent * (playbackRef.current.duration || 0));
  };

  const finishSeek = async (pageX, layout = progressLayoutRef.current) => {
    const currentSound = soundRef.current;
    const nextPosition = getSeekPositionFromPageX(pageX, layout);
    setPlayback((prev) => ({ ...prev, position: nextPosition }));
    setSeekPreviewPosition(null);
    setIsSeeking(false);
    seekingRef.current = false;
    if (!currentSound) return;
    await currentSound.setPositionAsync(nextPosition);
  };

  const progressResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => Boolean(soundRef.current),
    onMoveShouldSetPanResponder: () => Boolean(soundRef.current),
    onPanResponderGrant: (_, gesture) => {
      if (!soundRef.current) return;
      setIsSeeking(true);
      seekingRef.current = true;
      measureProgressTrack((layout) => {
        setSeekPreviewPosition(getSeekPositionFromPageX(gesture.x0 || gesture.moveX, layout));
      });
    },
    onPanResponderMove: (_, gesture) => {
      if (!soundRef.current) return;
      if (!seekingRef.current) {
        setIsSeeking(true);
        seekingRef.current = true;
      }
      setSeekPreviewPosition(getSeekPositionFromPageX(gesture.moveX));
    },
    onPanResponderRelease: async (_, gesture) => {
      await finishSeek(gesture.moveX);
    },
    onPanResponderTerminate: async (_, gesture) => {
      await finishSeek(gesture.moveX || gesture.x0 || 0);
    }
  })).current;

  const renderAuth = () => (
    <SafeAreaView style={styles.page}>
      <PortraitBackdrop blocks={portraitBlocks} stageSize={{ width, height }} />
      <ScrollView contentContainerStyle={styles.authShell} showsVerticalScrollIndicator={false}>
        <View style={styles.authCard}>
          <View style={styles.authModeRow}>
            <TouchableOpacity style={[styles.authMode, authMode === "login" && styles.authModeActive]} onPress={() => setAuthMode("login")}>
              <Text style={[styles.authModeText, authMode === "login" && styles.authModeTextActive]}>{language === "en" ? "Login" : "登录"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.authMode, authMode === "register" && styles.authModeActive]} onPress={() => setAuthMode("register")}>
              <Text style={[styles.authModeText, authMode === "register" && styles.authModeTextActive]}>{language === "en" ? "Register" : "注册"}</Text>
            </TouchableOpacity>
          </View>
          {authMode === "register" ? (
            <>
              <TextInput value={accountName} onChangeText={setAccountName} placeholder={t("username")} placeholderTextColor="#B9C2CE" style={styles.input} />
              <Text style={styles.avatarPickerLabel}>{t("chooseAvatar")}</Text>
              <View style={styles.avatarPickerRow}>
                {AUTH_AVATARS.map((avatar) => (
                  <TouchableOpacity key={avatar} style={[styles.avatarChip, selectedAvatar === avatar && styles.avatarChipActive]} onPress={() => setSelectedAvatar(avatar)}>
                    <Text style={styles.avatarChipText}>{avatar}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}
          <TextInput value={accountId} onChangeText={(value) => setAccountId(value.replace(/\s+/g, "").toLowerCase())} placeholder={t("accountId")} placeholderTextColor="#B9C2CE" autoCapitalize="none" style={styles.input} />
          <TextInput value={accountPassword} onChangeText={setAccountPassword} placeholder={t("password")} placeholderTextColor="#B9C2CE" secureTextEntry style={styles.input} />
          {authMode === "register" ? (
            <TextInput value={accountPasswordConfirm} onChangeText={setAccountPasswordConfirm} placeholder={t("confirmPassword")} placeholderTextColor="#B9C2CE" secureTextEntry style={styles.input} />
          ) : null}
          <TouchableOpacity style={styles.primary} onPress={submitAuth} disabled={authLoading}>
            {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{authMode === "login" ? t("loginRestore") : t("registerContinue")}</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  const renderOnboarding = () => (
    <SafeAreaView style={styles.page}>
      <PortraitBackdrop blocks={portraitBlocks} stageSize={{ width, height }} />
      <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>
        <ScreenTitle title={t("pickInitialTags")} subtitle={t("pickInitialTagsSub")} />
        <View style={styles.groupCard}>
          <View style={styles.onboardingProgressHeader}>
            <Text style={styles.groupTitle}>{currentOnboarding ? currentOnboarding[0] : t("done")}</Text>
            <Text style={styles.hintText}>{t("stepLabel", { current: Math.min(onboardingStep + 1, onboardingGroups.length || 1), total: Math.max(1, onboardingGroups.length) })}</Text>
          </View>
          <View style={styles.onboardingProgressTrack}>
            <View style={[styles.onboardingProgressFill, { width: String(((Math.min(onboardingStep + 1, onboardingGroups.length || 1)) / Math.max(1, onboardingGroups.length)) * 100) + "%" }]} />
          </View>
          {currentOnboarding ? (
            <View style={styles.seedWrap}>
              {currentOnboarding[1].map((item) => (
                <SeedTag
                  key={item.id}
                  item={item}
                  selected={seedSelection.has(item.id)}
                  onPress={(tag) => {
                    const next = new Set(seedSelection);
                    if (next.has(tag.id)) next.delete(tag.id);
                    else next.add(tag.id);
                    setSeedSelection(next);
                  }}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.placeholder}>{t("allCategoriesCompleted")}</Text>
          )}
          <View style={styles.rowGap}>
            <TouchableOpacity style={[styles.secondarySoft, styles.flex]} onPress={() => setOnboardingStep((prev) => Math.max(0, prev - 1))}>
              <Text style={styles.secondaryText}>{t("back")}</Text>
            </TouchableOpacity>
            {onboardingStep < onboardingGroups.length - 1 ? (
              <TouchableOpacity style={[styles.primary, styles.flex]} onPress={() => setOnboardingStep((prev) => Math.min(onboardingGroups.length - 1, prev + 1))}>
                <Text style={styles.primaryText}>{t("next")}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.primary, styles.flex]} onPress={submitOnboarding}>
                <Text style={styles.primaryText}>{t("enterApp")}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  const renderPlayer = () => {
    const playerCurrent = playbackEngine.current;
    const hasPendingGeneration = Boolean(playbackEngine.recommendation?.hasPendingGeneration);
    const playerPlayback = playbackEngine.playback || { position: 0, duration: 1, isPlaying: false };
    const playerNeedsGeneration = Boolean(playbackEngine.recommendation?.needsGeneration);
    const playerStatus = String(playbackEngine.status || "idle");
    const playerError = String(playbackEngine.lastError || "");
    const displayedPosition = playerPlayback.position || 0;
    const progressPercent = Math.min(1, Math.max(0, (displayedPosition || 0) / Math.max(playerPlayback.duration || 1, 1)));
    const shouldShowQueueSkeleton = Boolean(
      playerStatus === "loading"
      || hasPendingGeneration
      || (playerNeedsGeneration && displayQueue.length > 0)
    );

    return (
      <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>
        <View style={styles.anchorStrip}>
          <Text style={styles.anchorStripLabel}>{t("sceneAnchor")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.anchorChipRow}>
            {sceneOptions.length > 0 ? sceneOptions.map((tag) => {
              const selected = Number(activeSceneAnchor?.tag_id || activeSceneAnchor?.id || 0) === Number(tag.id);
              return (
                <TouchableOpacity
                  key={String(tag.id)}
                  style={[styles.anchorChip, selected && styles.anchorChipActive]}
                  onPress={async () => {
                    try {
                      await persistSceneAnchor(tag.id);
                    } catch (err) {
                      Alert.alert(t("anchorUpdateFailed"), String(err?.message || err));
                    }
                  }}
                >
                  <Text style={[styles.anchorChipText, selected && styles.anchorChipTextActive]}>{tag.name}</Text>
                </TouchableOpacity>
              );
            }) : [0, 1, 2].map((index) => (
              <View key={"scene-skeleton-" + index} style={styles.anchorChipSkeleton} />
            ))}
          </ScrollView>
        </View>

        {playerStatus === "error" && playerError ? (
          <View style={styles.playerErrorBox}>
            <Text style={styles.playerErrorText} numberOfLines={2}>{playerError}</Text>
          </View>
        ) : null}

        <View style={styles.playerCard}>
          <View style={styles.coverWrap}>
            <SongArtwork uri={playerCurrent?.cover_url} size={228} radius={34} label={playerCurrent?.title || "TPY"} />
          </View>
          <Text style={styles.playerTitle}>{playerCurrent?.title || "No song yet"}</Text>
          <Text style={styles.playerSub} numberOfLines={2}>{songTagText(playerCurrent)}</Text>
          {!playerCurrent && playerNeedsGeneration ? (
            <TouchableOpacity style={styles.secondarySoft} onPress={() => setActiveTab("galaxy")}>
              <Text style={styles.secondaryText}>{t("noPlayableSongs")}</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.progressWrap}>
            <View style={styles.progressTrackShell}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: String(progressPercent * 100) + "%" }]} />
              </View>
            </View>
            <View style={styles.progressTimeRow}>
              <Text style={styles.progressText}>{formatTime(displayedPosition)}</Text>
              <Text style={styles.progressText}>{formatTime(playerPlayback.duration)}</Text>
            </View>
          </View>

          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={async () => {
                if (!playerCurrent) return;
                await playbackEngine.likeCurrent();
                await refreshProfileSoon();
                const list = await loadPlaylists(userId);
                if (list.length === 0) {
                  Alert.alert(t("noPlaylistTitle"), t("noPlaylistBody"));
                  setActiveTab("favorites");
                  return;
                }
                setShowPlaylistPicker(true);
              }}
            >
              <Text style={styles.controlText}>{t("favorite")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
              <Text style={styles.playText}>{playerCurrent ? (playerPlayback.isPlaying ? t("pause") : t("play")) : t("refresh")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlBtn} onPress={handleNext}>
              <Text style={styles.controlText}>{t("next")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showPlaylistPicker ? (
          <View style={styles.groupCard}>
            <Text style={styles.groupTitle}>{t("saveToPlaylist")}</Text>
            {playlists.map((playlist) => (
              <TouchableOpacity
                key={playlist.id}
                style={styles.listItem}
                onPress={async () => {
                  await addSongToPlaylist(playlist.id, playbackEngine.current);
                  if (selectedPlaylistId === playlist.id) await loadPlaylistSongs(playlist.id);
                  setShowPlaylistPicker(false);
                }}
              >
                <View>
                  <Text style={styles.listTitle}>{playlist.name}</Text>
                  <Text style={styles.listSub}>{t("songsCount", { count: playlist.song_count || 0 })}</Text>
                </View>
                <Text style={styles.chevron}>{">"}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.secondarySoft} onPress={() => setShowPlaylistPicker(false)}>
              <Text style={styles.secondaryText}>{t("cancel")}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.section}>
          {displayQueue.length > 0 ? (
            <View style={styles.queueViewport}>
              <FlatList
                ref={queueListRef}
                data={displayQueue}
                keyExtractor={(item) => String(queueKeyOf(item))}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.queueContent}
                onScrollToIndexFailed={({ index }) => {
                  setTimeout(() => {
                    queueListRef.current?.scrollToIndex?.({ index, animated: true, viewPosition: 0 });
                  }, 120);
                }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.listItem, queueKeyOf(playerCurrent) === queueKeyOf(item) && styles.currentQueueItem]}
                    onPress={() => play(item)}
                  >
                    <View style={styles.songListMain}>
                      <SongArtwork uri={item.cover_url} size={56} radius={18} label={item.title || "TPY"} />
                      <View style={styles.songListText}>
                        <Text style={styles.listTitle}>{item.title || "Untitled"}</Text>
                        <Text style={styles.listSub} numberOfLines={1}>{songTagText(item)}</Text>
                      </View>
                    </View>
                    <Text style={styles.chevron}>{">"}</Text>
                  </TouchableOpacity>
                )}
                ListFooterComponent={shouldShowQueueSkeleton ? (
                  <View style={[styles.listItem, styles.queueSkeletonItem]}>
                    <View style={styles.songListMain}>
                      <View style={styles.queueSkeletonArtwork} />
                      <View style={styles.songListText}>
                        <View style={[styles.queueSkeletonLine, styles.queueSkeletonLinePrimary]} />
                        <View style={[styles.queueSkeletonLine, styles.queueSkeletonLineSecondary]} />
                      </View>
                    </View>
                  </View>
                ) : null}
              />
              <View pointerEvents="none" style={styles.queueTopFade}>
                <View style={styles.queueTopFadeLayerStrong} />
                <View style={styles.queueTopFadeLayerMid} />
                <View style={styles.queueTopFadeLayerSoft} />
              </View>
            </View>
          ) : (
            <View style={styles.queueEmptyBox}>
              {shouldShowQueueSkeleton ? (
                <View style={styles.queueSkeletonStandalone}>
                  <View style={styles.queueSkeletonArtwork} />
                  <View style={styles.songListText}>
                    <View style={[styles.queueSkeletonLine, styles.queueSkeletonLinePrimary]} />
                    <View style={[styles.queueSkeletonLine, styles.queueSkeletonLineSecondary]} />
                  </View>
                </View>
              ) : (
                <Text style={styles.placeholder}>{t("noSongsReady")}</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    );
  };
  const renderFavorites = () => (
    <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>

      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>{t("newPlaylist")}</Text>
        <TextInput value={newPlaylistName} onChangeText={setNewPlaylistName} placeholder={t("newPlaylistPlaceholder")} placeholderTextColor="#B9C2CE" style={styles.input} />
        <TouchableOpacity style={styles.primary} onPress={createPlaylist}>
          <Text style={styles.primaryText}>{t("create")}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>{t("myPlaylists")}</Text>
        {playlists.length === 0 ? (
          <Text style={styles.placeholder}>{t("noPlaylistYet")}</Text>
        ) : playlists.map((playlist) => {
          const expanded = selectedPlaylistId === playlist.id;
          const songsInPlaylist = playlistSongsMap[playlist.id] || [];
          return (
            <View key={playlist.id} style={styles.playlistBox}>
              <View style={styles.playlistRow}>
                <TouchableOpacity
                  style={styles.flex}
                  onPress={async () => {
                    if (expanded) {
                      setSelectedPlaylistId(null);
                    } else {
                      setSelectedPlaylistId(playlist.id);
                      await loadPlaylistSongs(playlist.id);
                    }
                  }}
                >
                  <Text style={styles.listTitle}>{playlist.name}</Text>
                  <Text style={styles.listSub}>{"Songs " + (playlist.song_count || 0)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.playlistPlus}
                  onPress={async () => {
                    const list = songsInPlaylist.length > 0 ? songsInPlaylist : await loadPlaylistSongs(playlist.id);
                    await insertSongsAsNext(list, "playlist-" + String(playlist.id));
                  }}
                >
                  <Text style={styles.playlistPlusText}>+</Text>
                </TouchableOpacity>
              </View>

              {expanded ? (
                <View style={{ marginTop: 10 }}>
                  {songsInPlaylist.length === 0 ? (
                    <Text style={styles.placeholder}>{t("playlistEmpty")}</Text>
                  ) : songsInPlaylist.map((song) => (
                    <TouchableOpacity key={String(playlist.id) + "-" + String(song.id)} style={styles.listItem} onPress={() => insertSongAsNext(song, "playlist-song-" + String(playlist.id))}>
                      <View style={styles.songListMain}>
                        <SongArtwork uri={song.cover_url} size={56} radius={18} label={song.title || "TPY"} />
                        <View style={styles.songListText}>
                          <Text style={styles.listTitle}>{song.title || "Untitled"}</Text>
                          <Text style={styles.listSub} numberOfLines={1}>{songTagText(song)}</Text>
                        </View>
                      </View>
                      <Text style={styles.chevron}>{">"}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>{t("myGeneratedSongs")}</Text>
        {mySongs.length === 0 ? (
          <Text style={styles.placeholder}>{t("noGeneratedSongs")}</Text>
        ) : mySongs.map((song) => (
          <View key={String(song.id) + "-mine"} style={styles.playlistBox}>
            <TouchableOpacity style={styles.listItem} onPress={() => enqueueSongToTail(song, "my-song-" + String(song.id))}>
              <View style={styles.songListMain}>
                <SongArtwork uri={song.cover_url} size={56} radius={18} label={song.title || "TPY"} />
                <View style={styles.songListText}>
                  <Text style={styles.listTitle}>{song.title || "Untitled"}</Text>
                  <Text style={styles.listSub} numberOfLines={1}>{songTagText(song)}</Text>
                  <Text style={styles.listSub} numberOfLines={1}>{`${song.is_public ? t("public") : t("private")} - ${song.is_available ? t("enabled") : t("disabled")} - ${song.generation_source || "portrait_manual"}`}</Text>
                </View>
              </View>
              <Text style={styles.chevron}>{">"}</Text>
            </TouchableOpacity>
            <View style={styles.workMetaRow}>
              <Text style={styles.workMetaText}>{`ID ${song.id} - ${song.creator_type || "user"} - ${song.revenue_enabled ? t("revenueOn") : t("revenueOff")}`}</Text>
              <Text style={styles.workMetaText}>{new Date(song.created_at).toLocaleString()}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderGalaxy = () => {
    const zones = getFuncZones(effectiveStageSize);

    return (
      <View style={styles.galaxyScreen} onLayout={(event) => setPortraitStageSize(event.nativeEvent.layout)}>
        <PortraitBackdrop blocks={portraitBlocks} stageSize={effectiveStageSize} />

        <View style={styles.zoneRow} pointerEvents="box-none">
          {zones.map((zone) => {
            const zoneLit = zonePulseId === zone.id || (isPortraitDragging && activeZoneId === zone.id);
            return (
              <View
                key={zone.id}
                style={[
                  styles.zoneCard,
                  zoneLit && styles.zoneCardActive,
                  zone.id === 1 && zoneLit && styles.zoneDeleteActive,
                  zone.id === 2 && zoneLit && styles.zoneSmallerActive,
                  zone.id === 3 && zoneLit && styles.zoneBiggerActive
                ]}
              >
                <Text style={styles.zoneLabel}>{zone.key === "smaller" ? t("softer") : t("stronger")}</Text>
                <Text style={styles.zoneHint}>{zone.key === "smaller" ? t("lowerWeight") : t("raiseWeight")}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.galaxyStage} {...portraitResponder.panHandlers}>
          {portraitBlocks.length === 0 ? (
            <View style={styles.emptyGalaxy}>
              <Text style={styles.emptyGalaxyTitle}>{t("noTagsYet")}</Text>
              <Text style={styles.emptyGalaxyText}>{t("noTagsYetSub")}</Text>
            </View>
          ) : portraitBlocks.map((block) => (
            <PortraitTag key={block.id} block={block} isDragging={block.id === draggingIdRef.current} />
          ))}
        </View>

        <View
          pointerEvents={isPortraitDragging ? "none" : "auto"}
          style={[
            styles.galaxySheet,
            isUtilitySheetCollapsed && styles.galaxySheetCollapsed,
            isPortraitDragging && styles.galaxySheetDragging
          ]}
        >
          <TouchableOpacity
            style={styles.utilitySheetToggle}
            onPress={() => setIsUtilitySheetCollapsed((prev) => !prev)}
          >
            <Text style={styles.utilitySheetArrow}>{isUtilitySheetCollapsed ? "\u25be" : "\u25b4"}</Text>
          </TouchableOpacity>

          {!isUtilitySheetCollapsed ? (<>
          <View style={[styles.sheetCard, isTagSheetCollapsed && styles.sheetCardCollapsed]}>
            <TouchableOpacity style={[styles.sheetHeader, isTagSheetCollapsed && styles.sheetHeaderCollapsed]} onPress={() => setIsTagSheetCollapsed((prev) => !prev)}>
              <Text style={[styles.groupTitle, isTagSheetCollapsed && styles.groupTitleCollapsed]}>{t("addTag")}</Text>
              <Text style={styles.sheetToggleText}>{isTagSheetCollapsed ? t("expand") : t("collapse")}</Text>
            </TouchableOpacity>

            {!isTagSheetCollapsed ? (
              <>
                <TextInput value={newTagName} onChangeText={setNewTagName} placeholder={t("tagName")} placeholderTextColor="#B9C2CE" style={styles.input} />
                {existingTagMatch ? (
                  <Text style={styles.hintText}>{t("existingCategoryFound", { type: existingTagMatch.type })}</Text>
                ) : (
                  null
                )}
                <TouchableOpacity style={styles.primary} onPress={submitUserTag}>
                  <Text style={styles.primaryText}>{t("addToPortrait")}</Text>
                </TouchableOpacity>

                {showCategoryPicker ? (
                  <View style={styles.categoryPickerCard}>
                    <Text style={styles.categoryPickerTitle}>{t("chooseCategoryFor", { tag: pendingTagName })}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPickerRow}>
                      {CATEGORY_ORDER.map((type) => (
                        <TouchableOpacity key={type} style={[styles.categoryChip, selectedCategory === type && styles.categoryChipActive]} onPress={() => setSelectedCategory(type)}>
                          <Text style={[styles.categoryChipText, selectedCategory === type && styles.categoryChipTextActive]}>{type}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <View style={styles.rowGap}>
                      <TouchableOpacity
                        style={[styles.secondarySoft, styles.flex]}
                        onPress={() => {
                          setShowCategoryPicker(false);
                          setPendingTagName("");
                        }}
                      >
                        <Text style={styles.secondaryText}>{t("cancel")}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.primary, styles.flex]} onPress={confirmCustomTagType}>
                        <Text style={styles.primaryText}>{t("confirm")}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
                {tagMessage ? <Text style={styles.hintText}>{tagMessage}</Text> : null}
              </>
            ) : null}
          </View>

          <View style={[styles.sheetCard, styles.generateSectionCard, isGenerateSheetCollapsed && styles.sheetCardCollapsed]}>
            <TouchableOpacity style={[styles.sheetHeader, isGenerateSheetCollapsed && styles.sheetHeaderCollapsed]} onPress={() => setIsGenerateSheetCollapsed((prev) => !prev)}>
              <Text style={[styles.groupTitle, isGenerateSheetCollapsed && styles.groupTitleCollapsed]}>{t("generateSongs")}</Text>
              <Text style={styles.sheetToggleText}>{isGenerateSheetCollapsed ? t("expand") : t("collapse")}</Text>
            </TouchableOpacity>
            {!isGenerateSheetCollapsed ? (
              <>
                <TouchableOpacity
                  style={styles.secondarySoft}
                  onPress={async () => {
                    await generate({ prefetch: false, silent: false, preferLatest: true });
                    await playbackEngine.refresh({ buffer: 8 });
                  }}
                >
                  <Text style={styles.secondaryText}>{generationLoading ? t("generating") : t("generateFromPortrait")}</Text>
                </TouchableOpacity>
                {generationLoading ? (
                  <View style={[styles.listItem, styles.queueSkeletonItem, styles.generateSkeleton]}>
                    <View style={styles.songListMain}>
                      <View style={styles.queueSkeletonArtwork} />
                      <View style={styles.songListText}>
                        <View style={[styles.queueSkeletonLine, styles.queueSkeletonLinePrimary]} />
                        <View style={[styles.queueSkeletonLine, styles.queueSkeletonLineSecondary]} />
                      </View>
                    </View>
                  </View>
                ) : lastGeneratedSong ? (
                  <TouchableOpacity
                    style={styles.generatedInfoCard}
                    onPress={async () => {
                      await insertSongAsNext(lastGeneratedSong, "portrait-generated");
                      setActiveTab("player");
                    }}
                  >
                    <View style={styles.songListMain}>
                      <SongArtwork uri={lastGeneratedSong.cover_url} size={56} radius={18} label={lastGeneratedSong.title || "TPY"} />
                      <View style={styles.songListText}>
                        <Text style={styles.listTitle}>{lastGeneratedSong.title || "Untitled"}</Text>
                        <Text style={styles.listSub} numberOfLines={2}>{songTagText(lastGeneratedSong)}</Text>
                        <Text style={styles.listSub}>{lastGeneratedSong.source || t("generated")}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : null}
          </View>
          </>) : null}
        </View>
      </View>
    );
  };
  const renderSettings = () => (
    <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>
      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>{t("currentAccount")}</Text>
        <View style={styles.accountCard}>
          <View style={styles.accountAvatar}><Text style={styles.accountAvatarText}>{session?.avatar || "\uD83C\uDFA7"}</Text></View>
          <Text style={styles.accountName}>{displayName}</Text>
          <Text style={styles.accountMeta}>{(language === "en" ? "Account ID: " : "\u8d26\u53f7 ID\uff1a") + String(session?.accountId || session?.deviceId || "")}</Text>
          <Text style={styles.accountMeta}>{(language === "en" ? "User ID: " : "\u7528\u6237 ID\uff1a") + String(session?.userId || "")}</Text>
        </View>
      </View>
      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>{t("language")}</Text>
                <View style={styles.rowGap}>
          {LANGUAGE_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[styles.secondarySoft, styles.flex, language === option.key && styles.languageOptionActive]}
              onPress={() => setLanguage(option.key)}
            >
              <Text style={[styles.secondaryText, language === option.key && styles.languageOptionTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>{t("accountAction")}</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={logout}>
          <Text style={styles.dangerText}>{t("logout")}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  if (!session) return renderAuth();
  if (needsOnboarding) return renderOnboarding();

  return (
    <SafeAreaView style={styles.page}>
      {activeTab !== "galaxy" ? <PortraitBackdrop blocks={portraitBlocks} stageSize={{ width, height }} /> : null}
      <View style={styles.content}>
        {activeTab === "player" && renderPlayer()}
        {activeTab === "favorites" && renderFavorites()}

        {activeTab === "galaxy" && renderGalaxy()}
        {activeTab === "settings" && renderSettings()}
      </View>
      <View style={styles.tabBarShell}>
        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <TouchableOpacity key={tab.key} style={styles.tabItem} onPress={() => setActiveTab(tab.key)}>
                            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0B1018" },
  content: { flex: 1 },
  backdropLayer: { ...StyleSheet.absoluteFillObject },
  backdropBase: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0D121B" },
  backdropCanvas: { ...StyleSheet.absoluteFillObject },
  backdropSoftener: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(9,12,18,0.025)" },
  screenPadding: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 120 },
  titleBlock: { marginBottom: 18 },
  eyebrow: { fontSize: 11, fontWeight: "800", color: "rgba(236,240,246,0.72)", letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 8 },
  eyebrowLight: { color: "rgba(255,255,255,0.66)" },
  title: { fontSize: 34, fontWeight: "800", color: "#F3F6FA", letterSpacing: -0.9 },
  titleLight: { color: "#FFFFFF" },
  subtitle: { fontSize: 15, color: "rgba(232,238,246,0.74)", lineHeight: 22, marginTop: 8 },
  subtitleLight: { color: "rgba(255,255,255,0.74)" },
  authShell: { flexGrow: 1, justifyContent: "center", padding: 20 },
  authCard: { backgroundColor: "rgba(12,18,28,0.76)", borderRadius: 30, padding: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", shadowColor: "#000000", shadowOpacity: 0.24, shadowOffset: { width: 0, height: 18 }, shadowRadius: 28, elevation: 10 },
  authEyebrow: { fontSize: 12, fontWeight: "800", color: "rgba(255,255,255,0.6)", letterSpacing: 1.8, marginBottom: 12 },
  authTitle: { fontSize: 31, fontWeight: "800", color: "#FFFFFF", lineHeight: 38, letterSpacing: -0.9 },
  authSubtitle: { fontSize: 15, color: "rgba(232,238,246,0.76)", lineHeight: 22, marginTop: 10, marginBottom: 16 },
  authModeRow: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 18, padding: 4, marginBottom: 14 },
  authMode: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 14 },
  authModeActive: { backgroundColor: "rgba(255,255,255,0.14)" },
  authModeText: { color: "rgba(255,255,255,0.56)", fontWeight: "700" },
  authModeTextActive: { color: "#FFFFFF" },
  avatarPickerLabel: { color: "rgba(255,255,255,0.76)", fontSize: 13, fontWeight: "700", marginBottom: 10, marginTop: 2 },
  avatarPickerRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  avatarChip: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", marginRight: 10, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  avatarChipActive: { backgroundColor: "rgba(255,255,255,0.18)", borderColor: "rgba(255,255,255,0.3)" },
  avatarChipText: { fontSize: 22 },
  input: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 16, paddingVertical: 15, marginBottom: 10, color: "#FFFFFF" },
  primary: { backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 20, paddingVertical: 16, alignItems: "center", marginTop: 6, shadowColor: "#000", shadowOpacity: 0.16, shadowOffset: { width: 0, height: 12 }, shadowRadius: 20, elevation: 8 },
  primaryText: { color: "#111217", fontSize: 15, fontWeight: "800" },
  secondarySoft: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingVertical: 14, alignItems: "center" },
  secondaryText: { color: "#F8FAFD", fontSize: 14, fontWeight: "700" },
  groupCard: { backgroundColor: "rgba(11,17,27,0.58)", borderRadius: 28, padding: 18, marginBottom: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  groupTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "800", marginBottom: 12, letterSpacing: -0.4 },
  groupTitleCollapsed: { marginBottom: 0, fontSize: 17 },
  seedWrap: { flexDirection: "row", flexWrap: "wrap" },
  seedTag: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, marginRight: 8, marginBottom: 8, minWidth: 110 },
  seedTagSelected: { backgroundColor: "rgba(255,255,255,0.92)" },
  seedType: { color: "rgba(255,255,255,0.58)", fontSize: 11, fontWeight: "700", marginBottom: 5 },
  seedTypeSelected: { color: "rgba(17,18,23,0.6)" },
  seedName: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  seedNameSelected: { color: "#111217" },
  playerCard: { backgroundColor: "rgba(11,17,27,0.58)", borderRadius: 32, padding: 22, marginBottom: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  coverWrap: { alignItems: "center", marginBottom: 18 },
  artworkFrame: { overflow: "hidden", backgroundColor: "#18181C", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  artworkImage: { width: "100%", height: "100%" },
  artworkPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#18181C", overflow: "hidden" },
  artworkGlowA: { position: "absolute", width: "76%", height: "76%", borderRadius: 999, backgroundColor: "#4E67C8", top: -18, right: -10 },
  artworkGlowB: { position: "absolute", width: "58%", height: "58%", borderRadius: 999, backgroundColor: "#F19472", bottom: -14, left: -10 },
  artworkGlowC: { position: "absolute", width: "34%", height: "34%", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", top: "30%", left: "24%" },
  artworkLabel: { color: "#FFFFFF", fontWeight: "800", letterSpacing: 0.8 },
  playerTitle: { color: "#FFFFFF", fontSize: 30, fontWeight: "800", textAlign: "center", letterSpacing: -0.8 },
  playerSub: { color: "rgba(236,240,246,0.7)", fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8 },
  playerStatusRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  playerStatusPill: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  playerStatusPillError: { backgroundColor: "rgba(255,103,103,0.18)", borderColor: "rgba(255,130,130,0.28)" },
  playerStatusText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  playerStatusAction: { marginLeft: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  playerStatusActionText: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "700" },
  playerErrorBox: { backgroundColor: "rgba(255,103,103,0.14)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,130,130,0.25)", paddingVertical: 9, paddingHorizontal: 12, marginBottom: 12 },
  playerErrorText: { color: "rgba(255,232,232,0.95)", fontSize: 12, lineHeight: 16 },
  progressWrap: { marginTop: 22 },
  progressTrackShell: { marginHorizontal: -4, paddingVertical: 10 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", overflow: "visible", position: "relative" },
  progressFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 999, backgroundColor: "#FFFFFF" },
  progressThumb: { position: "absolute", top: -6, width: 20, height: 20, borderRadius: 999, backgroundColor: "#FFFFFF", shadowColor: "#000000", shadowOpacity: 0.24, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  progressTimeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  progressText: { color: "rgba(255,255,255,0.62)", fontSize: 12, fontVariant: ["tabular-nums"] },
  controlsRow: { flexDirection: "row", gap: 10, marginTop: 22 },
  controlBtn: { flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 18, paddingVertical: 15, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  controlText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  playBtn: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 18, paddingVertical: 15, alignItems: "center" },
  playText: { color: "#111217", fontSize: 15, fontWeight: "800" },
  section: { marginBottom: 18 },
  anchorStrip: { backgroundColor: "rgba(11,17,27,0.58)", borderRadius: 24, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  anchorStripLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", marginBottom: 12 },
  anchorChipRow: { gap: 10, paddingRight: 10 },
  anchorChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  anchorChipActive: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  anchorChipText: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "700" },
  anchorChipTextActive: { color: "#0B111B" },
  anchorChipSkeleton: { width: 82, height: 38, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)" },
  listItem: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 22, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  currentQueueItem: { borderColor: "rgba(255,255,255,0.28)" },
  queueEmptyBox: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 14 },
  queueContent: { paddingTop: 20, paddingBottom: 4 },
  queueViewport: { maxHeight: 392, position: "relative" },
  queueTopFade: { position: "absolute", top: 0, left: 0, right: 0, height: 34, overflow: "hidden", borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  queueTopFadeLayerStrong: { position: "absolute", top: 0, left: 0, right: 0, height: 12, backgroundColor: "rgba(218,198,210,0.24)" },
  queueTopFadeLayerMid: { position: "absolute", top: 6, left: 0, right: 0, height: 14, backgroundColor: "rgba(155,178,230,0.16)" },
  queueTopFadeLayerSoft: { position: "absolute", top: 14, left: 0, right: 0, height: 20, backgroundColor: "rgba(11,17,27,0.08)" },
  queueSkeletonItem: { opacity: 0.78 },
  queueSkeletonStandalone: { flexDirection: "row", alignItems: "center" },
  queueSkeletonArtwork: { width: 56, height: 56, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.12)" },
  queueSkeletonLine: { borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)" },
  queueSkeletonLinePrimary: { height: 16, width: "72%" },
  queueSkeletonLineSecondary: { height: 12, width: "54%", marginTop: 10 },
  songListMain: { flexDirection: "row", alignItems: "center", flex: 1 },
  songListText: { flex: 1, marginLeft: 12 },
  playlistBox: { borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  playlistRow: { flexDirection: "row", alignItems: "center" },
  playlistPlus: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", marginLeft: 12 },
  playlistPlusText: { color: "#111217", fontSize: 22, lineHeight: 22, marginTop: -2 },
  listTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  listSub: { color: "rgba(255,255,255,0.64)", fontSize: 13, marginTop: 4, lineHeight: 18 },
  chevron: { color: "rgba(255,255,255,0.48)", fontSize: 20, marginLeft: 12 },
  placeholder: { color: "rgba(255,255,255,0.62)", fontSize: 14 },
  galaxyScreen: { flex: 1 },
  galaxyHeader: { paddingHorizontal: 18, paddingTop: 12 },
  zoneRow: { position: "absolute", top: 42, left: PORTRAIT_SIDE_INSET, right: PORTRAIT_SIDE_INSET, flexDirection: "row", justifyContent: "space-between" },
  zoneCard: { flex: 1, minHeight: 72, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 22, paddingHorizontal: 12, paddingVertical: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginHorizontal: 5 },
  zoneCardActive: { backgroundColor: "rgba(255,255,255,0.22)", borderColor: "rgba(255,255,255,0.22)" },
  zoneDeleteActive: { backgroundColor: "rgba(255,86,86,0.24)", borderColor: "rgba(255,127,127,0.34)" },
  zoneSmallerActive: { backgroundColor: "rgba(114,171,255,0.24)" },
  zoneBiggerActive: { backgroundColor: "rgba(255,210,112,0.24)" },
  zoneLabel: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  zoneHint: { color: "rgba(255,255,255,0.62)", fontSize: 12, marginTop: 4 },
  galaxyStage: { ...StyleSheet.absoluteFillObject },
  tagBlock: { position: "absolute", backgroundColor: "transparent" },
  tagHalo: { position: "absolute", width: 84, height: 84, borderRadius: 999, right: -10, top: -16 },
  tagType: { color: "rgba(255,255,255,0.76)", fontSize: 11, fontWeight: "700", marginBottom: 4, textShadowColor: "rgba(12,16,24,0.5)", textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 } },
  tagTypeFloating: { position: "absolute" },
  tagText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", textShadowColor: "rgba(12,16,24,0.58)", textShadowRadius: 16, textShadowOffset: { width: 0, height: 3 } },
  tagTextFloating: { position: "absolute" },
  emptyGalaxy: { position: "absolute", left: 26, right: 26, top: "38%", backgroundColor: "rgba(11,17,27,0.56)", padding: 18, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  emptyGalaxyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  emptyGalaxyText: { color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 20, marginTop: 6 },
  galaxySheet: { position: "absolute", left: 14, right: 14, bottom: 96, backgroundColor: "rgba(11,17,27,0.52)", borderRadius: 30, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  galaxySheetCollapsed: { paddingHorizontal: 12, paddingVertical: 12, backgroundColor: "rgba(11,17,27,0.18)", borderRadius: 24 },
  galaxySheetDragging: { opacity: 0.3 },
  utilitySheetToggle: { alignItems: "center", justifyContent: "center", paddingVertical: 8, marginBottom: 10 },
  utilitySheetToggleCollapsed: { marginBottom: 0 },
  utilitySheetArrow: { color: "rgba(255,255,255,0.92)", fontSize: 16, fontWeight: "700" },
  sheetCard: { backgroundColor: "rgba(11,17,26,0.74)", borderRadius: 26, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sheetHeaderCollapsed: { marginBottom: 0 },
  sheetCardCollapsed: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 22 },
  sheetToggleText: { color: "rgba(255,255,255,0.86)", fontSize: 13, fontWeight: "700" },
  generateSection: { marginTop: 16, gap: 10 },
  generateSectionCard: { marginTop: 10 },
  generateSkeleton: { marginTop: 8 },
  generatedInfoCard: { marginTop: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 22, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  categoryPickerCard: { marginTop: 14, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 22, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  categoryPickerTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", marginBottom: 12 },
  categoryPickerRow: { paddingRight: 8 },
  categoryChip: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, marginRight: 10 },
  categoryChipActive: { backgroundColor: "#FFFFFF" },
  categoryChipText: { color: "rgba(255,255,255,0.72)", fontSize: 14, fontWeight: "700" },
  categoryChipTextActive: { color: "#111217" },
  onboardingProgressHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  onboardingProgressTrack: { height: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden", marginBottom: 16 },
  onboardingProgressFill: { height: 10, borderRadius: 999, backgroundColor: "#FFFFFF" },
  accountCard: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 22, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  accountAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  accountAvatarText: { fontSize: 34 },
  accountName: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginBottom: 8 },
  accountMeta: { color: "rgba(255,255,255,0.68)", fontSize: 14, marginTop: 3 },
  dangerButton: { backgroundColor: "rgba(145,38,38,0.88)", borderRadius: 18, paddingVertical: 15, alignItems: "center" },
  dangerText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  languageOptionActive: { backgroundColor: "rgba(255,255,255,0.9)" },
  languageOptionTextActive: { color: "#111217" },
  hintText: { color: "rgba(255,255,255,0.68)", fontSize: 13, lineHeight: 20, marginTop: 10 },
  okText: { color: "#72D595", marginTop: 10, fontSize: 13 },
  errorText: { color: "#FF8D7C", marginTop: 10, fontSize: 13 },
  tabBarShell: { position: "absolute", left: 0, right: 0, bottom: 12, alignItems: "center" },
  tabBar: { flexDirection: "row", width: "92%", backgroundColor: "rgba(14,18,28,0.86)", borderRadius: 28, paddingHorizontal: 10, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  tabText: { fontSize: 12, color: "rgba(255,255,255,0.42)", fontWeight: "600" },
  tabTextActive: { color: "#FFFFFF", fontWeight: "800" },
  workMetaRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 10, paddingHorizontal: 4 },
  workMetaText: { color: "rgba(255,255,255,0.64)", fontSize: 12, flex: 1 },
  rowGap: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 }
});













