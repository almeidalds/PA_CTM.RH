/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { getContext } from "@microsoft/power-apps/app";
import {
  X,
  Mail,
  Copy,
  Check,
  Video,
  AlertTriangle,
  User,
  Calendar,
  Clock,
  Globe2,
  FileEdit,
  ClipboardCheck,
  Plus,
  FileText,
  Plane,
  RefreshCw,
  Settings,
  MapPin,
  BriefcaseBusiness,
  ExternalLink
} from "lucide-react";
import { RhEmployee, TimelineEvent, TimelineEventCategory } from "../types/rh";
import { formatarDataBR, calcularDiasRestantes } from "../utils/dateUtils";
import { calcularRisco, identificarPendencias } from "../utils/riskUtils";
import { calcularStatusFerias } from "../utils/vacationUtils";
import { StatusBadge } from "./StatusBadge";
import { RiskBadge } from "./RiskBadge";
import {
  adicionarObservacaoHistorico,
  obterHistoricoFuncionario,
} from "../services/employeeTimeline";
import {
  Ctmbrasi_employeerecordsesctmbrasi_employeestatus as employeeStatuses,
  Ctmbrasi_employeerecordsesctmbrasi_gender as genders,
} from "../generated/models/Ctmbrasi_employeerecordsesModel";

interface EmployeeDetailsPanelProps {
  employee: RhEmployee | null;
  onClose: () => void;
  onEdit: (employee: RhEmployee) => void;
  onConfigureVacation: (employee: RhEmployee) => void;
}

export const EmployeeDetailsPanel: React.FC<EmployeeDetailsPanelProps> = ({
  employee,
  onClose,
  onEdit,
  onConfigureVacation,
}) => {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Timeline states
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [newObs, setNewObs] = useState("");
  const [newCategory, setNewCategory] = useState<TimelineEventCategory>("Alteração administrativa");
  const [responsavelAtual, setResponsavelAtual] = useState<string | null>(null);
  const [erroIdentificacaoUsuario, setErroIdentificacaoUsuario] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineSaving, setTimelineSaving] = useState(false);
  const [timelineError, setTimelineError] = useState("");

  useEffect(() => {
    let componenteAtivo = true;

    const carregarResponsavel = async () => {
      try {
        const contexto = await getContext();
        const nome = contexto.user.fullName?.trim()
          || contexto.user.userPrincipalName?.trim();

        if (!nome) {
          throw new Error("O contexto do Power Apps não informou o usuário autenticado.");
        }

        if (componenteAtivo) setResponsavelAtual(nome);
      } catch (erro) {
        console.error("Não foi possível identificar o responsável pelo histórico:", erro);
        if (componenteAtivo) setErroIdentificacaoUsuario(true);
      }
    };

    void carregarResponsavel();

    return () => {
      componenteAtivo = false;
    };
  }, []);

  useEffect(() => {
    if (!employee) {
      setEvents([]);
      return;
    }

    let componenteAtivo = true;
    setTimelineLoading(true);
    setTimelineError("");

    void obterHistoricoFuncionario(employee.recordId)
      .then((historico) => {
        if (componenteAtivo) setEvents(historico);
      })
      .catch((erro: unknown) => {
        console.error("Não foi possível carregar o histórico do funcionário:", erro);
        if (componenteAtivo) {
          setTimelineError(
            erro instanceof Error ? erro.message : "Não foi possível carregar o histórico."
          );
        }
      })
      .finally(() => {
        if (componenteAtivo) setTimelineLoading(false);
      });

    return () => {
      componenteAtivo = false;
    };
  }, [employee]);

  const handleAddObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !newObs.trim() || !responsavelAtual) return;

    setTimelineSaving(true);
    setTimelineError("");
    let observacaoGravada = false;
    try {
      await adicionarObservacaoHistorico(employee.recordId, newObs, newCategory);
      observacaoGravada = true;
      setNewObs("");
      setEvents(await obterHistoricoFuncionario(employee.recordId));
    } catch (erro) {
      console.error("Não foi possível adicionar a observação ao histórico:", erro);
      const detalhe = erro instanceof Error ? erro.message : String(erro);
      setTimelineError(observacaoGravada
        ? `A observação foi gravada, mas não foi possível atualizar o histórico: ${detalhe}`
        : detalhe);
    } finally {
      setTimelineSaving(false);
    }
  };

  if (!employee) return null;


  const risk = calcularRisco(employee);
  const vacationStatus = calcularStatusFerias(employee);
  const vacationPeriods = [...(employee.periodosFerias || [])]
    .sort((left, right) => left.dataInicio.localeCompare(right.dataInicio));
  const pendencias = identificarPendencias(employee);
  const dias = calcularDiasRestantes(employee.dataTerminoReal);
  const initials = employee.nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const contractProgress = (() => {
    const start = new Date(employee.dataAdmissao).getTime();
    const end = new Date(employee.dataTerminoReal).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
    const elapsed = Date.now() - start;
    return Math.max(0, Math.min(100, Math.round((elapsed / (end - start)) * 100)));
  })();

  const contractTone =
    risk === "Crítico"
      ? "border-rose-200 bg-rose-50/70 text-rose-700"
      : risk === "Alto"
        ? "border-amber-200 bg-amber-50/70 text-amber-700"
        : "border-sky-200 bg-sky-50 text-cadet";

  const additionalDetails = [
    { label: "Global ID", value: employee.globalId },
    {
      label: "Gender",
      value: employee.genero !== undefined
        ? genders[employee.genero] === "Male"
          ? "Masculino"
          : "Feminino"
        : "",
    },
    { label: "Employee Initials", value: employee.iniciaisFuncionario },
    {
      label: "Employee Status",
      value: employee.statusDataverse !== undefined
        ? ({
            583150000: "Ativo",
            583150001: "Férias",
            583150002: "Licença",
            583150003: "Inativo",
            583150004: "Encerrado",
          }[employee.statusDataverse] || employeeStatuses[employee.statusDataverse])
        : "",
    },
    {
      label: "Temple",
      value: employee.templo === undefined
        ? ""
        : employee.templo
          ? "Sim"
          : "Não",
    },
    {
      label: "Status (statecode)",
      value: employee.statusRegistro === undefined
        ? ""
        : employee.statusRegistro === 0
          ? "Ativo"
          : "Inativo",
    },
  ];

  const handleCopyEmail = () => {
    if (!employee.emailCorporativo) return;
    navigator.clipboard.writeText(employee.emailCorporativo);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleCopySummary = () => {
    const resumo = `Nome: ${employee.nome}
Cargo: ${employee.cargo || "Não definido"}
Zona: ${employee.zona || "Não cadastrada"}
Turno: ${employee.turno || "Não cadastrado"}
Idiomas: ${employee.idiomas?.join(", ") || "Nenhum"}
Status: ${employee.statusFuncionario}
Término: ${formatarDataBR(employee.dataTerminoReal)}
Risco: ${risk}`;

    navigator.clipboard.writeText(resumo);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      {/* Backdrop overlay */}
      <div
          className="absolute inset-0 bg-sky-900/30 backdrop-blur-[3px] transition-opacity"
        onClick={onClose}
      />

      {/* Flyout panel */}
      <div className="relative w-full max-w-xl bg-slate-50 h-full shadow-[0_0_70px_rgba(0,48,87,0.28)] flex flex-col z-10 transition-transform duration-300 translate-x-0 sm:rounded-l-[28px] overflow-hidden">
        {/* Header */}
        <div className="border-b border-sky-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-yinmn to-cadet text-sm font-bold text-white shadow-[0_8px_20px_rgba(0,97,132,0.24)]">
                {initials || <User className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-[0.16em] text-yinmn">Nome completo</span>
                <h2 id="slide-over-title" className="max-w-[320px] truncate text-base font-bold tracking-tight text-oxford">
                  {employee.nome}
                </h2>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400">
                  <span>{employee.cargo || "Cargo não informado"}</span>
                  <span aria-hidden="true">•</span>
                  <span className="font-mono">
                    Employee ID: {employee.idFuncionario || "Pendente"}
                  </span>
                </p>
              </div>
            </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-sky-50 hover:text-yinmn cursor-pointer"
            aria-label="Fechar detalhes do funcionário"
          >
            <X className="h-4 w-4" />
          </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 pl-[60px]">
            <StatusBadge status={employee.statusFuncionario} />
            <RiskBadge level={risk} />
            {pendencias.length > 0 && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-700">
                {pendencias.length} {pendencias.length === 1 ? "pendência" : "pendências"}
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">

          {/* Dados do Cargo e Turno */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Informações</h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="bg-white p-3.5 rounded-[16px] border border-sky-100 shadow-[0_8px_20px_rgba(0,48,87,0.04)]">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
                  <BriefcaseBusiness className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase font-bold">Cargo</span>
                </div>
                <p className="text-xs font-bold text-oxford truncate">
                  {employee.cargo || "Não definido"}
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-[16px] border border-sky-100 shadow-[0_8px_20px_rgba(0,48,87,0.04)]">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase font-bold">Turno</span>
                </div>
                <p className="text-xs font-bold text-oxford truncate">
                  {employee.turno || "Não cadastrado"}
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-[16px] border border-sky-100 shadow-[0_8px_20px_rgba(0,48,87,0.04)]">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase font-bold">Zona</span>
                </div>
                <p className="text-xs font-bold text-oxford truncate">
                  {employee.zona || "Não cadastrada"}
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-[16px] border border-sky-100 shadow-[0_8px_20px_rgba(0,48,87,0.04)]">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
                  <Globe2 className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase font-bold">Idiomas</span>
                </div>
                <p className="text-xs font-bold text-oxford truncate" title={employee.idiomas?.join(", ") || "Nenhum"}>
                  {employee.idiomas?.join(", ") || "Nenhum cadastrado"}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              Dados adicionais
            </h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {additionalDetails.map((detail) => (
                <div
                  key={detail.label}
                  className="min-w-0 rounded-[16px] border border-sky-100 bg-white p-3.5 shadow-[0_8px_20px_rgba(0,48,87,0.04)]"
                >
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">
                    {detail.label}
                  </span>
                  <p className="break-words text-xs font-bold text-oxford">
                    {detail.value || "Não informado"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Datas de Contrato */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Informações Contratual</h3>
            <div className="overflow-hidden rounded-[18px] border border-sky-100 bg-white shadow-[0_8px_20px_rgba(0,48,87,0.04)]">
              <div className="grid grid-cols-2 divide-x divide-sky-100">
                <div className="p-3.5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-slate-400">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="text-[9px] font-bold uppercase">Data de Admissão</span>
                  </div>
                  <p className="text-xs font-semibold text-oxford">
                    {formatarDataBR(employee.dataAdmissao)}
                  </p>
                </div>

                <div className="p-3.5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-slate-400">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="text-[9px] font-bold uppercase">Término de Contrato</span>
                  </div>
                  <p className="text-xs font-semibold text-oxford">
                    {formatarDataBR(employee.dataTerminoReal)}
                  </p>
                </div>
              </div>

              {employee.statusFuncionario !== "Encerrado" && employee.dataTerminoReal && (
                <div className="border-t border-sky-100 bg-sky-50/50 p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">Tempo restante</span>
                      <span className="text-base font-bold text-oxford">
                        {dias !== null && dias >= 0 ? `${dias} dias` : "Prazo encerrado"}
                      </span>
                    </div>
                    <span className={`rounded-lg border px-2.5 py-1 text-[9px] font-bold ${contractTone}`}>
                      {risk}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Progresso da vigência contratual"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={contractProgress}
                    className="h-1.5 overflow-hidden rounded-full bg-sky-100"
                  >
                    <div className="h-full rounded-full bg-gradient-to-r from-yinmn to-jordy" style={{ width: `${contractProgress}%` }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[8px] font-medium text-slate-400">
                    <span>Início</span>
                    <span>{contractProgress}% da vigência</span>
                    <span>Término</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Ferias e ausencias */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                {"F\u00e9rias e aus\u00eancias"}
              </h3>
              <button
                type="button"
                onClick={() => onConfigureVacation(employee)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-100 bg-white px-3 py-2 text-[10px] font-bold text-yinmn transition hover:bg-sky-50"
              >
                <FileEdit className="h-3.5 w-3.5" />
                {"Configurar f\u00e9rias"}
              </button>
            </div>

            <div className="overflow-hidden rounded-[18px] border border-sky-100 bg-white shadow-[0_8px_20px_rgba(0,48,87,0.04)]">
              <div className="flex items-center justify-between gap-3 border-b border-sky-100 bg-sky-50/50 p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-yinmn">
                    <Plane className="h-4 w-4" />
                  </span>
                  <div>
                    <span className="block text-[9px] font-bold uppercase text-slate-400">
                      {"Situa\u00e7\u00e3o atual"}
                    </span>
                    <strong className="text-xs text-oxford">{vacationStatus}</strong>
                  </div>
                </div>
                {employee.diasVendidosFerias > 0 && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-700">
                    {employee.diasVendidosFerias} dias de abono
                  </span>
                )}
              </div>

              <div className="space-y-2 p-3.5">
                {vacationPeriods.length > 0 ? vacationPeriods.map((period, index) => (
                  <div key={period.recordId || `${period.dataInicio}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-sky-50 bg-slate-50/70 p-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-yinmn" />
                      <div className="min-w-0">
                        <span className="block text-[9px] font-bold uppercase text-slate-400">{"Per\u00edodo"} {index + 1}</span>
                        <span className="block text-xs font-semibold text-oxford">
                          {formatarDataBR(period.dataInicio)} a {formatarDataBR(period.dataFim)}
                        </span>
                      </div>
                    </div>
                    <strong className="shrink-0 text-[10px] text-slate-500">{period.dias} dias</strong>
                  </div>
                )) : (
                  <div className="py-3 text-center">
                    <p className="text-xs font-semibold text-slate-500">{"Nenhum per\u00edodo registrado."}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{"Use o bot\u00e3o acima para configurar as datas."}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contatos Corporativos */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Contatos</h3>
            
            <div className="space-y-2">
              {/* E-mail */}
              <div className="flex items-center justify-between rounded-[16px] border border-sky-100 bg-white p-3 shadow-[0_6px_16px_rgba(0,48,87,0.035)] transition-all hover:border-sky-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-yinmn">
                    <Mail className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <span className="text-[9px] uppercase font-bold text-gray-400 block">Corporate Email</span>
                    <p className="text-xs text-gray-700 truncate font-semibold">
                      {employee.emailCorporativo || "Não cadastrado"}
                    </p>
                  </div>
                </div>
                {employee.emailCorporativo && (
                  <button
                    onClick={handleCopyEmail}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-sky-50 hover:text-yinmn"
                    title="Copiar e-mail"
                    aria-label="Copiar e-mail corporativo"
                  >
                    {copiedEmail ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  { label: "BYU Email", value: employee.emailBYU },
                  { label: "Personal Email", value: employee.emailPessoal },
                ].map((contact) => (
                  <div
                    key={contact.label}
                    className="min-w-0 rounded-[16px] border border-sky-100 bg-white p-3 shadow-[0_6px_16px_rgba(0,48,87,0.035)]"
                  >
                    <span className="block text-[9px] font-bold uppercase text-slate-400">
                      {contact.label}
                    </span>
                    <p className="break-all text-xs font-semibold text-slate-700">
                      {contact.value || "Não cadastrado"}
                    </p>
                  </div>
                ))}
              </div>

              {/* Zoom Link */}
              <div className="flex items-center justify-between rounded-[16px] border border-sky-100 bg-white p-3 shadow-[0_6px_16px_rgba(0,48,87,0.035)] transition-all hover:border-sky-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-900">
                    <Video className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <span className="text-[9px] uppercase font-bold text-gray-400 block">Zoom Link</span>
                    <p className="text-xs text-gray-700 truncate font-semibold">
                      {employee.linkZoom || "Não cadastrado"}
                    </p>
                  </div>
                </div>
                {employee.linkZoom ? (
                  <a
                    href={employee.linkZoom}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center rounded-lg bg-yinmn p-2 text-white shadow-sm transition-colors hover:bg-cadet"
                    title="Acessar sala de aula virtual"
                    aria-label="Abrir sala pessoal do Zoom"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">Não disponível</span>
                )}
              </div>
            </div>
          </div>

          {/* Pendências identificadas */}
          {pendencias.length > 0 && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 space-y-2">
              <div className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="w-4 h-4" />
                <h4 className="text-xs font-black uppercase tracking-wider">Inconsistências Cadastrais ({pendencias.length})</h4>
              </div>
              <ul className="space-y-1.5 pl-5 list-disc text-xs text-red-900">
                {pendencias.map((p, i) => (
                  <li key={i}>
                    <span className="font-bold">{p.label}</span>
                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded ml-1.5 font-bold uppercase">{p.severity}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Seção Linha do Tempo */}
          <div className="space-y-4 rounded-[18px] border border-sky-100 bg-white p-4 shadow-[0_8px_20px_rgba(0,48,87,0.04)]">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-yinmn" />
                <span>Histórico</span>
              </h3>
              
              {/* Filtro de Categoria */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-lg border border-sky-100 bg-sky-50 px-2 py-1.5 text-[9px] font-bold text-slate-500 focus:outline-none"
              >
                <option value="all">Todas as categorias</option>
                <option value="Cadastro">Cadastro</option>
                <option value="Contrato">Contrato</option>
                <option value="Férias">Férias</option>
                <option value="Substituição">Substituição</option>
                <option value="Idioma">Idioma</option>
                <option value="Risco">Risco</option>
                <option value="Alteração administrativa">Alt. Administrativa</option>
              </select>
            </div>

            {/* Linha do tempo visual */}
            <div className="relative ml-2.5 space-y-3 border-l-2 border-sky-100 pb-1 pl-4 pt-1">
              {timelineLoading && (
                <p className="text-xs text-slate-400 font-semibold">Carregando histórico do Dataverse...</p>
              )}
              {timelineError && (
                <p role="alert" className="text-xs text-rose-600 font-semibold">{timelineError}</p>
              )}
              {events
                .filter((evt) => selectedCategory === "all" || evt.categoria === selectedCategory)
                .map((evt) => {
                  let bulletBg = "bg-slate-400";
                  let categoryColor = "text-slate-500";
                  let Icon = Settings;

                  if (evt.categoria === "Cadastro") {
                    bulletBg = "bg-emerald-500";
                    categoryColor = "text-emerald-600";
                    Icon = User;
                  } else if (evt.categoria === "Contrato") {
                    bulletBg = "bg-sky-500";
                    categoryColor = "text-sky-600";
                    Icon = FileText;
                  } else if (evt.categoria === "Férias") {
                    bulletBg = "bg-yinmn";
                    categoryColor = "text-yinmn";
                    Icon = Plane;
                  } else if (evt.categoria === "Substituição") {
                    bulletBg = "bg-amber-500";
                    categoryColor = "text-amber-600";
                    Icon = RefreshCw;
                  } else if (evt.categoria === "Idioma") {
                    bulletBg = "bg-violet-500";
                    categoryColor = "text-violet-600";
                    Icon = Globe2;
                  } else if (evt.categoria === "Risco") {
                    bulletBg = "bg-rose-500";
                    categoryColor = "text-rose-600";
                    Icon = AlertTriangle;
                  } else if (evt.categoria === "Alteração administrativa") {
                    bulletBg = "bg-slate-500";
                    categoryColor = "text-slate-600";
                    Icon = Settings;
                  }

                  return (
                    <div key={evt.recordId} className="relative group">
                      {/* Timeline Dot */}
                      <span className="absolute -left-[27px] top-1 flex items-center justify-center w-5 h-5 rounded-full bg-white border-2 border-sky-100 shadow-sm">
                        <span className={`w-2 h-2 rounded-full ${bulletBg}`} />
                      </span>

                      {/* Event Details */}
                      <div className="space-y-1 rounded-xl border border-sky-100 bg-slate-50 p-3 text-xs transition-colors hover:border-sky-200">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                          <span>{formatarDataBR(evt.data)}</span>
                          <span className={`uppercase text-[8px] font-black ${categoryColor}`}>{evt.categoria}</span>
                        </div>
                        <h4 className="text-xs font-black text-oxford flex items-center gap-1">
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span>{evt.tipo}</span>
                        </h4>
                        <p className="break-words text-xs text-slate-500 leading-relaxed font-semibold">{evt.descricao}</p>
                        {evt.responsavel && (
                          <div className="text-[10px] text-slate-400 font-medium">
                            Responsável: <span className="font-bold text-slate-500">{evt.responsavel}</span>
                          </div>
                        )}
                        {evt.status && (
                          <span className="inline-block text-[9px] bg-white border border-slate-100 text-slate-500 px-1.5 py-0.2 rounded-md font-bold mt-1">
                            Status: {evt.status}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

              {events.filter((evt) => selectedCategory === "all" || evt.categoria === selectedCategory).length === 0 && (
                <p className="text-xs text-slate-400 font-semibold italic text-center py-2">
                  {timelineLoading || timelineError ? "" : "Nenhum evento registrado nesta categoria."}
                </p>
              )}
            </div>

            {/* Formulário rápido para adicionar observação */}
            <form onSubmit={handleAddObservation} className="space-y-2.5 rounded-xl border border-sky-100 bg-sky-50/60 p-3">
              <span className="block text-[9px] font-black uppercase tracking-wide text-slate-400">Adicionar ao histórico</span>
              <p
                className={`text-[10px] font-medium ${erroIdentificacaoUsuario ? "text-rose-600" : "text-slate-500"}`}
                role={erroIdentificacaoUsuario ? "alert" : undefined}
              >
                Responsável: {responsavelAtual || (erroIdentificacaoUsuario ? "Não foi possível identificar o usuário" : "Identificando usuário...")}
              </p>
              <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                <input
                  type="text"
                  placeholder="Escreva uma observação..."
                  value={newObs}
                  maxLength={850}
                  onChange={(e) => setNewObs(e.target.value)}
                  className="min-w-0 text-xs bg-white border border-sky-100 rounded-lg px-3 py-2 focus:outline-none focus:border-jordy text-slate-700"
                />
                
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as TimelineEventCategory)}
                  className="max-w-[105px] text-[10px] font-bold text-slate-600 bg-white border border-sky-100 rounded-lg px-2 focus:outline-none"
                >
                  <option value="Alteração administrativa">Admin</option>
                  <option value="Cadastro">Cadastro</option>
                  <option value="Contrato">Contrato</option>
                  <option value="Férias">Férias</option>
                  <option value="Substituição">Subst.</option>
                  <option value="Idioma">Idioma</option>
                  <option value="Risco">Risco</option>
                </select>

                <button
                  type="submit"
                  disabled={!responsavelAtual || timelineSaving || !newObs.trim()}
                  className="bg-yinmn hover:bg-cadet text-white font-bold p-2 rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Adicionar registro ao histórico"
                  title={!responsavelAtual ? "Aguardando identificação do usuário" : undefined}
                >
                  {timelineSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="flex flex-col gap-2 border-t border-sky-100 bg-white p-3 sm:flex-row">
          {/* Copiar Resumo */}
          <button
            onClick={handleCopySummary}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-sky-100 bg-white px-4 py-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-sky-50 active:scale-[0.98]"
          >
            {copiedSummary ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-600">Resumo copiado</span>
              </>
            ) : (
              <>
                <ClipboardCheck className="w-4 h-4" />
                <span>Copiar resumo</span>
              </>
            )}
          </button>

          {/* Editar Cadastro */}
          <button
            onClick={() => onEdit(employee)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-yinmn px-4 py-2.5 text-[11px] font-bold text-white shadow-[0_8px_18px_rgba(0,97,132,0.22)] transition-all hover:bg-cadet active:scale-[0.98]"
          >
            <FileEdit className="w-4 h-4" />
            <span>Editar cadastro</span>
          </button>
        </div>
      </div>
    </div>
  );
};
