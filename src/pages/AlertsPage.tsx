/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Bell,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  User,
  ExternalLink,
  Calendar,
  AlertOctagon,
  RefreshCw,
  FolderMinus
} from "lucide-react";
import { RhEmployee, AbsenceItem } from "../types/rh";
import { formatarDataBR, calcularDiasRestantes, getToday } from "../utils/dateUtils";
import { calcularMapaOcupacaoDias } from "../utils/absenceUtils";
import { identificarPendencias } from "../utils/riskUtils";

export type LocalAlertSeverity = "Crítica" | "Alta" | "Média" | "Baixa" | "Informativa";
export type LocalAlertCategory = "Contrato" | "Férias" | "Substituição" | "Cadastro" | "Risco" | "Capacidade" | "Operacional";

export interface SystemAlert {
  alertId: string;
  tipo: string;
  descricao: string;
  gravidade: LocalAlertSeverity;
  categoria: LocalAlertCategory;
  dataGeracao: string;
  status: "Novo" | "Em análise" | "Em andamento" | "Resolvido" | "Ignorado";
  relatedEmployeeId?: string;
}

interface AlertsPageProps {
  employees: RhEmployee[];
  onSelectEmployee: (emp: RhEmployee) => void;
  onRefreshData?: () => void;
  onAlertCountChange?: (count: number) => void;
}

const ALERT_WORKFLOW_KEY = "ctm_rh_alert_workflow";

type AlertWorkflow = {
  assignedUsers: Record<string, string>;
  alertStatuses: Record<string, SystemAlert["status"]>;
};

const EMPTY_WORKFLOW: AlertWorkflow = {
  assignedUsers: {},
  alertStatuses: {},
};

function carregarFluxoAlertas(): AlertWorkflow {
  try {
    const stored = localStorage.getItem(ALERT_WORKFLOW_KEY);
    if (!stored) return EMPTY_WORKFLOW;

    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Os dados locais do painel de alertas são inválidos.");
    }

    const workflow = parsed as Partial<AlertWorkflow>;
    return {
      assignedUsers:
        workflow.assignedUsers && typeof workflow.assignedUsers === "object"
          ? workflow.assignedUsers
          : {},
      alertStatuses:
        workflow.alertStatuses && typeof workflow.alertStatuses === "object"
          ? workflow.alertStatuses
          : {},
    };
  } catch (error) {
    console.error("Não foi possível carregar o acompanhamento local dos alertas:", error);
    return EMPTY_WORKFLOW;
  }
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  employees,
  onSelectEmployee,
  onRefreshData,
  onAlertCountChange,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [workflow, setWorkflow] = useState<AlertWorkflow>(carregarFluxoAlertas);
  const [storageError, setStorageError] = useState("");
  const { assignedUsers, alertStatuses } = workflow;

  useEffect(() => {
    try {
      localStorage.setItem(ALERT_WORKFLOW_KEY, JSON.stringify(workflow));
      setStorageError("");
    } catch (error) {
      console.error("Não foi possível salvar o acompanhamento local dos alertas:", error);
      setStorageError("Não foi possível salvar as atribuições e os status neste navegador.");
    }
  }, [workflow]);

  // MOTOR DINÂMICO DE GERAÇÃO DE ALERTAS
  useEffect(() => {
    const list: SystemAlert[] = [];

    // 1. Verificar Contratos Vencendo ou Vencidos
    employees.forEach((emp) => {
      if (emp.statusFuncionario === "Ativo") {
        const dias = calcularDiasRestantes(emp.dataTerminoReal);
        if (dias !== null) {
          if (dias < 0) {
            list.push({
              alertId: `alert-contract-expired-${emp.recordId}`,
              tipo: "Contrato vencido",
              descricao: `O contrato do instrutor ${emp.nome} expirou em ${formatarDataBR(emp.dataTerminoReal)} (${Math.abs(dias)} dias atrás). Ação urgente de regularização exigida!`,
              gravidade: "Crítica",
              categoria: "Contrato",
              dataGeracao: getToday(),
              status: "Novo",
              relatedEmployeeId: emp.recordId
            });
          } else if (dias <= 30) {
            list.push({
              alertId: `alert-contract-warn-${emp.recordId}`,
              tipo: "Contrato prestes a vencer",
              descricao: `O contrato do instrutor ${emp.nome} vence em ${formatarDataBR(emp.dataTerminoReal)} (restam apenas ${dias} dias). Necessário parecer de renovação.`,
              gravidade: "Alta",
              categoria: "Contrato",
              dataGeracao: getToday(),
              status: "Novo",
              relatedEmployeeId: emp.recordId
            });
          }
        }
      }
    });

    // 2. Verificar Direito Adquirido Acumulado
    employees.forEach((emp) => {
      if (emp.statusFuncionario === "Ativo" && emp.direitoAdquirido) {
        // Se já passou o período limite ou tem mais de 30 dias de direito e não tem férias gozadas
        const saldo = emp.saldoFeriasDisponivel ?? 0;
        if (saldo >= 30) {
          list.push({
            alertId: `alert-vacation-accrued-${emp.recordId}`,
            tipo: "Acúmulo de direito de férias",
            descricao: `O instrutor ${emp.nome} acumulou mais de ${saldo} dias de direito de férias disponíveis sem agendamento no curto prazo. Risco de passivo trabalhista!`,
            gravidade: "Média",
            categoria: "Férias",
            dataGeracao: getToday(),
            status: "Novo",
            relatedEmployeeId: emp.recordId
          });
        }
      }
    });

    // 4. Inconsistências cadastrais críticas
    employees.forEach((emp) => {
      const pends = identificarPendencias(emp);
      if (pends.length > 0) {
        pends.forEach((p, idx) => {
          list.push({
            alertId: `alert-inconsistency-${emp.recordId}-${idx}`,
            tipo: "Inconsistência cadastral",
            descricao: `O cadastro do Funcionário ${emp.nome} apresenta inconsistência: ${p.label}.`,
            gravidade: p.severity === "Alta" ? "Alta" : "Média",
            categoria: "Cadastro",
            dataGeracao: getToday(),
            status: "Novo",
            relatedEmployeeId: emp.recordId
          });
        });
      }
    });

    // 5. Verificar Regra de Limite Simultâneo de Férias/Ausências (> 8 pessoas no mesmo período)
    // Montar todos os afastamentos
    const ausencias: AbsenceItem[] = [];
    employees.forEach((emp) => {
      emp.periodosFerias?.forEach((f) => {
        ausencias.push({
          id: emp.recordId,
          nome: emp.nome,
          dataInicio: f.dataInicio,
          dataFim: f.dataFim,
          tipo: "Férias"
        });
      });
    });
    const mapaOcupacao = calcularMapaOcupacaoDias(ausencias);
    const diasExcedidos = Object.keys(mapaOcupacao).filter((dia) => mapaOcupacao[dia].length > 8);

    if (diasExcedidos.length > 0) {
      // Agrupar dias contíguos para um único alerta limpo
      const sortedDays = [...diasExcedidos].sort();
      list.push({
        alertId: `alert-simultaneous-limit-exceeded`,
        tipo: "Limite simultâneo excedido",
        descricao: `Risco Operacional! Há períodos críticos onde a regra de limite de no máximo 8 pessoas ausentes no mesmo dia é desrespeitada. Datas impactadas: ${sortedDays.slice(0, 5).map(formatarDataBR).join(", ")}${sortedDays.length > 5 ? `... (+${sortedDays.length - 5} dias)` : ""}.`,
        gravidade: "Crítica",
        categoria: "Risco",
        dataGeracao: getToday(),
        status: "Novo"
      });
    }

    const mapped = list.map((alert) => ({
      ...alert,
      status: alertStatuses[alert.alertId] || alert.status,
    }));
    setAlerts(mapped);
  }, [employees, alertStatuses]);

  useEffect(() => {
    const openAlerts = alerts.filter(
      (alert) =>
        alertStatuses[alert.alertId] !== "Resolvido" &&
        alertStatuses[alert.alertId] !== "Ignorado"
    ).length;
    onAlertCountChange?.(openAlerts);
  }, [alerts, alertStatuses, onAlertCountChange]);

  const handleStatusChange = (id: string, newStatus: string) => {
    setWorkflow((previous) => ({
      ...previous,
      alertStatuses: {
        ...previous.alertStatuses,
        [id]: newStatus as SystemAlert["status"],
      },
    }));
  };

  const handleAssignResponsibility = (id: string, name: string) => {
    setWorkflow((previous) => ({
      ...previous,
      assignedUsers: {
        ...previous.assignedUsers,
        [id]: name,
      },
    }));
  };

  const getSeverityBadge = (sev: LocalAlertSeverity) => {
    switch (sev) {
      case "Crítica":
        return "bg-red-100 text-red-700 border border-red-200 animate-pulse font-black";
      case "Alta":
        return "bg-orange-100 text-orange-700 border border-orange-200 font-extrabold";
      case "Média":
        return "bg-amber-100 text-amber-700 border border-amber-200 font-semibold";
      default:
        return "bg-sky-100 text-sky-700 border border-sky-200 font-medium";
    }
  };

  const getCategoryColor = (cat: LocalAlertCategory) => {
    switch (cat) {
      case "Risco":
        return "text-red-600";
      case "Contrato":
        return "text-sky-600";
      case "Férias":
        return "text-yinmn";
      case "Substituição":
        return "text-amber-600";
      default:
        return "text-slate-600";
    }
  };

  // Filtragem dos alertas
  const filteredAlerts = alerts
    .filter((a) => {
      // Excluir ou marcar resolvido localmente
      const status = alertStatuses[a.alertId] || a.status;
      const stateResolved = status === "Resolvido";
      if (selectedStatus === "Resolvido" && !stateResolved) return false;
      if (selectedStatus === "Pendente" && (stateResolved || status === "Ignorado")) return false;

      const matchesSearch =
        a.tipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.descricao.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSeverity = selectedSeverity === "all" || a.gravidade === selectedSeverity;
      const matchesCategory = selectedCategory === "all" || a.categoria === selectedCategory;

      return matchesSearch && matchesSeverity && matchesCategory;
    });

  // KPI Counters
  const countCriticos = alerts.filter(
    (alert) =>
      alert.gravidade === "Crítica" &&
      alertStatuses[alert.alertId] !== "Resolvido" &&
      alertStatuses[alert.alertId] !== "Ignorado"
  ).length;
  const countAltos = alerts.filter(
    (alert) =>
      alert.gravidade === "Alta" &&
      alertStatuses[alert.alertId] !== "Resolvido" &&
      alertStatuses[alert.alertId] !== "Ignorado"
  ).length;
  const countMedios = alerts.filter(
    (alert) =>
      alert.gravidade === "Média" &&
      alertStatuses[alert.alertId] !== "Resolvido" &&
      alertStatuses[alert.alertId] !== "Ignorado"
  ).length;
  const countResolvidos = alerts.filter(
    (alert) => alertStatuses[alert.alertId] === "Resolvido"
  ).length;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="rounded-[22px] border border-white bg-gradient-to-br from-slate-100 to-white p-5 shadow-[0_12px_30px_rgba(0,48,87,0.07)]">
        <h2 className="text-lg sm:text-xl font-bold text-oxford flex items-center gap-2.5">
          <Bell className="w-5 h-5 text-yinmn animate-swing" />
          <span>Central de Alertas Operacionais Inteligentes</span>
        </h2>
        <p className="text-xs text-slate-400 font-medium mt-1">
          Alertas gerados a partir dos cadastros atuais de funcionários, férias e contratos.
        </p>
        <p className="mt-2 text-[10px] font-medium text-slate-500">
          Status e responsáveis são salvos somente neste navegador; não são compartilhados nem gravados no Dataverse.
        </p>
        {storageError && (
          <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">
            {storageError}
          </p>
        )}
        {onRefreshData && (
          <button
            type="button"
            onClick={onRefreshData}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-sky-100 bg-white px-3 py-2 text-xs font-bold text-yinmn hover:bg-sky-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar dados
          </button>
        )}
      </div>

      {/* KPI Stats Panel */}
      <div className="adaptive-grid gap-3">
        <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-center justify-between">
          <div>
            <span className="text-[9px] uppercase font-black text-red-600 tracking-wider">Alertas Críticos</span>
            <span className="text-xl font-black text-red-900 block mt-0.5">{countCriticos}</span>
          </div>
          <AlertOctagon className="w-8 h-8 text-red-300" />
        </div>

        <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 flex items-center justify-between">
          <div>
            <span className="text-[9px] uppercase font-black text-orange-600 tracking-wider">Gravidade Alta</span>
            <span className="text-xl font-black text-orange-900 block mt-0.5">{countAltos}</span>
          </div>
          <AlertTriangle className="w-8 h-8 text-orange-300" />
        </div>

        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center justify-between">
          <div>
            <span className="text-[9px] uppercase font-black text-amber-600 tracking-wider">Gravidade Média</span>
            <span className="text-xl font-black text-amber-900 block mt-0.5">{countMedios}</span>
          </div>
          <ShieldAlert className="w-8 h-8 text-amber-300" />
        </div>

        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
          <div>
            <span className="text-[9px] uppercase font-black text-emerald-600 tracking-wider">Tratados / Resolvidos</span>
            <span className="text-xl font-black text-emerald-900 block mt-0.5">{countResolvidos}</span>
          </div>
          <CheckCircle className="w-8 h-8 text-emerald-300" />
        </div>
      </div>

      {/* Filter and search actions */}
      <div className="bg-white p-4 rounded-[22px] border border-sky-100 shadow-[0_12px_30px_rgba(0,48,87,0.06)] flex flex-col lg:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar alertas por palavras chaves ou descrições..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-sky-100 focus:outline-none focus:border-jordy text-slate-700"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Gravidade */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="text-xs font-bold text-slate-600 bg-slate-50 border border-sky-100 rounded-xl px-3 py-2 cursor-pointer focus:outline-none"
          >
            <option value="all">Gravidade (Todas)</option>
            <option value="Crítica">Crítica</option>
            <option value="Alta">Alta</option>
            <option value="Média">Média</option>
            <option value="Baixa">Baixa</option>
          </select>

          {/* Categoria */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs font-bold text-slate-600 bg-slate-50 border border-sky-100 rounded-xl px-3 py-2 cursor-pointer focus:outline-none"
          >
            <option value="all">Categoria (Todas)</option>
            <option value="Contrato">Contrato</option>
            <option value="Férias">Férias</option>
            <option value="Cadastro">Cadastro</option>
            <option value="Risco">Risco</option>
          </select>

          {/* Status */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs font-bold text-slate-600 bg-slate-50 border border-sky-100 rounded-xl px-3 py-2 cursor-pointer focus:outline-none"
          >
            <option value="Pendente">Apenas Pendentes</option>
            <option value="Resolvido">Apenas Tratados / Resolvidos</option>
            <option value="all">Pendente + Resolvido</option>
          </select>
        </div>
      </div>

      {/* Live Alerts Stream Feed */}
      <div className="space-y-3.5">
        {filteredAlerts.map((alert) => {
          const status = alertStatuses[alert.alertId] || alert.status || "Novo";
          const isResolved = status === "Resolvido";
          const isIgnored = status === "Ignorado";
          const currentAssignee = assignedUsers[alert.alertId] || "";
          const relatedEmployee = employees.find((emp) => emp.recordId === alert.relatedEmployeeId);

          return (
            <div
              key={alert.alertId}
              className={`p-4 rounded-3xl border transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                isResolved
                  ? "bg-slate-50/70 border-slate-100 opacity-60"
                  : alert.gravidade === "Crítica"
                  ? "bg-red-50/20 border-red-100 hover:border-red-200"
                  : alert.gravidade === "Alta"
                  ? "bg-orange-50/20 border-orange-100 hover:border-orange-200"
                  : "bg-sky-50/50 border-sky-100 hover:border-sky-200"
              }`}
            >
              {/* Alert Content */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {/* Visual Status Indicator Icon */}
                <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isResolved
                    ? "bg-emerald-100 text-emerald-600"
                    : alert.gravidade === "Crítica"
                    ? "bg-red-100 text-red-600"
                    : alert.gravidade === "Alta"
                    ? "bg-orange-100 text-orange-600"
                    : "bg-sky-100 text-yinmn"
                }`}>
                  {isResolved ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : isIgnored ? (
                    <FolderMinus className="w-4 h-4" />
                  ) : alert.gravidade === "Crítica" ? (
                    <AlertOctagon className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                </span>

                {/* Body details */}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-bold text-oxford text-sm">{alert.tipo}</span>
                    <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-full ${getSeverityBadge(alert.gravidade)}`}>
                      {alert.gravidade}
                    </span>
                    <span className={`text-[10px] font-black uppercase ${getCategoryColor(alert.categoria)}`}>
                      {alert.categoria}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">• Gerado em: {formatarDataBR(alert.dataGeracao)}</span>
                  </div>
                  
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">{alert.descricao}</p>
                  
                  {/* Related employee info shortcut if applicable */}
                  {relatedEmployee && (
                    <div className="pt-1.5 flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-medium">Funcionário associado:</span>
                      <button
                        onClick={() => onSelectEmployee(relatedEmployee)}
                        className="text-[10px] font-black text-yinmn hover:underline flex items-center gap-0.5"
                      >
                        {relatedEmployee.nome}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Action and assignment panel */}
              <div className="flex flex-row md:flex-col items-start md:items-end justify-between gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-sky-100 shrink-0">
                {/* Assigner */}
                <div className="flex items-center gap-1.5 text-xs">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={currentAssignee}
                    onChange={(e) => handleAssignResponsibility(alert.alertId, e.target.value)}
                    className="text-[11px] font-semibold bg-slate-50 hover:bg-slate-100 text-slate-600 border border-sky-100 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                  >
                    <option value="">Atribuir analista...</option>
                    <option value="Letícia">Letícia (Férias)</option>
                    <option value="Robson">Robson (Diretor)</option>
                    <option value="Letícia de Albuquerque">Letícia de Albuquerque</option>
                    <option value="Coordenação Geral">Coordenação Geral</option>
                  </select>
                </div>

                {/* Resolve buttons */}
                
                  <select 
                    value={status}
                    onChange={(e) => handleStatusChange(alert.alertId, e.target.value)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border appearance-none cursor-pointer ${
                      status === "Resolvido" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      status === "Em andamento" ? "bg-sky-50 text-sky-700 border-sky-200" :
                      status === "Em análise" ? "bg-amber-50 text-amber-700 border-amber-200" :
                      status === "Ignorado" ? "bg-slate-100 text-slate-500 border-slate-200" :
                      "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <option value="Novo">Novo</option>
                    <option value="Em análise">Em análise</option>
                    <option value="Em andamento">Em andamento</option>
                    <option value="Resolvido">Resolvido</option>
                    <option value="Ignorado">Ignorado</option>
                  </select>
  
              </div>
            </div>
          );
        })}

        {filteredAlerts.length === 0 && (
          <div className="bg-white rounded-[26px] p-10 text-center border border-sky-100/50 shadow-[0_12px_30px_rgba(0,48,87,0.06)] text-slate-400 font-semibold">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <h3 className="text-sm font-black text-oxford">Excelente! Central Totalmente Limpa</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">Todos os riscos operacionais, inconsistências e férias vencidas estão devidamente monitorados.</p>
          </div>
        )}
      </div>
    </div>
  );
};
