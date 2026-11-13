/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  CalendarDays,
  CalendarRange,
  Clock3,
  FileEdit,
  Plane,
  X,
} from "lucide-react";
import type { RhEmployee } from "../types/rh";
import { formatarDataBR } from "../utils/dateUtils";
import {
  calcularDiasVendidos,
  calcularStatusFerias,
  calcularTempoTrabalho,
} from "../utils/vacationUtils";

interface VacationDetailsPanelProps {
  employee: RhEmployee | null;
  onClose: () => void;
  onConfigureVacation: (employee: RhEmployee) => void;
}

const statusTone = (status: string): string => {
  if (status === "F\u00e9rias cr\u00edticas") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "Apto para f\u00e9rias") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "F\u00e9rias em andamento") {
    return "border-sky-200 bg-sky-50 text-yinmn";
  }
  if (status === "F\u00e9rias conclu\u00eddas") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
};

export const VacationDetailsPanel: React.FC<VacationDetailsPanelProps> = ({
  employee,
  onClose,
  onConfigureVacation,
}) => {
  if (!employee) return null;

  const status = calcularStatusFerias(employee);
  const workTime = calcularTempoTrabalho(employee.dataAdmissao);
  const soldDays = calcularDiasVendidos(employee);
  const periods = [...(employee.periodosFerias || [])]
    .sort((left, right) => left.dataInicio.localeCompare(right.dataInicio));
  const scheduledDays = periods.reduce((total, period) => total + period.dias, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vacation-details-title"
    >
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-full w-full max-w-lg flex-col overflow-hidden bg-slate-50 shadow-[0_0_70px_rgba(0,48,87,0.28)] sm:rounded-l-[28px]">
        <header className="border-b border-sky-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-yinmn to-cadet text-white shadow-[0_8px_20px_rgba(0,97,132,0.22)]">
                <Plane className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-yinmn">
                  {"Ficha de f\u00e9rias"}
                </span>
                <h2 id="vacation-details-title" className="truncate text-base font-extrabold text-oxford">
                  {employee.nome}
                </h2>
                <p className="mt-0.5 font-mono text-[10px] font-semibold text-slate-400">
                  {employee.idFuncionario || "ID pendente"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-sky-50 hover:text-yinmn"
              aria-label="Fechar ficha de ferias"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <section className="rounded-2xl border border-sky-100 bg-white p-4 shadow-[0_8px_20px_rgba(0,48,87,0.04)]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              {"Situa\u00e7\u00e3o atual"}
            </span>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <span className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-bold ${statusTone(status)}`}>
                {status}
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                {"Admiss\u00e3o: "}{formatarDataBR(employee.dataAdmissao)}
              </span>
            </div>
            <p className="mt-3 border-t border-sky-100 pt-3 text-[11px] font-medium text-slate-500">
              {"Tempo na equipe: "}<strong className="text-oxford">{workTime.texto}</strong>
            </p>
          </section>

          <section aria-label="Resumo das ferias" className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-sky-100 bg-white p-3 text-center">
              <CalendarRange className="mx-auto h-4 w-4 text-yinmn" />
              <strong className="mt-1.5 block text-lg font-black text-oxford">{periods.length}</strong>
              <span className="block text-[9px] font-bold uppercase text-slate-400">
                {periods.length === 1 ? "Per\u00edodo" : "Per\u00edodos"}
              </span>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-white p-3 text-center">
              <CalendarDays className="mx-auto h-4 w-4 text-yinmn" />
              <strong className="mt-1.5 block text-lg font-black text-oxford">{scheduledDays}</strong>
              <span className="block text-[9px] font-bold uppercase text-slate-400">Dias de gozo</span>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3 text-center">
              <Clock3 className="mx-auto h-4 w-4 text-amber-600" />
              <strong className="mt-1.5 block text-lg font-black text-amber-700">{soldDays}</strong>
              <span className="block text-[9px] font-bold uppercase text-amber-600">Dias de abono</span>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                {"Per\u00edodos registrados"}
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {"Datas cadastradas para o colaborador."}
              </p>
            </div>

            {periods.length > 0 ? (
              <div className="space-y-2.5">
                {periods.map((period, index) => (
                  <div
                    key={period.recordId || `${period.dataInicio}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white p-3.5 shadow-[0_6px_16px_rgba(0,48,87,0.035)]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[10px] font-black text-yinmn">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="block text-[9px] font-bold uppercase text-slate-400">
                          {"Per\u00edodo de gozo"}
                        </span>
                        <strong className="mt-0.5 block text-xs text-oxford">
                          {formatarDataBR(period.dataInicio)} a {formatarDataBR(period.dataFim)}
                        </strong>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-lg bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-yinmn">
                      {period.dias} dias
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-sky-200 bg-white p-7 text-center">
                <CalendarDays className="mx-auto h-7 w-7 text-jordy" />
                <p className="mt-2 text-xs font-bold text-slate-600">
                  {"Nenhum per\u00edodo de f\u00e9rias registrado."}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {"Use o bot\u00e3o abaixo para cadastrar as datas."}
                </p>
              </div>
            )}
          </section>
        </div>

        <footer className="border-t border-sky-100 bg-white p-4">
          <button
            type="button"
            onClick={() => onConfigureVacation(employee)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-yinmn px-4 py-3 text-xs font-bold text-white shadow-[0_8px_18px_rgba(0,97,132,0.22)] transition hover:bg-cadet active:scale-[0.99]"
          >
            <FileEdit className="h-4 w-4" />
            {"Configurar f\u00e9rias"}
          </button>
        </footer>
      </div>
    </div>
  );
};
