/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Clock3,
  Search,
  UsersRound,
} from "lucide-react";
import type { AppSettings, RhEmployee } from "../types/rh";
import { formatarDataBR } from "../utils/dateUtils";
import { calcularStatusFerias } from "../utils/vacationUtils";
import { VacationDetailsPanel } from "../components/VacationDetailsPanel";

interface VacationsPageProps {
  appSettings: AppSettings;
  employees: RhEmployee[];
  onConfigureVacation: (employee: RhEmployee) => void;
}

type StatusFilter = "all" | "attention" | "scheduled" | "ongoing";

const vacationStatus = {
  eligible: "Apto para f\u00e9rias",
  critical: "F\u00e9rias cr\u00edticas",
  scheduled: "F\u00e9rias marcadas",
  ongoing: "F\u00e9rias em andamento",
  completed: "F\u00e9rias conclu\u00eddas",
  partiallySold: "F\u00e9rias parcialmente vendidas",
};

const statusTone = (status: string): string => {
  if (status === vacationStatus.critical) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === vacationStatus.eligible) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === vacationStatus.ongoing) {
    return "border-sky-200 bg-sky-50 text-yinmn";
  }
  if (status === vacationStatus.completed) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
};

export const VacationsPage: React.FC<VacationsPageProps> = ({
  appSettings,
  employees,
  onConfigureVacation,
}) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [zoneFilter, setZoneFilter] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.recordId === selectedEmployeeId) || null,
    [employees, selectedEmployeeId],
  );

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.statusFuncionario === "Ativo"),
    [employees],
  );

  const stats = useMemo(() => {
    let attention = 0;
    let scheduled = 0;
    let ongoing = 0;

    activeEmployees.forEach((employee) => {
      const status = calcularStatusFerias(employee);
      if (status === vacationStatus.eligible || status === vacationStatus.critical) {
        attention += 1;
      }
      if (status === vacationStatus.scheduled || status === vacationStatus.partiallySold) {
        scheduled += 1;
      }
      if (status === vacationStatus.ongoing) ongoing += 1;
    });

    return { attention, scheduled, ongoing };
  }, [activeEmployees]);

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");

    return activeEmployees.filter((employee) => {
      const status = calcularStatusFerias(employee);
      const matchesSearch = !normalizedSearch || [
        employee.nome,
        employee.idFuncionario,
        employee.cargo,
      ].some((value) => value?.toLocaleLowerCase("pt-BR").includes(normalizedSearch));

      if (!matchesSearch || (zoneFilter && employee.zona !== zoneFilter)) return false;
      if (statusFilter === "attention") {
        return status === vacationStatus.eligible || status === vacationStatus.critical;
      }
      if (statusFilter === "scheduled") {
        return status === vacationStatus.scheduled || status === vacationStatus.partiallySold;
      }
      if (statusFilter === "ongoing") return status === vacationStatus.ongoing;
      return true;
    });
  }, [activeEmployees, search, statusFilter, zoneFilter]);

  const selectStatus = (status: StatusFilter) => {
    setStatusFilter((current) => current === status ? "all" : status);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[22px] border border-sky-100 bg-gradient-to-br from-slate-100 to-white p-5 shadow-[0_12px_30px_rgba(0,48,87,0.06)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-yinmn">
              {"Escalas e aus\u00eancias"}
            </p>
            <h1 className="text-xl font-extrabold tracking-tight text-oxford">
              {"F\u00e9rias e aus\u00eancias"}
            </h1>
            <p className="mt-1 max-w-2xl text-xs font-medium leading-relaxed text-slate-500">
              {"Consulte os per\u00edodos da equipe. Para incluir ou alterar datas, abra a ficha do colaborador."}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-sky-100 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-600">
            <UsersRound className="h-4 w-4 text-yinmn" />
            <span>{activeEmployees.length} colaboradores ativos</span>
          </div>
        </div>
      </section>

      <section aria-label="Resumo de ferias" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => selectStatus("attention")}
          className={`rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 ${
            statusFilter === "attention"
              ? "border-amber-300 bg-amber-50 ring-2 ring-amber-100"
              : "border-amber-100 bg-amber-50/70 hover:border-amber-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
              {"Precisam de aten\u00e7\u00e3o"}
            </span>
            <CircleAlert className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-oxford">{stats.attention}</p>
        </button>

        <button
          type="button"
          onClick={() => selectStatus("scheduled")}
          className={`rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 ${
            statusFilter === "scheduled"
              ? "border-sky-300 bg-sky-50 ring-2 ring-sky-100"
              : "border-sky-100 bg-sky-50/70 hover:border-sky-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-yinmn">Programadas</span>
            <CalendarDays className="h-4 w-4 text-yinmn" />
          </div>
          <p className="mt-2 text-2xl font-black text-oxford">{stats.scheduled}</p>
        </button>

        <button
          type="button"
          onClick={() => selectStatus("ongoing")}
          className={`rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 ${
            statusFilter === "ongoing"
              ? "border-emerald-300 bg-emerald-50 ring-2 ring-emerald-100"
              : "border-emerald-100 bg-emerald-50/70 hover:border-emerald-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Em andamento</span>
            <Clock3 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-oxford">{stats.ongoing}</p>
        </button>
      </section>

      <section className="overflow-hidden rounded-[22px] border border-sky-100 bg-white shadow-[0_12px_30px_rgba(0,48,87,0.05)]">
        <div className="flex flex-col gap-3 border-b border-sky-100 p-4 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Buscar colaborador</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, ID ou cargo..."
              className="w-full rounded-xl border border-sky-100 py-2.5 pl-9 pr-3 text-xs font-semibold text-oxford outline-none transition focus:border-jordy focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="rounded-xl border border-sky-100 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 outline-none focus:border-jordy"
            aria-label={"Filtrar por situa\u00e7\u00e3o de f\u00e9rias"}
          >
            <option value="all">{"Todas as situa\u00e7\u00f5es"}</option>
            <option value="attention">{"Precisam de aten\u00e7\u00e3o"}</option>
            <option value="scheduled">Programadas</option>
            <option value="ongoing">Em andamento</option>
          </select>
          <select
            value={zoneFilter}
            onChange={(event) => setZoneFilter(event.target.value)}
            className="rounded-xl border border-sky-100 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 outline-none focus:border-jordy"
            aria-label="Filtrar por zona"
          >
            <option value="">Todas as zonas</option>
            {appSettings.zonas.map((zone) => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>
        </div>

        <div
          className="max-h-[480px] overflow-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-jordy"
          style={{ scrollbarGutter: "stable" }}
          tabIndex={0}
          aria-label="Lista rolavel de colaboradores"
        >
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-sky-50 shadow-[0_1px_0_rgba(186,230,253,0.9)]">
              <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3.5">Colaborador</th>
                <th className="px-4 py-3.5">Cargo e escala</th>
                <th className="px-4 py-3.5">{"Situa\u00e7\u00e3o"}</th>
                <th className="px-4 py-3.5">{"Per\u00edodo registrado"}</th>
                <th className="px-4 py-3.5 text-right">Ficha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100">
              {filteredEmployees.map((employee) => {
                const status = calcularStatusFerias(employee);
                const periods = [...(employee.periodosFerias || [])]
                  .sort((left, right) => left.dataInicio.localeCompare(right.dataInicio));
                const firstPeriod = periods[0];

                return (
                  <tr key={employee.recordId} className="text-xs transition-colors hover:bg-sky-50/50">
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => setSelectedEmployeeId(employee.recordId)}
                        className="text-left"
                      >
                        <span className="block font-extrabold text-oxford hover:text-yinmn">{employee.nome}</span>
                        <span className="mt-0.5 block font-mono text-[10px] font-semibold text-slate-400">
                          {employee.idFuncionario || "ID pendente"}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <span className="block font-bold text-oxford">{employee.cargo || "Cargo n\u00e3o informado"}</span>
                      <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">
                        {employee.zona || "Sem zona"} &middot; {employee.turno || "Sem turno"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusTone(status)}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {firstPeriod ? (
                        <div>
                          <span className="font-bold text-oxford">
                            {formatarDataBR(firstPeriod.dataInicio)} a {formatarDataBR(firstPeriod.dataFim)}
                          </span>
                          {periods.length > 1 && (
                            <span className="ml-2 text-[10px] font-bold text-yinmn">
                              +{periods.length - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="font-medium text-slate-400">{"Nenhum per\u00edodo"}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedEmployeeId(employee.recordId)}
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-100 bg-white px-3 py-2 text-[10px] font-bold text-yinmn transition hover:bg-sky-50"
                      >
                        Abrir ficha
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredEmployees.length === 0 && (
          <div className="p-10 text-center">
            <Search className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 text-xs font-bold text-slate-500">Nenhum colaborador encontrado.</p>
            <p className="mt-1 text-[10px] text-slate-400">Ajuste a busca ou os filtros.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sky-100 bg-sky-50/40 px-4 py-3 text-[10px] font-semibold text-slate-500">
          <span>Exibindo {filteredEmployees.length} de {activeEmployees.length} colaboradores ativos.</span>
          {filteredEmployees.length > 7 && (
            <span className="text-yinmn">Role dentro da lista para ver os demais.</span>
          )}
        </div>
      </section>

      <VacationDetailsPanel
        employee={selectedEmployee}
        onClose={() => setSelectedEmployeeId(null)}
        onConfigureVacation={(employee) => {
          setSelectedEmployeeId(null);
          onConfigureVacation(employee);
        }}
      />
    </div>
  );
};
