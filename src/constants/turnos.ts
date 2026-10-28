export const TURNOS_DISPONIVEIS = ["Turno 1", "Turno 2", "Turno 3"] as const;

const TURNOS_LEGADOS: Record<string, string> = {
  "Manhã": "Turno 1",
  Tarde: "Turno 2",
  Noite: "Turno 3",
};

export function normalizarTurno(turno: string): string {
  return TURNOS_LEGADOS[turno] ?? turno;
}

