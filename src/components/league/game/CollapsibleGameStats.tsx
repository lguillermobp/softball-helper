"use client";

import { useState } from "react";
import { PlayerStatsTable } from "./PlayerStatsTable";
import type { PlayerStat } from "@/lib/stats";

interface GameEntry {
  gameId: string;
  label: string;
  stats: PlayerStat[];
}

interface Props {
  games: GameEntry[];
  teamName: string;
}

const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };

export function CollapsibleGameStats({ games, teamName }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggle(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-2">
      {games.map(g => (
        <div key={g.gameId}>
          <button
            onClick={() => toggle(g.gameId)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ ...card, color: "var(--sh-text)", borderRadius: expanded[g.gameId] ? "1rem 1rem 0 0" : undefined }}
          >
            <span>⚾ {g.label}</span>
            <span style={{ color: "var(--sh-muted)", fontSize: "10px" }}>{expanded[g.gameId] ? "▲ hide" : "▼ show"}</span>
          </button>
          {expanded[g.gameId] && (
            <div style={{ borderTop: "none" }}>
              <PlayerStatsTable stats={g.stats} teamName={teamName} label={g.label} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
