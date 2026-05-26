'use client';

import Link from "next/link";

interface LeagueCardProps {
  league: any;
  role: string;
  roleLabel: (r: string) => string;
  roleColor: (r: string) => string;
}

export function LeagueCard({ league, role, roleLabel, roleColor }: LeagueCardProps) {
  return (
    <Link href={`/league/${league.slug}`} className="group block">
      <div
        className="rounded-2xl border p-5 h-full transition-all duration-200 group-hover:scale-[1.02]"
        style={{
          borderColor: "#1e3a1e",
          background: "#0f2310",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#4ade80";
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 0 20px rgba(74,222,128,0.15)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#1e3a1e";
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 2px 8px rgba(0,0,0,0.4)";
        }}
      >
        {/* Card header */}
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
            style={{ background: "#1a3d1a", color: "#4ade80" }}
          >
            {league.name.charAt(0).toUpperCase()}
          </div>
          <span
            className={`text-xs font-medium border rounded-full px-2.5 py-0.5 ${roleColor(role)}`}
          >
            {roleLabel(role)}
          </span>
        </div>

        {/* League name */}
        <h3 className="font-bold text-base mb-1 group-hover:text-green-300 transition-colors" style={{ color: "#f0fdf4" }}>
          {league.name}
        </h3>
        {(league.city || league.state) && (
          <p className="text-xs mb-3" style={{ color: "#4ade80" }}>
            📍 {[league.city, league.state].filter(Boolean).join(", ")}
          </p>
        )}

        {/* Stats */}
        <div
          className="flex gap-3 mt-4 pt-3 border-t"
          style={{ borderColor: "#1e3a1e" }}
        >
          <div className="flex-1 text-center">
            <p className="text-xl font-bold" style={{ color: "#4ade80" }}>
              {league.seasons.length}
            </p>
            <p className="text-xs" style={{ color: "#6b7280" }}>
              season{league.seasons.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div
            className="w-px"
            style={{ background: "#1e3a1e" }}
          />
          <div className="flex-1 text-center">
            <p className="text-xl font-bold" style={{ color: "#4ade80" }}>
              {league.teams.length}
            </p>
            <p className="text-xs" style={{ color: "#6b7280" }}>
              team{league.teams.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* CTA */}
        <div
          className="mt-4 text-center text-xs font-medium py-2 rounded-lg transition-colors group-hover:bg-green-700"
          style={{ background: "#1a3d1a", color: "#4ade80" }}
        >
          Open league →
        </div>
      </div>
    </Link>
  );
}

