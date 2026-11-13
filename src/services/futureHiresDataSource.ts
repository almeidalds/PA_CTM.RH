/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getContext } from "@microsoft/power-apps/app";
import type { IGetAllOptions } from "../generated/models/CommonModels";
import type {
  Ctmbrasi_rhcontratacoesfuturases,
  Ctmbrasi_rhcontratacoesfuturasesBase,
} from "../generated/models/Ctmbrasi_rhcontratacoesfuturasesModel";
import {
  Ctmbrasi_rhcontratacoesfuturasesctmbrasi_fase,
  Ctmbrasi_rhcontratacoesfuturasesctmbrasi_statusdeconfirmacao,
} from "../generated/models/Ctmbrasi_rhcontratacoesfuturasesModel";
import { Ctmbrasi_rhcontratacoesfuturasesService } from "../generated/services/Ctmbrasi_rhcontratacoesfuturasesService";
import {
  carregarCatalogosDataverse,
  type CatalogosRH,
} from "./dataverseCatalogs";
import {
  FUTURE_HIRE_STATUS_LABELS,
  type FutureHire,
  type FutureHireStatus,
} from "../types/futureHires";

const PAGE_SIZE = 500;
const MAX_RECORDS = 100000;
const HISTORY_MARKER = "[CTM RH | Histórico]";

const statusToDataverse: Record<
  FutureHireStatus,
  Ctmbrasi_rhcontratacoesfuturases["ctmbrasi_statusdeconfirmacao"]
> = {
  aguardando_confirmacao: 583150000,
  inicio_confirmado: 583150001,
  data_reagendada: 583150002,
  cancelado: 583150003,
};

const phaseToDataverse =
  Ctmbrasi_rhcontratacoesfuturasesctmbrasi_fase;

function isDataverseStatus(value: unknown): value is number {
  return typeof value === "number" &&
    Object.prototype.hasOwnProperty.call(
      Ctmbrasi_rhcontratacoesfuturasesctmbrasi_statusdeconfirmacao,
      value,
    );
}

function mapStatus(value: unknown): FutureHireStatus {
  if (value === undefined || value === null) {
    return "aguardando_confirmacao";
  }
  if (!isDataverseStatus(value)) {
    throw new Error(
      `Status de confirmação desconhecido no Dataverse (${String(value)}).`,
    );
  }

  switch (value) {
    case 583150000:
      return "aguardando_confirmacao";
    case 583150001:
      return "inicio_confirmado";
    case 583150002:
      return "data_reagendada";
    case 583150003:
      return "cancelado";
    default:
      throw new Error("Status de confirmação não suportado.");
  }
}

function mapPhase(value: unknown): FutureHire["fase"] {
  if (value === 583150001) return "efetivado";
  if (value === 583150000 || value === undefined || value === null) {
    return "pendente";
  }
  throw new Error(
    `Fase de contratação desconhecida no Dataverse (${String(value)}).`,
  );
}

function dateOnly(value?: string | null): string | null {
  if (!value) return null;
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function relationName(
  id: string | undefined,
  values: CatalogosRH["zonas"],
): string {
  return values.find((item) => item.id === id)?.nome ?? "";
}

function toFutureHire(
  row: Ctmbrasi_rhcontratacoesfuturases,
  catalogs: CatalogosRH,
): FutureHire {
  const checks = (value: boolean | undefined) => value ?? null;

  return {
    id: row.ctmbrasi_rhcontratacoesfuturasid,
    instrutorNovo: row.ctmbrasi_instrutoranovo ?? "",
    idiomas: relationName(
      row._ctmbrasi_idiomas_value,
      catalogs.idiomas,
    ),
    zona: relationName(
      row._ctmbrasi_zonas_value,
      catalogs.zonas,
    ),
    cpf: row.ctmbrasi_cpf ?? "",
    loginSud: row.ctmbrasi_loginsud ?? "",
    nomePlaqueta: row.ctmbrasi_nomedaplaqueta ?? "",
    numero: row.ctmbrasi_telefone === undefined
      ? ""
      : String(row.ctmbrasi_telefone),
    emailChurch: row.ctmbrasi_emailchurch ?? "",
    emailTrain: row.ctmbrasi_emailtrain ?? "",
    linkZoom: row.ctmbrasi_linkdozoom ?? "",
    email: row.ctmbrasi_email ?? "",
    mandouCurriculo: checks(row.ctmbrasi_mandouocurriculo),
    recebeuLigacao: checks(row.ctmbrasi_receberamaligacao),
    emailRH: checks(row.ctmbrasi_emailrh),
    curriculoAvaliacao: checks(row.ctmbrasi_curriculoeavaliacao),
    grupoWhatsApp: checks(row.ctmbrasi_estanogrupodowhatsapp),
    mandouInformacoes: checks(row.ctmbrasi_mandouinformacoes),
    plaquetasEncaminhadas: checks(
      row.ctmbrasi_nomesdeplaquetasencaminhados,
    ),
    acessosSolicitados: checks(row.ctmbrasi_acessossolicitados),
    notebooksProntos: checks(row.ctmbrasi_notebooksprontos),
    kitsProntos: checks(row.ctmbrasi_kitsprontos),
    grupoOrigem: row.ctmbrasi_grupooriginal ?? "",
    linhaOrigem: row.ctmbrasi_linhaoriginal
      ? Number(row.ctmbrasi_linhaoriginal) || null
      : null,
    dataPrevistaInicio: dateOnly(row.ctmbrasi_dataprevistadeinicio),
    dataRealInicio: dateOnly(row.ctmbrasi_datarealdeinicio),
    statusConfirmacao: mapStatus(row.ctmbrasi_statusdeconfirmacao),
    fase: mapPhase(row.ctmbrasi_fase),
    cargo: relationName(
      row._ctmbrasi_cargo_value,
      catalogs.cargos,
    ) || null,
    matricula: row.ctmbrasi_matricula ?? "",
    observacoes: row.ctmbrasi_observacoes ?? "",
    employeeRecordId: row._ctmbrasi_funcionarioefetivado_value ?? null,
    createdOn: row.createdon,
    modifiedOn: row.modifiedon,
    versionNumber: row.versionnumber,
  };
}

async function readAllFutureHires(): Promise<
  Ctmbrasi_rhcontratacoesfuturases[]
> {
  const records: Ctmbrasi_rhcontratacoesfuturases[] = [];
  const usedTokens = new Set<string>();
  let skipToken: string | undefined;

  do {
    const options: IGetAllOptions = {
      maxPageSize: PAGE_SIZE,
      ...(skipToken ? { skipToken } : {}),
    };
    const result =
      await Ctmbrasi_rhcontratacoesfuturasesService.getAll(options);

    if (!result.success || !Array.isArray(result.data)) {
      throw new Error(
        `Falha ao consultar Contratações Futuras: ${
          result.error?.message ?? "verifique a conexão e as permissões."
        }`,
      );
    }

    records.push(...result.data);
    skipToken = result.skipToken || undefined;
    if (skipToken) {
      if (usedTokens.has(skipToken)) {
        throw new Error(
          "O Dataverse repetiu uma página de Contratações Futuras.",
        );
      }
      usedTokens.add(skipToken);
    }

    if (records.length > MAX_RECORDS) {
      throw new Error(
        "A consulta excedeu o limite de segurança de 100.000 registros.",
      );
    }
  } while (skipToken);

  return records;
}

export async function carregarContratacoesFuturas(): Promise<{
  hires: FutureHire[];
  catalogs: CatalogosRH;
}> {
  const [records, catalogs] = await Promise.all([
    readAllFutureHires(),
    carregarCatalogosDataverse(),
  ]);
  return {
    hires: records.map((record) => toFutureHire(record, catalogs)),
    catalogs,
  };
}

function matchCatalog(
  name: string,
  items: CatalogosRH["zonas"],
  label: string,
): string | undefined {
  if (!name.trim()) return undefined;
  const normalize = (value: string) =>
    value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  const item = items.find(
    (candidate) => normalize(candidate.nome) === normalize(name),
  );
  if (!item) {
    throw new Error(`${label} "${name}" não existe no catálogo do Dataverse.`);
  }
  return item.id;
}

function toBase(
  hire: FutureHire,
  catalogs: CatalogosRH,
): Omit<
  Ctmbrasi_rhcontratacoesfuturasesBase,
  "ctmbrasi_rhcontratacoesfuturasid"
> {
  const phone = hire.numero.trim();
  if (phone && !/^\d+$/.test(phone)) {
    throw new Error("O telefone deve conter somente números.");
  }
  if (phone && Number(phone) > 2147483647) {
    throw new Error(
      "A coluna Telefone é do tipo inteiro de 32 bits e não comporta esse número. Altere-a para Texto no Dataverse antes de gravar telefones completos.",
    );
  }
  if (/^0\d+/.test(phone)) {
    throw new Error(
      "A coluna Telefone numérica removeria o zero inicial. Altere-a para Texto no Dataverse para preservar o valor.",
    );
  }

  const zoneId = matchCatalog(hire.zona, catalogs.zonas, "Zona");
  const positionId = matchCatalog(hire.cargo ?? "", catalogs.cargos, "Cargo");
  const languageId = matchCatalog(
    hire.idiomas,
    catalogs.idiomas,
    "Idioma",
  );

  return {
    ctmbrasi_instrutoranovo: hire.instrutorNovo.trim(),
    ctmbrasi_cpf: hire.cpf.trim() || undefined,
    ctmbrasi_loginsud: hire.loginSud.trim() || undefined,
    ctmbrasi_nomedaplaqueta: hire.nomePlaqueta.trim() || undefined,
    ctmbrasi_telefone: phone ? Number(phone) : undefined,
    ctmbrasi_emailchurch: hire.emailChurch.trim() || undefined,
    ctmbrasi_emailtrain: hire.emailTrain.trim() || undefined,
    ctmbrasi_linkdozoom: hire.linkZoom.trim() || undefined,
    ctmbrasi_email: hire.email.trim() || undefined,
    ctmbrasi_mandouocurriculo: hire.mandouCurriculo ?? undefined,
    ctmbrasi_receberamaligacao: hire.recebeuLigacao ?? undefined,
    ctmbrasi_emailrh: hire.emailRH ?? undefined,
    ctmbrasi_curriculoeavaliacao: hire.curriculoAvaliacao ?? undefined,
    ctmbrasi_estanogrupodowhatsapp: hire.grupoWhatsApp ?? undefined,
    ctmbrasi_mandouinformacoes: hire.mandouInformacoes ?? undefined,
    ctmbrasi_nomesdeplaquetasencaminhados:
      hire.plaquetasEncaminhadas ?? undefined,
    ctmbrasi_acessossolicitados: hire.acessosSolicitados ?? undefined,
    ctmbrasi_notebooksprontos: hire.notebooksProntos ?? undefined,
    ctmbrasi_kitsprontos: hire.kitsProntos ?? undefined,
    ctmbrasi_grupooriginal: hire.grupoOrigem.trim() || undefined,
    ctmbrasi_linhaoriginal: hire.linhaOrigem === null
      ? undefined
      : String(hire.linhaOrigem),
    ctmbrasi_dataprevistadeinicio: hire.dataPrevistaInicio
      ? `${hire.dataPrevistaInicio}T00:00:00Z`
      : undefined,
    ctmbrasi_datarealdeinicio: hire.dataRealInicio
      ? `${hire.dataRealInicio}T00:00:00Z`
      : undefined,
    ctmbrasi_statusdeconfirmacao: statusToDataverse[
      hire.statusConfirmacao
    ],
    ctmbrasi_fase: 583150000,
    ctmbrasi_matricula: hire.matricula.trim() || undefined,
    ctmbrasi_observacoes: hire.observacoes || undefined,
    ...(zoneId
      ? { "ctmbrasi_Zonas@odata.bind": `/ctmbrasi_rhzoneses(${zoneId})` }
      : {}),
    ...(positionId
      ? { "ctmbrasi_Cargo@odata.bind": `/ctmbrasi_rhpositionses(${positionId})` }
      : {}),
    ...(languageId
      ? {
          "ctmbrasi_Idiomas@odata.bind":
            `/ctmbrasi_rhlanguageses(${languageId})`,
        }
      : {}),
    statecode: 0,
  };
}

function preserveHistory(existing: string, requested: string): string {
  const historyLines = existing
    .split(/\r?\n/)
    .filter((line) => line.startsWith(HISTORY_MARKER));
  const noteLines = requested
    .split(/\r?\n/)
    .filter((line) => !line.startsWith(HISTORY_MARKER));
  return [...noteLines, ...historyLines].filter(Boolean).join("\n");
}

function appendHistory(
  existing: string,
  requested: string,
  actor: string,
  description: string,
): string {
  const at = new Date().toISOString();
  const line =
    `${HISTORY_MARKER} ${at} | ${actor} | ${description}`;
  return [preserveHistory(existing, requested), line]
    .filter(Boolean)
    .join("\n");
}

export async function obterResponsavelAtual(): Promise<string> {
  const context = await getContext();
  const actor =
    context.user.fullName?.trim() ||
    context.user.userPrincipalName?.trim();
  if (!actor) {
    throw new Error(
      "O Power Apps não informou o usuário responsável pela alteração.",
    );
  }
  return actor.replace(/[\r\n|]/g, " ");
}

export async function criarContratacaoFutura(
  hire: FutureHire,
  catalogs: CatalogosRH,
): Promise<void> {
  const result = await Ctmbrasi_rhcontratacoesfuturasesService.create(
    toBase(hire, catalogs),
  );
  if (!result.success) {
    throw new Error(
      `Não foi possível cadastrar a contratação: ${
        result.error?.message ?? "verifique as permissões do Dataverse."
      }`,
    );
  }
}

export async function salvarContratacaoFutura(
  original: FutureHire,
  updated: FutureHire,
  catalogs: CatalogosRH,
  reason?: string,
): Promise<void> {
  const current =
    await Ctmbrasi_rhcontratacoesfuturasesService.get(original.id);
  if (!current.success || !current.data) {
    throw new Error(
      `Não foi possível verificar a contratação antes de salvar: ${
        current.error?.message ?? "registro indisponível."
      }`,
    );
  }
  if (
    original.versionNumber !== undefined &&
    current.data.versionnumber !== undefined &&
    original.versionNumber !== current.data.versionnumber
  ) {
    throw new Error(
      "Esta contratação foi alterada por outra pessoa. Atualize os dados e tente novamente.",
    );
  }
  if (
    original.modifiedOn &&
    current.data.modifiedon &&
    original.modifiedOn !== current.data.modifiedon
  ) {
    throw new Error(
      "Esta contratação foi alterada por outra pessoa. Atualize os dados e tente novamente.",
    );
  }

  const changed: Partial<
    Omit<Ctmbrasi_rhcontratacoesfuturasesBase, "ctmbrasi_rhcontratacoesfuturasid">
  > = toBase(updated, catalogs);

  const dateChanged =
    original.dataPrevistaInicio !== updated.dataPrevistaInicio;
  const statusChanged =
    original.statusConfirmacao !== updated.statusConfirmacao;

  if (dateChanged || statusChanged) {
    const actor = await obterResponsavelAtual();
    const changes: string[] = [];
    if (dateChanged) {
      changes.push(
        `data prevista: ${original.dataPrevistaInicio ?? "a definir"} → ${
          updated.dataPrevistaInicio ?? "a definir"
        }`,
      );
    }
    if (statusChanged) {
      changes.push(
        `status: ${FUTURE_HIRE_STATUS_LABELS[original.statusConfirmacao]} → ${
          FUTURE_HIRE_STATUS_LABELS[updated.statusConfirmacao]
        }`,
      );
    }
    if (reason?.trim()) changes.push(`motivo: ${reason.trim()}`);
    changed.ctmbrasi_observacoes = appendHistory(
      current.data.ctmbrasi_observacoes ?? "",
      updated.observacoes,
      actor,
      changes.join("; "),
    );
  } else {
    changed.ctmbrasi_observacoes = preserveHistory(
      current.data.ctmbrasi_observacoes ?? "",
      updated.observacoes,
    );
  }

  const result =
    await Ctmbrasi_rhcontratacoesfuturasesService.update(
      updated.id,
      changed,
    );
  if (!result.success) {
    throw new Error(
      `Não foi possível salvar a contratação: ${
        result.error?.message ?? "verifique as permissões do Dataverse."
      }`,
    );
  }
}

export function converterRegistroFutureHire(
  row: Ctmbrasi_rhcontratacoesfuturases,
  catalogs: CatalogosRH,
): FutureHire {
  return toFutureHire(row, catalogs);
}
