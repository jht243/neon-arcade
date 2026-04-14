import React, { useMemo } from "react";
import { RETRO_FONT, RETRO_GLOW, PIXEL_BORDER, RETRO_CSS, getStreakInfo } from "./shared";

interface GameCard {
  id: string;
  name: string;
  icon: string;
  description: string;
  accentColor: string;
}

const GAMES: GameCard[] = [
  {
    id: "minesweeper",
    name: "Minefield",
    icon: "💣",
    description: "Sweep the grid, flag the mines, beat your best time.",
    accentColor: "#3b82f6",
  },
  {
    id: "brickbreaker",
    name: "Brick Breaker",
    icon: "🧱",
    description: "Smash bricks, chain combos, clear all 5 levels.",
    accentColor: "#f97316",
  },
  {
    id: "mazerunner",
    name: "Maze Runner",
    icon: "🏃",
    description: "Navigate random mazes, race the clock, find the exit.",
    accentColor: "#06b6d4",
  },
  {
    id: "neondash",
    name: "Neon Dash",
    icon: "🏃‍♂️",
    description: "Jump & duck in this endless runner that gets faster and faster.",
    accentColor: "#d946ef",
  },
  {
    id: "snake",
    name: "Snake",
    icon: "🐍",
    description: "Steer the snake, chain combos, earn badges & unlock skins.",
    accentColor: "#22c55e",
  },
];

interface HomePageProps {
  onSelectGame: (gameId: any) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onSelectGame }) => {
  const streak = useMemo(() => getStreakInfo(), []);
  return (
    <div
      style={{
        width: "100%", maxWidth: 420, margin: "0 auto", padding: 20,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 24,
        fontFamily: RETRO_FONT,
      }}
    >
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <div style={{
          fontSize: 28, fontWeight: 700, color: "#a78bfa",
          textShadow: `${RETRO_GLOW("#a78bfa")}, 0 0 40px rgba(167,139,250,0.3)`,
          letterSpacing: 4, textTransform: "uppercase",
        }}>
          Neon Arcade
        </div>
        {streak.count > 0 && (
          <div style={{
            fontSize: 11, color: "#fbbf24", marginTop: 10, letterSpacing: 1,
            textShadow: RETRO_GLOW("#fbbf2440"),
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <span style={{ fontSize: 14 }}>{"🔥"}</span>
            <span>{streak.count} DAY STREAK</span>
            {streak.multiplier > 1 && (
              <span style={{ fontSize: 10, color: "#22c55e", textShadow: RETRO_GLOW("#22c55e40") }}>
                ({streak.multiplier}x PTS)
              </span>
            )}
          </div>
        )}
        <div style={{
          fontSize: 11, color: "#64748b", marginTop: 10, letterSpacing: 2,
          textTransform: "uppercase", textShadow: RETRO_GLOW("#64748b30"),
        }}>
          Select a Game
        </div>
      </div>

      <div style={{
        display: "flex", flexDirection: "column", gap: 12,
        width: "100%",
      }}>
        {GAMES.map((game) => (
          <button
            key={game.id}
            onClick={() => onSelectGame(game.id)}
            style={{
              background: "rgba(255,255,255,0.02)",
              border: `${PIXEL_BORDER} ${game.accentColor}40`,
              borderRadius: 2, padding: 20, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 16,
              transition: "border-color 0.2s, box-shadow 0.2s",
              boxShadow: `0 0 12px ${game.accentColor}10`,
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = game.accentColor;
              e.currentTarget.style.boxShadow = `0 0 20px ${game.accentColor}30, 0 0 8px ${game.accentColor}20`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = `${game.accentColor}40`;
              e.currentTarget.style.boxShadow = `0 0 12px ${game.accentColor}10`;
            }}
          >
            <div style={{
              fontSize: 36, width: 64, height: 64,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `${game.accentColor}10`, borderRadius: 2,
              border: `1px solid ${game.accentColor}30`,
              flexShrink: 0,
            }}>
              {game.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 16, fontWeight: 700, color: game.accentColor,
                textShadow: RETRO_GLOW(`${game.accentColor}60`),
                letterSpacing: 2, textTransform: "uppercase",
                fontFamily: RETRO_FONT,
              }}>
                {game.name}
              </div>
              <div style={{
                fontSize: 10, color: "#94a3b8", marginTop: 8,
                lineHeight: 1.8, letterSpacing: 0.3,
                fontFamily: RETRO_FONT,
              }}>
                {game.description}
              </div>
              <div style={{
                fontSize: 11, color: game.accentColor, marginTop: 10,
                letterSpacing: 2, textTransform: "uppercase",
                fontFamily: RETRO_FONT,
                textShadow: RETRO_GLOW(`${game.accentColor}40`),
              }}>
                {">> PLAY <<"}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div style={{
        fontSize: 9, color: "#334155", marginTop: 8,
        letterSpacing: 1, textTransform: "uppercase",
      }}>
        More games coming soon
      </div>

      <style>{RETRO_CSS}</style>
    </div>
  );
};

export default HomePage;
