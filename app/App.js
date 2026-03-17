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
  ActivityIndicator
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

const TYPE_COLORS = {
  "\u60c5\u7eea": ["#FF8B7A", "#FFD98C", "#FFF3EE"],
  "\u98ce\u683c": ["#3E89FF", "#6CC8FF", "#EEF5FF"],
  "\u4e50\u5668": ["#65C58E", "#B8F2C8", "#EFFFF5"],
  "\u573a\u666f": ["#FFC36A", "#FFD6A8", "#FFF8EA"],
  "\u8282\u594f": ["#9C7BFF", "#C9B7FF", "#F5F0FF"]
};

const CATEGORY_ORDER = ["\u60c5\u7eea", "\u98ce\u683c", "\u4e50\u5668", "\u573a\u666f", "\u8282\u594f"];
const MAX_PORTRAIT_TAGS = 15;
const PORTRAIT_MIN_SIZE = 20;
const PORTRAIT_MAX_SIZE = 80;
const PORTRAIT_ORIGIN_SIZE = 40;
const PORTRAIT_STEP_SIZE = 15;
const PORTRAIT_TOP_INSET = 104;
const PORTRAIT_SIDE_INSET = 12;
const PORTRAIT_BOTTOM_INSET = 156;
const REPULSION_GAP = 18;
const STABLE_SPRING = 0.028;
const STABLE_DAMPING = 0.72;
const BOUNCE_SPRING = 0.085;
const BOUNCE_DAMPING = 0.76;
const VELOCITY_EPSILON = 0.09;

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

function cloneQueueSong(song, source = "manual") {
  if (!song) return null;
  return { ...song, queue_id: `${source}-${song.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
  const gap = 10;
  const zoneWidth = (width - PORTRAIT_SIDE_INSET * 2 - gap * 2) / 3;
  return [
    { id: 1, key: "delete", label: "Delete", hint: "Remove tag", x: PORTRAIT_SIDE_INSET, y: zoneTop, width: zoneWidth, height: zoneHeight },
    { id: 2, key: "smaller", label: "Smaller", hint: "Current tag", x: PORTRAIT_SIDE_INSET + zoneWidth + gap, y: zoneTop, width: zoneWidth, height: zoneHeight },
    { id: 3, key: "bigger", label: "Bigger", hint: "Current tag", x: PORTRAIT_SIDE_INSET + (zoneWidth + gap) * 2, y: zoneTop, width: zoneWidth, height: zoneHeight }
  ];
}

function findZoneAtPoint(point, stageSize) {
  const zones = getFuncZones(stageSize);
  const match = zones.find((zone) => point.x >= zone.x && point.x <= zone.x + zone.width && point.y >= zone.y && point.y <= zone.y + zone.height);
  return match ? match.id : -1;
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
  const centerY = height * 0.46;

  const keepBlocks = limited.map((tag, index) => {
    const palette = typePalette(tag.type);
    const seed = hashString(String(tag.tag_id) + '-' + String(tag.name) + '-' + String(tag.type));
    const angle = index * 2.399963229728653 + (seed % 17) * 0.03;
    const ring = 44 + Math.floor(index / 3) * 52 + (seed % 12);
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
            const primaryRadius = radius * 1.65;
            const secondaryRadius = radius * 1.12;
            return (
              <React.Fragment key={block.id}>
                <Circle
                  cx={block.currentPos.x - radius * 0.18}
                  cy={block.currentPos.y - radius * 0.12}
                  r={primaryRadius}
                  color={hexToRgba(block.color, 0.48)}
                >
                  <BlurMask blur={92} style="solid" />
                </Circle>
                <Circle
                  cx={block.currentPos.x + radius * 0.24}
                  cy={block.currentPos.y + radius * 0.2}
                  r={secondaryRadius}
                  color={hexToRgba(block.glow || block.color, 0.24)}
                >
                  <BlurMask blur={78} style="solid" />
                </Circle>
              </React.Fragment>
            );
          })}
        </Group>
      </Canvas>
      <View style={styles.backdropSoftener} />
    </View>
  );
}

function PortraitTag({ block, isDragging }) {
  const metrics = getBlockMetrics(block);
  return (
    <View
      pointerEvents="none"
      style={[
        styles.tagBlock,
        {
          left: block.currentPos.x - metrics.width / 2,
          top: block.currentPos.y - metrics.height / 2,
          width: metrics.width,
          height: metrics.height,
          borderRadius: metrics.height / 2,
          backgroundColor: hexToRgba(block.color, isDragging ? 0.78 : 0.68),
          shadowColor: block.color,
          transform: [{ scale: isDragging ? 1.04 : 1 }]
        }
      ]}
    >
      <Text style={styles.tagType}>{block.tag.type}</Text>
      <Text style={styles.tagText} numberOfLines={1}>{block.tag.name}</Text>
    </View>
  );
}

export default function App() {
  const { width, height } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState("player");
  const [authMode, setAuthMode] = useState("login");
  const [accountId, setAccountId] = useState("demo-device");
  const [accountName, setAccountName] = useState("");
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [tags, setTags] = useState([]);
  const [seedSelection, setSeedSelection] = useState(new Set());
  const [profileTags, setProfileTags] = useState([]);
  const [songs, setSongs] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [playlistSongsMap, setPlaylistSongsMap] = useState({});
  const [playlistSongs, setPlaylistSongs] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [current, setCurrent] = useState(null);
  const [sound, setSound] = useState(null);
  const [currentSoundId, setCurrentSoundId] = useState(null);
  const [playback, setPlayback] = useState({ position: 0, duration: 1, isPlaying: false });
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
  const [progressLayout, setProgressLayout] = useState(null);
  const progressTrackRef = useRef(null);
  const completeSentFor = useRef(null);
  const autoNextLock = useRef(false);
  const blocksRef = useRef([]);
  const stageSizeRef = useRef({ width: 1, height: 1 });
  const activeTabRef = useRef(activeTab);
  const draggingIdRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const playbackRef = useRef(playback);
  const soundRef = useRef(sound);
  const progressLayoutRef = useRef(progressLayout);
  const userId = session?.userId || null;
  const displayName = session?.name || session?.deviceId || "\u8bbf\u5ba2";
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
    () => profileTags.filter((item) => item.is_active !== false).slice(0, MAX_PORTRAIT_TAGS),
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

  const loadTags = async () => {
    const res = await fetch(`${API_BASE}/tags`);
    const data = await res.json();
    setTags(data.items || []);
  };

  const ensureUser = async (device = accountId.trim(), displayNameValue = accountName.trim()) => {
    const res = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: device, display_name: displayNameValue || undefined })
    });
    const data = await res.json();
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
    const res = await fetch(`${API_BASE}/songs?user_id=${uid}`);
    const data = await res.json();
    const seen = new Set();
    const items = (data.items || []).filter((item) => {
      const key = item.id || item.audio_url;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
    setSongs(items);
    if (items.length > 0 && (options.preferLatest || !current)) {
      setCurrent(items[items.length - 1]);
    }
    return items;
  };

  const refreshFavorites = async (uid) => {
    if (!uid) return [];
    const res = await fetch(`${API_BASE}/favorites?user_id=${uid}`);
    const data = await res.json();
    setFavorites(data.items || []);
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
    setSession({ userId: user.id, deviceId: user.device_id, name: nameOverride || accountName.trim() || user.device_id });
    const profile = await loadProfileTags(user.id);
    await Promise.all([refreshSongs(user.id, { preferLatest: true }), refreshFavorites(user.id), loadPlaylists(user.id)]);
    const active = (profile || []).filter((item) => item.is_active !== false);
    setNeedsOnboarding(active.length === 0);
    setOnboardingStep(0);
  };

  const persistRemoveProfileTag = async (tag) => {
    if (!userId) return;
    await fetch(`${API_BASE}/user-tags/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, tag_id: tag.tag_id })
    });
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

          if (block.needBackToAnchor && Math.hypot(dx, dy) < 2 && Math.hypot(block.velocity.x, block.velocity.y) < 0.4) {
            block.currentPos = { ...block.anchorPos };
            block.velocity = { x: 0, y: 0 };
            block.needBackToAnchor = false;
          }

          keepBlockInBounds(block, stage);
        }
        applyRepulsion(next, stage, 0.09, 1);

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
    const zoneId = findZoneAtPoint(point, stage);
    setActiveZoneId(zoneId);
    setPortraitBlocks((prev) => {
      const next = prev.map(cloneBlock);
      const target = next.find((item) => item.id === id);
      if (!target) return prev;
      target.currentPos = sanitizeBlockPoint(target, point, stage);
      target.velocity = { x: 0, y: 0 };
      target.needBackToAnchor = zoneId !== -1;
      applyRepulsion(next, stage, 0.17, 2);
      blocksRef.current = next;
      return next;
    });
  };

  const finishDraggedBlock = (id, releasePoint) => {
    const stage = stageSizeRef.current;
    const zoneId = findZoneAtPoint(releasePoint, stage);
    let removedTag = null;

    setPortraitBlocks((prev) => {
      const next = prev.map(cloneBlock);
      const index = next.findIndex((item) => item.id === id);
      if (index < 0) return prev;
      const target = next[index];
      target.isDragging = false;
      target.currentPos = sanitizeBlockPoint(target, releasePoint, stage);

      if (zoneId === 1) {
        removedTag = target.tag;
        next.splice(index, 1);
      } else if (zoneId === 2) {
        target.targetSize = clamp(target.targetSize - PORTRAIT_STEP_SIZE, target.minSize, target.maxSize);
        target.needBackToAnchor = true;
        target.velocity = { x: 0, y: 0 };
      } else if (zoneId === 3) {
        target.targetSize = clamp(target.targetSize + PORTRAIT_STEP_SIZE, target.minSize, target.maxSize);
        target.needBackToAnchor = true;
        target.velocity = { x: 0, y: 0 };
      } else {
        const settled = sanitizeBlockPoint(target, releasePoint, stage);
        target.currentPos = settled;
        target.anchorPos = settled;
        target.needBackToAnchor = false;
        target.velocity = { x: 0, y: 0 };
      }

      applyRepulsion(next, stage, 0.13, 2);
      blocksRef.current = next;
      return next;
    });

    draggingIdRef.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
    setActiveZoneId(-1);

    if (removedTag) {
      setProfileTags((prev) => prev.filter((item) => item.tag_id !== removedTag.tag_id));
      persistRemoveProfileTag(removedTag)
        .then(() => loadProfileTags(userId))
        .catch(() => loadProfileTags(userId));
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
      dragOffsetRef.current = { x: picked.currentPos.x - point.x, y: picked.currentPos.y - point.y };
      setPortraitBlocks((prev) => {
        const next = prev.map(cloneBlock);
        const index = next.findIndex((item) => item.id === picked.id);
        if (index < 0) return prev;
        const [target] = next.splice(index, 1);
        target.isDragging = true;
        target.velocity = { x: 0, y: 0 };
        target.needBackToAnchor = false;
        next.push(target);
        blocksRef.current = next;
        return next;
      });
    },
    onPanResponderMove: (evt) => {
      const id = draggingIdRef.current;
      if (!id) return;
      const point = {
        x: evt.nativeEvent.locationX + dragOffsetRef.current.x,
        y: evt.nativeEvent.locationY + dragOffsetRef.current.y
      };
      moveDraggedBlock(id, point);
    },
    onPanResponderRelease: (evt) => {
      const id = draggingIdRef.current;
      if (!id) return;
      const point = {
        x: evt.nativeEvent.locationX + dragOffsetRef.current.x,
        y: evt.nativeEvent.locationY + dragOffsetRef.current.y
      };
      finishDraggedBlock(id, point);
    },
    onPanResponderTerminate: (evt) => {
      const id = draggingIdRef.current;
      if (!id) return;
      const point = {
        x: evt.nativeEvent.locationX + dragOffsetRef.current.x,
        y: evt.nativeEvent.locationY + dragOffsetRef.current.y
      };
      finishDraggedBlock(id, point);
    }
  })).current;

  const submitAuth = async () => {
    const cleanId = accountId.trim();
    const cleanName = accountName.trim();
    if (!cleanId) return Alert.alert("\u8fd8\u5dee\u4e00\u6b65", "\u8bf7\u8f93\u5165\u8d26\u6237 ID");
    if (authMode === "register" && !cleanName) return Alert.alert("\u8fd8\u5dee\u4e00\u6b65", "\u6ce8\u518c\u65f6\u8bf7\u586b\u5199\u6635\u79f0");
    setAuthLoading(true);
    try {
      const user = await ensureUser(cleanId, cleanName);
      await bootstrapUser(user, cleanName || cleanId);
    } catch (err) {
      Alert.alert("\u8fde\u63a5\u5931\u8d25", String(err));
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

  const generate = async () => {
    if (!userId) return;
    await fetch(`${API_BASE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, instrumental: true })
    });
    await refreshSongs(userId, { preferLatest: true });
  };

  const attachStatus = (status) => {
    if (!status?.isLoaded) return;
    setPlayback({ position: status.positionMillis || 0, duration: status.durationMillis || 1, isPlaying: status.isPlaying });
    if (status.didJustFinish && current && completeSentFor.current !== current.id) {
      completeSentFor.current = current.id;
      handleAutoNext("complete").catch(() => {});
    }
  };

  const play = async (song) => {
    if (!song?.audio_url) return;
    if (soundRef.current) await soundRef.current.unloadAsync().catch(() => {});
    completeSentFor.current = null;
    const created = await Audio.Sound.createAsync({ uri: song.audio_url }, { shouldPlay: true, progressUpdateIntervalMillis: 1000 }, attachStatus);
    setSound(created.sound);
    setCurrent(song);
    setCurrentSoundId(queueKeyOf(song));
  };

  const togglePlay = async () => {
    if (!current) return generate();
    if (!soundRef.current || currentSoundId !== queueKeyOf(current)) return play(current);
    if (playbackRef.current.isPlaying) await soundRef.current.pauseAsync();
    else await soundRef.current.playAsync();
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

  const handleAutoNext = async (action) => {
    if (!userId || autoNextLock.current) return;
    autoNextLock.current = true;
    try {
      await feedback(action);
      const index = current ? songs.findIndex((item) => queueKeyOf(item) === queueKeyOf(current)) : -1;
      if (index >= 0 && index < songs.length - 1) return play(songs[index + 1]);
      await generate();
      const fresh = await refreshSongs(userId, { preferLatest: true });
      if (fresh.length > 0) await play(fresh[fresh.length - 1]);
    } finally {
      autoNextLock.current = false;
    }
  };

  const handleNext = async () => {
    if (!current) return generate();
    const index = songs.findIndex((item) => queueKeyOf(item) === queueKeyOf(current));
    if (index >= 0 && index < songs.length - 1) return play(songs[index + 1]);
    await handleAutoNext("skip");
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
    await Promise.all([loadTags(), loadProfileTags(userId), refreshSongs(userId), refreshFavorites(userId), loadPlaylists(userId)]);
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
    setPlaylists([]);
    setPlaylistSongsMap({});
    setPlaylistSongs([]);
    setSelectedPlaylistId(null);
    setCurrent(null);
    setCurrentSoundId(null);
    setActiveTab("player");
    setShowPlaylistPicker(false);
    setPortraitBlocks([]);
  };

  const progressResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gesture) => {
      const layout = progressLayoutRef.current;
      const currentSound = soundRef.current;
      if (!layout || !currentSound) return;
      const localX = Math.min(layout.width, Math.max(0, gesture.moveX - layout.pageX));
      const percent = layout.width > 0 ? localX / layout.width : 0;
      setPlayback((prev) => ({ ...prev, position: Math.floor(percent * (playbackRef.current.duration || 0)) }));
    },
    onPanResponderRelease: async (_, gesture) => {
      const layout = progressLayoutRef.current;
      const currentSound = soundRef.current;
      if (!layout || !currentSound) return;
      const localX = Math.min(layout.width, Math.max(0, gesture.moveX - layout.pageX));
      const percent = layout.width > 0 ? localX / layout.width : 0;
      await currentSound.setPositionAsync(Math.floor(percent * (playbackRef.current.duration || 0)));
    }
  })).current;

  const renderAuth = () => (
    <SafeAreaView style={styles.page}>
      <PortraitBackdrop blocks={portraitBlocks} stageSize={{ width, height }} />
      <ScrollView contentContainerStyle={styles.authShell} showsVerticalScrollIndicator={false}>
        <View style={styles.authCard}>
          <Text style={styles.authEyebrow}>TPY MUSIC</Text>
          <Text style={styles.authTitle}>Sign in to restore your music space</Text>
          <Text style={styles.authSubtitle}>After login, we restore tags, queue, playlists and favorites.</Text>
          <View style={styles.authModeRow}>
            <TouchableOpacity style={[styles.authMode, authMode === "login" && styles.authModeActive]} onPress={() => setAuthMode("login")}>
              <Text style={[styles.authModeText, authMode === "login" && styles.authModeTextActive]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.authMode, authMode === "register" && styles.authModeActive]} onPress={() => setAuthMode("register")}>
              <Text style={[styles.authModeText, authMode === "register" && styles.authModeTextActive]}>Register</Text>
            </TouchableOpacity>
          </View>
          {authMode === "register" ? (
            <TextInput value={accountName} onChangeText={setAccountName} placeholder="Nickname" placeholderTextColor="#B9C2CE" style={styles.input} />
          ) : null}
          <TextInput value={accountId} onChangeText={setAccountId} placeholder="Account ID, e.g. demo-device" placeholderTextColor="#B9C2CE" autoCapitalize="none" style={styles.input} />
          <TouchableOpacity style={styles.primary} onPress={submitAuth} disabled={authLoading}>
            {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{authMode === "login" ? "Login & restore" : "Register & continue"}</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  const renderOnboarding = () => (
    <SafeAreaView style={styles.page}>
      <PortraitBackdrop blocks={portraitBlocks} stageSize={{ width, height }} />
      <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>
        <ScreenTitle eyebrow="First run" title="Pick initial tags" subtitle="Please choose tags from at least two categories." />
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
              <Text style={styles.secondaryText}>Back</Text>
            </TouchableOpacity>
            {onboardingStep < onboardingGroups.length - 1 ? (
              <TouchableOpacity style={[styles.primary, styles.flex]} onPress={() => setOnboardingStep((prev) => Math.min(onboardingGroups.length - 1, prev + 1))}>
                <Text style={styles.primaryText}>Next</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.primary, styles.flex]} onPress={submitOnboarding}>
                <Text style={styles.primaryText}>Enter App</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  const renderPlayer = () => (
    <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>
      <ScreenTitle eyebrow={"Hi, " + displayName} title="Songs" subtitle="Play, favorite and manage your queue." />
      <View style={styles.playerCard}>
        <View style={styles.coverWrap}>
          <View style={styles.cover}>
            <View style={styles.coverGlowA} />
            <View style={styles.coverGlowB} />
            <View style={styles.coverGlowC} />
            <Text style={styles.coverText}>TPY</Text>
          </View>
        </View>
        <Text style={styles.playerTitle}>{current?.title || "No song yet"}</Text>
        <Text style={styles.playerSub} numberOfLines={2}>{songTagText(current)}</Text>
        <View style={styles.progressWrap}>
          <View
            ref={progressTrackRef}
            style={styles.progressTrack}
            onLayout={() => {
              if (!progressTrackRef.current) return;
              progressTrackRef.current.measure((x, y, w, h, pageX, pageY) => setProgressLayout({ width: w, pageX, pageY }));
            }}
            {...progressResponder.panHandlers}
          >
            <View style={[styles.progressFill, { width: String(Math.min(1, (playback.position || 0) / (playback.duration || 1)) * 100) + "%" }]} />
          </View>
          <View style={styles.progressTimeRow}>
            <Text style={styles.progressText}>{formatTime(playback.position)}</Text>
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
                Alert.alert("No playlist", "Create one in Favorites first.");
                setActiveTab("favorites");
                return;
              }
              setShowPlaylistPicker(true);
            }}
          >
            <Text style={styles.controlText}>Favorite</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
            <Text style={styles.playText}>{current ? (playback.isPlaying ? "Pause" : "Play") : "Generate"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={handleNext}>
            <Text style={styles.controlText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showPlaylistPicker ? (
        <View style={styles.groupCard}>
          <Text style={styles.groupTitle}>Save to playlist</Text>
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
                <Text style={styles.listSub}>{"Songs " + (playlist.song_count || 0)}</Text>
              </View>
              <Text style={styles.chevron}>></Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.secondarySoft} onPress={() => setShowPlaylistPicker(false)}>
            <Text style={styles.secondaryText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.section}>
        <TouchableOpacity style={styles.queueToggle} onPress={() => setShowQueue((prev) => !prev)}>
          <View>
            <Text style={styles.queueLabel}>Queue</Text>
            <Text style={styles.queueHint}>Tap an item to switch playback</Text>
          </View>
          <Text style={styles.queueAction}>{showQueue ? "Hide" : "Show"}</Text>
        </TouchableOpacity>
        {showQueue ? songs.map((item, index) => (
          <TouchableOpacity key={String(queueKeyOf(item))} style={[styles.listItem, queueKeyOf(current) === queueKeyOf(item) && styles.currentQueueItem]} onPress={() => play(item)}>
            <View style={styles.flex}>
              <Text style={styles.listTitle}>{String(index + 1) + ". " + (item.title || "Untitled")}</Text>
              <Text style={styles.listSub} numberOfLines={1}>{songTagText(item)}</Text>
            </View>
            <Text style={styles.chevron}>></Text>
          </TouchableOpacity>
        )) : null}
      </View>
    </ScrollView>
  );

  const renderFavorites = () => (
    <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>
      <ScreenTitle eyebrow="Favorites" title="Playlists and songs" subtitle="Expand playlist, append single song, or append whole playlist by +." />

      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>New playlist</Text>
        <TextInput value={newPlaylistName} onChangeText={setNewPlaylistName} placeholder="e.g. Late night / Commute" placeholderTextColor="#B9C2CE" style={styles.input} />
        <TouchableOpacity style={styles.primary} onPress={createPlaylist}>
          <Text style={styles.primaryText}>Create</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>My playlists</Text>
        {playlists.length === 0 ? (
          <Text style={styles.placeholder}>No playlist yet.</Text>
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
                    enqueueSongsToTail(list, "playlist-" + String(playlist.id));
                  }}
                >
                  <Text style={styles.playlistPlusText}>+</Text>
                </TouchableOpacity>
              </View>

              {expanded ? (
                <View style={{ marginTop: 10 }}>
                  {songsInPlaylist.length === 0 ? (
                    <Text style={styles.placeholder}>This playlist is empty.</Text>
                  ) : songsInPlaylist.map((song) => (
                    <TouchableOpacity key={String(playlist.id) + "-" + String(song.id)} style={styles.listItem} onPress={() => enqueueSongToTail(song, "playlist-song-" + String(playlist.id))}>
                      <View style={styles.flex}>
                        <Text style={styles.listTitle}>{song.title || "Untitled"}</Text>
                        <Text style={styles.listSub} numberOfLines={1}>{songTagText(song)}</Text>
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
        <Text style={styles.groupTitle}>Favorite history</Text>
        {favorites.length === 0 ? (
          <Text style={styles.placeholder}>No favorite songs yet.</Text>
        ) : favorites.map((song) => (
          <TouchableOpacity key={String(song.id) + "-" + String(song.created_at || "fav")} style={styles.listItem} onPress={() => enqueueSongToTail(song, "favorite")}>
            <View style={styles.flex}>
              <Text style={styles.listTitle}>{song.title || "Untitled"}</Text>
              <Text style={styles.listSub} numberOfLines={1}>{songTagText(song)}</Text>
            </View>
            <Text style={styles.chevron}>></Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderGalaxy = () => {
    const zones = getFuncZones(effectiveStageSize);

    return (
      <View style={styles.galaxyScreen} onLayout={(event) => setPortraitStageSize(event.nativeEvent.layout)}>
        <PortraitBackdrop blocks={portraitBlocks} stageSize={effectiveStageSize} />
        <View style={styles.galaxyHeader}>
          <ScreenTitle eyebrow="Portrait" title="Full-screen blurred blobs" subtitle="Drag tags to repel each other. Top zones: delete / smaller / bigger." light />
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
              <Text style={styles.emptyGalaxyTitle}>No tags yet</Text>
              <Text style={styles.emptyGalaxyText}>Add tags below, or complete onboarding tags first.</Text>
            </View>
          ) : portraitBlocks.map((block) => (
            <PortraitTag key={block.id} block={block} isDragging={block.id === draggingIdRef.current} />
          ))}
        </View>

        <View style={[styles.galaxySheet, isTagSheetCollapsed && styles.galaxySheetCollapsed]}>
          <TouchableOpacity style={styles.sheetHeader} onPress={() => setIsTagSheetCollapsed((prev) => !prev)}>
            <Text style={styles.groupTitle}>Add tag</Text>
            <Text style={styles.sheetToggleText}>{isTagSheetCollapsed ? "Expand" : "Collapse"}</Text>
          </TouchableOpacity>

          {!isTagSheetCollapsed ? (
            <>
              <TextInput value={newTagName} onChangeText={setNewTagName} placeholder="Tag name" placeholderTextColor="#B9C2CE" style={styles.input} />
              {existingTagMatch ? (
                <Text style={styles.hintText}>{"Existing category found: " + existingTagMatch.type + ". It will be added directly."}</Text>
              ) : (
                <Text style={styles.hintText}>For a new tag, submit first and then choose its category.</Text>
              )}
              <TouchableOpacity style={styles.primary} onPress={submitUserTag}>
                <Text style={styles.primaryText}>Add to my portrait</Text>
              </TouchableOpacity>

              {showCategoryPicker ? (
                <View style={styles.categoryPickerCard}>
                  <Text style={styles.categoryPickerTitle}>{"Choose a category for \"" + pendingTagName + "\""}</Text>
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
                      <Text style={styles.secondaryText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.primary, styles.flex]} onPress={confirmCustomTagType}>
                      <Text style={styles.primaryText}>Confirm</Text>
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
      <ScreenTitle eyebrow="Account" title="Settings and status" subtitle="Manage account, test network and refresh app data." />
      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>Current account</Text>
        <View style={styles.accountCard}>
          <Text style={styles.accountName}>{displayName}</Text>
          <Text style={styles.accountMeta}>{"Account ID: " + String(session?.deviceId || "")}</Text>
          <Text style={styles.accountMeta}>{"User ID: " + String(session?.userId || "")}</Text>
        </View>
      </View>
      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>Network test</Text>
        <TouchableOpacity style={styles.secondarySoft} onPress={testConnection}>
          <Text style={styles.secondaryText}>{health.loading ? "Testing..." : "Test API"}</Text>
        </TouchableOpacity>
        {health.message ? <Text style={health.ok ? styles.okText : styles.errorText}>{health.message}</Text> : null}
      </View>
      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>Refresh data</Text>
        <TouchableOpacity style={styles.secondarySoft} onPress={refreshAllData}>
          <Text style={styles.secondaryText}>Refresh songs/favorites/playlists/tags</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>Account action</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={logout}>
          <Text style={styles.dangerText}>Log out</Text>
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
  backdropSoftener: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(14,18,28,0.22)" },
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
  cover: { width: 228, height: 228, borderRadius: 34, alignItems: "center", justifyContent: "center", backgroundColor: "#18181C", overflow: "hidden" },
  coverGlowA: { position: "absolute", width: 180, height: 180, borderRadius: 999, backgroundColor: "#4E67C8", top: -34, right: -20 },
  coverGlowB: { position: "absolute", width: 140, height: 140, borderRadius: 999, backgroundColor: "#F19472", bottom: -18, left: -16 },
  coverGlowC: { position: "absolute", width: 76, height: 76, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", top: 40, left: 42 },
  coverText: { color: "#FFFFFF", fontSize: 34, fontWeight: "800", letterSpacing: 1.2 },
  playerTitle: { color: "#FFFFFF", fontSize: 30, fontWeight: "800", textAlign: "center", letterSpacing: -0.8 },
  playerSub: { color: "rgba(236,240,246,0.7)", fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8 },
  progressWrap: { marginTop: 22 },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  progressFill: { height: 10, borderRadius: 999, backgroundColor: "#FFFFFF" },
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
  tagBlock: { position: "absolute", paddingHorizontal: 18, paddingVertical: 10, justifyContent: "center", shadowOpacity: 0.26, shadowOffset: { width: 0, height: 12 }, shadowRadius: 24, elevation: 8 },
  tagHalo: { position: "absolute", width: 84, height: 84, borderRadius: 999, right: -10, top: -16 },
  tagType: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  tagText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  emptyGalaxy: { position: "absolute", left: 26, right: 26, top: "38%", backgroundColor: "rgba(11,17,27,0.56)", padding: 18, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  emptyGalaxyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  emptyGalaxyText: { color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 20, marginTop: 6 },
  galaxySheet: { position: "absolute", left: 14, right: 14, bottom: 96, backgroundColor: "rgba(11,17,27,0.68)", borderRadius: 30, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  galaxySheetCollapsed: { paddingBottom: 10 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sheetToggleText: { color: "rgba(255,255,255,0.86)", fontSize: 13, fontWeight: "700" },
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




