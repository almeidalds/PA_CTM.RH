/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { AlertTriangle, Edit3, FileCheck2, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { DataIssueSeverity, RhEmployee } from "../types/rh";
import { identificarPendencias } from "../utils/riskUtils";
import { DataIssueBadge } from "../components/DataIssueBadge";

interface PendingPageProps {
  employees: RhEmployee[];
  onEditEmployee: (emp: RhEmployee) => void;
}

export const PendingPage: React.FC<PendingPageProps> = ({ employees, onEditEmployee }) => {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<DataIssueSeverity | "Todas">("Todas");

  const employeesWithIssues = useMemo(() => {
    const severityWeight: Record<DataIssueSeverity, number> = {
      "Crítica": 4,
      "Alta": 3,
      "Média": 2,
      "Baixa": 1,
    };

    return employees
      .map((employee) => ({
        ...employee,
        issues: identificarPendencias(employee),
      }))
      .filter((employee) => employee.issues.length > 0)
      .sort((a, b) => {
        const maxA = Math.max(...a.issues.map((issue) => severityWeight[issue.severity]), 0);
        const maxB = Math.max(...b.issues.map((issue) => severityWeight[issue.severity]), 0);
        return maxB - maxA || a.nome.localeCompare(b.nome);
      });
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");

    return employeesWithIssues.filter((employee) => {
      const matchesSearch = !normalizedSearch || [
        employee.nome,
        employee.idFuncionario,
        employee.cargo,
        ...employee.issues.map((issue) => issue.label),
      ].some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedSearch));
      const matchesSeverity = severityFilter === "Todas"
        || employee.issues.some((issue) => issue.severity === severityFilter);

      return matchesSearch && matchesSeverity;
    });
  }, [employeesWithIssues, search, severityFilter]);

  const getMaxSeverity = (issues: { severity: DataIssueSeverity }[]): DataIssueSeverity => {
    const severityOrder: DataIssueSeverity[] = ["Crítica", "Alta", "Média", "Baixa"];
    return severityOrder.find((severity) => issues.some((issue) => issue.severity === severity)) ?? "Baixa";
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2.5 text-lg font-bold text-oxford sm:text-xl">
          <FileCheck2 className="w-5 h-5 text-yinmn" />
          <span>Pendências Cadastrais</span>
          </h2>
          <p className="mt-1 text-sm text-slate-500">Revise os dados faltantes e corrija os cadastros diretamente.</p>
        </div>
      </header>

      <section aria-label="Registros pendentes de correção" className="overflow-hidden rounded-[22px] border border-sky-100 bg-white shadow-[0_12px_30px_rgba(0,48,87,0.06)]">
        <div className="flex flex-col gap-4 border-b border-sky-100 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-oxford">Registros para revisar</h3>
              <p className="mt-1 text-xs text-slate-500">Prioridade por gravidade. Edite um cadastro para corrigir as informações.</p>
            </div>
            <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-yinmn">
              {filteredEmployees.length} de {employeesWithIssues.length} registros
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative block">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, ID, cargo ou pendência"
                aria-label="Buscar registros pendentes"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-oxford outline-none transition focus:border-yinmn focus:ring-2 focus:ring-yinmn/15"
              />
            </label>
            <label className="relative flex items-center">
              <SlidersHorizontal aria-hidden="true" className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
              <select
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value as DataIssueSeverity | "Todas")}
                aria-label="Filtrar por gravidade"
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-yinmn focus:ring-2 focus:ring-yinmn/15"
              >
                <option value="Todas">Todas as gravidades</option>
                <option value="Crítica">Crítica</option>
                <option value="Alta">Alta</option>
                <option value="Média">Média</option>
                <option value="Baixa">Baixa</option>
              </select>
            </label>
          </div>
        </div>

        {filteredEmployees.length > 0 ? (
          <ul className="divide-y divide-sky-100">
            {filteredEmployees.map((employee) => (
              <li key={employee.recordId} className="flex flex-col gap-4 p-5 transition-colors hover:bg-sky-50/30 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-oxford">{employee.nome}</h4>
                    <DataIssueBadge severity={getMaxSeverity(employee.issues)} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {[employee.idFuncionario && `ID ${employee.idFuncionario}`, employee.cargo].filter(Boolean).join(" · ") || "Dados de identificação ausentes"}
                  </p>
                  <ul aria-label="Pendências do cadastro" className="mt-3 flex flex-wrap gap-2">
                    {employee.issues.map((issue) => (
                      <li key={issue.field} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900">
                        <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                        {issue.label}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => onEditEmployee(employee)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-yinmn px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-cadet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yinmn focus-visible:ring-offset-2"
                >
                  <Edit3 aria-hidden="true" className="h-4 w-4" />
                  Corrigir cadastro
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-12 text-center sm:px-6">
            {employeesWithIssues.length === 0 ? (
              <>
                <ShieldCheck aria-hidden="true" className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
                <h4 className="font-bold text-oxford">Nenhuma pendência encontrada</h4>
                <p className="mt-1 text-sm text-slate-500">Todos os cadastros estão com os dados obrigatórios preenchidos.</p>
              </>
            ) : (
              <>
                <Search aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                <h4 className="font-bold text-oxford">Nenhum registro corresponde aos filtros</h4>
                <p className="mt-1 text-sm text-slate-500">Tente outro termo ou selecione uma gravidade diferente.</p>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
