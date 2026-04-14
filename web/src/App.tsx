import React, { useState } from "react";
import HomePage from "./HomePage";
import SnakeGame from "./component";
import Minesweeper from "./minesweeper";
import BrickBreaker from "./brickbreaker";
import MazeRunner from "./mazerunner";
import NeonDash from "./neondash";

type GameId = "snake" | "minesweeper" | "brickbreaker" | "mazerunner" | "neondash";

const VALID_GAMES: GameId[] = ["snake", "minesweeper", "brickbreaker", "mazerunner", "neondash"];

function resolveGame(data?: Record<string, unknown>): GameId | null {
  if (!data || typeof data !== "object") return null;
  const g = data.game;
  if (typeof g === "string" && VALID_GAMES.includes(g as GameId)) {
    return g as GameId;
  }
  return null;
}

interface AppProps {
  initialData?: Record<string, unknown>;
}

const App: React.FC<AppProps> = ({ initialData }) => {
  const [currentGame, setCurrentGame] = useState<GameId | null>(
    () => resolveGame(initialData)
  );

  if (currentGame === "snake") {
    return <SnakeGame initialData={initialData} onBack={() => setCurrentGame(null)} />;
  }

  if (currentGame === "minesweeper") {
    return <Minesweeper onBack={() => setCurrentGame(null)} />;
  }

  if (currentGame === "brickbreaker") {
    return <BrickBreaker onBack={() => setCurrentGame(null)} />;
  }

  if (currentGame === "mazerunner") {
    return <MazeRunner onBack={() => setCurrentGame(null)} />;
  }

  if (currentGame === "neondash") {
    return <NeonDash onBack={() => setCurrentGame(null)} />;
  }

  return <HomePage onSelectGame={setCurrentGame} />;
};

export default App;
