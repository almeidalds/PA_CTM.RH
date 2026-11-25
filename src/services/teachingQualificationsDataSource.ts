import type { IGetAllOptions } from "../generated/models/CommonModels";
import type { Imtcbra_rhteachingmodalitieses } from "../generated/models/Imtcbra_rhteachingmodalitiesesModel";
import type { Imtcbra_rhteachingqualificationses } from "../generated/models/Imtcbra_rhteachingqualificationsesModel";
import { Imtcbra_rhteachingmodalitiesesService as TeachingModalities } from "../generated/services/Imtcbra_rhteachingmodalitiesesService";
import { Imtcbra_rhteachingqualificationsesService as TeachingQualifications } from "../generated/services/Imtcbra_rhteachingqualificationsesService";
import type {
  TeachingData,
  TeachingModality,
  TeachingModalityInput,
  TeachingModalityKind,
  TeachingQualification,
  TeachingQualificationInput,
} from "../types/teaching";

const EMPLOYEE_ENTITY_SET = "ctmbrasi_employeerecordses";
const MODALITY_ENTITY_SET = "imtcbra_rhteachingmodalitieses";

const MODALITY_LABELS: Record<number, TeachingModalityKind> = {
  956020000: "Idioma",
  956020001: "Doutrina",
  956020002: "Sem subdivisão",
};

export const TEACHING_DATA_CHANGED_EVENT = "rh:teaching-data-changed";

function notifyTeachingDataChanged(data: TeachingData) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<TeachingData>(TEACHING_DATA_CHANGED_EVENT, { detail: data }),
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
          result.error?.message || "Verifique a conexão e as permissões no Dataverse."
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

function mapModality(row: Imtcbra_rhteachingmodalitieses): TeachingModality {
  return {
    id: row.imtcbra_rhteachingmodalitiesid,
    trainingCode: row.imtcbra_codigodotreinamento?.trim() || "Sem código",
    name: row.imtcbra_nomedamodalidade?.trim() || "Modalidade sem nome",
    kinds: (row.imtcbra_modalidade || [])
      .map((value) => MODALITY_LABELS[Number(value)])
      .filter((value): value is TeachingModalityKind => Boolean(value)),
    active: row.statecode === 0 && row.imtcbra_ativo !== false,
    notes: row.imtcbra_observacoes || "",
  };
}

function mapQualification(
  row: Imtcbra_rhteachingqualificationses,
): TeachingQualification {
  return {
    id: row.imtcbra_rhteachingqualificationsid,
    employeeId: row._imtcbra_funcionario_value || "",
    modalityId: row._imtcbra_modalidadedeensino_value || "",
    name: row.imtcbra_nomedahabilitacao || "",
    active: row.imtcbra_habilitacaoativa === true,
    notes: row.imtcbra_observacoes || "",
  };
}

export async function loadTeachingData(): Promise<TeachingData> {
  const [modalityRows, qualificationRows] = await Promise.all([
    readAll<Imtcbra_rhteachingmodalitieses>(
      "as modalidades de ensino",
      (options) => TeachingModalities.getAll(options),
      [
        "imtcbra_rhteachingmodalitiesid",
        "imtcbra_codigodotreinamento",
        "imtcbra_nomedamodalidade",
        "imtcbra_modalidade",
        "imtcbra_ativo",
        "imtcbra_observacoes",
        "statecode",
      ],
    ),
    readAll<Imtcbra_rhteachingqualificationses>(
      "as habilitações de ensino",
      (options) => TeachingQualifications.getAll(options),
      [
        "imtcbra_rhteachingqualificationsid",
        "imtcbra_nomedahabilitacao",
        "imtcbra_habilitacaoativa",
        "imtcbra_observacoes",
        "_imtcbra_funcionario_value",
        "_imtcbra_modalidadedeensino_value",
        "statecode",
      ],
    ),
  ]);

  return {
    modalities: modalityRows.map(mapModality),
    qualifications: qualificationRows
      .filter((row) => row._imtcbra_funcionario_value && row._imtcbra_modalidadedeensino_value)
      .map(mapQualification),
  };
}

export async function loadEmployeeTeachingQualifications(
  employeeId: string,
): Promise<TeachingData> {
  const data = await loadTeachingData();
  return {
    modalities: data.modalities,
    qualifications: data.qualifications.filter(
      (qualification) =>
        qualification.employeeId.toLowerCase() === employeeId.toLowerCase(),
    ),
  };
}

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function modalityKindKey(kinds: TeachingModalityKind[]) {
  return [...new Set(kinds)].sort().join("|");
}

function validateModalityInput(input: TeachingModalityInput) {
  if (!input.trainingCode.trim()) throw new Error("Informe o código do treinamento.");
  if (!input.name.trim()) throw new Error("Informe o nome da modalidade.");
  if (!input.kinds.length) throw new Error("Selecione pelo menos uma modalidade.");
  if (input.kinds.includes("Sem subdivisão") && input.kinds.length > 1) {
    throw new Error("Sem subdivisão não pode ser combinada com Idioma ou Doutrina.");
  }
  if (input.trainingCode.trim().length > 100) {
    throw new Error("O código do treinamento deve possuir no máximo 100 caracteres.");
  }
  if (input.name.trim().length > 850) {
    throw new Error("O nome da modalidade deve possuir no máximo 850 caracteres.");
  }
  if (input.notes.trim().length > 2000) {
    throw new Error("As observações devem possuir no máximo 2.000 caracteres.");
  }
}

export async function saveTeachingModality(
  input: TeachingModalityInput,
): Promise<TeachingData> {
  validateModalityInput(input);
  const current = await loadTeachingData();
  const kindKey = modalityKindKey(input.kinds);
  const duplicate = current.modalities.find(
    (modality) =>
      normalizeText(modality.trainingCode) === normalizeText(input.trainingCode) &&
      modalityKindKey(modality.kinds) === kindKey &&
      modality.id.toLowerCase() !== (input.id || "").toLowerCase(),
  );
  if (duplicate) {
    throw new Error(
      "Já existe uma modalidade com este treinamento e subdivisão. Edite o registro existente.",
    );
  }

  const valuesByLabel: Record<TeachingModalityKind, 956020000 | 956020001 | 956020002> = {
    Idioma: 956020000,
    Doutrina: 956020001,
    "Sem subdivisão": 956020002,
  };
  const fields = {
    imtcbra_codigodotreinamento: input.trainingCode.trim().toUpperCase(),
    imtcbra_nomedamodalidade: input.name.trim(),
    imtcbra_modalidade: [...new Set(input.kinds)].map((kind) => valuesByLabel[kind]),
    imtcbra_ativo: input.active,
    imtcbra_observacoes: input.notes.trim() || undefined,
  };

  const result = input.id
    ? await TeachingModalities.update(input.id, fields)
    : await TeachingModalities.create({ ...fields, statecode: 0 });
  if (!result.success) {
    throw new Error(
      result.error?.message || "O Dataverse não confirmou a gravação da modalidade.",
    );
  }

  const refreshed = await loadTeachingData();
  const persisted = input.id
    ? refreshed.modalities.find(
        (modality) => modality.id.toLowerCase() === input.id?.toLowerCase(),
      )
    : refreshed.modalities.find(
        (modality) =>
          normalizeText(modality.trainingCode) === normalizeText(input.trainingCode) &&
          modalityKindKey(modality.kinds) === kindKey,
      );
  if (!persisted) {
    throw new Error("A gravação foi enviada, mas não pôde ser confirmada no Dataverse.");
  }

  notifyTeachingDataChanged(refreshed);
  return refreshed;
}

export async function setTeachingModalityActive(
  modality: TeachingModality,
  active: boolean,
): Promise<TeachingData> {
  const result = await TeachingModalities.update(modality.id, {
    imtcbra_ativo: active,
  });
  if (!result.success) {
    throw new Error(
      result.error?.message || "O Dataverse não confirmou a alteração da modalidade.",
    );
  }

  const refreshed = await loadTeachingData();
  const persisted = refreshed.modalities.find(
    (item) => item.id.toLowerCase() === modality.id.toLowerCase(),
  );
  if (!persisted || persisted.active !== active) {
    throw new Error("A alteração foi enviada, mas não pôde ser confirmada no Dataverse.");
  }

  notifyTeachingDataChanged(refreshed);
  return refreshed;
}

function validateInput(input: TeachingQualificationInput, modality?: TeachingModality) {
  if (!input.employeeId) throw new Error("Selecione um funcionário.");
  if (!input.modalityId || !modality) throw new Error("Selecione uma modalidade válida.");
  if (input.notes.trim().length > 100) {
    throw new Error("As observações devem possuir no máximo 100 caracteres.");
  }
}

export async function saveTeachingQualification(
  input: TeachingQualificationInput,
): Promise<TeachingData> {
  const current = await loadTeachingData();
  const modality = current.modalities.find(
    (item) => item.id.toLowerCase() === input.modalityId.toLowerCase(),
  );
  validateInput(input, modality);

  const duplicate = current.qualifications.find(
    (qualification) =>
      qualification.employeeId.toLowerCase() === input.employeeId.toLowerCase() &&
      qualification.modalityId.toLowerCase() === input.modalityId.toLowerCase() &&
      qualification.id.toLowerCase() !== (input.id || "").toLowerCase(),
  );
  if (duplicate) {
    throw new Error(
      "Já existe uma habilitação para este funcionário e modalidade. Edite o registro existente.",
    );
  }

  const fields = {
    "imtcbra_Funcionario@odata.bind": `/${EMPLOYEE_ENTITY_SET}(${input.employeeId})`,
    "imtcbra_ModalidadedeEnsino@odata.bind": `/${MODALITY_ENTITY_SET}(${input.modalityId})`,
    imtcbra_nomedahabilitacao: `${input.employeeName.trim()} — ${modality?.name || "Modalidade"}`,
    imtcbra_habilitacaoativa: input.active,
    imtcbra_observacoes: input.notes.trim() || undefined,
  };

  const result = input.id
    ? await TeachingQualifications.update(input.id, fields)
    : await TeachingQualifications.create({ ...fields, statecode: 0 });

  if (!result.success) {
    throw new Error(
      result.error?.message || "O Dataverse não confirmou a gravação da habilitação.",
    );
  }

  const refreshed = await loadTeachingData();
  const persisted = input.id
    ? refreshed.qualifications.find(
        (qualification) =>
          qualification.id.toLowerCase() === input.id?.toLowerCase() &&
          qualification.employeeId.toLowerCase() === input.employeeId.toLowerCase() &&
          qualification.modalityId.toLowerCase() === input.modalityId.toLowerCase(),
      )
    : refreshed.qualifications.find(
        (qualification) =>
          qualification.employeeId.toLowerCase() === input.employeeId.toLowerCase() &&
          qualification.modalityId.toLowerCase() === input.modalityId.toLowerCase(),
      );
  if (!persisted) {
    throw new Error("A gravação foi enviada, mas não pôde ser confirmada no Dataverse.");
  }

  notifyTeachingDataChanged(refreshed);
  return refreshed;
}

export async function setTeachingQualificationActive(
  qualification: TeachingQualification,
  active: boolean,
): Promise<TeachingData> {
  const result = await TeachingQualifications.update(qualification.id, {
    imtcbra_habilitacaoativa: active,
  });
  if (!result.success) {
    throw new Error(
      result.error?.message || "O Dataverse não confirmou a alteração da habilitação.",
    );
  }

  const refreshed = await loadTeachingData();
  const persisted = refreshed.qualifications.find(
    (item) => item.id.toLowerCase() === qualification.id.toLowerCase(),
  );
  if (!persisted || persisted.active !== active) {
    throw new Error("A alteração foi enviada, mas não pôde ser confirmada no Dataverse.");
  }

  notifyTeachingDataChanged(refreshed);
  return refreshed;
}
