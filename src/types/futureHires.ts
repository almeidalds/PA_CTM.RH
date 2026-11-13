
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CTM RH - Contratações Futuras
 *
 * Modelo independente dos funcionários ativos.
 * Espelha as colunas B:V da planilha original.
 */

// ==========================================
// STATUS E FASE
// ==========================================

export type FutureHireStatus =
  | "aguardando_confirmacao"
  | "inicio_confirmado"
  | "data_reagendada"
  | "cancelado";

export type FutureHirePhase =
  | "pendente"
  | "efetivado";

// ==========================================
// CAMPOS ORIGINAIS DA PLANILHA
// ==========================================

export interface FutureHireSpreadsheetFields {
  instrutorNovo: string;
  idiomas: string;
  zona: string;
  cpf: string;
  loginSud: string;
  nomePlaqueta: string;
  numero: string;
  emailChurch: string;
  emailTrain: string;
  linkZoom: string;
  email: string;

  mandouCurriculo: boolean | null;
  recebeuLigacao: boolean | null;
  emailRH: boolean | null;
  curriculoAvaliacao: boolean | null;
  grupoWhatsApp: boolean | null;
  mandouInformacoes: boolean | null;
  plaquetasEncaminhadas: boolean | null;
  acessosSolicitados: boolean | null;
  notebooksProntos: boolean | null;
  kitsProntos: boolean | null;
}

// ==========================================
// MODELO COMPLETO
// ==========================================

export interface FutureHire
  extends FutureHireSpreadsheetFields {

  id: string;

  grupoOrigem: string;
  linhaOrigem: number | null;

  // YYYY-MM-DD ou null
  dataPrevistaInicio: string | null;
  dataRealInicio: string | null;

  statusConfirmacao: FutureHireStatus;
  fase: FutureHirePhase;

  // Dados necessários à efetivação
  cargo: string | null;
  matricula: string;

  observacoes: string;

  // Referência ao funcionário oficial
  employeeRecordId: string | null;

  createdOn?: string;
  modifiedOn?: string;
  versionNumber?: number;
}

// ==========================================
// HISTÓRICO DE ALTERAÇÃO DE DATAS
// ==========================================

export interface FutureHireDateHistory {
  id: string;
  futureHireId: string;

  dataAnterior: string | null;
  dataNova: string | null;

  alteradoEm: string;
  alteradoPor: string;
  motivo: string;
}

// ==========================================
// NOMES DOS STATUS
// ==========================================

export const FUTURE_HIRE_STATUS_LABELS:
  Record<FutureHireStatus, string> = {

  aguardando_confirmacao:
    "Aguardando Confirmação",

  inicio_confirmado:
    "Início Confirmado",

  data_reagendada:
    "Data Adiada / Reagendada",

  cancelado:
    "Desistência / Cancelado",
};

// ==========================================
// ORDEM EXATA DAS COLUNAS DA PLANILHA
// ==========================================

export const FUTURE_HIRE_COLUMNS: ReadonlyArray<{
  key: keyof FutureHireSpreadsheetFields;
  label: string;
  kind:
    | "text"
    | "check"
    | "sensitive"
    | "phone"
    | "email"
    | "url";
}> = [
  {
    key: "instrutorNovo",
    label: "Instrutor Novo",
    kind: "text",
  },
  {
    key: "idiomas",
    label: "Idiomas",
    kind: "text",
  },
  {
    key: "zona",
    label: "Zona",
    kind: "text",
  },
  {
    key: "cpf",
    label: "CPF",
    kind: "sensitive",
  },
  {
    key: "loginSud",
    label: "Login SUD",
    kind: "text",
  },
  {
    key: "nomePlaqueta",
    label: "Nome da Plaqueta",
    kind: "text",
  },
  {
    key: "numero",
    label: "Número",
    kind: "phone",
  },
  {
    key: "emailChurch",
    label: "E-mail Church",
    kind: "email",
  },
  {
    key: "emailTrain",
    label: "E-mail TRAIN",
    kind: "email",
  },
  {
    key: "linkZoom",
    label: "Link do Zoom",
    kind: "url",
  },
  {
    key: "email",
    label: "Email",
    kind: "email",
  },
  {
    key: "mandouCurriculo",
    label: "Mandou o currículo?",
    kind: "check",
  },
  {
    key: "recebeuLigacao",
    label: "Receberam a ligação?",
    kind: "check",
  },
  {
    key: "emailRH",
    label: "Email RH",
    kind: "check",
  },
  {
    key: "curriculoAvaliacao",
    label: "Currículo e Avaliação",
    kind: "check",
  },
  {
    key: "grupoWhatsApp",
    label: "Está no grupo do Whatsapp",
    kind: "check",
  },
  {
    key: "mandouInformacoes",
    label:
      "Mandou informações (nome completo, email, login, nome plaqueta)",
    kind: "check",
  },
  {
    key: "plaquetasEncaminhadas",
    label:
      "Nomes de plaquetas encaminhados p/ Gabi",
    kind: "check",
  },
  {
    key: "acessosSolicitados",
    label: "Acessos solicitados",
    kind: "check",
  },
  {
    key: "notebooksProntos",
    label: "Notebooks prontos",
    kind: "check",
  },
  {
    key: "kitsProntos",
    label:
      "Kits prontos (cadeado, 3 canetões, notebook e carregador)",
    kind: "check",
  },
];

// ==========================================
// VALIDAR DATA ISO
// ==========================================

export function isIsoDate(
  value: string | null | undefined
): value is string {

  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  const parsed = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

// ==========================================
// FORMATAR DATA PARA PT-BR
// ==========================================

export function formatarDataPtBr(
  value: string | null | undefined
): string {

  if (!isIsoDate(value)) {
    return "Data a definir";
  }

  const [year, month, day] =
    value.split("-");

  return `${day}/${month}/${year}`;
}

// ==========================================
// VALIDAR EFETIVAÇÃO
// ==========================================

export function validarEfetivacao(
  hire: FutureHire,
  dataRealInicio: string
): string[] {

  const problemas: string[] = [];

  if (hire.fase !== "pendente") {
    problemas.push(
      "Contratação já efetivada."
    );
  }

  if (
    hire.statusConfirmacao !==
    "inicio_confirmado"
  ) {
    problemas.push(
      "Confirme o início antes de efetivar."
    );
  }

  if (!hire.instrutorNovo.trim()) {
    problemas.push(
      "Nome completo obrigatório."
    );
  }

  if (!hire.matricula.trim()) {
    problemas.push(
      "Matrícula obrigatória."
    );
  }

  if (!(hire.cargo ?? "").trim()) {
    problemas.push(
      "Cargo obrigatório."
    );
  }

  if (!hire.zona.trim()) {
    problemas.push(
      "Zona obrigatória."
    );
  }

  if (!isIsoDate(dataRealInicio)) {
    problemas.push(
      "Data real de início inválida."
    );
  }

  return problemas;
}

// ==========================================
// ISOLAMENTO DE REGISTROS PENDENTES
// ==========================================

export function listarContratacoesPendentes(
  registros: FutureHire[]
): FutureHire[] {

  return registros.filter(
    (item) => item.fase === "pendente"
  );
}

// ==========================================
// AGRUPAMENTO CRONOLÓGICO POR DATA
// ==========================================

export function agruparContratacoesPorData(
  registros: FutureHire[]
): Array<{
  data: string | null;
  registros: FutureHire[];
}> {

  const grupos =
    new Map<string, FutureHire[]>();

  for (
    const hire of
    listarContratacoesPendentes(registros)
  ) {

    const chave =
      isIsoDate(hire.dataPrevistaInicio)
        ? hire.dataPrevistaInicio
        : "sem-data";

    grupos.set(
      chave,
      [...(grupos.get(chave) ?? []), hire]
    );
  }

  return [...grupos.entries()]
    .sort(([a], [b]) => {
      if (a === "sem-data") return 1;
      if (b === "sem-data") return -1;

    return a.localeCompare(b);
    })
    .map(([data, itens]) => ({
    data:
        data === "sem-data"
        ? null
        : data,

    registros: itens.sort(
        (a, b) =>
        a.instrutorNovo.localeCompare(
            b.instrutorNovo,
            "pt-BR"
        )
    ),
    }));
}