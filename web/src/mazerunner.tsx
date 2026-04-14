import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  type Toast, type Particle, type Badge, type SkinDef, type LeaderboardEntry, type TabId,
  type ShopSubTab, type UpgradeDef,
  RETRO_FONT, RETRO_GLOW, PIXEL_BORDER,
  TOAST_DURATION_MS, PARTICLE_COUNT,
  btnStyle, shopBtnStyle,
  loadJSON, saveJSON, detectTouchDevice, recordStreak,
  StatBadge, Overlay, BackButton, RETRO_CSS,
} from "./shared";

type GameState = "idle" | "playing" | "paused" | "won";
type Dir = "UP" | "DOWN" | "LEFT" | "RIGHT";

interface Cell {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
  visited: boolean;
}

interface MazeRunnerProps {
  onBack?: () => void;
}

const LEVELS = [
  { w: 9,  h: 9,  label: "Level 1", loops: 4,  fogRadius: 4, stars: 2, traps: 0 },
  { w: 11, h: 11, label: "Level 2", loops: 6,  fogRadius: 3, stars: 3, traps: 1 },
  { w: 13, h: 13, label: "Level 3", loops: 10, fogRadius: 3, stars: 4, traps: 2 },
  { w: 15, h: 15, label: "Level 4", loops: 14, fogRadius: 2, stars: 5, traps: 3 },
  { w: 17, h: 17, label: "Level 5", loops: 18, fogRadius: 2, stars: 6, traps: 4 },
];

const BOARD_PX = 320;

const SKINS: SkinDef[] = [
  { id: "classic", name: "Classic", cost: 0, headColor: "#a78bfa", bodyColor: "rgba(167,139,250,", glowColor: "rgba(167,139,250,0.6)", preview: "🟣" },
  { id: "ocean", name: "Deep Sea", cost: 50, headColor: "#06b6d4", bodyColor: "rgba(6,182,212,", glowColor: "rgba(6,182,212,0.6)", preview: "🌊" },
  { id: "ember", name: "Ember", cost: 75, headColor: "#f97316", bodyColor: "rgba(249,115,22,", glowColor: "rgba(249,115,22,0.6)", preview: "🔥" },
  { id: "mint", name: "Mint", cost: 100, headColor: "#22c55e", bodyColor: "rgba(34,197,94,", glowColor: "rgba(34,197,94,0.6)", preview: "🍀" },
  { id: "neon", name: "Neon Pink", cost: 150, headColor: "#ec4899", bodyColor: "rgba(236,72,153,", glowColor: "rgba(236,72,153,0.6)", preview: "💗" },
  { id: "gold", name: "Royal Gold", cost: 200, headColor: "#eab308", bodyColor: "rgba(234,179,8,", glowColor: "rgba(234,179,8,0.6)", preview: "👑" },
];

const BADGE_DEFS: Omit<Badge, "earned">[] = [
  { id: "first_maze", name: "First Steps", description: "Complete your first maze", icon: "👣" },
  { id: "level_2", name: "Going Deeper", description: "Reach level 2", icon: "⬆️" },
  { id: "level_3", name: "Pathfinder", description: "Reach level 3", icon: "🧭" },
  { id: "level_5", name: "Maze Master", description: "Beat all 5 levels", icon: "🏆" },
  { id: "fast_10", name: "Speed Demon", description: "Clear any maze in under 10s", icon: "⚡" },
  { id: "fast_5", name: "Lightning", description: "Clear any maze in under 5s", icon: "🌩️" },
  { id: "total_10", name: "Explorer", description: "Complete 10 mazes total", icon: "🗺️" },
  { id: "total_50", name: "Veteran", description: "Complete 50 mazes total", icon: "🎖️" },
  { id: "moves_min", name: "Efficient", description: "Clear a maze with minimal moves", icon: "🎯" },
  { id: "no_backtrack", name: "No U-Turn", description: "Clear level 1 without backtracking", icon: "😎" },
  { id: "games_5", name: "Regular", description: "Play 5 games", icon: "🎮" },
  { id: "games_25", name: "Dedicated", description: "Play 25 games", icon: "🏅" },
  { id: "steps_500", name: "Marathon", description: "500 total steps across all games", icon: "🏃" },
  { id: "steps_2000", name: "Ultra Runner", description: "2000 total steps", icon: "🦿" },
  { id: "streak_3", name: "Three-Peat", description: "Beat 3 levels in one run", icon: "🔥" },
  { id: "all_clear", name: "Champion", description: "Beat all 5 levels in one run", icon: "🌟" },
];

const UPGRADE_DEFS: UpgradeDef[] = [
  { id: "mappeek", name: "Map Peek", description: "Fog lifts for 2 seconds at maze start", cost: 100, icon: "🗺️" },
  { id: "trapshield", name: "Trap Shield", description: "First trap hit is negated", cost: 150, icon: "🛡️" },
  { id: "speedboost", name: "Speed Boost", description: "Move 30% faster for first 10 moves", cost: 200, icon: "⚡" },
];

const DUMMY_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: "MazeKing", score: 12400 },
  { rank: 2, name: "PathFinder", score: 9800 },
  { rank: 3, name: "SpeedRunner", score: 7600 },
  { rank: 4, name: "NeonDash", score: 6100 },
  { rank: 5, name: "RetroNav", score: 4800 },
  { rank: 6, name: "PixelRunner", score: 3500 },
  { rank: 7, name: "ArcadeAce", score: 2800 },
  { rank: 8, name: "GlowPath", score: 2100 },
  { rank: 9, name: "CasualMaze", score: 1400 },
  { rank: 10, name: "FirstTimer", score: 700 },
];

// ─── Maze Generation ───

function generateMaze(w: number, h: number, loopCount: number): Cell[][] {
  const grid: Cell[][] = Array.from({ length: h }, () =>
    Array.from({ length: w }, () => ({
      top: true, right: true, bottom: true, left: true, visited: false,
    }))
  );

  // Step 1: Recursive backtracker to create a spanning tree (perfect maze)
  const stack: [number, number][] = [];
  grid[0][0].visited = true;
  stack.push([0, 0]);

  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1];
    const neighbors: [number, number, Dir][] = [];

    if (cy > 0 && !grid[cy - 1][cx].visited) neighbors.push([cx, cy - 1, "UP"]);
    if (cy < h - 1 && !grid[cy + 1][cx].visited) neighbors.push([cx, cy + 1, "DOWN"]);
    if (cx > 0 && !grid[cy][cx - 1].visited) neighbors.push([cx - 1, cy, "LEFT"]);
    if (cx < w - 1 && !grid[cy][cx + 1].visited) neighbors.push([cx + 1, cy, "RIGHT"]);

    if (neighbors.length === 0) {
      stack.pop();
    } else {
      const [nx, ny, dir] = neighbors[Math.floor(Math.random() * neighbors.length)];
      if (dir === "UP") { grid[cy][cx].top = false; grid[ny][nx].bottom = false; }
      if (dir === "DOWN") { grid[cy][cx].bottom = false; grid[ny][nx].top = false; }
      if (dir === "LEFT") { grid[cy][cx].left = false; grid[ny][nx].right = false; }
      if (dir === "RIGHT") { grid[cy][cx].right = false; grid[ny][nx].left = false; }
      grid[ny][nx].visited = true;
      stack.push([nx, ny]);
    }
  }

  // Step 2: Remove extra walls to create loops/branches (multiple paths)
  const walls: { x: number; y: number; dir: Dir }[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y > 0 && grid[y][x].top) walls.push({ x, y, dir: "UP" });
      if (x > 0 && grid[y][x].left) walls.push({ x, y, dir: "LEFT" });
    }
  }
  // Shuffle and remove some walls to create alternate paths
  for (let i = walls.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [walls[i], walls[j]] = [walls[j], walls[i]];
  }
  let removed = 0;
  for (const wall of walls) {
    if (removed >= loopCount) break;
    const { x, y, dir } = wall;
    if (dir === "UP") {
      grid[y][x].top = false;
      grid[y - 1][x].bottom = false;
    } else {
      grid[y][x].left = false;
      grid[y][x - 1].right = false;
    }
    removed++;
  }

  return grid;
}

function placeTrapsAndStars(
  w: number, h: number, maze: Cell[][],
  starCount: number, trapCount: number
): { stars: Set<string>; traps: Set<string> } {
  const reserved = new Set(["0,0", `${w - 1},${h - 1}`]);
  const candidates: string[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const key = `${x},${y}`;
      if (!reserved.has(key)) candidates.push(key);
    }
  // Shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const stars = new Set<string>();
  const traps = new Set<string>();
  let idx = 0;
  for (let i = 0; i < starCount && idx < candidates.length; i++, idx++) stars.add(candidates[idx]);
  for (let i = 0; i < trapCount && idx < candidates.length; i++, idx++) traps.add(candidates[idx]);
  return { stars, traps };
}

function shortestPathLength(maze: Cell[][], w: number, h: number): number {
  const visited = Array.from({ length: h }, () => Array(w).fill(false));
  const queue: [number, number, number][] = [[0, 0, 0]];
  visited[0][0] = true;

  while (queue.length > 0) {
    const [x, y, dist] = queue.shift()!;
    if (x === w - 1 && y === h - 1) return dist;

    const cell = maze[y][x];
    const dirs: [boolean, number, number][] = [
      [!cell.top, x, y - 1],
      [!cell.bottom, x, y + 1],
      [!cell.left, x - 1, y],
      [!cell.right, x + 1, y],
    ];

    for (const [open, nx, ny] of dirs) {
      if (open && nx >= 0 && nx < w && ny >= 0 && ny < h && !visited[ny][nx]) {
        visited[ny][nx] = true;
        queue.push([nx, ny, dist + 1]);
      }
    }
  }
  return Infinity;
}

// ─── Component ──────────────────────────────────────────────────────────────

const MazeRunner: React.FC<MazeRunnerProps> = ({ onBack }) => {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [level, setLevel] = useState(0);
  const [maze, setMaze] = useState<Cell[][]>([]);
  const mazeRef = useRef<Cell[][]>([]);
  const [playerPos, setPlayerPos] = useState<[number, number]>([0, 0]);
  const playerPosRef = useRef<[number, number]>([0, 0]);
  const [moveCount, setMoveCount] = useState(0);
  const [timer, setTimer] = useState(0);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [bestLevelsCompleted, setBestLevelsCompleted] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [visitedCells, setVisitedCells] = useState<Set<string>>(new Set());
  const [starCells, setStarCells] = useState<Set<string>>(new Set());
  const starCellsRef = useRef<Set<string>>(new Set());
  const [trapCells, setTrapCells] = useState<Set<string>>(new Set());
  const trapCellsRef = useRef<Set<string>>(new Set());
  const [collectedStars, setCollectedStars] = useState(0);

  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const [points, setPoints] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [totalMazesCleared, setTotalMazesCleared] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [activeSkin, setActiveSkin] = useState("classic");
  const [ownedSkins, setOwnedSkins] = useState<string[]>(["classic"]);
  const [screenFlash, setScreenFlash] = useState(false);
  const [shakeBoard, setShakeBoard] = useState(false);
  const [shopGlow, setShopGlow] = useState(false);
  const [badgeGlow, setBadgeGlow] = useState(false);
  const [rankGlow, setRankGlow] = useState(false);
  const [shopNotified, setShopNotified] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [shopSubTab, setShopSubTab] = useState<ShopSubTab>("skins");
  const [ownedUpgrades, setOwnedUpgrades] = useState<string[]>([]);
  const [fogLifted, setFogLifted] = useState(false);

  const gameStateRef = useRef<GameState>("idle");
  const containerRef = useRef<HTMLDivElement>(null);
  const toastIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const pointsRef = useRef(0);
  const sessionMrPointsRef = useRef(0);
  const timerRef = useRef(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const moveCountRef = useRef(0);
  const totalStepsRef = useRef(0);
  const totalMazesClearedRef = useRef(0);
  const levelRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const levelsBeatenThisRun = useRef(0);
  const fogLiftedRef = useRef(false);
  const trapShieldRef = useRef(false);
  const movesThisLevelRef = useRef(0);
  const lastMoveThrottleAtRef = useRef(0);
  const fogPeekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const MOVE_THROTTLE_BASE_MS = 100;

  // ── Load persisted data ──
  useEffect(() => {
    setIsTouchDevice(detectTouchDevice());
    const onGlobals = () => setIsTouchDevice(detectTouchDevice());
    window.addEventListener("openai:set_globals", onGlobals, { passive: true });

    setBestScore(loadJSON("mr-best-score", 0));
    setBestLevelsCompleted(loadJSON("mr-best-levels", 0));
    setPoints(loadJSON("mr-points", 0));
    pointsRef.current = loadJSON("mr-points", 0);
    setGamesPlayed(loadJSON("mr-games-played", 0));
    setTotalMazesCleared(loadJSON("mr-total-mazes", 0));
    totalMazesClearedRef.current = loadJSON("mr-total-mazes", 0);
    setTotalSteps(loadJSON("mr-total-steps", 0));
    totalStepsRef.current = loadJSON("mr-total-steps", 0);
    setActiveSkin(loadJSON("mr-active-skin", "classic"));
    setOwnedSkins(loadJSON("mr-owned-skins", ["classic"]));
    setOwnedUpgrades(loadJSON("mr-upgrades", []));

    const earnedIds: string[] = loadJSON("mr-badges", []);
    setBadges(BADGE_DEFS.map(b => ({ ...b, earned: earnedIds.includes(b.id) })));
    setShopNotified(loadJSON("mr-shop-notified", false));

    return () => window.removeEventListener("openai:set_globals", onGlobals);
  }, []);

  useEffect(() => () => {
    if (fogPeekTimerRef.current) clearTimeout(fogPeekTimerRef.current);
  }, []);

  // ── Focus tracking ──
  useEffect(() => {
    const onFocus = () => setIsFocused(true);
    const onBlur = () => setIsFocused(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    if (document.hasFocus()) setIsFocused(true);
    return () => { window.removeEventListener("focus", onFocus); window.removeEventListener("blur", onBlur); };
  }, []);

  // Pause on blur
  useEffect(() => {
    if (!isFocused && gameState === "playing") {
      setGameState("paused");
      gameStateRef.current = "paused";
      if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    }
  }, [isFocused, gameState]);

  // ── Timer ──
  useEffect(() => {
    if (gameState === "playing") {
      timerIntervalRef.current = setInterval(() => {
        timerRef.current++;
        setTimer(timerRef.current);
      }, 1000);
    } else {
      if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    }
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [gameState]);

  // ── Toast cleanup ──
  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => {
      const now = Date.now();
      setToasts(prev => prev.filter(t => now - t.createdAt < TOAST_DURATION_MS));
    }, TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [toasts]);

  // ── Particle animation ──
  useEffect(() => {
    if (particles.length === 0) return;
    const frame = requestAnimationFrame(() => {
      setParticles(prev =>
        prev.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.3, life: p.life - 1 }))
          .filter(p => p.life > 0)
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [particles]);

  // ── Helpers ──

  const addToast = useCallback((text: string, color = "#fbbf24") => {
    const id = ++toastIdRef.current;
    setToasts([{ id, text, color, createdAt: Date.now() }]);
  }, []);

  const spawnParticles = useCallback((cx: number, cy: number, color: string) => {
    const newP: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.5;
      const speed = 1.5 + Math.random() * 2;
      newP.push({
        id: ++particleIdRef.current, x: cx, y: cy,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
        life: 15 + Math.floor(Math.random() * 10),
        color, size: 3 + Math.random() * 3,
      });
    }
    setParticles(prev => [...prev, ...newP]);
  }, []);

  const flashScreen = useCallback(() => {
    setScreenFlash(true);
    setTimeout(() => setScreenFlash(false), 150);
  }, []);

  const shakeScreen = useCallback(() => {
    setShakeBoard(true);
    setTimeout(() => setShakeBoard(false), 200);
  }, []);

  const earnBadge = useCallback((badgeId: string) => {
    setBadges(prev => {
      const badge = prev.find(b => b.id === badgeId);
      if (!badge || badge.earned) return prev;
      const updated = prev.map(b => (b.id === badgeId ? { ...b, earned: true } : b));
      saveJSON("mr-badges", updated.filter(b => b.earned).map(b => b.id));
      const def = BADGE_DEFS.find(d => d.id === badgeId);
      if (def) { addToast(`${def.icon} Badge: ${def.name}!`, "#a78bfa"); setBadgeGlow(true); }
      return updated;
    });
  }, [addToast]);

  const getSkin = useCallback((): SkinDef => {
    return SKINS.find(s => s.id === activeSkin) || SKINS[0];
  }, [activeSkin]);

  // ── Game logic ──

  const initLevel = useCallback((lvl: number) => {
    if (fogPeekTimerRef.current) {
      clearTimeout(fogPeekTimerRef.current);
      fogPeekTimerRef.current = null;
    }
    fogLiftedRef.current = false;
    setFogLifted(false);

    const cfg = LEVELS[Math.min(lvl, LEVELS.length - 1)];
    const m = generateMaze(cfg.w, cfg.h, cfg.loops);
    const { stars, traps } = placeTrapsAndStars(cfg.w, cfg.h, m, cfg.stars, cfg.traps);
    mazeRef.current = m;
    setMaze(m);
    starCellsRef.current = stars;
    setStarCells(stars);
    trapCellsRef.current = traps;
    setTrapCells(traps);
    setCollectedStars(0);
    playerPosRef.current = [0, 0];
    setPlayerPos([0, 0]);
    setVisitedCells(new Set(["0,0"]));
    moveCountRef.current = 0;
    setMoveCount(0);
    movesThisLevelRef.current = 0;
    lastMoveThrottleAtRef.current = 0;
    trapShieldRef.current = ownedUpgrades.includes("trapshield");

    if (ownedUpgrades.includes("mappeek")) {
      fogLiftedRef.current = true;
      setFogLifted(true);
      fogPeekTimerRef.current = setTimeout(() => {
        fogLiftedRef.current = false;
        setFogLifted(false);
        fogPeekTimerRef.current = null;
      }, 2000);
    }
  }, [ownedUpgrades]);

  const startGame = useCallback(() => {
    levelRef.current = 0;
    setLevel(0);
    timerRef.current = 0;
    setTimer(0);
    setScore(0);
    setTotalTime(0);
    setToasts([]);
    setParticles([]);
    setActiveTab(null);
    levelsBeatenThisRun.current = 0;
    sessionMrPointsRef.current = 0;

    const newGames = gamesPlayed + 1;
    setGamesPlayed(newGames);
    saveJSON("mr-games-played", newGames);
    if (newGames >= 5) earnBadge("games_5");
    if (newGames >= 25) earnBadge("games_25");

    initLevel(0);
    setGameState("playing");
    gameStateRef.current = "playing";
    containerRef.current?.focus({ preventScroll: true });
  }, [gamesPlayed, initLevel, earnBadge]);

  const handleLevelClear = useCallback(() => {
    const cfg = LEVELS[Math.min(levelRef.current, LEVELS.length - 1)];
    const levelTime = timerRef.current;
    const minMoves = shortestPathLength(mazeRef.current, cfg.w, cfg.h);
    const timeBonus = Math.max(0, 100 - levelTime * 2);
    const moveBonus = moveCountRef.current <= minMoves ? 200 : Math.max(0, 150 - (moveCountRef.current - minMoves) * 5);
    const sizeBonus = cfg.w * cfg.h * 2;
    const starBonus = collectedStars * 50;
    const levelScore = timeBonus + moveBonus + sizeBonus + starBonus;
    if (collectedStars > 0) addToast(`⭐ Star bonus: +${starBonus}!`, "#fbbf24");

    setScore(prev => prev + levelScore);
    setTotalTime(prev => prev + levelTime);

    const earned = Math.max(1, Math.floor(levelScore / 10));
    sessionMrPointsRef.current += earned;
    pointsRef.current += earned;
    setPoints(pointsRef.current);
    saveJSON("mr-points", pointsRef.current);

    totalMazesClearedRef.current++;
    setTotalMazesCleared(totalMazesClearedRef.current);
    saveJSON("mr-total-mazes", totalMazesClearedRef.current);

    levelsBeatenThisRun.current++;

    earnBadge("first_maze");
    if (totalMazesClearedRef.current >= 10) earnBadge("total_10");
    if (totalMazesClearedRef.current >= 50) earnBadge("total_50");
    if (levelTime <= 10) earnBadge("fast_10");
    if (levelTime <= 5) earnBadge("fast_5");
    if (moveCountRef.current <= minMoves) earnBadge("moves_min");
    if (levelRef.current === 0 && moveCountRef.current <= minMoves) earnBadge("no_backtrack");
    if (levelsBeatenThisRun.current >= 3) earnBadge("streak_3");

    if (!shopNotified) {
      const cheapest = SKINS.filter(s => s.cost > 0 && !ownedSkins.includes(s.id)).sort((a, b) => a.cost - b.cost)[0];
      if (cheapest && pointsRef.current >= cheapest.cost) {
        setShopGlow(true);
        setShopNotified(true);
        saveJSON("mr-shop-notified", true);
        addToast("🛒 You can buy a skin!", "#22c55e");
      }
    }

    const skin = getSkin();
    const cellSz = Math.floor(BOARD_PX / cfg.w);
    spawnParticles((cfg.w - 1) * cellSz + cellSz / 2, (cfg.h - 1) * cellSz + cellSz / 2, skin.headColor);
    flashScreen();

    const nextLevel = levelRef.current + 1;
    if (nextLevel >= LEVELS.length) {
      earnBadge("level_5");
      earnBadge("all_clear");

      const finalScore = score + levelScore;
      if (finalScore > bestScore) {
        setBestScore(finalScore);
        saveJSON("mr-best-score", finalScore);
        addToast("🏆 New Best Score!", "#eab308");
        setRankGlow(true);
      } else if (finalScore > 0 && bestScore === 0) {
        setRankGlow(true);
      }

      const levelsDone = levelsBeatenThisRun.current;
      if (levelsDone > loadJSON("mr-best-levels", 0)) {
        saveJSON("mr-best-levels", levelsDone);
        setBestLevelsCompleted(levelsDone);
      }

      addToast("🌟 All mazes cleared!", "#22c55e");
      setGameState("won");
      gameStateRef.current = "won";

      const streak = recordStreak();
      const baseEarned = sessionMrPointsRef.current;
      sessionMrPointsRef.current = 0;
      if (baseEarned > 0) {
        const earnedPts = Math.round(baseEarned * streak.multiplier);
        const bonus = earnedPts - baseEarned;
        if (bonus > 0) {
          pointsRef.current += bonus;
          setPoints(pointsRef.current);
          saveJSON("mr-points", pointsRef.current);
        }
        if (streak.multiplier > 1) {
          addToast(`🔥 ${streak.multiplier}x streak bonus!`, "#fbbf24");
        }
      }

      return;
    }

    if (nextLevel >= 2) earnBadge("level_2");
    if (nextLevel >= 3) earnBadge("level_3");

    addToast(`🎯 ${LEVELS[nextLevel].label}!`, "#22c55e");
    levelRef.current = nextLevel;
    setLevel(nextLevel);
    timerRef.current = 0;
    setTimer(0);
    initLevel(nextLevel);
  }, [score, bestScore, earnBadge, addToast, getSkin, spawnParticles, flashScreen, initLevel, shopNotified, ownedSkins]);

  const handleMove = useCallback((dir: Dir) => {
    if (gameStateRef.current !== "playing") return;

    const [px, py] = playerPosRef.current;
    const cfg = LEVELS[Math.min(levelRef.current, LEVELS.length - 1)];
    const cell = mazeRef.current[py]?.[px];
    if (!cell) return;

    let nx = px, ny = py;
    if (dir === "UP" && !cell.top) ny--;
    else if (dir === "DOWN" && !cell.bottom) ny++;
    else if (dir === "LEFT" && !cell.left) nx--;
    else if (dir === "RIGHT" && !cell.right) nx++;

    if (nx === px && ny === py) {
      shakeScreen();
      return;
    }

    const now = Date.now();
    const speedBoosted = ownedUpgrades.includes("speedboost") && movesThisLevelRef.current < 10;
    const minInterval = speedBoosted ? MOVE_THROTTLE_BASE_MS * 0.7 : MOVE_THROTTLE_BASE_MS;
    if (now - lastMoveThrottleAtRef.current < minInterval) return;
    lastMoveThrottleAtRef.current = now;

    moveCountRef.current++;
    movesThisLevelRef.current++;
    setMoveCount(moveCountRef.current);

    totalStepsRef.current++;
    setTotalSteps(totalStepsRef.current);
    saveJSON("mr-total-steps", totalStepsRef.current);
    if (totalStepsRef.current >= 500) earnBadge("steps_500");
    if (totalStepsRef.current >= 2000) earnBadge("steps_2000");

    let finalX = nx, finalY = ny;
    const key = `${nx},${ny}`;
    setVisitedCells(prev => new Set(prev).add(key));

    if (starCellsRef.current.has(key)) {
      starCellsRef.current = new Set(starCellsRef.current);
      starCellsRef.current.delete(key);
      setStarCells(starCellsRef.current);
      setCollectedStars(prev => prev + 1);
      const starPts = 25;
      sessionMrPointsRef.current += starPts;
      pointsRef.current += starPts;
      setPoints(pointsRef.current);
      saveJSON("mr-points", pointsRef.current);
      setScore(prev => prev + starPts);
      addToast("⭐ +25!", "#fbbf24");
      const cellSz = Math.floor(BOARD_PX / cfg.w);
      spawnParticles(nx * cellSz + cellSz / 2, ny * cellSz + cellSz / 2, "#fbbf24");
      flashScreen();
    }

    if (trapCellsRef.current.has(key)) {
      trapCellsRef.current = new Set(trapCellsRef.current);
      trapCellsRef.current.delete(key);
      if (trapShieldRef.current) {
        trapShieldRef.current = false;
        setTrapCells(trapCellsRef.current);
        addToast("🛡️ Trap Negated!", "#a78bfa");
      } else {
        setTrapCells(trapCellsRef.current);
        addToast("💀 Trap! Teleported!", "#ef4444");
        shakeScreen();
        const openCells: [number, number][] = [];
        for (let ty = 0; ty < cfg.h; ty++)
          for (let tx = 0; tx < cfg.w; tx++) {
            const k = `${tx},${ty}`;
            if (k !== key && k !== `${cfg.w - 1},${cfg.h - 1}` && k !== "0,0") openCells.push([tx, ty]);
          }
        if (openCells.length > 0) {
          const [tx, ty] = openCells[Math.floor(Math.random() * openCells.length)];
          finalX = tx;
          finalY = ty;
          setVisitedCells(prev => new Set(prev).add(`${tx},${ty}`));
        }
      }
    }

    playerPosRef.current = [finalX, finalY];
    setPlayerPos([finalX, finalY]);

    if (finalX === cfg.w - 1 && finalY === cfg.h - 1) {
      setTimeout(() => handleLevelClear(), 0);
    }
  }, [shakeScreen, earnBadge, handleLevelClear, addToast, spawnParticles, flashScreen, ownedUpgrades]);

  // ── Input ──
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const dirMap: Record<string, Dir> = {
      ArrowUp: "UP", w: "UP", W: "UP",
      ArrowDown: "DOWN", s: "DOWN", S: "DOWN",
      ArrowLeft: "LEFT", a: "LEFT", A: "LEFT",
      ArrowRight: "RIGHT", d: "RIGHT", D: "RIGHT",
    };
    const dir = dirMap[e.key];

    if (dir) e.preventDefault();

    if (gameStateRef.current === "idle") {
      if (dir || e.key === " ") { startGame(); return; }
    }

    if (e.key === " ") {
      e.preventDefault();
      if (gameStateRef.current === "playing") {
        setGameState("paused"); gameStateRef.current = "paused";
      } else if (gameStateRef.current === "paused") {
        setGameState("playing"); gameStateRef.current = "playing";
      }
      return;
    }

    if (dir) handleMove(dir);
  }, [handleMove, startGame]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    const MIN_SWIPE = 20;
    if (Math.abs(dx) < MIN_SWIPE && Math.abs(dy) < MIN_SWIPE) return;

    if (gameStateRef.current === "idle") { startGame(); return; }
    if (gameStateRef.current !== "playing") return;

    if (Math.abs(dx) > Math.abs(dy)) {
      handleMove(dx > 0 ? "RIGHT" : "LEFT");
    } else {
      handleMove(dy > 0 ? "DOWN" : "UP");
    }
  }, [handleMove, startGame]);

  const buySkin = useCallback((skinId: string) => {
    const skin = SKINS.find(s => s.id === skinId);
    if (!skin || ownedSkins.includes(skinId)) return;
    if (pointsRef.current < skin.cost) return;
    pointsRef.current -= skin.cost;
    setPoints(pointsRef.current);
    saveJSON("mr-points", pointsRef.current);
    const newOwned = [...ownedSkins, skinId];
    setOwnedSkins(newOwned);
    saveJSON("mr-owned-skins", newOwned);
    setActiveSkin(skinId);
    saveJSON("mr-active-skin", skinId);
    addToast(`${skin.preview} Unlocked ${skin.name}!`, "#22c55e");
  }, [ownedSkins, addToast]);

  const buyUpgrade = useCallback((upgradeId: string) => {
    const upg = UPGRADE_DEFS.find(u => u.id === upgradeId);
    if (!upg || ownedUpgrades.includes(upgradeId)) return;
    if (pointsRef.current < upg.cost) return;
    pointsRef.current -= upg.cost;
    setPoints(pointsRef.current);
    saveJSON("mr-points", pointsRef.current);
    const newOwned = [...ownedUpgrades, upgradeId];
    setOwnedUpgrades(newOwned);
    saveJSON("mr-upgrades", newOwned);
    addToast(`${upg.icon} ${upg.name} Unlocked!`, "#a78bfa");
  }, [ownedUpgrades, addToast]);

  const equipSkin = useCallback((skinId: string) => {
    if (!ownedSkins.includes(skinId)) return;
    setActiveSkin(skinId);
    saveJSON("mr-active-skin", skinId);
  }, [ownedSkins]);

  // ── Rendering ──

  const skin = getSkin();
  const cfg = LEVELS[Math.min(level, LEVELS.length - 1)];
  const cellSz = Math.floor(BOARD_PX / cfg.w);
  const boardW = cellSz * cfg.w;
  const boardH = cellSz * cfg.h;
  const wallColor = "#4338ca";
  const wallWidth = 2;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const renderMaze = () => {
    if (maze.length === 0) return null;
    const elements: React.ReactNode[] = [];
    const fogR = cfg.fogRadius;
    const [px, py] = playerPos;

    for (let y = 0; y < cfg.h; y++) {
      for (let x = 0; x < cfg.w; x++) {
        const cell = maze[y][x];
        const cx = x * cellSz;
        const cy = y * cellSz;
        const isVisited = visitedCells.has(`${x},${y}`);
        const dist = Math.abs(x - px) + Math.abs(y - py);
        const inFog = !fogLifted && dist > fogR;
        const inDim = !fogLifted && dist > fogR - 1 && dist <= fogR;

        // Fog: hide unvisited cells outside fog radius (lifted entirely while Map Peek active)
        const cellOpacity = inFog && !isVisited ? 0 : inDim && !isVisited ? 0.3 : 1;

        elements.push(
          <div key={`bg-${x}-${y}`} style={{
            position: "absolute", left: cx + 1, top: cy + 1,
            width: cellSz - 2, height: cellSz - 2,
            background: isVisited ? `${skin.bodyColor}0.08)` : "transparent",
            opacity: cellOpacity,
            transition: "background 0.2s, opacity 0.3s",
          }} />
        );

        if (cell.top) {
          elements.push(<div key={`t-${x}-${y}`} style={{
            position: "absolute", left: cx, top: cy,
            width: cellSz, height: wallWidth, background: wallColor,
            boxShadow: `0 0 3px ${wallColor}80`,
            opacity: cellOpacity,
            transition: "opacity 0.3s",
          }} />);
        }
        if (cell.left) {
          elements.push(<div key={`l-${x}-${y}`} style={{
            position: "absolute", left: cx, top: cy,
            width: wallWidth, height: cellSz, background: wallColor,
            boxShadow: `0 0 3px ${wallColor}80`,
            opacity: cellOpacity,
            transition: "opacity 0.3s",
          }} />);
        }
        if (y === cfg.h - 1 && cell.bottom) {
          elements.push(<div key={`b-${x}-${y}`} style={{
            position: "absolute", left: cx, top: (y + 1) * cellSz - wallWidth,
            width: cellSz, height: wallWidth, background: wallColor,
            boxShadow: `0 0 3px ${wallColor}80`,
            opacity: cellOpacity,
            transition: "opacity 0.3s",
          }} />);
        }
        if (x === cfg.w - 1 && cell.right) {
          elements.push(<div key={`r-${x}-${y}`} style={{
            position: "absolute", left: (x + 1) * cellSz - wallWidth, top: cy,
            width: wallWidth, height: cellSz, background: wallColor,
            boxShadow: `0 0 3px ${wallColor}80`,
            opacity: cellOpacity,
            transition: "opacity 0.3s",
          }} />);
        }

        // Star
        if (starCells.has(`${x},${y}`) && !inFog) {
          const starSz = Math.max(8, cellSz * 0.45);
          elements.push(
            <div key={`star-${x}-${y}`} style={{
              position: "absolute",
              left: cx + (cellSz - starSz) / 2, top: cy + (cellSz - starSz) / 2,
              width: starSz, height: starSz,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: Math.max(8, cellSz * 0.4),
              animation: "pulse 1.5s ease-in-out infinite",
              pointerEvents: "none", zIndex: 3,
              opacity: inDim ? 0.3 : 1,
            }}>
              ⭐
            </div>
          );
        }

        // Trap
        if (trapCells.has(`${x},${y}`) && !inFog) {
          const trapSz = Math.max(8, cellSz * 0.45);
          elements.push(
            <div key={`trap-${x}-${y}`} style={{
              position: "absolute",
              left: cx + (cellSz - trapSz) / 2, top: cy + (cellSz - trapSz) / 2,
              width: trapSz, height: trapSz,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: Math.max(8, cellSz * 0.4),
              pointerEvents: "none", zIndex: 3,
              opacity: inDim ? 0.3 : 0.7,
            }}>
              💀
            </div>
          );
        }
      }
    }

    // Exit marker (always visible if in fog range or visited)
    const exitDist = Math.abs(cfg.w - 1 - px) + Math.abs(cfg.h - 1 - py);
    const exitVisible = fogLifted || exitDist <= fogR || visitedCells.has(`${cfg.w - 1},${cfg.h - 1}`);
    if (exitVisible) {
      elements.push(
        <div key="exit" style={{
          position: "absolute",
          left: (cfg.w - 1) * cellSz + cellSz * 0.15, top: (cfg.h - 1) * cellSz + cellSz * 0.15,
          width: cellSz * 0.7, height: cellSz * 0.7,
          background: "rgba(34,197,94,0.25)", borderRadius: 2,
          border: "1px solid rgba(34,197,94,0.5)",
          boxShadow: "0 0 8px rgba(34,197,94,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: Math.max(10, cellSz * 0.45),
          zIndex: 4,
        }}>
          🏁
        </div>
      );
    }

    // Player
    const playerSize = cellSz * 0.6;
    elements.push(
      <div key="player" style={{
        position: "absolute",
        left: playerPos[0] * cellSz + (cellSz - playerSize) / 2,
        top: playerPos[1] * cellSz + (cellSz - playerSize) / 2,
        width: playerSize, height: playerSize,
        background: skin.headColor, borderRadius: "50%",
        boxShadow: `0 0 8px ${skin.glowColor}, 0 0 16px ${skin.glowColor}`,
        transition: "left 0.1s ease-out, top 0.1s ease-out",
        zIndex: 5,
      }} />
    );

    return elements;
  };

  const buildLeaderboard = (): LeaderboardEntry[] => {
    if (bestScore === 0) return DUMMY_LEADERBOARD.map((e, i) => ({ ...e, rank: i + 1 }));
    const playerEntry: LeaderboardEntry = { rank: 0, name: "You", score: bestScore, isPlayer: true };
    return [...DUMMY_LEADERBOARD, playerEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  };

  const renderLeaderboardTab = () => {
    const lb = buildLeaderboard();
    return (
      <div style={{ width: "100%", maxWidth: boardW }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", marginBottom: 8, letterSpacing: 2, textShadow: RETRO_GLOW("#fbbf2450"), textTransform: "uppercase" }}>
          High Scores
        </div>
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 2, overflow: "hidden", border: `${PIXEL_BORDER} #1e293b` }}>
          {lb.map(entry => {
            const rankColors = ["#fbbf24", "#94a3b8", "#cd7f32"];
            const entryColor = entry.isPlayer ? "#22c55e" : entry.rank <= 3 ? rankColors[entry.rank - 1] : "#64748b";
            return (
              <div key={entry.rank} style={{
                display: "flex", alignItems: "center", padding: "6px 10px",
                borderBottom: "1px solid #0f172a",
                background: entry.isPlayer ? "rgba(34,197,94,0.08)" : "transparent",
              }}>
                <div style={{ width: 28, fontSize: 12, fontWeight: 700, color: entryColor, textShadow: entry.rank <= 3 ? RETRO_GLOW(`${entryColor}40`) : "none" }}>
                  {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `${entry.rank}.`}
                </div>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: entry.isPlayer ? "#22c55e" : "#cbd5e1", textShadow: entry.isPlayer ? RETRO_GLOW("#22c55e40") : "none" }}>
                  {entry.name}{entry.isPlayer ? " (YOU)" : ""}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: entryColor, textShadow: RETRO_GLOW(`${entryColor}30`) }}>
                  {entry.score.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderBadgesTab = () => (
    <div style={{ width: "100%", maxWidth: boardW }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#f472b6", marginBottom: 6, letterSpacing: 2, textShadow: RETRO_GLOW("#f472b650"), textTransform: "uppercase" }}>
        Badges {badges.filter(b => b.earned).length}/{badges.length}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
        {badges.map(badge => (
          <div key={badge.id} title={`${badge.name}: ${badge.description}`} style={{
            background: badge.earned ? "rgba(244,114,182,0.06)" : "rgba(255,255,255,0.01)",
            borderRadius: 2, padding: "6px 3px", textAlign: "center",
            border: badge.earned ? `${PIXEL_BORDER} #f472b640` : "1px solid #1e293b",
            opacity: badge.earned ? 1 : 0.35, cursor: "default",
            boxShadow: badge.earned ? "0 0 8px rgba(244,114,182,0.1)" : "none",
          }}>
            <div style={{ fontSize: 18 }}>{badge.icon}</div>
            <div style={{ fontSize: 10, color: badge.earned ? "#f472b6" : "#475569", marginTop: 3, fontWeight: 700, lineHeight: 1.4, letterSpacing: 0.3, textShadow: badge.earned ? RETRO_GLOW("#f472b630") : "none" }}>
              {badge.name}
            </div>
            <div style={{ fontSize: 9, color: "#475569", marginTop: 2, lineHeight: 1.3, letterSpacing: 0.2 }}>
              {badge.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderShopTab = () => (
    <div style={{ width: "100%", maxWidth: boardW }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {(["skins", "upgrades"] as ShopSubTab[]).map(sub => (
            <button key={sub} onClick={() => setShopSubTab(sub)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: RETRO_FONT, letterSpacing: 1, textTransform: "uppercase", color: shopSubTab === sub ? "#22c55e" : "#475569", textShadow: shopSubTab === sub ? RETRO_GLOW("#22c55e50") : "none", borderBottom: shopSubTab === sub ? "2px solid #22c55e" : "2px solid transparent", padding: "2px 4px" }}>{sub}</button>
          ))}
        </div>
        <div style={{ fontSize: 14, color: "#fbbf24", fontWeight: 700, textShadow: RETRO_GLOW("#fbbf2440") }}>🪙 {points}</div>
      </div>
      {shopSubTab === "skins" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {SKINS.map(s => {
            const owned = ownedSkins.includes(s.id);
            const equipped = activeSkin === s.id;
            const canAfford = pointsRef.current >= s.cost;
            return (
              <div key={s.id} style={{
                background: equipped ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.02)",
                borderRadius: 2, padding: 8,
                border: equipped ? `${PIXEL_BORDER} #22c55e` : `${PIXEL_BORDER} #1e293b`,
                boxShadow: equipped ? "0 0 10px rgba(34,197,94,0.15)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <span style={{ fontSize: 18 }}>{s.preview}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", letterSpacing: 0.5 }}>{s.name}</div>
                    {!owned && <div style={{ fontSize: 11, color: canAfford ? "#fbbf24" : "#ef4444", fontWeight: 700, marginTop: 2, textShadow: RETRO_GLOW(canAfford ? "#fbbf2430" : "#ef444430") }}>🪙 {s.cost}</div>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 2, marginBottom: 6 }}>
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} style={{
                      width: 10, height: 10, borderRadius: 1,
                      background: i === 0 ? s.headColor : `${s.bodyColor}${Math.max(0.4, 1 - i * 0.15)})`,
                      boxShadow: i === 0 ? `0 0 4px ${s.headColor}60` : "none",
                    }} />
                  ))}
                </div>
                {equipped ? (
                  <div style={{ fontSize: 11, color: "#22c55e", fontWeight: 700, textAlign: "center", letterSpacing: 1, textShadow: RETRO_GLOW("#22c55e40"), padding: "6px 0" }}>EQUIPPED</div>
                ) : owned ? (
                  <button onClick={() => equipSkin(s.id)} style={{ ...shopBtnStyle, background: "#334155", borderRadius: 2, fontFamily: RETRO_FONT, fontSize: 11, letterSpacing: 1 }}>EQUIP</button>
                ) : (
                  <button onClick={() => buySkin(s.id)} disabled={!canAfford} style={{ ...shopBtnStyle, background: canAfford ? "linear-gradient(135deg,#22c55e,#16a34a)" : "#1e293b", color: canAfford ? "#fff" : "#475569", cursor: canAfford ? "pointer" : "not-allowed", borderRadius: 2, fontFamily: RETRO_FONT, fontSize: 11, letterSpacing: 1 }}>BUY</button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {shopSubTab === "upgrades" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {UPGRADE_DEFS.map(u => {
            const owned = ownedUpgrades.includes(u.id);
            const canAfford = pointsRef.current >= u.cost;
            return (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, background: owned ? "rgba(167,139,250,0.08)" : "rgba(255,255,255,0.02)", borderRadius: 2, padding: 8, border: owned ? `${PIXEL_BORDER} #a78bfa` : `${PIXEL_BORDER} #1e293b` }}>
                <span style={{ fontSize: 20 }}>{u.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", letterSpacing: 0.5 }}>{u.name}</div>
                  <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2, lineHeight: 1.4 }}>{u.description}</div>
                </div>
                {owned ? (
                  <div style={{ fontSize: 10, color: "#a78bfa", fontWeight: 700, textShadow: RETRO_GLOW("#a78bfa40"), padding: "6px 8px" }}>OWNED</div>
                ) : (
                  <button onClick={() => buyUpgrade(u.id)} disabled={!canAfford} style={{ ...shopBtnStyle, width: "auto", padding: "6px 10px", background: canAfford ? "linear-gradient(135deg,#a78bfa,#7c3aed)" : "#1e293b", color: canAfford ? "#fff" : "#475569", cursor: canAfford ? "pointer" : "not-allowed", borderRadius: 2, fontFamily: RETRO_FONT, fontSize: 10, letterSpacing: 1, whiteSpace: "nowrap" }}>🪙 {u.cost}</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={containerRef}
      tabIndex={isTouchDevice ? undefined : 0}
      style={{
        width: "100%", maxWidth: 420, margin: "0 auto", padding: 20, outline: "none",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
        fontFamily: RETRO_FONT,
      }}
    >
      {onBack && <div style={{ width: "100%", maxWidth: boardW }}><BackButton onClick={onBack} /></div>}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", maxWidth: boardW }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: skin.headColor, textShadow: RETRO_GLOW(skin.headColor), letterSpacing: 3, textTransform: "uppercase" }}>
            Maze Runner
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#fbbf24", letterSpacing: 1, textTransform: "uppercase", textShadow: RETRO_GLOW("#fbbf2460") }}>PTS</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fbbf24", textShadow: RETRO_GLOW("#fbbf2440"), marginTop: 4 }}>🪙 {points}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#38bdf8", letterSpacing: 1, textTransform: "uppercase", textShadow: RETRO_GLOW("#38bdf860") }}>TIME</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#f8fafc", textShadow: RETRO_GLOW("#38bdf840"), marginTop: 4 }}>{formatTime(timer)}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: boardW, justifyContent: "center" }}>
        <StatBadge label="BEST" value={bestScore > 0 ? bestScore.toLocaleString() : "--"} color="#fbbf24" />
        <StatBadge label="LVL" value={level + 1} color="#22c55e" />
        <StatBadge label="MOVES" value={moveCount} color="#a78bfa" />
        <StatBadge label="STARS" value={`⭐${collectedStars}`} color="#fbbf24" />
      </div>

      {/* Game board */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: "relative", width: boardW, height: boardH,
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          borderRadius: 4, border: `${PIXEL_BORDER} #4338ca`, overflow: "hidden",
          touchAction: "none",
          boxShadow: screenFlash
            ? `0 0 30px ${skin.headColor}60, 0 0 60px ${skin.headColor}20, 0 4px 24px rgba(0,0,0,0.5)`
            : "0 0 15px rgba(67,56,202,0.3), 0 4px 24px rgba(0,0,0,0.5)",
          transform: shakeBoard ? `translate(${Math.random() * 4 - 2}px, ${Math.random() * 4 - 2}px)` : "none",
          transition: "box-shadow 0.15s, transform 0.05s",
        }}
      >
        {(gameState === "playing" || gameState === "paused") && renderMaze()}

        {/* Particles */}
        {particles.map(p => (
          <div key={p.id} style={{
            position: "absolute", left: p.x, top: p.y,
            width: p.size, height: p.size, borderRadius: "50%",
            background: p.color, opacity: p.life / 25, pointerEvents: "none",
          }} />
        ))}

        {/* Toasts */}
        {toasts.map(t => {
          const age = Date.now() - t.createdAt;
          const progress = Math.min(age / TOAST_DURATION_MS, 1);
          const scale = progress < 0.15 ? 0.5 + (progress / 0.15) * 0.5 : progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
          const opacity = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
          return (
            <div key={t.id} style={{
              position: "absolute", left: "50%", top: "50%",
              transform: `translate(-50%, -20px) scale(${scale})`,
              opacity, fontSize: 16, fontWeight: 700, color: t.color,
              fontFamily: RETRO_FONT,
              textShadow: `0 0 12px ${t.color}, 0 0 4px ${t.color}, 0 2px 4px rgba(0,0,0,0.9)`,
              pointerEvents: "none", whiteSpace: "nowrap", zIndex: 20,
              letterSpacing: 1, textTransform: "uppercase",
            }}>
              {t.text}
            </div>
          );
        })}

        {/* Overlays */}
        {gameState === "idle" && (
          <Overlay>
            <div style={{ fontSize: 28 }}>🏃</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#06b6d4", textShadow: RETRO_GLOW("#06b6d4"), letterSpacing: 2, textTransform: "uppercase" }}>
              Maze Runner
            </div>
            <div style={{ fontSize: 9, color: "#94a3b8", maxWidth: 280, textAlign: "left", lineHeight: 1.9, letterSpacing: 0.3, padding: "0 8px" }}>
              <div style={{ color: "#fbbf24", fontSize: 10, textAlign: "center", marginBottom: 2, letterSpacing: 1, textShadow: RETRO_GLOW("#fbbf2440") }}>HOW TO PLAY</div>
              <div>• Find the 🏁 exit through the fog</div>
              <div>• Collect ⭐ stars for bonus points</div>
              <div>• Avoid 💀 traps — they teleport you!</div>
              <div>• Faster time & fewer moves = higher score</div>
              <div style={{ marginTop: 2, color: "#06b6d4", textShadow: RETRO_GLOW("#06b6d430") }}>
                {isTouchDevice ? "👆 Swipe to move" : "⌨️ Arrow keys / WASD · Space = pause"}
              </div>
            </div>
            <button onClick={startGame} style={{ ...btnStyle, padding: "10px 24px", fontSize: 12, marginTop: 2 }}>
              {isTouchDevice ? ">> Tap to Start <<" : ">> Press any key <<"}
            </button>
          </Overlay>
        )}

        {gameState === "paused" && (
          <Overlay>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fbbf24", textShadow: RETRO_GLOW("#fbbf24"), letterSpacing: 3, textTransform: "uppercase" }}>
              Paused
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              {isTouchDevice ? "Tap to resume" : "Press SPACE to resume"}
            </div>
            <button onClick={() => { setGameState("playing"); gameStateRef.current = "playing"; }} style={{ ...btnStyle, padding: "10px 24px", fontSize: 12 }}>Resume</button>
          </Overlay>
        )}

        {gameState === "won" && (
          <Overlay>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#22c55e", textShadow: RETRO_GLOW("#22c55e"), letterSpacing: 3, textTransform: "uppercase" }}>
              All Clear!
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#f8fafc", textShadow: RETRO_GLOW("#22c55e40"), marginTop: 2 }}>{score.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 0.5 }}>Total time: {formatTime(totalTime)}</div>
            <div style={{ fontSize: 12, color: "#fbbf24", textShadow: RETRO_GLOW("#fbbf2440"), letterSpacing: 0.5, lineHeight: 2 }}>
              {score >= bestScore && score > 0 ? "** New Best Score! **" : `Best: ${bestScore.toLocaleString()}`}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, marginTop: 4, fontFamily: RETRO_FONT }}>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 0.3, lineHeight: 2 }}>
                Score: {score.toLocaleString()}{score >= bestScore ? (
                  <span style={{ color: "#22c55e" }}> (NEW BEST!)</span>
                ) : bestScore > 0 ? (
                  <span style={{ color: "#64748b" }}> ({Math.round((score / bestScore) * 100)}% of best)</span>
                ) : null}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 0.3, lineHeight: 2 }}>
                Levels: {levelsBeatenThisRun.current}{levelsBeatenThisRun.current >= bestLevelsCompleted ? (
                  <span style={{ color: "#22c55e" }}> (NEW BEST!)</span>
                ) : bestLevelsCompleted > 0 ? (
                  <span style={{ color: "#64748b" }}> ({Math.round((levelsBeatenThisRun.current / bestLevelsCompleted) * 100)}% of best)</span>
                ) : null}
              </div>
            </div>
            <button onClick={startGame} style={{ ...btnStyle, padding: "10px 24px", fontSize: 12 }}>Play Again</button>
          </Overlay>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, width: "100%", maxWidth: boardW }}>
        {(["leaderboard", "badges", "shop"] as TabId[]).map(tab => {
          const isActive = activeTab === tab;
          const tabColor = tab === "leaderboard" ? "#fbbf24" : tab === "badges" ? "#f472b6" : "#22c55e";
          const isGlowing = !isActive && (
            (tab === "shop" && shopGlow) ||
            (tab === "badges" && badgeGlow) ||
            (tab === "leaderboard" && rankGlow)
          );
          const glowColor = tabColor;
          return (
            <button key={tab} onClick={() => {
              if (!isActive && (gameStateRef.current === "playing")) {
                setGameState("paused"); gameStateRef.current = "paused";
              }
              setActiveTab(isActive ? null : tab);
              if (tab === "shop" && shopGlow) setShopGlow(false);
              if (tab === "badges" && badgeGlow) setBadgeGlow(false);
              if (tab === "leaderboard" && rankGlow) setRankGlow(false);
            }} style={{
              flex: 1, padding: "10px 0", border: `${PIXEL_BORDER} ${isActive ? tabColor : isGlowing ? glowColor : "#1e293b"}`,
              borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: "pointer",
              fontFamily: RETRO_FONT,
              background: isActive ? `${tabColor}18` : isGlowing ? `${glowColor}18` : "transparent",
              color: isActive ? tabColor : isGlowing ? glowColor : "#475569",
              textTransform: "uppercase", letterSpacing: 1,
              textShadow: isActive ? RETRO_GLOW(`${tabColor}60`) : isGlowing ? RETRO_GLOW(glowColor) : "none",
              boxShadow: isActive ? `0 0 10px ${tabColor}30` : isGlowing ? `0 0 14px ${glowColor}60` : "none",
              animation: isGlowing ? `${tab === "shop" ? "shopPulse" : tab === "badges" ? "badgePulse" : "rankPulse"} 1.2s ease-in-out infinite` : "none",
            }}>
              <span style={{ fontSize: 16, display: "block", lineHeight: 1 }}>{tab === "leaderboard" ? "🏆" : tab === "badges" ? "🎖️" : "🛒"}</span>
              <span style={{ fontSize: 10, display: "block", marginTop: 8 }}>{tab === "leaderboard" ? "SCORES" : tab === "badges" ? "BADGES" : "SHOP"}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab && (
        <div style={{ width: "100%", maxWidth: boardW, maxHeight: 260, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch" }}>
          {activeTab === "leaderboard" && renderLeaderboardTab()}
          {activeTab === "badges" && renderBadgesTab()}
          {activeTab === "shop" && renderShopTab()}
        </div>
      )}

      <style>{RETRO_CSS}</style>
    </div>
  );
};

export default MazeRunner;
