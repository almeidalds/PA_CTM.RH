/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
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
import { StatusBadge } from "./StatusBadge";
import { RiskBadge } from "./RiskBadge";
import { obterTimelineEvents, adicionarTimelineEvent } from "../services/additionalDataSource";

interface EmployeeDetailsPanelProps {
  employee: RhEmployee | null;
  onClose: () => void;
  onEdit: (employee: RhEmployee) => void;
}

export const EmployeeDetailsPanel: React.FC<EmployeeDetailsPanelProps> = ({
  employee,
  onClose,
  onEdit
}) => {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Timeline states
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [newObs, setNewObs] = useState("");
  const [newCategory, setNewCategory] = useState<TimelineEventCategory>("Alteração administrativa");

  useEffect(() => {
    if (employee) {
      const stored = obterTimelineEvents(employee.recordId);
      
      // Se não houver eventos cadastrados para esse funcionário, criamos eventos dinâmicos baseados no cadastro dele
      if (stored.length === 0) {
        const autoEvents: TimelineEvent[] = [];
        
        if (employee.dataAdmissao) {
          autoEvents.push({
            recordId: `auto-adm-${employee.recordId}`,
            data: employee.dataAdmissao,
            tipo: "Data de admissão",
            descricao: `Admissão contratual registrada no cargo de ${employee.cargo || "Instrutor"}.`,
            responsavel: "Robson (Gerente de RH)",
            categoria: "Cadastro",
            status: "Concluído"
          });
        }
        
        if (employee.dataTerminoReal) {
          autoEvents.push({
            recordId: `auto-term-${employee.recordId}`,
            data: employee.dataTerminoReal,
            tipo: "Data de término de contrato",
            descricao: "Previsão de encerramento da vigência do contrato atual.",
            responsavel: "Sistema de Alertas",
            categoria: "Contrato",
            status: "Planejado"
          });
        }

        if (employee.periodosFerias && employee.periodosFerias.length > 0) {
          employee.periodosFerias.forEach((f, idx) => {
            autoEvents.push({
              recordId: `auto-fer-${idx}-${employee.recordId}`,
              data: f.dataInicio,
              tipo: "Férias marcadas",
              descricao: `Período programado de gozo de férias por ${f.dias} dias (término em ${formatarDataBR(f.dataFim)}).`,
              responsavel: "Letícia (Analista)",
              categoria: "Férias",
              status: "Confirmado"
            });
          });
        }
        
        setEvents(autoEvents.sort((a, b) => b.data.localeCompare(a.data)));
      } else {
        setEvents(stored);
      }
    }
  }, [employee]);

  const handleAddObservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !newObs.trim()) return;

    const dataHoje = new Date().toISOString().split("T")[0];
    const updatedEvents = adicionarTimelineEvent(employee.recordId, {
      data: dataHoje,
      tipo: "Observação adicionada",
      descricao: newObs.trim(),
      responsavel: "Coordenação de RH",
      categoria: newCategory,
      status: "Adicionado",
      observacoes: ""
    });

    setEvents(updatedEvents);
    setNewObs("");
  };

  if (!employee) return null;


  const risk = calcularRisco(employee);
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
          className="absolute inset-0 bg-[#395886]/30 backdrop-blur-[3px] transition-opacity"
        onClick={onClose}
      />

      {/* Flyout panel */}
      <div className="relative w-full max-w-xl bg-[#f0f3fa] h-full shadow-[0_0_70px_rgba(57,88,134,0.28)] flex flex-col z-10 transition-transform duration-300 translate-x-0 sm:rounded-l-[28px] overflow-hidden">
        {/* Header */}
        <div className="border-b border-sky-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-yinmn to-cadet text-sm font-bold text-white shadow-[0_8px_20px_rgba(99,142,203,0.24)]">
                {initials || <User className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-[0.16em] text-yinmn">Perfil do funcionário</span>
                <h2 id="slide-over-title" className="max-w-[320px] truncate text-base font-bold tracking-tight text-oxford">
                  {employee.nome}
                </h2>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400">
                  <span>{employee.cargo || "Cargo não informado"}</span>
                  <span aria-hidden="true">•</span>
                  <span className="font-mono">{employee.idFuncionario || "ID pendente"}</span>
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
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-white p-3.5 rounded-[16px] border border-sky-100 shadow-[0_8px_20px_rgba(57,88,134,0.04)]">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
                  <BriefcaseBusiness className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase font-bold">Cargo</span>
                </div>
                <p className="text-xs font-bold text-oxford truncate">
                  {employee.cargo || "Não definido"}
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-[16px] border border-sky-100 shadow-[0_8px_20px_rgba(57,88,134,0.04)]">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase font-bold">Turno</span>
                </div>
                <p className="text-xs font-bold text-oxford truncate">
                  {employee.turno || "Não cadastrado"}
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-[16px] border border-sky-100 shadow-[0_8px_20px_rgba(57,88,134,0.04)]">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase font-bold">Zona</span>
                </div>
                <p className="text-xs font-bold text-oxford truncate">
                  {employee.zona || "Não cadastrada"}
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-[16px] border border-sky-100 shadow-[0_8px_20px_rgba(57,88,134,0.04)]">
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

          {/* Datas de Contrato */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Vigência contratual</h3>
            <div className="overflow-hidden rounded-[18px] border border-sky-100 bg-white shadow-[0_8px_20px_rgba(57,88,134,0.04)]">
              <div className="grid grid-cols-2 divide-x divide-sky-100">
                <div className="p-3.5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-slate-400">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="text-[9px] font-bold uppercase">Admissão</span>
                  </div>
                  <p className="text-xs font-semibold text-oxford">
                    {formatarDataBR(employee.dataAdmissao)}
                  </p>
                </div>

                <div className="p-3.5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-slate-400">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="text-[9px] font-bold uppercase">Término previsto</span>
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
                    <div className="h-full rounded-full bg-gradient-to-r from-yinmn to-[#8aaee0]" style={{ width: `${contractProgress}%` }} />
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

          {/* Contatos Corporativos */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Contatos</h3>
            
            <div className="space-y-2">
              {/* E-mail */}
              <div className="flex items-center justify-between rounded-[16px] border border-sky-100 bg-white p-3 shadow-[0_6px_16px_rgba(57,88,134,0.035)] transition-all hover:border-sky-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-yinmn">
                    <Mail className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <span className="text-[9px] uppercase font-bold text-gray-400 block">E-mail Corporativo</span>
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

              {/* Zoom Link */}
              <div className="flex items-center justify-between rounded-[16px] border border-sky-100 bg-white p-3 shadow-[0_6px_16px_rgba(57,88,134,0.035)] transition-all hover:border-sky-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#d5deef] text-[#395886]">
                    <Video className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <span className="text-[9px] uppercase font-bold text-gray-400 block">Sala Pessoal do Zoom</span>
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
              <div className="flex items-center gap-2 text-[#DC2626]">
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
          <div className="space-y-4 rounded-[18px] border border-sky-100 bg-white p-4 shadow-[0_8px_20px_rgba(57,88,134,0.04)]">
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
                <option value="Risco">Risco</option>
                <option value="Alteração administrativa">Alt. Administrativa</option>
              </select>
            </div>

            {/* Linha do tempo visual */}
            <div className="relative ml-2.5 space-y-3 border-l-2 border-sky-100 pb-1 pl-4 pt-1">
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
                      <div className="space-y-1 rounded-xl border border-sky-100 bg-[#f0f3fa] p-3 text-xs transition-colors hover:border-sky-200">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                          <span>{formatarDataBR(evt.data)}</span>
                          <span className={`uppercase text-[8px] font-black ${categoryColor}`}>{evt.categoria}</span>
                        </div>
                        <h4 className="text-xs font-black text-oxford flex items-center gap-1">
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span>{evt.tipo}</span>
                        </h4>
                        <p className="text-xs text-slate-500 leading-relaxed font-semibold">{evt.descricao}</p>
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
                  Nenhum evento registrado nesta categoria.
                </p>
              )}
            </div>

            {/* Formulário rápido para adicionar observação */}
            <form onSubmit={handleAddObservation} className="space-y-2.5 rounded-xl border border-sky-100 bg-sky-50/60 p-3">
              <span className="block text-[9px] font-black uppercase tracking-wide text-slate-400">Adicionar ao histórico</span>
              <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                <input
                  type="text"
                  placeholder="Escreva uma observação..."
                  value={newObs}
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
                  <option value="Risco">Risco</option>
                </select>

                <button
                  type="submit"
                  className="bg-yinmn hover:bg-cadet text-white font-bold p-2 rounded-lg transition-all"
                  aria-label="Adicionar registro ao histórico"
                >
                  <Plus className="w-4 h-4" />
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
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-yinmn px-4 py-2.5 text-[11px] font-bold text-white shadow-[0_8px_18px_rgba(99,142,203,0.22)] transition-all hover:bg-cadet active:scale-[0.98]"
          >
            <FileEdit className="w-4 h-4" />
            <span>Editar cadastro</span>
          </button>
        </div>
      </div>
    </div>
  );
};
