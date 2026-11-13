import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type { RhEmployee, VacationPeriod } from "../types/rh";
import { validarLimiteAusencias } from "../utils/absenceUtils";

interface VacationFormPanelProps {
  employee: RhEmployee | null;
  allEmployees: RhEmployee[];
  onClose: () => void;
  onSave: (employee: RhEmployee) => Promise<void>;
}

const calculateDays = (start: string, end: string): number => {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) {
    return 0;
  }
  return Math.floor((endTime - startTime) / 86_400_000) + 1;
};

export const VacationFormPanel: React.FC<VacationFormPanelProps> = ({
  employee,
  allEmployees,
  onClose,
  onSave,
}) => {
  const [periods, setPeriods] = useState<VacationPeriod[]>([]);
  const [soldVacation, setSoldVacation] = useState(false);
  const [soldDays, setSoldDays] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!employee) return;
    setPeriods(employee.periodosFerias.map((period) => ({ ...period })));
    setSoldVacation(employee.feriasVendidas);
    setSoldDays(employee.diasVendidosFerias || 0);
    setErrorMessage("");
  }, [employee]);

  const otherAbsences = useMemo(() => allEmployees.flatMap((item) =>
    item.recordId === employee?.recordId
      ? []
      : item.periodosFerias
          .filter((period) => period.dataInicio && period.dataFim)
          .map((period) => ({
            dataInicio: period.dataInicio,
            dataFim: period.dataFim,
            nome: item.nome,
          })),
  ), [allEmployees, employee]);

  const periodValidations = useMemo(() => periods.map((period) => {
    if (!period.dataInicio || !period.dataFim) return null;
    return validarLimiteAusencias(
      { dataInicio: period.dataInicio, dataFim: period.dataFim },
      otherAbsences,
      8,
    );
  }), [otherAbsences, periods]);

  const totalDays = periods.reduce((total, period) => total + period.dias, 0);
  const totalWithSold = totalDays + (soldVacation ? soldDays : 0);
  const incompletePeriod = periods.some((period) =>
    !period.dataInicio || !period.dataFim || period.dias <= 0
  );
  const overlappingPeriods = [...periods]
    .filter((period) => period.dataInicio && period.dataFim)
    .sort((left, right) => left.dataInicio.localeCompare(right.dataInicio))
    .some((period, index, ordered) =>
      index > 0 && period.dataInicio <= ordered[index - 1].dataFim
    );
  const absenceLimitExceeded = periodValidations.some((validation) => validation && !validation.permitido);
  const invalidSoldDays = soldVacation && (soldDays < 1 || soldDays > 10 || periods.length === 0);
  const canSave = !saving
    && !incompletePeriod
    && !overlappingPeriods
    && !absenceLimitExceeded
    && !invalidSoldDays
    && totalWithSold <= 30;

  if (!employee) return null;

  const addPeriod = () => {
    setPeriods((current) => [...current, { dataInicio: "", dataFim: "", dias: 0 }]);
  };

  const updatePeriod = (
    index: number,
    field: "dataInicio" | "dataFim",
    value: string,
  ) => {
    setPeriods((current) => current.map((period, periodIndex) => {
      if (periodIndex !== index) return period;
      const updated = { ...period, [field]: value };
      return {
        ...updated,
        dias: calculateDays(updated.dataInicio, updated.dataFim),
      };
    }));
  };

  const removePeriod = (index: number) => {
    setPeriods((current) => current.filter((_, periodIndex) => periodIndex !== index));
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setErrorMessage("");

    try {
      await onSave({
        ...employee,
        periodosFerias: periods,
        feriasMarcadas: periods.length > 0,
        feriasVendidas: soldVacation,
        diasVendidosFerias: soldVacation ? soldDays : 0,
        diasTotaisFerias: totalDays,
      });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "N\u00e3o foi poss\u00edvel salvar as f\u00e9rias.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="vacation-form-title">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => { if (!saving) onClose(); }} />
      <div className="relative z-10 flex h-full w-full max-w-xl flex-col overflow-hidden bg-slate-50 shadow-[0_0_70px_rgba(0,48,87,0.28)] sm:rounded-l-[28px]">
        <header className="flex items-center justify-between border-b border-sky-100 bg-white px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-yinmn">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-yinmn">Ficha do colaborador</p>
              <h2 id="vacation-form-title" className="truncate text-base font-extrabold text-oxford">
                {"Configurar f\u00e9rias de "}{employee.nome}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-sky-50 hover:text-yinmn disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-3.5 py-3 text-[11px] font-medium leading-relaxed text-slate-600">
            {"Cadastre apenas os per\u00edodos de f\u00e9rias. Nenhuma substitui\u00e7\u00e3o ser\u00e1 criada ou solicitada."}
          </div>

          {errorMessage && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {"Per\u00edodos de f\u00e9rias"}
                </h3>
                <p className="mt-0.5 text-[10px] text-slate-400">{"Informe as datas de in\u00edcio e fim."}</p>
              </div>
              <button
                type="button"
                onClick={addPeriod}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-100 bg-white px-3 py-2 text-[10px] font-bold text-yinmn transition hover:bg-sky-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {"Adicionar per\u00edodo"}
              </button>
            </div>

            {periods.length === 0 && (
              <button
                type="button"
                onClick={addPeriod}
                className="flex w-full flex-col items-center rounded-2xl border border-dashed border-sky-200 bg-white p-7 text-center transition hover:bg-sky-50/50"
              >
                <CalendarDays className="h-7 w-7 text-jordy" />
                <span className="mt-2 text-xs font-bold text-slate-600">{"Nenhum per\u00edodo registrado"}</span>
                <span className="mt-1 text-[10px] text-slate-400">Clique para adicionar as datas.</span>
              </button>
            )}

            {periods.map((period, index) => {
              const validation = periodValidations[index];
              return (
                <div key={period.recordId || index} className="rounded-2xl border border-sky-100 bg-white p-4 shadow-[0_6px_18px_rgba(0,48,87,0.035)]">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {"Per\u00edodo"} {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePeriod(index)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold text-rose-600 transition hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label>
                      <span className="mb-1 block text-[9px] font-bold uppercase text-slate-400">{"Data de in\u00edcio"}</span>
                      <input
                        type="date"
                        value={period.dataInicio}
                        onChange={(event) => updatePeriod(index, "dataInicio", event.target.value)}
                        className="w-full rounded-xl border border-sky-100 px-3 py-2.5 text-xs font-semibold text-oxford outline-none focus:border-jordy focus:ring-2 focus:ring-sky-100"
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-[9px] font-bold uppercase text-slate-400">Data de fim</span>
                      <input
                        type="date"
                        value={period.dataFim}
                        onChange={(event) => updatePeriod(index, "dataFim", event.target.value)}
                        className="w-full rounded-xl border border-sky-100 px-3 py-2.5 text-xs font-semibold text-oxford outline-none focus:border-jordy focus:ring-2 focus:ring-sky-100"
                      />
                    </label>
                  </div>

                  {period.dataInicio && period.dataFim && (
                    <div className={`mt-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-[10px] font-semibold ${
                      validation?.permitido
                        ? validation.limiteAtingido
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-rose-200 bg-rose-50 text-rose-700"
                    }`}>
                      <span className="flex items-center gap-1.5">
                        {validation?.permitido
                          ? <CheckCircle2 className="h-3.5 w-3.5" />
                          : <AlertTriangle className="h-3.5 w-3.5" />}
                        {validation?.mensagem || "Per\u00edodo inv\u00e1lido."}
                      </span>
                      <strong className="shrink-0">{period.dias} dias</strong>
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <section className="rounded-2xl border border-sky-100 bg-white p-4">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <div>
                <span className="block text-xs font-bold text-oxford">{"Abono pecuni\u00e1rio"}</span>
                <span className="mt-0.5 block text-[10px] text-slate-400">{"Convers\u00e3o de at\u00e9 10 dias em abono."}</span>
              </div>
              <input
                type="checkbox"
                checked={soldVacation}
                onChange={(event) => {
                  setSoldVacation(event.target.checked);
                  if (!event.target.checked) setSoldDays(0);
                }}
                className="h-4 w-4 rounded border-sky-200 text-yinmn focus:ring-yinmn"
              />
            </label>

            {soldVacation && (
              <label className="mt-3 block border-t border-sky-100 pt-3">
                <span className="mb-1 block text-[9px] font-bold uppercase text-slate-400">Dias vendidos</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={soldDays}
                  onChange={(event) => setSoldDays(Number(event.target.value))}
                  className="w-full rounded-xl border border-sky-100 px-3 py-2.5 text-xs font-semibold text-oxford outline-none focus:border-jordy focus:ring-2 focus:ring-sky-100"
                />
              </label>
            )}
          </section>

          {(overlappingPeriods || totalWithSold > 30 || invalidSoldDays) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold text-amber-800">
              {overlappingPeriods
                ? "Os per\u00edodos da mesma pessoa n\u00e3o podem se sobrepor."
                : totalWithSold > 30
                  ? "O total de gozo e abono n\u00e3o pode ultrapassar 30 dias."
                  : "Informe de 1 a 10 dias vendidos e mantenha ao menos um per\u00edodo."}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-sky-100 bg-white p-4">
          <div>
            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Total configurado</span>
            <strong className={`text-sm ${totalWithSold > 30 ? "text-rose-600" : "text-oxford"}`}>
              {totalWithSold} / 30 dias
            </strong>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-xl bg-yinmn px-4 py-2.5 text-xs font-bold text-white shadow-[0_8px_18px_rgba(0,97,132,0.22)] transition hover:bg-cadet disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar f\u00e9rias"}
          </button>
        </footer>
      </div>
    </div>
  );
};
