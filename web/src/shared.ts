import React from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Toast {
  id: number;
  text: string;
  color: string;
  createdAt: number;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
}

export interface SkinDef {
  id: string;
  name: string;
  cost: number;
  headColor: string;
  bodyColor: string;
  glowColor: string;
  trail?: string;
  preview: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  isPlayer?: boolean;
}

export type TabId = "leaderboard" | "badges" | "shop";
export type ShopSubTab = "skins" | "upgrades";

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: string;
}

// ─── Retro Styling ──────────────────────────────────────────────────────────

export const RETRO_FONT = `"Press Start 2P", "Courier New", "Lucida Console", monospace`;
export const RETRO_GLOW = (color: string) => `0 0 8px ${color}, 0 0 2px ${color}`;
export const PIXEL_BORDER = "2px solid";

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const DIFFICULTY_POINT_MULTIPLIER: Record<string, number> = { easy: 0.5, medium: 1, hard: 2 };

export const TOAST_DURATION_MS = 1600;
export const PARTICLE_COUNT = 8;

// ─── Shared Styles ──────────────────────────────────────────────────────────

export const btnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #22c55e, #16a34a)",
  color: "#fff", border: "none", borderRadius: 2, padding: "14px 32px",
  fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 4,
  boxShadow: "0 0 16px rgba(34,197,94,0.4), 0 0 4px rgba(34,197,94,0.6)",
  fontFamily: RETRO_FONT, letterSpacing: 1, textTransform: "uppercase",
};

export const shopBtnStyle: React.CSSProperties = {
  width: "100%", padding: "6px 0", border: "none", borderRadius: 2,
  fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#fff",
  fontFamily: RETRO_FONT, letterSpacing: 1,
};

// ─── Utilities ──────────────────────────────────────────────────────────────

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export type UpgradeInv = Record<string, number>;

export function loadUpgradeInv(key: string): UpgradeInv {
  const raw = loadJSON<UpgradeInv | string[]>(key, {});
  if (Array.isArray(raw)) {
    const inv: UpgradeInv = {};
    for (const id of raw) inv[id] = (inv[id] || 0) + 1;
    saveJSON(key, inv);
    return inv;
  }
  return raw as UpgradeInv;
}

export function detectTouchDevice(): boolean {
  const oa = (window as any).openai;
  if (oa?.userAgent && typeof oa.userAgent === "string") {
    const ua = oa.userAgent.toLowerCase();
    return /iphone|ipad|ipod|android|mobile|tablet/.test(ua);
  }
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  return coarse || hasTouch;
}

// ─── Streak System ──────────────────────────────────────────────────────────

export interface StreakInfo {
  count: number;
  multiplier: number;
  isNew: boolean;
}

export function getStreakInfo(): StreakInfo {
  const today = new Date().toDateString();
  const lastDate: string = loadJSON("arcade-streak-last-date", "");
  const prevCount: number = loadJSON("arcade-streak-count", 0);

  if (lastDate === today) {
    const m = prevCount >= 7 ? 2 : prevCount >= 3 ? 1.5 : prevCount >= 2 ? 1.2 : 1;
    return { count: prevCount, multiplier: m, isNew: false };
  }

  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const newCount = lastDate === yesterday ? prevCount + 1 : 1;
  const m = newCount >= 7 ? 2 : newCount >= 3 ? 1.5 : newCount >= 2 ? 1.2 : 1;
  return { count: newCount, multiplier: m, isNew: true };
}

export function recordStreak(): StreakInfo {
  const info = getStreakInfo();
  if (info.isNew) {
    saveJSON("arcade-streak-last-date", new Date().toDateString());
    saveJSON("arcade-streak-count", info.count);
  }
  return info;
}

// ─── Shared Sub-components ──────────────────────────────────────────────────

export const StatBadge: React.FC<{ label: string; value: number | string; color?: string }> = ({ label, value, color = "#64748b" }) =>
  React.createElement("div", {
    style: { background: "rgba(255,255,255,0.03)", borderRadius: 2, padding: "6px 14px", textAlign: "center", border: `${PIXEL_BORDER} #1e293b` },
  },
    React.createElement("div", {
      style: { fontSize: 12, color, textTransform: "uppercase", letterSpacing: 1, fontFamily: RETRO_FONT, textShadow: RETRO_GLOW(`${color}40`) },
    }, label),
    React.createElement("div", {
      style: { fontSize: 22, fontWeight: 700, color: "#e2e8f0", fontFamily: RETRO_FONT, marginTop: 4, textShadow: RETRO_GLOW(`${color}30`) },
    }, value),
  );

export const Overlay: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  React.createElement("div", {
    style: {
      position: "absolute", inset: 0, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 8,
      background: "rgba(15,23,42,0.85)", backdropFilter: "blur(4px)", zIndex: 10,
      overflowY: "auto", padding: "12px 0",
    },
  }, children);

export const RETRO_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.08); }
  }
  @keyframes shopPulse {
    0%, 100% { box-shadow: 0 0 8px rgba(34,197,94,0.3); border-color: #22c55e; }
    50% { box-shadow: 0 0 20px rgba(34,197,94,0.6); border-color: #4ade80; }
  }
  @keyframes badgePulse {
    0%, 100% { box-shadow: 0 0 8px rgba(244,114,182,0.3); border-color: #f472b6; }
    50% { box-shadow: 0 0 20px rgba(244,114,182,0.6); border-color: #f9a8d4; }
  }
  @keyframes rankPulse {
    0%, 100% { box-shadow: 0 0 8px rgba(251,191,36,0.3); border-color: #fbbf24; }
    50% { box-shadow: 0 0 20px rgba(251,191,36,0.6); border-color: #fde68a; }
  }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #0f172a; }
  ::-webkit-scrollbar-thumb { background: #4338ca; border-radius: 2px; }
`;

export const BackButton: React.FC<{ onClick: () => void }> = ({ onClick }) =>
  React.createElement("button", {
    onClick,
    style: {
      background: "none", border: "none", cursor: "pointer", padding: "4px 8px",
      fontSize: 14, color: "#64748b", fontFamily: RETRO_FONT, letterSpacing: 1,
      display: "flex", alignItems: "center", gap: 6,
      textShadow: RETRO_GLOW("#64748b30"),
    },
    onMouseEnter: (e: any) => { e.currentTarget.style.color = "#a78bfa"; },
    onMouseLeave: (e: any) => { e.currentTarget.style.color = "#64748b"; },
  }, "← MENU");
