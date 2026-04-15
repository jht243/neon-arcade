import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  type Toast, type Particle, type Badge, type SkinDef, type LeaderboardEntry, type TabId,
  type ShopSubTab, type UpgradeDef, type UpgradeInv,
  RETRO_FONT, RETRO_GLOW, PIXEL_BORDER,
  TOAST_DURATION_MS, PARTICLE_COUNT,
  btnStyle, shopBtnStyle,
  loadJSON, saveJSON, loadUpgradeInv, detectTouchDevice, recordStreak,
  StatBadge, Overlay, BackButton, RETRO_CSS,
} from "./shared";

type GameState = "idle" | "playing" | "paused" | "gameover" | "continue" | "countdown";

interface Obstacle {
  id: number;
  x: number;
  type: "low" | "high" | "double";
  width: number;
  height: number;
  passed: boolean;
}

interface Coin {
  id: number;
  x: number;
  y: number;
  collected: boolean;
}

type PowerUpKind = "shield" | "magnet" | "slowmo";

interface PowerUp {
  id: number;
  x: number;
  y: number;
  kind: PowerUpKind;
  collected: boolean;
}

interface ActivePowerUp {
  kind: PowerUpKind;
  remaining: number;
}

interface NeonDashProps {
  onBack?: () => void;
}

const COIN_SIZE = 14;
const COIN_SPAWN_INTERVAL = 120;

const POWERUP_SIZE = 18;
const POWERUP_SPAWN_INTERVAL = 400;
const POWERUP_DEFS: Record<PowerUpKind, { icon: string; color: string; duration: number; label: string }> = {
  shield: { icon: "🛡️", color: "#3b82f6", duration: 0, label: "SHIELD" },
  magnet: { icon: "🧲", color: "#a855f7", duration: 300, label: "MAGNET" },
  slowmo: { icon: "🐌", color: "#22c55e", duration: 180, label: "SLOW-MO" },
};

const BOARD_W = 320;
const BOARD_H = 400;
const GROUND_Y = BOARD_H - 40;
const PLAYER_W = 24;
const PLAYER_H = 48;
const PLAYER_DUCK_H = 24;
const PLAYER_X = 50;
const GRAVITY = 0.55;
const JUMP_FORCE = -13;
const INITIAL_SPEED = 1.2;
const MAX_SPEED = 8;
const SPEED_INCREMENT = 0.001;

const SKINS: SkinDef[] = [
  { id: "classic", name: "Classic", cost: 0, headColor: "#a78bfa", bodyColor: "rgba(167,139,250,", glowColor: "rgba(167,139,250,0.6)", preview: "🟣" },
  { id: "ocean", name: "Deep Sea", cost: 50, headColor: "#06b6d4", bodyColor: "rgba(6,182,212,", glowColor: "rgba(6,182,212,0.6)", preview: "🌊" },
  { id: "ember", name: "Ember", cost: 75, headColor: "#f97316", bodyColor: "rgba(249,115,22,", glowColor: "rgba(249,115,22,0.6)", preview: "🔥" },
  { id: "mint", name: "Mint", cost: 100, headColor: "#22c55e", bodyColor: "rgba(34,197,94,", glowColor: "rgba(34,197,94,0.6)", preview: "🍀" },
  { id: "neon", name: "Neon Pink", cost: 150, headColor: "#ec4899", bodyColor: "rgba(236,72,153,", glowColor: "rgba(236,72,153,0.6)", preview: "💗" },
  { id: "gold", name: "Royal Gold", cost: 200, headColor: "#eab308", bodyColor: "rgba(234,179,8,", glowColor: "rgba(234,179,8,0.6)", preview: "👑" },
];

const BADGE_DEFS: Omit<Badge, "earned">[] = [
  { id: "first_run", name: "First Run", description: "Complete your first run", icon: "👟" },
  { id: "score_100", name: "Century", description: "Score 100 in one run", icon: "💯" },
  { id: "score_500", name: "Five Hundred", description: "Score 500 in one run", icon: "⭐" },
  { id: "score_1k", name: "Thousand", description: "Score 1000 in one run", icon: "💫" },
  { id: "score_2k", name: "Two K", description: "Score 2000 in one run", icon: "💎" },
  { id: "score_5k", name: "Five K", description: "Score 5000 in one run", icon: "🌟" },
  { id: "dodge_10", name: "Nimble", description: "Dodge 10 obstacles in one run", icon: "🏃" },
  { id: "dodge_50", name: "Acrobat", description: "Dodge 50 obstacles in one run", icon: "🤸" },
  { id: "dodge_100", name: "Untouchable", description: "Dodge 100 obstacles in one run", icon: "👻" },
  { id: "speed_6", name: "Speeding", description: "Reach speed level 6", icon: "⚡" },
  { id: "speed_9", name: "Hyperdrive", description: "Reach speed level 9", icon: "🚀" },
  { id: "speed_max", name: "Lightspeed", description: "Reach max speed", icon: "🌩️" },
  { id: "duck_25", name: "Limbo King", description: "Duck 25 obstacles in one run", icon: "🙇" },
  { id: "coins_10", name: "Coin Grabber", description: "Collect 10 coins in one run", icon: "🪙" },
  { id: "coins_50", name: "Gold Rush", description: "Collect 50 coins in one run", icon: "💰" },
  { id: "coins_100", name: "Midas Touch", description: "Collect 100 coins in one run", icon: "👑" },
  { id: "powerup_first", name: "Powered Up", description: "Collect your first power-up", icon: "⚡" },
  { id: "shield_save", name: "Close Call", description: "Survive a hit with a shield", icon: "🛡️" },
  { id: "games_5", name: "Regular", description: "Play 5 games", icon: "🎮" },
  { id: "games_25", name: "Dedicated", description: "Play 25 games", icon: "🏅" },
  { id: "total_5k", name: "Marathon", description: "5000 total score across all runs", icon: "🏆" },
];

const UPGRADE_DEFS: UpgradeDef[] = [
  { id: "triplejump", name: "Triple Jump", description: "3 jumps instead of 2", cost: 100, icon: "🦘" },
  { id: "coinmagnet", name: "Coin Magnet", description: "Pulls nearby coins toward you", cost: 150, icon: "🧲" },
  { id: "startshield", name: "Shield Start", description: "Begin each run with a shield", cost: 250, icon: "🛡️" },
];

const DUMMY_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: "DashMaster", score: 8400 },
  { rank: 2, name: "NeonRunner", score: 6200 },
  { rank: 3, name: "SpeedKing", score: 4800 },
  { rank: 4, name: "JumpQueen", score: 3600 },
  { rank: 5, name: "PixelDash", score: 2800 },
  { rank: 6, name: "ArcadeAce", score: 2200 },
  { rank: 7, name: "RetroRun", score: 1700 },
  { rank: 8, name: "GlowRunner", score: 1200 },
  { rank: 9, name: "CasualDash", score: 800 },
  { rank: 10, name: "FirstTimer", score: 400 },
];

const NeonDash: React.FC<NeonDashProps> = ({ onBack }) => {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [bestDodged, setBestDodged] = useState(0);
  const [bestCoinsRun, setBestCoinsRun] = useState(0);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [isFocused, setIsFocused] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const [points, setPoints] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
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

  // Player state rendered via refs for perf
  const [playerY, setPlayerY] = useState(GROUND_Y - PLAYER_H);
  const [isDucking, setIsDucking] = useState(false);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [coins, setCoins] = useState<Coin[]>([]);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [groundOffset, setGroundOffset] = useState(0);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [activePowerUps, setActivePowerUps] = useState<ActivePowerUp[]>([]);
  const [hasShield, setHasShield] = useState(false);
  const [shopSubTab, setShopSubTab] = useState<ShopSubTab>("skins");
  const [upgradeInv, setUpgradeInv] = useState<UpgradeInv>({});
  const [activeUpgrades, setActiveUpgrades] = useState<string[]>([]);

  const gameStateRef = useRef<GameState>("idle");
  const pausedFromCountdownRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const toastIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const pointsRef = useRef(0);
  const obstacleIdRef = useRef(0);
  const usedContinueRef = useRef(false);
  const invincibleRef = useRef(0);
  const pendingHitObstacleIdRef = useRef<number | null>(null);

  const playerYRef = useRef(GROUND_Y - PLAYER_H);
  const velocityYRef = useRef(0);
  const isDuckingRef = useRef(false);
  const jumpCountRef = useRef(0);
  const scoreRef = useRef(0);
  const speedRef = useRef(INITIAL_SPEED);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const coinsRef = useRef<Coin[]>([]);
  const coinIdRef = useRef(0);
  const coinTimerRef = useRef(0);
  const coinsCollectedRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const powerUpIdRef = useRef(0);
  const powerUpTimerRef = useRef(0);
  const activePowerUpsRef = useRef<ActivePowerUp[]>([]);
  const hasShieldRef = useRef(false);
  const dodgedRef = useRef(0);
  const duckedRef = useRef(0);
  const frameRef = useRef(0);
  const groundOffsetRef = useRef(0);

  useEffect(() => {
    setIsTouchDevice(detectTouchDevice());
    const onGlobals = () => setIsTouchDevice(detectTouchDevice());
    window.addEventListener("openai:set_globals", onGlobals, { passive: true });

    setBestScore(loadJSON("nd-best-score", 0));
    setBestDodged(loadJSON("nd-best-dodged", 0));
    setBestCoinsRun(loadJSON("nd-best-coins", 0));
    setPoints(loadJSON("nd-points", 0));
    pointsRef.current = loadJSON("nd-points", 0);
    setGamesPlayed(loadJSON("nd-games-played", 0));
    setTotalScore(loadJSON("nd-total-score", 0));
    setActiveSkin(loadJSON("nd-active-skin", "classic"));
    setOwnedSkins(loadJSON("nd-owned-skins", ["classic"]));

    const earnedIds: string[] = loadJSON("nd-badges", []);
    setBadges(BADGE_DEFS.map(b => ({ ...b, earned: earnedIds.includes(b.id) })));
    setShopNotified(loadJSON("nd-shop-notified", false));
    setUpgradeInv(loadUpgradeInv("nd-upgrades"));

    return () => window.removeEventListener("openai:set_globals", onGlobals);
  }, []);

  useEffect(() => {
    const onFocus = () => setIsFocused(true);
    const onBlur = () => setIsFocused(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    if (document.hasFocus()) setIsFocused(true);
    return () => { window.removeEventListener("focus", onFocus); window.removeEventListener("blur", onBlur); };
  }, []);

  useEffect(() => {
    if (!isFocused && (gameState === "playing" || gameState === "countdown")) {
      pausedFromCountdownRef.current = gameState === "countdown";
      setGameState("paused"); gameStateRef.current = "paused";
    }
  }, [isFocused, gameState]);

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

  const addToast = useCallback((text: string, color = "#fbbf24") => {
    const id = ++toastIdRef.current;
    setToasts([{ id, text, color, createdAt: Date.now() }]);
  }, []);

  const spawnParticles = useCallback((cx: number, cy: number, color: string) => {
    const newP: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.5;
      const spd = 1.5 + Math.random() * 2;
      newP.push({
        id: ++particleIdRef.current, x: cx, y: cy,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 2,
        life: 15 + Math.floor(Math.random() * 10),
        color, size: 3 + Math.random() * 3,
      });
    }
    setParticles(prev => [...prev, ...newP]);
  }, []);

  const flashScreen = useCallback(() => {
    setScreenFlash(true); setTimeout(() => setScreenFlash(false), 150);
  }, []);

  const shakeScreen = useCallback(() => {
    setShakeBoard(true); setTimeout(() => setShakeBoard(false), 200);
  }, []);

  const earnBadge = useCallback((badgeId: string) => {
    setBadges(prev => {
      const badge = prev.find(b => b.id === badgeId);
      if (!badge || badge.earned) return prev;
      const updated = prev.map(b => (b.id === badgeId ? { ...b, earned: true } : b));
      saveJSON("nd-badges", updated.filter(b => b.earned).map(b => b.id));
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
    playerYRef.current = GROUND_Y - PLAYER_H;
    velocityYRef.current = 0;
    isDuckingRef.current = false;
    jumpCountRef.current = 0;
    scoreRef.current = 0;
    speedRef.current = INITIAL_SPEED;
    obstaclesRef.current = [];
    coinsRef.current = [];
    coinTimerRef.current = 0;
    coinsCollectedRef.current = 0;
    spawnTimerRef.current = 280;
    dodgedRef.current = 0;
    duckedRef.current = 0;
    frameRef.current = 0;
    groundOffsetRef.current = 0;

    powerUpsRef.current = [];
    powerUpTimerRef.current = POWERUP_SPAWN_INTERVAL;
    activePowerUpsRef.current = [];
    const startsWithShield = activeUpgrades.includes("startshield");
    hasShieldRef.current = startsWithShield;

    setPlayerY(GROUND_Y - PLAYER_H);
    setIsDucking(false);
    setScore(0);
    setSpeed(INITIAL_SPEED);
    setObstacles([]);
    setCoins([]);
    setCoinsCollected(0);
    setGroundOffset(0);
    setPowerUps([]);
    setActivePowerUps([]);
    setHasShield(startsWithShield);
    setToasts([]);
    setParticles([]);
    setActiveTab(null);
    usedContinueRef.current = false;
    invincibleRef.current = 0;
    pendingHitObstacleIdRef.current = null;

    const newGames = gamesPlayed + 1;
    setGamesPlayed(newGames);
    saveJSON("nd-games-played", newGames);
    if (newGames >= 5) earnBadge("games_5");
    if (newGames >= 25) earnBadge("games_25");

    containerRef.current?.focus({ preventScroll: true });
    setCountdown(3);
    setGameState("countdown");
    gameStateRef.current = "countdown";
  }, [gamesPlayed, earnBadge, activeUpgrades]);

  const finishGameOver = useCallback(() => {
    const sc = scoreRef.current;
    earnBadge("first_run");
    if (sc >= 100) earnBadge("score_100");
    if (sc >= 500) earnBadge("score_500");
    if (sc >= 1000) earnBadge("score_1k");
    if (sc >= 2000) earnBadge("score_2k");
    if (sc >= 5000) earnBadge("score_5k");
    if (dodgedRef.current >= 10) earnBadge("dodge_10");
    if (dodgedRef.current >= 50) earnBadge("dodge_50");
    if (dodgedRef.current >= 100) earnBadge("dodge_100");
    if (duckedRef.current >= 25) earnBadge("duck_25");
    if (coinsCollectedRef.current >= 10) earnBadge("coins_10");
    if (coinsCollectedRef.current >= 50) earnBadge("coins_50");
    if (coinsCollectedRef.current >= 100) earnBadge("coins_100");

    const streak = recordStreak();
    const baseEarned = Math.max(1, Math.floor(sc / 10));
    const earned = Math.round(baseEarned * streak.multiplier);
    pointsRef.current += earned;
    setPoints(pointsRef.current);
    saveJSON("nd-points", pointsRef.current);
    if (streak.multiplier > 1) addToast(`🔥 ${streak.multiplier}x streak bonus!`, "#fbbf24");

    const newTotal = (loadJSON("nd-total-score", 0) as number) + sc;
    setTotalScore(newTotal);
    saveJSON("nd-total-score", newTotal);
    if (newTotal >= 5000) earnBadge("total_5k");

    if (sc > bestScore) {
      setBestScore(sc);
      saveJSON("nd-best-score", sc);
      addToast("🏆 New Best Score!", "#eab308");
      setRankGlow(true);
    } else if (sc > 0 && bestScore === 0) {
      setRankGlow(true);
    }

    const dodged = dodgedRef.current;
    if (dodged > loadJSON("nd-best-dodged", 0)) {
      saveJSON("nd-best-dodged", dodged);
      setBestDodged(dodged);
    }
    const coinsRun = coinsCollectedRef.current;
    if (coinsRun > loadJSON("nd-best-coins", 0)) {
      saveJSON("nd-best-coins", coinsRun);
      setBestCoinsRun(coinsRun);
    }

    if (!shopNotified) {
      const cheapest = SKINS.filter(s => s.cost > 0 && !ownedSkins.includes(s.id)).sort((a, b) => a.cost - b.cost)[0];
      if (cheapest && pointsRef.current >= cheapest.cost) {
        setShopGlow(true); setShopNotified(true); saveJSON("nd-shop-notified", true);
        addToast("🛒 You can buy a skin!", "#22c55e");
      }
    }

    shakeScreen();
    spawnParticles(PLAYER_X + PLAYER_W / 2, playerYRef.current + PLAYER_H / 2, "#ef4444");

    setActiveUpgrades([]);
    setGameState("gameover");
    gameStateRef.current = "gameover";

  }, [bestScore, earnBadge, addToast, shakeScreen, spawnParticles, shopNotified, ownedSkins]);

  const endGame = useCallback(() => {
    if (!usedContinueRef.current) {
      setGameState("continue");
      gameStateRef.current = "continue";
      return;
    }
    finishGameOver();
  }, [finishGameOver]);

  const handleDeclineContinue = useCallback(() => {
    finishGameOver();
  }, [finishGameOver]);

  const handleContinue = useCallback(() => {
    if (pointsRef.current < 50) return;
    usedContinueRef.current = true;
    pointsRef.current -= 50;
    setPoints(pointsRef.current);
    saveJSON("nd-points", pointsRef.current);
    invincibleRef.current = 180;
    const hitId = pendingHitObstacleIdRef.current;
    if (hitId != null) {
      obstaclesRef.current = obstaclesRef.current.filter(o => o.id !== hitId);
    } else {
      let nearestId: number | null = null;
      let nearestDist = Infinity;
      const px = PLAYER_X;
      for (const o of obstaclesRef.current) {
        const dist = Math.abs(o.x + o.width / 2 - px);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestId = o.id;
        }
      }
      if (nearestId != null) {
        obstaclesRef.current = obstaclesRef.current.filter(o => o.id !== nearestId);
      }
    }
    setObstacles([...obstaclesRef.current]);
    pendingHitObstacleIdRef.current = null;
    setGameState("playing");
    gameStateRef.current = "playing";
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  const gameLoopRef = useRef<() => void>(() => {});

  const gameLoopFn = useCallback(() => {
    if (gameStateRef.current !== "playing") return;

    if (invincibleRef.current > 0) {
      invincibleRef.current--;
    }

    frameRef.current++;
    speedRef.current = Math.min(MAX_SPEED, speedRef.current + SPEED_INCREMENT);
    setSpeed(speedRef.current);

    const hasSlowMo = activePowerUpsRef.current.some(p => p.kind === "slowmo");
    const spd = hasSlowMo ? speedRef.current * 0.5 : speedRef.current;

    const speedLevel = Math.floor(speedRef.current);
    if (speedLevel >= 5) earnBadge("speed_6");
    if (speedLevel >= 8) earnBadge("speed_9");
    if (speedRef.current >= MAX_SPEED - 0.1) earnBadge("speed_max");

    // Player physics: apply velocity to position, then add gravity for next frame
    playerYRef.current += velocityYRef.current;
    velocityYRef.current += GRAVITY;
    const ph = isDuckingRef.current ? PLAYER_DUCK_H : PLAYER_H;
    const groundLevel = GROUND_Y - ph;
    if (playerYRef.current >= groundLevel) {
      playerYRef.current = groundLevel;
      velocityYRef.current = 0;
      jumpCountRef.current = 0;
    }
    setPlayerY(playerYRef.current);

    // Score
    if (frameRef.current % 3 === 0) {
      scoreRef.current++;
      setScore(scoreRef.current);
    }

    // Spawn obstacles
    spawnTimerRef.current -= spd;
    if (spawnTimerRef.current <= 0) {
      const minGap = Math.max(160, 280 - spd * 10);
      const maxGap = Math.max(220, 380 - spd * 10);
      spawnTimerRef.current = minGap + Math.random() * (maxGap - minGap);

      const roll = Math.random();
      const allowDouble = speedRef.current >= 5;
      let obs: Obstacle;
      if (!allowDouble || roll < 0.55) {
        // Low obstacle (jump over) — keep height moderate so jump is always comfortable
        const h = 20 + Math.random() * 18;
        obs = { id: ++obstacleIdRef.current, x: BOARD_W + 10, type: "low", width: 16 + Math.random() * 12, height: h, passed: false };
      } else if (roll < 0.85) {
        // High obstacle (duck under)
        obs = { id: ++obstacleIdRef.current, x: BOARD_W + 10, type: "high", width: 26 + Math.random() * 14, height: 20, passed: false };
      } else {
        // Double: low + high combo — only at higher speed
        obs = { id: ++obstacleIdRef.current, x: BOARD_W + 10, type: "double", width: 22, height: 28, passed: false };
      }
      obstaclesRef.current.push(obs);
    }

    // Move obstacles
    for (const obs of obstaclesRef.current) {
      obs.x -= spd;
      if (!obs.passed && obs.x + obs.width < PLAYER_X) {
        obs.passed = true;
        dodgedRef.current++;
        if (obs.type === "high") duckedRef.current++;
      }
    }
    obstaclesRef.current = obstaclesRef.current.filter(o => o.x + o.width > -20);
    setObstacles([...obstaclesRef.current]);

    // Spawn coins — only if no obstacle or existing coin is nearby
    coinTimerRef.current -= spd;
    if (coinTimerRef.current <= 0) {
      coinTimerRef.current = COIN_SPAWN_INTERVAL + Math.random() * 60;
      const count = 1 + Math.floor(Math.random() * 3);
      const baseX = BOARD_W + 10;
      const lastCoinX = baseX + (count - 1) * (COIN_SIZE + 8) + COIN_SIZE;

      const margin = 30;
      const obsBlocked = obstaclesRef.current.some(o =>
        o.x < lastCoinX + margin && o.x + o.width > baseX - margin
      );
      const coinBlocked = coinsRef.current.some(c =>
        !c.collected && c.x < lastCoinX + margin && c.x + COIN_SIZE > baseX - margin
      );

      if (!obsBlocked && !coinBlocked) {
        const heightRoll = Math.random();
        let baseY: number;
        if (heightRoll < 0.35) {
          baseY = GROUND_Y - COIN_SIZE - 4;
        } else if (heightRoll < 0.65) {
          baseY = GROUND_Y - PLAYER_H - 30 - Math.random() * 40;
        } else if (heightRoll < 0.85) {
          baseY = GROUND_Y - PLAYER_H - 80 - Math.random() * 30;
        } else {
          baseY = GROUND_Y - PLAYER_DUCK_H + 2;
        }
        for (let i = 0; i < count; i++) {
          coinsRef.current.push({
            id: ++coinIdRef.current,
            x: baseX + i * (COIN_SIZE + 8),
            y: baseY,
            collected: false,
          });
        }
      }
    }

    // Move coins and remove any that now overlap an obstacle
    for (const coin of coinsRef.current) {
      coin.x -= spd;
    }
    coinsRef.current = coinsRef.current.filter(c => {
      if (c.x < -COIN_SIZE || c.collected) return c.collected ? true : false;
      for (const obs of obstaclesRef.current) {
        if (c.x + COIN_SIZE > obs.x && c.x < obs.x + obs.width) return false;
      }
      return true;
    });
    setCoins([...coinsRef.current]);

    // Ground scroll
    groundOffsetRef.current = (groundOffsetRef.current - spd) % 40;
    setGroundOffset(groundOffsetRef.current);

    // Coin collection
    const pLeft = PLAYER_X + 3;
    const pRight = PLAYER_X + PLAYER_W - 3;
    const pTop = playerYRef.current + 2;
    const pBottom = playerYRef.current + ph - 2;

    const hasMagnet = activePowerUpsRef.current.some(p => p.kind === "magnet");
    const hasUpgradeMagnet = activeUpgrades.includes("coinmagnet");
    const magnetRange = hasMagnet ? 80 : hasUpgradeMagnet ? 55 : 0;

    for (const coin of coinsRef.current) {
      if (coin.collected) continue;
      if (magnetRange > 0) {
        const dx = (PLAYER_X + PLAYER_W / 2) - (coin.x + COIN_SIZE / 2);
        const dy = (playerYRef.current + ph / 2) - (coin.y + COIN_SIZE / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < magnetRange) {
          if (dist < 12) {
            coin.x = PLAYER_X + PLAYER_W / 2 - COIN_SIZE / 2;
            coin.y = playerYRef.current + ph / 2 - COIN_SIZE / 2;
          } else {
            const pull = Math.max(6, spd + 2);
            coin.x += (dx / dist) * pull;
            coin.y += (dy / dist) * pull;
          }
        }
      }
      const cLeft = coin.x;
      const cRight = coin.x + COIN_SIZE;
      const cTop = coin.y;
      const cBottom = coin.y + COIN_SIZE;
      if (pRight > cLeft && pLeft < cRight && pBottom > cTop && pTop < cBottom) {
        coin.collected = true;
        coinsCollectedRef.current++;
        setCoinsCollected(coinsCollectedRef.current);
        scoreRef.current += 5;
        setScore(scoreRef.current);
        spawnParticles(coin.x + COIN_SIZE / 2, coin.y + COIN_SIZE / 2, "#fbbf24");
      }
    }

    // Spawn power-ups (rarer than coins)
    powerUpTimerRef.current -= spd;
    if (powerUpTimerRef.current <= 0) {
      powerUpTimerRef.current = POWERUP_SPAWN_INTERVAL + Math.random() * 200;
      const kinds: PowerUpKind[] = ["shield", "magnet", "slowmo"];
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      const baseX = BOARD_W + 10;
      const yOptions = [GROUND_Y - POWERUP_SIZE - 4, GROUND_Y - PLAYER_H - 20, GROUND_Y - PLAYER_H - 60];
      const y = yOptions[Math.floor(Math.random() * yOptions.length)];
      const obsBlocked = obstaclesRef.current.some(o =>
        o.x < baseX + POWERUP_SIZE + 30 && o.x + o.width > baseX - 30
      );
      if (!obsBlocked) {
        powerUpsRef.current.push({ id: ++powerUpIdRef.current, x: baseX, y, kind, collected: false });
      }
    }

    // Move power-ups
    for (const pu of powerUpsRef.current) { pu.x -= spd; }
    powerUpsRef.current = powerUpsRef.current.filter(p => !p.collected && p.x > -POWERUP_SIZE);
    setPowerUps([...powerUpsRef.current]);

    // Collect power-ups
    for (const pu of powerUpsRef.current) {
      if (pu.collected) continue;
      if (pRight > pu.x && pLeft < pu.x + POWERUP_SIZE && pBottom > pu.y && pTop < pu.y + POWERUP_SIZE) {
        pu.collected = true;
        const def = POWERUP_DEFS[pu.kind];
        spawnParticles(pu.x + POWERUP_SIZE / 2, pu.y + POWERUP_SIZE / 2, def.color);
        earnBadge("powerup_first");
        if (pu.kind === "shield") {
          hasShieldRef.current = true;
          setHasShield(true);
          addToast(`${def.icon} Shield Active!`, def.color);
        } else {
          const existing = activePowerUpsRef.current.find(a => a.kind === pu.kind);
          if (existing) { existing.remaining = def.duration; }
          else { activePowerUpsRef.current.push({ kind: pu.kind, remaining: def.duration }); }
          addToast(`${def.icon} ${def.label}!`, def.color);
        }
        setActivePowerUps([...activePowerUpsRef.current]);
      }
    }

    // Tick down active power-ups
    activePowerUpsRef.current = activePowerUpsRef.current.filter(p => {
      p.remaining--;
      return p.remaining > 0;
    });
    setActivePowerUps([...activePowerUpsRef.current]);

    // Collision detection (skipped while invincible after continue)
    if (invincibleRef.current <= 0) {
      const HIGH_OBS_BOTTOM = GROUND_Y - PLAYER_DUCK_H - 8;

      const handleHit = (): boolean => {
        if (hasShieldRef.current) {
          hasShieldRef.current = false;
          setHasShield(false);
          addToast("🛡️ Shield Blocked!", "#3b82f6");
          earnBadge("shield_save");
          flashScreen();
          spawnParticles(PLAYER_X + PLAYER_W / 2, playerYRef.current + ph / 2, "#3b82f6");
          return false;
        }
        return true;
      };

      for (const obs of obstaclesRef.current) {
        let oLeft: number, oRight: number, oTop: number, oBottom: number;

        if (obs.type === "low") {
          oLeft = obs.x;
          oRight = obs.x + obs.width;
          oTop = GROUND_Y - obs.height;
          oBottom = GROUND_Y;
        } else if (obs.type === "high") {
          oLeft = obs.x;
          oRight = obs.x + obs.width;
          oTop = HIGH_OBS_BOTTOM - obs.height;
          oBottom = HIGH_OBS_BOTTOM;
        } else {
          oLeft = obs.x;
          oRight = obs.x + obs.width;
          const lowTop = GROUND_Y - Math.min(obs.height, PLAYER_DUCK_H - 4);
          const lowBottom = GROUND_Y;
          if (pRight > oLeft && pLeft < oRight && pBottom > lowTop && pTop < lowBottom) {
            if (handleHit()) { pendingHitObstacleIdRef.current = obs.id; endGame(); return; }
            obs.passed = true;
            continue;
          }
          oTop = HIGH_OBS_BOTTOM - 20;
          oBottom = HIGH_OBS_BOTTOM;
          if (pRight > oLeft && pLeft < oRight && pBottom > oTop && pTop < oBottom) {
            if (handleHit()) { pendingHitObstacleIdRef.current = obs.id; endGame(); return; }
            obs.passed = true;
            continue;
          }
          continue;
        }

        if (pRight > oLeft && pLeft < oRight && pBottom > oTop && pTop < oBottom) {
          if (handleHit()) { pendingHitObstacleIdRef.current = obs.id; endGame(); return; }
          obs.passed = true;
        }
      }
    }

    // Speed milestones toasts
    const milestones = [100, 250, 500, 1000, 2000, 3000, 5000];
    for (const m of milestones) {
      if (scoreRef.current === m) {
        addToast(`🌟 ${m >= 1000 ? `${m / 1000}K` : m}!`, "#fbbf24");
        flashScreen();
      }
    }

    rafRef.current = requestAnimationFrame(() => gameLoopRef.current());
  }, [endGame, earnBadge, addToast, flashScreen, spawnParticles, activeUpgrades]);

  gameLoopRef.current = gameLoopFn;

  useEffect(() => {
    if (gameState === "playing") {
      rafRef.current = requestAnimationFrame(() => gameLoopRef.current());
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [gameState]);

  const maxJumps = activeUpgrades.includes("triplejump") ? 3 : 2;

  const jump = useCallback(() => {
    if (jumpCountRef.current < maxJumps) {
      const force = jumpCountRef.current === 0 ? JUMP_FORCE : JUMP_FORCE * 0.8;
      velocityYRef.current = force;
      playerYRef.current += force;
      setPlayerY(playerYRef.current);
      isDuckingRef.current = false;
      setIsDucking(false);
      jumpCountRef.current++;
    }
  }, [maxJumps]);

  const startDuck = useCallback(() => {
    isDuckingRef.current = true;
    setIsDucking(true);
    // If on or near ground, snap to ducking ground position
    if (playerYRef.current >= GROUND_Y - PLAYER_H - 2) {
      playerYRef.current = GROUND_Y - PLAYER_DUCK_H;
      setPlayerY(playerYRef.current);
    } else {
      // In air: fast-fall
      velocityYRef.current += 4;
    }
  }, []);

  const stopDuck = useCallback(() => {
    isDuckingRef.current = false;
    setIsDucking(false);
    // If on ground, snap back to standing position
    if (playerYRef.current >= GROUND_Y - PLAYER_H - 2) {
      playerYRef.current = GROUND_Y - PLAYER_H;
      setPlayerY(playerYRef.current);
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") {
      e.preventDefault();
      if (gameStateRef.current === "continue") return;
      if (gameStateRef.current === "idle" || gameStateRef.current === "gameover") { startGame(); return; }
      if (gameStateRef.current === "paused") {
        if (pausedFromCountdownRef.current) { pausedFromCountdownRef.current = false; setGameState("countdown"); gameStateRef.current = "countdown"; }
        else { setGameState("playing"); gameStateRef.current = "playing"; }
        return;
      }
      if (gameStateRef.current === "playing") jump();
    }
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      e.preventDefault();
      if (gameStateRef.current === "continue") return;
      if (gameStateRef.current === "idle" || gameStateRef.current === "gameover") { startGame(); return; }
      if (gameStateRef.current === "playing") startDuck();
    }
  }, [startGame, jump, startDuck]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      stopDuck();
    }
  }, [stopDuck]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp); };
  }, [handleKeyDown, handleKeyUp]);

  // Touch: top half = jump, bottom half = duck
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (gameStateRef.current === "continue") return;
    if (gameStateRef.current === "idle" || gameStateRef.current === "gameover") { startGame(); return; }
    if (gameStateRef.current === "paused") {
      if (pausedFromCountdownRef.current) { pausedFromCountdownRef.current = false; setGameState("countdown"); gameStateRef.current = "countdown"; }
      else { setGameState("playing"); gameStateRef.current = "playing"; }
      return;
    }
    if (gameStateRef.current !== "playing") return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ty = e.touches[0].clientY - rect.top;
    if (ty < BOARD_H / 2) { jump(); } else { startDuck(); }
  }, [startGame, jump, startDuck]);

  const handleTouchEnd = useCallback(() => {
    stopDuck();
  }, [stopDuck]);

  const buySkin = useCallback((skinId: string) => {
    const skin = SKINS.find(s => s.id === skinId);
    if (!skin || ownedSkins.includes(skinId)) return;
    if (pointsRef.current < skin.cost) return;
    pointsRef.current -= skin.cost;
    setPoints(pointsRef.current);
    saveJSON("nd-points", pointsRef.current);
    const newOwned = [...ownedSkins, skinId];
    setOwnedSkins(newOwned);
    saveJSON("nd-owned-skins", newOwned);
    setActiveSkin(skinId);
    saveJSON("nd-active-skin", skinId);
    addToast(`${skin.preview} Unlocked ${skin.name}!`, "#22c55e");
  }, [ownedSkins, addToast]);

  const equipSkin = useCallback((skinId: string) => {
    if (!ownedSkins.includes(skinId)) return;
    setActiveSkin(skinId);
    saveJSON("nd-active-skin", skinId);
  }, [ownedSkins]);

  const buyUpgrade = useCallback((upgradeId: string) => {
    const upg = UPGRADE_DEFS.find(u => u.id === upgradeId);
    if (!upg) return;
    if (pointsRef.current < upg.cost) return;
    pointsRef.current -= upg.cost;
    setPoints(pointsRef.current);
    saveJSON("nd-points", pointsRef.current);
    const newInv = { ...upgradeInv, [upgradeId]: (upgradeInv[upgradeId] || 0) + 1 };
    setUpgradeInv(newInv);
    saveJSON("nd-upgrades", newInv);
    addToast(`${upg.icon} ${upg.name} +1!`, "#a78bfa");
  }, [upgradeInv, addToast]);

  const useUpgrade = useCallback((upgradeId: string) => {
    if ((upgradeInv[upgradeId] || 0) <= 0) return;
    if (activeUpgrades.includes(upgradeId)) return;
    const newInv = { ...upgradeInv, [upgradeId]: upgradeInv[upgradeId] - 1 };
    setUpgradeInv(newInv);
    saveJSON("nd-upgrades", newInv);
    setActiveUpgrades(prev => [...prev, upgradeId]);
    const upg = UPGRADE_DEFS.find(u => u.id === upgradeId);
    if (upg) addToast(`${upg.icon} ${upg.name} activated!`, "#22c55e");
  }, [upgradeInv, activeUpgrades, addToast]);

  // ── Rendering ──
  const skin = getSkin();
  const ph = isDucking ? PLAYER_DUCK_H : PLAYER_H;
  const speedLevel = Math.floor(speed);

  const groundH = BOARD_H - GROUND_Y;
  const highObsVisualBottom = groundH + PLAYER_DUCK_H + 8;

  const renderObstacles = () =>
    obstacles.map(obs => {
      if (obs.type === "low") {
        return (
          <div key={obs.id} style={{
            position: "absolute", left: obs.x, bottom: groundH,
            width: obs.width, height: obs.height,
            background: "#ef4444", borderRadius: 2,
            boxShadow: "0 0 8px rgba(239,68,68,0.6)",
          }} />
        );
      }
      if (obs.type === "high") {
        return (
          <div key={obs.id} style={{
            position: "absolute", left: obs.x, bottom: highObsVisualBottom,
            width: obs.width, height: obs.height,
            background: "#f59e0b", borderRadius: 2,
            boxShadow: "0 0 8px rgba(245,158,11,0.6)",
          }} />
        );
      }
      // double: low block on ground + high block floating
      const lowH = Math.min(obs.height, PLAYER_DUCK_H - 4);
      return (
        <React.Fragment key={obs.id}>
          <div style={{
            position: "absolute", left: obs.x, bottom: groundH,
            width: obs.width, height: lowH,
            background: "#ef4444", borderRadius: 2,
            boxShadow: "0 0 8px rgba(239,68,68,0.6)",
          }} />
          <div style={{
            position: "absolute", left: obs.x, bottom: highObsVisualBottom,
            width: obs.width, height: 20,
            background: "#f59e0b", borderRadius: 2,
            boxShadow: "0 0 8px rgba(245,158,11,0.6)",
          }} />
        </React.Fragment>
      );
    });

  const renderGroundLines = () => {
    const lines: React.ReactNode[] = [];
    for (let i = -1; i < 9; i++) {
      const x = groundOffset + i * 40;
      lines.push(
        <div key={i} style={{
          position: "absolute", left: x, bottom: groundH - 2,
          width: 20, height: 2,
          background: "rgba(67,56,202,0.3)",
        }} />
      );
    }
    return lines;
  };

  const buildLeaderboard = (): LeaderboardEntry[] => {
    if (bestScore === 0) return DUMMY_LEADERBOARD.map((e, i) => ({ ...e, rank: i + 1 }));
    const playerEntry: LeaderboardEntry = { rank: 0, name: "You", score: bestScore, isPlayer: true };
    return [...DUMMY_LEADERBOARD, playerEntry].sort((a, b) => b.score - a.score).slice(0, 10).map((e, i) => ({ ...e, rank: i + 1 }));
  };

  const renderLeaderboardTab = () => {
    const lb = buildLeaderboard();
    return (
      <div style={{ width: "100%", maxWidth: BOARD_W }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", marginBottom: 8, letterSpacing: 2, textShadow: RETRO_GLOW("#fbbf2450"), textTransform: "uppercase" }}>High Scores</div>
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 2, overflow: "hidden", border: `${PIXEL_BORDER} #1e293b` }}>
          {lb.map(entry => {
            const rankColors = ["#fbbf24", "#94a3b8", "#cd7f32"];
            const entryColor = entry.isPlayer ? "#22c55e" : entry.rank <= 3 ? rankColors[entry.rank - 1] : "#64748b";
            return (
              <div key={entry.rank} style={{ display: "flex", alignItems: "center", padding: "6px 10px", borderBottom: "1px solid #0f172a", background: entry.isPlayer ? "rgba(34,197,94,0.08)" : "transparent" }}>
                <div style={{ width: 28, fontSize: 12, fontWeight: 700, color: entryColor, textShadow: entry.rank <= 3 ? RETRO_GLOW(`${entryColor}40`) : "none" }}>{entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `${entry.rank}.`}</div>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: entry.isPlayer ? "#22c55e" : "#cbd5e1", textShadow: entry.isPlayer ? RETRO_GLOW("#22c55e40") : "none" }}>{entry.name}{entry.isPlayer ? " (YOU)" : ""}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: entryColor, textShadow: RETRO_GLOW(`${entryColor}30`) }}>{entry.score.toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderBadgesTab = () => (
    <div style={{ width: "100%", maxWidth: BOARD_W }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#f472b6", marginBottom: 6, letterSpacing: 2, textShadow: RETRO_GLOW("#f472b650"), textTransform: "uppercase" }}>Badges {badges.filter(b => b.earned).length}/{badges.length}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
        {badges.map(badge => (
          <div key={badge.id} title={`${badge.name}: ${badge.description}`} style={{
            background: badge.earned ? "rgba(244,114,182,0.06)" : "rgba(255,255,255,0.01)", borderRadius: 2, padding: "6px 3px", textAlign: "center",
            border: badge.earned ? `${PIXEL_BORDER} #f472b640` : "1px solid #1e293b", opacity: badge.earned ? 1 : 0.35, cursor: "default",
            boxShadow: badge.earned ? "0 0 8px rgba(244,114,182,0.1)" : "none",
          }}>
            <div style={{ fontSize: 18 }}>{badge.icon}</div>
            <div style={{ fontSize: 10, color: badge.earned ? "#f472b6" : "#475569", marginTop: 3, fontWeight: 700, lineHeight: 1.4, letterSpacing: 0.3, textShadow: badge.earned ? RETRO_GLOW("#f472b630") : "none" }}>{badge.name}</div>
            <div style={{ fontSize: 9, color: "#475569", marginTop: 2, lineHeight: 1.3, letterSpacing: 0.2 }}>{badge.description}</div>
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
            const owned = ownedSkins.includes(s.id); const equipped = activeSkin === s.id; const canAfford = pointsRef.current >= s.cost;
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
                  {[0, 1, 2, 3, 4].map(i => (<div key={i} style={{ width: 10, height: 10, borderRadius: 1, background: i === 0 ? s.headColor : `${s.bodyColor}${Math.max(0.4, 1 - i * 0.15)})`, boxShadow: i === 0 ? `0 0 4px ${s.headColor}60` : "none" }} />))}
                </div>
                {equipped ? (<div style={{ fontSize: 11, color: "#22c55e", fontWeight: 700, textAlign: "center", letterSpacing: 1, textShadow: RETRO_GLOW("#22c55e40"), padding: "6px 0" }}>EQUIPPED</div>
                ) : owned ? (<button onClick={() => equipSkin(s.id)} style={{ ...shopBtnStyle, background: "#334155", borderRadius: 2, fontFamily: RETRO_FONT, fontSize: 11, letterSpacing: 1 }}>EQUIP</button>
                ) : (<button onClick={() => buySkin(s.id)} disabled={!canAfford} style={{ ...shopBtnStyle, background: canAfford ? "linear-gradient(135deg,#22c55e,#16a34a)" : "#1e293b", color: canAfford ? "#fff" : "#475569", cursor: canAfford ? "pointer" : "not-allowed", borderRadius: 2, fontFamily: RETRO_FONT, fontSize: 11, letterSpacing: 1 }}>BUY</button>)}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {UPGRADE_DEFS.map(u => {
            const qty = upgradeInv[u.id] || 0;
            const isActive = activeUpgrades.includes(u.id);
            const canAfford = pointsRef.current >= u.cost;
            return (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, background: isActive ? "rgba(34,197,94,0.08)" : qty > 0 ? "rgba(167,139,250,0.08)" : "rgba(255,255,255,0.02)", borderRadius: 2, padding: 8, border: isActive ? `${PIXEL_BORDER} #22c55e` : qty > 0 ? `${PIXEL_BORDER} #a78bfa` : `${PIXEL_BORDER} #1e293b` }}>
                <span style={{ fontSize: 20 }}>{u.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", letterSpacing: 0.5 }}>{u.name}{qty > 0 && <span style={{ color: "#a78bfa", marginLeft: 4 }}>×{qty}</span>}</div>
                  <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2, lineHeight: 1.4 }}>{u.description}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <button onClick={() => buyUpgrade(u.id)} disabled={!canAfford} style={{ ...shopBtnStyle, width: "auto", padding: "4px 8px", background: canAfford ? "linear-gradient(135deg,#a78bfa,#7c3aed)" : "#1e293b", color: canAfford ? "#fff" : "#475569", cursor: canAfford ? "pointer" : "not-allowed", borderRadius: 2, fontFamily: RETRO_FONT, fontSize: 9, letterSpacing: 1, whiteSpace: "nowrap" }}>🪙 {u.cost}</button>
                  {isActive ? (
                    <div style={{ fontSize: 9, color: "#22c55e", fontWeight: 700, textAlign: "center", letterSpacing: 1, textShadow: RETRO_GLOW("#22c55e40"), padding: "3px 0" }}>ACTIVE</div>
                  ) : qty > 0 ? (
                    <button onClick={() => useUpgrade(u.id)} style={{ ...shopBtnStyle, width: "auto", padding: "4px 8px", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", cursor: "pointer", borderRadius: 2, fontFamily: RETRO_FONT, fontSize: 9, letterSpacing: 1 }}>USE</button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} tabIndex={isTouchDevice ? undefined : 0} style={{ width: "100%", maxWidth: 420, margin: "0 auto", padding: 20, outline: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, fontFamily: RETRO_FONT }}>
      {onBack && <div style={{ width: "100%", maxWidth: BOARD_W }}><BackButton onClick={onBack} /></div>}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", maxWidth: BOARD_W }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: skin.headColor, textShadow: RETRO_GLOW(skin.headColor), letterSpacing: 3, textTransform: "uppercase" }}>Neon Dash</div>
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

      {/* Stats */}
      <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: BOARD_W, justifyContent: "center" }}>
        <StatBadge label="BEST" value={bestScore > 0 ? bestScore : "--"} color="#fbbf24" />
        <StatBadge label="SPEED" value={speedLevel} color="#ef4444" />
        <StatBadge label="COINS" value={coinsCollected} color="#fbbf24" />
      </div>

      {/* Game board */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: "relative", width: BOARD_W, height: BOARD_H,
          background: "linear-gradient(180deg, #0f172a 0%, #1e293b 70%, #0f172a 100%)",
          borderRadius: 4, border: `${PIXEL_BORDER} #4338ca`, overflow: "hidden",
          touchAction: "none",
          boxShadow: screenFlash
            ? `0 0 30px ${skin.headColor}60, 0 0 60px ${skin.headColor}20, 0 4px 24px rgba(0,0,0,0.5)`
            : "0 0 15px rgba(67,56,202,0.3), 0 4px 24px rgba(0,0,0,0.5)",
          transform: shakeBoard ? `translate(${Math.random() * 4 - 2}px, ${Math.random() * 4 - 2}px)` : "none",
          transition: "box-shadow 0.15s, transform 0.05s",
        }}
      >
        {/* Ground */}
        <div style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: groundH, background: "linear-gradient(180deg, #1e293b, #0f172a)", borderTop: "2px solid #4338ca50" }} />
        {(gameState === "playing" || gameState === "paused" || gameState === "gameover" || gameState === "continue" || gameState === "countdown") && renderGroundLines()}

        {/* Player */}
        {(gameState === "playing" || gameState === "paused" || gameState === "gameover" || gameState === "continue" || gameState === "countdown") && (
          <div style={{
            position: "absolute", left: PLAYER_X, top: playerY,
            width: PLAYER_W, height: ph,
            background: skin.headColor, borderRadius: isDucking ? "3px" : "3px 3px 1px 1px",
            boxShadow: hasShield
              ? `0 0 14px #3b82f6, 0 0 28px rgba(59,130,246,0.5), 0 0 6px ${skin.glowColor}`
              : `0 0 10px ${skin.glowColor}, 0 0 20px ${skin.glowColor}`,
            border: hasShield ? "2px solid #60a5fa" : "none",
            transition: "height 0.05s",
            zIndex: 5,
            opacity: invincibleRef.current > 0 && Math.floor(invincibleRef.current / 6) % 2 === 0 ? 0.3 : 1,
          }} />
        )}

        {/* Obstacles */}
        {(gameState === "playing" || gameState === "paused" || gameState === "gameover" || gameState === "continue" || gameState === "countdown") && renderObstacles()}

        {/* Coins */}
        {(gameState === "playing" || gameState === "paused" || gameState === "gameover" || gameState === "continue" || gameState === "countdown") && coins.filter(c => !c.collected).map(coin => (
          <div key={coin.id} style={{
            position: "absolute", left: coin.x, top: coin.y,
            width: COIN_SIZE, height: COIN_SIZE, borderRadius: "50%",
            background: "radial-gradient(circle at 35% 35%, #fde68a, #fbbf24, #d97706)",
            boxShadow: "0 0 8px rgba(251,191,36,0.6), 0 0 16px rgba(251,191,36,0.3)",
            border: "1.5px solid #f59e0b",
            zIndex: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, fontWeight: 900, color: "#92400e", lineHeight: 1,
          }}>¢</div>
        ))}

        {/* Power-ups */}
        {(gameState === "playing" || gameState === "paused" || gameState === "countdown") && powerUps.filter(p => !p.collected).map(pu => {
          const def = POWERUP_DEFS[pu.kind];
          return (
            <div key={pu.id} style={{
              position: "absolute", left: pu.x, top: pu.y,
              width: POWERUP_SIZE, height: POWERUP_SIZE, borderRadius: 3,
              background: `${def.color}30`, border: `2px solid ${def.color}`,
              boxShadow: `0 0 12px ${def.color}80, 0 0 24px ${def.color}40`,
              zIndex: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, animation: "pulse 0.8s ease-in-out infinite",
            }}>{def.icon}</div>
          );
        })}

        {/* Particles */}
        {particles.map(p => (
          <div key={p.id} style={{ position: "absolute", left: p.x, top: p.y, width: p.size, height: p.size, borderRadius: "50%", background: p.color, opacity: p.life / 25, pointerEvents: "none" }} />
        ))}

        {/* Toasts */}
        {toasts.map(t => {
          const age = Date.now() - t.createdAt;
          const progress = Math.min(age / TOAST_DURATION_MS, 1);
          const scale = progress < 0.15 ? 0.5 + (progress / 0.15) * 0.5 : progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
          const opacity = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
          return (
            <div key={t.id} style={{ position: "absolute", left: "50%", top: "40%", transform: `translate(-50%, -20px) scale(${scale})`, opacity, fontSize: 14, fontWeight: 700, color: t.color, fontFamily: RETRO_FONT, textShadow: `0 0 12px ${t.color}, 0 0 4px ${t.color}, 0 2px 4px rgba(0,0,0,0.9)`, pointerEvents: "none", whiteSpace: "nowrap", zIndex: 20, letterSpacing: 1, textTransform: "uppercase" }}>
              {t.text}
            </div>
          );
        })}

        {/* Speed indicator + active power-ups HUD */}
        {gameState === "playing" && (
          <div style={{ position: "absolute", top: 6, right: 8, zIndex: 15, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
            <div style={{ fontSize: 10, color: speed > 8 ? "#ef4444" : speed > 5 ? "#f59e0b" : "#64748b", fontWeight: 700, fontFamily: RETRO_FONT, textShadow: speed > 8 ? RETRO_GLOW("#ef444440") : "none" }}>
              SPD {speedLevel}
            </div>
            {hasShield && (
              <div style={{ fontSize: 9, color: "#3b82f6", fontWeight: 700, fontFamily: RETRO_FONT, textShadow: RETRO_GLOW("#3b82f640") }}>🛡️ SHIELD</div>
            )}
            {activePowerUps.map(ap => {
              const def = POWERUP_DEFS[ap.kind];
              const secs = Math.ceil(ap.remaining / 60);
              return (
                <div key={ap.kind} style={{ fontSize: 9, color: def.color, fontWeight: 700, fontFamily: RETRO_FONT, textShadow: RETRO_GLOW(`${def.color}40`) }}>
                  {def.icon} {def.label} {secs}s
                </div>
              );
            })}
          </div>
        )}

        {/* Overlays */}
        {gameState === "idle" && (
          <Overlay>
            <div style={{ fontSize: 28 }}>🏃‍♂️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#d946ef", textShadow: RETRO_GLOW("#d946ef"), letterSpacing: 2, textTransform: "uppercase" }}>Neon Dash</div>
            <div style={{ fontSize: 9, color: "#94a3b8", maxWidth: 280, textAlign: "left", lineHeight: 1.9, letterSpacing: 0.3, padding: "0 8px" }}>
              <div style={{ color: "#fbbf24", fontSize: 10, textAlign: "center", marginBottom: 2, letterSpacing: 1, textShadow: RETRO_GLOW("#fbbf2440") }}>HOW TO PLAY</div>
              <div>• Jump over red obstacles</div>
              <div>• Duck under yellow obstacles</div>
              <div>• Double jump to go higher!</div>
              <div>• Speed increases over time!</div>
              <div style={{ marginTop: 2, color: "#d946ef", textShadow: RETRO_GLOW("#d946ef30") }}>
                {isTouchDevice ? "👆 Top half = jump · Bottom half = duck" : "⌨️ ↑/W/Space = jump · ↓/S = duck"}
              </div>
            </div>
            <button onClick={startGame} style={{ ...btnStyle, padding: "10px 24px", fontSize: 12, marginTop: 2 }}>
              {isTouchDevice ? ">> Tap to Start <<" : ">> Press any key <<"}
            </button>
          </Overlay>
        )}

        {gameState === "paused" && (
          <Overlay>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fbbf24", textShadow: RETRO_GLOW("#fbbf24"), letterSpacing: 3, textTransform: "uppercase" }}>Paused</div>
            <button onClick={() => {
              if (pausedFromCountdownRef.current) { pausedFromCountdownRef.current = false; setGameState("countdown"); gameStateRef.current = "countdown"; }
              else { setGameState("playing"); gameStateRef.current = "playing"; }
            }} style={{ ...btnStyle, padding: "10px 24px", fontSize: 12 }}>Resume</button>
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
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Keep your score and speed</div>
            <button onClick={handleContinue} disabled={pointsRef.current < 50} style={{ ...btnStyle, padding: "10px 24px", fontSize: 12, marginTop: 4, background: pointsRef.current >= 50 ? "linear-gradient(135deg,#fbbf24,#d97706)" : "#1e293b", color: pointsRef.current >= 50 ? "#fff" : "#475569", cursor: pointsRef.current >= 50 ? "pointer" : "not-allowed" }}>🪙 50 pts</button>
            <button onClick={handleDeclineContinue} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#64748b", fontFamily: RETRO_FONT, marginTop: 4 }}>No thanks</button>
          </Overlay>
        )}

        {gameState === "gameover" && (
          <Overlay>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444", textShadow: RETRO_GLOW("#ef4444"), letterSpacing: 3, textTransform: "uppercase" }}>Game Over</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#f8fafc", textShadow: RETRO_GLOW("#ef444440"), marginTop: 2 }}>{score}</div>
            <div style={{ fontSize: 12, color: "#fbbf24", textShadow: RETRO_GLOW("#fbbf2440"), letterSpacing: 0.5, lineHeight: 2 }}>
              {score >= bestScore && score > 0 ? "** New Best Score! **" : `Best: ${bestScore}`}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, marginTop: 4, fontFamily: RETRO_FONT }}>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 0.3, lineHeight: 2 }}>
                Score: {score}{score >= bestScore ? (
                  <span style={{ color: "#22c55e" }}> (NEW BEST!)</span>
                ) : bestScore > 0 ? (
                  <span style={{ color: "#64748b" }}> ({Math.round((score / bestScore) * 100)}% of best)</span>
                ) : null}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 0.3, lineHeight: 2 }}>
                Dodged: {dodgedRef.current}{dodgedRef.current >= bestDodged ? (
                  <span style={{ color: "#22c55e" }}> (NEW BEST!)</span>
                ) : bestDodged > 0 ? (
                  <span style={{ color: "#64748b" }}> ({Math.round((dodgedRef.current / bestDodged) * 100)}% of best)</span>
                ) : null}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 0.3, lineHeight: 2 }}>
                Coins: {coinsCollectedRef.current}{coinsCollectedRef.current >= bestCoinsRun ? (
                  <span style={{ color: "#22c55e" }}> (NEW BEST!)</span>
                ) : bestCoinsRun > 0 ? (
                  <span style={{ color: "#64748b" }}> ({Math.round((coinsCollectedRef.current / bestCoinsRun) * 100)}% of best)</span>
                ) : null}
              </div>
            </div>
            <button onClick={startGame} style={{ ...btnStyle, padding: "10px 24px", fontSize: 12 }}>Play Again</button>
          </Overlay>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, width: "100%", maxWidth: BOARD_W }}>
        {(["leaderboard", "badges", "shop"] as TabId[]).map(tab => {
          const isActive = activeTab === tab;
          const tabColor = tab === "leaderboard" ? "#fbbf24" : tab === "badges" ? "#f472b6" : "#22c55e";
          const isGlowing = !isActive && ((tab === "shop" && shopGlow) || (tab === "badges" && badgeGlow) || (tab === "leaderboard" && rankGlow));
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
              borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: RETRO_FONT,
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

export default NeonDash;
