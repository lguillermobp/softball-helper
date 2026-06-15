import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface Params { params: Promise<{ gameId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { gameId } = await params;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      homeScore: true,
      awayScore: true,
      scheduledAt: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      league:   { select: { name: true } },
      season:   { select: { name: true } },
    },
  });

  if (!game || game.homeScore === null || game.awayScore === null) {
    return new Response("Not found", { status: 404 });
  }

  const home = game.homeScore;
  const away = game.awayScore;
  const date = new Date(game.scheduledAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "1080px",
          height: "1080px",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0a1a0a 0%, #0f2a0f 50%, #0a1a0a 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background circles */}
        <div style={{
          position: "absolute", top: "-200px", right: "-200px",
          width: "600px", height: "600px",
          borderRadius: "50%",
          background: "rgba(34, 197, 94, 0.04)",
          display: "flex",
        }} />
        <div style={{
          position: "absolute", bottom: "-150px", left: "-150px",
          width: "400px", height: "400px",
          borderRadius: "50%",
          background: "rgba(34, 197, 94, 0.04)",
          display: "flex",
        }} />

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          paddingTop: "60px", paddingBottom: "20px", gap: "12px",
        }}>
          <span style={{ fontSize: "36px" }}>🥎</span>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "28px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase" }}>
            {game.league.name}
          </span>
        </div>

        {/* FINAL badge */}
        <div style={{
          display: "flex", justifyContent: "center", marginBottom: "40px",
        }}>
          <div style={{
            background: "rgba(34, 197, 94, 0.15)",
            border: "1px solid rgba(34, 197, 94, 0.4)",
            color: "#4ade80",
            fontSize: "18px",
            fontWeight: 700,
            letterSpacing: "4px",
            textTransform: "uppercase",
            padding: "8px 24px",
            borderRadius: "20px",
          }}>
            Final
          </div>
        </div>

        {/* Scoreboard */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: "0px", flex: 1,
        }}>
          {/* Away team */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            width: "380px",
          }}>
            <div style={{
              fontSize: away > home ? "52px" : "42px",
              fontWeight: 800,
              color: away > home ? "#ffffff" : "rgba(255,255,255,0.55)",
              textAlign: "center",
              lineHeight: 1.1,
              maxWidth: "340px",
              wordBreak: "break-word",
            }}>
              {game.awayTeam.name}
            </div>
            <div style={{
              fontSize: "18px",
              color: "rgba(255,255,255,0.35)",
              fontWeight: 500,
              marginTop: "8px",
              textTransform: "uppercase",
              letterSpacing: "2px",
            }}>
              Away
            </div>
          </div>

          {/* Scores */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            width: "260px",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "16px",
            }}>
              <span style={{
                fontSize: away > home ? "110px" : "90px",
                fontWeight: 900,
                color: away > home ? "#4ade80" : "rgba(255,255,255,0.6)",
                lineHeight: 1,
              }}>
                {away}
              </span>
              <span style={{
                fontSize: "48px",
                color: "rgba(255,255,255,0.2)",
                fontWeight: 300,
              }}>
                —
              </span>
              <span style={{
                fontSize: home > away ? "110px" : "90px",
                fontWeight: 900,
                color: home > away ? "#4ade80" : "rgba(255,255,255,0.6)",
                lineHeight: 1,
              }}>
                {home}
              </span>
            </div>
          </div>

          {/* Home team */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            width: "380px",
          }}>
            <div style={{
              fontSize: home > away ? "52px" : "42px",
              fontWeight: 800,
              color: home > away ? "#ffffff" : "rgba(255,255,255,0.55)",
              textAlign: "center",
              lineHeight: 1.1,
              maxWidth: "340px",
              wordBreak: "break-word",
            }}>
              {game.homeTeam.name}
            </div>
            <div style={{
              fontSize: "18px",
              color: "rgba(255,255,255,0.35)",
              fontWeight: 500,
              marginTop: "8px",
              textTransform: "uppercase",
              letterSpacing: "2px",
            }}>
              Home
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          paddingBottom: "60px", gap: "8px",
        }}>
          <div style={{
            width: "120px", height: "1px",
            background: "rgba(34, 197, 94, 0.3)",
          }} />
          <div style={{
            color: "rgba(255,255,255,0.35)",
            fontSize: "20px",
            marginTop: "12px",
          }}>
            {game.season.name} · {date}
          </div>
          <div style={{
            color: "rgba(34, 197, 94, 0.5)",
            fontSize: "18px",
            letterSpacing: "1px",
          }}>
            softballhelper.com
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  );
}
