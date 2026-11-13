/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { X, Save, AlertTriangle, CheckCircle } from "lucide-react";
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
  employee: RhEmployee | null;
  appSettings: AppSettings;
  onClose: () => void;
  onSave: (updated: RhEmployee) => Promise<void>;
}

export const PendingEditorPanel: React.FC<PendingEditorPanelProps> = ({
  mode = "edit",
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

  if (!employee || !formData) return null;

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
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end" aria-labelledby="editor-panel-title" role="dialog" aria-modal="true">
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px] transition-opacity"
        onClick={() => { if (!saving) onClose(); }}
      />

      {/* Flyout panel */}
      <div className="relative w-full max-w-xl bg-slate-50 h-full shadow-[0_0_70px_rgba(0,48,87,0.28)] flex flex-col z-10 sm:rounded-l-[28px] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-100 to-white text-oxford px-6 py-5 flex items-center justify-between border-b border-white">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-yinmn block mb-1">{mode === "create" ? "Diretório de funcionários" : "Qualidade cadastral"}</span>
            <h2 id="editor-panel-title" className="text-base font-extrabold tracking-tight text-oxford">
              {mode === "create" ? "Novo funcionário" : "Corrigir / Editar Cadastro"}
            </h2>
          </div>
          <button
            onClick={() => { if (!saving) onClose(); }}
            className="p-2 rounded-lg text-slate-400 hover:text-yinmn hover:bg-sky-50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body / Form */}
        <form id="employee-editor-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
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

          <div className="space-y-4">
            {/* Nome do funcionário */}
            <div>
              <label htmlFor="employee-full-name" className="block text-xs font-bold text-slate-500 mb-1.5">
                Nome completo (Full Name) <span className="text-red-500">*</span>
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="employee-id" className="mb-1.5 block text-xs font-bold text-slate-500">
                  ID do funcionário (Employee ID) <span className="text-red-500">*</span>
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
                  ID global (Global ID)
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
                  Gênero (Gender)
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
                <label htmlFor="employee-initials" className="mb-1.5 block text-xs font-bold text-slate-500">
                  Iniciais do funcionário (Employee Initials)
                </label>
                <input
                  id="employee-initials"
                  type="text"
                  value={formData.iniciaisFuncionario || ""}
                  onChange={(e) => handleChange("iniciaisFuncionario", e.target.value)}
                  className="w-full rounded-lg border border-sky-100 px-3.5 py-2.5 text-xs text-oxford focus:border-yinmn focus:outline-none focus:ring-2 focus:ring-yinmn/20"
                />
              </div>
            </div>

            {/* Grid Cargo, Zona e Turno */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Cargo */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Cargo (Position)</label>
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
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Turno (Shifts - Lookup)</label>
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
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Zona (Zone)</label>
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
                  Status do funcionário (Employee Status)
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
                  Status do registro (Status / statecode)
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
                  Templo (Temple)
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

            {/* Vigência / Término */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Data de admissão (Hire Date)</label>
                <input
                  type="date"
                  value={formData.dataAdmissao}
                  onChange={(e) => handleChange("dataAdmissao", e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn text-oxford"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">
                  Data de término do contrato (Contract End Date)
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

            {/* E-mails e Zoom */}
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">E-mail corporativo (Corporate Email)</label>
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
                    E-mail BYU (BYU Email)
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
                    E-mail pessoal (Personal Email)
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
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Link do Zoom (Zoom Link)</label>
                <input
                  type="url"
                  value={formData.linkZoom}
                  onChange={(e) => handleChange("linkZoom", e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-sky-100 focus:outline-none focus:ring-2 focus:ring-yinmn/20 focus:border-yinmn text-oxford"
                  placeholder="Ex: https://zoom.us/j/..."
                />
              </div>
            </div>

            {/* Seleção de Idiomas */}
            <div className="p-4 bg-white rounded-xl border border-sky-100">
              <label className="block text-xs font-black uppercase tracking-[0.14em] text-slate-500 mb-2.5">
                Idiomas ({formData.idiomas?.length || 0})
              </label>
              
              <div className="grid grid-cols-2 gap-2">
                {popularLanguages.map((lang) => {
                  const isChecked = formData.idiomas?.includes(lang);
                  return (
                    <label
                      key={lang}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all select-none ${
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
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-sky-100 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => { if (!saving) onClose(); }}
            className="text-xs bg-white hover:bg-sky-50 text-slate-600 font-bold py-2.5 px-5 rounded-lg border border-sky-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          
          <button
            form="employee-editor-form"
            type="submit"
            disabled={saving || success}
            className="text-xs bg-yinmn hover:bg-cadet text-white font-extrabold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-yinmn/10 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Salvando..." : mode === "create" ? "Cadastrar funcionário" : "Salvar Alterações"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
