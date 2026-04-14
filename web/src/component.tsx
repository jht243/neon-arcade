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

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Position = { x: number; y: number };
type GameState = "idle" | "countdown" | "playing" | "paused" | "gameover";

interface SnakeGameProps {
  initialData?: Record<string, unknown>;
  onBack?: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DIFFICULTY_SPEEDS: Record<string, number> = { easy: 200, medium: 130, hard: 70 };
const GRID_SIZE = 20;
const COMBO_WINDOW_MS = 2500;

const SKINS: SkinDef[] = [
  { id: "classic", name: "Classic", cost: 0, headColor: "#22c55e", bodyColor: "rgba(74,222,128,", glowColor: "rgba(34,197,94,0.6)", preview: "🟢" },
  { id: "ocean", name: "Ocean Wave", cost: 50, headColor: "#3b82f6", bodyColor: "rgba(96,165,250,", glowColor: "rgba(59,130,246,0.6)", preview: "🔵" },
  { id: "fire", name: "Fire Trail", cost: 100, headColor: "#f97316", bodyColor: "rgba(251,146,60,", glowColor: "rgba(249,115,22,0.7)", trail: "fire", preview: "🔥" },
  { id: "neon", name: "Neon Pulse", cost: 75, headColor: "#d946ef", bodyColor: "rgba(232,121,249,", glowColor: "rgba(217,70,239,0.6)", trail: "neon", preview: "💜" },
  { id: "rainbow", name: "Rainbow", cost: 150, headColor: "#ef4444", bodyColor: "rainbow", glowColor: "rgba(239,68,68,0.5)", trail: "rainbow", preview: "🌈" },
  { id: "gold", name: "Golden King", cost: 200, headColor: "#eab308", bodyColor: "rgba(250,204,21,", glowColor: "rgba(234,179,8,0.7)", trail: "sparkle", preview: "👑" },
];

const BADGE_DEFS: Omit<Badge, "earned">[] = [
  { id: "first_bite", name: "First Bite", description: "Eat your first food", icon: "🍎" },
  { id: "food_10", name: "Hungry", description: "Eat 10 food total", icon: "🍕" },
  { id: "food_25", name: "Starving", description: "Eat 25 food total", icon: "🍔" },
  { id: "food_50", name: "Insatiable", description: "Eat 50 food total", icon: "🌮" },
  { id: "food_100", name: "Food Machine", description: "Eat 100 food total", icon: "🏭" },
  { id: "score_50", name: "Half Century", description: "Score 50 in one game", icon: "⭐" },
  { id: "score_100", name: "Century", description: "Score 100 in one game", icon: "💫" },
  { id: "score_200", name: "Double Century", description: "Score 200 in one game", icon: "🌟" },
  { id: "combo_3", name: "Combo!", description: "Eat 3 food quickly", icon: "⚡" },
  { id: "combo_5", name: "On Fire!", description: "Eat 5 food in a row quickly", icon: "🔥" },
  { id: "games_5", name: "Regular", description: "Play 5 games", icon: "🎮" },
  { id: "games_10", name: "Dedicated", description: "Play 10 games", icon: "🏆" },
  { id: "games_25", name: "Addict", description: "Play 25 games", icon: "💎" },
  { id: "daredevil", name: "Daredevil", description: "Eat food next to a wall", icon: "😎" },
  { id: "long_15", name: "Long Boi", description: "Reach length 15", icon: "🐍" },
  { id: "long_25", name: "Mega Snek", description: "Reach length 25", icon: "🐉" },
];

const UPGRADE_DEFS: UpgradeDef[] = [
  { id: "headstart", name: "Head Start", description: "Begin at length 5 instead of 3", cost: 100, icon: "🐍" },
  { id: "slowstart", name: "Slow Start", description: "First 30s at 80% speed", cost: 150, icon: "🐢" },
  { id: "comboplus", name: "Combo Window+", description: "Extend combo window to 3.5s", cost: 200, icon: "⚡" },
];

const DUMMY_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: "SnakeKing99", score: 420 },
  { rank: 2, name: "VelocityViper", score: 380 },
  { rank: 3, name: "PixelPython", score: 340 },
  { rank: 4, name: "CobraCommander", score: 310 },
  { rank: 5, name: "SlitherIO_Pro", score: 280 },
  { rank: 6, name: "NeonNaga", score: 250 },
  { rank: 7, name: "RetroRattler", score: 220 },
  { rank: 8, name: "ArcadeAsp", score: 190 },
  { rank: 9, name: "TurboTail", score: 160 },
  { rank: 10, name: "CasualCobra", score: 130 },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function randomPosition(gridSize: number, exclude: Position[]): Position {
  let pos: Position;
  do {
    pos = { x: Math.floor(Math.random() * gridSize), y: Math.floor(Math.random() * gridSize) };
  } while (exclude.some((p) => p.x === pos.x && p.y === pos.y));
  return pos;
}

function rainbowColor(index: number): string {
  const hue = (index * 25) % 360;
  return `hsl(${hue}, 90%, 60%)`;
}

// ─── Component ──────────────────────────────────────────────────────────────

const SnakeGame: React.FC<SnakeGameProps> = ({ onBack }) => {
  const gridSize = GRID_SIZE;
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [showDiffPicker, setShowDiffPicker] = useState(false);
  const difficultyRef = useRef("medium");
  const baseSpeed = DIFFICULTY_SPEEDS[difficulty] || 130;

  // ── Game state ──
  const [gameState, setGameState] = useState<GameState>("idle");
  const [snake, setSnake] = useState<Position[]>([]);
  const [food, setFood] = useState<Position>({ x: 0, y: 0 });
  const [direction, setDirection] = useState<Direction>("RIGHT");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [bestSnakeLength, setBestSnakeLength] = useState(0);
  const [bestComboMax, setBestComboMax] = useState(0);
  const [level, setLevel] = useState(1);
  const [isFocused, setIsFocused] = useState(false);

  // ── Feature state ──
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const [points, setPoints] = useState(0);
  const [totalFoodEaten, setTotalFoodEaten] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [comboCount, setComboCount] = useState(0);
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

  // ── Refs ──
  const directionRef = useRef<Direction>("RIGHT");
  const snakeRef = useRef<Position[]>([]);
  const foodRef = useRef<Position>({ x: 0, y: 0 });
  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameStateRef = useRef<GameState>("idle");
  const pendingDirectionRef = useRef<Direction | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastEatTimeRef = useRef(0);
  const comboRef = useRef(0);
  const runMaxComboRef = useRef(0);
  const toastIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const totalFoodRef = useRef(0);
  const pointsRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const pausedDuringCountdownRef = useRef(false);
  const pointAccumulatorRef = useRef(0);
  const sessionFoodPointsRef = useRef(0);
  const gameStartTimeRef = useRef(0);

  // ── Load persisted data + detect device ──
  useEffect(() => {
    setIsTouchDevice(detectTouchDevice());

    const onGlobals = () => setIsTouchDevice(detectTouchDevice());
    window.addEventListener("openai:set_globals", onGlobals, { passive: true });

    setHighScore(loadJSON("snake-high-score", 0));
    setBestSnakeLength(loadJSON("snake-best-length", 0));
    setBestComboMax(loadJSON("snake-best-combo", 0));
    setPoints(loadJSON("snake-points", 0));
    pointsRef.current = loadJSON("snake-points", 0);
    setTotalFoodEaten(loadJSON("snake-total-food", 0));
    totalFoodRef.current = loadJSON("snake-total-food", 0);
    setGamesPlayed(loadJSON("snake-games-played", 0));
    setActiveSkin(loadJSON("snake-active-skin", "classic"));
    setOwnedSkins(loadJSON("snake-owned-skins", ["classic"]));

    const earnedIds: string[] = loadJSON("snake-badges", []);
    setBadges(BADGE_DEFS.map((b) => ({ ...b, earned: earnedIds.includes(b.id) })));
    setShopNotified(loadJSON("snake-shop-notified", false));
    setOwnedUpgrades(loadJSON("snake-upgrades", []));

    return () => window.removeEventListener("openai:set_globals", onGlobals);
  }, []);

  // ── Close difficulty picker on outside click ──
  useEffect(() => {
    if (!showDiffPicker) return;
    const close = () => setShowDiffPicker(false);
    const timer = setTimeout(() => document.addEventListener("click", close), 0);
    return () => { clearTimeout(timer); document.removeEventListener("click", close); };
  }, [showDiffPicker]);

  // ── Focus tracking ──
  useEffect(() => {
    const onFocus = () => setIsFocused(true);
    const onBlur = () => {
      setIsFocused(false);
      if (gameStateRef.current === "playing") {
        if (gameLoopRef.current) clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
        setGameState("paused");
        gameStateRef.current = "paused";
      } else if (gameStateRef.current === "countdown") {
        pausedDuringCountdownRef.current = true;
        setGameState("paused");
        gameStateRef.current = "paused";
      }
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    if (document.hasFocus()) setIsFocused(true);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // ── Toast cleanup ──
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => now - t.createdAt < TOAST_DURATION_MS));
    }, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toasts]);

  // ── Particle animation ──
  useEffect(() => {
    if (particles.length === 0) return;
    const frame = requestAnimationFrame(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.3, life: p.life - 1 }))
          .filter((p) => p.life > 0)
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
    const newParticles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.5;
      const speed = 1.5 + Math.random() * 2;
      newParticles.push({
        id: ++particleIdRef.current,
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 15 + Math.floor(Math.random() * 10),
        color,
        size: 3 + Math.random() * 3,
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);
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
    setBadges((prev) => {
      const badge = prev.find((b) => b.id === badgeId);
      if (!badge || badge.earned) return prev;

      const updated = prev.map((b) => (b.id === badgeId ? { ...b, earned: true } : b));
      const earnedIds = updated.filter((b) => b.earned).map((b) => b.id);
      saveJSON("snake-badges", earnedIds);

      const def = BADGE_DEFS.find((d) => d.id === badgeId);
      if (def) {
        addToast(`${def.icon} Badge: ${def.name}!`, "#a78bfa");
        setBadgeGlow(true);
      }

      return updated;
    });
  }, [addToast]);

  const checkBadges = useCallback(
    (ctx: { score: number; snakeLen: number; combo: number; totalFood: number; games: number; nearWall: boolean }) => {
      if (ctx.totalFood >= 1) earnBadge("first_bite");
      if (ctx.totalFood >= 10) earnBadge("food_10");
      if (ctx.totalFood >= 25) earnBadge("food_25");
      if (ctx.totalFood >= 50) earnBadge("food_50");
      if (ctx.totalFood >= 100) earnBadge("food_100");
      if (ctx.score >= 50) earnBadge("score_50");
      if (ctx.score >= 100) earnBadge("score_100");
      if (ctx.score >= 200) earnBadge("score_200");
      if (ctx.combo >= 3) earnBadge("combo_3");
      if (ctx.combo >= 5) earnBadge("combo_5");
      if (ctx.games >= 5) earnBadge("games_5");
      if (ctx.games >= 10) earnBadge("games_10");
      if (ctx.games >= 25) earnBadge("games_25");
      if (ctx.nearWall) earnBadge("daredevil");
      if (ctx.snakeLen >= 15) earnBadge("long_15");
      if (ctx.snakeLen >= 25) earnBadge("long_25");
    },
    [earnBadge]
  );

  const getSkin = useCallback((): SkinDef => {
    return SKINS.find((s) => s.id === activeSkin) || SKINS[0];
  }, [activeSkin]);

  // ── Game logic ──

  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (gameState !== "countdown" || countdown <= 0) return;
    const timer = setTimeout(() => {
      if (countdown === 1) {
        setCountdown(0);
        setGameState("playing");
        gameStateRef.current = "playing";
      } else {
        setCountdown(countdown - 1);
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [gameState, countdown]);

  const startGame = useCallback(() => {
    const center = Math.floor(gridSize / 2);
    const snakeLen = ownedUpgrades.includes("headstart") ? 5 : 3;
    const initialSnake: Position[] = [];
    for (let i = 0; i < snakeLen; i++) {
      initialSnake.push({ x: center - i, y: center });
    }
    const initialFood = randomPosition(gridSize, initialSnake);

    setSnake(initialSnake);
    snakeRef.current = initialSnake;
    setFood(initialFood);
    foodRef.current = initialFood;
    setDirection("RIGHT");
    directionRef.current = "RIGHT";
    pendingDirectionRef.current = null;
    setScore(0);
    scoreRef.current = 0;
    setLevel(1);
    levelRef.current = 1;
    setComboCount(0);
    comboRef.current = 0;
    runMaxComboRef.current = 0;
    lastEatTimeRef.current = 0;
    pointAccumulatorRef.current = 0;
    sessionFoodPointsRef.current = 0;
    setToasts([]);
    setParticles([]);
    setActiveTab(null);
    setShowDiffPicker(false);
    gameStartTimeRef.current = Date.now();

    const newGames = gamesPlayed + 1;
    setGamesPlayed(newGames);
    saveJSON("snake-games-played", newGames);

    containerRef.current?.focus();

    setCountdown(3);
    setGameState("countdown");
    gameStateRef.current = "countdown";
  }, [gridSize, gamesPlayed, ownedUpgrades]);

  const endGame = useCallback(
    (finalScore: number) => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      setGameState("gameover");
      gameStateRef.current = "gameover";
      shakeScreen();

      if (finalScore > highScore) {
        setHighScore(finalScore);
        saveJSON("snake-high-score", finalScore);
        if (finalScore > 0) addToast("🏆 New High Score!", "#eab308");
        setRankGlow(true);
      } else if (finalScore > 0 && highScore === 0) {
        setRankGlow(true);
      }

      const endLen = snakeRef.current.length;
      const endCombo = runMaxComboRef.current;
      if (endLen > loadJSON("snake-best-length", 0)) {
        saveJSON("snake-best-length", endLen);
        setBestSnakeLength(endLen);
      }
      if (endCombo > loadJSON("snake-best-combo", 0)) {
        saveJSON("snake-best-combo", endCombo);
        setBestComboMax(endCombo);
      }

      checkBadges({
        score: finalScore,
        snakeLen: snakeRef.current.length,
        combo: comboRef.current,
        totalFood: totalFoodRef.current,
        games: gamesPlayed + 1,
        nearWall: false,
      });

      const streak = recordStreak();
      const baseEarned = sessionFoodPointsRef.current;
      sessionFoodPointsRef.current = 0;
      if (baseEarned > 0) {
        const earned = Math.round(baseEarned * streak.multiplier);
        const bonus = earned - baseEarned;
        if (bonus > 0) {
          const newPoints = pointsRef.current + bonus;
          pointsRef.current = newPoints;
          setPoints(newPoints);
          saveJSON("snake-points", newPoints);
        }
        if (streak.multiplier > 1) {
          addToast(`🔥 ${streak.multiplier}x streak bonus!`, "#fbbf24");
        }
      }

    },
    [highScore, difficulty, gamesPlayed, addToast, shakeScreen, checkBadges]
  );

  const tick = useCallback(() => {
    if (gameStateRef.current !== "playing") return;

    const currentSnake = snakeRef.current;
    let currentDirection = directionRef.current;

    if (pendingDirectionRef.current) {
      currentDirection = pendingDirectionRef.current;
      directionRef.current = currentDirection;
      pendingDirectionRef.current = null;
    }

    const head = currentSnake[0];
    let newHead: Position;

    switch (currentDirection) {
      case "UP": newHead = { x: head.x, y: head.y - 1 }; break;
      case "DOWN": newHead = { x: head.x, y: head.y + 1 }; break;
      case "LEFT": newHead = { x: head.x - 1, y: head.y }; break;
      case "RIGHT": newHead = { x: head.x + 1, y: head.y }; break;
    }

    if (newHead.x < 0 || newHead.x >= gridSize || newHead.y < 0 || newHead.y >= gridSize) {
      endGame(scoreRef.current);
      return;
    }

    if (currentSnake.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
      endGame(scoreRef.current);
      return;
    }

    const ate = newHead.x === foodRef.current.x && newHead.y === foodRef.current.y;
    const newSnake = [newHead, ...currentSnake];
    if (!ate) newSnake.pop();

    snakeRef.current = newSnake;
    setSnake([...newSnake]);
    setDirection(currentDirection);

    if (ate) {
      const newScore = scoreRef.current + 10;
      scoreRef.current = newScore;
      setScore(newScore);

      // Points (scaled by difficulty)
      const multiplier = DIFFICULTY_POINT_MULTIPLIER[difficultyRef.current] || 1;
      pointAccumulatorRef.current += multiplier;
      const earned = Math.floor(pointAccumulatorRef.current);
      if (earned > 0) {
        pointAccumulatorRef.current -= earned;
        sessionFoodPointsRef.current += earned;
        const newPoints = pointsRef.current + earned;
        pointsRef.current = newPoints;
        setPoints(newPoints);
        saveJSON("snake-points", newPoints);
      }

      // First-time shop unlock glow
      if (!shopNotified) {
        const cheapest = SKINS
          .filter((s) => s.cost > 0 && !ownedSkins.includes(s.id))
          .sort((a, b) => a.cost - b.cost)[0];
        if (cheapest && pointsRef.current >= cheapest.cost) {
          setShopGlow(true);
          setShopNotified(true);
          saveJSON("snake-shop-notified", true);
          addToast(`🛒 You can buy a skin!`, "#22c55e");
        }
      }

      // Total food
      const newTotalFood = totalFoodRef.current + 1;
      totalFoodRef.current = newTotalFood;
      setTotalFoodEaten(newTotalFood);
      saveJSON("snake-total-food", newTotalFood);

      const now = Date.now();
      const comboWindow = ownedUpgrades.includes("comboplus") ? 3500 : COMBO_WINDOW_MS;
      let newCombo: number;
      if (now - lastEatTimeRef.current < comboWindow) {
        newCombo = comboRef.current + 1;
      } else {
        newCombo = 1;
      }
      comboRef.current = newCombo;
      runMaxComboRef.current = Math.max(runMaxComboRef.current, newCombo);
      lastEatTimeRef.current = now;
      setComboCount(newCombo);

      // Near-wall check
      const nearWall =
        foodRef.current.x === 0 ||
        foodRef.current.x === gridSize - 1 ||
        foodRef.current.y === 0 ||
        foodRef.current.y === gridSize - 1;

      // Visual feedback
      flashScreen();
      const skin = SKINS.find((s) => s.id === activeSkin) || SKINS[0];
      const cellSz = Math.floor(320 / gridSize);
      spawnParticles(
        foodRef.current.x * cellSz + cellSz / 2,
        foodRef.current.y * cellSz + cellSz / 2,
        skin.headColor
      );

      if (nearWall) {
        addToast("😬 That Was Close!", "#f97316");
      }
      if (newCombo === 3) {
        addToast("⚡ Combo x3!", "#3b82f6");
      } else if (newCombo === 5) {
        addToast("🔥 On Fire! x5!", "#ef4444");
        shakeScreen();
      } else if (newCombo === 7) {
        addToast("💥 UNSTOPPABLE x7!", "#d946ef");
        shakeScreen();
      } else if (newCombo >= 10 && newCombo % 5 === 0) {
        addToast(`🌟 LEGENDARY x${newCombo}!`, "#eab308");
        shakeScreen();
      }

      // Milestone toasts
      if (newScore === 50) addToast("⭐ 50 Points!", "#fbbf24");
      else if (newScore === 100) addToast("💫 100 Points!", "#fbbf24");
      else if (newScore === 200) addToast("🌟 200 Points!", "#fbbf24");

      // Badge checks
      checkBadges({
        score: newScore,
        snakeLen: newSnake.length,
        combo: newCombo,
        totalFood: newTotalFood,
        games: gamesPlayed,
        nearWall,
      });

      // Level up
      const newLevel = Math.floor(newScore / 50) + 1;
      if (newLevel !== levelRef.current) {
        levelRef.current = newLevel;
        setLevel(newLevel);
        addToast(`🆙 Level ${newLevel}!`, "#22c55e");
        restartInterval(newLevel);
      }

      const newFood = randomPosition(gridSize, newSnake);
      foodRef.current = newFood;
      setFood(newFood);
    }
  }, [gridSize, endGame, activeSkin, spawnParticles, flashScreen, shakeScreen, addToast, checkBadges, gamesPlayed]);

  const getSpeed = useCallback(
    (lvl: number) => {
      let spd = Math.max(40, baseSpeed - (lvl - 1) * 10);
      if (ownedUpgrades.includes("slowstart") && Date.now() - gameStartTimeRef.current < 30000) {
        spd = Math.round(spd / 0.8);
      }
      return spd;
    },
    [baseSpeed, ownedUpgrades]
  );

  const restartInterval = useCallback(
    (lvl: number) => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      gameLoopRef.current = setInterval(tick, getSpeed(lvl));
    },
    [tick, getSpeed]
  );

  useEffect(() => {
    if (gameState === "playing") {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      gameLoopRef.current = setInterval(tick, getSpeed(levelRef.current));
    }
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameState, tick, getSpeed]);

  const changeDirection = useCallback((newDir: Direction) => {
    const opposites: Record<Direction, Direction> = { UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT" };
    if (newDir !== opposites[directionRef.current]) {
      pendingDirectionRef.current = newDir;
    }
  }, []);

  const togglePause = useCallback(() => {
    if (gameStateRef.current === "playing") {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
      pausedDuringCountdownRef.current = false;
      setGameState("paused");
      gameStateRef.current = "paused";
    } else if (gameStateRef.current === "paused") {
      if (pausedDuringCountdownRef.current) {
        pausedDuringCountdownRef.current = false;
        setGameState("countdown");
        gameStateRef.current = "countdown";
      } else {
        setGameState("playing");
        gameStateRef.current = "playing";
      }
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent | KeyboardEvent) => {
      if (gameStateRef.current !== "playing" && gameStateRef.current !== "paused") return;
      let handled = true;
      switch (e.key) {
        case "ArrowUp": case "w": case "W": changeDirection("UP"); break;
        case "ArrowDown": case "s": case "S": changeDirection("DOWN"); break;
        case "ArrowLeft": case "a": case "A": changeDirection("LEFT"); break;
        case "ArrowRight": case "d": case "D": changeDirection("RIGHT"); break;
        case " ": togglePause(); break;
        default: handled = false;
      }
      if (handled) e.preventDefault();
    },
    [changeDirection, togglePause]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKeyDown(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleKeyDown]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (gameStateRef.current !== "playing") return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (gameStateRef.current !== "playing" || !touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    const MIN_SWIPE = 20;
    if (Math.abs(dx) < MIN_SWIPE && Math.abs(dy) < MIN_SWIPE) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      changeDirection(dx > 0 ? "RIGHT" : "LEFT");
    } else {
      changeDirection(dy > 0 ? "DOWN" : "UP");
    }
  }, [changeDirection]);

  const buySkin = useCallback(
    (skinId: string) => {
      const skin = SKINS.find((s) => s.id === skinId);
      if (!skin || ownedSkins.includes(skinId)) return;
      if (pointsRef.current < skin.cost) return;

      const newPoints = pointsRef.current - skin.cost;
      pointsRef.current = newPoints;
      setPoints(newPoints);
      saveJSON("snake-points", newPoints);

      const newOwned = [...ownedSkins, skinId];
      setOwnedSkins(newOwned);
      saveJSON("snake-owned-skins", newOwned);

      setActiveSkin(skinId);
      saveJSON("snake-active-skin", skinId);

      addToast(`${skin.preview} Unlocked ${skin.name}!`, "#22c55e");
    },
    [ownedSkins, addToast]
  );

  const equipSkin = useCallback(
    (skinId: string) => {
      if (!ownedSkins.includes(skinId)) return;
      setActiveSkin(skinId);
      saveJSON("snake-active-skin", skinId);
    },
    [ownedSkins]
  );

  const buyUpgrade = useCallback((upgradeId: string) => {
    const upg = UPGRADE_DEFS.find(u => u.id === upgradeId);
    if (!upg || ownedUpgrades.includes(upgradeId)) return;
    if (pointsRef.current < upg.cost) return;
    pointsRef.current -= upg.cost;
    setPoints(pointsRef.current);
    saveJSON("snake-points", pointsRef.current);
    const newOwned = [...ownedUpgrades, upgradeId];
    setOwnedUpgrades(newOwned);
    saveJSON("snake-upgrades", newOwned);
    addToast(`${upg.icon} ${upg.name} Unlocked!`, "#a78bfa");
  }, [ownedUpgrades, addToast]);

  // ── Rendering ──

  const cellSize = Math.floor(320 / gridSize);
  const boardPx = cellSize * gridSize;
  const skin = getSkin();

  const getBodyColor = (index: number): string => {
    if (skin.bodyColor === "rainbow") return rainbowColor(index);
    const fade = Math.max(0.35, 1 - index * 0.025);
    return `${skin.bodyColor}${fade})`;
  };

  const getTrailShadow = (index: number): string => {
    if (!skin.trail) return "none";
    switch (skin.trail) {
      case "fire": {
        const intensity = Math.max(0, 1 - index * 0.06);
        return `0 0 ${6 + index}px rgba(249,115,22,${intensity}), 0 0 ${3 + index}px rgba(239,68,68,${intensity * 0.5})`;
      }
      case "neon": {
        const intensity = Math.max(0, 1 - index * 0.05);
        return `0 0 ${8}px rgba(217,70,239,${intensity}), 0 0 ${4}px rgba(168,85,247,${intensity * 0.7})`;
      }
      case "rainbow": {
        return `0 0 6px ${rainbowColor(index)}40`;
      }
      case "sparkle": {
        const on = index % 3 === 0;
        return on ? `0 0 8px rgba(234,179,8,0.7)` : "none";
      }
      default: return "none";
    }
  };

  const renderBoard = () => {
    const cells: React.ReactNode[] = [];

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const isSnakeHead = snake.length > 0 && snake[0].x === x && snake[0].y === y;
        const snakeIndex = snake.findIndex((s) => s.x === x && s.y === y);
        const isSnake = snakeIndex >= 0;
        const isFood = food.x === x && food.y === y;

        let bg = "transparent";
        let borderRadius = "2px";
        let boxShadow = "none";

        if (isSnakeHead) {
          bg = skin.headColor;
          borderRadius = "4px";
          boxShadow = `0 0 6px ${skin.glowColor}`;
        } else if (isSnake) {
          bg = getBodyColor(snakeIndex);
          borderRadius = "3px";
          boxShadow = getTrailShadow(snakeIndex);
        } else if (isFood) {
          bg = "#ef4444";
          borderRadius = "50%";
          boxShadow = "0 0 8px rgba(239,68,68,0.7)";
        }

        cells.push(
          <div
            key={`${x}-${y}`}
            style={{
              width: cellSize, height: cellSize,
              position: "absolute", left: x * cellSize, top: y * cellSize,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <div style={{
              width: cellSize - 1, height: cellSize - 1,
              background: bg, borderRadius, boxShadow,
              transition: isFood ? "none" : "background 0.05s",
            }} />
          </div>
        );
      }
    }
    return cells;
  };

  const buildLeaderboard = (): LeaderboardEntry[] => {
    const playerEntry: LeaderboardEntry = { rank: 0, name: "You", score: highScore, isPlayer: true };
    const merged = [...DUMMY_LEADERBOARD, playerEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((e, i) => ({ ...e, rank: i + 1 }));
    return merged;
  };

  const DPadButton: React.FC<{ label: string; dir: Direction }> = ({ label, dir }) => (
    <button
      onPointerDown={(e) => { e.preventDefault(); changeDirection(dir); }}
      style={{
        width: 54, height: 54, borderRadius: 2, border: `${PIXEL_BORDER} #4338ca`,
        background: "rgba(67,56,202,0.15)", color: "#a78bfa",
        fontSize: 18, fontWeight: 700, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        touchAction: "manipulation", userSelect: "none",
        boxShadow: "0 0 8px rgba(67,56,202,0.2)",
        fontFamily: RETRO_FONT,
      }}
    >
      {label}
    </button>
  );

  // ── Tab content renderers ──

  const renderGameTab = () => (
    <>
      {isTouchDevice && (gameState === "playing" || gameState === "paused") && (
        <div style={{ display: "grid", gridTemplateColumns: "58px 58px 58px", gridTemplateRows: "58px 58px", gap: 4, marginTop: 4 }}>
          <div />
          <DPadButton label="▲" dir="UP" />
          <div />
          <DPadButton label="◀" dir="LEFT" />
          <DPadButton label="▼" dir="DOWN" />
          <DPadButton label="▶" dir="RIGHT" />
        </div>
      )}
      {gameState === "playing" && (
        <button onClick={togglePause} style={{
          background: "rgba(255,255,255,0.05)", border: `${PIXEL_BORDER} #334155`, borderRadius: 2,
          color: "#64748b", fontSize: 13, padding: "8px 16px", cursor: "pointer",
          fontFamily: RETRO_FONT, letterSpacing: 1, textTransform: "uppercase",
        }}>
          {isTouchDevice ? "Pause" : "Pause [Space]"}
        </button>
      )}
    </>
  );

  const renderLeaderboardTab = () => {
    const lb = buildLeaderboard();
    return (
      <div style={{ width: "100%", maxWidth: boardPx }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", marginBottom: 8, letterSpacing: 2, textShadow: RETRO_GLOW("#fbbf2450"), textTransform: "uppercase" }}>
          Global Rankings
        </div>
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 2, overflow: "hidden", border: `${PIXEL_BORDER} #1e293b` }}>
          {lb.map((entry) => {
            const rankColors = ["#fbbf24", "#94a3b8", "#cd7f32"];
            const entryColor = entry.isPlayer ? "#22c55e" : entry.rank <= 3 ? rankColors[entry.rank - 1] : "#64748b";
            return (
              <div
                key={entry.rank}
                style={{
                  display: "flex", alignItems: "center", padding: "6px 10px",
                  borderBottom: "1px solid #0f172a",
                  background: entry.isPlayer ? "rgba(34,197,94,0.08)" : "transparent",
                }}
              >
                <div style={{ width: 28, fontSize: 12, fontWeight: 700, color: entryColor, textShadow: entry.rank <= 3 ? RETRO_GLOW(`${entryColor}40`) : "none" }}>
                  {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `${entry.rank}.`}
                </div>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: entry.isPlayer ? "#22c55e" : "#cbd5e1", textShadow: entry.isPlayer ? RETRO_GLOW("#22c55e40") : "none" }}>
                  {entry.name}{entry.isPlayer ? " (YOU)" : ""}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: entryColor, textShadow: RETRO_GLOW(`${entryColor}30`) }}>
                  {entry.score}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderBadgesTab = () => (
    <div style={{ width: "100%", maxWidth: boardPx }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#f472b6", marginBottom: 6, letterSpacing: 2, textShadow: RETRO_GLOW("#f472b650"), textTransform: "uppercase" }}>
        Badges {badges.filter((b) => b.earned).length}/{badges.length}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
        {badges.map((badge) => (
          <div
            key={badge.id}
            title={`${badge.name}: ${badge.description}`}
            style={{
              background: badge.earned ? "rgba(244,114,182,0.06)" : "rgba(255,255,255,0.01)",
              borderRadius: 2, padding: "6px 3px", textAlign: "center",
              border: badge.earned ? `${PIXEL_BORDER} #f472b640` : `1px solid #1e293b`,
              opacity: badge.earned ? 1 : 0.35,
              cursor: "default",
              boxShadow: badge.earned ? "0 0 8px rgba(244,114,182,0.1)" : "none",
            }}
          >
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
    <div style={{ width: "100%", maxWidth: boardPx }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {(["skins", "upgrades"] as ShopSubTab[]).map(sub => (
            <button key={sub} onClick={() => setShopSubTab(sub)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: RETRO_FONT, letterSpacing: 1, textTransform: "uppercase", color: shopSubTab === sub ? "#22c55e" : "#475569", textShadow: shopSubTab === sub ? RETRO_GLOW("#22c55e50") : "none", borderBottom: shopSubTab === sub ? "2px solid #22c55e" : "2px solid transparent", padding: "2px 4px" }}>{sub}</button>
          ))}
        </div>
        <div style={{ fontSize: 14, color: "#fbbf24", fontWeight: 700, textShadow: RETRO_GLOW("#fbbf2440") }}>🪙 {points}</div>
      </div>
      {shopSubTab === "skins" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {SKINS.map((s) => {
            const owned = ownedSkins.includes(s.id);
            const equipped = activeSkin === s.id;
            const canAfford = pointsRef.current >= s.cost;
            return (
              <div key={s.id} style={{ background: equipped ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.02)", borderRadius: 2, padding: 8, border: equipped ? `${PIXEL_BORDER} #22c55e` : `${PIXEL_BORDER} #1e293b`, boxShadow: equipped ? "0 0 10px rgba(34,197,94,0.15)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <span style={{ fontSize: 18 }}>{s.preview}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", letterSpacing: 0.5 }}>{s.name}</div>
                    {!owned && <div style={{ fontSize: 11, color: canAfford ? "#fbbf24" : "#ef4444", fontWeight: 700, marginTop: 2, textShadow: RETRO_GLOW(canAfford ? "#fbbf2430" : "#ef444430") }}>🪙 {s.cost}</div>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 2, marginBottom: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 1, background: s.headColor, boxShadow: `0 0 4px ${s.headColor}60` }} />
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} style={{ width: 10, height: 10, borderRadius: 1, background: s.bodyColor === "rainbow" ? rainbowColor(i) : `${s.bodyColor}${Math.max(0.4, 1 - i * 0.15)})` }} />
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
      ) : (
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
      onKeyDown={isTouchDevice ? undefined : handleKeyDown}
      style={{
        width: "100%", maxWidth: 420, margin: "0 auto", padding: 20, outline: "none",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
        fontFamily: RETRO_FONT,
      }}
    >
      {/* Header */}
      {onBack && <div style={{ width: "100%", maxWidth: boardPx }}><BackButton onClick={onBack} /></div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", maxWidth: boardPx }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: skin.headColor, textShadow: RETRO_GLOW(skin.headColor), letterSpacing: 3, textTransform: "uppercase" }}>
            Snake
          </div>
          <div style={{ position: "relative", marginTop: 6 }}>
            <button
              onClick={() => setShowDiffPicker((p) => !p)}
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
                boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
                minWidth: 110,
              }}>
                {DIFFICULTIES.map((d) => {
                  const isActive = difficulty === d;
                  const colors: Record<string, string> = { easy: "#22c55e", medium: "#fbbf24", hard: "#ef4444" };
                  return (
                    <button
                      key={d}
                      onClick={() => {
                        setDifficulty(d);
                        difficultyRef.current = d;
                        setShowDiffPicker(false);
                      }}
                      style={{
                        display: "block",
                        width: "100%", padding: "8px 10px", border: "none", cursor: "pointer",
                        background: isActive ? "rgba(67,56,202,0.2)" : "transparent",
                        color: isActive ? colors[d] : "#94a3b8",
                        fontFamily: RETRO_FONT, fontSize: 11, letterSpacing: 1,
                        textTransform: "uppercase", textAlign: "left",
                        borderBottom: d !== "hard" ? "1px solid #0f172a" : "none",
                        textShadow: isActive ? RETRO_GLOW(`${colors[d]}60`) : "none",
                      }}
                    >
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
            <div style={{ fontSize: 12, color: "#38bdf8", letterSpacing: 1, textTransform: "uppercase", textShadow: RETRO_GLOW("#38bdf860") }}>SCORE</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#f8fafc", textShadow: RETRO_GLOW("#38bdf840"), marginTop: 4 }}>{score}</div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: boardPx, justifyContent: "center" }}>
        <StatBadge label="HI" value={highScore} color="#fbbf24" />
        <StatBadge label="LVL" value={level} color="#a78bfa" />
        <StatBadge label="LEN" value={snake.length} color="#38bdf8" />
        {comboCount >= 2 && gameState === "playing" && (
          <div style={{
            background: "rgba(239,68,68,0.1)", padding: "6px 14px", textAlign: "center",
            border: `${PIXEL_BORDER} #ef4444`, borderRadius: 2,
            animation: "pulse 0.6s ease-in-out infinite",
            boxShadow: `0 0 10px rgba(239,68,68,0.3), inset 0 0 6px rgba(239,68,68,0.1)`,
          }}>
            <div style={{ fontSize: 12, color: "#ef4444", textTransform: "uppercase", letterSpacing: 1, textShadow: RETRO_GLOW("#ef444460") }}>COMBO</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#ef4444", textShadow: RETRO_GLOW("#ef4444"), marginTop: 4 }}>x{comboCount}</div>
          </div>
        )}
      </div>

      {/* Game board */}
      <div
        {...(isTouchDevice ? { onTouchStart: handleTouchStart, onTouchEnd: handleTouchEnd } : {})}
        style={{
          position: "relative", width: boardPx, height: boardPx,
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          borderRadius: 2, border: `${PIXEL_BORDER} #4338ca`, overflow: "hidden",
          ...(isTouchDevice ? { touchAction: "none" as const } : {}),
          boxShadow: screenFlash
            ? `0 0 30px ${skin.headColor}60, 0 0 60px ${skin.headColor}20, 0 4px 24px rgba(0,0,0,0.5)`
            : "0 0 15px rgba(67,56,202,0.3), 0 4px 24px rgba(0,0,0,0.5)",
          transform: shakeBoard ? `translate(${Math.random() * 4 - 2}px, ${Math.random() * 4 - 2}px)` : "none",
          transition: "box-shadow 0.15s, transform 0.05s",
        }}
      >
        {/* Grid lines */}
        <svg width={boardPx} height={boardPx} style={{ position: "absolute", top: 0, left: 0, opacity: 0.06 }}>
          {Array.from({ length: gridSize + 1 }, (_, i) => (
            <React.Fragment key={i}>
              <line x1={i * cellSize} y1={0} x2={i * cellSize} y2={boardPx} stroke="#94a3b8" strokeWidth={0.5} />
              <line x1={0} y1={i * cellSize} x2={boardPx} y2={i * cellSize} stroke="#94a3b8" strokeWidth={0.5} />
            </React.Fragment>
          ))}
        </svg>

        {(gameState === "playing" || gameState === "paused" || gameState === "countdown") && renderBoard()}

        {/* Particles */}
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: "absolute", left: p.x, top: p.y,
              width: p.size, height: p.size, borderRadius: "50%",
              background: p.color, opacity: p.life / 25,
              pointerEvents: "none",
            }}
          />
        ))}

        {/* Toasts */}
        {toasts.map((t) => {
          const age = Date.now() - t.createdAt;
          const progress = Math.min(age / TOAST_DURATION_MS, 1);
          const scale = progress < 0.15 ? 0.5 + (progress / 0.15) * 0.5 : progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
          const opacity = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
          const yOffset = -20;
          return (
            <div
              key={t.id}
              style={{
                position: "absolute", left: "50%", top: "50%",
                transform: `translate(-50%, ${yOffset}px) scale(${scale})`,
                opacity, fontSize: 16, fontWeight: 700, color: t.color,
                fontFamily: RETRO_FONT,
                textShadow: `0 0 12px ${t.color}, 0 0 4px ${t.color}, 0 2px 4px rgba(0,0,0,0.9)`,
                pointerEvents: "none", whiteSpace: "nowrap", zIndex: 20,
                letterSpacing: 1, textTransform: "uppercase",
              }}
            >
              {t.text}
            </div>
          );
        })}

        {/* Overlays */}
        {gameState === "idle" && (
          <Overlay>
            <div style={{ fontSize: 28 }}>🐍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#22c55e", textShadow: RETRO_GLOW("#22c55e"), letterSpacing: 2, textTransform: "uppercase" }}>
              Snake
            </div>
            <div style={{ fontSize: 9, color: "#94a3b8", maxWidth: 280, textAlign: "left", lineHeight: 1.9, letterSpacing: 0.3, padding: "0 8px" }}>
              <div style={{ color: "#fbbf24", fontSize: 10, textAlign: "center", marginBottom: 2, letterSpacing: 1, textShadow: RETRO_GLOW("#fbbf2440") }}>HOW TO PLAY</div>
              <div>• Eat food to grow and score</div>
              <div>• Don't hit the walls or yourself</div>
              <div>• Chain combos for bonus points</div>
              <div style={{ marginTop: 2, color: "#a78bfa", textShadow: RETRO_GLOW("#a78bfa30") }}>
                {isTouchDevice ? "👆 Swipe or use D-pad to move" : "⌨️ Arrow keys / WASD · Space = pause"}
              </div>
            </div>
            <button onClick={startGame} style={{ ...btnStyle, padding: "10px 24px", fontSize: 12, marginTop: 2 }}>
              {isTouchDevice ? ">> Tap to Start <<" : ">> Click to Start <<"}
            </button>
          </Overlay>
        )}

        {gameState === "countdown" && (
          <Overlay>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", textShadow: RETRO_GLOW("#a78bfa"), letterSpacing: 2, textTransform: "uppercase" }}>
              Get Ready
            </div>
            <div style={{
              fontSize: 64, fontWeight: 700, color: "#22c55e",
              textShadow: `${RETRO_GLOW("#22c55e")}, 0 0 40px rgba(34,197,94,0.4)`,
              fontFamily: RETRO_FONT,
              animation: "pulse 0.9s ease-in-out infinite",
            }}>
              {countdown}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", letterSpacing: 1, marginTop: 8 }}>
              {isTouchDevice ? "Get your thumbs ready!" : "Hands on keyboard!"}
            </div>
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
            <button onClick={togglePause} style={btnStyle}>
              {isFocused ? "Resume" : (isTouchDevice ? "Tap to Resume" : "Click to Resume")}
            </button>
          </Overlay>
        )}

        {gameState === "gameover" && (
          <Overlay>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#ef4444", textShadow: RETRO_GLOW("#ef4444"), letterSpacing: 3, textTransform: "uppercase" }}>
              Game Over
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#f8fafc", textShadow: RETRO_GLOW("#38bdf8"), marginTop: 4 }}>{score}</div>
            <div style={{ fontSize: 13, color: "#fbbf24", textShadow: RETRO_GLOW("#fbbf2440"), letterSpacing: 0.5, lineHeight: 2 }}>
              {score >= highScore && score > 0 ? "** New High Score! **" : `High Score: ${highScore}`}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, marginTop: 4, fontFamily: RETRO_FONT }}>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 0.3, lineHeight: 2 }}>
                Score: {score}{score >= highScore ? (
                  <span style={{ color: "#22c55e" }}> (NEW BEST!)</span>
                ) : highScore > 0 ? (
                  <span style={{ color: "#64748b" }}> ({Math.round((score / highScore) * 100)}% of best)</span>
                ) : null}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 0.3, lineHeight: 2 }}>
                Length: {snake.length}{snake.length >= bestSnakeLength ? (
                  <span style={{ color: "#22c55e" }}> (NEW BEST!)</span>
                ) : bestSnakeLength > 0 ? (
                  <span style={{ color: "#64748b" }}> ({Math.round((snake.length / bestSnakeLength) * 100)}% of best)</span>
                ) : null}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 0.3, lineHeight: 2 }}>
                Max combo: {runMaxComboRef.current}{runMaxComboRef.current >= bestComboMax ? (
                  <span style={{ color: "#22c55e" }}> (NEW BEST!)</span>
                ) : bestComboMax > 0 ? (
                  <span style={{ color: "#64748b" }}> ({Math.round((runMaxComboRef.current / bestComboMax) * 100)}% of best)</span>
                ) : null}
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#a78bfa", letterSpacing: 0.5 }}>+{Math.floor(score / 10)} pts earned</div>
            <button onClick={startGame} style={btnStyle}>Play Again</button>
          </Overlay>
        )}
      </div>

      {/* D-pad and pause always visible */}
      {renderGameTab()}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, width: "100%", maxWidth: boardPx }}>
        {(["leaderboard", "badges", "shop"] as TabId[]).map((tab) => {
          const isActive = activeTab === tab;
          const tabColor = tab === "leaderboard" ? "#fbbf24" : tab === "badges" ? "#f472b6" : "#22c55e";
          const isGlowing = !isActive && (
            (tab === "shop" && shopGlow) ||
            (tab === "badges" && badgeGlow) ||
            (tab === "leaderboard" && rankGlow)
          );
          const glowColor = tabColor;
          return (
            <button
              key={tab}
              onClick={() => {
                if (!isActive && gameStateRef.current === "playing") {
                  if (gameLoopRef.current) clearInterval(gameLoopRef.current);
                  gameLoopRef.current = null;
                  setGameState("paused"); gameStateRef.current = "paused";
                } else if (!isActive && gameStateRef.current === "countdown") {
                  pausedDuringCountdownRef.current = true;
                  setGameState("paused"); gameStateRef.current = "paused";
                }
                setActiveTab(isActive ? null : tab);
                if (tab === "shop" && shopGlow) setShopGlow(false);
                if (tab === "badges" && badgeGlow) setBadgeGlow(false);
                if (tab === "leaderboard" && rankGlow) setRankGlow(false);
              }}
              style={{
                flex: 1, padding: "10px 0", border: `${PIXEL_BORDER} ${isActive ? tabColor : isGlowing ? glowColor : "#1e293b"}`,
                borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: RETRO_FONT,
                background: isActive ? `${tabColor}18` : isGlowing ? `${glowColor}18` : "transparent",
                color: isActive ? tabColor : isGlowing ? glowColor : "#475569",
                textTransform: "uppercase", letterSpacing: 1,
                textShadow: isActive ? RETRO_GLOW(`${tabColor}60`) : isGlowing ? RETRO_GLOW(glowColor) : "none",
                boxShadow: isActive ? `0 0 10px ${tabColor}30` : isGlowing ? `0 0 14px ${glowColor}60` : "none",
                animation: isGlowing ? `${tab === "shop" ? "shopPulse" : tab === "badges" ? "badgePulse" : "rankPulse"} 1.2s ease-in-out infinite` : "none",
              }}
            >
              <span style={{ fontSize: 16, display: "block", lineHeight: 1 }}>{tab === "leaderboard" ? "🏆" : tab === "badges" ? "🎖️" : "🛒"}</span>
              <span style={{ fontSize: 10, display: "block", marginTop: 8 }}>{tab === "leaderboard" ? "RANKS" : tab === "badges" ? "BADGES" : "SHOP"}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab && (
        <div style={{ width: "100%", maxWidth: boardPx, maxHeight: 260, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch" }}>
          {activeTab === "leaderboard" && renderLeaderboardTab()}
          {activeTab === "badges" && renderBadgesTab()}
          {activeTab === "shop" && renderShopTab()}
        </div>
      )}

      {/* Inject retro font + keyframe animations */}
      <style>{RETRO_CSS}</style>
    </div>
  );
};

export default SnakeGame;
