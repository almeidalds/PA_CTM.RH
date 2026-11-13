/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { readSheet } from "read-excel-file/browser";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  CalendarClock,
  ChevronDown,
  Check,
  CheckCircle2,
  CircleHelp,
  FileSpreadsheet,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  UserRoundPlus,
  UsersRound,
  X,
} from "lucide-react";
import type { CatalogosRH } from "../services/dataverseCatalogs";
import {
  carregarContratacoesFuturas,
  criarContratacaoFutura,
  salvarContratacaoFutura,
} from "../services/futureHiresDataSource";
import { efetivarContratacaoFutura } from "../services/futureHireActivation";
import {
  FUTURE_HIRE_COLUMNS,
  FUTURE_HIRE_STATUS_LABELS,
  validarEfetivacao,
  type FutureHire,
  type FutureHireStatus,
} from "../types/futureHires";
import { listarContratacoesPendentes } from "../types/futureHires";

type ImportRow = {
  hire: FutureHire;
  line: number;
  errors: string[];
  warnings: string[];
};

type FutureHireTextKey =
  | "instrutorNovo"
  | "cpf"
  | "loginSud"
  | "nomePlaqueta"
  | "numero"
  | "emailChurch"
  | "emailTrain"
  | "linkZoom"
  | "email"
  | "grupoOrigem"
  | "matricula"
  | "observacoes";

const EMPTY_HIRE: FutureHire = {
  id: "",
  instrutorNovo: "",
  idiomas: "",
  zona: "",
  cpf: "",
  loginSud: "",
  nomePlaqueta: "",
  numero: "",
  emailChurch: "",
  emailTrain: "",
  linkZoom: "",
  email: "",
  mandouCurriculo: null,
  recebeuLigacao: null,
  emailRH: null,
  curriculoAvaliacao: null,
  grupoWhatsApp: null,
  mandouInformacoes: null,
  plaquetasEncaminhadas: null,
  acessosSolicitados: null,
  notebooksProntos: null,
  kitsProntos: null,
  grupoOrigem: "",
  linhaOrigem: null,
  dataPrevistaInicio: null,
  dataRealInicio: null,
  statusConfirmacao: "aguardando_confirmacao",
  fase: "pendente",
  cargo: null,
  matricula: "",
  observacoes: "",
  employeeRecordId: null,
};

const CHECKLIST_KEYS = FUTURE_HIRE_COLUMNS
  .filter((column) => column.kind === "check")
  .map((column) => column.key);

const STATUS_STYLE: Record<FutureHireStatus, string> = {
  aguardando_confirmacao: "border-amber-200 bg-amber-50 text-amber-800",
  inicio_confirmado: "border-emerald-200 bg-emerald-50 text-emerald-800",
  data_reagendada: "border-sky-200 bg-sky-50 text-sky-800",
  cancelado: "border-rose-200 bg-rose-50 text-rose-800",
};

const text = (value: unknown) =>
  value === null || value === undefined ? "" : String(value).trim();

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g, "");

function saoPauloToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dayDifference(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = saoPauloToday()
    .split("-").map(Number);
  return Math.round(
    (Date.UTC(year, month - 1, day) -
      Date.UTC(todayYear, todayMonth - 1, todayDay)) / 86400000,
  );
}

function daysUntilEndOfSaoPauloWeek(): number {
  const [year, month, day] = saoPauloToday().split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 0 : 7 - weekday;
}

function isThisWeek(date: string): boolean {
  const delta = dayDifference(date);
  return delta >= 0 && delta <= daysUntilEndOfSaoPauloWeek();
}

function formatDate(value: string | null): string {
  if (!value) return "Data a definir";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function isOverdue(hire: FutureHire): boolean {
  return Boolean(
    hire.dataPrevistaInicio &&
    hire.dataPrevistaInicio < saoPauloToday() &&
    !hire.dataRealInicio &&
    hire.statusConfirmacao !== "cancelado" &&
    hire.fase === "pendente",
  );
}

function parseCheck(value: unknown): boolean | null {
  if (value === null || value === undefined || text(value) === "") return null;
  if (typeof value === "boolean") return value;
  const normalized = normalize(text(value));
  if (["sim", "s", "yes", "y", "true", "1", "x"].includes(normalized)) {
    return true;
  }
  if (["nao", "n", "no", "false", "0"].includes(normalized)) return false;
  throw new Error("Use Sim/Não ou deixe o item em branco.");
}

function parseSpreadsheetDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const raw = text(value);
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const match = iso
    ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
    : br
      ? { year: Number(br[3]), month: Number(br[2]), day: Number(br[1]) }
      : null;
  if (!match) return null;
  const parsed = new Date(Date.UTC(match.year, match.month - 1, match.day));
  if (
    parsed.getUTCFullYear() !== match.year ||
    parsed.getUTCMonth() !== match.month - 1 ||
    parsed.getUTCDate() !== match.day
  ) return null;
  return `${match.year}-${String(match.month).padStart(2, "0")}-${String(match.day).padStart(2, "0")}`;
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = content.replace(/^\uFEFF/, "");
  const firstLine = input.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = ([";", ",", "\t"] as const).reduce((best, item) =>
    firstLine.split(item).length > firstLine.split(best).length ? item : best, ";");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\r" || char === "\n") && !quoted) {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function cellValue(row: unknown[], key: string, headerMap: Map<string, number>, fallback: number): unknown {
  const column = headerMap.get(normalize(key));
  return row[column ?? fallback];
}

function spreadsheetRows(
  inputRows: unknown[][],
  fileName: string,
): ImportRow[] {
  if (!inputRows.length) return [];
  const headers = inputRows[0].map((value) => normalize(text(value)));
  const hasHeader = FUTURE_HIRE_COLUMNS.some((column) =>
    headers.includes(normalize(column.label)),
  );
  const headerMap = new Map(headers.map((header, index) => [header, index]));
  const firstDataIndex = hasHeader ? 1 : 0;
  const groupColumn = headerMap.get(normalize("Grupo Original"));
  const lineColumn = headerMap.get(normalize("Linha Original"));
  const expectedDateColumn = headerMap.get(normalize("Data Prevista de Início"));

  return inputRows.slice(firstDataIndex).map((cells, index) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const hire: FutureHire = {
      ...EMPTY_HIRE,
      grupoOrigem: groupColumn === undefined
        ? `Importado de ${fileName}`
        : text(cells[groupColumn]),
      linhaOrigem: lineColumn === undefined
        ? index + firstDataIndex + 1
        : Number(cells[lineColumn]) || index + firstDataIndex + 1,
      dataPrevistaInicio: expectedDateColumn === undefined
        ? null
        : parseSpreadsheetDate(cells[expectedDateColumn]),
    };

    FUTURE_HIRE_COLUMNS.forEach((column, columnIndex) => {
      const value = cellValue(
        cells,
        column.label,
        headerMap,
        columnIndex,
      );
      if (column.kind === "check") {
        try {
          Object.assign(hire, { [column.key]: parseCheck(value) });
        } catch (error) {
          errors.push(
            `${column.label}: ${
              error instanceof Error ? error.message : "valor inválido."
            }`,
          );
        }
      } else {
        Object.assign(hire, { [column.key]: text(value) });
      }
    });

    const rawDate = expectedDateColumn === undefined
      ? ""
      : text(cells[expectedDateColumn]);
    if (rawDate && !hire.dataPrevistaInicio) {
      hire.observacoes =
        `Data de início original sem dia/ano completo: ${rawDate}`;
    }
    if (expectedDateColumn !== undefined && rawDate && !hire.dataPrevistaInicio) {
      warnings.push(
        "Data incompleta: o original ficará em observações e o registro será importado sem data.",
      );
    }
    if (!hire.instrutorNovo) errors.push("Nome não informado.");
    if (cells.length < FUTURE_HIRE_COLUMNS.length) {
      errors.push("A linha possui menos colunas que o modelo de 21 campos.");
    }
    return {
      hire,
      line: index + firstDataIndex + 1,
      errors,
      warnings,
    };
  });
}

function uniqueKeys(hire: FutureHire): string[] {
  return [
    ["matricula", hire.matricula],
    ["cpf", hire.cpf.replace(/\D/g, "")],
    ["login", hire.loginSud],
    ["email", hire.email],
    ["emailChurch", hire.emailChurch],
  ].filter(([, value]) => Boolean(value))
    .map(([field, value]) => `${field}:${normalize(value)}`);
}

function statusFromLabel(label: string): FutureHireStatus {
  const statuses = Object.keys(FUTURE_HIRE_STATUS_LABELS) as FutureHireStatus[];
  return statuses.find(
    (status) => FUTURE_HIRE_STATUS_LABELS[status] === label,
  ) ??
    "aguardando_confirmacao";
}

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-yinmn focus:ring-2 focus:ring-yinmn/15";

function StatusBadge({ status }: { status: FutureHireStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[status]}`}>
      {FUTURE_HIRE_STATUS_LABELS[status]}
    </span>
  );
}

function Checklist({ hire, onChange }: {
  hire: FutureHire;
  onChange: (updated: FutureHire) => void;
}) {
  const done = CHECKLIST_KEYS.filter((key) => hire[key] === true).length;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Checklist de preparação</h3>
        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-yinmn">
          {done} de 10 concluídas
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {FUTURE_HIRE_COLUMNS.filter((column) => column.kind === "check").map((column) => (
          <label key={column.key} className="flex items-start gap-2 rounded-lg border border-slate-100 p-2.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={hire[column.key] === true}
              onChange={(event) => onChange({
                ...hire,
                [column.key]: event.target.checked,
              })}
              className="mt-0.5 accent-[#006184]"
            />
            <span>{column.label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function HireEditor({
  hire,
  catalogs,
  onChange,
}: {
  hire: FutureHire;
  catalogs: CatalogosRH;
  onChange: (updated: FutureHire) => void;
}) {
  const set = <K extends keyof FutureHire>(key: K, value: FutureHire[K]) =>
    onChange({ ...hire, [key]: value });
  const textField = <K extends FutureHireTextKey,>(
    label: string,
    key: K,
    type = "text",
    sensitive = false,
  ) => (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <input
        className={inputClass}
        type={sensitive ? "password" : type}
        value={hire[key]}
        onChange={(event) => set(key, event.target.value)}
        autoComplete="off"
      />
    </label>
  );
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="font-semibold text-slate-800">Dados da planilha</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {textField("Instrutor novo / nome", "instrutorNovo")}
          {textField("CPF", "cpf", "text", true)}
          {textField("Matrícula", "matricula")}
          {textField("Telefone", "numero", "tel")}
          {textField("Login SUD", "loginSud")}
          {textField("Nome da plaqueta", "nomePlaqueta")}
          {textField("E-mail Church", "emailChurch", "email")}
          {textField("E-mail TRAIN", "emailTrain", "email")}
          {textField("E-mail", "email", "email")}
          {textField("Link do Zoom", "linkZoom", "url")}
          <label className="block text-xs font-semibold text-slate-600">
            Idioma (o esquema aceita um idioma)
            <select className={inputClass} value={hire.idiomas} onChange={(event) => set("idiomas", event.target.value)}>
              <option value="">Não informado</option>
              {catalogs.idiomas.map((item) => <option key={item.id} value={item.nome}>{item.nome}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Zona
            <select className={inputClass} value={hire.zona} onChange={(event) => set("zona", event.target.value)}>
              <option value="">Não informada</option>
              {catalogs.zonas.map((item) => <option key={item.id} value={item.nome}>{item.nome}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Cargo
            <select className={inputClass} value={hire.cargo ?? ""} onChange={(event) => set("cargo", event.target.value || null)}>
              <option value="">Não informado</option>
              {catalogs.cargos.map((item) => <option key={item.id} value={item.nome}>{item.nome}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-slate-800">Admissão e acompanhamento</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-600">
            Data prevista de início
            <input className={inputClass} type="date" value={hire.dataPrevistaInicio ?? ""} onChange={(event) => set("dataPrevistaInicio", event.target.value || null)} />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Data real de início
            <input className={inputClass} type="date" value={hire.dataRealInicio ?? ""} onChange={(event) => set("dataRealInicio", event.target.value || null)} />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Status de confirmação
            <select className={inputClass} value={FUTURE_HIRE_STATUS_LABELS[hire.statusConfirmacao]} onChange={(event) => set("statusConfirmacao", statusFromLabel(event.target.value))}>
              {Object.values(FUTURE_HIRE_STATUS_LABELS).map((label) => <option key={label} value={label}>{label}</option>)}
            </select>
          </label>
          {textField("Grupo original", "grupoOrigem")}
          <label className="block text-xs font-semibold text-slate-600">
            Linha original
            <input className={inputClass} type="number" min="1" value={hire.linhaOrigem ?? ""} onChange={(event) => set("linhaOrigem", event.target.value ? Number(event.target.value) : null)} />
          </label>
          {textField("Observações", "observacoes")}
        </div>
        <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          <CircleHelp className="h-4 w-4 shrink-0" />
          Responsável pelo acompanhamento, turno, múltiplos idiomas e o histórico dedicado ainda não existem no esquema Dataverse gerado; não serão gravados como se estivessem persistidos.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-slate-800">Checklist de preparação</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {FUTURE_HIRE_COLUMNS.filter((column) => column.kind === "check").map((column) => (
            <label key={column.key} className="block text-xs font-semibold text-slate-600">
              {column.label}
              <select
                className={inputClass}
                value={hire[column.key] === null ? "" : hire[column.key] ? "yes" : "no"}
                onChange={(event) => onChange(Object.assign({}, hire, {
                  [column.key]: event.target.value === ""
                    ? null
                    : event.target.value === "yes",
                }))}
              >
                <option value="">Não preenchido</option>
                <option value="yes">Sim</option>
                <option value="no">Não</option>
              </select>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

export function FutureHiresPage() {
  const [hires, setHires] = useState<FutureHire[]>([]);
  const [catalogs, setCatalogs] = useState<CatalogosRH | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activationBusy, setActivationBusy] = useState(false);
  const [activationError, setActivationError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [onlyUndated, setOnlyUndated] = useState(false);
  const [startGroupFilter, setStartGroupFilter] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const filtersPanelId = useId();
  const [selected, setSelected] = useState<FutureHire | null>(null);
  const [activationHire, setActivationHire] = useState<FutureHire | null>(null);
  const [activationDate, setActivationDate] = useState("");
  const [editor, setEditor] = useState<FutureHire | null>(null);
  const [dateEditor, setDateEditor] = useState<FutureHire | null>(null);
  const [dateReason, setDateReason] = useState("");
  const [reason, setReason] = useState("");
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importCorrection, setImportCorrection] = useState<{
    line: number;
    hire: FutureHire;
  } | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await carregarContratacoesFuturas();
      setHires(result.hires);
      setCatalogs(result.catalogs);
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : "Não foi possível carregar as contratações futuras.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const pending = useMemo(
    () => listarContratacoesPendentes(hires),
    [hires],
  );
  const active = pending.filter((hire) => hire.statusConfirmacao !== "cancelado");
  const stats = {
    total: active.length,
    confirmed: active.filter((hire) => hire.statusConfirmacao === "inicio_confirmado").length,
    waiting: active.filter((hire) => hire.statusConfirmacao === "aguardando_confirmacao").length,
    overdue: active.filter(isOverdue).length,
  };
  const filtered = pending.filter((hire) => {
    if (statusFilter && hire.statusConfirmacao !== statusFilter) return false;
    if (dateFrom && (!hire.dataPrevistaInicio || hire.dataPrevistaInicio < dateFrom)) return false;
    if (dateTo && (!hire.dataPrevistaInicio || hire.dataPrevistaInicio > dateTo)) return false;
    if (onlyOverdue && !isOverdue(hire)) return false;
    if (onlyUndated && hire.dataPrevistaInicio) return false;
    if (startGroupFilter) {
      if (startGroupFilter === "undated" && hire.dataPrevistaInicio) return false;
      if (startGroupFilter === "overdue" && !isOverdue(hire)) return false;
      if (startGroupFilter === "today" && (!hire.dataPrevistaInicio || dayDifference(hire.dataPrevistaInicio) !== 0)) return false;
      if (startGroupFilter === "week" && (!hire.dataPrevistaInicio || dayDifference(hire.dataPrevistaInicio) < 1 || !isThisWeek(hire.dataPrevistaInicio))) return false;
      if (startGroupFilter === "month" && (!hire.dataPrevistaInicio || dayDifference(hire.dataPrevistaInicio) <= daysUntilEndOfSaoPauloWeek() || dayDifference(hire.dataPrevistaInicio) > 30)) return false;
      if (startGroupFilter === "later" && (!hire.dataPrevistaInicio || dayDifference(hire.dataPrevistaInicio) <= 30)) return false;
    }
    const query = normalize(search);
    if (query) {
      const fields = [
        hire.instrutorNovo,
        hire.cargo ?? "",
        hire.zona,
        hire.matricula,
        hire.idiomas,
      ];
      if (!fields.some((value) => normalize(value).includes(query))) return false;
    }
    return true;
  });
  const activeFilterCount = [
    search.trim(),
    statusFilter,
    dateFrom,
    dateTo,
    onlyOverdue,
    onlyUndated,
    startGroupFilter,
  ].filter(Boolean).length;
  const groups = useMemo(() => {
    const grouped = new Map<string, FutureHire[]>();
    filtered.forEach((hire) => {
      const key = hire.dataPrevistaInicio ?? "sem-data";
      grouped.set(key, [...(grouped.get(key) ?? []), hire]);
    });
    return [...grouped.entries()]
      .sort(([first], [second]) =>
        first === "sem-data" ? 1 : second === "sem-data" ? -1 : first.localeCompare(second))
      .map(([date, records]) => ({
        date: date === "sem-data" ? null : date,
        records: records.sort((a, b) => a.instrutorNovo.localeCompare(b.instrutorNovo, "pt-BR")),
      }));
  }, [filtered]);

  const save = async (updated: FutureHire, changeReason = "") => {
    if (!catalogs) return;
    const original = hires.find((hire) => hire.id === updated.id);
    if (!updated.instrutorNovo.trim()) {
      setError("Informe o nome completo antes de salvar.");
      return;
    }
    if (original && original.dataPrevistaInicio !== updated.dataPrevistaInicio && !changeReason.trim()) {
      setError("Informe o motivo da alteração da data prevista.");
      return;
    }
    const updatedKeys = uniqueKeys(updated);
    const existingKeys = new Set(
      hires.filter((hire) => hire.id !== updated.id).flatMap(uniqueKeys),
    );
    if (updatedKeys.some((key) => existingKeys.has(key))) {
      setError("Já existe uma contratação com a mesma matrícula, CPF, login ou e-mail.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (original) {
        await salvarContratacaoFutura(original, updated, catalogs, changeReason);
        setNotice("Alterações salvas no Dataverse.");
      } else {
        await criarContratacaoFutura(updated, catalogs);
        setNotice("Contratação cadastrada no Dataverse.");
      }
      setEditor(null);
      setSelected(null);
      setDateEditor(null);
      setDateReason("");
      setReason("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const activateHire = async () => {
    if (!activationHire || !activationDate) return;
    const validationProblems = validarEfetivacao(
      activationHire,
      activationDate,
    );
    if (validationProblems.length > 0) {
      setActivationError(validationProblems.join(" "));
      return;
    }
    setActivationBusy(true);
    setActivationError("");
    setError("");
    setNotice("");
    try {
      const result = await efetivarContratacaoFutura(
        activationHire.id,
        activationDate,
      );
      setActivationHire(null);
      setSelected(null);
      setNotice(
        result.jaEfetivado
          ? "Esta contratação já estava efetivada. O vínculo com o funcionário foi confirmado."
          : "Contratação efetivada e funcionário criado com sucesso.",
      );
      await refresh();
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Não foi possível efetivar a contratação.";
      setActivationError(message);
      setError(message);
    } finally {
      setActivationBusy(false);
    }
  };

  const readFile = async (file: File) => {
    setError("");
    setNotice("");
    try {
      const extension = file.name.toLocaleLowerCase("pt-BR").split(".").pop();
      let       rows: unknown[][];
      if (extension === "csv") {
        rows = parseCsv(await file.text());
      } else if (extension === "xlsx" || extension === "xlsm") {
        rows = await readSheet(file, 1);
      } else {
        throw new Error("Selecione um arquivo .xlsx, .xlsm ou .csv.");
      }
      const preview = spreadsheetRows(rows, file.name);
      const existing = new Set(hires.flatMap(uniqueKeys));
      const seen = new Set<string>();
      setImportRows(preview.map((row) => {
        const keys = uniqueKeys(row.hire);
        const duplicate = keys.some((key) => existing.has(key) || seen.has(key));
        keys.forEach((key) => seen.add(key));
        return duplicate
          ? { ...row, errors: [...row.errors, "Possível duplicidade por matrícula, CPF, login ou e-mail."] }
          : row;
      }));
    } catch (cause) {
      setImportRows(null);
      setError(cause instanceof Error ? cause.message : "Não foi possível ler o arquivo.");
    }
  };

  const importValidRows = async () => {
    if (!catalogs || !importRows) return;
    const existing = new Set(hires.flatMap(uniqueKeys));
    const seen = new Set<string>();
    const valid: ImportRow[] = [];
    const updatedRows = importRows.map((row) => {
      const keys = uniqueKeys(row.hire);
      const duplicate = keys.some((key) => existing.has(key) || seen.has(key));
      keys.forEach((key) => seen.add(key));
      const errors = row.errors.filter(
        (message) => !message.startsWith("Possível duplicidade"),
      );
      if (duplicate) {
        errors.push("Possível duplicidade por matrícula, CPF, login ou e-mail.");
      }
      if (!errors.length) valid.push(row);
      return { ...row, errors };
    });
    setImportRows(updatedRows);
    if (!valid.length) return;

    setImportBusy(true);
    setError("");
    const failures: string[] = [];
    for (const row of valid) {
      try {
        await criarContratacaoFutura(row.hire, catalogs);
      } catch (cause) {
        failures.push(
          `Linha ${row.line}: ${cause instanceof Error ? cause.message : "falha ao gravar."}`,
        );
      }
    }
    setImportBusy(false);
    await refresh();
    if (failures.length) {
      setError(`Importação parcial; ${failures.length} linha(s) não foram gravadas. ${failures.join(" ")}`);
    } else {
      setNotice(`${valid.length} contratação(ões) importada(s) para a tabela de contratações futuras.`);
      setImportRows(null);
    }
  };

  const groupLabel = (date: string | null, records: FutureHire[]) => {
    if (!date) return "Data a definir";
    const delta = dayDifference(date);
    const label = delta < 0
      ? records.some(isOverdue) ? "Atrasado / Pendente" : "Data passada"
      : delta === 0
        ? "Hoje"
        : isThisWeek(date)
          ? "Esta semana"
          : delta <= 30
            ? "Próximos 30 dias"
            : "";
    return `${formatDate(date)}${label ? ` · ${label}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-yinmn">
              <UserRoundPlus className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-oxford">Contratações Futuras</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Acompanhe admissões, prazos e preparação
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-yinmn">
            <FileSpreadsheet className="h-4 w-4" /> Importar Planilha
          </button>
          <input ref={fileInput} hidden type="file" accept=".xlsx,.xlsm,.csv" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
            event.currentTarget.value = "";
          }} />
          <button type="button" disabled={loading || !catalogs} title={!catalogs ? "Aguardando os catálogos do Dataverse" : undefined} onClick={() => { setError(""); setEditor({ ...EMPTY_HIRE }); }} className="inline-flex items-center gap-2 rounded-lg bg-yinmn px-3 py-2 text-sm font-semibold text-white hover:bg-cadet disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="h-4 w-4" /> Nova Contratação
          </button>
          <button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Atualizar dados" title="Atualizar dados" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" />{notice}</div>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {([
          { label: "Pendentes", count: stats.total, Icon: UsersRound, color: "text-yinmn", background: "bg-sky-50" },
          { label: "Início confirmado", count: stats.confirmed, Icon: CheckCircle2, color: "text-emerald-700", background: "bg-emerald-50" },
          { label: "Aguardando confirmação", count: stats.waiting, Icon: CalendarClock, color: "text-amber-700", background: "bg-amber-50" },
          { label: "Atrasados", count: stats.overdue, Icon: ShieldAlert, color: "text-rose-700", background: "bg-rose-50" },
          ] as { label: string; count: number; Icon: LucideIcon; color: string; background: string }[]).map(({ label, count, Icon, color, background }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${background}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-none text-oxford">{count}</p>
                <p className="mt-1 truncate text-xs font-medium text-slate-500">{label}</p>
              </div>
            </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <label className="relative block min-w-0 flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input className={`${inputClass} mt-0 pl-9`} aria-label="Buscar contratações" placeholder="Buscar por nome, zona, matrícula ou idioma" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <div className="flex items-center gap-2">
            <button
            type="button"
            onClick={() => setFiltersExpanded((expanded) => !expanded)}
            aria-expanded={filtersExpanded}
            aria-controls={filtersPanelId}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              activeFilterCount
                ? "border-sky-200 bg-sky-50 text-yinmn"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
            >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {activeFilterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-yinmn px-1 text-[10px] text-white">{activeFilterCount}</span>}
            <ChevronDown className={`h-4 w-4 transition-transform ${filtersExpanded ? "rotate-180" : ""}`} />
            </button>
            {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => { setSearch(""); setStatusFilter(""); setDateFrom(""); setDateTo(""); setOnlyOverdue(false); setOnlyUndated(false); setStartGroupFilter(""); }}
              className="rounded-lg px-2 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-rose-700"
            >
              Limpar
            </button>
            )}
          </div>
        </div>
        <div id={filtersPanelId} hidden={!filtersExpanded} className="border-t border-slate-100 bg-slate-50/60 p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs font-semibold text-slate-600">
            Status
            <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Todos os status</option>
              {(Object.keys(FUTURE_HIRE_STATUS_LABELS) as FutureHireStatus[]).map((status) => <option key={status} value={status}>{FUTURE_HIRE_STATUS_LABELS[status]}</option>)}
            </select>
            </label>
            <label className="block text-xs font-semibold text-slate-600">
            Início previsto a partir de
            <input className={inputClass} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
            Início previsto até
            <input className={inputClass} type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
            Período de início
            <select className={inputClass} value={startGroupFilter} onChange={(event) => setStartGroupFilter(event.target.value)}>
              <option value="">Todos os períodos</option>
              <option value="today">Hoje</option>
              <option value="week">Esta semana</option>
              <option value="month">Próximos 30 dias</option>
              <option value="later">Após 30 dias</option>
              <option value="overdue">Atrasadas</option>
              <option value="undated">Data a definir</option>
            </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 text-xs">
            <span className="mr-1 font-semibold text-slate-500">Atalhos:</span>
            <button type="button" aria-pressed={onlyOverdue} onClick={() => { setOnlyOverdue((value) => !value); setOnlyUndated(false); }} className={`rounded-full border px-3 py-1.5 font-medium transition-colors ${onlyOverdue ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>Atrasadas ({stats.overdue})</button>
            <button type="button" aria-pressed={onlyUndated} onClick={() => { setOnlyUndated((value) => !value); setOnlyOverdue(false); }} className={`rounded-full border px-3 py-1.5 font-medium transition-colors ${onlyUndated ? "border-sky-200 bg-sky-50 text-sky-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>Sem data definida</button>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-bold text-oxford">Lista de contratações</h2>
        <p className="text-xs text-slate-500">
          {filtered.length} de {pending.length} {pending.length === 1 ? "contratação pendente" : "contratações pendentes"}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white p-10 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando do Dataverse...
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Nenhuma contratação pendente corresponde aos filtros.
        </div>
      ) : groups.map((group) => (
        <section key={group.date ?? "sem-data"} className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-bold text-oxford">
              <CalendarClock className="h-4 w-4 text-yinmn" />
              Início em: {groupLabel(group.date, group.records)} — {group.records.length} {group.records.length === 1 ? "pessoa prevista" : "pessoas previstas"}
            </div>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left text-sm">
              <thead className="bg-white text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Matrícula</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Zona</th>
                  <th className="px-4 py-3">Idioma</th>
                  <th className="px-4 py-3">Preparação</th>
                  <th className="px-4 py-3 text-right">Perfil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {group.records.map((hire) => (
                  <tr key={hire.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3.5 font-semibold text-oxford">
                      <span className="block max-w-64 truncate">{hire.instrutorNovo || "Nome não informado"}</span>
                    </td>
                    <td className="px-4 py-3.5 text-xs">{hire.matricula || "—"}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={hire.statusConfirmacao} />
                        {isOverdue(hire) && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">Atrasado</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs">{hire.zona || "—"}</td>
                    <td className="px-4 py-3.5 text-xs">{hire.idiomas || "—"}</td>
                    <td className="px-4 py-3.5">
                      {(() => {
                        const completed = CHECKLIST_KEYS.filter((key) => hire[key] === true).length;
                        return (
                          <div className="flex items-center gap-2">
                            <span className="min-w-8 text-xs font-semibold text-slate-600">{completed}/10</span>
                            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                              <span className="block h-full rounded-full bg-yinmn" style={{ width: `${completed * 10}%` }} />
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button type="button" onClick={() => setSelected(hire)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-yinmn transition-colors hover:bg-sky-50">Ver perfil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {editor && catalogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="hire-editor-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="hire-editor-title" className="text-lg font-bold text-oxford">{editor.id ? "Editar contratação" : "Nova Contratação"}</h2>
              <button type="button" onClick={() => setEditor(null)} aria-label="Fechar" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <HireEditor hire={editor} catalogs={catalogs} onChange={setEditor} />
            {editor.id && hires.find((hire) => hire.id === editor.id)?.dataPrevistaInicio !== editor.dataPrevistaInicio && (
              <label className="mt-4 block text-xs font-semibold text-slate-600">
                Motivo da alteração da data (obrigatório)
                <textarea className={inputClass} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditor(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancelar</button>
              <button type="button" disabled={saving} onClick={() => void save(editor, reason)} className="rounded-lg bg-yinmn px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Salvando..." : "Salvar no Dataverse"}</button>
            </div>
          </section>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/35" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <aside role="dialog" aria-modal="true" aria-label={`Perfil de ${selected.instrutorNovo}`} className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-slate-100 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-yinmn">Perfil da contratação futura</p>
                <h2 className="mt-1 text-xl font-bold text-oxford">{selected.instrutorNovo}</h2>
                <p className="mt-1 text-xs text-slate-500">Matrícula {selected.matricula || "não informada"} · {selected.zona || "zona não informada"}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Fechar perfil" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </header>
            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <section className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                <div><p className="text-[11px] text-slate-500">Status</p><div className="mt-1"><StatusBadge status={selected.statusConfirmacao} /></div></div>
                <div><p className="text-[11px] text-slate-500">Data prevista</p><p className="mt-1 text-sm font-semibold">{formatDate(selected.dataPrevistaInicio)}</p></div>
                <div><p className="text-[11px] text-slate-500">Data real de início</p><p className="mt-1 text-sm font-semibold">{formatDate(selected.dataRealInicio)}</p></div>
                <div><p className="text-[11px] text-slate-500">Cargo</p><p className="mt-1 text-sm font-semibold">{selected.cargo ?? "Não configurado no Dataverse"}</p></div>
              </section>

              <section>
                <h3 className="mb-3 font-semibold text-slate-800">Dados pessoais, profissionais e acessos</h3>
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {FUTURE_HIRE_COLUMNS.filter((column) => column.kind !== "check").map((column) => {
                    const value = selected[column.key];
                    const masked = column.kind === "sensitive" && String(value ?? "").length > 4
                      ? `•••${String(value).slice(-4)}`
                      : String(value ?? "") || "Não informado";
                    return <div key={column.key} className="rounded-lg border border-slate-100 p-3"><dt className="text-[10px] font-semibold uppercase text-slate-400">{column.label}</dt><dd className="mt-1 break-words text-sm text-slate-700">{masked}</dd></div>;
                  })}
                </dl>
              </section>

              <Checklist hire={selected} onChange={(updated) => setSelected(updated)} />

              <section>
                <h3 className="mb-2 font-semibold text-slate-800">Histórico registrado em observações</h3>
                <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                  {selected.observacoes.split(/\r?\n/).filter((line) => line.startsWith("[CTM RH | Histórico]")).reverse().map((line, index) => <p key={`${index}-${line}`}>{line.replace("[CTM RH | Histórico] ", "")}</p>)}
                  {!selected.observacoes.includes("[CTM RH | Histórico]") && <p>Nenhuma alteração de data/status registrada pelo aplicativo.</p>}
                </div>
                <p className="mt-2 text-[11px] text-amber-800">Este histórico é anexado às observações da contratação. Para auditoria imutável, habilite a auditoria Dataverse e configure uma tabela de histórico dedicada.</p>
              </section>

              <section className={`rounded-xl border p-4 text-sm ${
                selected.statusConfirmacao === "inicio_confirmado" && selected.fase === "pendente"
                  ? "border-emerald-200 bg-emerald-50/70 text-emerald-950"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }`}>
                <div className="flex items-start gap-3">
                  {selected.statusConfirmacao === "inicio_confirmado" && selected.fase === "pendente"
                    ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                    : <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />}
                  <div>
                    <h3 className="font-semibold">Efetivação no Dataverse</h3>
                    <p className="mt-1 text-xs leading-relaxed opacity-80">
                      A operação valida os dados no servidor e cria ou confirma o vínculo do funcionário de forma transacional.
                    </p>
                  </div>
                </div>
                {selected.statusConfirmacao !== "inicio_confirmado" && (
                  <p className="mt-3 text-xs">Confirme o início da contratação antes de efetivar.</p>
                )}
                {selected.fase !== "pendente" && (
                  <p className="mt-3 text-xs">Esta contratação não está pendente de efetivação.</p>
                )}
                <button
                  type="button"
                  disabled={
                    activationBusy ||
                    selected.statusConfirmacao !== "inicio_confirmado" ||
                    selected.fase !== "pendente"
                  }
                  onClick={() => {
                    setActivationDate(selected.dataRealInicio ?? "");
                    setActivationHire(selected);
                    setActivationError("");
                    setError("");
                  }}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-yinmn px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-cadet disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Efetivar contratação
                </button>
              </section>
            </div>
            <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 p-4">
              <button type="button" onClick={() => { setEditor({ ...selected }); setReason(""); setSelected(null); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Editar perfil</button>
              <button type="button" onClick={() => { setDateEditor({ ...selected }); setDateReason(""); }} className="rounded-lg border border-sky-200 px-3 py-2 text-sm font-semibold text-yinmn">Alterar Data de Início</button>
              {selected.statusConfirmacao !== "inicio_confirmado" && selected.statusConfirmacao !== "cancelado" && <button type="button" disabled={saving} onClick={() => void save({ ...selected, statusConfirmacao: "inicio_confirmado" }, "Início confirmado pelo RH")} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirmar início</button>}
              {selected.statusConfirmacao !== "cancelado" && <button type="button" disabled={saving} onClick={() => void save({ ...selected, statusConfirmacao: "cancelado" }, "Contratação cancelada pelo RH")} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50">Cancelar contratação</button>}
              <button type="button" disabled={saving} onClick={() => void save(selected)} className="inline-flex items-center gap-2 rounded-lg bg-yinmn px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Check className="h-4 w-4" />Salvar alterações</button>
            </footer>
          </aside>
        </div>
      )}

      {activationHire && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-3">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="hire-activation-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="hire-activation-title" className="text-lg font-bold text-oxford">
                  Confirmar efetivação
                </h2>
                <p className="mt-1 text-sm text-slate-600">{activationHire.instrutorNovo}</p>
                <p className="mt-1 text-xs text-slate-500">Matrícula {activationHire.matricula || "não informada"}</p>
              </div>
              <button
                type="button"
                onClick={() => setActivationHire(null)}
                disabled={activationBusy}
                aria-label="Fechar confirmação"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 rounded-lg bg-sky-50 p-3 text-xs leading-relaxed text-sky-950">
              O Dataverse verificará os dados, criará o funcionário e atualizará esta contratação na mesma operação.
            </p>
            <label className="mt-4 block text-xs font-semibold text-slate-700">
              Data real de início
              <input
                className={inputClass}
                type="date"
                required
                value={activationDate}
                onChange={(event) => setActivationDate(event.target.value)}
              />
            </label>
            {activationError && (
              <p
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{activationError}</span>
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActivationHire(null)}
                disabled={activationBusy}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={activationBusy || !activationDate}
                onClick={() => void activateHire()}
                className="inline-flex items-center gap-2 rounded-lg bg-yinmn px-3 py-2 text-sm font-semibold text-white hover:bg-cadet disabled:cursor-not-allowed disabled:opacity-50"
              >
                {activationBusy && <RefreshCw className="h-4 w-4 animate-spin" />}
                {activationBusy ? "Processando..." : "Confirmar e efetivar"}
              </button>
            </div>
          </section>
        </div>
      )}

      {importRows && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3">
          <section role="dialog" aria-modal="true" aria-labelledby="hire-import-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div><h2 id="hire-import-title" className="text-lg font-bold text-oxford">Prévia da importação</h2><p className="text-xs text-slate-500">{importRows.length} linhas · somente a tabela Contratações Futuras</p></div>
              <button type="button" onClick={() => setImportRows(null)} aria-label="Fechar prévia" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="my-4 overflow-auto rounded-lg border border-slate-100">
              <table className="min-w-[900px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="p-2">Linha</th><th className="p-2">Nome</th><th className="p-2">Zona</th><th className="p-2">Matrícula</th><th className="p-2">Grupo de origem</th><th className="p-2">Validação</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{importRows.map((row) => <tr key={row.line}><td className="p-2">{row.line}</td><td className="p-2">{row.hire.instrutorNovo || "—"}</td><td className="p-2">{row.hire.zona || "—"}</td><td className="p-2">{row.hire.matricula || "—"}</td><td className="p-2">{row.hire.grupoOrigem || "—"}</td><td className={`max-w-80 p-2 ${row.errors.length ? "text-rose-700" : row.warnings.length ? "text-amber-800" : "text-emerald-700"}`}>{row.errors.length ? <span>{row.errors.join(" ")} <button type="button" onClick={() => setImportCorrection({ line: row.line, hire: { ...row.hire } })} className="ml-1 font-bold underline">Corrigir</button></span> : row.warnings.length ? row.warnings.join(" ") : "Pronta para importar"}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              A planilha não foi fornecida junto com a solicitação. Os campos são interpretados na ordem especificada no pedido; planilhas com cabeçalho são mapeadas pelo nome. Sem coluna "Grupo Original", o nome do arquivo será guardado como origem. Valores de data incompletos não são completados.
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setImportRows(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancelar</button>
              <button type="button" disabled={importBusy || !importRows.some((row) => !row.errors.length)} onClick={() => void importValidRows()} className="rounded-lg bg-yinmn px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{importBusy ? "Importando..." : `Importar ${importRows.filter((row) => !row.errors.length).length} linhas válidas`}</button>
            </div>
          </section>
        </div>
      )}

      {dateEditor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-3">
          <section role="dialog" aria-modal="true" aria-labelledby="date-editor-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h2 id="date-editor-title" className="font-bold text-oxford">Alterar Data de Início</h2>
            <p className="mt-1 text-xs text-slate-500">{dateEditor.instrutorNovo} · atual: {formatDate(dateEditor.dataPrevistaInicio)}</p>
            <label className="mt-4 block text-xs font-semibold text-slate-600">Nova data prevista
              <input className={inputClass} type="date" value={dateEditor.dataPrevistaInicio ?? ""} onChange={(event) => setDateEditor({ ...dateEditor, dataPrevistaInicio: event.target.value || null })} />
            </label>
            <label className="mt-3 block text-xs font-semibold text-slate-600">Motivo do reagendamento
              <textarea className={inputClass} rows={3} value={dateReason} onChange={(event) => setDateReason(event.target.value)} />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDateEditor(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">Cancelar</button>
              <button type="button" disabled={saving || !dateEditor.dataPrevistaInicio || !dateReason.trim()} onClick={() => void save({
                ...dateEditor,
                statusConfirmacao: dateEditor.dataPrevistaInicio !== selected?.dataPrevistaInicio
                  ? "data_reagendada"
                  : dateEditor.statusConfirmacao,
              }, dateReason)} className="rounded-lg bg-yinmn px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Salvar nova data</button>
            </div>
          </section>
        </div>
      )}

      {importCorrection && catalogs && importRows && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-3">
          <section role="dialog" aria-modal="true" aria-labelledby="import-correction-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <h2 id="import-correction-title" className="mb-4 font-bold text-oxford">Corrigir linha {importCorrection.line}</h2>
            <HireEditor
              hire={importCorrection.hire}
              catalogs={catalogs}
              onChange={(hire) => setImportCorrection({ ...importCorrection, hire })}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setImportCorrection(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">Cancelar</button>
              <button type="button" onClick={() => {
                const hire = importCorrection.hire;
                const originalErrors = importRows.find((row) => row.line === importCorrection.line)?.errors ?? [];
                const hadIncompleteDate = importRows.find((row) => row.line === importCorrection.line)?.warnings.length;
                let errors = originalErrors;
                errors = errors.filter((message) =>
                  !message.startsWith("Possível duplicidade") &&
                  !message.startsWith("A linha possui menos colunas") &&
                  !message.startsWith("Nome não informado.") &&
                  !message.startsWith("Data prevista incompleta"),
                );
                const correctedChecks = FUTURE_HIRE_COLUMNS
                  .filter((column) => column.kind === "check" && hire[column.key] !== null)
                  .map((column) => `${column.label}:`);
                errors = errors.filter((message) =>
                  !correctedChecks.some((prefix) => message.startsWith(prefix)),
                );
                if (!hire.instrutorNovo.trim()) errors.push("Nome não informado.");
                setImportRows(importRows.map((row) => row.line === importCorrection.line
                  ? { ...row, hire, errors, warnings: hadIncompleteDate && !hire.dataPrevistaInicio
                    ? ["Data incompleta: o valor original continua em observações."]
                    : [] }
                  : row));
                setImportCorrection(null);
              }} className="rounded-lg bg-yinmn px-3 py-2 text-sm font-semibold text-white">Atualizar prévia</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
