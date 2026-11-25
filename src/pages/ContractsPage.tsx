/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  LoaderCircle,
  MessageSquareText,
  Save,
  Search,
  UserRound,
  X,
} from "lucide-react";
import type { ContractRenewal, ContractRenewalStatus, RhEmployee } from "../types/rh";
import { formatarDataBR } from "../utils/dateUtils";
import { obterContratos } from "../services/additionalDataSource";
import type {
  ContractRenewalInput,
  ContractResponsible,
} from "../services/contractRenewalsDataSource";
import { loadContractResponsibles } from "../services/contractRenewalsDataSource";

interface ContractsPageProps {
  employees: RhEmployee[];
  onSaveRenewal: (input: ContractRenewalInput) => Promise<void>;
  onSelectEmployee: (emp: RhEmployee) => void;
  defaultSearch?: string;
  onClearDefaultSearch?: () => void;
}

type DeadlineFilter = "all" | "expired" | "30days" | "31to90" | "missing";
type Feedback = { kind: "success" | "error"; message: string } | null;

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
  onSaveRenewal,
  onSelectEmployee,
  defaultSearch,
  onClearDefaultSearch,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("all");
  const [editingContract, setEditingContract] = useState<ContractRenewal | null>(null);
  const [obsText, setObsText] = useState("");
  const [decisionLimit, setDecisionLimit] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [responsibles, setResponsibles] = useState<ContractResponsible[]>([]);
  const [responsiblesError, setResponsiblesError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (defaultSearch !== undefined) setSearchTerm(defaultSearch);
  }, [defaultSearch]);

  useEffect(() => {
    let active = true;
    void loadContractResponsibles()
      .then((items) => {
        if (!active) return;
        setResponsibles(items);
        setResponsiblesError("");
      })
      .catch((error) => {
        if (!active) return;
        setResponsiblesError(
          error instanceof Error ? error.message : "Não foi possível carregar os responsáveis.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!editingContract || responsibleId) return;
    const current = responsibles.find((item) => item.current);
    if (current) setResponsibleId(current.id);
  }, [editingContract, responsibleId, responsibles]);

  const contratos = useMemo(() => obterContratos(employees), [employees]);
  const defaultResponsible = responsibles.find((item) => item.current);

  const totalVencidos = contratos.filter(
    (contract) => contract.dataTerminoReal && contract.diasRestantes !== null && contract.diasRestantes < 0,
  ).length;
  const totalProximos30Dias = contratos.filter(
    (contract) =>
      contract.dataTerminoReal &&
      contract.diasRestantes !== null &&
      contract.diasRestantes >= 0 &&
      contract.diasRestantes <= 30,
  ).length;
  const totalSemData = contratos.filter((contract) => !contract.dataTerminoReal).length;
  const totalEmAnalise = contratos.filter((contract) =>
    ["Em análise", "Aguardando coordenação", "Aguardando aprovação"].includes(
      contract.statusRenovacao,
    ),
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
      contract.cargo.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
      contract.zona.toLocaleLowerCase("pt-BR").includes(normalizedSearch);
    const days = contract.diasRestantes;
    const matchesDeadline =
      deadlineFilter === "all" ||
      (deadlineFilter === "expired" && Boolean(contract.dataTerminoReal) && days !== null && days < 0) ||
      (deadlineFilter === "30days" && Boolean(contract.dataTerminoReal) && days !== null && days >= 0 && days <= 30) ||
      (deadlineFilter === "31to90" && Boolean(contract.dataTerminoReal) && days !== null && days > 30 && days <= 90) ||
      (deadlineFilter === "missing" && !contract.dataTerminoReal);
    return matchesSearch && matchesDeadline;
  });

  const save = async (
    contract: ContractRenewal,
    overrides: Partial<Pick<ContractRenewalInput, "status" | "responsibleId" | "decisionDeadline" | "notes">>,
  ) => {
    setSavingId(contract.recordId);
    setFeedback(null);
    try {
      await onSaveRenewal({
        employeeId: contract.recordId,
        employeeName: contract.nome,
        currentEndDate: contract.dataTerminoReal,
        status: overrides.status ?? contract.statusRenovacao,
        responsibleId:
          overrides.responsibleId ??
          contract.responsavelAnaliseId ??
          defaultResponsible?.id,
        decisionDeadline: overrides.decisionDeadline ?? contract.dataLimiteDecisao,
        notes: overrides.notes ?? contract.observacoes,
      });
      setFeedback({ kind: "success", message: `Alterações de ${contract.nome} salvas no Dataverse.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({ kind: "error", message: `Erro ao salvar: ${message}` });
      throw error;
    } finally {
      setSavingId("");
    }
  };

  const handleUpdateStatus = async (
    contract: ContractRenewal,
    newStatus: ContractRenewalStatus,
  ) => {
    try {
      await save(contract, { status: newStatus });
    } catch {
      // O seletor volta ao valor confirmado porque a lista só muda após o Dataverse responder.
    }
  };

  const handleSaveNotes = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingContract) return;
    try {
      await save(editingContract, {
        responsibleId: responsibleId || undefined,
        decisionDeadline: decisionLimit,
        notes: obsText,
      });
      setEditingContract(null);
      setObsText("");
    } catch {
      // A mensagem permanece visível no modal e no topo da página.
    }
  };

  const handleOpenEditModal = (contract: ContractRenewal) => {
    setEditingContract(contract);
    setObsText(contract.observacoes || "");
    setDecisionLimit(contract.dataLimiteDecisao || "");
    setResponsibleId(contract.responsavelAnaliseId || defaultResponsible?.id || "");
    setFeedback(null);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDeadlineFilter("all");
    onClearDefaultSearch?.();
  };

  return (
    <div className="min-h-0 space-y-5">
      <header className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
        <div className="flex flex-col gap-4 bg-gradient-to-r from-sky-50 via-white to-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-yinmn p-2.5 text-white shadow-sm">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-oxford">Prazos contratuais</h2>
              <p className="mt-1 text-sm text-slate-500">
                Acompanhe vencimentos e registre decisões confirmadas no Dataverse.
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full border border-sky-100 bg-white px-3 py-1.5 text-xs font-bold text-yinmn">
            {filteredContratos.length} de {contratos.length} contratos
          </span>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo dos prazos">
        {[
          { label: "Vencidos", value: totalVencidos, icon: AlertCircle, color: "text-rose-700 bg-rose-50" },
          { label: "Até 30 dias", value: totalProximos30Dias, icon: Clock3, color: "text-amber-700 bg-amber-50" },
          { label: "Em análise", value: totalEmAnalise, icon: CalendarClock, color: "text-yinmn bg-sky-50" },
          { label: "Sem data", value: totalSemData, icon: CalendarDays, color: "text-slate-600 bg-slate-100" },
        ].map((item) => (
          <article key={item.label} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <span className={`rounded-xl p-2.5 ${item.color}`}><item.icon className="h-5 w-5" /></span>
            <div>
              <p className="text-2xl font-black leading-none text-oxford">{item.value}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{item.label}</p>
            </div>
          </article>
        ))}
      </section>

      {feedback && (
        <div
          role={feedback.kind === "error" ? "alert" : "status"}
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
            feedback.kind === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {feedback.kind === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="ml-auto rounded p-0.5 hover:bg-black/5" aria-label="Fechar mensagem">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_auto] lg:items-center">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Buscar contrato por funcionário, cargo ou zona"
              placeholder="Buscar funcionário, cargo ou zona"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.currentTarget.value);
                if (!event.currentTarget.value) onClearDefaultSearch?.();
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-yinmn focus:bg-white focus:ring-2 focus:ring-sky-100"
            />
            {searchTerm && (
              <button type="button" aria-label="Limpar busca" onClick={() => { setSearchTerm(""); onClearDefaultSearch?.(); }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:justify-end lg:overflow-visible lg:pb-0" aria-label="Filtrar por prazo">
            {filters.map((filter) => {
              const selected = deadlineFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDeadlineFilter(filter.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition ${selected ? "border-yinmn bg-yinmn text-white" : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50"}`}
                >
                  {filter.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${selected ? "bg-white/20" : "bg-slate-100"}`}>{filter.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="min-h-0 overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div>
            <h3 className="font-bold text-oxford">Contratos</h3>
            <p className="mt-0.5 text-xs text-slate-500">Role a lista para ver todos. Use “Parecer” para prazo, responsável e justificativa.</p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{filteredContratos.length}</span>
        </div>

        {filteredContratos.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-slate-700">Nenhum contrato encontrado</p>
            <p className="mt-1 text-sm text-slate-500">Tente outra busca ou selecione um prazo diferente.</p>
            {(searchTerm || deadlineFilter !== "all") && <button type="button" onClick={clearFilters} className="mt-4 rounded-lg px-3 py-2 text-sm font-semibold text-yinmn hover:bg-sky-50">Limpar filtros</button>}
          </div>
        ) : (
          <div
            className="max-h-[62dvh] min-h-[18rem] divide-y divide-slate-100 overflow-y-auto overscroll-contain scroll-smooth"
            style={{ scrollbarGutter: "stable" }}
            tabIndex={0}
            aria-label="Lista rolável de contratos"
          >
            {filteredContratos.map((contract) => {
              const originalEmployee = employees.find((employee) => employee.recordId === contract.recordId);
              const days = contract.diasRestantes;
              const deadlineStyle = !contract.dataTerminoReal || days === null
                ? "bg-amber-50 text-amber-800"
                : days < 0 ? "bg-rose-50 text-rose-700" : days <= 30 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700";
              const deadlineLabel = !contract.dataTerminoReal
                ? "Data não informada"
                : days === null ? "Prazo indisponível" : days === 0 ? "Vence hoje" : days < 0 ? `Vencido há ${Math.abs(days)} dias` : `Vence em ${days} dias`;
              const saving = savingId === contract.recordId;

              return (
                <article key={contract.recordId} className="grid gap-4 p-4 transition hover:bg-slate-50/70 xl:grid-cols-[minmax(210px,1.15fr)_minmax(170px,0.8fr)_minmax(190px,0.85fr)_minmax(180px,0.8fr)_auto] xl:items-center xl:px-5">
                  <div className="min-w-0">
                    <button type="button" onClick={() => originalEmployee && onSelectEmployee(originalEmployee)} className="text-left font-semibold text-oxford hover:text-yinmn hover:underline">
                      {contract.nome}
                    </button>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{contract.cargo || "Cargo não informado"}</p>
                    <p className="mt-1 truncate text-[11px] text-slate-400">{contract.zona || "Zona não informada"} · {contract.turno || "Turno não informado"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Vencimento</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700"><CalendarDays className="h-4 w-4 text-slate-400" />{contract.dataTerminoReal ? formatarDataBR(contract.dataTerminoReal) : "Sem data"}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${deadlineStyle}`}>{deadlineLabel}</span>
                    </div>
                  </div>

                  <label className="block space-y-1.5 text-xs font-medium text-slate-500">
                    Status da renovação
                    <div className="relative">
                      <select
                        aria-label={`Status da renovação de ${contract.nome}`}
                        value={contract.statusRenovacao}
                        disabled={saving}
                        onChange={(event) => {
                          const status = renewalStatusOptions.find((option) => option === event.currentTarget.value);
                          if (status) void handleUpdateStatus(contract, status);
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 pr-8 text-xs font-semibold text-slate-700 outline-none transition focus:border-yinmn focus:ring-2 focus:ring-sky-100 disabled:cursor-wait disabled:opacity-60"
                      >
                        {renewalStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      {saving && <LoaderCircle className="absolute right-7 top-2.5 h-3.5 w-3.5 animate-spin text-yinmn" />}
                    </div>
                  </label>

                  <div className="text-xs text-slate-500">
                    <p className="inline-flex items-center gap-1.5 font-semibold text-slate-700"><UserRound className="h-3.5 w-3.5 text-slate-400" />{contract.responsavelAnalise || "Responsável a definir"}</p>
                    <p className="mt-1">Decisão até {contract.dataLimiteDecisao ? formatarDataBR(contract.dataLimiteDecisao) : "não definida"}</p>
                  </div>

                  <button type="button" disabled={saving} onClick={() => handleOpenEditModal(contract)} className="inline-flex w-fit shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-yinmn hover:bg-sky-50 hover:text-yinmn disabled:cursor-wait disabled:opacity-60">
                    {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
                    Parecer
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {editingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-xs" role="dialog" aria-modal="true" aria-labelledby="contract-modal-title">
          <div className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[26px] border border-sky-100 bg-white shadow-[0_24px_70px_rgba(0,48,87,0.24)]">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-6 py-5">
              <div>
                <h3 id="contract-modal-title" className="text-base font-extrabold text-oxford">Parecer de renovação</h3>
                <p className="mt-1 text-xs text-slate-500">{editingContract.nome} · {editingContract.cargo || "Cargo não informado"}</p>
              </div>
              <button type="button" disabled={Boolean(savingId)} onClick={() => setEditingContract(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSaveNotes} className="space-y-5 p-6">
              <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-xs text-slate-600">
                <span className="font-bold text-oxford">Vencimento:</span> {editingContract.dataTerminoReal ? formatarDataBR(editingContract.dataTerminoReal) : "não informado"}
                <span className="mx-2 text-slate-300">|</span>
                <span className="font-bold text-oxford">Status:</span> {editingContract.statusRenovacao}
              </div>

              <label className="block space-y-1.5 text-xs font-bold text-slate-600">
                Analista responsável
                <select
                  value={responsibleId}
                  required
                  onChange={(event) => setResponsibleId(event.currentTarget.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-yinmn focus:bg-white focus:ring-2 focus:ring-sky-100"
                >
                  <option value="">Selecione um usuário do Dataverse</option>
                  {editingContract.responsavelAnaliseId && !responsibles.some((item) => item.id === editingContract.responsavelAnaliseId) && (
                    <option value={editingContract.responsavelAnaliseId}>{editingContract.responsavelAnalise || "Responsável atual"}</option>
                  )}
                  {responsibles.map((item) => <option key={item.id} value={item.id}>{item.name}{item.current ? " (você)" : ""}</option>)}
                </select>
                {responsiblesError && <span className="flex items-start gap-1.5 font-medium text-rose-700"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{responsiblesError}</span>}
              </label>

              <label className="block space-y-1.5 text-xs font-bold text-slate-600">
                Data limite de decisão
                <input type="date" required value={decisionLimit} onChange={(event) => setDecisionLimit(event.currentTarget.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-yinmn focus:bg-white focus:ring-2 focus:ring-sky-100" />
              </label>

              <label className="block space-y-1.5 text-xs font-bold text-slate-600">
                Parecer / justificativa
                <textarea value={obsText} maxLength={100} onChange={(event) => setObsText(event.currentTarget.value)} rows={4} placeholder="Registre uma justificativa objetiva para a decisão..." className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none focus:border-yinmn focus:bg-white focus:ring-2 focus:ring-sky-100" />
                <span className="block text-right font-medium text-slate-400">{obsText.length}/100</span>
              </label>

              {feedback?.kind === "error" && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{feedback.message}</p>}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button type="button" disabled={Boolean(savingId)} onClick={() => setEditingContract(null)} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-60">Cancelar</button>
                <button type="submit" disabled={Boolean(savingId)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-yinmn px-4 py-2.5 text-sm font-extrabold text-white shadow-md transition hover:bg-cadet disabled:cursor-wait disabled:opacity-60">
                  {savingId ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {savingId ? "Salvando..." : "Salvar no Dataverse"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
