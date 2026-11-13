import React, { useState } from "react";
import { Check, Clock3, Plus, Save, X } from "lucide-react";
import type { TurnoItem } from "../services/dataverseCatalogs";

interface ShiftSettingsCardProps {
  shifts: TurnoItem[];
  onSave: (shifts: TurnoItem[]) => Promise<TurnoItem[]>;
}

type ShiftDraft = Omit<TurnoItem, "id"> & { id: string };

const emptyShift = (): ShiftDraft => ({
  id: "",
  codigo: "",
  nome: "",
  horarioInicio: "",
  horarioFim: "",
  turnoTemplo: false,
  ativo: true,
});

export const ShiftSettingsCard: React.FC<ShiftSettingsCardProps> = ({
  shifts,
  onSave,
}) => {
  const [drafts, setDrafts] = useState<ShiftDraft[]>(shifts);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<ShiftDraft>(emptyShift());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const startAdd = () => {
    setDraft(emptyShift());
    setEditing("new");
    setError("");
    setSaved(false);
  };

  const startEdit = (shift: ShiftDraft) => {
    setDraft({ ...shift });
    setEditing(shift.id);
    setError("");
    setSaved(false);
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft(emptyShift());
  };

  const commitDraft = () => {
    const updated = drafts.some((shift) => shift.id === editing)
      ? drafts.map((shift) => (shift.id === editing ? draft : shift))
      : [...drafts, draft];
    setDrafts(updated);
    cancelEdit();
    setSaved(false);
    setError("");
  };

  const toggleActive = (id: string) => {
    setDrafts((current) =>
      current.map((shift) =>
        shift.id === id ? { ...shift, ativo: !shift.ativo } : shift,
      ),
    );
    setSaved(false);
    setError("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const savedShifts = await onSave(drafts);
      setDrafts(savedShifts);
      setSaved(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar os turnos.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = <K extends keyof ShiftDraft>(
    key: K,
    value: ShiftDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <section className="space-y-4 rounded-2xl border border-sky-100 bg-white p-4 shadow-[0_8px_24px_rgba(0,48,87,0.05)] sm:p-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-yinmn">
            <Clock3 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold text-oxford">Turnos</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Edite os horários e mantenha as opções sincronizadas com o Dataverse.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={startAdd}
          disabled={editing !== null || saving}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-100 px-3 text-xs font-semibold text-yinmn transition-colors hover:border-sky-200 hover:bg-sky-50 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Adicionar turno
        </button>
      </header>

      {editing !== null && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Código
            <input
              autoFocus
              value={draft.codigo}
              onChange={(event) => updateDraft("codigo", event.target.value)}
              className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-oxford outline-none focus:border-yinmn focus:ring-2 focus:ring-yinmn/15"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-1 lg:col-span-2">
            Nome do turno
            <input
              value={draft.nome}
              onChange={(event) => updateDraft("nome", event.target.value)}
              className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-oxford outline-none focus:border-yinmn focus:ring-2 focus:ring-yinmn/15"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Horário de início
            <input
              type="time"
              value={draft.horarioInicio}
              onChange={(event) => updateDraft("horarioInicio", event.target.value)}
              className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-oxford outline-none focus:border-yinmn focus:ring-2 focus:ring-yinmn/15"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Horário de término
            <input
              type="time"
              value={draft.horarioFim}
              onChange={(event) => updateDraft("horarioFim", event.target.value)}
              className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-oxford outline-none focus:border-yinmn focus:ring-2 focus:ring-yinmn/15"
            />
          </label>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2 pb-2">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={draft.turnoTemplo}
                onChange={(event) => updateDraft("turnoTemplo", event.target.checked)}
                className="accent-yinmn"
              />
              Turno de templo
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={draft.ativo}
                onChange={(event) => updateDraft("ativo", event.target.checked)}
                className="accent-yinmn"
              />
              Ativo
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 sm:col-span-2 lg:col-span-3">
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-white"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
            <button
              type="button"
              onClick={commitDraft}
              disabled={!draft.codigo.trim() || !draft.nome.trim()}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-yinmn px-3 text-xs font-semibold text-white hover:bg-cadet disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Concluir edição
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {drafts.map((shift) => (
          <div
            key={shift.id || "new"}
            className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-slate-700">
                {shift.nome}
                {!shift.ativo && (
                  <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    Inativo
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Código: {shift.codigo || "—"} · {shift.horarioInicio || "--:--"}–
                {shift.horarioFim || "--:--"}
                {shift.turnoTemplo ? " · Templo" : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => startEdit(shift)}
                disabled={editing !== null || saving}
                className="min-h-9 rounded-lg border border-sky-100 bg-white px-3 text-xs font-semibold text-yinmn hover:bg-sky-50 disabled:opacity-50"
              >
                Editar
              </button>
              {shift.id && (
                <button
                  type="button"
                  onClick={() => toggleActive(shift.id)}
                  disabled={editing !== null || saving}
                  className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  {shift.ativo ? "Desativar" : "Ativar"}
                </button>
              )}
            </div>
          </div>
        ))}
        {drafts.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            Nenhum turno cadastrado.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Turnos salvos com sucesso.
        </p>
      )}

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || editing !== null}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-yinmn px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-cadet disabled:cursor-wait disabled:opacity-70"
        >
          <Save className="h-4 w-4" />
          {saving ? "Salvando turnos..." : "Salvar turnos"}
        </button>
      </div>
    </section>
  );
};
