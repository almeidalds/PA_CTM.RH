/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { getCurrentUserDisplayName } from "../services/currentUser";
import {
  X,
  Camera,
  Mail,
  Phone,
  Copy,
  Check,
  Video,
  AlertTriangle,
  User,
  Calendar,
  Clock,
  Globe2,
  FileEdit,
  Plus,
  FileText,
  Plane,
  RefreshCw,
  Settings,
  MapPin,
  BriefcaseBusiness,
  Trash2,
  ExternalLink
} from "lucide-react";
import { AppSettings, RhEmployee, TimelineEvent, TimelineEventCategory } from "../types/rh";
import { formatarDataBR, calcularDiasRestantes } from "../utils/dateUtils";
import { calcularRisco, identificarPendencias } from "../utils/riskUtils";
import { calcularStatusFerias } from "../utils/vacationUtils";
import { StatusBadge } from "./StatusBadge";
import { RiskBadge } from "./RiskBadge";
import {
  adicionarObservacaoHistorico,
  excluirObservacaoHistorico,
  obterHistoricoFuncionario,
} from "../services/employeeTimeline";
import {
  Ctmbrasi_employeerecordsesctmbrasi_employeestatus as employeeStatuses,
  Ctmbrasi_employeerecordsesctmbrasi_gender as genders,
} from "../generated/models/Ctmbrasi_employeerecordsesModel";
import { Ctmbrasi_employeerecordsesService } from "../generated/services/Ctmbrasi_employeerecordsesService";
import FuncionarioAvatar, {
  atualizarCacheFotoFuncionario,
  EMPLOYEE_PHOTO_COLUMN,
} from "./FuncionarioAvatar";
import { PendingEditorPanel } from "./PendingEditorPanel";
import { EmployeeTranslationSection } from "./EmployeeTranslationSection";
import { EmployeeTeachingSection } from "./EmployeeTeachingSection";

const EMPLOYEE_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/bmp"]);

interface EmployeeDetailsPanelProps {
  employee: RhEmployee | null;
  appSettings: AppSettings;
  onClose: () => void;
  onSave: (employee: RhEmployee) => Promise<void>;
  onConfigureVacation: (employee: RhEmployee) => void;
}

export const EmployeeDetailsPanel: React.FC<EmployeeDetailsPanelProps> = ({
  employee,
  appSettings,
  onClose,
  onSave,
  onConfigureVacation,
}) => {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoVersion, setPhotoVersion] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const selectedEmployeeIdRef = useRef(employee?.recordId);
  selectedEmployeeIdRef.current = employee?.recordId;

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
  const [confirmingObservationId, setConfirmingObservationId] = useState<string | null>(null);
  const [deletingObservationId, setDeletingObservationId] = useState<string | null>(null);

  useEffect(() => {
    if (!employee) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [employee]);

  useEffect(() => {
    if (!employee || isEditing) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [employee, isEditing, onClose]);

  useEffect(() => {
    let componenteAtivo = true;

    const carregarResponsavel = async () => {
      try {
        const nome = await getCurrentUserDisplayName();

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

  const handleDeleteObservation = async (eventId: string) => {
    if (!employee) return;

    setDeletingObservationId(eventId);
    setTimelineError("");
    try {
      await excluirObservacaoHistorico(eventId);
      setEvents((currentEvents) =>
        currentEvents.filter((event) => event.recordId !== eventId)
      );
      setConfirmingObservationId(null);
    } catch (error) {
      console.error("Não foi possível excluir a observação do histórico:", error);
      setTimelineError(
        error instanceof Error ? error.message : "Não foi possível excluir a observação do histórico."
      );
    } finally {
      setDeletingObservationId(null);
    }
  };

  if (!employee) return null;


  const risk = calcularRisco(employee);
  const vacationStatus = calcularStatusFerias(employee);
  const vacationPeriods = [...(employee.periodosFerias || [])]
    .sort((left, right) => left.dataInicio.localeCompare(right.dataInicio));
  const pendencias = identificarPendencias(employee);
  const dias = calcularDiasRestantes(employee.dataTerminoReal);

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
    { label: "ID global", value: employee.globalId },
    {
      label: "Gênero",
      value: employee.genero !== undefined
        ? genders[employee.genero] === "Male"
          ? "Masculino"
          : "Feminino"
        : "",
    },
    { label: "Nome da Plaqueta", value: employee.nomePlaqueta },
    {
      label: "Status no sistema",
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
      label: "Templo",
      value: employee.templo === undefined
        ? ""
        : employee.templo
          ? "Sim"
          : "Não",
    },
    {
      label: "Status do registro",
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

  const handlePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !employee) return;

    if (!EMPLOYEE_PHOTO_TYPES.has(file.type)) {
      setPhotoError("Selecione uma imagem JPEG, PNG, GIF ou BMP.");
      return;
    }

    const employeeId = employee.recordId;
    setPhotoError("");
    setPhotoUploading(true);

    try {
      const result = await Ctmbrasi_employeerecordsesService.upload(
        employeeId,
        EMPLOYEE_PHOTO_COLUMN,
        file,
        file.name,
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Não foi possível salvar a foto no Dataverse.");
      }

      await atualizarCacheFotoFuncionario(employeeId, file);
      if (selectedEmployeeIdRef.current === employeeId) {
        setPhotoVersion((version) => version + 1);
      }
    } catch (error) {
      console.error("Não foi possível salvar a foto do funcionário:", error);
      if (selectedEmployeeIdRef.current === employeeId) {
        setPhotoError(
          error instanceof Error ? error.message : "Não foi possível salvar a foto no Dataverse."
        );
      }
    } finally {
      if (selectedEmployeeIdRef.current === employeeId) setPhotoUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 sm:p-5"
      role="presentation"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[3px]"
        onClick={() => {
          if (!isEditing) onClose();
        }}
      />

      <section
        className="relative z-10 flex max-h-[96dvh] w-full max-w-[1280px] flex-col overflow-hidden rounded-[22px] border border-white bg-slate-50 shadow-[0_28px_80px_rgba(0,48,87,0.24)] sm:max-h-[94dvh] sm:rounded-[30px]"
        aria-labelledby={isEditing ? "editor-panel-title" : "employee-details-title"}
        role="dialog"
        aria-modal="true"
      >
        {isEditing ? (
          <PendingEditorPanel
            mode="edit"
            embedded
            employee={employee}
            appSettings={appSettings}
            onClose={() => setIsEditing(false)}
            onSave={onSave}
          />
        ) : (
          <>
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden border-b border-slate-200 bg-white px-4 py-4 sm:px-6 sm:py-5 lg:px-7">
          <div aria-hidden="true" className="absolute -right-12 -top-24 h-52 w-[28rem] rounded-full bg-gradient-to-br from-sky-200/45 via-sky-50 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-20 shrink-0 cursor-pointer rounded-full border border-transparent bg-white/80 p-2.5 text-slate-400 backdrop-blur-sm transition-colors hover:border-slate-200 hover:text-oxford sm:right-6 sm:top-5"
            aria-label="Fechar detalhes do funcionário"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative z-10 grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
            <div className="flex min-w-0 items-center gap-3 pr-10 sm:gap-4">
              <div className="relative h-20 w-20 shrink-0 sm:h-24 sm:w-24 lg:h-28 lg:w-28">
                <FuncionarioAvatar
                  key={`${employee.recordId}-${photoVersion}`}
                  funcionarioId={employee.recordId}
                  nome={employee.nome}
                  fotoUrl={employee.fotoUrl}
                  fotoTimestamp={employee.fotoTimestamp}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-yinmn text-white shadow-md transition-colors hover:bg-cadet disabled:cursor-wait disabled:opacity-70"
                  title="Adicionar ou alterar foto"
                  aria-label="Adicionar ou alterar foto do funcionário"
                >
                  {photoUploading
                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    : <Camera className="h-3.5 w-3.5" />}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/bmp"
                  className="sr-only"
                  onChange={handlePhotoSelected}
                  aria-label={`Selecionar foto de ${employee.nome}`}
                />
              </div>
              <div className="min-w-0">
                <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-yinmn">Perfil do funcionário</span>
                <h2 id="employee-details-title" className="max-w-[min(68vw,640px)] truncate text-xl font-bold tracking-tight text-oxford sm:text-2xl">
                  {employee.nome}
                </h2>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  <span>{employee.cargo || "Cargo não informado"}</span>
                  <span aria-hidden="true">•</span>
                  <span>
                    ID: <strong className="font-semibold text-slate-600">{employee.idFuncionario || "Pendente"}</strong>
                  </span>
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <StatusBadge status={employee.statusFuncionario} />
                  <RiskBadge level={risk} />
                  {pendencias.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                      <AlertTriangle className="h-3 w-3" />
                      {pendencias.length} {pendencias.length === 1 ? "pendência" : "pendências"}
                    </span>
                  )}
                </div>
                {photoError && (
                  <p role="alert" className="mt-2 max-w-xl text-xs font-medium text-rose-600">
                    {photoError}
                  </p>
                )}
              </div>
            </div>

            <div className="hidden grid-cols-2 gap-3 pr-10 lg:grid">
              <div className="min-h-28 rounded-2xl bg-sky-50 p-4">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-yinmn shadow-sm">
                  <Calendar className="h-4 w-4" />
                </div>
                <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Prazo contratual</span>
                <strong className="mt-1 block text-base text-oxford">
                  {dias !== null && dias >= 0 ? `${dias} dias` : dias !== null ? "Encerrado" : "Não informado"}
                </strong>
              </div>

              <div className="min-h-28 rounded-2xl bg-sky-100/60 p-4">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-yinmn shadow-sm">
                  <Plane className="h-4 w-4" />
                </div>
                <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Situação de férias</span>
                <strong className="mt-1 block truncate text-base text-oxford" title={vacationStatus}>{vacationStatus}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-3 sm:p-4 lg:p-5">
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">

          {/* Dados do Cargo e Turno */}
          <div className="flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_24px_rgba(0,48,87,0.045)] sm:p-5">
            <h3 className="flex items-center gap-2 text-xs font-bold text-oxford">
              <span className="h-4 w-1 rounded-full bg-jordy" />
              Informações profissionais
            </h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="flex min-h-20 min-w-0 flex-col justify-center rounded-xl border border-transparent bg-slate-50 p-3.5 transition-colors hover:border-sky-200 hover:bg-white">
                <div className="mb-1.5 flex items-center gap-1.5 text-yinmn">
                  <BriefcaseBusiness className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cargo</span>
                </div>
                <p className="truncate text-sm font-semibold text-oxford">
                  {employee.cargo || "Não definido"}
                </p>
              </div>

              <div className="flex min-h-20 min-w-0 flex-col justify-center rounded-xl border border-transparent bg-slate-50 p-3.5 transition-colors hover:border-sky-200 hover:bg-white">
                <div className="mb-1.5 flex items-center gap-1.5 text-yinmn">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Turno</span>
                </div>
                <p className="truncate text-sm font-semibold text-oxford">
                  {employee.turno || "Não cadastrado"}
                </p>
              </div>

              <div className="flex min-h-20 min-w-0 flex-col justify-center rounded-xl border border-transparent bg-slate-50 p-3.5 transition-colors hover:border-sky-200 hover:bg-white">
                <div className="mb-1.5 flex items-center gap-1.5 text-yinmn">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Zona</span>
                </div>
                <p className="truncate text-sm font-semibold text-oxford">
                  {employee.zona || "Não cadastrada"}
                </p>
              </div>

              <div className="flex min-h-20 min-w-0 flex-col justify-center rounded-xl border border-transparent bg-slate-50 p-3.5 transition-colors hover:border-sky-200 hover:bg-white">
                <div className="mb-1.5 flex items-center gap-1.5 text-yinmn">
                  <Globe2 className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Idiomas</span>
                </div>
                <p className="truncate text-sm font-semibold text-oxford" title={employee.idiomas?.join(", ") || "Nenhum"}>
                  {employee.idiomas?.join(", ") || "Nenhum cadastrado"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_24px_rgba(0,48,87,0.045)] sm:p-5">
            <h3 className="flex items-center gap-2 text-xs font-bold text-oxford">
              <span className="h-4 w-1 rounded-full bg-jordy" />
              Dados adicionais
            </h3>
            <div className="grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {additionalDetails.map((detail) => (
                <div
                  key={detail.label}
                  className="flex min-h-20 min-w-0 flex-col justify-center rounded-xl border border-transparent bg-slate-50 p-3.5 transition-colors hover:border-sky-200 hover:bg-white"
                >
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {detail.label}
                  </span>
                  <p className="break-words text-sm font-semibold text-oxford">
                    {detail.value || "Não informado"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Datas de Contrato */}
          <div className="flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_24px_rgba(0,48,87,0.045)] sm:p-5">
            <h3 className="flex items-center gap-2 text-xs font-bold text-oxford">
              <span className="h-4 w-1 rounded-full bg-jordy" />
              Informações contratuais
            </h3>
            <div className="overflow-hidden rounded-[18px] bg-slate-50">
              <div className="grid grid-cols-1 divide-y divide-white sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <div className="p-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-yinmn">
                    <Calendar className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Data de admissão</span>
                  </div>
                  <p className="text-sm font-semibold text-oxford">
                    {formatarDataBR(employee.dataAdmissao)}
                  </p>
                </div>

                <div className="p-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-yinmn">
                    <Calendar className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Término do contrato</span>
                  </div>
                  <p className="text-sm font-semibold text-oxford">
                    {formatarDataBR(employee.dataTerminoReal)}
                  </p>
                </div>
              </div>

              {employee.statusFuncionario !== "Encerrado" && employee.dataTerminoReal && (
                <div className="border-t border-white bg-white/45 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Tempo restante</span>
                      <span className="text-lg font-bold text-oxford">
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
                    className="h-2 overflow-hidden rounded-full bg-slate-200"
                  >
                    <div className="h-full rounded-full bg-gradient-to-r from-yinmn to-jordy" style={{ width: `${contractProgress}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-[9px] font-medium text-slate-500">
                    <span>Início</span>
                    <span>{contractProgress}% da vigência</span>
                    <span>Término</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Ferias e ausencias */}
          <div className="flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_24px_rgba(0,48,87,0.045)] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-xs font-bold text-oxford">
                <span className="h-4 w-1 rounded-full bg-jordy" />
                {"F\u00e9rias e aus\u00eancias"}
              </h3>
              <button
                type="button"
                onClick={() => onConfigureVacation(employee)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-transparent bg-sky-50 px-3 text-[11px] font-bold text-yinmn transition hover:bg-sky-100"
              >
                <FileEdit className="h-3.5 w-3.5" />
                {"Configurar f\u00e9rias"}
              </button>
            </div>

            <div className="overflow-hidden rounded-[18px] bg-slate-50">
              <div className="flex items-center justify-between gap-3 border-b border-white bg-sky-50 p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-yinmn shadow-sm">
                    <Plane className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {"Situa\u00e7\u00e3o atual"}
                    </span>
                    <strong className="text-sm text-oxford">{vacationStatus}</strong>
                  </div>
                </div>
                {employee.diasVendidosFerias > 0 && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-700">
                    {employee.diasVendidosFerias} dias de abono
                  </span>
                )}
              </div>

              <div className="space-y-2 p-4">
                {vacationPeriods.length > 0 ? vacationPeriods.map((period, index) => (
                  <div key={period.recordId || `${period.dataInicio}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-white/80 p-3">
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
                    <p className="text-sm font-semibold text-slate-600">{"Nenhum per\u00edodo registrado"}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{"Use o bot\u00e3o acima para configurar as datas."}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contatos Corporativos */}
          <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_24px_rgba(0,48,87,0.045)] sm:p-5 lg:col-span-2">
            <h3 className="flex items-center gap-2 text-xs font-bold text-oxford">
              <span className="h-4 w-1 rounded-full bg-jordy" />
              Contatos
            </h3>
            
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {/* E-mail */}
              <div className="flex min-h-24 min-w-0 items-center justify-between rounded-xl border border-transparent bg-slate-50 p-3.5 transition-colors hover:border-sky-200 hover:bg-white">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-yinmn">
                    <Mail className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">E-mail corporativo</span>
                    <p className="mt-1 break-all text-sm font-semibold leading-snug text-oxford">
                      {employee.emailCorporativo || "Não cadastrado"}
                    </p>
                  </div>
                </div>
                {employee.emailCorporativo && (
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-sky-50 hover:text-yinmn"
                    title="Copiar e-mail"
                    aria-label="Copiar e-mail corporativo"
                  >
                    {copiedEmail ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
              </div>

              {[
                { label: "E-mail BYU", value: employee.emailBYU },
                { label: "E-mail pessoal", value: employee.emailPessoal },
              ].map((contact) => (
                <div
                  key={contact.label}
                  className="flex min-h-24 min-w-0 items-center gap-2.5 rounded-xl border border-transparent bg-slate-50 p-3.5 transition-colors hover:border-sky-200 hover:bg-white"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-yinmn">
                    <Mail className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {contact.label}
                    </span>
                    <p className="mt-1 break-all text-sm font-semibold leading-snug text-oxford">
                      {contact.value || "Não cadastrado"}
                    </p>
                  </div>
                </div>
              ))}

              {/* Telefone */}
              <div className="flex min-h-24 min-w-0 items-center gap-2.5 rounded-xl border border-transparent bg-slate-50 p-3.5 transition-colors hover:border-sky-200 hover:bg-white">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-yinmn">
                  <Phone className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Telefone celular
                  </span>
                  {employee.telefone ? (
                    <a
                      href={`tel:${employee.telefone.replace(/[^\d+]/g, "")}`}
                      className="mt-1 block break-all text-sm font-semibold leading-snug text-oxford hover:text-yinmn"
                    >
                      {employee.telefone}
                    </a>
                  ) : (
                    <p className="mt-1 text-sm font-semibold leading-snug text-oxford">
                      Não cadastrado
                    </p>
                  )}
                </div>
              </div>

              {/* Zoom Link */}
              <div className="flex min-h-24 min-w-0 items-center justify-between rounded-xl border border-transparent bg-slate-50 p-3.5 transition-colors hover:border-sky-200 hover:bg-white">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-yinmn">
                    <Video className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Sala do Zoom</span>
                    <p className="mt-1 truncate text-sm font-semibold text-oxford">
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
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-500">Não disponível</span>
                )}
              </div>
            </div>
          </div>

          </div>

          <div className="grid items-stretch gap-4 xl:grid-cols-2">
            <EmployeeTranslationSection employee={employee} />
            <EmployeeTeachingSection employee={employee} />
          </div>

          {/* Pendências identificadas */}
          {pendencias.length > 0 && (
            <div className="space-y-2.5 rounded-2xl border border-amber-200/70 bg-amber-50/80 p-4 sm:px-5">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                <h4 className="text-xs font-bold">Pendências cadastrais ({pendencias.length})</h4>
              </div>
              <ul className="grid list-disc gap-1.5 pl-5 text-xs text-slate-700 sm:grid-cols-2">
                {pendencias.map((p, i) => (
                  <li key={i}>
                    <span className="font-semibold">{p.label}</span>
                    <span className="ml-1.5 rounded bg-white/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">{p.severity}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Seção Linha do Tempo */}
          <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_24px_rgba(0,48,87,0.045)] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="flex items-center gap-2 text-xs font-bold text-oxford">
                <span className="h-4 w-1 rounded-full bg-jordy" />
                <Clock className="h-4 w-4 text-yinmn" />
                <span>Histórico</span>
              </h3>
              
              {/* Filtro de Categoria */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="min-h-10 w-full rounded-xl border border-transparent bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600 focus:outline-none sm:w-auto"
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
            <div className="relative ml-2.5 space-y-3 border-l-2 border-slate-200 pb-1 pl-4 pt-1">
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
                      <span className="absolute -left-[27px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-200 bg-white shadow-sm">
                        <span className={`w-2 h-2 rounded-full ${bulletBg}`} />
                      </span>

                      {/* Event Details */}
                      <div className="space-y-1.5 rounded-2xl border border-transparent bg-slate-50 p-3.5 text-xs transition-colors hover:border-sky-200 hover:bg-white">
                        <div className="flex items-start justify-between gap-2 text-[10px] font-bold text-slate-400">
                          <span className="shrink-0">{formatarDataBR(evt.data)}</span>
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={`truncate text-right text-[8px] font-black uppercase ${categoryColor}`}>{evt.categoria}</span>
                            {evt.tipo === "Observação" && (
                              <button
                                type="button"
                                onClick={() => setConfirmingObservationId(
                                  confirmingObservationId === evt.recordId ? null : evt.recordId
                                )}
                                disabled={deletingObservationId === evt.recordId}
                                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                                title="Excluir observação"
                                aria-label="Excluir observação do histórico"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        {confirmingObservationId === evt.recordId && evt.tipo === "Observação" && (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
                            <span className="text-[10px] font-semibold text-rose-800">
                              Apagar esta observação?
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setConfirmingObservationId(null)}
                                disabled={deletingObservationId === evt.recordId}
                                className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-slate-500 transition-colors hover:bg-white disabled:opacity-50"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteObservation(evt.recordId)}
                                disabled={deletingObservationId === evt.recordId}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
                              >
                                {deletingObservationId === evt.recordId && (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                )}
                                Excluir
                              </button>
                            </div>
                          </div>
                        )}
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
            <form onSubmit={handleAddObservation} className="space-y-2.5 rounded-[18px] border border-transparent bg-slate-50 p-4">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Adicionar ao histórico</span>
              <p
                className={`text-[10px] font-medium ${erroIdentificacaoUsuario ? "text-rose-600" : "text-slate-500"}`}
                role={erroIdentificacaoUsuario ? "alert" : undefined}
              >
                Responsável: {responsavelAtual || (erroIdentificacaoUsuario ? "Não foi possível identificar o usuário" : "Identificando usuário...")}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
                <input
                  type="text"
                  placeholder="Escreva uma observação..."
                  value={newObs}
                  maxLength={850}
                  onChange={(e) => setNewObs(e.target.value)}
                  className="min-w-0 rounded-xl border border-transparent bg-white px-3 py-2.5 text-xs text-slate-700 focus:border-jordy focus:outline-none"
                />
                
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as TimelineEventCategory)}
                  className="w-full rounded-xl border border-transparent bg-white px-2.5 py-2.5 text-[11px] font-bold text-slate-600 focus:outline-none"
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
                  className="flex min-h-10 items-center justify-center rounded-xl bg-yinmn px-3 font-bold text-white transition-all hover:bg-cadet disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white p-3 sm:flex-row sm:justify-end sm:px-7 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-oxford"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-yinmn px-6 py-2.5 text-xs font-bold text-white shadow-[0_8px_18px_rgba(0,97,132,0.2)] transition-all hover:bg-cadet active:scale-[0.98]"
          >
            <FileEdit className="h-4 w-4" />
            <span>Editar cadastro</span>
          </button>
        </div>
          </>
        )}
      </section>
    </div>
  );
};
