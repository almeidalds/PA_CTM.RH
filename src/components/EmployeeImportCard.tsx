import React, { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import type { AppSettings, RhEmployee } from "../types/rh";
import type { EmployeeImportPreview } from "../utils/employeeImport";
import type {
  EmployeeImportResult,
  EmployeeImportRow,
} from "../services/rhDataSource";

interface EmployeeImportCardProps {
  settings: AppSettings;
  employees: RhEmployee[];
  onImport: (
    rows: EmployeeImportRow[],
    onProgress: (completed: number, total: number) => void,
  ) => Promise<EmployeeImportResult>;
}

export const EmployeeImportCard: React.FC<EmployeeImportCardProps> = ({
  settings,
  employees,
  onImport,
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<EmployeeImportPreview | null>(null);
  const [importResult, setImportResult] = useState<EmployeeImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [importProgress, setImportProgress] = useState(0);

  const handleFile = async (file?: File) => {
    setError("");
    setImportResult(null);
    setPreview(null);
    if (!file) return;

    setBusy(true);
    setFileName(file.name);
    try {
      const { previewEmployeeImport } = await import("../utils/employeeImport");
      setPreview(await previewEmployeeImport(file, settings, employees));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível ler a planilha.",
      );
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleImport = async () => {
    if (!preview || preview.rows.length === 0) return;

    setBusy(true);
    setImportProgress(0);
    setError("");
    setImportResult(null);
    try {
      const result = await onImport(preview.rows, setImportProgress);
      setImportResult(result);
      if (result.employees) {
        setPreview((current) =>
          current
            ? {
                ...current,
                rows: [],
                failures: [...current.failures, ...result.failures],
              }
            : current,
        );
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "A importação não pôde ser concluída.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-sky-100 bg-white p-4 shadow-[0_8px_24px_rgba(0,48,87,0.05)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-yinmn">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-bold text-oxford">Importar funcionários em massa</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Selecione uma planilha XLSX ou CSV baseada no modelo anexado. Os
              dados serão conferidos antes de serem enviados ao Dataverse.
            </p>
          </div>
        </div>
        <label className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 text-sm font-semibold text-yinmn transition hover:bg-sky-100 focus-within:ring-2 focus-within:ring-yinmn focus-within:ring-offset-2">
          <Upload className="h-4 w-4" />
          {busy ? "Processando..." : "Selecionar arquivo"}
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="sr-only"
            disabled={busy}
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </label>
      </div>

      <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
        Colunas reconhecidas: matrícula, ID global, nome, e-mails, telefone, data de
        admissão, término do contrato, sexo, cargo, zona, turno, Zoom e idiomas.
        Registros existentes e valores que não correspondam aos catálogos ativos
        serão separados para revisão. Nenhum registro existente será atualizado.
      </p>

      {fileName && (
        <p className="break-all text-xs font-semibold text-slate-600">
          Arquivo: {fileName}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      {preview && (
        <div className="space-y-4 rounded-xl border border-sky-100 p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <span className="block text-[10px] font-bold uppercase text-slate-500">Linhas lidas</span>
              <strong className="mt-1 block text-lg text-oxford">{preview.totalRows}</strong>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <span className="block text-[10px] font-bold uppercase text-emerald-700">Prontas para importar</span>
              <strong className="mt-1 block text-lg text-emerald-900">{preview.rows.length}</strong>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <span className="block text-[10px] font-bold uppercase text-amber-700">Revisar / ignorar</span>
              <strong className="mt-1 block text-lg text-amber-900">{preview.failures.length}</strong>
            </div>
          </div>

          {preview.rows.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold text-slate-600">Prévia de funcionários válidos</h3>
              <ul className="space-y-1.5">
                {preview.rows.slice(0, 5).map(({ rowNumber, employee }) => (
                  <li
                    key={`${rowNumber}-${employee.idFuncionario}`}
                    className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 break-words font-semibold text-slate-700">
                      Linha {rowNumber}: {employee.nome}
                    </span>
                    <span className="font-mono text-slate-500">{employee.idFuncionario}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.failures.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <AlertCircle className="h-4 w-4" />
                Linhas que precisam de revisão
              </h3>
              <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                {preview.failures.slice(0, 20).map((failure) => (
                  <li
                    key={`${failure.rowNumber}-${failure.employeeId}`}
                    className="rounded-lg bg-amber-50/70 px-3 py-2 text-xs text-amber-900"
                  >
                    <span className="font-bold">Linha {failure.rowNumber}</span>
                    {failure.employeeName && ` — ${failure.employeeName}`}
                    <span className="block mt-0.5">{failure.message}</span>
                  </li>
                ))}
              </ul>
              {preview.failures.length > 20 && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Exibindo as primeiras 20 linhas com problemas.
                </p>
              )}
            </div>
          )}

          {preview.rows.length > 0 && !importResult && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={busy}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-yinmn px-4 text-sm font-bold text-white transition hover:bg-cadet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yinmn focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
              >
                <Upload className="h-4 w-4" />
                {busy
                  ? `Importando ${importProgress}/${preview.rows.length}...`
                  : `Importar ${preview.rows.length} funcionário(s) válido(s)`}
              </button>
              {busy && (
                <div
                  role="progressbar"
                  aria-label="Progresso da importação"
                  aria-valuemin={0}
                  aria-valuemax={preview.rows.length}
                  aria-valuenow={importProgress}
                  className="h-2 overflow-hidden rounded-full bg-sky-100"
                >
                  <div
                    className="h-full rounded-full bg-yinmn transition-[width]"
                    style={{
                      width: `${(importProgress / preview.rows.length) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {importResult && (
        <div
          role={importResult.refreshError || importResult.failures.length ? "alert" : "status"}
          className={`rounded-xl border p-3 text-sm ${
            importResult.refreshError || importResult.failures.length
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {importResult.created} funcionário(s) criado(s), dos quais{" "}
            {importResult.imported} concluíram todos os vínculos.
            {importResult.failures.length > 0 &&
              ` ${importResult.failures.length} linha(s) não foram importadas.`}
          </p>
          {importResult.refreshError && (
            <p className="mt-2">{importResult.refreshError}</p>
          )}
          {importResult.failures.length > 0 && (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
              {importResult.failures.slice(0, 20).map((failure) => (
                <li key={`${failure.rowNumber}-${failure.employeeId}`}>
                  Linha {failure.rowNumber}: {failure.employeeName || failure.employeeId} — {failure.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};
