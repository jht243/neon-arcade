import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  type Toast, type Particle, type Badge, type SkinDef, type LeaderboardEntry, type TabId,
  type ShopSubTab, type UpgradeDef,
  RETRO_FONT, RETRO_GLOW, PIXEL_BORDER, DIFFICULTIES, DIFFICULTY_POINT_MULTIPLIER,
  TOAST_DURATION_MS, PARTICLE_COUNT,
  btnStyle, shopBtnStyle,
  loadJSON, saveJSON, detectTouchDevice, recordStreak,
  StatBadge, Overlay, BackButton, RETRO_CSS,
} from "./shared";

// ─── Types ──────────────────────────────────────────────────────────────────

type CellState = "hidden" | "revealed" | "flagged";
type GameState = "idle" | "playing" | "paused" | "won" | "lost";

interface Cell {
  mine: boolean;
  adjacentMines: number;
  state: CellState;
}

interface MinesweeperProps {
  onBack?: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DIFFICULTY_CONFIG: Record<string, { rows: number; cols: number; mines: number }> = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 14, cols: 14, mines: 35 },
  hard: { rows: 18, cols: 18, mines: 55 },
};

const NUMBER_COLORS: Record<number, string> = {
  1: "#3b82f6", 2: "#22c55e", 3: "#ef4444", 4: "#7c3aed",
  5: "#f97316", 6: "#06b6d4", 7: "#1e293b", 8: "#64748b",
};

const SKINS: SkinDef[] = [
  { id: "classic", name: "Classic", cost: 0, headColor: "#3b82f6", bodyColor: "rgba(59,130,246,", glowColor: "rgba(59,130,246,0.6)", preview: "🔵" },
  { id: "ocean", name: "Ocean Deep", cost: 50, headColor: "#06b6d4", bodyColor: "rgba(6,182,212,", glowColor: "rgba(6,182,212,0.6)", preview: "🌊" },
  { id: "molten", name: "Molten Core", cost: 75, headColor: "#f97316", bodyColor: "rgba(249,115,22,", glowColor: "rgba(249,115,22,0.6)", preview: "🌋" },
  { id: "toxic", name: "Toxic", cost: 100, headColor: "#84cc16", bodyColor: "rgba(132,204,22,", glowColor: "rgba(132,204,22,0.6)", preview: "☢️" },
  { id: "neon", name: "Neon Grid", cost: 150, headColor: "#d946ef", bodyColor: "rgba(217,70,239,", glowColor: "rgba(217,70,239,0.6)", preview: "💜" },
  { id: "gold", name: "Golden Age", cost: 200, headColor: "#eab308", bodyColor: "rgba(234,179,8,", glowColor: "rgba(234,179,8,0.6)", preview: "👑" },
];

const BADGE_DEFS: Omit<Badge, "earned">[] = [
  { id: "first_clear", name: "First Sweep", description: "Clear your first board", icon: "🧹" },
  { id: "clear_10", name: "Sweeper", description: "Clear 10 boards", icon: "🏅" },
  { id: "clear_25", name: "Veteran", description: "Clear 25 boards", icon: "🎖️" },
  { id: "clear_50", name: "Mine Master", description: "Clear 50 boards", icon: "👑" },
  { id: "speed_60", name: "Quick Sweep", description: "Clear in under 60s", icon: "⏱️" },
  { id: "speed_30", name: "Speed Demon", description: "Clear in under 30s", icon: "⚡" },
  { id: "no_flag", name: "Flagless", description: "Win without flags", icon: "🚫" },
  { id: "flag_all", name: "Flag Planter", description: "Flag all mines to win", icon: "🚩" },
  { id: "hard_clear", name: "Hardcore", description: "Clear a Hard board", icon: "💀" },
  { id: "games_5", name: "Regular", description: "Play 5 games", icon: "🎮" },
  { id: "games_25", name: "Dedicated", description: "Play 25 games", icon: "🏆" },
  { id: "streak_3", name: "Hot Streak", description: "Win 3 in a row", icon: "🔥" },
  { id: "perfect_easy", name: "Easy Ace", description: "Clear Easy in under 20s", icon: "🏎️" },
  { id: "reveal_500", name: "Explorer", description: "Reveal 500 cells total", icon: "🗺️" },
  { id: "reveal_1000", name: "Cartographer", description: "Reveal 1000 cells total", icon: "🌍" },
  { id: "close_call", name: "Close Call", description: "Last cell revealed wins", icon: "😰" },
];

const UPGRADE_DEFS: UpgradeDef[] = [
  { id: "safereveal", name: "Safe Reveal", description: "First click reveals a 3×3 area", cost: 100, icon: "🔍" },
  { id: "minehint", name: "Mine Hint", description: "One mine flashes briefly at start", cost: 200, icon: "💡" },
];

const DUMMY_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: "MineMaster42", score: 12 },
  { rank: 2, name: "SpeedSweeper", score: 18 },
  { rank: 3, name: "BombSquadX", score: 24 },
  { rank: 4, name: "FlagRunner", score: 31 },
  { rank: 5, name: "SafeZone99", score: 38 },
  { rank: 6, name: "GridWalker", score: 45 },
  { rank: 7, name: "NeonDefuser", score: 52 },
  { rank: 8, name: "PixelProbe", score: 60 },
  { rank: 9, name: "ClearField", score: 68 },
  { rank: 10, name: "CasualClick", score: 78 },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function createEmptyGrid(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ mine: false, adjacentMines: 0, state: "hidden" as CellState }))
  );
}

function placeMines(grid: Cell[][], mines: number, safeRow: number, safeCol: number): Cell[][] {
  const rows = grid.length;
  const cols = grid[0].length;
  const newGrid = grid.map(r => r.map(c => ({ ...c })));
  let placed = 0;

  while (placed < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (newGrid[r][c].mine) continue;
    if (Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1) continue;
    newGrid[r][c].mine = true;
    placed++;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (newGrid[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && newGrid[nr][nc].mine) count++;
        }
      }
      newGrid[r][c].adjacentMines = count;
    }
  }

  return newGrid;
}

function floodReveal(grid: Cell[][], row: number, col: number): Cell[][] {
  const rows = grid.length;
  const cols = grid[0].length;
  const newGrid = grid.map(r => r.map(c => ({ ...c })));
  const stack: [number, number][] = [[row, col]];

  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
    if (newGrid[r][c].state !== "hidden") continue;
    if (newGrid[r][c].mine) continue;

    newGrid[r][c].state = "revealed";

    if (newGrid[r][c].adjacentMines === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          stack.push([r + dr, c + dc]);
        }
      }
    }
  }

  return newGrid;
}

function countCells(grid: Cell[][], predicate: (c: Cell) => boolean): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (predicate(cell)) count++;
    }
  }
  return count;
}

function checkWin(grid: Cell[][]): boolean {
  for (const row of grid) {
    for (const cell of row) {
      if (!cell.mine && cell.state !== "revealed") return false;
    }
  }
  return true;
}

// ─── Component ──────────────────────────────────────────────────────────────

const Minesweeper: React.FC<MinesweeperProps> = ({ onBack }) => {
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [showDiffPicker, setShowDiffPicker] = useState(false);
  const difficultyRef = useRef("medium");

  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
  const { rows, cols, mines } = config;

  const [gameState, setGameState] = useState<GameState>("idle");
  const [grid, setGrid] = useState<Cell[][]>(() => createEmptyGrid(config.rows, config.cols));
  const [timer, setTimer] = useState(0);
  const [flagCount, setFlagCount] = useState(0);
  const [bestTime, setBestTime] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const [points, setPoints] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [totalClears, setTotalClears] = useState(0);
  const [totalRevealed, setTotalRevealed] = useState(0);
  const [winStreak, setWinStreak] = useState(0);
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
  const [shopSubTab, setShopSubTab] = useState<ShopSubTab>("skins");
  const [ownedUpgrades, setOwnedUpgrades] = useState<string[]>([]);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [flagMode, setFlagMode] = useState(false);
  const [usedFlags, setUsedFlags] = useState(false);

  const gameStateRef = useRef<GameState>("idle");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerValueRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const toastIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const pointsRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const lastWinTimeStatsRef = useRef<{ time: number; prevBest: number }>({ time: 0, prevBest: 0 });

  // ── Load persisted data ──
  useEffect(() => {
    setIsTouchDevice(detectTouchDevice());
    const onGlobals = () => setIsTouchDevice(detectTouchDevice());
    window.addEventListener("openai:set_globals", onGlobals, { passive: true });

    setBestTime(loadJSON("ms-best-time", 0));
    setPoints(loadJSON("ms-points", 0));
    pointsRef.current = loadJSON("ms-points", 0);
    setGamesPlayed(loadJSON("ms-games-played", 0));
    setTotalClears(loadJSON("ms-total-clears", 0));
    setTotalRevealed(loadJSON("ms-total-revealed", 0));
    setWinStreak(loadJSON("ms-win-streak", 0));
    setActiveSkin(loadJSON("ms-active-skin", "classic"));
    setOwnedSkins(loadJSON("ms-owned-skins", ["classic"]));
    setOwnedUpgrades(loadJSON("ms-upgrades", []));

    const earnedIds: string[] = loadJSON("ms-badges", []);
    setBadges(BADGE_DEFS.map(b => ({ ...b, earned: earnedIds.includes(b.id) })));
    setShopNotified(loadJSON("ms-shop-notified", false));

    return () => window.removeEventListener("openai:set_globals", onGlobals);
  }, []);

  // ── Close difficulty picker on outside click ──
  useEffect(() => {
    if (!showDiffPicker) return;
    const close = () => setShowDiffPicker(false);
    const t = setTimeout(() => document.addEventListener("click", close), 0);
    return () => { clearTimeout(t); document.removeEventListener("click", close); };
  }, [showDiffPicker]);

  // ── Focus tracking ──
  useEffect(() => {
    const onFocus = () => setIsFocused(true);
    const onBlur = () => {
      setIsFocused(false);
      if (gameStateRef.current === "playing") {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setGameState("paused");
        gameStateRef.current = "paused";
      }
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    if (document.hasFocus()) setIsFocused(true);
    return () => { window.removeEventListener("focus", onFocus); window.removeEventListener("blur", onBlur); };
  }, []);

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
        prev
          .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.3, life: p.life - 1 }))
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
      const earnedIds = updated.filter(b => b.earned).map(b => b.id);
      saveJSON("ms-badges", earnedIds);
      const def = BADGE_DEFS.find(d => d.id === badgeId);
      if (def) { addToast(`${def.icon} Badge: ${def.name}!`, "#a78bfa"); setBadgeGlow(true); }
      return updated;
    });
  }, [addToast]);

  const getSkin = useCallback((): SkinDef => {
    return SKINS.find(s => s.id === activeSkin) || SKINS[0];
  }, [activeSkin]);

  // ── Game logic ──

  const startGame = useCallback(() => {
    const cfg = DIFFICULTY_CONFIG[difficultyRef.current] || DIFFICULTY_CONFIG.medium;
    setGrid(createEmptyGrid(cfg.rows, cfg.cols));
    setTimer(0);
    timerValueRef.current = 0;
    setFlagCount(0);
    setToasts([]);
    setParticles([]);
    setActiveTab(null);
    setShowDiffPicker(false);
    setFlagMode(false);
    setUsedFlags(false);

    const newGames = gamesPlayed + 1;
    setGamesPlayed(newGames);
    saveJSON("ms-games-played", newGames);

    setGameState("playing");
    gameStateRef.current = "playing";
    containerRef.current?.focus();
  }, [gamesPlayed]);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      timerValueRef.current++;
      setTimer(timerValueRef.current);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const handleWin = useCallback((finalGrid: Cell[][], usedAnyFlags: boolean) => {
    stopTimer();
    setGameState("won");
    gameStateRef.current = "won";
    flashScreen();

    const time = timerValueRef.current;
    const prevBestTime = bestTime;
    lastWinTimeStatsRef.current = { time, prevBest: prevBestTime };
    const diff = difficultyRef.current;

    const newClears = totalClears + 1;
    setTotalClears(newClears);
    saveJSON("ms-total-clears", newClears);

    const newStreak = winStreak + 1;
    setWinStreak(newStreak);
    saveJSON("ms-win-streak", newStreak);

    const multiplier = DIFFICULTY_POINT_MULTIPLIER[diff] || 1;
    const baseEarned = Math.floor(10 * multiplier);
    const streak = recordStreak();
    const earned = Math.round(baseEarned * streak.multiplier);
    const newPoints = pointsRef.current + earned;
    pointsRef.current = newPoints;
    setPoints(newPoints);
    saveJSON("ms-points", newPoints);
    if (streak.multiplier > 1) {
      addToast(`🔥 ${streak.multiplier}x streak bonus!`, "#fbbf24");
    }

    if (bestTime === 0 || time < bestTime) {
      setBestTime(time);
      saveJSON("ms-best-time", time);
      if (time > 0) addToast("🏆 New Best Time!", "#eab308");
      setRankGlow(true);
    } else if (time > 0 && bestTime === 0) {
      setRankGlow(true);
    }

    if (!shopNotified) {
      const cheapest = SKINS.filter(s => s.cost > 0 && !ownedSkins.includes(s.id)).sort((a, b) => a.cost - b.cost)[0];
      if (cheapest && pointsRef.current >= cheapest.cost) {
        setShopGlow(true);
        setShopNotified(true);
        saveJSON("ms-shop-notified", true);
        addToast("🛒 You can buy a skin!", "#22c55e");
      }
    }

    earnBadge("first_clear");
    if (newClears >= 10) earnBadge("clear_10");
    if (newClears >= 25) earnBadge("clear_25");
    if (newClears >= 50) earnBadge("clear_50");
    if (time < 60) earnBadge("speed_60");
    if (time < 30) earnBadge("speed_30");
    if (!usedAnyFlags) earnBadge("no_flag");
    if (diff === "hard") earnBadge("hard_clear");
    if (newStreak >= 3) earnBadge("streak_3");
    if (diff === "easy" && time < 20) earnBadge("perfect_easy");
    if (gamesPlayed >= 5) earnBadge("games_5");
    if (gamesPlayed >= 25) earnBadge("games_25");

    const totalFlagged = countCells(finalGrid, c => c.state === "flagged");
    const minesFlagged = countCells(finalGrid, c => c.state === "flagged" && c.mine);
    const cfg = DIFFICULTY_CONFIG[diff] || DIFFICULTY_CONFIG.medium;
    if (totalFlagged === cfg.mines && minesFlagged === cfg.mines) earnBadge("flag_all");

    const revealedThisGame = countCells(finalGrid, c => c.state === "revealed");
    const newTotalRevealed = totalRevealed + revealedThisGame;
    setTotalRevealed(newTotalRevealed);
    saveJSON("ms-total-revealed", newTotalRevealed);
    if (newTotalRevealed >= 500) earnBadge("reveal_500");
    if (newTotalRevealed >= 1000) earnBadge("reveal_1000");

  }, [stopTimer, flashScreen, totalClears, winStreak, bestTime, totalRevealed, gamesPlayed, ownedSkins, shopNotified, earnBadge, addToast]);

  const handleLoss = useCallback(() => {
    stopTimer();
    setGameState("lost");
    gameStateRef.current = "lost";
    shakeScreen();

    setWinStreak(0);
    saveJSON("ms-win-streak", 0);

    setGrid(prev => prev.map(row => row.map(cell =>
      cell.mine ? { ...cell, state: "revealed" as CellState } : cell
    )));

    const revealedThisGame = countCells(grid, c => c.state === "revealed");
    const newTotalRevealed = totalRevealed + revealedThisGame;
    setTotalRevealed(newTotalRevealed);
    saveJSON("ms-total-revealed", newTotalRevealed);
    if (newTotalRevealed >= 500) earnBadge("reveal_500");
    if (newTotalRevealed >= 1000) earnBadge("reveal_1000");

    if (gamesPlayed >= 5) earnBadge("games_5");
    if (gamesPlayed >= 25) earnBadge("games_25");

  }, [stopTimer, shakeScreen, grid, totalRevealed, gamesPlayed, earnBadge]);

  const revealCell = useCallback((row: number, col: number) => {
    if (gameStateRef.current !== "playing") return;

    setGrid(prevGrid => {
      const cell = prevGrid[row]?.[col];
      if (!cell || cell.state !== "hidden") return prevGrid;

      const isFirstClick = !prevGrid.some(r => r.some(c => c.state === "revealed"));
      let workingGrid = prevGrid;

      if (isFirstClick) {
        const cfg = DIFFICULTY_CONFIG[difficultyRef.current] || DIFFICULTY_CONFIG.medium;
        workingGrid = placeMines(prevGrid, cfg.mines, row, col);
        startTimer();
      }

      if (workingGrid[row][col].mine) {
        setTimeout(() => handleLoss(), 0);
        return workingGrid.map((r, ri) =>
          r.map((c, ci) => (ri === row && ci === col ? { ...c, state: "revealed" as CellState } : c))
        );
      }

      const newGrid = floodReveal(workingGrid, row, col);

      const hiddenNonMines = countCells(newGrid, c => !c.mine && c.state !== "revealed");

      if (hiddenNonMines <= 1) {
        earnBadge("close_call");
      }

      if (checkWin(newGrid)) {
        setTimeout(() => handleWin(newGrid, usedFlags), 0);
      }

      const revealed = countCells(newGrid, c => c.state === "revealed") - countCells(workingGrid, c => c.state === "revealed");
      if (revealed > 0) {
        const newPts = pointsRef.current + revealed;
        pointsRef.current = newPts;
        setPoints(newPts);
        saveJSON("ms-points", newPts);
      }

      const skin = SKINS.find(s => s.id === activeSkin) || SKINS[0];
      const boardW = Math.min(360, cols * 24);
      const cSize = Math.floor(boardW / cols);
      spawnParticles(col * cSize + cSize / 2, row * cSize + cSize / 2, skin.headColor);

      if (revealed >= 10) {
        addToast("💥 Big Reveal!", "#3b82f6");
        flashScreen();
      }

      return newGrid;
    });
  }, [startTimer, handleLoss, handleWin, usedFlags, activeSkin, cols, spawnParticles, addToast, flashScreen, earnBadge]);

  const toggleFlag = useCallback((row: number, col: number) => {
    if (gameStateRef.current !== "playing") return;

    setGrid(prevGrid => {
      const cell = prevGrid[row]?.[col];
      if (!cell) return prevGrid;
      if (cell.state === "revealed") return prevGrid;

      const newGrid = prevGrid.map((r, ri) =>
        r.map((c, ci) => {
          if (ri !== row || ci !== col) return c;
          if (c.state === "hidden") return { ...c, state: "flagged" as CellState };
          if (c.state === "flagged") return { ...c, state: "hidden" as CellState };
          return c;
        })
      );

      const flags = countCells(newGrid, c => c.state === "flagged");
      setFlagCount(flags);

      if (newGrid[row][col].state === "flagged") {
        setUsedFlags(true);
      }

      return newGrid;
    });
  }, []);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (flagMode) {
      toggleFlag(row, col);
    } else {
      revealCell(row, col);
    }
  }, [flagMode, toggleFlag, revealCell]);

  const handleCellRightClick = useCallback((e: React.MouseEvent, row: number, col: number) => {
    e.preventDefault();
    toggleFlag(row, col);
  }, [toggleFlag]);

  const handleCellTouchStart = useCallback((row: number, col: number) => {
    if (flagMode) return;
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      toggleFlag(row, col);
    }, 500);
  }, [flagMode, toggleFlag]);

  const handleCellTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleCellTouchClick = useCallback((row: number, col: number) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    handleCellClick(row, col);
  }, [handleCellClick]);

  const resume = useCallback(() => {
    if (gameStateRef.current !== "paused") return;
    setGameState("playing");
    gameStateRef.current = "playing";
    timerRef.current = setInterval(() => {
      timerValueRef.current++;
      setTimer(timerValueRef.current);
    }, 1000);
  }, []);

  // ── Cleanup timer ──
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── Reset grid when difficulty changes in idle ──
  useEffect(() => {
    if (gameState === "idle") {
      const cfg = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
      setGrid(createEmptyGrid(cfg.rows, cfg.cols));
    }
  }, [difficulty, gameState]);

  const buySkin = useCallback((skinId: string) => {
    const skin = SKINS.find(s => s.id === skinId);
    if (!skin || ownedSkins.includes(skinId)) return;
    if (pointsRef.current < skin.cost) return;
    const newPts = pointsRef.current - skin.cost;
    pointsRef.current = newPts;
    setPoints(newPts);
    saveJSON("ms-points", newPts);
    const newOwned = [...ownedSkins, skinId];
    setOwnedSkins(newOwned);
    saveJSON("ms-owned-skins", newOwned);
    setActiveSkin(skinId);
    saveJSON("ms-active-skin", skinId);
    addToast(`${skin.preview} Unlocked ${skin.name}!`, "#22c55e");
  }, [ownedSkins, addToast]);

  const buyUpgrade = useCallback((upgradeId: string) => {
    const upg = UPGRADE_DEFS.find(u => u.id === upgradeId);
    if (!upg || ownedUpgrades.includes(upgradeId)) return;
    if (pointsRef.current < upg.cost) return;
    pointsRef.current -= upg.cost;
    setPoints(pointsRef.current);
    saveJSON("ms-points", pointsRef.current);
    const newOwned = [...ownedUpgrades, upgradeId];
    setOwnedUpgrades(newOwned);
    saveJSON("ms-upgrades", newOwned);
    addToast(`${upg.icon} ${upg.name} Unlocked!`, "#a78bfa");
  }, [ownedUpgrades, addToast]);

  const equipSkin = useCallback((skinId: string) => {
    if (!ownedSkins.includes(skinId)) return;
    setActiveSkin(skinId);
    saveJSON("ms-active-skin", skinId);
  }, [ownedSkins]);

  // ── Rendering ──

  const maxBoardWidth = 360;
  const cellSize = Math.max(16, Math.min(Math.floor(maxBoardWidth / cols), 28));
  const boardW = cellSize * cols;
  const boardH = cellSize * rows;
  const skin = getSkin();

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const renderBoard = () => {
    const cells: React.ReactNode[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r]?.[c];
        if (!cell) continue;

        let bg = "rgba(100,116,139,0.15)";
        let content: React.ReactNode = null;
        let border = "1px solid rgba(100,116,139,0.1)";
        let cursor = "pointer";
        let boxShadow = "inset 1px 1px 2px rgba(255,255,255,0.05), inset -1px -1px 2px rgba(0,0,0,0.2)";

        if (cell.state === "revealed") {
          bg = "rgba(15,23,42,0.6)";
          boxShadow = "none";
          border = "1px solid rgba(51,65,85,0.3)";
          cursor = "default";
          if (cell.mine) {
            content = "💣";
            bg = "rgba(239,68,68,0.2)";
            border = "1px solid rgba(239,68,68,0.4)";
          } else if (cell.adjacentMines > 0) {
            content = (
              <span style={{
                color: NUMBER_COLORS[cell.adjacentMines] || "#e2e8f0",
                fontWeight: 700, fontSize: Math.max(10, cellSize * 0.5),
                fontFamily: RETRO_FONT,
                textShadow: RETRO_GLOW(`${NUMBER_COLORS[cell.adjacentMines] || "#e2e8f0"}30`),
              }}>
                {cell.adjacentMines}
              </span>
            );
          }
        } else if (cell.state === "flagged") {
          content = "🚩";
          bg = `${skin.headColor}15`;
          border = `1px solid ${skin.headColor}40`;
        }

        const row = r, col = c;
        cells.push(
          <div
            key={`${r}-${c}`}
            onClick={() => {
              if (cell.state === "revealed") return;
              if (isTouchDevice) {
                handleCellTouchClick(row, col);
              } else {
                handleCellClick(row, col);
              }
            }}
            onContextMenu={(e) => handleCellRightClick(e, row, col)}
            onTouchStart={isTouchDevice && !flagMode ? () => handleCellTouchStart(row, col) : undefined}
            onTouchEnd={isTouchDevice && !flagMode ? handleCellTouchEnd : undefined}
            style={{
              width: cellSize, height: cellSize,
              position: "absolute", left: c * cellSize, top: r * cellSize,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: bg, border, cursor, boxShadow,
              fontSize: Math.max(10, cellSize * 0.45),
              userSelect: "none",
              transition: "background 0.1s",
            }}
          >
            {content}
          </div>
        );
      }
    }
    return cells;
  };

  const buildLeaderboard = (): LeaderboardEntry[] => {
    const playerEntry: LeaderboardEntry = { rank: 0, name: "You", score: bestTime || 999, isPlayer: true };
    if (bestTime === 0) {
      return DUMMY_LEADERBOARD.map((e, i) => ({ ...e, rank: i + 1 }));
    }
    const merged = [...DUMMY_LEADERBOARD, playerEntry]
      .sort((a, b) => a.score - b.score)
      .slice(0, 10)
      .map((e, i) => ({ ...e, rank: i + 1 }));
    return merged;
  };

  const renderLeaderboardTab = () => {
    const lb = buildLeaderboard();
    return (
      <div style={{ width: "100%", maxWidth: boardW }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", marginBottom: 8, letterSpacing: 2, textShadow: RETRO_GLOW("#fbbf2450"), textTransform: "uppercase" }}>
          Best Times
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
                  {formatTime(entry.score)}
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
      {/* Back button */}
      {onBack && <div style={{ width: "100%", maxWidth: boardW }}><BackButton onClick={onBack} /></div>}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", maxWidth: boardW }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: skin.headColor, textShadow: RETRO_GLOW(skin.headColor), letterSpacing: 3, textTransform: "uppercase" }}>
            Minefield
          </div>
          <div style={{ position: "relative", marginTop: 6 }}>
            <button
              onClick={() => setShowDiffPicker(p => !p)}
              style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                fontSize: 12, color: "#a78bfa", letterSpacing: 1,
                fontFamily: RETRO_FONT, textShadow: RETRO_GLOW("#a78bfa40"),
                textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4,
              }}
            >
              {difficulty} <span style={{ fontSize: 8 }}>{showDiffPicker ? "▲" : "▼"}</span>
            </button>
            {showDiffPicker && (
              <div style={{
                position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 30,
                background: "#1e293b", border: `${PIXEL_BORDER} #4338ca`, borderRadius: 2,
                boxShadow: "0 4px 16px rgba(0,0,0,0.6)", minWidth: 110,
              }}>
                {DIFFICULTIES.map(d => {
                  const isActive = difficulty === d;
                  const colors: Record<string, string> = { easy: "#22c55e", medium: "#fbbf24", hard: "#ef4444" };
                  return (
                    <button key={d} onClick={() => {
                      setDifficulty(d);
                      difficultyRef.current = d;
                      setShowDiffPicker(false);
                    }} style={{
                      display: "block", width: "100%", padding: "8px 10px", border: "none", cursor: "pointer",
                      background: isActive ? "rgba(67,56,202,0.2)" : "transparent",
                      color: isActive ? colors[d] : "#94a3b8",
                      fontFamily: RETRO_FONT, fontSize: 11, letterSpacing: 1,
                      textTransform: "uppercase", textAlign: "left",
                      borderBottom: d !== "hard" ? "1px solid #0f172a" : "none",
                      textShadow: isActive ? RETRO_GLOW(`${colors[d]}60`) : "none",
                    }}>
                      {d}
                    </button>
                  );
                })}
              </div>
            )}
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

      {/* Stats row */}
      <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: boardW, justifyContent: "center" }}>
        <StatBadge label="BEST" value={bestTime > 0 ? formatTime(bestTime) : "--"} color="#fbbf24" />
        <StatBadge label="💣" value={mines - flagCount} color="#ef4444" />
        <StatBadge label="🚩" value={flagCount} color="#3b82f6" />
      </div>

      {/* Game board */}
      <div
        style={{
          position: "relative", width: boardW, height: boardH,
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          borderRadius: 2, border: `${PIXEL_BORDER} #4338ca`, overflow: "hidden",
          boxShadow: screenFlash
            ? `0 0 30px ${skin.headColor}60, 0 0 60px ${skin.headColor}20, 0 4px 24px rgba(0,0,0,0.5)`
            : "0 0 15px rgba(67,56,202,0.3), 0 4px 24px rgba(0,0,0,0.5)",
          transform: shakeBoard ? `translate(${Math.random() * 4 - 2}px, ${Math.random() * 4 - 2}px)` : "none",
          transition: "box-shadow 0.15s, transform 0.05s",
        }}
      >
        {/* Grid lines */}
        <svg width={boardW} height={boardH} style={{ position: "absolute", top: 0, left: 0, opacity: 0.06 }}>
          {Array.from({ length: cols + 1 }, (_, i) => (
            <React.Fragment key={`v${i}`}>
              <line x1={i * cellSize} y1={0} x2={i * cellSize} y2={boardH} stroke="#94a3b8" strokeWidth={0.5} />
            </React.Fragment>
          ))}
          {Array.from({ length: rows + 1 }, (_, i) => (
            <React.Fragment key={`h${i}`}>
              <line x1={0} y1={i * cellSize} x2={boardW} y2={i * cellSize} stroke="#94a3b8" strokeWidth={0.5} />
            </React.Fragment>
          ))}
        </svg>

        {(gameState === "playing" || gameState === "paused" || gameState === "won" || gameState === "lost") && renderBoard()}

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
            <div style={{ fontSize: 28 }}>💣</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#3b82f6", textShadow: RETRO_GLOW("#3b82f6"), letterSpacing: 2, textTransform: "uppercase" }}>
              Minefield
            </div>
            <div style={{ fontSize: 9, color: "#94a3b8", maxWidth: 280, textAlign: "left", lineHeight: 1.9, letterSpacing: 0.3, padding: "0 8px" }}>
              <div style={{ color: "#fbbf24", fontSize: 10, textAlign: "center", marginBottom: 2, letterSpacing: 1, textShadow: RETRO_GLOW("#fbbf2440") }}>HOW TO PLAY</div>
              <div>• Reveal cells to find numbers</div>
              <div>• Numbers show adjacent mines</div>
              <div>• Flag cells you think are mines</div>
              <div>• Reveal all safe cells to win</div>
              <div style={{ marginTop: 2, color: "#a78bfa", textShadow: RETRO_GLOW("#a78bfa30") }}>
                {isTouchDevice ? "👆 Tap = reveal · Long-press = flag" : "🖱️ Left-click = reveal · Right-click = flag"}
              </div>
            </div>
            <button onClick={startGame} style={{ ...btnStyle, padding: "10px 24px", fontSize: 12, marginTop: 2 }}>
              {isTouchDevice ? ">> Tap to Start <<" : ">> Click to Start <<"}
            </button>
          </Overlay>
        )}

        {gameState === "paused" && (
          <Overlay>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fbbf24", textShadow: RETRO_GLOW("#fbbf24"), letterSpacing: 2, textTransform: "uppercase" }}>
              {isFocused ? "Paused" : "Game Paused"}
            </div>
            {!isFocused && (
              <div style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", maxWidth: 280, lineHeight: 2, letterSpacing: 0.5 }}>
                {isTouchDevice ? "Tap here to resume" : "Click here to resume"}
              </div>
            )}
            <button onClick={resume} style={btnStyle}>
              {isFocused ? "Resume" : (isTouchDevice ? "Tap to Resume" : "Click to Resume")}
            </button>
          </Overlay>
        )}

        {gameState === "won" && (
          <Overlay>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#22c55e", textShadow: RETRO_GLOW("#22c55e"), letterSpacing: 3, textTransform: "uppercase" }}>
              You Win!
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#f8fafc", textShadow: RETRO_GLOW("#38bdf8"), marginTop: 4 }}>{formatTime(timer)}</div>
            <div style={{ fontSize: 13, color: "#fbbf24", textShadow: RETRO_GLOW("#fbbf2440"), letterSpacing: 0.5, lineHeight: 2 }}>
              {bestTime === timer ? "** New Best Time! **" : `Best: ${formatTime(bestTime)}`}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, marginTop: 4, fontFamily: RETRO_FONT }}>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 0.3, lineHeight: 2 }}>
                Time: {formatTime(lastWinTimeStatsRef.current.time)}
                {lastWinTimeStatsRef.current.prevBest === 0 || lastWinTimeStatsRef.current.time <= lastWinTimeStatsRef.current.prevBest ? (
                  <span style={{ color: "#22c55e" }}> (NEW BEST!)</span>
                ) : lastWinTimeStatsRef.current.prevBest > 0 ? (
                  <span style={{ color: "#64748b" }}> ({Math.round((lastWinTimeStatsRef.current.prevBest / lastWinTimeStatsRef.current.time) * 100)}% of best time)</span>
                ) : null}
              </div>
            </div>
            <button onClick={startGame} style={btnStyle}>Play Again</button>
          </Overlay>
        )}

        {gameState === "lost" && (
          <Overlay>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#ef4444", textShadow: RETRO_GLOW("#ef4444"), letterSpacing: 3, textTransform: "uppercase" }}>
              Game Over
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#f8fafc", textShadow: RETRO_GLOW("#ef444440"), marginTop: 4 }}>💥</div>
            <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 0.5, lineHeight: 2 }}>
              Time: {formatTime(timer)}
            </div>
            <button onClick={startGame} style={btnStyle}>Play Again</button>
          </Overlay>
        )}
      </div>

      {/* Mobile flag mode toggle */}
      {isTouchDevice && (gameState === "playing") && (
        <button
          onClick={() => setFlagMode(f => !f)}
          style={{
            background: flagMode ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)",
            border: `${PIXEL_BORDER} ${flagMode ? "#ef4444" : "#334155"}`,
            borderRadius: 2, color: flagMode ? "#ef4444" : "#64748b",
            fontSize: 13, padding: "8px 16px", cursor: "pointer",
            fontFamily: RETRO_FONT, letterSpacing: 1, textTransform: "uppercase",
            boxShadow: flagMode ? "0 0 10px rgba(239,68,68,0.3)" : "none",
          }}
        >
          {flagMode ? "🚩 Flag Mode ON" : "👆 Reveal Mode"}
        </button>
      )}

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
              if (!isActive && gameStateRef.current === "playing") {
                if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
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
              <span style={{ fontSize: 10, display: "block", marginTop: 8 }}>{tab === "leaderboard" ? "TIMES" : tab === "badges" ? "BADGES" : "SHOP"}</span>
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

export default Minesweeper;
