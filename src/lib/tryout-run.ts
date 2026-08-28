/** Pure helpers for the live tryout cursor. */

export type RunMode = "BY_SKILL" | "BY_PLAYER";
export interface CellPart { id: string; sequenceOrder: number; attendanceConfirmed: boolean }
export interface CellSkill { id: string; order: number }
export interface Cell { participantId: string; skillId: string }

/**
 * The ordered list of (present player × skill) cells the cursor walks.
 * BY_PLAYER = all skills for one player, then the next player (row-major).
 * BY_SKILL  = one skill for all players, then the next skill (column-major).
 * Absent players are excluded.
 */
export function buildCells(participants: CellPart[], skills: CellSkill[], runMode: RunMode): Cell[] {
  const P = participants.filter((p) => p.attendanceConfirmed).sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const S = [...skills].sort((a, b) => a.order - b.order);
  const cells: Cell[] = [];
  if (runMode === "BY_SKILL") {
    for (const s of S) for (const p of P) cells.push({ participantId: p.id, skillId: s.id });
  } else {
    for (const p of P) for (const s of S) cells.push({ participantId: p.id, skillId: s.id });
  }
  return cells;
}

export function cellIndex(cells: Cell[], participantId: string | null, skillId: string | null): number {
  if (!participantId || !skillId) return -1;
  return cells.findIndex((c) => c.participantId === participantId && c.skillId === skillId);
}
