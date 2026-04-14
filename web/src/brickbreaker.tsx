import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Toast, type Particle, type Badge, type SkinDef, type LeaderboardEntry, type TabId,
  type ShopSubTab, type UpgradeDef,
  RETRO_FONT, RETRO_GLOW, PIXEL_BORDER,
  TOAST_DURATION_MS, PARTICLE_COUNT,
  btnStyle, shopBtnStyle,
  loadJSON, saveJSON, detectTouchDevice, recordStreak,
  StatBadge, Overlay, BackButton, RETRO_CSS,
} from "./shared";

type GameState = "idle" | "playing" | "paused" | "continue" | "won" | "lost" | "countdown";

interface Brick {
  r: number;
  c: number;
  hp: number;
  color: string;
  glow: string;
}

interface BrickBreakerProps {
  onBack?: () => void;
}

const BOARD_W = 320;
const BOARD_H = 400;
const PADDLE_W = 60;
const PADDLE_H = 10;
const BALL_R = 5;
const BRICK_ROWS = 6;
const BRICK_COLS = 8;
const BRICK_W = BOARD_W / BRICK_COLS;
const BRICK_H = 16;
const BRICK_TOP = 40;
const INITIAL_SPEED = 3.5;
const MAX_LIVES = 3;

const LEVEL_CONFIGS = [
  { rows: 4, speedMul: 1.0, multiHp: false, label: "Level 1" },
  { rows: 5, speedMul: 1.15, multiHp: false, label: "Level 2" },
  { rows: 5, speedMul: 1.25, multiHp: true, label: "Level 3" },
  { rows: 6, speedMul: 1.35, multiHp: true, label: "Level 4" },
  { rows: 6, speedMul: 1.5, multiHp: true, label: "Level 5" },
];

const ROW_COLORS: { color: string; glow: string }[] = [
  { color: "#ef4444", glow: "rgba(239,68,68,0.5)" },
  { color: "#f97316", glow: "rgba(249,115,22,0.5)" },
  { color: "#fbbf24", glow: "rgba(251,191,36,0.5)" },
  { color: "#22c55e", glow: "rgba(34,197,94,0.5)" },
  { color: "#3b82f6", glow: "rgba(59,130,246,0.5)" },
  { color: "#a855f7", glow: "rgba(168,85,247,0.5)" },
];

const SKINS: SkinDef[] = [
  { id: "classic", name: "Classic", cost: 0, headColor: "#a78bfa", bodyColor: "rgba(167,139,250,", glowColor: "rgba(167,139,250,0.6)", preview: "🟣" },
  { id: "ocean", name: "Deep Sea", cost: 50, headColor: "#06b6d4", bodyColor: "rgba(6,182,212,", glowColor: "rgba(6,182,212,0.6)", preview: "🌊" },
  { id: "ember", name: "Ember", cost: 75, headColor: "#f97316", bodyColor: "rgba(249,115,22,", glowColor: "rgba(249,115,22,0.6)", preview: "🔥" },
  { id: "mint", name: "Mint", cost: 100, headColor: "#22c55e", bodyColor: "rgba(34,197,94,", glowColor: "rgba(34,197,94,0.6)", preview: "🍀" },
  { id: "neon", name: "Neon Pink", cost: 150, headColor: "#ec4899", bodyColor: "rgba(236,72,153,", glowColor: "rgba(236,72,153,0.6)", preview: "💗" },
  { id: "gold", name: "Royal Gold", cost: 200, headColor: "#eab308", bodyColor: "rgba(234,179,8,", glowColor: "rgba(234,179,8,0.6)", preview: "👑" },
];

const BADGE_DEFS: Omit<Badge, "earned">[] = [
  { id: "first_break", name: "First Break", description: "Break your first brick", icon: "🧱" },
  { id: "level_2", name: "Moving Up", description: "Reach level 2", icon: "⬆️" },
  { id: "level_3", name: "Halfway", description: "Reach level 3", icon: "🔥" },
  { id: "level_5", name: "Champion", description: "Beat all 5 levels", icon: "🏆" },
  { id: "score_500", name: "Five Hundred", description: "Score 500 in one game", icon: "⭐" },
  { id: "score_2k", name: "Two K", description: "Score 2000 in one game", icon: "💫" },
  { id: "score_5k", name: "Five K", description: "Score 5000 in one game", icon: "💎" },
  { id: "combo_5", name: "Hot Streak", description: "5 bricks without hitting paddle", icon: "🔥" },
  { id: "combo_10", name: "Unstoppable", description: "10 bricks without hitting paddle", icon: "⚡" },
  { id: "combo_20", name: "Legendary", description: "20 bricks without hitting paddle", icon: "🌟" },
  { id: "no_miss", name: "Perfect", description: "Clear a level without losing a life", icon: "😎" },
  { id: "close_call", name: "Clutch", description: "Clear a level on your last life", icon: "😰" },
  { id: "games_5", name: "Regular", description: "Play 5 games", icon: "🎮" },
  { id: "games_25", name: "Dedicated", description: "Play 25 games", icon: "🏅" },
  { id: "bricks_100", name: "Demolisher", description: "Break 100 total bricks", icon: "💥" },
  { id: "bricks_500", name: "Wrecking Ball", description: "Break 500 total bricks", icon: "🔨" },
];

const UPGRADE_DEFS: UpgradeDef[] = [
  { id: "widepaddle", name: "Wide Paddle", description: "Paddle 20% wider", cost: 100, icon: "📏" },
  { id: "extralife", name: "Extra Life", description: "Start with 4 lives instead of 3", cost: 150, icon: "❤️" },
  { id: "stickypaddle", name: "Sticky Paddle", description: "Ball sticks to paddle once per level", cost: 250, icon: "🧲" },
];

const DUMMY_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: "BrickLord", score: 9800 },
  { rank: 2, name: "PaddlePro", score: 7600 },
  { rank: 3, name: "BounceKing", score: 6100 },
  { rank: 4, name: "NeonSmasher", score: 4800 },
  { rank: 5, name: "ArcadeAce", score: 3900 },
  { rank: 6, name: "RetroBreak", score: 3200 },
  { rank: 7, name: "PixelSmash", score: 2500 },
  { rank: 8, name: "GlowHitter", score: 1800 },
  { rank: 9, name: "CasualBall", score: 1100 },
  { rank: 10, name: "FirstTimer", score: 600 },
];

function buildBricks(rows: number, multiHp: boolean): Brick[] {
  const bricks: Brick[] = [];
  for (let r = 0; r < rows; r++) {
    const rc = ROW_COLORS[r % ROW_COLORS.length];
    for (let c = 0; c < BRICK_COLS; c++) {
      bricks.push({
        r, c,
        hp: multiHp && r < 2 ? 2 : 1,
        color: rc.color,
        glow: rc.glow,
      });
    }
  }
  return bricks;
}

const BrickBreaker: React.FC<BrickBreakerProps> = ({ onBack }) => {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [bestLevelReached, setBestLevelReached] = useState(0);
  const [bestComboMax, setBestComboMax] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [level, setLevel] = useState(0);
  const [combo, setCombo] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const [points, setPoints] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [totalBricks, setTotalBricks] = useState(0);
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

  const gameStateRef = useRef<GameState>("idle");
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const toastIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const pointsRef = useRef(0);
  const sessionBrickPointsRef = useRef(0);
  const usedContinueRef = useRef(false);

  const paddleXRef = useRef(BOARD_W / 2 - PADDLE_W / 2);
  const ballRef = useRef({ x: BOARD_W / 2, y: BOARD_H - 30, vx: INITIAL_SPEED * 0.7, vy: -INITIAL_SPEED * 0.7 });
  const bricksRef = useRef<Brick[]>([]);
  const livesRef = useRef(MAX_LIVES);
  const scoreRef = useRef(0);
  const levelRef = useRef(0);
  const comboRef = useRef(0);
  const runMaxComboRef = useRef(0);
  const totalBricksRef = useRef(0);
  const lostLifeThisLevel = useRef(false);
  const keysRef = useRef<Set<string>>(new Set());
  const touchXRef = useRef<number | null>(null);
  const pausedFromCountdownRef = useRef(false);
  const stickyAvailableRef = useRef(false);
  const ballStuckRef = useRef(false);
  const ownedUpgradesRef = useRef<string[]>([]);

  const [paddleX, setPaddleX] = useState(BOARD_W / 2 - PADDLE_W / 2);
  const [ballPos, setBallPos] = useState({ x: BOARD_W / 2, y: BOARD_H - 30 });
  const [bricks, setBricksState] = useState<Brick[]>([]);

  useEffect(() => {
    setIsTouchDevice(detectTouchDevice());
    const onGlobals = () => setIsTouchDevice(detectTouchDevice());
    window.addEventListener("openai:set_globals", onGlobals, { passive: true });

    setBestScore(loadJSON("bb-best-score", 0));
    setBestLevelReached(loadJSON("bb-best-level", 0));
    setBestComboMax(loadJSON("bb-best-combo", 0));
    setPoints(loadJSON("bb-points", 0));
    pointsRef.current = loadJSON("bb-points", 0);
    setGamesPlayed(loadJSON("bb-games-played", 0));
    setTotalBricks(loadJSON("bb-total-bricks", 0));
    totalBricksRef.current = loadJSON("bb-total-bricks", 0);
    setActiveSkin(loadJSON("bb-active-skin", "classic"));
    setOwnedSkins(loadJSON("bb-owned-skins", ["classic"]));
    setOwnedUpgrades(loadJSON("bb-upgrades", []));

    const earnedIds: string[] = loadJSON("bb-badges", []);
    setBadges(BADGE_DEFS.map(b => ({ ...b, earned: earnedIds.includes(b.id) })));
    setShopNotified(loadJSON("bb-shop-notified", false));

    return () => window.removeEventListener("openai:set_globals", onGlobals);
  }, []);

  useEffect(() => {
    ownedUpgradesRef.current = ownedUpgrades;
  }, [ownedUpgrades]);

  useEffect(() => {
    const onFocus = () => setIsFocused(true);
    const onBlur = () => setIsFocused(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    if (document.hasFocus()) setIsFocused(true);
    return () => { window.removeEventListener("focus", onFocus); window.removeEventListener("blur", onBlur); };
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => {
      const now = Date.now();
      setToasts(prev => prev.filter(t => now - t.createdAt < TOAST_DURATION_MS));
    }, TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [toasts]);

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
      saveJSON("bb-badges", updated.filter(b => b.earned).map(b => b.id));
      const def = BADGE_DEFS.find(d => d.id === badgeId);
      if (def) { addToast(`${def.icon} Badge: ${def.name}!`, "#a78bfa"); setBadgeGlow(true); }
      return updated;
    });
  }, [addToast]);

  const getSkin = useCallback((): SkinDef => {
    return SKINS.find(s => s.id === activeSkin) || SKINS[0];
  }, [activeSkin]);

  const effectivePaddleW = useMemo(
    () => (ownedUpgrades.includes("widepaddle") ? Math.round(PADDLE_W * 1.2) : PADDLE_W),
    [ownedUpgrades],
  );

  const launchStuckBall = useCallback(() => {
    if (!ballStuckRef.current || gameStateRef.current !== "playing") return;
    const cfg = LEVEL_CONFIGS[Math.min(levelRef.current, LEVEL_CONFIGS.length - 1)];
    const speed = INITIAL_SPEED * cfg.speedMul;
    const ball = ballRef.current;
    ball.vx = (Math.random() > 0.5 ? 1 : -1) * speed * 0.7;
    ball.vy = -speed * 0.7;
    ballStuckRef.current = false;
  }, []);

  const resetBall = useCallback(() => {
    ballStuckRef.current = false;
    const px = paddleXRef.current + effectivePaddleW / 2;
    ballRef.current = { x: px, y: BOARD_H - 30, vx: (Math.random() > 0.5 ? 1 : -1) * INITIAL_SPEED * 0.7, vy: -INITIAL_SPEED * 0.7 };
    comboRef.current = 0;
    setCombo(0);
  }, [effectivePaddleW]);

  const startLevel = useCallback((lvl: number) => {
    const cfg = LEVEL_CONFIGS[Math.min(lvl, LEVEL_CONFIGS.length - 1)];
    bricksRef.current = buildBricks(cfg.rows, cfg.multiHp);
    setBricksState([...bricksRef.current]);
    lostLifeThisLevel.current = false;
    stickyAvailableRef.current = ownedUpgradesRef.current.includes("stickypaddle");
    resetBall();
  }, [resetBall]);

  const startGame = useCallback(() => {
    const pw = ownedUpgrades.includes("widepaddle") ? Math.round(PADDLE_W * 1.2) : PADDLE_W;
    paddleXRef.current = BOARD_W / 2 - pw / 2;
    setPaddleX(paddleXRef.current);
    const startLives = ownedUpgrades.includes("extralife") ? 4 : MAX_LIVES;
    livesRef.current = startLives;
    setLives(startLives);
    scoreRef.current = 0;
    setScore(0);
    levelRef.current = 0;
    setLevel(0);
    comboRef.current = 0;
    runMaxComboRef.current = 0;
    setCombo(0);
    setToasts([]);
    setParticles([]);
    setActiveTab(null);
    usedContinueRef.current = false;
    sessionBrickPointsRef.current = 0;

    const newGames = gamesPlayed + 1;
    setGamesPlayed(newGames);
    saveJSON("bb-games-played", newGames);
    if (newGames >= 5) earnBadge("games_5");
    if (newGames >= 25) earnBadge("games_25");

    startLevel(0);
    containerRef.current?.focus({ preventScroll: true });
    setCountdown(3);
    setGameState("countdown");
    gameStateRef.current = "countdown";
  }, [gamesPlayed, startLevel, earnBadge, ownedUpgrades]);

  const endGame = useCallback((won: boolean) => {
    const streak = recordStreak();
    const baseEarned = sessionBrickPointsRef.current;
    sessionBrickPointsRef.current = 0;
    if (baseEarned > 0) {
      const earned = Math.round(baseEarned * streak.multiplier);
      const bonus = earned - baseEarned;
      if (bonus > 0) {
        pointsRef.current += bonus;
        setPoints(pointsRef.current);
        saveJSON("bb-points", pointsRef.current);
      }
      if (streak.multiplier > 1) {
        addToast(`🔥 ${streak.multiplier}x streak bonus!`, "#fbbf24");
      }
    }

    const sc = scoreRef.current;
    if (sc > bestScore) {
      setBestScore(sc);
      saveJSON("bb-best-score", sc);
      addToast("🏆 New Best Score!", "#eab308");
      setRankGlow(true);
    } else if (sc > 0 && bestScore === 0) {
      setRankGlow(true);
    }
    const reachedLevel = levelRef.current + 1;
    if (reachedLevel > loadJSON("bb-best-level", 0)) {
      saveJSON("bb-best-level", reachedLevel);
      setBestLevelReached(reachedLevel);
    }
    const endCombo = runMaxComboRef.current;
    if (endCombo > loadJSON("bb-best-combo", 0)) {
      saveJSON("bb-best-combo", endCombo);
      setBestComboMax(endCombo);
    }
    setGameState(won ? "won" : "lost");
    gameStateRef.current = won ? "won" : "lost";
    if (won) {
      flashScreen();
      earnBadge("level_5");
    } else {
      shakeScreen();
    }
  }, [bestScore, addToast, flashScreen, shakeScreen, earnBadge]);

  const handleDeclineContinue = useCallback(() => {
    endGame(false);
  }, [endGame]);

  const handleContinue = useCallback(() => {
    if (pointsRef.current < 50) return;
    usedContinueRef.current = true;
    pointsRef.current -= 50;
    setPoints(pointsRef.current);
    saveJSON("bb-points", pointsRef.current);
    livesRef.current = 1;
    setLives(1);
    resetBall();
    setGameState("playing");
    gameStateRef.current = "playing";
    containerRef.current?.focus({ preventScroll: true });
  }, [resetBall]);

  const gameLoop = useCallback(() => {
    if (gameStateRef.current !== "playing") return;

    const ball = ballRef.current;
    const cfg = LEVEL_CONFIGS[Math.min(levelRef.current, LEVEL_CONFIGS.length - 1)];
    const speed = INITIAL_SPEED * cfg.speedMul;
    const pw = effectivePaddleW;

    // Paddle movement
    const PADDLE_SPEED = 5;
    if (keysRef.current.has("ArrowLeft") || keysRef.current.has("a")) {
      paddleXRef.current = Math.max(0, paddleXRef.current - PADDLE_SPEED);
    }
    if (keysRef.current.has("ArrowRight") || keysRef.current.has("d")) {
      paddleXRef.current = Math.min(BOARD_W - pw, paddleXRef.current + PADDLE_SPEED);
    }
    setPaddleX(paddleXRef.current);

    const py = BOARD_H - 20;
    if (ballStuckRef.current) {
      ball.x = Math.max(BALL_R, Math.min(BOARD_W - BALL_R, paddleXRef.current + pw / 2));
      ball.y = py - BALL_R;
      ball.vx = 0;
      ball.vy = 0;
      setBallPos({ x: ball.x, y: ball.y });
      rafRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    // Normalize velocity to current speed
    const mag = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (mag > 0) {
      ball.vx = (ball.vx / mag) * speed;
      ball.vy = (ball.vy / mag) * speed;
    }

    ball.x += ball.vx;
    ball.y += ball.vy;

    // Wall collisions
    if (ball.x - BALL_R <= 0) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
    if (ball.x + BALL_R >= BOARD_W) { ball.x = BOARD_W - BALL_R; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - BALL_R <= 0) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }

    // Paddle collision
    if (ball.vy > 0 && ball.y + BALL_R >= py && ball.y + BALL_R <= py + PADDLE_H + 4 &&
        ball.x >= paddleXRef.current - 2 && ball.x <= paddleXRef.current + pw + 2) {
      ball.y = py - BALL_R;
      if (ownedUpgradesRef.current.includes("stickypaddle") && stickyAvailableRef.current) {
        stickyAvailableRef.current = false;
        ballStuckRef.current = true;
        ball.x = Math.max(BALL_R, Math.min(BOARD_W - BALL_R, paddleXRef.current + pw / 2));
        ball.vx = 0;
        ball.vy = 0;
      } else {
        const hitPos = (ball.x - paddleXRef.current) / pw;
        const angle = (hitPos - 0.5) * Math.PI * 0.7;
        ball.vx = Math.sin(angle) * speed;
        ball.vy = -Math.cos(angle) * speed;
        if (Math.abs(ball.vy) < speed * 0.3) {
          ball.vy = -speed * 0.3 * Math.sign(ball.vy || -1);
        }
      }
      comboRef.current = 0;
      setCombo(0);
    }

    // Brick collisions
    let hitBrick = false;
    for (let i = bricksRef.current.length - 1; i >= 0; i--) {
      const brick = bricksRef.current[i];
      const bx = brick.c * BRICK_W;
      const by = BRICK_TOP + brick.r * BRICK_H;

      if (ball.x + BALL_R > bx && ball.x - BALL_R < bx + BRICK_W &&
          ball.y + BALL_R > by && ball.y - BALL_R < by + BRICK_H) {

        brick.hp--;
        if (brick.hp <= 0) {
          bricksRef.current.splice(i, 1);
          const brickScore = (brick.r + 1) * 10;
          scoreRef.current += brickScore;
          setScore(scoreRef.current);

          const earned = Math.max(1, Math.floor(brickScore / 10));
          sessionBrickPointsRef.current += earned;
          pointsRef.current += earned;
          setPoints(pointsRef.current);
          saveJSON("bb-points", pointsRef.current);

          totalBricksRef.current++;
          setTotalBricks(totalBricksRef.current);
          saveJSON("bb-total-bricks", totalBricksRef.current);

          comboRef.current++;
          runMaxComboRef.current = Math.max(runMaxComboRef.current, comboRef.current);
          setCombo(comboRef.current);

          spawnParticles(bx + BRICK_W / 2, by + BRICK_H / 2, brick.color);

          earnBadge("first_break");
          if (totalBricksRef.current >= 100) earnBadge("bricks_100");
          if (totalBricksRef.current >= 500) earnBadge("bricks_500");
          if (comboRef.current >= 5) earnBadge("combo_5");
          if (comboRef.current >= 10) earnBadge("combo_10");
          if (comboRef.current >= 20) earnBadge("combo_20");
          if (scoreRef.current >= 500) earnBadge("score_500");
          if (scoreRef.current >= 2000) earnBadge("score_2k");
          if (scoreRef.current >= 5000) earnBadge("score_5k");

          if (comboRef.current === 5) addToast("🔥 5x Combo!", "#f97316");
          else if (comboRef.current === 10) addToast("⚡ 10x Combo!", "#d946ef");
          else if (comboRef.current === 20) addToast("🌟 20x Combo!", "#fbbf24");

          if (!shopNotified) {
            const cheapest = SKINS.filter(s => s.cost > 0 && !ownedSkins.includes(s.id)).sort((a, b) => a.cost - b.cost)[0];
            if (cheapest && pointsRef.current >= cheapest.cost) {
              setShopGlow(true);
              setShopNotified(true);
              saveJSON("bb-shop-notified", true);
              addToast("🛒 You can buy a skin!", "#22c55e");
            }
          }
        } else {
          brick.color = "#94a3b8";
          brick.glow = "rgba(148,163,184,0.4)";
        }

        // Reflect ball
        const overlapX = Math.min(ball.x + BALL_R - bx, bx + BRICK_W - (ball.x - BALL_R));
        const overlapY = Math.min(ball.y + BALL_R - by, by + BRICK_H - (ball.y - BALL_R));
        if (overlapX < overlapY) ball.vx = -ball.vx;
        else ball.vy = -ball.vy;

        hitBrick = true;
        break;
      }
    }

    if (hitBrick) {
      flashScreen();
      setBricksState([...bricksRef.current]);

      if (bricksRef.current.length === 0) {
        if (!lostLifeThisLevel.current) earnBadge("no_miss");
        if (livesRef.current === 1 && !lostLifeThisLevel.current === false) earnBadge("close_call");

        const nextLevel = levelRef.current + 1;
        if (nextLevel >= LEVEL_CONFIGS.length) {
          endGame(true);
          return;
        }
        levelRef.current = nextLevel;
        setLevel(nextLevel);
        if (nextLevel >= 2) earnBadge("level_2");
        if (nextLevel >= 3) earnBadge("level_3");
        addToast(`🎯 Level ${nextLevel + 1}!`, "#22c55e");
        startLevel(nextLevel);
        setBallPos({ x: ballRef.current.x, y: ballRef.current.y });
        rafRef.current = requestAnimationFrame(gameLoop);
        return;
      }
    }

    // Ball out of bounds (bottom)
    if (ball.y - BALL_R > BOARD_H) {
      livesRef.current--;
      setLives(livesRef.current);
      lostLifeThisLevel.current = true;
      shakeScreen();

      if (livesRef.current <= 0) {
        if (!usedContinueRef.current) {
          setGameState("continue");
          gameStateRef.current = "continue";
          setBallPos({ x: ball.x, y: ball.y });
          return;
        }
        endGame(false);
        setBallPos({ x: ball.x, y: ball.y });
        return;
      }
      if (livesRef.current === 1) {
        addToast("⚠️ Last life!", "#ef4444");
        earnBadge("close_call");
      }
      resetBall();
    }

    setBallPos({ x: ball.x, y: ball.y });
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [spawnParticles, flashScreen, shakeScreen, addToast, earnBadge, endGame, startLevel, resetBall, shopNotified, ownedSkins, effectivePaddleW]);

  useEffect(() => {
    if (gameState === "playing") {
      rafRef.current = requestAnimationFrame(gameLoop);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [gameState, gameLoop]);

  // Pause on blur
  useEffect(() => {
    if (!isFocused && (gameState === "playing" || gameState === "countdown")) {
      pausedFromCountdownRef.current = gameState === "countdown";
      setGameState("paused");
      gameStateRef.current = "paused";
    }
  }, [isFocused, gameState]);

  // Keyboard
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isDir = ["ArrowLeft", "ArrowRight", "a", "d", "A", "D"].includes(e.key);
    if (isDir) e.preventDefault();

    if (gameStateRef.current === "idle" || gameStateRef.current === "lost") {
      if (isDir || e.key === " ") { startGame(); return; }
    }
    if (gameStateRef.current === "playing" && ballStuckRef.current) {
      if (e.key === " ") {
        e.preventDefault();
        launchStuckBall();
        return;
      }
    }
    if (e.key === " ") {
      e.preventDefault();
      if (gameStateRef.current === "playing") {
        pausedFromCountdownRef.current = false;
        setGameState("paused"); gameStateRef.current = "paused";
      } else if (gameStateRef.current === "countdown") {
        pausedFromCountdownRef.current = true;
        setGameState("paused"); gameStateRef.current = "paused";
      } else if (gameStateRef.current === "paused") {
        if (pausedFromCountdownRef.current) {
          pausedFromCountdownRef.current = false;
          setGameState("countdown"); gameStateRef.current = "countdown";
        } else {
          setGameState("playing"); gameStateRef.current = "playing";
        }
      }
      return;
    }
    keysRef.current.add(e.key);
  }, [startGame, launchStuckBall]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    keysRef.current.delete(e.key);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp); };
  }, [handleKeyDown, handleKeyUp]);

  // Touch
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (gameStateRef.current === "idle" || gameStateRef.current === "lost") {
      startGame();
      return;
    }
    if (gameStateRef.current !== "playing") return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const tx = e.touches[0].clientX - rect.left;
    paddleXRef.current = Math.max(0, Math.min(BOARD_W - effectivePaddleW, tx - effectivePaddleW / 2));
    setPaddleX(paddleXRef.current);
  }, [startGame, effectivePaddleW]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (gameStateRef.current === "idle" || gameStateRef.current === "lost") {
      startGame();
      return;
    }
    if (gameStateRef.current !== "playing") return;
    if (ballStuckRef.current) {
      launchStuckBall();
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const tx = e.touches[0].clientX - rect.left;
    paddleXRef.current = Math.max(0, Math.min(BOARD_W - effectivePaddleW, tx - effectivePaddleW / 2));
    setPaddleX(paddleXRef.current);
  }, [startGame, effectivePaddleW, launchStuckBall]);

  const buyUpgrade = useCallback((upgradeId: string) => {
    const upg = UPGRADE_DEFS.find(u => u.id === upgradeId);
    if (!upg || ownedUpgrades.includes(upgradeId)) return;
    if (pointsRef.current < upg.cost) return;
    pointsRef.current -= upg.cost;
    setPoints(pointsRef.current);
    saveJSON("bb-points", pointsRef.current);
    const newOwned = [...ownedUpgrades, upgradeId];
    setOwnedUpgrades(newOwned);
    saveJSON("bb-upgrades", newOwned);
    addToast(`${upg.icon} ${upg.name} Unlocked!`, "#a78bfa");
  }, [ownedUpgrades, addToast]);

  const buySkin = useCallback((skinId: string) => {
    const skin = SKINS.find(s => s.id === skinId);
    if (!skin || ownedSkins.includes(skinId)) return;
    if (pointsRef.current < skin.cost) return;
    pointsRef.current -= skin.cost;
    setPoints(pointsRef.current);
    saveJSON("bb-points", pointsRef.current);
    const newOwned = [...ownedSkins, skinId];
    setOwnedSkins(newOwned);
    saveJSON("bb-owned-skins", newOwned);
    setActiveSkin(skinId);
    saveJSON("bb-active-skin", skinId);
    addToast(`${skin.preview} Unlocked ${skin.name}!`, "#22c55e");
  }, [ownedSkins, addToast]);

  const equipSkin = useCallback((skinId: string) => {
    if (!ownedSkins.includes(skinId)) return;
    setActiveSkin(skinId);
    saveJSON("bb-active-skin", skinId);
  }, [ownedSkins]);

  // ── Rendering ──
  const skin = getSkin();

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
      <div style={{ width: "100%", maxWidth: BOARD_W }}>
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
    <div style={{ width: "100%", maxWidth: BOARD_W }}>
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
    <div style={{ width: "100%", maxWidth: BOARD_W }}>
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

  const maxLivesForDisplay = ownedUpgrades.includes("extralife") ? 4 : MAX_LIVES;
  const livesDisplay = Array.from({ length: maxLivesForDisplay }, (_, i) => (
    <span key={i} style={{ fontSize: 14, opacity: i < lives ? 1 : 0.2, filter: i < lives ? "none" : "grayscale(1)" }}>
      ❤️
    </span>
  ));

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
      {onBack && <div style={{ width: "100%", maxWidth: BOARD_W }}><BackButton onClick={onBack} /></div>}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", maxWidth: BOARD_W }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: skin.headColor, textShadow: RETRO_GLOW(skin.headColor), letterSpacing: 3, textTransform: "uppercase" }}>
            Brick Breaker
          </div>
          <div style={{ display: "flex", gap: 2, marginTop: 6 }}>{livesDisplay}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#fbbf24", letterSpacing: 1, textTransform: "uppercase", textShadow: RETRO_GLOW("#fbbf2460") }}>PTS</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fbbf24", textShadow: RETRO_GLOW("#fbbf2440"), marginTop: 4 }}>🪙 {points}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#38bdf8", letterSpacing: 1, textTransform: "uppercase", textShadow: RETRO_GLOW("#38bdf860") }}>SCORE</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#f8fafc", textShadow: RETRO_GLOW("#38bdf840"), marginTop: 4 }}>{score.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: BOARD_W, justifyContent: "center" }}>
        <StatBadge label="BEST" value={bestScore > 0 ? bestScore.toLocaleString() : "--"} color="#fbbf24" />
        <StatBadge label="LVL" value={level + 1} color="#22c55e" />
        <StatBadge label="COMBO" value={combo} color="#d946ef" />
      </div>

      {/* Game board */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        style={{
          position: "relative", width: BOARD_W, height: BOARD_H,
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
        {/* Bricks */}
        {(gameState === "playing" || gameState === "paused" || gameState === "continue" || gameState === "countdown") && bricks.map((brick, i) => (
          <div key={`${brick.r}-${brick.c}-${i}`} style={{
            position: "absolute",
            left: brick.c * BRICK_W + 1, top: BRICK_TOP + brick.r * BRICK_H + 1,
            width: BRICK_W - 2, height: BRICK_H - 2,
            background: brick.color, borderRadius: 2,
            boxShadow: `0 0 6px ${brick.glow}`,
            border: brick.hp > 1 ? "1px solid rgba(255,255,255,0.3)" : "none",
          }} />
        ))}

        {/* Paddle */}
        {(gameState === "playing" || gameState === "paused" || gameState === "continue" || gameState === "countdown") && (
          <div style={{
            position: "absolute",
            left: paddleX, top: BOARD_H - 20,
            width: effectivePaddleW, height: PADDLE_H,
            background: skin.headColor, borderRadius: 3,
            boxShadow: `0 0 10px ${skin.glowColor}, 0 0 4px ${skin.headColor}`,
          }} />
        )}

        {/* Ball */}
        {(gameState === "playing" || gameState === "paused" || gameState === "continue" || gameState === "countdown") && (
          <div style={{
            position: "absolute",
            left: ballPos.x - BALL_R, top: ballPos.y - BALL_R,
            width: BALL_R * 2, height: BALL_R * 2,
            background: "#f8fafc", borderRadius: "50%",
            boxShadow: "0 0 8px rgba(248,250,252,0.8), 0 0 3px rgba(248,250,252,1)",
          }} />
        )}

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
            <div style={{ fontSize: 28 }}>🧱</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f97316", textShadow: RETRO_GLOW("#f97316"), letterSpacing: 2, textTransform: "uppercase" }}>
              Brick Breaker
            </div>
            <div style={{ fontSize: 9, color: "#94a3b8", maxWidth: 280, textAlign: "left", lineHeight: 1.9, letterSpacing: 0.3, padding: "0 8px" }}>
              <div style={{ color: "#fbbf24", fontSize: 10, textAlign: "center", marginBottom: 2, letterSpacing: 1, textShadow: RETRO_GLOW("#fbbf2440") }}>HOW TO PLAY</div>
              <div>• Bounce the ball off your paddle</div>
              <div>• Break all bricks to clear a level</div>
              <div>• Don't let the ball fall!</div>
              <div>• 5 levels of increasing speed</div>
              <div style={{ marginTop: 2, color: "#f97316", textShadow: RETRO_GLOW("#f9731630") }}>
                {isTouchDevice ? "👆 Drag to move the paddle" : "⌨️ ← → or A/D to move paddle"}
              </div>
            </div>
            <button onClick={startGame} style={{ ...btnStyle, padding: "10px 24px", fontSize: 12, marginTop: 2 }}>
              {isTouchDevice ? ">> Tap to Start <<" : ">> Press any key <<"}
            </button>
          </Overlay>
        )}

        {gameState === "paused" && (
          <Overlay>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fbbf24", textShadow: RETRO_GLOW("#fbbf24"), letterSpacing: 3, textTransform: "uppercase" }}>
              Paused
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              {isTouchDevice ? "Tap to resume" : "Press SPACE to resume"}
            </div>
            <button onClick={() => {
              if (pausedFromCountdownRef.current) {
                pausedFromCountdownRef.current = false;
                setGameState("countdown"); gameStateRef.current = "countdown";
              } else {
                setGameState("playing"); gameStateRef.current = "playing";
              }
            }} style={{ ...btnStyle, padding: "12px 28px", fontSize: 12 }}>Resume</button>
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
              Hands on keyboard!
            </div>
          </Overlay>
        )}

        {gameState === "continue" && (
          <Overlay>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fbbf24", textShadow: RETRO_GLOW("#fbbf24"), letterSpacing: 3, textTransform: "uppercase" }}>Continue?</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Keep your score and level</div>
            <button onClick={handleContinue} disabled={pointsRef.current < 50} style={{ ...btnStyle, padding: "10px 24px", fontSize: 12, marginTop: 4, background: pointsRef.current >= 50 ? "linear-gradient(135deg,#fbbf24,#d97706)" : "#1e293b", color: pointsRef.current >= 50 ? "#fff" : "#475569", cursor: pointsRef.current >= 50 ? "pointer" : "not-allowed" }}>🪙 50 pts</button>
            <button onClick={handleDeclineContinue} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#64748b", fontFamily: RETRO_FONT, marginTop: 4 }}>No thanks</button>
          </Overlay>
        )}

        {gameState === "won" && (
          <Overlay>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#22c55e", textShadow: RETRO_GLOW("#22c55e"), letterSpacing: 3, textTransform: "uppercase" }}>
              You Win!
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#f8fafc", textShadow: RETRO_GLOW("#22c55e40"), marginTop: 2 }}>{score.toLocaleString()}</div>
            <div style={{ fontSize: 13, color: "#fbbf24", textShadow: RETRO_GLOW("#fbbf2440"), letterSpacing: 0.5, lineHeight: 2 }}>
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
                Level: {level + 1}{level + 1 >= bestLevelReached ? (
                  <span style={{ color: "#22c55e" }}> (NEW BEST!)</span>
                ) : bestLevelReached > 0 ? (
                  <span style={{ color: "#64748b" }}> ({Math.round(((level + 1) / bestLevelReached) * 100)}% of best)</span>
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
            <button onClick={startGame} style={btnStyle}>Play Again</button>
          </Overlay>
        )}

        {gameState === "lost" && (
          <Overlay>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444", textShadow: RETRO_GLOW("#ef4444"), letterSpacing: 3, textTransform: "uppercase" }}>
              Game Over
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#f8fafc", textShadow: RETRO_GLOW("#ef444440"), marginTop: 2 }}>{score.toLocaleString()}</div>
            <div style={{ fontSize: 13, color: "#fbbf24", textShadow: RETRO_GLOW("#fbbf2440"), letterSpacing: 0.5, lineHeight: 2 }}>
              {score >= bestScore && score > 0 ? "** New Best Score! **" : `Best: ${bestScore.toLocaleString()}`}
            </div>
            <div style={{ fontSize: 13, color: "#a78bfa", letterSpacing: 0.5 }}>Reached level {level + 1}</div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, marginTop: 4, fontFamily: RETRO_FONT }}>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 0.3, lineHeight: 2 }}>
                Score: {score.toLocaleString()}{score >= bestScore ? (
                  <span style={{ color: "#22c55e" }}> (NEW BEST!)</span>
                ) : bestScore > 0 ? (
                  <span style={{ color: "#64748b" }}> ({Math.round((score / bestScore) * 100)}% of best)</span>
                ) : null}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 0.3, lineHeight: 2 }}>
                Level: {level + 1}{level + 1 >= bestLevelReached ? (
                  <span style={{ color: "#22c55e" }}> (NEW BEST!)</span>
                ) : bestLevelReached > 0 ? (
                  <span style={{ color: "#64748b" }}> ({Math.round(((level + 1) / bestLevelReached) * 100)}% of best)</span>
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
            <button onClick={startGame} style={btnStyle}>Play Again</button>
          </Overlay>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, width: "100%", maxWidth: BOARD_W }}>
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
                pausedFromCountdownRef.current = false;
                setGameState("paused"); gameStateRef.current = "paused";
              } else if (!isActive && gameStateRef.current === "countdown") {
                pausedFromCountdownRef.current = true;
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
        <div style={{ width: "100%", maxWidth: BOARD_W, maxHeight: 260, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch" }}>
          {activeTab === "leaderboard" && renderLeaderboardTab()}
          {activeTab === "badges" && renderBadgesTab()}
          {activeTab === "shop" && renderShopTab()}
        </div>
      )}

      <style>{RETRO_CSS}</style>
    </div>
  );
};

export default BrickBreaker;
