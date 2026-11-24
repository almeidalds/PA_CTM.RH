import type { IGetAllOptions } from "../generated/models/CommonModels";
import type { Imtcbra_rhtranslationcapabilitieses } from "../generated/models/Imtcbra_rhtranslationcapabilitiesesModel";
import type { Ctmbrasi_rhemployeelanguageses } from "../generated/models/Ctmbrasi_rhemployeelanguagesesModel";
import type { Ctmbrasi_rhlanguageses } from "../generated/models/Ctmbrasi_rhlanguagesesModel";
import { Imtcbra_rhtranslationcapabilitiesesService as TranslationCapabilities } from "../generated/services/Imtcbra_rhtranslationcapabilitiesesService";
import { Ctmbrasi_rhemployeelanguagesesService as EmployeeLanguages } from "../generated/services/Ctmbrasi_rhemployeelanguagesesService";
import { Ctmbrasi_rhlanguagesesService as Languages } from "../generated/services/Ctmbrasi_rhlanguagesesService";
import type {
  TranslationCapability,
  TranslationCapabilityInput,
  TranslationData,
  TranslationLanguage,
  TranslationLanguageLink,
} from "../types/translation";

const EMPLOYEE_ENTITY_SET = "ctmbrasi_employeerecordses";
const EMPLOYEE_LANGUAGE_ENTITY_SET = "ctmbrasi_rhemployeelanguageses";
export const TRANSLATION_DATA_CHANGED_EVENT = "rh:translation-data-changed";

function notifyTranslationDataChanged(data: TranslationData) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<TranslationData>(TRANSLATION_DATA_CHANGED_EVENT, { detail: data }),
  );
}

interface PageResult<T> {
  success: boolean;
  data?: T[];
  skipToken?: string;
  error?: { message?: string };
}

async function readAll<T>(
  tableLabel: string,
  reader: (options?: IGetAllOptions) => Promise<PageResult<T>>,
  select: string[],
): Promise<T[]> {
  const rows: T[] = [];
  const usedTokens = new Set<string>();
  let skipToken: string | undefined;

  do {
    const result = await reader({
      select,
      maxPageSize: 500,
      ...(skipToken ? { skipToken } : {}),
    });
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error(
        `Não foi possível consultar ${tableLabel}. ${
          result.error?.message || "Verifique sua conexão e permissões no Dataverse."
        }`,
      );
    }

    rows.push(...result.data);
    skipToken = result.skipToken || undefined;
    if (skipToken) {
      if (usedTokens.has(skipToken)) {
        throw new Error(`O Dataverse repetiu uma página de ${tableLabel}.`);
      }
      usedTokens.add(skipToken);
    }
  } while (skipToken);

  return rows;
}

async function readRawData(): Promise<{
  capabilityRows: Imtcbra_rhtranslationcapabilitieses[];
  employeeLanguageRows: Ctmbrasi_rhemployeelanguageses[];
  languageRows: Ctmbrasi_rhlanguageses[];
}> {
  const [capabilityRows, employeeLanguageRows, languageRows] = await Promise.all([
    readAll<Imtcbra_rhtranslationcapabilitieses>(
      "as habilitações de tradução",
      (options) => TranslationCapabilities.getAll(options),
      [
        "imtcbra_rhtranslationcapabilitiesid",
        "imtcbra_nomedahabilitacao",
        "imtcbra_habilitacaoativa",
        "imtcbra_traduzworkshops",
        "imtcbra_traduzdevocionais",
        "imtcbra_observacoes",
        "_imtcbra_funcionario_value",
        "_imtcbra_idioma_value",
        "statecode",
      ],
    ),
    readAll<Ctmbrasi_rhemployeelanguageses>(
      "os idiomas vinculados aos funcionários",
      (options) => EmployeeLanguages.getAll(options),
      [
        "ctmbrasi_rhemployeelanguagesid",
        "_ctmbrasi_employee_value",
        "_ctmbrasi_language_value",
        "statecode",
      ],
    ),
    readAll<Ctmbrasi_rhlanguageses>(
      "o catálogo de idiomas",
      (options) => Languages.getAll(options),
      [
        "ctmbrasi_rhlanguagesid",
        "ctmbrasi_languagename",
        "ctmbrasi_active",
        "statecode",
      ],
    ),
  ]);

  return { capabilityRows, employeeLanguageRows, languageRows };
}

function mapData(
  capabilityRows: Imtcbra_rhtranslationcapabilitieses[],
  employeeLanguageRows: Ctmbrasi_rhemployeelanguageses[],
  languageRows: Ctmbrasi_rhlanguageses[],
): TranslationData {
  const languages: TranslationLanguage[] = languageRows.map((row) => ({
    id: row.ctmbrasi_rhlanguagesid,
    name: row.ctmbrasi_languagename || "Idioma sem nome",
    active: row.statecode === 0 && row.ctmbrasi_active !== false,
  }));
  const languageById = new Map(languages.map((language) => [language.id.toLowerCase(), language]));

  const employeeLanguages: TranslationLanguageLink[] = employeeLanguageRows
    .filter((row) => row._ctmbrasi_employee_value && row._ctmbrasi_language_value)
    .map((row) => {
      const language = languageById.get((row._ctmbrasi_language_value || "").toLowerCase());
      return {
        id: row.ctmbrasi_rhemployeelanguagesid,
        employeeId: row._ctmbrasi_employee_value || "",
        languageId: row._ctmbrasi_language_value || "",
        languageName: language?.name || "Idioma não encontrado",
        active: row.statecode === 0 && language?.active !== false,
      };
    });
  const employeeLanguageById = new Map(
    employeeLanguages.map((link) => [link.id.toLowerCase(), link]),
  );

  const capabilities: TranslationCapability[] = capabilityRows.map((row) => {
    const link = employeeLanguageById.get((row._imtcbra_idioma_value || "").toLowerCase());
    return {
      id: row.imtcbra_rhtranslationcapabilitiesid,
      employeeId: row._imtcbra_funcionario_value || "",
      employeeLanguageId: row._imtcbra_idioma_value || "",
      languageId: link?.languageId || "",
      languageName: link?.languageName || "Idioma não encontrado",
      name: row.imtcbra_nomedahabilitacao || "",
      workshops: row.imtcbra_traduzworkshops === true,
      devotionals: row.imtcbra_traduzdevocionais === true,
      // A situação funcional é controlada pela coluna específica da tabela,
      // não pelo statecode genérico do registro do Dataverse.
      active: row.imtcbra_habilitacaoativa === true,
      notes: row.imtcbra_observacoes || "",
    };
  });

  return { capabilities, employeeLanguages, languages };
}

export async function loadTranslationData(): Promise<TranslationData> {
  const raw = await readRawData();
  return mapData(raw.capabilityRows, raw.employeeLanguageRows, raw.languageRows);
}

export async function loadEmployeeTranslationCapabilities(
  employeeId: string,
): Promise<TranslationCapability[]> {
  const data = await loadTranslationData();
  return data.capabilities.filter(
    (capability) => capability.employeeId.toLowerCase() === employeeId.toLowerCase(),
  );
}

function validateInput(input: TranslationCapabilityInput, link?: TranslationLanguageLink) {
  if (!input.employeeId) throw new Error("Selecione um funcionário.");
  if (!input.employeeLanguageId || !link) throw new Error("Selecione um idioma válido.");
  if (link.employeeId.toLowerCase() !== input.employeeId.toLowerCase()) {
    throw new Error("O idioma selecionado não pertence ao funcionário informado.");
  }
  if (input.active && !input.workshops && !input.devotionals) {
    throw new Error(
      "Uma habilitação ativa deve permitir workshops, devocionais ou ambos.",
    );
  }
}

export async function saveTranslationCapability(
  input: TranslationCapabilityInput,
): Promise<TranslationData> {
  const current = await loadTranslationData();
  const link = current.employeeLanguages.find(
    (item) => item.id.toLowerCase() === input.employeeLanguageId.toLowerCase(),
  );
  validateInput(input, link);

  const duplicate = current.capabilities.find(
    (capability) =>
      capability.employeeId.toLowerCase() === input.employeeId.toLowerCase() &&
      capability.languageId.toLowerCase() === (link?.languageId || "").toLowerCase() &&
      capability.id !== input.id,
  );
  if (duplicate) {
    throw new Error(
      "Já existe uma habilitação para este funcionário e idioma. Edite o registro existente.",
    );
  }

  const fields = {
    "imtcbra_Funcionario@odata.bind": `/${EMPLOYEE_ENTITY_SET}(${input.employeeId})`,
    "imtcbra_Idioma@odata.bind": `/${EMPLOYEE_LANGUAGE_ENTITY_SET}(${input.employeeLanguageId})`,
    imtcbra_nomedahabilitacao: `${input.employeeName.trim()} — ${link?.languageName || "Idioma"}`,
    imtcbra_habilitacaoativa: input.active,
    imtcbra_traduzworkshops: input.workshops,
    imtcbra_traduzdevocionais: input.devotionals,
    imtcbra_observacoes: input.notes.trim() || undefined,
  };

  const result = input.id
    ? await TranslationCapabilities.update(input.id, fields)
    : await TranslationCapabilities.create({ ...fields, statecode: 0 });

  if (!result.success) {
    throw new Error(
      result.error?.message || "O Dataverse não confirmou a gravação da habilitação.",
    );
  }

  const refreshed = await loadTranslationData();
  const persisted = refreshed.capabilities.find(
    (capability) =>
      capability.employeeId.toLowerCase() === input.employeeId.toLowerCase() &&
      capability.languageId.toLowerCase() === (link?.languageId || "").toLowerCase(),
  );
  if (!persisted) {
    throw new Error("A gravação foi enviada, mas não pôde ser confirmada no Dataverse.");
  }
  notifyTranslationDataChanged(refreshed);
  return refreshed;
}

export async function setTranslationCapabilityActive(
  capability: TranslationCapability,
  active: boolean,
): Promise<TranslationData> {
  if (active && !capability.workshops && !capability.devotionals) {
    throw new Error("Defina pelo menos uma modalidade antes de reativar esta habilitação.");
  }
  const result = await TranslationCapabilities.update(capability.id, {
    imtcbra_habilitacaoativa: active,
  });
  if (!result.success) {
    throw new Error(
      result.error?.message || "O Dataverse não confirmou a alteração da habilitação.",
    );
  }
  const refreshed = await loadTranslationData();
  notifyTranslationDataChanged(refreshed);
  return refreshed;
}
