import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  LoaderCircle,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import type { RhEmployee } from "../types/rh";
import type {
  TeachingData,
  TeachingQualification,
  TeachingQualificationInput,
} from "../types/teaching";
import {
  loadTeachingData,
  saveTeachingQualification,
  setTeachingQualificationActive,
} from "../services/teachingQualificationsDataSource";

interface TeachingQualificationPanelProps {
  employees: RhEmployee[];
  initialEmployeeId?: string;
  lockEmployee?: boolean;
  onClose: () => void;
  onChanged?: (data: TeachingData) => void;
}

interface EditorState extends TeachingQualificationInput {}

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-oxford outline-none transition focus:border-yinmn focus:ring-2 focus:ring-yinmn/10 disabled:bg-slate-50 disabled:text-slate-500";

function emptyEditor(employeeId = "", employeeName = ""): EditorState {
  return {
    employeeId,
    employeeName,
    modalityId: "",
    active: true,
    notes: "",
  };
}

export function TeachingQualificationPanel({
  employees,
  initialEmployeeId = "",
  lockEmployee = false,
  onClose,
  onChanged,
}: TeachingQualificationPanelProps) {
  const [data, setData] = useState<TeachingData | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
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
    } catch (refreshError) {
      console.error("Falha ao carregar habilitações de ensino:", refreshError);
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Não foi possível carregar as habilitações de ensino.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  const sortedEmployees = useMemo(
    () =>
      [...employees]
        .filter((employee) => employee.statusFuncionario !== "Encerrado")
        .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR")),
    [employees],
  );
  const normalizedEmployeeSearch = employeeSearch.trim().toLocaleLowerCase("pt-BR");
  const visibleEmployees = sortedEmployees.filter(
    (employee) =>
      !normalizedEmployeeSearch ||
      employee.nome.toLocaleLowerCase("pt-BR").includes(normalizedEmployeeSearch) ||
      (employee.nomePlaqueta || "")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedEmployeeSearch),
  );
  const selectedEmployee = employees.find(
    (employee) => employee.recordId.toLowerCase() === selectedEmployeeId.toLowerCase(),
  );
  const qualificationRows = (data?.qualifications || []).filter(
    (qualification) =>
      qualification.employeeId.toLowerCase() === selectedEmployeeId.toLowerCase(),
  );
  const modalityById = new Map(
    (data?.modalities || []).map((modality) => [modality.id.toLowerCase(), modality]),
  );
  const availableModalities = (data?.modalities || [])
    .filter(
      (modality) =>
        modality.active ||
        modality.id.toLowerCase() === (editor?.modalityId || "").toLowerCase(),
    )
    .sort((left, right) =>
      `${left.trainingCode} ${left.name}`.localeCompare(
        `${right.trainingCode} ${right.name}`,
        "pt-BR",
      ),
    );
  const duplicate = editor && !editor.id
    ? qualificationRows.find(
        (qualification) =>
          qualification.modalityId.toLowerCase() === editor.modalityId.toLowerCase(),
      )
    : undefined;

  const startNew = () => {
    if (!selectedEmployee) {
      setError("Selecione um funcionário antes de criar uma habilitação.");
      return;
    }
    setError("");
    setNotice("");
    setEditor(emptyEditor(selectedEmployee.recordId, selectedEmployee.nome));
  };

  const startEdit = (qualification: TeachingQualification) => {
    const employee = employees.find(
      (item) => item.recordId.toLowerCase() === qualification.employeeId.toLowerCase(),
    );
    setError("");
    setNotice("");
    setSelectedEmployeeId(qualification.employeeId);
    setEditor({
      id: qualification.id,
      employeeId: qualification.employeeId,
      employeeName: employee?.nome || qualification.name,
      modalityId: qualification.modalityId,
      active: qualification.active,
      notes: qualification.notes,
    });
  };

  const save = async () => {
    if (!editor || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const refreshed = await saveTeachingQualification(editor);
      setData(refreshed);
      onChanged?.(refreshed);
      setNotice(
        editor.id
          ? "Habilitação atualizada no Dataverse."
          : "Habilitação criada no Dataverse.",
      );
      setEditor(null);
    } catch (saveError) {
      console.error("Falha ao salvar habilitação de ensino:", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar a habilitação.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (qualification: TeachingQualification) => {
    if (changingId) return;
    setChangingId(qualification.id);
    setError("");
    setNotice("");
    try {
      const refreshed = await setTeachingQualificationActive(
        qualification,
        !qualification.active,
      );
      setData(refreshed);
      onChanged?.(refreshed);
      setNotice(qualification.active ? "Habilitação desativada." : "Habilitação reativada.");
    } catch (toggleError) {
      console.error("Falha ao alterar habilitação de ensino:", toggleError);
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Não foi possível alterar a habilitação.",
      );
    } finally {
      setChangingId("");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex justify-end bg-slate-950/40"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="teaching-manager-title"
        className="flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-yinmn">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-yinmn">Distritos</p>
              <h2 id="teaching-manager-title" className="mt-1 text-xl font-bold text-oxford">
                Habilitações de Ensino
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Associe instrutores às modalidades cadastradas no Dataverse.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Fechar" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          {notice && (
            <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {notice}
            </div>
          )}

          {!lockEmployee && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="text-xs font-bold text-slate-600">
                Localizar instrutor
                <span className="relative mt-1 block">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input className={`${inputClass} mt-0 pl-9`} value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Nome completo ou nome da plaqueta" />
                </span>
              </label>
              <label className="mt-3 block text-xs font-bold text-slate-600">
                Instrutor
                <select
                  className={inputClass}
                  value={selectedEmployeeId}
                  onChange={(event) => {
                    setSelectedEmployeeId(event.target.value);
                    setEditor(null);
                    setError("");
                    setNotice("");
                  }}
                >
                  <option value="">Selecione um instrutor</option>
                  {visibleEmployees.map((employee) => (
                    <option key={employee.recordId} value={employee.recordId}>
                      {employee.nome} {employee.nomePlaqueta ? `(${employee.nomePlaqueta})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}

          {selectedEmployee && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
                <div>
                  <h3 className="text-sm font-bold text-oxford">{selectedEmployee.nome}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {selectedEmployee.zona || "Zona não informada"} · {selectedEmployee.cargo || "Cargo não informado"}
                  </p>
                </div>
                <button type="button" onClick={startNew} disabled={loading || Boolean(editor)} className="inline-flex items-center gap-2 rounded-xl bg-yinmn px-3 py-2 text-xs font-bold text-white hover:bg-cadet disabled:opacity-50">
                  <Plus className="h-4 w-4" /> Novo
                </button>
              </header>

              {loading ? (
                <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando do Dataverse...
                </div>
              ) : qualificationRows.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Nenhum tipo de treinamento foi encontrado para este instrutor. Clique em "Novo" para criar uma habilitação.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {[...qualificationRows]
                    .sort((left, right) =>
                      (modalityById.get(left.modalityId.toLowerCase())?.name || "").localeCompare(
                        modalityById.get(right.modalityId.toLowerCase())?.name || "",
                        "pt-BR",
                      ),
                    )
                    .map((qualification) => {
                      const modality = modalityById.get(qualification.modalityId.toLowerCase());
                      return (
                        <div key={qualification.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <strong className="text-sm text-oxford">{modality?.name || "Modalidade não encontrada"}</strong>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${qualification.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                {qualification.active ? "Ativa" : "Inativa"}
                              </span>
                            </div>
                            <p className="mt-1 text-xs font-semibold text-yinmn">
                              {modality?.trainingCode || "Sem código"} · {modality?.kinds.join(", ") || "Sem subdivisão"}
                            </p>
                            {qualification.notes && <p className="mt-2 text-xs text-slate-500">{qualification.notes}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button type="button" onClick={() => startEdit(qualification)} disabled={Boolean(editor) || Boolean(changingId)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </button>
                            <button type="button" onClick={() => void toggleActive(qualification)} disabled={Boolean(changingId) || Boolean(editor)} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold disabled:opacity-50 ${qualification.active ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>
                              {changingId === qualification.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
                              {qualification.active ? "Desativar" : "Reativar"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </section>
          )}

          {editor && selectedEmployee && (
            <section className="rounded-2xl border border-sky-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-yinmn">{editor.id ? "Editar registro" : "Novo registro"}</p>
                  <h3 className="mt-1 text-base font-bold text-oxford">Apto a Ensinar</h3>
                </div>
                <button type="button" onClick={() => setEditor(null)} disabled={saving} aria-label="Cancelar edição" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X className="h-4 w-4" /></button>
              </div>

              <div className="mt-4 grid gap-4">
                <label className="text-xs font-bold text-slate-600">
                  Instrutor
                  <input className={inputClass} disabled value={selectedEmployee.nome} />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Modalidade de ensino
                  <select className={inputClass} value={editor.modalityId} onChange={(event) => setEditor({ ...editor, modalityId: event.target.value })}>
                    <option value="">Selecione uma modalidade</option>
                    {availableModalities.map((modality) => (
                      <option key={modality.id} value={modality.id}>
                        {modality.trainingCode} — {modality.name}{modality.kinds.length ? ` (${modality.kinds.join(", ")})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {availableModalities.length === 0 && (
                  <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                    Nenhuma modalidade ativa foi encontrada no catálogo do Dataverse.
                  </p>
                )}
                {duplicate && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <span>Já existe uma habilitação para esta combinação.</span>
                    <button type="button" onClick={() => startEdit(duplicate)} className="font-bold underline">Editar existente</button>
                  </div>
                )}
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700">
                  Habilitação ativa
                  <input type="checkbox" checked={editor.active} onChange={(event) => setEditor({ ...editor, active: event.target.checked })} className="h-4 w-4 accent-[#006184]" />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Observações
                  <textarea className={inputClass} rows={3} maxLength={100} value={editor.notes} onChange={(event) => setEditor({ ...editor, notes: event.target.value })} placeholder="Informações complementares (opcional)" />
                  <span className="mt-1 block text-right text-[10px] font-normal text-slate-400">{editor.notes.length}/100</span>
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setEditor(null)} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50">Cancelar</button>
                <button type="button" onClick={() => void save()} disabled={saving || Boolean(duplicate) || !editor.modalityId} className="inline-flex items-center gap-2 rounded-xl bg-yinmn px-4 py-2.5 text-sm font-bold text-white hover:bg-cadet disabled:cursor-not-allowed disabled:opacity-50">
                  {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {saving ? "Salvando..." : "Salvar no Dataverse"}
                </button>
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
