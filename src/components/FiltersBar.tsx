/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId, useState } from "react";
import { Search, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { EmployeeFilters, RhEmployee } from "../types/rh";
import { TURNOS_DISPONIVEIS } from "../constants/turnos";

interface FiltersBarProps {
  filters: EmployeeFilters;
  setFilters: React.Dispatch<React.SetStateAction<EmployeeFilters>>;
  allEmployees: RhEmployee[];
  onClear: () => void;
}

export const FiltersBar: React.FC<FiltersBarProps> = ({
  filters,
  setFilters,
  allEmployees,
  onClear
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();

  // Extrair opções únicas dinamicamente para manter os filtros sincronizados com o banco
  const cargos = Array.from(new Set(allEmployees.map((e) => e.cargo).filter(Boolean))).sort();
  const zonas = Array.from(new Set(allEmployees.map((e) => e.zona).filter(Boolean))).sort();
  
  // Extrair idiomas únicos de arrays de idiomas
  const idiomasSet = new Set<string>();
  allEmployees.forEach((emp) => {
    if (emp.idiomas) {
      emp.idiomas.forEach((lang) => {
        if (lang && lang.trim() !== "") {
          idiomasSet.add(lang.trim());
        }
      });
    }
  });
  const idiomas = Array.from(idiomasSet).sort();

  const handleFilterChange = (field: keyof EmployeeFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const activeFilterCount = [
    filters.search.trim(),
    filters.cargo,
    filters.zona,
    filters.turno,
    filters.idioma,
    filters.status,
    filters.risco,
    filters.pendencia !== "Qualquer" ? filters.pendencia : "",
    filters.periodoTermino !== "all" ? filters.periodoTermino : "",
  ].filter(Boolean).length;

  return (
    <div className="mb-6 overflow-hidden rounded-[20px] border border-sky-100 bg-white shadow-[0_10px_28px_rgba(0,48,87,0.07)]">
      <button
        type="button"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-sky-50/50 sm:px-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-yinmn">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-bold text-oxford">Pesquisa e filtros</span>
            <span className="mt-0.5 block truncate text-[10px] text-slate-400">
              {activeFilterCount > 0
                ? `${activeFilterCount} ${activeFilterCount === 1 ? "filtro aplicado" : "filtros aplicados"}`
                : "Busque por nome, cargo, região, status e outros critérios"}
            </span>
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {activeFilterCount > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-lg bg-yinmn px-1.5 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
          <span className="hidden text-[10px] font-semibold text-slate-400 sm:inline">
            {isExpanded ? "Recolher" : "Expandir"}
          </span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
        </span>
      </button>

      <div
        id={contentId}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-1 gap-4 border-t border-sky-100 px-4 pb-5 pt-5 sm:grid-cols-2 sm:px-5 md:grid-cols-3 lg:grid-cols-4">
        {/* Busca por Nome ou ID */}
        <div className="relative">
          <label className="block text-xs font-bold text-slate-400 mb-1">Nome ou ID do Funcionário</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Ex: Carlos Augusto ou CTM-2024..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2.5 rounded-lg border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn text-oxford placeholder-slate-400 font-medium"
            />
          </div>
        </div>

        {/* Cargo */}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">Cargo</label>
          <select
            value={filters.cargo}
            onChange={(e) => handleFilterChange("cargo", e.target.value)}
            className="w-full text-xs px-3 py-2.5 rounded-lg border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn bg-white text-oxford font-semibold"
          >
            <option value="">Todos os cargos</option>
            {cargos.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Zona */}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">Zona</label>
          <select
            value={filters.zona}
            onChange={(e) => handleFilterChange("zona", e.target.value)}
            className="w-full text-xs px-3 py-2.5 rounded-xl border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn bg-white text-oxford font-semibold"
          >
            <option value="">Todas as zonas</option>
            {zonas.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>

        {/* Turno */}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">Turno</label>
          <select
            value={filters.turno}
            onChange={(e) => handleFilterChange("turno", e.target.value)}
            className="w-full text-xs px-3 py-2.5 rounded-xl border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn bg-white text-oxford font-semibold"
          >
            <option value="">Todos os turnos</option>
            {TURNOS_DISPONIVEIS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Idioma */}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">Idioma</label>
          <select
            value={filters.idioma}
            onChange={(e) => handleFilterChange("idioma", e.target.value)}
            className="w-full text-xs px-3 py-2.5 rounded-xl border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn bg-white text-oxford font-semibold"
          >
            <option value="">Todos os idiomas</option>
            {idiomas.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">Status</label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange("status", e.target.value)}
            className="w-full text-xs px-3 py-2.5 rounded-xl border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn bg-white text-oxford font-semibold"
          >
            <option value="">Todos os status</option>
            <option value="Ativo">Ativo</option>
            <option value="A começar">A começar</option>
            <option value="Encerrado">Encerrado</option>
          </select>
        </div>

        {/* Nível de Risco */}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">Nível de risco</label>
          <select
            value={filters.risco}
            onChange={(e) => handleFilterChange("risco", e.target.value)}
            className="w-full text-xs px-3 py-2.5 rounded-xl border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn bg-white text-oxford font-semibold"
          >
            <option value="">Todos os riscos</option>
            <option value="Crítico">Crítico</option>
            <option value="Alto">Alto</option>
            <option value="Médio">Médio</option>
            <option value="Baixo">Baixo</option>
            <option value="Sem risco">Sem risco</option>
            <option value="Cadastro incompleto">Cadastro incompleto</option>
          </select>
        </div>

        {/* Qualidade dos Dados (Pendências) */}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">Integridade Cadastral</label>
          <select
            value={filters.pendencia}
            onChange={(e) => handleFilterChange("pendencia", e.target.value)}
            className="w-full text-xs px-3 py-2.5 rounded-xl border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn bg-white text-oxford font-semibold"
          >
            <option value="Qualquer">Qualquer situação</option>
            <option value="Com Pendência">Com pendências de dados</option>
            <option value="Sem Pendência">Sem pendências (Completo)</option>
          </select>
        </div>

        {/* Período de Término */}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">Término do Contrato em...</label>
          <select
            value={filters.periodoTermino}
            onChange={(e) => handleFilterChange("periodoTermino", e.target.value)}
            className="w-full text-xs px-3 py-2.5 rounded-xl border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn bg-white text-oxford font-semibold"
          >
            <option value="all">Qualquer período</option>
            <option value="30">Próximos 30 dias</option>
            <option value="60">Próximos 60 dias</option>
            <option value="90">Próximos 90 dias</option>
            <option value="180">Próximos 180 dias</option>
          </select>
        </div>

        {/* Botão de limpar */}
        <div className="flex items-end">
          <button
            onClick={onClear}
            className="w-full text-xs bg-slate-50 hover:bg-sky-50 text-slate-500 hover:text-yinmn font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98] h-9.5 border border-sky-100"
          >
            <X className="w-4 h-4" />
            <span>Limpar Filtros</span>
          </button>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
};
