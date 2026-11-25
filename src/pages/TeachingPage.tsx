import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  BookOpenCheck,
  GraduationCap,
  LayoutGrid,
  LoaderCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { RhEmployee } from "../types/rh";
import type {
  TeachingData,
  TeachingModality,
  TeachingModalityKind,
  TeachingQualification,
  TeachingStatusFilter,
  TeachingView,
} from "../types/teaching";
import {
  loadTeachingData,
  TEACHING_DATA_CHANGED_EVENT,
} from "../services/teachingQualificationsDataSource";
import FuncionarioAvatar from "../components/FuncionarioAvatar";
import { TeachingQualificationPanel } from "../components/TeachingQualificationPanel";

interface TeachingPageProps {
  employees: RhEmployee[];
  onSelectEmployee: (employee: RhEmployee) => void;
}

interface QualificationView {
  qualification: TeachingQualification;
  modality: TeachingModality;
  employee: RhEmployee;
}

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-oxford outline-none transition focus:border-yinmn focus:ring-2 focus:ring-yinmn/10";

export function TeachingPage({ employees, onSelectEmployee }: TeachingPageProps) {
  const [data, setData] = useState<TeachingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<TeachingView>("modality");
  const [search, setSearch] = useState("");
  const [trainingCode, setTrainingCode] = useState("");
  const [kind, setKind] = useState<TeachingModalityKind | "">("");
  const [employeeId, setEmployeeId] = useState("");
  const [zone, setZone] = useState("");
  const [status, setStatus] = useState<TeachingStatusFilter>("active");
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [managerEmployeeId, setManagerEmployeeId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loadTeachingData());
    } catch (refreshError) {
      console.error("Falha ao carregar a página de distritos:", refreshError);
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
    const handleChanged = (event: Event) => {
      setData((event as CustomEvent<TeachingData>).detail);
    };
    window.addEventListener(TEACHING_DATA_CHANGED_EVENT, handleChanged);
    return () => window.removeEventListener(TEACHING_DATA_CHANGED_EVENT, handleChanged);
  }, []);

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.recordId.toLowerCase(), employee])),
    [employees],
  );
  const modalityById = useMemo(
    () =>
      new Map(
        (data?.modalities || []).map((modality) => [modality.id.toLowerCase(), modality]),
      ),
    [data],
  );

  const joinedRows = useMemo<QualificationView[]>(
    () =>
      (data?.qualifications || [])
        .map((qualification) => {
          const employee = employeeById.get(qualification.employeeId.toLowerCase());
          const modality = modalityById.get(qualification.modalityId.toLowerCase());
          return employee && modality ? { qualification, employee, modality } : null;
        })
        .filter((item): item is QualificationView => Boolean(item)),
    [data, employeeById, modalityById],
  );

  const activeRows = joinedRows.filter(
    ({ qualification, modality }) => qualification.active && modality.active,
  );
  const stats = {
    instructors: new Set(activeRows.map(({ employee }) => employee.recordId.toLowerCase())).size,
    modalities: new Set(activeRows.map(({ modality }) => modality.id.toLowerCase())).size,
    trainings: new Set(activeRows.map(({ modality }) => modality.trainingCode)).size,
    qualifications: activeRows.length,
  };

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filteredRows = useMemo(
    () =>
      joinedRows.filter(({ qualification, modality, employee }) => {
        if (status === "active" && !qualification.active) return false;
        if (status === "inactive" && qualification.active) return false;
        if (trainingCode && modality.trainingCode !== trainingCode) return false;
        if (kind && !modality.kinds.includes(kind)) return false;
        if (employeeId && employee.recordId.toLowerCase() !== employeeId.toLowerCase()) return false;
        if (zone && employee.zona !== zone) return false;
        if (
          normalizedSearch &&
          !employee.nome.toLocaleLowerCase("pt-BR").includes(normalizedSearch) &&
          !(employee.nomePlaqueta || "").toLocaleLowerCase("pt-BR").includes(normalizedSearch) &&
          !modality.name.toLocaleLowerCase("pt-BR").includes(normalizedSearch) &&
          !modality.trainingCode.toLocaleLowerCase("pt-BR").includes(normalizedSearch)
        ) return false;
        return true;
      }),
    [employeeId, joinedRows, kind, normalizedSearch, status, trainingCode, zone],
  );

  const modalityGroups = useMemo(() => {
    const groups = new Map<string, QualificationView[]>();
    for (const row of filteredRows) {
      const key = row.modality.id.toLowerCase();
      groups.set(key, [...(groups.get(key) || []), row]);
    }
    return [...groups.values()].sort((left, right) =>
      `${left[0].modality.trainingCode} ${left[0].modality.name}`.localeCompare(
        `${right[0].modality.trainingCode} ${right[0].modality.name}`,
        "pt-BR",
      ),
    );
  }, [filteredRows]);

  const instructorGroups = useMemo(() => {
    const groups = new Map<string, QualificationView[]>();
    for (const row of filteredRows) {
      const key = row.employee.recordId.toLowerCase();
      groups.set(key, [...(groups.get(key) || []), row]);
    }
    return [...groups.values()].sort((left, right) =>
      left[0].employee.nome.localeCompare(right[0].employee.nome, "pt-BR"),
    );
  }, [filteredRows]);

  const trainingCodes = [...new Set((data?.modalities || []).map((item) => item.trainingCode))]
    .sort((left, right) => left.localeCompare(right, "pt-BR", { numeric: true }));
  const zones = [...new Set(employees.map((employee) => employee.zona).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "pt-BR"));
  const sortedEmployees = [...employees]
    .filter((employee) => employee.statusFuncionario !== "Encerrado")
    .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"));
  const activeFilterCount =
    Number(Boolean(trainingCode)) +
    Number(Boolean(kind)) +
    Number(Boolean(employeeId)) +
    Number(Boolean(zone)) +
    Number(status !== "active");
  const cards: { label: string; count: number; Icon: LucideIcon; color: string; background: string }[] = [
    { label: "Instrutores habilitados", count: stats.instructors, Icon: UsersRound, color: "text-yinmn", background: "bg-sky-50" },
    { label: "Modalidades cobertas", count: stats.modalities, Icon: BookOpenCheck, color: "text-emerald-700", background: "bg-emerald-50" },
    { label: "Treinamentos cobertos", count: stats.trainings, Icon: GraduationCap, color: "text-violet-700", background: "bg-violet-50" },
    { label: "Habilitações ativas", count: stats.qualifications, Icon: LayoutGrid, color: "text-amber-700", background: "bg-amber-50" },
  ];

  const clearFilters = () => {
    setTrainingCode("");
    setKind("");
    setEmployeeId("");
    setZone("");
    setStatus("active");
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-yinmn">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-oxford">Distritos</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Consulte e gerencie quais instrutores estão habilitados para cada treinamento e modalidade de ensino.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <button type="button" onClick={() => setManagerEmployeeId("")} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-yinmn px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-cadet disabled:opacity-50">
            <GraduationCap className="h-4 w-4" /> Atribuir
          </button>
          <button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Atualizar distritos" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(({ label, count, Icon, color, background }) => (
          <div key={label} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${background}`}><Icon className={`h-5 w-5 ${color}`} /></span>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none text-oxford">{count}</p>
              <p className="mt-1 truncate text-xs font-medium text-slate-500" title={label}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <label className="relative block min-w-0 flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input className={`${inputClass} mt-0 pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Pesquisar habilitações de ensino" placeholder="Pesquisar instrutor, treinamento ou modalidade" />
          </label>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button type="button" onClick={() => setView("modality")} className={`rounded-lg px-3 py-2 text-xs font-bold ${view === "modality" ? "bg-white text-yinmn shadow-sm" : "text-slate-500"}`}>Por modalidade</button>
            <button type="button" onClick={() => setView("instructor")} className={`rounded-lg px-3 py-2 text-xs font-bold ${view === "instructor" ? "bg-white text-yinmn shadow-sm" : "text-slate-500"}`}>Por instrutor</button>
          </div>
          <button type="button" onClick={() => setFiltersExpanded((expanded) => !expanded)} className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${activeFilterCount ? "border-sky-200 bg-sky-50 text-yinmn" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            <SlidersHorizontal className="h-4 w-4" /> Filtros
            {activeFilterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-yinmn px-1 text-[10px] text-white">{activeFilterCount}</span>}
          </button>
        </div>
        <div hidden={!filtersExpanded} className="border-t border-slate-100 bg-slate-50/60 p-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="text-xs font-bold text-slate-600">Treinamento
              <select className={inputClass} value={trainingCode} onChange={(event) => setTrainingCode(event.target.value)}>
                <option value="">Todos os treinamentos</option>
                {trainingCodes.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">Modalidade
              <select className={inputClass} value={kind} onChange={(event) => setKind(event.target.value as TeachingModalityKind | "")}>
                <option value="">Todas as modalidades</option>
                <option value="Idioma">Idioma</option>
                <option value="Doutrina">Doutrina</option>
                <option value="Sem subdivisão">Sem subdivisão</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">Instrutor
              <select className={inputClass} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                <option value="">Todos os instrutores</option>
                {sortedEmployees.map((employee) => <option key={employee.recordId} value={employee.recordId}>{employee.nome}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">Zona
              <select className={inputClass} value={zone} onChange={(event) => setZone(event.target.value)}>
                <option value="">Todas as zonas</option>
                {zones.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">Situação
              <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as TeachingStatusFilter)}>
                <option value="active">Habilitações ativas</option>
                <option value="inactive">Habilitações inativas</option>
                <option value="all">Todas</option>
              </select>
            </label>
          </div>
          {activeFilterCount > 0 && (
            <div className="mt-3 border-t border-slate-200 pt-3 text-right">
              <button type="button" onClick={clearFilters} className="text-xs font-bold text-slate-500 hover:text-rose-700">Limpar filtros</button>
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-bold text-oxford">{view === "modality" ? "Instrutores por modalidade" : "Modalidades por instrutor"}</h2>
        <p className="text-xs text-slate-500">{filteredRows.length} {filteredRows.length === 1 ? "habilitação" : "habilitações"}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-10 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando do Dataverse...</div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <GraduationCap className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-600">Nenhuma habilitação corresponde aos filtros.</p>
          <p className="mt-1 text-xs text-slate-500">Cadastre uma combinação de instrutor e modalidade ou ajuste os filtros.</p>
        </div>
      ) : view === "modality" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {modalityGroups.map((rows) => {
            const modality = rows[0].modality;
            return (
              <section key={modality.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <header className="border-b border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-yinmn">{modality.trainingCode}</p>
                      <h3 className="mt-1 text-base font-bold text-oxford">{modality.name}</h3>
                    </div>
                    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-yinmn">{rows.length} {rows.length === 1 ? "instrutor" : "instrutores"}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(modality.kinds.length ? modality.kinds : ["Sem subdivisão"]).map((item) => <span key={item} className="rounded-lg bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">{item}</span>)}
                  </div>
                </header>
                <div className="divide-y divide-slate-100">
                  {rows.sort((left, right) => left.employee.nome.localeCompare(right.employee.nome, "pt-BR")).map(({ qualification, employee }) => (
                    <div key={qualification.id} className="flex items-center justify-between gap-3 p-4">
                      <button type="button" onClick={() => onSelectEmployee(employee)} className="flex min-w-0 items-center gap-3 text-left">
                        <FuncionarioAvatar funcionarioId={employee.recordId} nome={employee.nomePlaqueta || employee.nome} size="card" fotoUrl={employee.fotoUrl} fotoTimestamp={employee.fotoTimestamp} />
                        <span className="min-w-0">
                          <strong className="block truncate text-sm text-oxford">{employee.nome}</strong>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{employee.zona || "Zona não informada"}</span>
                        </span>
                      </button>
                      <button type="button" onClick={() => setManagerEmployeeId(employee.recordId)} className="shrink-0 rounded-lg bg-sky-50 px-2.5 py-2 text-xs font-bold text-yinmn hover:bg-sky-100">Configurar</button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="divide-y divide-slate-100">
            {instructorGroups.map((rows) => {
              const employee = rows[0].employee;
              return (
                <div key={employee.recordId} className="grid gap-4 p-4 lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.6fr)_auto] lg:items-center">
                  <button type="button" onClick={() => onSelectEmployee(employee)} className="flex min-w-0 items-center gap-3 text-left">
                    <FuncionarioAvatar funcionarioId={employee.recordId} nome={employee.nomePlaqueta || employee.nome} size="card" fotoUrl={employee.fotoUrl} fotoTimestamp={employee.fotoTimestamp} />
                    <span className="min-w-0">
                      <strong className="block truncate text-sm text-oxford">{employee.nome}</strong>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{employee.cargo || "Cargo não informado"} · {employee.zona || "Zona não informada"}</span>
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {rows.sort((left, right) => `${left.modality.trainingCode} ${left.modality.name}`.localeCompare(`${right.modality.trainingCode} ${right.modality.name}`, "pt-BR")).map(({ qualification, modality }) => (
                      <span key={qualification.id} className="rounded-lg border border-sky-100 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-yinmn">
                        {modality.trainingCode} — {modality.name}
                      </span>
                    ))}
                  </div>
                  <button type="button" onClick={() => setManagerEmployeeId(employee.recordId)} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs font-bold text-yinmn hover:bg-sky-100">
                    <UserRound className="h-3.5 w-3.5" /> Configurar
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {managerEmployeeId !== null && (
        <TeachingQualificationPanel
          employees={employees}
          initialEmployeeId={managerEmployeeId}
          onClose={() => setManagerEmployeeId(null)}
          onChanged={setData}
        />
      )}
    </div>
  );
}
