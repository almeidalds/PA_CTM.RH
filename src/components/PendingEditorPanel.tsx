/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { X, Save, AlertTriangle, CheckCircle, User, IdCard } from "lucide-react";
import { RhEmployee, AppSettings } from "../types/rh";
import {
  Ctmbrasi_employeerecordsesctmbrasi_employeestatus as employeeStatuses,
  Ctmbrasi_employeerecordsesctmbrasi_gender as genders,
  Ctmbrasi_employeerecordsesstatecode as recordStatuses,
} from "../generated/models/Ctmbrasi_employeerecordsesModel";

const employeeStatusLabels: Record<number, string> = {
  583150000: "Ativo",
  583150001: "Férias",
  583150002: "Licença",
  583150003: "Inativo",
  583150004: "Encerrado",
};
const employeeStatusOptions = Object.entries(employeeStatuses).map(
  ([value, label]) => ({
    value: Number(value) as NonNullable<RhEmployee["statusDataverse"]>,
    label: employeeStatusLabels[Number(value)] || label,
  }),
);

const genderLabels: Record<number, string> = {
  583150000: "Masculino",
  583150001: "Feminino",
};
const genderOptions = Object.entries(genders).map(([value, label]) => ({
  value: Number(value) as NonNullable<RhEmployee["genero"]>,
  label: genderLabels[Number(value)] || label,
}));

const stateLabels: Record<number, string> = { 0: "Ativo", 1: "Inativo" };
const stateOptions = Object.entries(recordStatuses).map(([value, label]) => ({
  value: Number(value) as NonNullable<RhEmployee["statusRegistro"]>,
  label: stateLabels[Number(value)] || label,
}));

interface PendingEditorPanelProps {
  mode?: "create" | "edit";
  embedded?: boolean;
  employee: RhEmployee | null;
  appSettings: AppSettings;
  onClose: () => void;
  onSave: (updated: RhEmployee) => Promise<void>;
}

export const PendingEditorPanel: React.FC<PendingEditorPanelProps> = ({
  mode = "edit",
  embedded = false,
  employee,
  appSettings,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<RhEmployee | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const popularLanguages = appSettings.idiomas;
  const cargosOptions = appSettings.cargos;
  const zonasOptions = appSettings.zonas;
  const turnosOptions = appSettings.turnos;

  useEffect(() => {
    if (employee) {
      setFormData({ ...employee });
      setSuccess(false);
      setErrorMessage("");
    } else {
      setFormData(null);
    }
  }, [employee]);

  useEffect(() => {
    if (!employee || embedded) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [employee, embedded]);

  useEffect(() => {
    if (!employee) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [employee, onClose, saving]);

  if (!employee || !formData) return null;

  const initials = formData.nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  const currentStatus = formData.statusDataverse !== undefined
    ? employeeStatusLabels[formData.statusDataverse] || employeeStatuses[formData.statusDataverse]
    : "Não definido";

  const handleChange = (field: keyof RhEmployee, value: any) => {
    setFormData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: value
      };
    });
  };

  const handleEmployeeStatusChange = (value: string) => {
    const employeeStatus = Number(value) as NonNullable<
      RhEmployee["statusDataverse"]
    >;
    setFormData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        statusDataverse: employeeStatus,
        statusFuncionario:
          employeeStatus === 583150003 ||
          employeeStatus === 583150004
            ? "Encerrado"
            : "Ativo",
      };
    });
  };

  const handleLanguageToggle = (lang: string) => {
    if (!formData) return;
    const currentList = formData.idiomas || [];
    let updated: string[];

    if (currentList.includes(lang)) {
      updated = currentList.filter((l) => l !== lang);
    } else {
      updated = [...currentList, lang];
    }
    handleChange("idiomas", updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    // Validações básicas antes de prosseguir
    if (!formData.nome || formData.nome.trim() === "") {
      setErrorMessage("O nome do funcionário é um campo obrigatório.");
      return;
    }

    if (formData.dataAdmissao && formData.dataTerminoReal && formData.dataTerminoReal < formData.dataAdmissao) {
      setErrorMessage("A data de término não pode ser anterior à admissão.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...formData, nome: formData.nome.trim(), idFuncionario: formData.idFuncionario.trim() });
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao salvar cadastro. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={embedded
        ? "flex min-h-0 flex-1 flex-col overflow-hidden"
        : "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 sm:p-5"}
      role="presentation"
    >
      {!embedded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-slate-950/35 backdrop-blur-[3px]"
          onClick={() => { if (!saving) onClose(); }}
        />
      )}

      <section
        className={embedded
          ? "relative flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50"
          : "relative z-10 flex max-h-[95dvh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-white bg-slate-50 shadow-[0_28px_80px_rgba(0,48,87,0.24)] sm:max-h-[92dvh] sm:rounded-[34px]"}
        aria-labelledby="editor-panel-title"
        role={embedded ? undefined : "dialog"}
        aria-modal={embedded ? undefined : true}
      >
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden border-b border-slate-200 bg-white px-4 py-5 sm:px-7 sm:py-6">
          <div aria-hidden="true" className="absolute -right-12 -top-24 h-52 w-[28rem] rounded-full bg-gradient-to-br from-sky-200/45 via-sky-50 to-transparent" />
          <button
            type="button"
            disabled={saving}
            onClick={() => { if (!saving) onClose(); }}
            className="absolute right-4 top-4 z-20 cursor-pointer rounded-full border border-transparent bg-white/80 p-2.5 text-slate-400 backdrop-blur-sm transition-colors hover:border-slate-200 hover:text-oxford disabled:cursor-not-allowed disabled:opacity-50 sm:right-6 sm:top-5"
            aria-label="Fechar editor de funcionário"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative z-10 grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,430px)]">
            <div className="flex min-w-0 items-center gap-4 pr-10">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-yinmn to-cadet text-base font-bold text-white shadow-[0_10px_24px_rgba(0,97,132,0.2)] sm:h-16 sm:w-16 sm:rounded-[22px] sm:text-lg">
                {initials || <User className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-yinmn">
                  {mode === "create" ? "Novo funcionário" : "Editar cadastro"}
                </span>
                <h2 id="editor-panel-title" className="max-w-[min(68vw,640px)] truncate text-xl font-bold tracking-tight text-oxford sm:text-2xl">
                  {formData.nome || "Funcionário sem nome"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {mode === "create" ? "Preencha os dados para criar o cadastro." : "Revise e atualize as informações do funcionário."}
                </p>
              </div>
            </div>

            <div className="hidden grid-cols-2 gap-3 pr-10 lg:grid">
              <div className="rounded-[20px] bg-sky-50 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-yinmn shadow-sm">
                  <IdCard className="h-4 w-4" />
                </div>
                <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">ID do funcionário</span>
                <strong className="mt-1 block truncate text-base text-oxford">{formData.idFuncionario || "Pendente"}</strong>
              </div>

              <div className="rounded-[20px] bg-sky-100/60 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-yinmn shadow-sm">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Status atual</span>
                <strong className="mt-1 block truncate text-base text-oxford">{currentStatus}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body / Form */}
        <form id="employee-editor-form" onSubmit={handleSave} className="flex-1 space-y-5 overflow-y-auto bg-slate-50 p-4 sm:p-5 lg:p-6">
          {/* Alertas */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span role="alert">{errorMessage}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span role="status">{mode === "create" ? "Funcionário cadastrado com sucesso!" : "Cadastro atualizado com sucesso!"}</span>
            </div>
          )}

          <div className="space-y-5">
            <section className="space-y-4 rounded-[24px] border border-white bg-white/95 p-4 shadow-[0_8px_24px_rgba(0,48,87,0.045)] sm:p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-oxford">
                <span className="h-4 w-1 rounded-full bg-jordy" />
                Identificação
              </h3>

              <div className="space-y-4">
                {/* Nome do funcionário */}
                <div>
              <label htmlFor="employee-full-name" className="block text-xs font-bold text-slate-500 mb-1.5">
                Nome completo <span className="text-red-500">*</span>
              </label>
              <input
                id="employee-full-name"
                type="text"
                required
                value={formData.nome}
                onChange={(e) => handleChange("nome", e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn text-oxford font-medium"
                placeholder="Ex: Carlos Augusto de Souza"
              />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="employee-id" className="mb-1.5 block text-xs font-bold text-slate-500">
                  ID do funcionário <span className="text-red-500">*</span>
                </label>
                <input
                  id="employee-id"
                  type="text"
                  required
                  value={formData.idFuncionario}
                  onChange={(e) => handleChange("idFuncionario", e.target.value)}
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-xs font-mono text-oxford focus:border-yinmn focus:outline-none focus:ring-2 focus:ring-yinmn/20 ${
                    !formData.idFuncionario ? "border-amber-300 bg-amber-50/30" : "border-sky-100"
                  }`}
                  placeholder="Ex: CTM-2024-009"
                />
              </div>
              <div>
                <label htmlFor="employee-global-id" className="mb-1.5 block text-xs font-bold text-slate-500">
                  ID global
                </label>
                <input
                  id="employee-global-id"
                  type="text"
                  value={formData.globalId || ""}
                  onChange={(e) => handleChange("globalId", e.target.value)}
                  className="w-full rounded-lg border border-sky-100 px-3.5 py-2.5 text-xs text-oxford focus:border-yinmn focus:outline-none focus:ring-2 focus:ring-yinmn/20"
                />
              </div>
              <div>
                <label htmlFor="employee-gender" className="mb-1.5 block text-xs font-bold text-slate-500">
                  Gênero
                </label>
                <select
                  id="employee-gender"
                  value={formData.genero ?? ""}
                  onChange={(e) => handleChange("genero", e.target.value === "" ? undefined : Number(e.target.value))}
                  className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2.5 text-xs text-oxford focus:border-yinmn focus:outline-none focus:ring-2 focus:ring-yinmn/20"
                >
                  {!formData.genero && <option value="">Não informado</option>}
                  {genderOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="employee-nameplate" className="mb-1.5 block text-xs font-bold text-slate-500">
                  Nome da Plaqueta
                </label>
                <input
                  id="employee-nameplate"
                  type="text"
                  value={formData.nomePlaqueta || ""}
                  onChange={(e) => handleChange("nomePlaqueta", e.target.value)}
                  className="w-full rounded-lg border border-sky-100 px-3.5 py-2.5 text-xs text-oxford focus:border-yinmn focus:outline-none focus:ring-2 focus:ring-yinmn/20"
                />
              </div>
                </div>
              </div>
            </section>

            {/* Grid Cargo, Zona e Turno */}
            <section className="space-y-4 rounded-[24px] border border-white bg-white/95 p-4 shadow-[0_8px_24px_rgba(0,48,87,0.045)] sm:p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-oxford">
                <span className="h-4 w-1 rounded-full bg-jordy" />
                Trabalho e status
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Cargo */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Cargo</label>
                <select
                  value={formData.cargo}
                  onChange={(e) => handleChange("cargo", e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-lg border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn bg-white text-oxford font-medium"
                >
                  <option value="">Selecione o cargo</option>
                  {cargosOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Turno */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Turno</label>
                <select
                  value={formData.turno}
                  onChange={(e) => handleChange("turno", e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-lg border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn bg-white text-oxford font-medium"
                >
                  <option value="">Selecione o turno</option>
                  {formData.turno && !turnosOptions.includes(formData.turno) && (
                    <option value={formData.turno}>{formData.turno}</option>
                  )}
                  {turnosOptions.map((turno) => (
                    <option key={turno} value={turno}>{turno}</option>
                  ))}
                </select>
              </div>

              {/* Zona */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Zona</label>
                <select
                  value={formData.zona}
                  onChange={(e) => handleChange("zona", e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-lg border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn bg-white text-oxford font-medium"
                >
                  <option value="">Selecione a zona</option>
                  {zonasOptions.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="employee-status" className="mb-1.5 block text-xs font-bold text-slate-500">
                  Status do funcionário
                </label>
                <select
                  id="employee-status"
                  required
                  value={formData.statusDataverse ?? ""}
                  onChange={(e) => handleEmployeeStatusChange(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-lg border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn bg-white text-oxford font-medium"
                >
                  <option value="">Selecione o status</option>
                  {employeeStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="record-status" className="mb-1.5 block text-xs font-bold text-slate-500">
                  Status do registro
                </label>
                <select
                  id="record-status"
                  required
                  value={formData.statusRegistro ?? ""}
                  onChange={(e) => handleChange("statusRegistro", e.target.value === "" ? undefined : Number(e.target.value))}
                  className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2.5 text-xs text-oxford focus:border-yinmn focus:outline-none focus:ring-2 focus:ring-yinmn/20"
                >
                  {stateOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="employee-temple" className="mb-1.5 block text-xs font-bold text-slate-500">
                  Templo
                </label>
                <select
                  id="employee-temple"
                  value={formData.templo === undefined ? "" : String(formData.templo)}
                  onChange={(e) => handleChange("templo", e.target.value === "" ? undefined : e.target.value === "true")}
                  className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2.5 text-xs text-oxford focus:border-yinmn focus:outline-none focus:ring-2 focus:ring-yinmn/20"
                >
                  {formData.templo === undefined && (
                    <option value="">Não informado</option>
                  )}
                  <option value="true">Sim</option>
                  <option value="false">Não</option>
                </select>
              </div>
              </div>
            </section>

            {/* Vigência / Término */}
            <section className="space-y-4 rounded-[24px] border border-white bg-white/95 p-4 shadow-[0_8px_24px_rgba(0,48,87,0.045)] sm:p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-oxford">
                <span className="h-4 w-1 rounded-full bg-jordy" />
                Informações contratuais
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Data de admissão</label>
                <input
                  type="date"
                  value={formData.dataAdmissao}
                  onChange={(e) => handleChange("dataAdmissao", e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn text-oxford"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">
                  Data de término do contrato
                </label>
                <input
                  type="date"
                  value={formData.dataTerminoReal}
                  onChange={(e) => handleChange("dataTerminoReal", e.target.value)}
                  className={`w-full text-xs px-3.5 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn text-oxford ${
                    !formData.dataTerminoReal ? "border-red-300 bg-red-50/30" : "border-sky-100"
                  }`}
                />
                {!formData.dataTerminoReal && (
                  <p className="text-[10px] text-red-600 mt-1">Obrigatório para previsão de cobertura.</p>
                )}
              </div>
              </div>
            </section>

            {/* E-mails e Zoom */}
            <section className="space-y-4 rounded-[24px] border border-white bg-white/95 p-4 shadow-[0_8px_24px_rgba(0,48,87,0.045)] sm:p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-oxford">
                <span className="h-4 w-1 rounded-full bg-jordy" />
                Contatos
              </h3>

              <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">E-mail corporativo</label>
                <input
                  type="email"
                  value={formData.emailCorporativo}
                  onChange={(e) => handleChange("emailCorporativo", e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn text-oxford font-medium"
                  placeholder="Ex: funcionario@churchofjesuschrist.org"
                />
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="employee-byu-email" className="mb-1.5 block text-xs font-bold text-slate-500">
                    E-mail BYU
                  </label>
                  <input
                    id="employee-byu-email"
                    type="email"
                    value={formData.emailBYU || ""}
                    onChange={(e) => handleChange("emailBYU", e.target.value)}
                    className="w-full rounded-lg border border-sky-100 px-3.5 py-2.5 text-xs text-oxford focus:border-yinmn focus:outline-none focus:ring-2 focus:ring-yinmn/20"
                  />
                </div>
                <div>
                  <label htmlFor="employee-personal-email" className="mb-1.5 block text-xs font-bold text-slate-500">
                    E-mail pessoal
                  </label>
                  <input
                    id="employee-personal-email"
                    type="email"
                    value={formData.emailPessoal || ""}
                    onChange={(e) => handleChange("emailPessoal", e.target.value)}
                    className="w-full rounded-lg border border-sky-100 px-3.5 py-2.5 text-xs text-oxford focus:border-yinmn focus:outline-none focus:ring-2 focus:ring-yinmn/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="employee-phone" className="mb-1.5 block text-xs font-bold text-slate-500">
                  Telefone celular
                </label>
                <input
                  id="employee-phone"
                  type="tel"
                  value={formData.telefone || ""}
                  onChange={(e) => handleChange("telefone", e.target.value)}
                  className="w-full rounded-lg border border-sky-100 px-3.5 py-2.5 text-xs text-oxford focus:border-yinmn focus:outline-none focus:ring-2 focus:ring-yinmn/20"
                  placeholder="Ex: (11) 99999-9999"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Link do Zoom</label>
                <input
                  type="url"
                  value={formData.linkZoom}
                  onChange={(e) => handleChange("linkZoom", e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn text-oxford"
                  placeholder="Ex: https://zoom.us/j/..."
                />
              </div>
              </div>
            </section>

            {/* Seleção de Idiomas */}
            <section className="space-y-4 rounded-[24px] border border-white bg-white/95 p-4 shadow-[0_8px_24px_rgba(0,48,87,0.045)] sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-xs font-bold text-oxford">
                  <span className="h-4 w-1 rounded-full bg-jordy" />
                  Idiomas
                </h3>
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-yinmn">
                  {formData.idiomas?.length || 0} selecionado(s)
                </span>
              </div>
              
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {popularLanguages.map((lang) => {
                  const isChecked = formData.idiomas?.includes(lang);
                  return (
                    <label
                      key={lang}
                      className={`flex cursor-pointer select-none items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                        isChecked
                          ? "bg-sky-50 border-yinmn text-yinmn font-bold"
                          : "bg-white border-sky-100 text-slate-600 hover:bg-sky-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleLanguageToggle(lang)}
                        className="rounded border-gray-300 text-yinmn focus:ring-jordy h-3.5 w-3.5"
                      />
                      <span className="truncate">{lang}</span>
                    </label>
                  );
                })}
              </div>
              
              {(!formData.idiomas || formData.idiomas.length === 0) && (
                <p className="text-[10px] text-amber-600 mt-2.5 font-bold">⚠️ É necessário associar ao menos um idioma ao instrutor ativo.</p>
              )}
            </section>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white p-3 sm:flex-row sm:justify-end sm:px-7 sm:py-4">
          <button
            type="button"
            disabled={saving}
            onClick={() => { if (!saving) onClose(); }}
            className="flex cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-oxford disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
          
          <button
            form="employee-editor-form"
            type="submit"
            disabled={saving || success}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-full bg-yinmn px-6 py-2.5 text-xs font-bold text-white shadow-[0_8px_18px_rgba(0,97,132,0.2)] transition-all hover:bg-cadet active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Salvando..." : mode === "create" ? "Cadastrar funcionário" : "Salvar Alterações"}</span>
          </button>
        </div>
      </section>
    </div>
  );
};
