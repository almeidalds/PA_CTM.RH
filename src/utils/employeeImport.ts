import readXlsxFile from "read-excel-file/browser";
import type { AppSettings, RhEmployee } from "../types/rh";
import type {
  EmployeeImportFailure,
  EmployeeImportResult,
  EmployeeImportRow,
} from "../services/rhDataSource";

export interface EmployeeImportPreview {
  rows: EmployeeImportRow[];
  failures: EmployeeImportFailure[];
  totalRows: number;
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]/g, "");

const MONTHS: Record<string, number> = {
  jan: 1,
  janeiro: 1,
  feb: 2,
  fev: 2,
  fevereiro: 2,
  mar: 3,
  marco: 3,
  apr: 4,
  abr: 4,
  abril: 4,
  may: 5,
  mai: 5,
  maio: 5,
  jun: 6,
  junho: 6,
  jul: 7,
  julho: 7,
  aug: 8,
  ago: 8,
  agosto: 8,
  sep: 9,
  set: 9,
  setembro: 9,
  oct: 10,
  out: 10,
  outubro: 10,
  nov: 11,
  novembro: 11,
  dec: 12,
  dez: 12,
  dezembro: 12,
};

const LANGUAGE_ALIASES: Record<string, string[]> = {
  ingles: ["english"],
  espanhol: ["spanish"],
  japones: ["japanese"],
  frances: ["french"],
  italiano: ["italian"],
  crioulo: ["creole", "criolo"],
  portugues: ["portuguese"],
};

const getText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
};

const dateFromParts = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }
  return date.toISOString().slice(0, 10);
};

const parseCsv = (text: string): unknown[][] => {
  const input = text.replace(/^\uFEFF/, "");
  const firstLine = input.split(/\r?\n/, 1)[0] || "";
  const delimiters = [";", ",", "\t"];
  let delimiter = ";";
  let maxCount = -1;

  for (const candidate of delimiters) {
    let count = 0;
    let quoted = false;
    for (let index = 0; index < firstLine.length; index += 1) {
      if (firstLine[index] === '"') {
        if (quoted && firstLine[index + 1] === '"') {
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (!quoted && firstLine[index] === candidate) {
        count += 1;
      }
    }
    if (count > maxCount) {
      maxCount = count;
      delimiter = candidate;
    }
  }

  const rows: unknown[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
};

const parseDate = (
  value: unknown,
  format: "day-first" | "month-first",
): string => {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return dateFromParts(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
    );
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
    return Number.isFinite(date.getTime())
      ? date.toISOString().slice(0, 10)
      : "";
  }

  const text = getText(value);
  if (!text) return "";

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return dateFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const numeric = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    let year = Number(numeric[3]);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    const month = format === "day-first" ? second : first;
    const day = format === "day-first" ? first : second;
    return dateFromParts(year, month, day);
  }

  const monthYear = text.match(/^([a-zA-ZÀ-ÿ.]+)[\s/-]+(\d{4})$/);
  if (monthYear) {
    const monthName = normalize(monthYear[1]).slice(0, 3);
    const month =
      MONTHS[normalize(monthYear[1])] ?? MONTHS[monthName];
    if (month) {
      const year = Number(monthYear[2]);
      return dateFromParts(
        year,
        month,
        new Date(Date.UTC(year, month, 0)).getUTCDate(),
      );
    }
  }

  return "";
};

const findCatalogValue = (
  source: string,
  catalog: string[],
): string | undefined => {
  const normalizedSource = normalize(source);
  const aliases = LANGUAGE_ALIASES[normalizedSource] || [];
  return catalog.find((item) => {
    const normalizedItem = normalize(item);
    return (
      normalizedItem === normalizedSource ||
      aliases.includes(normalizedItem)
    );
  });
};

const defaultEmployee = (): RhEmployee => ({
  recordId: "",
  idFuncionario: "",
  nome: "",
  cargo: "",
  zona: "",
  turno: "",
  dataAdmissao: "",
  dataTerminoReal: "",
  statusFuncionario: "Ativo",
  statusDataverse: 583150000,
  statusRegistro: 0,
  idiomas: [],
  emailCorporativo: "",
  linkZoom: "",
  feriasMarcadas: false,
  feriasConcluidas: false,
  feriasVendidas: false,
  diasVendidosFerias: 0,
  diasTotaisFerias: 0,
  periodosFerias: [],
});

export async function previewEmployeeImport(
  file: File,
  settings: AppSettings,
  existingEmployees: RhEmployee[],
): Promise<EmployeeImportPreview> {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase();
  if (extension !== "csv" && extension !== "xlsx") {
    throw new Error("Selecione um arquivo no formato .csv ou .xlsx.");
  }

  let data: unknown[][];
  if (extension === "csv") {
    data = parseCsv(await file.text());
  } else {
    const sheets = await readXlsxFile(file);
    const firstSheet = sheets[0];
    if (!firstSheet) {
      throw new Error("O arquivo não contém uma planilha para importar.");
    }
    data = firstSheet.data.map((row) => row.map((cell) => cell));
  }
  if (data.length < 2) {
    throw new Error("A planilha não contém linhas de funcionários.");
  }

  const headers = data[0].map((value) => normalize(getText(value)));
  const column = (...names: string[]) =>
    headers.findIndex((header) => names.some((name) => header === normalize(name)));
  const get = (row: unknown[], ...names: string[]) => {
    const index = column(...names);
    return index < 0 ? "" : row[index];
  };
  const employeeIdColumn = column("Matricula", "Employee ID");
  const nameColumn = column("Nome", "Full Name", "FullName");
  const hireDateColumn = column("DataAdmissao", "Hire Date", "HireDate");

  if (employeeIdColumn < 0 || nameColumn < 0 || hireDateColumn < 0) {
    throw new Error(
      "Não encontrei as colunas obrigatórias Matricula, Nome e DataAdmissao " +
      "(Employee ID, Full Name e Hire Date).",
    );
  }

  const existingIds = new Set(
    existingEmployees
      .map((employee) => normalize(employee.idFuncionario))
      .filter(Boolean),
  );
  const seenIds = new Set<string>();
  const rows: EmployeeImportRow[] = [];
  const failures: EmployeeImportFailure[] = [];

  for (let index = 1; index < data.length; index += 1) {
    const source = data[index];
    const rowNumber = index + 1;
    const idFuncionario = getText(source[employeeIdColumn]);
    const nome = getText(source[nameColumn]);
    const dataAdmissao = parseDate(
      source[hireDateColumn],
      "day-first",
    );
    const employee = defaultEmployee();
    const issues: string[] = [];

    if (!idFuncionario) issues.push("Matrícula / Employee ID ausente.");
    if (!nome) issues.push("Nome ausente.");
    if (!dataAdmissao) issues.push("DataAdmissao inválida ou ausente.");

    const normalizedId = normalize(idFuncionario);
    if (normalizedId && existingIds.has(normalizedId)) {
      issues.push("Matrícula já existe no sistema.");
    } else if (normalizedId && seenIds.has(normalizedId)) {
      issues.push("Matrícula repetida neste arquivo.");
    }
    if (normalizedId) seenIds.add(normalizedId);

    employee.idFuncionario = idFuncionario;
    employee.nome = nome;
    employee.globalId = getText(get(source, "ID Global", "Global ID"));
    employee.dataAdmissao = dataAdmissao;
    employee.emailCorporativo = getText(
      get(source, "E-mail Corporativo", "Corporate Email"),
    );
    employee.emailPessoal = getText(
      get(source, "E-mail Pessoal", "Personal Email"),
    );
    employee.linkZoom = getText(get(source, "Link ZOOM", "Zoom Link"));

    const contractEnd = get(source, "Término do Contrato", "Contract End Date");
    if (getText(contractEnd)) {
      employee.dataTerminoReal = parseDate(contractEnd, "month-first");
      if (!employee.dataTerminoReal) {
        issues.push("Término do Contrato inválido.");
      }
    }

    const gender = normalize(getText(get(source, "Sexo", "Gender")));
    if (gender) {
      if (["masculino", "male", "m"].includes(gender)) {
        employee.genero = 583150000;
      } else if (["feminino", "female", "f"].includes(gender)) {
        employee.genero = 583150001;
      } else {
        issues.push(`Sexo/Gender não reconhecido: ${getText(get(source, "Sexo", "Gender"))}.`);
      }
    }

    const contractStatus = normalize(
      getText(get(source, "Contrato", "Employee Status")),
    );
    if (["encerrado", "terminated", "inactive", "desligado"].includes(contractStatus)) {
      employee.statusDataverse = 583150004;
      employee.statusRegistro = 1;
      employee.statusFuncionario = "Encerrado";
    } else if (["efetivado", "active", "ativo"].includes(contractStatus)) {
      employee.statusDataverse = 583150000;
      employee.statusRegistro = 0;
      employee.statusFuncionario = "Ativo";
    } else {
      issues.push("Contrato ausente ou não reconhecido; status não pode ser definido.");
    }

    const sourceFields: Array<{
      label: string;
      aliases: string[];
      catalog: string[];
      assign: (value: string) => void;
    }> = [
      {
        label: "Cargo",
        aliases: ["Cargo", "Position"],
        catalog: settings.cargos,
        assign: (value) => { employee.cargo = value; },
      },
      {
        label: "Zona",
        aliases: ["Zona", "Zone"],
        catalog: settings.zonas,
        assign: (value) => { employee.zona = value; },
      },
      {
        label: "Turno",
        aliases: ["Turno - DEPUTY", "Turno", "Shifts - Lookup"],
        catalog: settings.turnos,
        assign: (value) => { employee.turno = value; },
      },
    ];

    for (const field of sourceFields) {
      const rawValue = getText(get(source, ...field.aliases));
      if (!rawValue || ["-", "n/a", "na"].includes(normalize(rawValue))) continue;
      const match = findCatalogValue(rawValue, field.catalog);
      if (match) {
        field.assign(match);
      } else {
        issues.push(`${field.label} "${rawValue}" não corresponde a um catálogo ativo.`);
      }
    }

    const languageColumns = [
      "Inglês",
      "Espanhol",
      "Japonês",
      "Francês",
      "Italiano",
      "Crioulo",
    ];
    for (const languageColumn of languageColumns) {
      const sourceLanguage = getText(get(source, languageColumn));
      if (!sourceLanguage || ["-", "n/a", "na"].includes(normalize(sourceLanguage))) {
        continue;
      }
      const catalogValue = findCatalogValue(languageColumn, settings.idiomas);
      if (!catalogValue) {
        issues.push(`Idioma "${languageColumn}" não corresponde a um catálogo ativo.`);
      } else if (!employee.idiomas.includes(catalogValue)) {
        employee.idiomas.push(catalogValue);
      }
    }

    if (issues.length) {
      failures.push({
        rowNumber,
        employeeName: nome,
        employeeId: idFuncionario,
        message: issues.join(" "),
      });
    } else {
      rows.push({ rowNumber, employee });
    }
  }

  return { rows, failures, totalRows: data.length - 1 };
}

export type { EmployeeImportFailure, EmployeeImportResult, EmployeeImportRow };
