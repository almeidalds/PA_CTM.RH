import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  BookOpenCheck,
  Languages,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";
import type { RhEmployee } from "../types/rh";
import type {
  TranslationActivityFilter,
  TranslationCapability,
  TranslationData,
  TranslationStatusFilter,
} from "../types/translation";
import {
  loadTranslationData,
  TRANSLATION_DATA_CHANGED_EVENT,
} from "../services/translationCapabilitiesDataSource";
import FuncionarioAvatar from "../components/FuncionarioAvatar";
import { TranslationManagementPanel } from "../components/TranslationManagementPanel";

interface TranslationsPageProps {
  employees: RhEmployee[];
  onSelectEmployee: (employee: RhEmployee) => void;
}

interface EmployeeTranslationGroup {
  employee: RhEmployee;
  capabilities: TranslationCapability[];
}

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-oxford outline-none transition focus:border-yinmn focus:ring-2 focus:ring-yinmn/10";

function uniqueNames(capabilities: TranslationCapability[], predicate?: (capability: TranslationCapability) => boolean) {
  return [...new Set(capabilities.filter((capability) => !predicate || predicate(capability)).map((capability) => capability.languageName))]
    .sort((left, right) => left.localeCompare(right, "pt-BR"));
}

export function TranslationsPage({ employees, onSelectEmployee }: TranslationsPageProps) {
  const [data, setData] = useState<TranslationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [languageId, setLanguageId] = useState("");
  const [activity, setActivity] = useState<TranslationActivityFilter>("all");
  const [zone, setZone] = useState("");
  const [status, setStatus] = useState<TranslationStatusFilter>("active");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [managerEmployeeId, setManagerEmployeeId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loadTranslationData());
    } catch (refreshError) {
      console.error("Falha ao carregar a página de traduções:", refreshError);
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Não foi possível carregar as habilitações de tradução.",
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
      setData((event as CustomEvent<TranslationData>).detail);
    };
    window.addEventListener(TRANSLATION_DATA_CHANGED_EVENT, handleChanged);
    return () => window.removeEventListener(TRANSLATION_DATA_CHANGED_EVENT, handleChanged);
  }, []);

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.recordId.toLowerCase(), employee])),
    [employees],
  );
  const activeCapabilities = (data?.capabilities || []).filter(
    (capability) => capability.active && (capability.workshops || capability.devotionals),
  );
  const stats = {
    enabled: new Set(activeCapabilities.map((capability) => capability.employeeId.toLowerCase())).size,
    workshops: new Set(activeCapabilities.filter((capability) => capability.workshops).map((capability) => capability.employeeId.toLowerCase())).size,
    devotionals: new Set(activeCapabilities.filter((capability) => capability.devotionals).map((capability) => capability.employeeId.toLowerCase())).size,
    languages: new Set(activeCapabilities.map((capability) => capability.languageId || capability.languageName)).size,
  };

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const groups = useMemo(() => {
    const scopedCapabilities = (data?.capabilities || []).filter((capability) => {
      if (status === "active" && !capability.active) return false;
      if (status === "inactive" && capability.active) return false;
      if (languageId && capability.languageId !== languageId) return false;
      return true;
    });
    const byEmployee = new Map<string, TranslationCapability[]>();
    for (const capability of scopedCapabilities) {
      const key = capability.employeeId.toLowerCase();
      const current = byEmployee.get(key) || [];
      current.push(capability);
      byEmployee.set(key, current);
    }

    const result: EmployeeTranslationGroup[] = [];
    for (const [employeeId, capabilities] of byEmployee) {
      const employee = employeeById.get(employeeId);
      if (!employee) continue;
      if (zone && employee.zona !== zone) continue;
      if (
        normalizedSearch &&
        !employee.nome.toLocaleLowerCase("pt-BR").includes(normalizedSearch) &&
        !(employee.nomePlaqueta || "").toLocaleLowerCase("pt-BR").includes(normalizedSearch)
      ) continue;

      const hasWorkshop = capabilities.some((capability) => capability.workshops);
      const hasDevotional = capabilities.some((capability) => capability.devotionals);
      if (activity === "workshops" && !hasWorkshop) continue;
      if (activity === "devotionals" && !hasDevotional) continue;
      if (activity === "both" && (!hasWorkshop || !hasDevotional)) continue;

      const visibleCapabilities = activity === "workshops"
        ? capabilities.filter((capability) => capability.workshops)
        : activity === "devotionals"
          ? capabilities.filter((capability) => capability.devotionals)
          : capabilities;
      result.push({ employee, capabilities: visibleCapabilities });
    }
    return result.sort((left, right) => left.employee.nome.localeCompare(right.employee.nome, "pt-BR"));
  }, [activity, data, employeeById, languageId, normalizedSearch, status, zone]);

  const zones = [...new Set(employees.map((employee) => employee.zona).filter(Boolean))].sort((left, right) => left.localeCompare(right, "pt-BR"));
  const languages = (data?.languages || []).filter((language) => language.active).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  const activeFilterCount = Number(Boolean(languageId)) + Number(activity !== "all") + Number(Boolean(zone)) + Number(status !== "active");
  const cards: { label: string; count: number; Icon: LucideIcon; color: string; background: string }[] = [
    { label: "Tradutores Habilitados", count: stats.enabled, Icon: UsersRound, color: "text-yinmn", background: "bg-sky-50" },
    { label: "Tradutores de Workshops", count: stats.workshops, Icon: BookOpenCheck, color: "text-emerald-700", background: "bg-emerald-50" },
    { label: "Tradutores de Devocionais", count: stats.devotionals, Icon: MessageSquareText, color: "text-violet-700", background: "bg-violet-50" },
    { label: "Idiomas Disponíveis", count: stats.languages, Icon: Languages, color: "text-amber-700", background: "bg-amber-50" },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-yinmn">
            <Languages className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-oxford">Traduções</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Gerencie os funcionários habilitados para traduzir workshops e devocionais, seus idiomas e sua disponibilidade.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <button type="button" onClick={() => setManagerEmployeeId("")} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-yinmn px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-cadet disabled:opacity-50">
            <Languages className="h-4 w-4" /> Novo tradutor
          </button>
          <button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Atualizar traduções" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
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
            <input className={`${inputClass} mt-0 pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Pesquisar tradutores" placeholder="Pesquisar por nome completo ou nome da plaqueta" />
          </label>
          <button type="button" onClick={() => setFiltersExpanded((expanded) => !expanded)} className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${activeFilterCount ? "border-sky-200 bg-sky-50 text-yinmn" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            <SlidersHorizontal className="h-4 w-4" /> Filtros
            {activeFilterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-yinmn px-1 text-[10px] text-white">{activeFilterCount}</span>}
          </button>
        </div>
        <div hidden={!filtersExpanded} className="border-t border-slate-100 bg-slate-50/60 p-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-bold text-slate-600">Idioma
              <select className={inputClass} value={languageId} onChange={(event) => setLanguageId(event.target.value)}>
                <option value="">Todos os idiomas</option>
                {languages.map((language) => <option key={language.id} value={language.id}>{language.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">Atividade
              <select className={inputClass} value={activity} onChange={(event) => setActivity(event.target.value as TranslationActivityFilter)}>
                <option value="all">Todas as atividades</option>
                <option value="workshops">Workshops</option>
                <option value="devotionals">Devocionais</option>
                <option value="both">Workshops e Devocionais</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">Zona
              <select className={inputClass} value={zone} onChange={(event) => setZone(event.target.value)}>
                <option value="">Todas as zonas</option>
                {zones.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">Situação
              <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as TranslationStatusFilter)}>
                <option value="active">Habilitações ativas</option>
                <option value="inactive">Habilitações inativas</option>
                <option value="all">Todas</option>
              </select>
            </label>
          </div>
          {activeFilterCount > 0 && (
            <div className="mt-3 border-t border-slate-200 pt-3 text-right">
              <button type="button" onClick={() => { setLanguageId(""); setActivity("all"); setZone(""); setStatus("active"); }} className="text-xs font-bold text-slate-500 hover:text-rose-700">Limpar filtros</button>
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-bold text-oxford">Funcionários habilitados</h2>
        <p className="text-xs text-slate-500">{groups.length} {groups.length === 1 ? "funcionário" : "funcionários"}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-10 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando do Dataverse...</div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <Languages className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-600">Nenhum tradutor corresponde aos filtros.</p>
          <p className="mt-1 text-xs text-slate-500">Cadastre uma habilitação explícita para disponibilizar um funcionário.</p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Funcionário</th>
                  <th className="px-4 py-3">Cargo / Zona</th>
                  <th className="px-4 py-3">Idiomas</th>
                  <th className="px-4 py-3">Workshops</th>
                  <th className="px-4 py-3">Devocionais</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groups.map(({ employee, capabilities }) => {
                  const allLanguages = uniqueNames(capabilities);
                  const workshopLanguages = uniqueNames(capabilities, (capability) => capability.workshops);
                  const devotionalLanguages = uniqueNames(capabilities, (capability) => capability.devotionals);
                  return (
                    <tr key={employee.recordId} className="align-top transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <FuncionarioAvatar
                            funcionarioId={employee.recordId}
                            nome={employee.nomePlaqueta || employee.nome}
                            size="card"
                            fotoUrl={employee.fotoUrl}
                            fotoTimestamp={employee.fotoTimestamp}
                          />
                          <div className="min-w-0">
                            <strong className="block max-w-56 truncate text-sm text-oxford">{employee.nome}</strong>
                            <span className="mt-0.5 block max-w-56 truncate text-xs text-slate-500">Plaqueta: {employee.nomePlaqueta || "Não informada"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-600">
                        <span className="block font-semibold text-slate-700">{employee.cargo || "Cargo não informado"}</span>
                        <span className="mt-1 block">{employee.zona || "Zona não informada"}</span>
                      </td>
                      <td className="px-4 py-4"><div className="flex max-w-60 flex-wrap gap-1.5">{allLanguages.map((name) => <span key={name} className="rounded-lg bg-sky-50 px-2 py-1 text-[11px] font-semibold text-yinmn">{name}</span>)}</div></td>
                      <td className="px-4 py-4 text-xs text-slate-600">{workshopLanguages.length ? workshopLanguages.join(", ") : "—"}</td>
                      <td className="px-4 py-4 text-xs text-slate-600">{devotionalLanguages.length ? devotionalLanguages.join(", ") : "—"}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => onSelectEmployee(employee)} className="rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Ver perfil</button>
                          <button type="button" onClick={() => setManagerEmployeeId(employee.recordId)} className="rounded-lg bg-sky-50 px-2.5 py-2 text-xs font-bold text-yinmn hover:bg-sky-100">Configurar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {managerEmployeeId !== null && (
        <TranslationManagementPanel
          employees={employees}
          initialEmployeeId={managerEmployeeId}
          onClose={() => setManagerEmployeeId(null)}
          onChanged={setData}
        />
      )}
    </div>
  );
}
