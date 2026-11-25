import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  LoaderCircle,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import type {
  TeachingData,
  TeachingModality,
  TeachingModalityInput,
  TeachingModalityKind,
} from "../types/teaching";
import {
  loadTeachingData,
  saveTeachingModality,
  setTeachingModalityActive,
  TEACHING_DATA_CHANGED_EVENT,
} from "../services/teachingQualificationsDataSource";

const KINDS: TeachingModalityKind[] = ["Idioma", "Doutrina", "Sem subdivisão"];

const emptyDraft = (): TeachingModalityInput => ({
  trainingCode: "",
  name: "",
  kinds: [],
  active: true,
  notes: "",
});

const inputClass =
  "w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-oxford outline-none focus:border-yinmn focus:ring-2 focus:ring-yinmn/15";

export function TeachingModalitySettingsCard() {
  const [data, setData] = useState<TeachingData | null>(null);
  const [draft, setDraft] = useState<TeachingModalityInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingId, setChangingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loadTeachingData());
    } catch (reason) {
      console.error("Falha ao carregar modalidades de ensino:", reason);
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar as modalidades de ensino.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const handleChanged = (event: Event) => {
      setData((event as CustomEvent<TeachingData>).detail);
    };
    window.addEventListener(TEACHING_DATA_CHANGED_EVENT, handleChanged);
    return () => window.removeEventListener(TEACHING_DATA_CHANGED_EVENT, handleChanged);
  }, []);

  const startAdd = () => {
    setDraft(emptyDraft());
    setError("");
    setNotice("");
  };

  const startEdit = (modality: TeachingModality) => {
    setDraft({
      id: modality.id,
      trainingCode: modality.trainingCode === "Sem código" ? "" : modality.trainingCode,
      name: modality.name,
      kinds: modality.kinds,
      active: modality.active,
      notes: modality.notes,
    });
    setError("");
    setNotice("");
  };

  const toggleKind = (kind: TeachingModalityKind) => {
    if (!draft) return;
    const selected = draft.kinds.includes(kind);
    let kinds: TeachingModalityKind[];
    if (selected) {
      kinds = draft.kinds.filter((item) => item !== kind);
    } else if (kind === "Sem subdivisão") {
      kinds = [kind];
    } else {
      kinds = [...draft.kinds.filter((item) => item !== "Sem subdivisão"), kind];
    }
    setDraft({ ...draft, kinds });
  };

  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await saveTeachingModality(draft);
      setData(updated);
      setNotice(
        draft.id
          ? "Modalidade atualizada no Dataverse."
          : "Modalidade cadastrada no Dataverse.",
      );
      setDraft(null);
    } catch (reason) {
      console.error("Falha ao salvar modalidade de ensino:", reason);
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar a modalidade.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (modality: TeachingModality) => {
    if (changingId) return;
    setChangingId(modality.id);
    setError("");
    setNotice("");
    try {
      const updated = await setTeachingModalityActive(modality, !modality.active);
      setData(updated);
      setNotice(modality.active ? "Modalidade desativada." : "Modalidade ativada.");
    } catch (reason) {
      console.error("Falha ao alterar modalidade de ensino:", reason);
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível alterar a modalidade.",
      );
    } finally {
      setChangingId("");
    }
  };

  const modalities = [...(data?.modalities || [])].sort((left, right) =>
    `${left.trainingCode} ${left.name}`.localeCompare(
      `${right.trainingCode} ${right.name}`,
      "pt-BR",
      { numeric: true },
    ),
  );

  return (
    <section className="space-y-4 rounded-2xl border border-sky-100 bg-white p-4 shadow-[0_8px_24px_rgba(0,48,87,0.05)] sm:p-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-yinmn">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold text-oxford">Modalidades de Ensino</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Catálogo utilizado nas habilitações da aba Distritos.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={startAdd}
          disabled={draft !== null || saving}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-100 px-3 text-xs font-semibold text-yinmn transition-colors hover:border-sky-200 hover:bg-sky-50 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Cadastrar modalidade
        </button>
      </header>

      {draft && (
        <div className="grid gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Código do treinamento
            <input
              autoFocus
              value={draft.trainingCode}
              maxLength={100}
              onChange={(event) => setDraft({ ...draft, trainingCode: event.target.value })}
              className={inputClass}
              placeholder="Ex.: POR6"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Nome da modalidade
            <input
              value={draft.name}
              maxLength={850}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className={inputClass}
              placeholder="Ex.: POR6 — Idioma"
            />
          </label>

          <fieldset className="space-y-2 rounded-xl border border-sky-100 bg-white p-3 sm:col-span-2">
            <legend className="px-1 text-xs font-semibold text-slate-600">Modalidade</legend>
            <div className="flex flex-wrap gap-3">
              {KINDS.map((kind) => (
                <label key={kind} className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.kinds.includes(kind)}
                    onChange={() => toggleKind(kind)}
                    className="h-4 w-4 accent-[#006184]"
                  />
                  {kind}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">
            Observações
            <textarea
              rows={3}
              value={draft.notes}
              maxLength={2000}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              className={inputClass}
              placeholder="Informações complementares (opcional)"
            />
            <span className="block text-right text-[10px] font-normal text-slate-400">{draft.notes.length}/2000</span>
          </label>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
              className="h-4 w-4 accent-[#006184]"
            />
            Modalidade ativa
          </label>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setDraft(null)} disabled={saving} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-50">
              <X className="h-4 w-4" /> Cancelar
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !draft.trainingCode.trim() || !draft.name.trim() || !draft.kinds.length}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-yinmn px-3 text-xs font-semibold text-white hover:bg-cadet disabled:opacity-50"
            >
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Salvando..." : "Salvar no Dataverse"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {notice && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {notice}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando do Dataverse...
        </div>
      ) : modalities.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          Nenhuma modalidade de ensino cadastrada.
        </p>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {modalities.map((modality) => (
            <div key={modality.id} className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-sky-100 px-2 py-1 text-[10px] font-bold text-yinmn">{modality.trainingCode}</span>
                  <strong className="text-sm text-slate-700">{modality.name}</strong>
                  {!modality.active && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Inativa</span>}
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {modality.kinds.length ? modality.kinds.join(" · ") : "Sem modalidade definida"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => startEdit(modality)} disabled={draft !== null || Boolean(changingId)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-sky-100 bg-white px-3 text-xs font-semibold text-yinmn hover:bg-sky-50 disabled:opacity-50">
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
                <button type="button" onClick={() => void toggleActive(modality)} disabled={draft !== null || Boolean(changingId)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                  {changingId === modality.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
                  {modality.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
