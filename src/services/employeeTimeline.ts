import { getClient } from "@microsoft/power-apps/data";
import type {
  Ctmbrasi_rhtimelineeventses,
  Ctmbrasi_rhtimelineeventsesBase,
  Ctmbrasi_rhtimelineeventsesctmbrasi_eventcategory,
} from "../generated/models/Ctmbrasi_rhtimelineeventsesModel";
import { Ctmbrasi_rhtimelineeventsesService } from "../generated/services/Ctmbrasi_rhtimelineeventsesService";
import type { RhEmployee, TimelineEvent, TimelineEventCategory } from "../types/rh";
import { dataSourcesInfo } from "../../.power/schemas/appschemas/dataSourcesInfo";
import { getCurrentUserDisplayName } from "./currentUser";

const timelineClient = getClient(dataSourcesInfo);

const categoryToDataverse: Record<TimelineEventCategory, Ctmbrasi_rhtimelineeventsesctmbrasi_eventcategory> = {
  Cadastro: 583150000,
  Contrato: 583150001,
  "Férias": 583150002,
  Substituição: 583150003,
  Idioma: 583150004,
  Risco: 583150005,
  "Alteração administrativa": 583150006,
};

const categoryFromDataverse: Record<number, TimelineEventCategory> = {
  583150000: "Cadastro",
  583150001: "Contrato",
  583150002: "Férias",
  583150003: "Substituição",
  583150004: "Idioma",
  583150005: "Risco",
  583150006: "Alteração administrativa",
};

const trackedFields: {
  key: keyof RhEmployee;
  label: string;
  category: TimelineEventCategory;
}[] = [
  { key: "nome", label: "Nome", category: "Cadastro" },
  { key: "idFuncionario", label: "ID funcional", category: "Cadastro" },
  { key: "globalId", label: "Global ID", category: "Cadastro" },
  { key: "genero", label: "Gênero", category: "Cadastro" },
  { key: "nomePlaqueta", label: "Nome da Plaqueta", category: "Cadastro" },
  { key: "emailBYU", label: "E-mail BYU", category: "Cadastro" },
  { key: "emailPessoal", label: "E-mail pessoal", category: "Cadastro" },
  { key: "telefone", label: "Telefone celular", category: "Cadastro" },
  { key: "statusDataverse", label: "Status do funcionário", category: "Cadastro" },
  { key: "statusRegistro", label: "Status do registro", category: "Cadastro" },
  { key: "templo", label: "Designação no templo", category: "Cadastro" },
  { key: "dataAdmissao", label: "Data de admissão", category: "Contrato" },
  { key: "dataTerminoReal", label: "Data de término", category: "Contrato" },
  { key: "emailCorporativo", label: "E-mail corporativo", category: "Cadastro" },
  { key: "linkZoom", label: "Link do Zoom", category: "Cadastro" },
  { key: "cargo", label: "Cargo", category: "Cadastro" },
  { key: "zona", label: "Zona", category: "Cadastro" },
  { key: "turno", label: "Turno", category: "Cadastro" },
  { key: "idiomas", label: "Idiomas", category: "Idioma" },
  { key: "periodosFerias", label: "Per\u00edodos de f\u00e9rias", category: categoryFromDataverse[583150002] },
  { key: "diasVendidosFerias", label: "Dias de f\u00e9rias vendidos", category: categoryFromDataverse[583150002] },
];

function nomeResponsavel(actor: string): string {
  return actor.length <= 100 ? actor : `${actor.slice(0, 97)}...`;
}

async function obterResponsavelAtual(): Promise<string> {
  const name = await getCurrentUserDisplayName();
  return nomeResponsavel(name);
}

function converterEvento(event: Ctmbrasi_rhtimelineeventses): TimelineEvent {
  const title = event.ctmbrasi_eventtitle?.trim() || "";
  const type = event.ctmbrasi_eventtype?.trim() || "";

  return {
    recordId: event.ctmbrasi_rhtimelineeventsid,
    data: (event.ctmbrasi_eventdate || event.createdon || "").slice(0, 10),
    tipo: type || title || "Registro",
    descricao: type ? title || event.ctmbrasi_description || "" : event.ctmbrasi_description || "",
    responsavel: event.ctmbrasi_responsiblename?.trim()
      || event.ctmbrasi_notes?.trim()
      || "Não informado",
    categoria: categoryFromDataverse[Number(event.ctmbrasi_eventcategory)] || "Alteração administrativa",
  };
}

export async function obterHistoricoFuncionario(employeeId: string): Promise<TimelineEvent[]> {
  const events: Ctmbrasi_rhtimelineeventses[] = [];
  const seenTokens = new Set<string>();
  const escapedEmployeeId = employeeId.replace(/'/g, "''");
  let skipToken: string | undefined;

  do {
    const result = await Ctmbrasi_rhtimelineeventsesService.getAll({
      maxPageSize: 500,
      select: [
        "ctmbrasi_rhtimelineeventsid",
        "ctmbrasi_employee",
        "ctmbrasi_eventdate",
        "ctmbrasi_eventtitle",
        "ctmbrasi_eventtype",
        "ctmbrasi_description",
        "ctmbrasi_eventcategory",
        "ctmbrasi_notes",
        "createdon",
        "statecode",
      ],
      filter: `ctmbrasi_employee eq '${escapedEmployeeId}'`,
      ...(skipToken ? { skipToken } : {}),
    });

    if (!result.success || !Array.isArray(result.data)) {
      throw new Error(
        result.error?.message || "Não foi possível carregar o histórico do funcionário."
      );
    }

    events.push(...result.data.filter((event) => event.statecode === 0));
    skipToken = result.skipToken || undefined;

    if (skipToken) {
      if (seenTokens.has(skipToken)) {
        throw new Error("A paginação do histórico retornou um token repetido.");
      }
      seenTokens.add(skipToken);
    }
  } while (skipToken);

  return events
    .map(converterEvento)
    .sort((left, right) => right.data.localeCompare(left.data));
}

async function criarEvento(
  employeeId: string,
  category: TimelineEventCategory,
  type: string,
  title: string,
  actor: string,
): Promise<void> {
  if (title.length > 850) {
    throw new Error("O detalhe da alteração excede o limite aceito pelo histórico do Dataverse.");
  }

  const record: Omit<Ctmbrasi_rhtimelineeventsesBase, "ctmbrasi_rhtimelineeventsid"> = {
    ctmbrasi_employee: employeeId,
    ctmbrasi_eventdate: new Date().toISOString(),
    ctmbrasi_eventtitle: title,
    ctmbrasi_eventtype: type.slice(0, 100),
    ctmbrasi_eventcategory: categoryToDataverse[category],
    ctmbrasi_notes: actor,
    ctmbrasi_description: "Registrado pelo sistema de RH",
    statecode: 0,
    statuscode: 1,
  };
  const result = await Ctmbrasi_rhtimelineeventsesService.create(record);

  if (!result.success) {
    throw new Error(result.error?.message || "Não foi possível gravar o histórico no Dataverse.");
  }
}

export async function adicionarObservacaoHistorico(
  employeeId: string,
  text: string,
  category: TimelineEventCategory,
): Promise<void> {
  const trimmedText = text.trim();
  if (!trimmedText) {
    throw new Error("Digite uma observação antes de salvar.");
  }

  const actor = await obterResponsavelAtual();
  await criarEvento(employeeId, category, "Observação", trimmedText, actor);
}

export async function excluirObservacaoHistorico(eventId: string): Promise<void> {
  if (!eventId.trim()) {
    throw new Error("O identificador da observação é obrigatório.");
  }

  const recordResult = await Ctmbrasi_rhtimelineeventsesService.get(eventId, {
    select: ["ctmbrasi_eventtype"],
  });
  if (!recordResult.success || !recordResult.data) {
    throw new Error(
      recordResult.error?.message || "Não foi possível localizar a observação para exclusão."
    );
  }
  if (recordResult.data.ctmbrasi_eventtype?.trim() !== "Observação") {
    throw new Error("Somente observações criadas manualmente podem ser excluídas.");
  }

  const deleteResult = await timelineClient.deleteRecordAsync(
    "ctmbrasi_rhtimelineeventses",
    eventId,
  );
  if (!deleteResult.success) {
    throw new Error(
      deleteResult.error?.message || "Não foi possível excluir a observação do histórico."
    );
  }
}

function formatarValor(field: keyof RhEmployee, value: unknown): string {
  if (value === undefined || value === null || value === "") return "(vazio)";
  if (field === "periodosFerias" && Array.isArray(value)) {
    return value.length
      ? value
          .map((periodo) => {
            const item = periodo as RhEmployee["periodosFerias"][number];
            return `${item.dataInicio} a ${item.dataFim} (${item.dias} dias)`;
          })
          .join("; ")
      : "(nenhum)";
  }
  if (Array.isArray(value)) return value.length ? value.join(", ") : "(nenhum)";
  if (typeof value === "boolean") return value ? "Sim" : "Não";

  if (field === "statusRegistro" && typeof value === "number") {
    return value === 0 ? "Ativo" : "Inativo";
  }

  if (field === "statusDataverse" && typeof value === "number") {
    const labels: Record<number, string> = {
      583150000: "Ativo",
      583150001: "Férias",
      583150002: "Afastado",
      583150003: "Inativo",
      583150004: "Encerrado",
    };
    return labels[value] || String(value);
  }

  if (field === "genero" && typeof value === "number") {
    const labels: Record<number, string> = {
      583150000: "Masculino",
      583150001: "Feminino",
    };
    return labels[value] || String(value);
  }

  return String(value);
}

function valoresEquivalentes(field: keyof RhEmployee, previous: unknown, current: unknown): boolean {
  if (field === "idiomas" && Array.isArray(previous) && Array.isArray(current)) {
    const normalize = (items: string[]) =>
      [...items].map((item) => item.trim().toLocaleLowerCase("pt-BR")).sort();
    return JSON.stringify(normalize(previous)) === JSON.stringify(normalize(current));
  }

  return JSON.stringify(previous) === JSON.stringify(current);
}

export async function registrarAlteracoesFuncionario(
  previous: RhEmployee,
  current: RhEmployee,
): Promise<void> {
  const changes = trackedFields.filter(({ key }) =>
    !valoresEquivalentes(key, previous[key], current[key])
  );
  if (!changes.length) return;

  const actor = await obterResponsavelAtual();
  for (const change of changes) {
    const before = formatarValor(change.key, previous[change.key]);
    const after = formatarValor(change.key, current[change.key]);
    const detail = `De: ${before} | Para: ${after}`;
    await criarEvento(
      current.recordId,
      change.category,
      `Alteração: ${change.label}`,
      detail,
      actor,
    );
  }
}
