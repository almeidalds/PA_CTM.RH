/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  CalendarDays,
  FileText,
  MessageSquareText,
  Search,
  X
} from "lucide-react";
import { RhEmployee, ContractRenewal, ContractRenewalStatus } from "../types/rh";
import { formatarDataBR, calcularDiasRestantes } from "../utils/dateUtils";
import { obterContratos } from "../services/additionalDataSource";

interface ContractsPageProps {
  employees: RhEmployee[];
  onUpdateEmployee: (emp: RhEmployee) => void;
  onSelectEmployee: (emp: RhEmployee) => void;
  defaultSearch?: string;
  onClearDefaultSearch?: () => void;
}

type DeadlineFilter = "all" | "expired" | "30days" | "31to90" | "missing";

const renewalStatusOptions: ContractRenewalStatus[] = [
  "Não iniciado",
  "Em análise",
  "Aguardando coordenação",
  "Aguardando aprovação",
  "Renovado",
  "Não renovar",
  "Encerrado",
  "Urgente",
];

export const ContractsPage: React.FC<ContractsPageProps> = ({
  employees,
  onUpdateEmployee,
  onSelectEmployee,
  defaultSearch,
  onClearDefaultSearch
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [deadlineFilter, setDeadlineFilter] =
    useState<DeadlineFilter>("all");
  
  // Modal / form states for adding observations
  const [editingContract, setEditingContract] = useState<ContractRenewal | null>(null);
  const [obsText, setObsText] = useState("");
  const [decisionLimit, setDecisionLimit] = useState("");
  const [analystName, setAnalystName] = useState("");

  useEffect(() => {
    if (defaultSearch !== undefined) {
      setSearchTerm(defaultSearch);
    }
  }, [defaultSearch]);

  const contratos = obterContratos(employees);

  const handleUpdateStatus = (c: ContractRenewal, newStatus: ContractRenewalStatus) => {
    // Achar o funcionário correspondente
    const emp = employees.find((e) => e.recordId === c.recordId);
    if (!emp) return;

    // Criar uma cópia com os dados atualizados de contrato
    const updated: RhEmployee = {
      ...emp,
      statusRenovacao: newStatus,
      responsavelAnalise: c.responsavelAnalise || "RH Coordenação",
      dataLimiteDecisao: c.dataLimiteDecisao || new Date().toISOString().split("T")[0]
    };

    onUpdateEmployee(updated);
  };

  const handleSaveNotes = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContract) return;

    const emp = employees.find((e) => e.recordId === editingContract.recordId);
    if (!emp) return;

    const updated: RhEmployee = {
      ...emp,
      observacoesContrato: obsText,
      responsavelAnalise: analystName || "RH Analista",
      dataLimiteDecisao: decisionLimit || editingContract.dataLimiteDecisao
    };

    onUpdateEmployee(updated);
    setEditingContract(null);
    setObsText("");
  };

  const handleOpenEditModal = (c: ContractRenewal) => {
    setEditingContract(c);
    setObsText(c.observacoes || "");
    setDecisionLimit(c.dataLimiteDecisao || "");
    setAnalystName(c.responsavelAnalise || "");
  };

  const totalVencidos = contratos.filter(
    (contract) =>
      contract.dataTerminoReal &&
      contract.diasRestantes !== null &&
      contract.diasRestantes < 0,
  ).length;
  const totalProximos30Dias = contratos.filter(
    (contract) =>
      contract.dataTerminoReal &&
      contract.diasRestantes !== null &&
      contract.diasRestantes >= 0 &&
      contract.diasRestantes <= 30,
  ).length;
  const totalSemData = contratos.filter(
    (contract) => !contract.dataTerminoReal,
  ).length;

  const filters: { id: DeadlineFilter; label: string; count: number }[] = [
    { id: "all", label: "Todos", count: contratos.length },
    { id: "expired", label: "Vencidos", count: totalVencidos },
    { id: "30days", label: "Até 30 dias", count: totalProximos30Dias },
    {
      id: "31to90",
      label: "31 a 90 dias",
      count: contratos.filter(
        (contract) =>
          contract.dataTerminoReal &&
          contract.diasRestantes !== null &&
          contract.diasRestantes > 30 &&
          contract.diasRestantes <= 90,
      ).length,
    },
    { id: "missing", label: "Sem data", count: totalSemData },
  ];

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("pt-BR");
  const filteredContratos = contratos.filter((contract) => {
    const matchesSearch =
      !normalizedSearch ||
      contract.nome.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
      contract.cargo.toLocaleLowerCase("pt-BR").includes(normalizedSearch);
    const days = contract.diasRestantes;
    const matchesDeadline =
      deadlineFilter === "all" ||
      (deadlineFilter === "expired" &&
        Boolean(contract.dataTerminoReal) &&
        days !== null &&
        days < 0) ||
      (deadlineFilter === "30days" &&
        Boolean(contract.dataTerminoReal) &&
        days !== null &&
        days >= 0 &&
        days <= 30) ||
      (deadlineFilter === "31to90" &&
        Boolean(contract.dataTerminoReal) &&
        days !== null &&
        days > 30 &&
        days <= 90) ||
      (deadlineFilter === "missing" && !contract.dataTerminoReal);

    return matchesSearch && matchesDeadline;
  });

  const renderStatusSelect = (contract: ContractRenewal) => (
    <select
      aria-label={`Status da renovação de ${contract.nome}`}
      value={contract.statusRenovacao}
      onChange={(event) => {
        const status = renewalStatusOptions.find(
          (option) => option === event.currentTarget.value,
        );
        if (status) handleUpdateStatus(contract, status);
      }}
      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-yinmn focus:ring-2 focus:ring-sky-100"
    >
      {renewalStatusOptions.map((status) => (
        <option key={status} value={status}>{status}</option>
      ))}
    </select>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 rounded-2xl border border-sky-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-sky-50 p-2 text-yinmn">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-oxford">Prazos contratuais</h2>
            <p className="mt-1 text-sm text-slate-500">
              Veja o que vence primeiro e atualize a situação da renovação.
            </p>
          </div>
        </div>
        <p className="text-sm font-medium text-slate-500">
          {filteredContratos.length} de {contratos.length} contratos
        </p>
      </header>

      <section aria-label="Filtrar por prazo" className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const selected = deadlineFilter === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setDeadlineFilter(filter.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                selected
                  ? "border-yinmn bg-yinmn text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50"
              }`}
            >
              {filter.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                selected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {filter.count}
              </span>
            </button>
          );
        })}
      </section>

      <section className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Buscar contrato por funcionário ou cargo"
            placeholder="Buscar funcionário ou cargo"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.currentTarget.value);
              if (!event.currentTarget.value && onClearDefaultSearch) {
                onClearDefaultSearch();
              }
            }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-yinmn focus:bg-white focus:ring-2 focus:ring-sky-100"
          />
          {searchTerm && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => {
                setSearchTerm("");
                onClearDefaultSearch?.();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
      </section>

      <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div>
            <h3 className="font-bold text-oxford">Contratos</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Altere o status pelo seletor; use “Parecer” para registrar detalhes.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {filteredContratos.length}
          </span>
        </div>

        {filteredContratos.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-slate-700">Nenhum contrato encontrado</p>
            <p className="mt-1 text-sm text-slate-500">
              Tente outra busca ou selecione um prazo diferente.
            </p>
            {(searchTerm || deadlineFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setDeadlineFilter("all");
                  onClearDefaultSearch?.();
                }}
                className="mt-4 rounded-lg px-3 py-2 text-sm font-semibold text-yinmn hover:bg-sky-50"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredContratos.map((contract) => {
              const originalEmployee = employees.find(
                (employee) => employee.recordId === contract.recordId,
              );
              const days = contract.diasRestantes;
              const deadlineStyle = !contract.dataTerminoReal || days === null
                ? "bg-amber-50 text-amber-800"
                : days < 0
                  ? "bg-rose-50 text-rose-700"
                  : days <= 30
                    ? "bg-amber-50 text-amber-800"
                    : "bg-emerald-50 text-emerald-700";
              const deadlineLabel = !contract.dataTerminoReal
                ? "Data não informada"
                : days === null
                  ? "Prazo indisponível"
                : days === 0
                  ? "Vence hoje"
                  : days < 0
                    ? `Vencido há ${Math.abs(days)} dias`
                    : `Vence em ${days} dias`;

              return (
                <article
                  key={contract.recordId}
                  className="grid gap-4 p-4 transition hover:bg-slate-50/70 md:grid-cols-[minmax(0,1.2fr)_minmax(150px,0.8fr)_minmax(180px,0.9fr)_auto] md:items-center md:px-5"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => originalEmployee && onSelectEmployee(originalEmployee)}
                      className="text-left font-semibold text-oxford hover:text-yinmn hover:underline"
                    >
                      {contract.nome}
                    </button>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {contract.cargo || "Cargo não informado"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Vencimento</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        {contract.dataTerminoReal
                          ? formatarDataBR(contract.dataTerminoReal)
                          : "Sem data"}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${deadlineStyle}`}>
                        {deadlineLabel}
                      </span>
                    </div>
                  </div>

                  <label className="block space-y-1.5 text-xs font-medium text-slate-500">
                    Status da renovação
                    {renderStatusSelect(contract)}
                  </label>

                  <div className="flex items-center justify-between gap-3 md:justify-end">
                    <p className="min-w-0 text-xs text-slate-500 md:hidden">
                      {contract.responsavelAnalise || "Responsável a definir"}
                      {contract.dataLimiteDecisao
                        ? ` · decisão até ${formatarDataBR(contract.dataLimiteDecisao)}`
                        : ""}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(contract)}
                      className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-yinmn hover:bg-sky-50 hover:text-yinmn"
                    >
                      <MessageSquareText className="h-4 w-4" />
                      Parecer
                    </button>
                    <p className="hidden text-right text-xs text-slate-500 md:block">
                      {contract.responsavelAnalise || "A definir"}
                      <span className="mt-1 block">
                        Decisão até {contract.dataLimiteDecisao
                          ? formatarDataBR(contract.dataLimiteDecisao)
                          : "não definida"}
                      </span>
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* FLYOUT MODAL — EDITAR PARECER / DATA LIMITE */}
      {editingContract && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[26px] border border-sky-100 max-w-md w-full p-6 shadow-[0_24px_70px_rgba(0,48,87,0.24)] relative text-xs">
            <h3 className="text-sm font-black uppercase tracking-wider text-oxford mb-4">
              Parecer de Renovação Contratual
            </h3>

            <form onSubmit={handleSaveNotes} className="space-y-4">
              <div>
                <span className="text-[10px] uppercase font-black text-slate-400 block">Instrutor</span>
                <p className="text-sm font-extrabold text-yinmn">{editingContract.nome}</p>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{editingContract.cargo} • Expira em: {editingContract.dataTerminoReal ? formatarDataBR(editingContract.dataTerminoReal) : "Não informada"}</p>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-slate-400 mb-1">Analista Responsável</label>
                <input
                  type="text"
                  value={analystName}
                  onChange={(e) => setAnalystName(e.target.value)}
                  placeholder="Ex: Letícia de Albuquerque"
                  className="w-full p-2.5 bg-slate-50 border border-sky-100 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-slate-400 mb-1">Data Limite de Decisão</label>
                <input
                  type="date"
                  value={decisionLimit}
                  onChange={(e) => setDecisionLimit(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-sky-100 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-slate-400 mb-1">Parecer Recomendado / Justificativas</label>
                <textarea
                  value={obsText}
                  onChange={(e) => setObsText(e.target.value)}
                  rows={4}
                  placeholder="Justifique o motivo da recomendação de renovação ou encerramento (avaliação de turmas, pontualidade, etc.)..."
                  className="w-full p-2.5 bg-slate-50 border border-sky-100 rounded-xl font-semibold"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button
                  type="button"
                  onClick={() => setEditingContract(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-yinmn hover:bg-cadet text-white font-extrabold py-2.5 px-4 rounded-xl shadow-md cursor-pointer"
                >
                  Salvar Informações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
