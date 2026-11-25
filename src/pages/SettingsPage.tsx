/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Save,
  Plus,
  Trash2,
  Type,
  MapPin,
  Briefcase,
  Check,
  X,
} from "lucide-react";
import type { AppSettings, RhEmployee } from "../types/rh";
import {
  EmployeeImportCard,
} from "../components/EmployeeImportCard";
import { ShiftSettingsCard } from "../components/ShiftSettingsCard";
import { TeachingModalitySettingsCard } from "../components/TeachingModalitySettingsCard";
import type {
  EmployeeImportResult,
  EmployeeImportRow,
} from "../services/rhDataSource";
import type {
  CatalogSettings,
  TurnoItem,
} from "../services/dataverseCatalogs";

interface SettingsPageProps {
  settings: AppSettings;
  employees: RhEmployee[];
  shifts: TurnoItem[];
  onSave: (settings: CatalogSettings) => Promise<AppSettings>;
  onSaveShifts: (shifts: TurnoItem[]) => Promise<TurnoItem[]>;
  onImportEmployees: (
    rows: EmployeeImportRow[],
    onProgress: (completed: number, total: number) => void,
  ) => Promise<EmployeeImportResult>;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  employees,
  shifts,
  onSave,
  onSaveShifts,
  onImportEmployees,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [addingTo, setAddingTo] = useState<keyof AppSettings | null>(null);
  const [newValue, setNewValue] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");

  const markAsChanged = () => {
    setSaveState("idle");
    setSaveError("");
  };

  const handleSaveAdd = () => {
    const value = newValue.trim();
    if (addingTo && value) {
      setLocalSettings((prev) => ({
        ...prev,
        [addingTo]: [...prev[addingTo], value],
      }));
      markAsChanged();
    }
    setAddingTo(null);
    setNewValue("");
  };

  const handleCancelAdd = () => {
    setAddingTo(null);
    setNewValue("");
  };

  const handleRemoveItem = (field: keyof AppSettings, index: number) => {
    setLocalSettings((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
    markAsChanged();
  };

  const handleSave = async () => {
    setSaveState("saving");
    setSaveError("");
    try {
      const savedSettings = await onSave(localSettings);
      setLocalSettings(savedSettings);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar as configurações.",
      );
    }
  };

  const renderList = (
    field: keyof AppSettings,
    title: string,
    description: string,
    icon: React.ReactNode,
  ) => (
    <section className="flex min-w-0 flex-col rounded-2xl border border-sky-100 bg-white p-4 shadow-[0_8px_24px_rgba(0,48,87,0.05)] transition-shadow hover:shadow-[0_12px_30px_rgba(0,48,87,0.09)] sm:p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-yinmn">
            {icon}
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-oxford">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          {localSettings[field].length}
        </span>
      </header>

      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setAddingTo(field);
            setNewValue("");
          }}
          aria-label={`Adicionar ${title.toLowerCase()}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-sky-100 px-3 text-xs font-semibold text-yinmn transition-colors hover:border-sky-200 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yinmn focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </div>

      <div className="max-h-80 min-h-24 flex-1 space-y-2 overflow-y-auto pr-1">
        {addingTo === field && (
          <div
            role="group"
            aria-label={`Adicionar item em ${title}`}
            className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/70 p-2"
          >
            <label className="sr-only" htmlFor={`new-${field}`}>
              Novo item em {title}
            </label>
            <input
              id={`new-${field}`}
              autoFocus
              type="text"
              value={newValue}
              onChange={(event) => setNewValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSaveAdd();
                if (event.key === "Escape") handleCancelAdd();
              }}
              className="min-w-0 flex-1 rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-oxford outline-none transition focus:border-yinmn focus:ring-2 focus:ring-yinmn/15"
              placeholder="Digite o nome..."
            />
            <button
              type="button"
              onClick={handleSaveAdd}
              disabled={!newValue.trim()}
              aria-label="Confirmar novo item"
              className="rounded-lg bg-emerald-100 p-2 text-emerald-700 transition-colors hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleCancelAdd}
              aria-label="Cancelar inclusão"
              className="rounded-lg bg-white p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {localSettings[field].map((item, index) => (
          <div
            key={`${field}-${index}`}
            className="group flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 transition-colors hover:border-sky-100 hover:bg-sky-50/50"
          >
            <span className="min-w-0 break-words text-sm font-medium text-slate-700">
              {item}
            </span>
            <button
              type="button"
              onClick={() => handleRemoveItem(field, index)}
              aria-label={`Remover ${item}`}
              className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {localSettings[field].length === 0 && addingTo !== field && (
          <div className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 text-center">
            <p className="text-sm font-medium text-slate-500">Nenhum item cadastrado</p>
            <p className="mt-1 text-xs text-slate-400">
              Use “Adicionar” para incluir uma opção.
            </p>
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="w-full animate-fade-in pb-20">
      <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
        {saveState === "saved" && (
          <p
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
          >
            Configurações salvas com sucesso.
          </p>
        )}
        {saveState === "error" && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
          >
            Não foi possível salvar as configurações. {saveError}
          </p>
        )}

        <EmployeeImportCard
          settings={settings}
          employees={employees}
          onImport={onImportEmployees}
        />

        <ShiftSettingsCard shifts={shifts} onSave={onSaveShifts} />

        <TeachingModalitySettingsCard />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 sm:gap-5">
          {renderList(
            "idiomas",
            "Idiomas",
            "Opções de idioma",
            <Type className="h-5 w-5" />,
          )}
          {renderList(
            "cargos",
            "Cargos",
            "Funções da equipe",
            <Briefcase className="h-5 w-5" />,
          )}
          {renderList(
            "zonas",
            "Zonas",
            "Áreas de atuação",
            <MapPin className="h-5 w-5" />,
          )}
        </div>

        <p className="text-xs leading-relaxed text-slate-500">
          Ao salvar, novas opções são cadastradas no Dataverse e opções
          removidas da lista são desativadas, preservando os vínculos existentes.
          Os códigos das novas opções são gerados automaticamente.
        </p>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState === "saving"}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-yinmn px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-cadet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yinmn focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
          >
            <Save className="h-4 w-4" />
            {saveState === "saving" ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
};
