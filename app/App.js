import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Image
} from "react-native";
import { Audio } from "expo-av";
import { BlurMask, Canvas, Circle, Group } from "@shopify/react-native-skia";
import { API_BASE } from "./config";

const TABS = [
  { key: "player", label: "\u6b4c\u66f2", icon: "\u25c9" },
  { key: "favorites", label: "\u6536\u85cf", icon: "\u2661" },
  { key: "galaxy", label: "\u753b\u50cf", icon: "\u2726" },
  { key: "settings", label: "\u8bbe\u7f6e", icon: "\u2318" }
];

const STRINGS = {
  zh: {
    tab_player: "歌曲",
    tab_favorites: "收藏",
    tab_galaxy: "画像",
    tab_settings: "设置",
    auth_title: "登录后继续使用",
    auth_login: "登录",
    auth_register: "注册",
    auth_username: "用户名",
    auth_choose_avatar: "选择头像",
    auth_account_id: "账号",
    auth_password: "密码",
    auth_confirm_password: "确认密码",
    auth_login_cta: "登录",
    auth_register_cta: "注册并继续",
    onboarding_title: "选择初始标签",
    onboarding_subtitle: "至少选择两个不同分类。",
    enter_app: "进入应用",
    back: "返回",
    player_title: "歌曲",
    no_song: "暂无歌曲",
    favorite: "收藏",
    generating: "生成中...",
    pause: "暂停",
    play: "播放",
    generate: "生成",
    load_queue: "加载歌曲",
    assigning: "分配中...",
    next: "下一首",
    save_to_playlist: "保存到歌单",
    cancel: "取消",
    songs_count: "歌曲 ",
    queue: "播放队列",
    show: "展开",
    hide: "收起",
    untitled: "未命名",
    no_playlist_alert_title: "暂无歌单",
    no_playlist_alert_body: "请先在收藏页创建歌单。",
    favorites_title: "歌单",
    new_playlist: "新建歌单",
    playlist_placeholder: "例如：深夜 / 通勤",
    create: "创建",
    my_playlists: "我的歌单",
    no_playlist_yet: "还没有歌单。",
    playlist_empty: "这个歌单还是空的。",
    generated_songs: "我生成的歌曲",
    no_generated_yet: "还没有生成歌曲。",
    generate_song_cta: "生成新歌曲",
    portrait_generate_title: "生成新歌曲",
    portrait_generate_subtitle: "会展示骨架图，完成后直接进入播放队列尾部。",
    portrait_generated_ready: "已加入播放列表最后一首",
    favorite_history: "收藏记录",
    no_favorite_yet: "还没有收藏歌曲。",
    galaxy_title: "全屏模糊色块",
    no_tags_yet: "暂无标签",
    add_tag: "新增标签",
    add_to_portrait: "加入我的画像",
    expand: "展开",
    collapse: "收起",
    tag_name: "标签名",
    zone_softer: "贴近",
    zone_softer_hint: "降低权重",
    zone_stronger: "远离",
    zone_stronger_hint: "提高权重",
    choose_category_for_tag: "为“{name}”选择分类",
    confirm: "确认",
    settings_title: "设置",
    current_account: "当前账户",
    language: "语言",
    lang_zh: "中文",
    lang_en: "English",
    account_action: "账户操作",
    logout: "退出登录"
  },
  en: {
    tab_player: "Songs",
    tab_favorites: "Favorites",
    tab_galaxy: "Portrait",
    tab_settings: "Settings",
    auth_title: "Sign in to continue",
    auth_login: "Login",
    auth_register: "Register",
    auth_username: "Username",
    auth_choose_avatar: "Choose avatar",
    auth_account_id: "Account ID",
    auth_password: "Password",
    auth_confirm_password: "Confirm password",
    auth_login_cta: "Login",
    auth_register_cta: "Register",
    onboarding_title: "Pick initial tags",
    onboarding_subtitle: "Choose at least two categories.",
    enter_app: "Enter App",
    back: "Back",
    player_title: "Songs",
    no_song: "No song yet",
    favorite: "Favorite",
    generating: "Generating...",
    pause: "Pause",
    play: "Play",
    generate: "Generate",
    load_queue: "Load songs",
    assigning: "Assigning...",
    next: "Next",
    save_to_playlist: "Save to playlist",
    cancel: "Cancel",
    songs_count: "Songs ",
    queue: "Queue",
    show: "Show",
    hide: "Hide",
    untitled: "Untitled",
    no_playlist_alert_title: "No playlist",
    no_playlist_alert_body: "Create one in Favorites first.",
    favorites_title: "Playlists",
    new_playlist: "New playlist",
    playlist_placeholder: "e.g. Late night / Commute",
    create: "Create",
    my_playlists: "My playlists",
    no_playlist_yet: "No playlist yet.",
    playlist_empty: "This playlist is empty.",
    generated_songs: "My generated songs",
    no_generated_yet: "No generated songs yet.",
    generate_song_cta: "Generate new song",
    portrait_generate_title: "Generate a new song",
    portrait_generate_subtitle: "Show a skeleton first, then insert the finished song at the end of the queue.",
    portrait_generated_ready: "Added to the end of the queue",
    galaxy_title: "Blurred blobs",
    no_tags_yet: "No tags yet",
    add_tag: "Add tag",
    add_to_portrait: "Add to portrait",
    expand: "Expand",
    collapse: "Collapse",
    tag_name: "Tag name",
    zone_softer: "Closer",
    zone_softer_hint: "Lower weight",
    zone_stronger: "Farther",
    zone_stronger_hint: "Raise weight",
    choose_category_for_tag: "Choose a category for \"{name}\"",
    confirm: "Confirm",
    settings_title: "Settings",
    current_account: "Current account",
    language: "Language",
    lang_zh: "中文",
    lang_en: "English",
    account_action: "Account action",
    logout: "Log out"
  }
};
const TYPE_COLORS = {
  "\u60c5\u7eea": ["#FF8B7A", "#FFD98C", "#FFF3EE"],
  "\u98ce\u683c": ["#3E89FF", "#6CC8FF", "#EEF5FF"],
  "\u4e50\u5668": ["#65C58E", "#B8F2C8", "#EFFFF5"],
  "\u573a\u666f": ["#FFC36A", "#FFD6A8", "#FFF8EA"],
  "\u8282\u594f": ["#9C7BFF", "#C9B7FF", "#F5F0FF"]
};

const CATEGORY_ORDER = ["\u60c5\u7eea", "\u98ce\u683c", "\u4e50\u5668", "\u573a\u666f", "\u8282\u594f"];
const MAX_PORTRAIT_TAGS = 15;
const PORTRAIT_MIN_SIZE = 14;
const PORTRAIT_MAX_SIZE = 108;
const PORTRAIT_ORIGIN_SIZE = 40;
const PORTRAIT_STEP_SIZE = 24;
const PORTRAIT_TOP_INSET = 94;
const PORTRAIT_SIDE_INSET = 10;
const PORTRAIT_BOTTOM_INSET = 124;
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

function songIdentityOf(song) {
  return song?.id || song?.audio_url || queueKeyOf(song);
}

function isSameSong(a, b) {
  return Boolean(songIdentityOf(a)) && songIdentityOf(a) === songIdentityOf(b);
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

function getFuncZones(stageSize, labels = {}) {
  const width = Math.max(320, stageSize.width || 0);
  const zoneTop = 26;
  const zoneHeight = 64;
  const gap = 12;
  const zoneWidth = (width - PORTRAIT_SIDE_INSET * 2 - gap) / 2;
  return [
    { id: 2, key: "smaller", label: labels.strongerLabel || "远离", hint: labels.strongerHint || "提高权重", x: PORTRAIT_SIDE_INSET, y: zoneTop, width: zoneWidth, height: zoneHeight },
    { id: 3, key: "bigger", label: labels.softerLabel || "贴近", hint: labels.softerHint || "降低权重", x: PORTRAIT_SIDE_INSET + zoneWidth + gap, y: zoneTop, width: zoneWidth, height: zoneHeight }
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
  const zones = getFuncZones(stageSize);
  const metrics = getBlockMetrics(block);
  const left = point.x - metrics.width / 2;
  const right = point.x + metrics.width / 2;
  const top = point.y - metrics.height / 2;
  const bottom = point.y + metrics.height / 2;
  const match = zones.find((zone) => right >= zone.x && left <= zone.x + zone.width && bottom >= zone.y && top <= zone.y + zone.height);
  return match ? match.id : findZoneAtPoint(point, stageSize);
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
    const startSize = previous ? clamp(previous.currentSize, PORTRAIT_MIN_SIZE, PORTRAIT_MAX_SIZE) : deriveBlockSize(tag, index);

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
      targetSize: previous ? clamp(previous.targetSize, PORTRAIT_MIN_SIZE, PORTRAIT_MAX_SIZE) : startSize,
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

function ScreenTitle({ eyebrow, title, subtitle, light = false }) {
  return (
    <View style={styles.titleBlock}>
      {eyebrow ? <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>{eyebrow}</Text> : null}
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
                <Circle cx={bloomX} cy={bloomY} r={bloomRadius} color={hexToRgba(block.color, 0.31)}>
                  <BlurMask blur={206} style="normal" />
                </Circle>
                <Circle cx={mistX} cy={mistY} r={mistRadius} color={hexToRgba(block.glow || block.color, 0.2)}>
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
  const [authMode, setAuthMode] = useState("login");
  const [accountId, setAccountId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AUTH_AVATARS[0]);
  const [language, setLanguage] = useState("zh");
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [tags, setTags] = useState([]);
  const [seedSelection, setSeedSelection] = useState(new Set());
  const [profileTags, setProfileTags] = useState([]);
  const [songs, setSongs] = useState([]);
  const [generatedSongs, setGeneratedSongs] = useState([]);
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
  const [portraitGeneratedSong, setPortraitGeneratedSong] = useState(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [pendingTagName, setPendingTagName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(CATEGORY_ORDER[0] || "");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [isTagSheetCollapsed, setIsTagSheetCollapsed] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [tagMessage, setTagMessage] = useState("");
  const [health, setHealth] = useState({ loading: false, ok: null, message: "" });
  const [portraitStageSize, setPortraitStageSize] = useState({ width: 1, height: 1 });
  const [portraitBlocks, setPortraitBlocks] = useState([]);
  const [activeZoneId, setActiveZoneId] = useState(-1);
  const [isPortraitDragging, setIsPortraitDragging] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreviewPosition, setSeekPreviewPosition] = useState(null);
  const activeZoneRef = useRef(-1);
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
  const dragActionCommittedRef = useRef(false);
  const pendingProfileRefreshRef = useRef(false);
  const lastDragPointRef = useRef(null);
  const playbackRef = useRef(playback);
  const soundRef = useRef(sound);
  const progressLayoutRef = useRef(progressLayout);
  const seekingRef = useRef(false);
  const songsRef = useRef(songs);
  const profileTagsRef = useRef(profileTags);
  const prefetchLockRef = useRef(false);
  const playbackTokenRef = useRef(0);
  const playbackQueueRef = useRef(Promise.resolve());
  const userId = session?.userId || null;
  const userIdRef = useRef(userId);
  const displayName = session?.name || session?.accountId || session?.deviceId || "\u8bbf\u5ba2";
  const t = (key) => STRINGS[language]?.[key] || STRINGS.zh[key] || key;
  const effectiveStageSize = portraitStageSize.width > 20 && portraitStageSize.height > 20 ? portraitStageSize : { width, height: Math.max(620, height - 28) };

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
    const res = await fetch(`${API_BASE}/songs?user_id=${uid}&include_history=true`);
    const data = await res.json();
    const seen = new Set();
    const items = (data.items || []).filter((item) => {
      const key = item.queue_id || item.id || item.audio_url;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => {
      const at = new Date(a.created_at || 0).getTime();
      const bt = new Date(b.created_at || 0).getTime();
      if (at !== bt) return at - bt;
      return Number(a.id || 0) - Number(b.id || 0);
    });
    setSongs(items);
    setGeneratedSongs(items.filter((item) => String(item?.source || "").toLowerCase() === "generated"));
    if (items.length > 0 && (options.preferLatest || !current)) {
      setCurrent(items[items.length - 1]);
    }
    return items;
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
    await Promise.all([refreshSongs(user.id, { preferLatest: true }), loadPlaylists(user.id)]);
    const active = (profile || []).filter((item) => item.is_active !== false);
    setNeedsOnboarding(active.length === 0);
    setOnboardingStep(0);
  };

  const persistProfileTagWeight = async (tagId, weight) => {
    const uid = Number(userIdRef.current);
    if (!Number.isFinite(uid) || uid <= 0) return;
    const res = await fetch(`${API_BASE}/user-tags/weight`, {
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

  const computeNextWeight = (currentWeight, zoneId) => {
    const value = clamp(Number(currentWeight || 0), 0, 1);
    if (zoneId === 2) {
      const lowered = value * 0.7 - 0.04;
      return lowered <= 0.04 ? 0 : Number(lowered.toFixed(3));
    }
    return Number(Math.min(1, value + 0.13).toFixed(3));
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
      } else {
        pendingProfileRefreshRef.current = true;
      }
    }
  };

  useEffect(() => { loadTags().catch(() => setTags([])); }, []);

  useEffect(() => () => {
    playbackTokenRef.current += 1;
    if (soundRef.current) stopAndUnloadSound(soundRef.current).catch(() => {});
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
    const liveBlock = (blocksRef.current || []).find((item) => item.id === id);
    let shouldAutoFinish = false;
    if (liveBlock) {
      const fallbackPoint = lastDragPointRef.current || liveBlock.currentPos;
      const isValidPoint = point
        && Number.isFinite(point.x)
        && Number.isFinite(point.y)
        && point.x >= -48
        && point.x <= stage.width + 48
        && point.y >= -48
        && point.y <= stage.height + 48;
      const candidatePoint = isValidPoint ? point : fallbackPoint;
      const settledPoint = sanitizeDragPoint(liveBlock, candidatePoint, stage);
      const zoneId = findZoneForBlock(liveBlock, settledPoint, stage);
      if (!dragActionCommittedRef.current && zoneId !== -1) {
        dragActionCommittedRef.current = true;
        shouldAutoFinish = true;
        activeZoneRef.current = -1;
        setActiveZoneId(-1);
        applyProfileTagActionById(Number(liveBlock.id), zoneId, Number(liveBlock.tag?.weight || 0), { refreshAfter: false }).catch(() => {
          dragActionCommittedRef.current = false;
        });
      }
    }
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

    if (shouldAutoFinish && draggingIdRef.current === id) {
      finishDraggedBlock(id);
    }
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
      target.isDragging = false;
      target.isEntering = false;
      target.currentPos = settledPoint;
      target.velocity = { x: 0, y: 0 };

      if (zoneId === 2) {
        target.targetSize = clamp(target.targetSize - PORTRAIT_STEP_SIZE, target.minSize, target.maxSize);
        target.needBackToAnchor = true;
      } else if (zoneId === 3) {
        target.targetSize = clamp(target.targetSize + PORTRAIT_STEP_SIZE, target.minSize, target.maxSize);
        target.needBackToAnchor = true;
      } else {
        target.anchorPos = settledPoint;
        target.needBackToAnchor = false;
      }

      applyRepulsion(next, stage, 0.09, 1);
      blocksRef.current = next;
      return next;
    });

    const actionWasCommitted = dragActionCommittedRef.current;
    draggingIdRef.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
    dragStartBlockPosRef.current = { x: 0, y: 0 };
    lastDragPointRef.current = null;
    activeZoneRef.current = -1;
    setActiveZoneId(-1);
    setIsPortraitDragging(false);

    if (!actionWasCommitted && Number.isFinite(affectedTagId) && activeZone !== -1) {
      applyProfileTagActionById(affectedTagId, activeZone, affectedWeight).catch(() => {});
    } else if (actionWasCommitted && pendingProfileRefreshRef.current) {
      pendingProfileRefreshRef.current = false;
      loadProfileTags(userIdRef.current).catch(() => {});
    }
    dragActionCommittedRef.current = false;
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
      dragActionCommittedRef.current = false;
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
    if (!cleanId) return Alert.alert("Missing account", "Please enter your account ID.");
    if (!accountPassword) return Alert.alert("Missing password", "Please enter your password.");
    if (authMode === "register") {
      if (!cleanName) return Alert.alert("Missing username", "Please enter a username for registration.");
      if (!selectedAvatar) return Alert.alert("Missing avatar", "Please choose an avatar.");
      if (accountPassword.length < 6) return Alert.alert("Weak password", "Password must be at least 6 characters.");
      if (accountPassword !== accountPasswordConfirm) return Alert.alert("Password mismatch", "The two passwords do not match.");
    }
    setAuthLoading(true);
    try {
      const user = authMode === "login" ? await loginUser() : await registerUser();
      await bootstrapUser(user, user.display_name || cleanName || cleanId);
      setAccountPassword("");
      setAccountPasswordConfirm("");
    } catch (err) {
      Alert.alert(authMode === "login" ? "Login failed" : "Register failed", String(err.message || err));
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
    await refreshSongs(userId, { preferLatest: true });
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
    const { prefetch = false, silent = false, preferLatest = !prefetch, onSongResolved = null } = options;
    if (!userId || generationLoading) return songs;
    const beforeSongs = [...(songsRef.current || [])];
    const beforeIds = new Set(beforeSongs.map((item) => songIdentityOf(item)).filter(Boolean));
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

      const resolveGeneratedSong = (items, payload = {}, jobItem = {}) => {
        const list = Array.isArray(items) ? items : [];
        const hintedId = Number(jobItem?.song?.id || payload.song_id || 0);
        if (hintedId) {
          const matched = list.find((item) => Number(item?.id || 0) === hintedId);
          if (matched) return matched;
        }
        const fresh = list.find((item) => !beforeIds.has(songIdentityOf(item)));
        if (fresh) return fresh;
        return list[list.length - 1] || null;
      };

      const jobId = Number(data.job_id || 0);
      if (!jobId) {
        const refreshed = await refreshSongs(userId, { preferLatest });
        const resolvedSong = resolveGeneratedSong(refreshed, data, {});
        if (resolvedSong && typeof onSongResolved === "function") onSongResolved(resolvedSong, refreshed);
        return refreshed;
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
          const refreshed = await refreshSongs(userId, { preferLatest });
          const resolvedSong = resolveGeneratedSong(refreshed, data, item);
          if (resolvedSong && typeof onSongResolved === "function") onSongResolved(resolvedSong, refreshed);
          return refreshed;
        }
        await wait(3000);
      }

      throw new Error("generation timed out");
    } catch (err) {
      if (!silent) Alert.alert("Generation failed", String(err));
      return songs;
    } finally {
      if (!prefetch) setGenerationLoading(false);
    }
  };

  const getNextSongFromList = (baseSong, list) => {
    if (!baseSong || !Array.isArray(list) || list.length === 0) return null;
    const index = list.findIndex((item) => queueKeyOf(item) === queueKeyOf(baseSong));
    if (index >= 0 && index < list.length - 1) return list[index + 1];
    return null;
  };

  const resolveIncomingNextSong = (baseSong, list) => {
    const directNext = getNextSongFromList(baseSong, list);
    if (directNext) return directNext;
    const currentKey = queueKeyOf(baseSong);
    const tail = (list || [])[list.length - 1] || null;
    if (tail && queueKeyOf(tail) !== currentKey) return tail;
    return null;
  };

  const stopAndUnloadSound = async (soundInstance) => {
    if (!soundInstance) return;
    try { await soundInstance.stopAsync(); } catch {}
    try { await soundInstance.setOnPlaybackStatusUpdate(null); } catch {}
    try { await soundInstance.unloadAsync(); } catch {}
  };

  const runPlaybackTask = async (task) => {
    const run = playbackQueueRef.current.then(task, task);
    playbackQueueRef.current = run.catch(() => {});
    return run;
  };

  const attachStatus = (token, song) => (status) => {
    if (token !== playbackTokenRef.current || !status?.isLoaded) return;
    setPlayback((prev) => ({
      position: seekingRef.current ? prev.position : (status.positionMillis || 0),
      duration: status.durationMillis || prev.duration || 1,
      isPlaying: status.isPlaying
    }));
    if (!seekingRef.current) setSeekPreviewPosition(null);
    if (status.didJustFinish && song && completeSentFor.current !== queueKeyOf(song)) {
      completeSentFor.current = queueKeyOf(song);
      handleAutoNext("complete", song).catch(() => {});
    }
  };

  const play = async (song) => runPlaybackTask(async () => {
    if (!song?.audio_url) return;
    const token = playbackTokenRef.current + 1;
    playbackTokenRef.current = token;
    const previousSound = soundRef.current;
    soundRef.current = null;
    setSound(null);
    setCurrent(song);
    setCurrentSoundId(queueKeyOf(song));
    setPlayback({ position: 0, duration: 1, isPlaying: false });
    completeSentFor.current = null;
    setIsSeeking(false);
    seekingRef.current = false;
    setSeekPreviewPosition(null);
    await stopAndUnloadSound(previousSound);
    const created = await Audio.Sound.createAsync(
      { uri: song.audio_url },
      { shouldPlay: false, progressUpdateIntervalMillis: 250 },
      attachStatus(token, song)
    );
    if (token !== playbackTokenRef.current) {
      await stopAndUnloadSound(created.sound);
      return;
    }
    soundRef.current = created.sound;
    setSound(created.sound);
    await created.sound.playAsync();
  });

  const requestAssignedSong = async ({ autoplay = false } = {}) => {
    if (!userId) return null;
    setAssignmentLoading(true);
    try {
      const items = await refreshSongs(userId, { preferLatest: true });
      const target = items[items.length - 1] || null;
      if (autoplay && target) await play(target);
      return target;
    } finally {
      setAssignmentLoading(false);
    }
  };

  const waitForAssignedNextSong = async (baseSong) => {
    if (!userId) return null;
    setAssignmentLoading(true);
    try {
      const startedAt = Date.now();
      while (Date.now() - startedAt < 45000) {
        const fresh = await refreshSongs(userId, { preferLatest: false });
        const next = resolveIncomingNextSong(baseSong, fresh);
        if (next) return next;
        await wait(3000);
      }
      return null;
    } finally {
      setAssignmentLoading(false);
    }
  };

  const togglePlay = async () => {
    if (!current) return requestAssignedSong({ autoplay: true });
    if (!soundRef.current || currentSoundId !== queueKeyOf(current)) return play(current);
    return runPlaybackTask(async () => {
      const activeSound = soundRef.current;
      if (!activeSound) return;
      if (playbackRef.current.isPlaying) await activeSound.pauseAsync();
      else await activeSound.playAsync();
    });
  };

  const feedback = async (action) => {
    if (!userId || !current) return;
    try {
      await fetch(`${API_BASE}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, song_id: current.id, action, played_seconds: Math.floor((playbackRef.current.position || 0) / 1000) })
      });
    } catch {}
  };

  const handleAutoNext = async (action, baseSong = current) => {
    if (!userId || autoNextLock.current) return;
    autoNextLock.current = true;
    try {
      await feedback(action);
      const queueSnapshot = songsRef.current || [];
      const next = resolveIncomingNextSong(baseSong, queueSnapshot);
      if (next) {
        await play(next);
        return;
      }
      const assignedNext = await waitForAssignedNextSong(baseSong);
      if (assignedNext) await play(assignedNext);
    } finally {
      autoNextLock.current = false;
    }
  };

  const handleNext = async () => {
    if (!current) return requestAssignedSong({ autoplay: true });
    const queueSnapshot = songsRef.current || [];
    const next = getNextSongFromList(current, queueSnapshot);
    if (next) return play(next);
    await handleAutoNext("skip", current);
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

  const addSongToPlaylist = async (playlistId, song = current) => {
    if (!song || !playlistId) return;
    await fetch(`${API_BASE}/playlists/${playlistId}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ song_id: song.id })
    });
  };

  const enqueueSongToTail = (song, source = "manual") => {
    const clone = cloneQueueSong(song, source);
    if (!clone) return;
    setSongs((prev) => [...prev, clone]);
  };

  const enqueueSongsToTail = (list, source = "playlist") => {
    const clones = (list || []).map((song) => cloneQueueSong(song, source)).filter(Boolean);
    if (clones.length === 0) return;
    setSongs((prev) => [...prev, ...clones]);
  };

  const ensureSongAtQueueTail = (song, source = "portrait-generated") => {
    if (!song) return;
    setSongs((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const tail = list[list.length - 1] || null;
      if (isSameSong(tail, song)) return list;
      return [...list, cloneQueueSong(song, source)].filter(Boolean);
    });
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
    await Promise.all([loadTags(), loadProfileTags(userId), refreshSongs(userId), loadPlaylists(userId)]);
    setHealth({ loading: false, ok: true, message: "\u6570\u636e\u5df2\u5237\u65b0" });
  };

  const logout = async () => {
    playbackTokenRef.current += 1;
    await stopAndUnloadSound(soundRef.current);
    soundRef.current = null;
    setSound(null);
    setSession(null);
    setNeedsOnboarding(false);
    setSeedSelection(new Set());
    setOnboardingStep(0);
    setProfileTags([]);
    setSongs([]);
    setGeneratedSongs([]);
    setPlaylists([]);
    setPlaylistSongsMap({});
    setPlaylistSongs([]);
    setSelectedPlaylistId(null);
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
<Text style={styles.authTitle}>{t("auth_title")}</Text>
          <View style={styles.authModeRow}>
            <TouchableOpacity style={[styles.authMode, authMode === "login" && styles.authModeActive]} onPress={() => setAuthMode("login")}>
              <Text style={[styles.authModeText, authMode === "login" && styles.authModeTextActive]}>{t("auth_login")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.authMode, authMode === "register" && styles.authModeActive]} onPress={() => setAuthMode("register")}>
              <Text style={[styles.authModeText, authMode === "register" && styles.authModeTextActive]}>{t("auth_register")}</Text>
            </TouchableOpacity>
          </View>
          {authMode === "register" ? (
            <>
              <TextInput value={accountName} onChangeText={setAccountName} placeholder={t("auth_username")} placeholderTextColor="#B9C2CE" style={styles.input} />
              <Text style={styles.avatarPickerLabel}>{t("auth_choose_avatar")}</Text>
              <View style={styles.avatarPickerRow}>
                {AUTH_AVATARS.map((avatar) => (
                  <TouchableOpacity key={avatar} style={[styles.avatarChip, selectedAvatar === avatar && styles.avatarChipActive]} onPress={() => setSelectedAvatar(avatar)}>
                    <Text style={styles.avatarChipText}>{avatar}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}
          <TextInput value={accountId} onChangeText={(value) => setAccountId(value.replace(/\s+/g, "").toLowerCase())} placeholder={t("auth_account_id")} placeholderTextColor="#B9C2CE" autoCapitalize="none" style={styles.input} />
          <TextInput value={accountPassword} onChangeText={setAccountPassword} placeholder={t("auth_password")} placeholderTextColor="#B9C2CE" secureTextEntry style={styles.input} />
          {authMode === "register" ? (
            <TextInput value={accountPasswordConfirm} onChangeText={setAccountPasswordConfirm} placeholder={t("auth_confirm_password")} placeholderTextColor="#B9C2CE" secureTextEntry style={styles.input} />
          ) : null}
          <TouchableOpacity style={styles.primary} onPress={submitAuth} disabled={authLoading}>
            {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{authMode === "login" ? t("auth_login_cta") : t("auth_register_cta")}</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  const renderOnboarding = () => (
    <SafeAreaView style={styles.page}>
      <PortraitBackdrop blocks={portraitBlocks} stageSize={{ width, height }} />
      <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>
        <View style={styles.groupCard}>
          <View style={styles.onboardingProgressHeader}>
            <Text style={styles.groupTitle}>{currentOnboarding ? currentOnboarding[0] : "Done"}</Text>
            <Text style={styles.hintText}>{"Step " + Math.min(onboardingStep + 1, onboardingGroups.length || 1) + " / " + Math.max(1, onboardingGroups.length)}</Text>
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
            <Text style={styles.placeholder}>All categories completed.</Text>
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
                <Text style={styles.primaryText}>{t("enter_app")}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  const renderPlayer = () => {
    const displayedPosition = isSeeking ? (seekPreviewPosition ?? playback.position) : playback.position;
    const progressPercent = Math.min(1, Math.max(0, (displayedPosition || 0) / Math.max(playback.duration || 1, 1)));

    return (
    <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>
      <View style={styles.playerCard}>
        <View style={styles.coverWrap}>
          <SongArtwork uri={current?.cover_url} size={228} radius={34} label={current?.title || "TPY"} />
        </View>
        <Text style={styles.playerTitle}>{current?.title || t("no_song")}</Text>
        <Text style={styles.playerSub} numberOfLines={2}>{songTagText(current)}</Text>
        <View style={styles.progressWrap}>
          <View
            ref={progressTrackRef}
            style={styles.progressTrackShell}
            onLayout={() => measureProgressTrack()}
            {...progressResponder.panHandlers}
          >
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: String(progressPercent * 100) + "%" }]} />
              <View style={[
                styles.progressThumb,
                { left: String(progressPercent * 100) + "%", transform: [{ translateX: -10 }, { scale: isSeeking ? 1.08 : 1 }] }
              ]} />
            </View>
          </View>
          <View style={styles.progressTimeRow}>
            <Text style={styles.progressText}>{formatTime(displayedPosition)}</Text>
            <Text style={styles.progressText}>{formatTime(playback.duration)}</Text>
          </View>
        </View>
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={async () => {
              if (!current) return;
              await feedback("like");
              const list = await loadPlaylists(userId);
              if (list.length === 0) {
                Alert.alert(t("no_playlist_alert_title"), t("no_playlist_alert_body"));
                setActiveTab("favorites");
                return;
              }
              setShowPlaylistPicker(true);
            }}
          >
            <Text style={styles.controlText}>{t("favorite")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
            <Text style={styles.playText}>{assignmentLoading ? t("assigning") : current ? (playback.isPlaying ? t("pause") : t("play")) : t("load_queue")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={handleNext}>
            <Text style={styles.controlText}>{t("next")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showPlaylistPicker ? (
        <View style={styles.groupCard}>
          <Text style={styles.groupTitle}>{t("save_to_playlist")}</Text>
          {playlists.map((playlist) => (
            <TouchableOpacity
              key={playlist.id}
              style={styles.listItem}
              onPress={async () => {
                await addSongToPlaylist(playlist.id);
                if (selectedPlaylistId === playlist.id) await loadPlaylistSongs(playlist.id);
                setShowPlaylistPicker(false);
              }}
            >
              <View>
                <Text style={styles.listTitle}>{playlist.name}</Text>
                <Text style={styles.listSub}>{t("songs_count") + (playlist.song_count || 0)}</Text>
              </View>
              <Text style={styles.chevron}>></Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.secondarySoft} onPress={() => setShowPlaylistPicker(false)}>
            <Text style={styles.secondaryText}>{t("cancel")}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.section}>
        <TouchableOpacity style={styles.queueToggle} onPress={() => setShowQueue((prev) => !prev)}>
          <View>
            <Text style={styles.queueLabel}>{t("queue")}</Text>
            
          </View>
          <Text style={styles.queueAction}>{showQueue ? t("hide") : t("show")}</Text>
        </TouchableOpacity>
        {showQueue ? songs.map((item, index) => (
          <TouchableOpacity key={String(queueKeyOf(item))} style={[styles.listItem, queueKeyOf(current) === queueKeyOf(item) && styles.currentQueueItem]} onPress={() => play(item)}>
            <View style={styles.songListMain}>
              <SongArtwork uri={item.cover_url} size={56} radius={18} label={item.title || "TPY"} />
              <View style={styles.songListText}>
                <Text style={styles.listTitle}>{String(index + 1) + ". " + (item.title || t("untitled"))}</Text>
                <Text style={styles.listSub} numberOfLines={1}>{songTagText(item)}</Text>
              </View>
            </View>
            <Text style={styles.chevron}>></Text>
          </TouchableOpacity>
        )) : null}
      </View>
    </ScrollView>
  );
  };

  const renderFavorites = () => (
    <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>

      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>{t("new_playlist")}</Text>
        <TextInput value={newPlaylistName} onChangeText={setNewPlaylistName} placeholder={t("playlist_placeholder")} placeholderTextColor="#B9C2CE" style={styles.input} />
        <TouchableOpacity style={styles.primary} onPress={createPlaylist}>
          <Text style={styles.primaryText}>{t("create")}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>{t("my_playlists")}</Text>
        {playlists.length === 0 ? (
          <Text style={styles.placeholder}>{t("no_playlist_yet")}</Text>
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
                  <Text style={styles.listSub}>{t("songs_count") + (playlist.song_count || 0)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.playlistPlus}
                  onPress={async () => {
                    const list = songsInPlaylist.length > 0 ? songsInPlaylist : await loadPlaylistSongs(playlist.id);
                    enqueueSongsToTail(list, "playlist-" + String(playlist.id));
                  }}
                >
                  <Text style={styles.playlistPlusText}>+</Text>
                </TouchableOpacity>
              </View>

              {expanded ? (
                <View style={{ marginTop: 10 }}>
                  {songsInPlaylist.length === 0 ? (
                    <Text style={styles.placeholder}>{t("playlist_empty")}</Text>
                  ) : songsInPlaylist.map((song) => (
                    <TouchableOpacity key={String(playlist.id) + "-" + String(song.id)} style={styles.listItem} onPress={() => enqueueSongToTail(song, "playlist-song-" + String(playlist.id))}>
                      <View style={styles.songListMain}>
                        <SongArtwork uri={song.cover_url} size={56} radius={18} label={song.title || "TPY"} />
                        <View style={styles.songListText}>
                          <Text style={styles.listTitle}>{song.title || t("untitled")}</Text>
                          <Text style={styles.listSub} numberOfLines={1}>{songTagText(song)}</Text>
                        </View>
                      </View>
                      <Text style={styles.chevron}>></Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>{t("generated_songs")}</Text>
        {generatedSongs.length === 0 ? (
          <Text style={styles.placeholder}>{t("no_generated_yet")}</Text>
        ) : generatedSongs.map((song) => (
          <TouchableOpacity key={String(song.id) + "-" + String(song.created_at || "fav")} style={styles.listItem} onPress={() => enqueueSongToTail(song, "favorite")}>
            <View style={styles.songListMain}>
              <SongArtwork uri={song.cover_url} size={56} radius={18} label={song.title || "TPY"} />
              <View style={styles.songListText}>
                <Text style={styles.listTitle}>{song.title || t("untitled")}</Text>
                <Text style={styles.listSub} numberOfLines={1}>{songTagText(song)}</Text>
              </View>
            </View>
            <Text style={styles.chevron}>></Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderGalaxy = () => {
    const zones = getFuncZones(effectiveStageSize, {
      softerLabel: t("zone_softer"),
      softerHint: t("zone_softer_hint"),
      strongerLabel: t("zone_stronger"),
      strongerHint: t("zone_stronger_hint")
    });

    return (
      <View style={styles.galaxyScreen} onLayout={(event) => setPortraitStageSize(event.nativeEvent.layout)}>
        <PortraitBackdrop blocks={portraitBlocks} stageSize={effectiveStageSize} />
        <View style={styles.galaxyHeader}>
        </View>

        <View style={styles.zoneRow} pointerEvents="box-none">
          {zones.map((zone) => (
            <View
              key={zone.id}
              style={[
                styles.zoneCard,
                activeZoneId === zone.id && styles.zoneCardActive,
                zone.id === 1 && activeZoneId === zone.id && styles.zoneDeleteActive,
                zone.id === 2 && activeZoneId === zone.id && styles.zoneSmallerActive,
                zone.id === 3 && activeZoneId === zone.id && styles.zoneBiggerActive
              ]}
            >
              <Text style={styles.zoneLabel}>{zone.label}</Text>
              <Text style={styles.zoneHint}>{zone.hint}</Text>
            </View>
          ))}
        </View>

        <View style={styles.galaxyStage} {...portraitResponder.panHandlers}>
          {portraitBlocks.length === 0 ? (
            <View style={styles.emptyGalaxy}>
              <Text style={styles.emptyGalaxyTitle}>{t("no_tags_yet")}</Text>
              
            </View>
          ) : portraitBlocks.map((block) => (
            <PortraitTag key={block.id} block={block} isDragging={block.id === draggingIdRef.current} />
          ))}
        </View>

        <View
          pointerEvents={isPortraitDragging ? "none" : "auto"}
          style={[
            styles.galaxySheet,
            isTagSheetCollapsed && styles.galaxySheetCollapsed,
            isPortraitDragging && styles.galaxySheetDragging
          ]}
        >
          <TouchableOpacity style={styles.sheetHeader} onPress={() => setIsTagSheetCollapsed((prev) => !prev)}>
            <Text style={styles.groupTitle}>{t("add_tag")}</Text>
            <Text style={styles.sheetToggleText}>{isTagSheetCollapsed ? t("expand") : t("collapse")}</Text>
          </TouchableOpacity>

          {!isTagSheetCollapsed ? (
            <>
              <TextInput value={newTagName} onChangeText={setNewTagName} placeholder={t("tag_name")} placeholderTextColor="#B9C2CE" style={styles.input} />
              <TouchableOpacity style={styles.primary} onPress={submitUserTag}>
                <Text style={styles.primaryText}>{t("add_to_portrait")}</Text>
              </TouchableOpacity>
              <View style={styles.portraitGenerateCard}>
                <View style={styles.portraitGenerateHeader}>
                  <Text style={styles.portraitGenerateTitle}>{t("portrait_generate_title")}</Text>
                  <Text style={styles.portraitGenerateSubTitle}>{t("portrait_generate_subtitle")}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.secondarySoft, styles.portraitGenerateAction]}
                  onPress={() => generate({
                    preferLatest: false,
                    onSongResolved: (song, refreshed) => {
                      setPortraitGeneratedSong(song);
                      const queueTail = (refreshed || [])[refreshed.length - 1] || null;
                      if (!isSameSong(queueTail, song)) ensureSongAtQueueTail(song);
                    }
                  })}
                  disabled={generationLoading}
                >
                  {generationLoading ? <ActivityIndicator color="#EAF2FF" /> : <Text style={styles.secondaryText}>{t("generate_song_cta")}</Text>}
                </TouchableOpacity>

                {generationLoading ? (
                  <View style={styles.skeletonRow}>
                    <View style={styles.skeletonArtwork} />
                    <View style={styles.skeletonTextWrap}>
                      <View style={styles.skeletonLineLg} />
                      <View style={styles.skeletonLineSm} />
                      <View style={styles.skeletonLineXs} />
                    </View>
                  </View>
                ) : portraitGeneratedSong ? (
                  <View style={styles.portraitResultCard}>
                    <SongArtwork uri={portraitGeneratedSong.cover_url} size={68} radius={20} label={portraitGeneratedSong.title || "TPY"} />
                    <View style={styles.portraitResultText}>
                      <Text style={styles.portraitResultTitle}>{portraitGeneratedSong.title || t("untitled")}</Text>
                      <Text style={styles.portraitResultSub} numberOfLines={2}>{songTagText(portraitGeneratedSong)}</Text>
                      <Text style={styles.portraitResultHint}>{t("portrait_generated_ready")}</Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {showCategoryPicker ? (
                <View style={styles.categoryPickerCard}>
                  <Text style={styles.categoryPickerTitle}>{t("choose_category_for_tag").replace("{name}", pendingTagName)}</Text>
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
      </View>
    );
  };

  const renderSettings = () => (
    <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>
      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>{t("current_account")}</Text>
        <View style={styles.accountCard}>
          <View style={styles.accountAvatar}><Text style={styles.accountAvatarText}>{session?.avatar || "\uD83C\uDFA7"}</Text></View>
          <Text style={styles.accountName}>{displayName}</Text>
          <Text style={styles.accountMeta}>{"Account ID: " + String(session?.accountId || session?.deviceId || "")}</Text>
          <Text style={styles.accountMeta}>{"User ID: " + String(session?.userId || "")}</Text>
        </View>
      </View>
      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>{t("language")}</Text>
        <View style={styles.authModeRow}>
          <TouchableOpacity style={[styles.authMode, language === "zh" && styles.authModeActive]} onPress={() => setLanguage("zh")}>
            <Text style={[styles.authModeText, language === "zh" && styles.authModeTextActive]}>{t("lang_zh")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.authMode, language === "en" && styles.authModeActive]} onPress={() => setLanguage("en")}>
            <Text style={[styles.authModeText, language === "en" && styles.authModeTextActive]}>{t("lang_en")}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>{t("account_action")}</Text>
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
              <Text style={[styles.tabIcon, activeTab === tab.key && styles.tabIconActive]}>{tab.icon}</Text>
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{t(`tab_${tab.key}`)}</Text>
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
  queueToggle: { backgroundColor: "rgba(11,17,27,0.58)", borderRadius: 24, padding: 18, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  queueLabel: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  queueHint: { color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 4 },
  queueAction: { color: "rgba(255,255,255,0.82)", fontSize: 14, fontWeight: "700" },
  listItem: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 22, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  currentQueueItem: { borderColor: "rgba(255,255,255,0.28)" },
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
  zoneRow: { position: "absolute", top: 56, left: PORTRAIT_SIDE_INSET, right: PORTRAIT_SIDE_INSET, flexDirection: "row", justifyContent: "space-between" },
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
  galaxySheet: { position: "absolute", left: 14, right: 14, bottom: 96, backgroundColor: "rgba(11,17,27,0.68)", borderRadius: 30, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  galaxySheetCollapsed: { paddingBottom: 10 },
  galaxySheetDragging: { opacity: 0.3 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sheetToggleText: { color: "rgba(255,255,255,0.86)", fontSize: 13, fontWeight: "700" },
  categoryPickerCard: { marginTop: 14, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 22, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  categoryPickerTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", marginBottom: 12 },
  portraitGenerateCard: { marginTop: 14, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 22, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  portraitGenerateHeader: { marginBottom: 12 },
  portraitGenerateTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  portraitGenerateSubTitle: { color: "rgba(255,255,255,0.68)", fontSize: 13, lineHeight: 19, marginTop: 6 },
  portraitGenerateAction: { marginTop: 0 },
  portraitResultCard: { marginTop: 12, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  portraitResultText: { flex: 1, marginLeft: 12 },
  portraitResultTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  portraitResultSub: { color: "rgba(255,255,255,0.68)", fontSize: 13, lineHeight: 19, marginTop: 4 },
  portraitResultHint: { color: "rgba(255,255,255,0.52)", fontSize: 12, marginTop: 6 },
  skeletonRow: { flexDirection: "row", alignItems: "center", marginTop: 12, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)" },
  skeletonArtwork: { width: 68, height: 68, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)" },
  skeletonTextWrap: { flex: 1, marginLeft: 12 },
  skeletonLineLg: { width: "72%", height: 14, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)", marginBottom: 10 },
  skeletonLineSm: { width: "54%", height: 11, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", marginBottom: 8 },
  skeletonLineXs: { width: "38%", height: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)" },
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
  hintText: { color: "rgba(255,255,255,0.68)", fontSize: 13, lineHeight: 20, marginTop: 10 },
  okText: { color: "#72D595", marginTop: 10, fontSize: 13 },
  errorText: { color: "#FF8D7C", marginTop: 10, fontSize: 13 },
  tabBarShell: { position: "absolute", left: 0, right: 0, bottom: 12, alignItems: "center" },
  tabBar: { flexDirection: "row", width: "92%", backgroundColor: "rgba(14,18,28,0.86)", borderRadius: 28, paddingHorizontal: 10, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 6 },
  tabIcon: { fontSize: 16, color: "rgba(255,255,255,0.42)", marginBottom: 4 },
  tabIconActive: { color: "#FFFFFF" },
  tabText: { fontSize: 11, color: "rgba(255,255,255,0.42)", fontWeight: "600" },
  tabTextActive: { color: "#FFFFFF", fontWeight: "800" },
  rowGap: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 }
});











