import type { IGetAllOptions } from "../generated/models/CommonModels";
import type {
  Ctmbrasi_rhcontractrenewalses,
  Ctmbrasi_rhcontractrenewalsesBase,
  Ctmbrasi_rhcontractrenewalsesctmbrasi_renewalstatus,
} from "../generated/models/Ctmbrasi_rhcontractrenewalsesModel";
import type { Systemusers } from "../generated/models/SystemusersModel";
import { Ctmbrasi_rhcontractrenewalsesService as Renewals } from "../generated/services/Ctmbrasi_rhcontractrenewalsesService";
import { SystemusersService as Users } from "../generated/services/SystemusersService";
import type { ContractRenewalStatus, RhEmployee } from "../types/rh";
import { getCurrentUserIdentity } from "./currentUser";
import { carregarFuncionarios } from "./rhDataSource";

const EMPLOYEE_ENTITY_SET = "ctmbrasi_employeerecordses";
const USER_ENTITY_SET = "systemusers";

const statusToDataverse: Record<
  ContractRenewalStatus,
  Ctmbrasi_rhcontractrenewalsesctmbrasi_renewalstatus
> = {
  "Não iniciado": 583150000,
  "Em análise": 583150001,
  "Aguardando coordenação": 583150002,
  "Aguardando aprovação": 583150003,
  Renovado: 583150004,
  "Não renovar": 583150005,
  Encerrado: 583150006,
  Urgente: 583150007,
};

export interface ContractResponsible {
  id: string;
  name: string;
  email: string;
  current: boolean;
}

export interface ContractRenewalInput {
  employeeId: string;
  employeeName: string;
  currentEndDate: string;
  status: ContractRenewalStatus;
  responsibleId?: string;
  decisionDeadline: string;
  notes: string;
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
  options: Pick<IGetAllOptions, "select" | "filter" | "orderBy">,
): Promise<T[]> {
  const rows: T[] = [];
  const usedTokens = new Set<string>();
  let skipToken: string | undefined;

  do {
    const result = await reader({
      ...options,
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

function normalize(value: string | undefined) {
  return (value || "").trim().toLocaleLowerCase("pt-BR");
}

export async function loadContractResponsibles(): Promise<ContractResponsible[]> {
  const identity = await getCurrentUserIdentity().catch(() => null);
  let rows: Systemusers[] = [];

  try {
    rows = await readAll<Systemusers>(
      "os usuários responsáveis",
      (options) => Users.getAll(options),
      {
        select: [
          "systemuserid",
          "fullname",
          "internalemailaddress",
          "domainname",
          "azureactivedirectoryobjectid",
          "isdisabled",
        ],
        filter: "isdisabled eq false",
        orderBy: ["fullname asc"],
      },
    );
  } catch (error) {
    if (!identity?.systemUserId) throw error;
  }

  const mapped = rows
    .filter((row) => row.systemuserid && row.isdisabled !== true)
    .map((row): ContractResponsible => {
      const email = row.internalemailaddress || row.domainname || "";
      const current = Boolean(
        identity &&
          ((identity.systemUserId &&
            normalize(identity.systemUserId) === normalize(row.systemuserid)) ||
            (identity.objectId &&
              normalize(identity.objectId) ===
                normalize(row.azureactivedirectoryobjectid)) ||
            (identity.email && normalize(identity.email) === normalize(email))),
      );
      return {
        id: row.systemuserid,
        name: row.fullname?.trim() || email || "Usuário do Dataverse",
        email,
        current,
      };
    });

  if (
    identity?.systemUserId &&
    !mapped.some((user) => normalize(user.id) === normalize(identity.systemUserId))
  ) {
    mapped.push({
      id: identity.systemUserId,
      name: identity.displayName || identity.email,
      email: identity.email,
      current: true,
    });
  }

  return mapped.sort((left, right) => {
    if (left.current !== right.current) return left.current ? -1 : 1;
    return left.name.localeCompare(right.name, "pt-BR");
  });
}

async function findRenewal(employeeId: string) {
  const normalizedEmployeeId = employeeId.trim().replace(/[{}]/g, "");
  if (!/^[0-9a-fA-F-]{36}$/.test(normalizedEmployeeId)) {
    throw new Error("O identificador do funcionário não é um GUID válido do Dataverse.");
  }

  const rows = await readAll<Ctmbrasi_rhcontractrenewalses>(
    "a renovação contratual",
    (options) => Renewals.getAll(options),
    {
      select: [
        "ctmbrasi_rhcontractrenewalsid",
        "_ctmbrasi_employee_value",
        "_ctmbrasi_responsible_value",
        "ctmbrasi_renewalstatus",
        "ctmbrasi_decisiondeadline",
        "ctmbrasi_notes",
        "statecode",
      ],
      // Lookups são expostos pelo Web API como _<nome lógico>_value.
      // O GUID deve ser enviado sem aspas na expressão OData.
      filter: `_ctmbrasi_employee_value eq ${normalizedEmployeeId}`,
    },
  );
  return rows.find((row) => row.statecode === 0) || rows[0];
}

function recommendationFor(status: ContractRenewalStatus): 583150000 | 583150001 | 583150002 | 583150003 {
  if (status === "Renovado") return 583150000;
  if (status === "Não renovar" || status === "Encerrado") return 583150001;
  if (status === "Não iniciado") return 583150003;
  return 583150002;
}

export async function saveContractRenewal(
  input: ContractRenewalInput,
): Promise<RhEmployee[]> {
  if (!input.employeeId.trim()) throw new Error("Funcionário inválido para renovação.");
  if (input.notes.trim().length > 100) {
    throw new Error("O parecer deve possuir no máximo 100 caracteres.");
  }

  const existing = await findRenewal(input.employeeId);
  const fields: Partial<
    Omit<Ctmbrasi_rhcontractrenewalsesBase, "ctmbrasi_rhcontractrenewalsid">
  > = {
    ctmbrasi_contractrenewalname: `${input.employeeName} — renovação contratual`.slice(0, 850),
    ctmbrasi_currentenddate: input.currentEndDate || undefined,
    ctmbrasi_decisiondeadline: input.decisionDeadline || undefined,
    ctmbrasi_notes: input.notes.trim(),
    ctmbrasi_renewalstatus: statusToDataverse[input.status],
    ctmbrasi_recommendation: recommendationFor(input.status),
    statecode: 0,
    statuscode: 1,
    ...(input.responsibleId
      ? {
          "ctmbrasi_Responsible@odata.bind":
            `/${USER_ENTITY_SET}(${input.responsibleId})`,
        }
      : {}),
  };

  const result = existing
    ? await Renewals.update(existing.ctmbrasi_rhcontractrenewalsid, fields)
    : await Renewals.create({
        ...fields,
        statecode: 0,
        "ctmbrasi_Employee@odata.bind":
          `/${EMPLOYEE_ENTITY_SET}(${input.employeeId})`,
      } as Omit<Ctmbrasi_rhcontractrenewalsesBase, "ctmbrasi_rhcontractrenewalsid">);

  if (!result.success) {
    throw new Error(
      result.error?.message ||
        "O Dataverse não confirmou a gravação da renovação contratual.",
    );
  }

  const savedId = existing?.ctmbrasi_rhcontractrenewalsid ||
    result.data?.ctmbrasi_rhcontractrenewalsid;
  if (!savedId) {
    throw new Error("O Dataverse gravou a renovação, mas não retornou o identificador do registro.");
  }

  const confirmation = await Renewals.get(savedId, {
    select: [
      "ctmbrasi_rhcontractrenewalsid",
      "ctmbrasi_renewalstatus",
      "ctmbrasi_decisiondeadline",
      "ctmbrasi_notes",
      "_ctmbrasi_responsible_value",
    ],
  });
  if (!confirmation.success || !confirmation.data) {
    throw new Error(
      confirmation.error?.message ||
        "A renovação foi enviada, mas não foi possível confirmar a gravação no Dataverse.",
    );
  }
  if (confirmation.data.ctmbrasi_renewalstatus !== statusToDataverse[input.status]) {
    throw new Error("O Dataverse não confirmou o novo status da renovação.");
  }
  if (
    input.decisionDeadline &&
    (confirmation.data.ctmbrasi_decisiondeadline || "").slice(0, 10) !==
      input.decisionDeadline
  ) {
    throw new Error("O Dataverse não confirmou a data limite da decisão.");
  }
  if ((confirmation.data.ctmbrasi_notes || "") !== input.notes.trim()) {
    throw new Error("O Dataverse não confirmou o parecer da renovação.");
  }
  if (
    input.responsibleId &&
    normalize(confirmation.data._ctmbrasi_responsible_value) !==
      normalize(input.responsibleId)
  ) {
    throw new Error("O Dataverse não confirmou o responsável pela análise.");
  }

  return carregarFuncionarios();
}
