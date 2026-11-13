
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CTM Brasil - Recursos Humanos
 * Fonte de dados: Microsoft Dataverse
 */

import type {
  RhEmployee,
  ContractRenewalStatus,
} from "../types/rh";

import {
  Ctmbrasi_rhemployeelanguagesesService as EmployeeLanguages,
} from "../generated/services/Ctmbrasi_rhemployeelanguagesesService";


import type {
  IGetAllOptions,
} from "../generated/models/CommonModels";

import type {
  Ctmbrasi_employeerecordsesBase,
} from "../generated/models/Ctmbrasi_employeerecordsesModel";

import type {
  Ctmbrasi_rhemployeelanguageses,
} from "../generated/models/Ctmbrasi_rhemployeelanguagesesModel";

import type {
  Ctmbrasi_rhvacationperiodsesBase,
  Ctmbrasi_rhvacationperiodses,
} from "../generated/models/Ctmbrasi_rhvacationperiodsesModel";

import type {
  Ctmbrasi_rhcontractrenewalses,
} from "../generated/models/Ctmbrasi_rhcontractrenewalsesModel";

import {
  Ctmbrasi_employeerecordsesService as Employees,
} from "../generated/services/Ctmbrasi_employeerecordsesService";


import {
  Ctmbrasi_rhvacationperiodsesService as Vacations,
} from "../generated/services/Ctmbrasi_rhvacationperiodsesService";

import {
  Ctmbrasi_rhcontractrenewalsesService as Renewals,
} from "../generated/services/Ctmbrasi_rhcontractrenewalsesService";

import {
  listarFuncionariosDataverse,
} from "./dataverseEmployees";

import {
  carregarCatalogosDataverse,
  type CatalogosRH,
} from "./dataverseCatalogs";
import { registrarAlteracoesFuncionario } from "./employeeTimeline";
import { getToday } from "../utils/dateUtils";

// ==========================================
// CACHE TEMPORÁRIO DA SESSÃO
// ==========================================

let funcionariosEmMemoria: RhEmployee[] = [];
let catalogosEmMemoria: CatalogosRH | null = null;
let avisoFechamentoContratos = "";

const formatarData = (valor?: string | null) =>
  (valor || "").slice(0, 10);

export class FuncionarioAtualizadoComAvisosError extends Error {
  constructor(
    public readonly funcionariosAtualizados: RhEmployee[],
    message: string,
  ) {
    super(message);
    this.name = "FuncionarioAtualizadoComAvisosError";
  }
}

export function obterAvisoFechamentoContratos(): string {
  return avisoFechamentoContratos;
}

// ==========================================
// CONSULTAS COM PAGINAÇÃO
// ==========================================

async function lerTodas<T>(
  tabela: string,
  consulta: (
    opcoes?: IGetAllOptions
  ) => Promise<{
    success: boolean;
    data?: T[];
    skipToken?: string;
    error?: { message?: string };
  }>
): Promise<T[]> {
  const registros: T[] = [];
  const tokens = new Set<string>();
  let skipToken: string | undefined;

  do {
    const resposta = await consulta({
      maxPageSize: 500,
      ...(skipToken ? { skipToken } : {}),
    });

    if (!resposta.success || !Array.isArray(resposta.data)) {
      throw new Error(
        `Falha ao consultar ${tabela}: ${
          resposta.error?.message ||
          "Acesso negado ou tabela indisponível."
        }`
      );
    }

    registros.push(...resposta.data);
    skipToken = resposta.skipToken || undefined;

    if (skipToken) {
      if (tokens.has(skipToken)) {
        throw new Error(`Paginação repetida em ${tabela}.`);
      }

      tokens.add(skipToken);
    }
  } while (skipToken);

  return registros;
}

// ==========================================
// STATUS DE RENOVAÇÃO
// ==========================================

const statusRenovacao: Record<
  number,
  ContractRenewalStatus
> = {
  583150000: "Não iniciado",
  583150001: "Em análise",
  583150002: "Aguardando coordenação",
  583150003: "Aguardando aprovação",
  583150004: "Renovado",
  583150005: "Não renovar",
  583150006: "Encerrado",
  583150007: "Urgente",
};

// ==========================================
// CARREGAR FUNCIONÁRIOS DO DATAVERSE
// ==========================================

export async function carregarFuncionarios(): Promise<
  RhEmployee[]
> {
  const [
    funcionarios,
    catalogos,
    vinculos,
    ferias,
    renovacoes,
  ] = await Promise.all([
    listarFuncionariosDataverse(),
    carregarCatalogosDataverse(),

    lerTodas<Ctmbrasi_rhemployeelanguageses>(
      "Idiomas dos funcionários",
      EmployeeLanguages.getAll.bind(EmployeeLanguages)
    ),

    lerTodas<Ctmbrasi_rhvacationperiodses>(
      "Férias",
      Vacations.getAll.bind(Vacations)
    ),

    lerTodas<Ctmbrasi_rhcontractrenewalses>(
      "Renovações contratuais",
      Renewals.getAll.bind(Renewals)
    ),
  ]);

  // Relacionamentos do Dataverse

  const mapaCargos = new Map(
    catalogos.cargos.map((item) => [item.id, item.nome])
  );

  const mapaZonas = new Map(
    catalogos.zonas.map((item) => [item.id, item.nome])
  );

  const mapaTurnos = new Map(
    catalogos.turnos.map((item) => [item.id, item.nome])
  );

  const mapaIdiomas = new Map(
    catalogos.idiomas.map((item) => [item.id, item.nome])
  );

  const hoje = getToday();

  // Ao atingir a data final do contrato, encerra o funcionario e move sua
  // lotacao para a zona "Encerrado". A interface aplica a mesma regra mesmo
  // quando o Dataverse nao puder ser atualizado naquele carregamento.
  avisoFechamentoContratos = "";
  const zonaEncerrado = catalogos.zonas.find(
    (zona) =>
      zona.ativo &&
      zona.nome.trim().toLocaleLowerCase("pt-BR") === "encerrado",
  );
  const contratosVencidos = funcionarios.filter((funcionario) => {
    const termino = formatarData(
      funcionario.ctmbrasi_contractenddate ||
      funcionario.ctmbrasi_terminationdate,
    );
    return Boolean(termino && termino <= hoje);
  });

  const falhasFechamento: string[] = [];
  if (!zonaEncerrado && contratosVencidos.length > 0) {
    avisoFechamentoContratos =
      "Os contratos vencidos foram exibidos como encerrados, mas a zona ativa " +
      "'Encerrado' n\u00e3o foi encontrada no Dataverse. Cadastre essa zona para " +
      "concluir a atualiza\u00e7\u00e3o dos registros.";
  }

  await Promise.all(contratosVencidos.map(async (funcionario) => {
    const zonaAtualId = funcionario._ctmbrasi_zone_value || "";
    const precisaEncerrar = funcionario.ctmbrasi_employeestatus !== 583150004;
    const precisaMoverZona = Boolean(
      zonaEncerrado && zonaAtualId.toLowerCase() !== zonaEncerrado.id.toLowerCase(),
    );

    if (!precisaEncerrar && !precisaMoverZona) return;

    const campos: Partial<Ctmbrasi_employeerecordsesBase> = {};
    if (precisaEncerrar) campos.ctmbrasi_employeestatus = 583150004;
    if (precisaMoverZona && zonaEncerrado) {
      campos["ctmbrasi_Zone@odata.bind"] =
        `/ctmbrasi_rhzoneses(${zonaEncerrado.id})`;
    }

    try {
      const resultado = await Employees.update(
        funcionario.ctmbrasi_employeerecordsid,
        campos,
      );

      if (!resultado.success) {
        falhasFechamento.push(funcionario.ctmbrasi_fullname || funcionario.ctmbrasi_employeeid);
        return;
      }
    } catch (error) {
      console.error("Falha ao encerrar contrato vencido no Dataverse:", error);
      falhasFechamento.push(funcionario.ctmbrasi_fullname || funcionario.ctmbrasi_employeeid);
      return;
    }

    funcionario.ctmbrasi_employeestatus = 583150004;
    if (zonaEncerrado && precisaMoverZona) {
      funcionario._ctmbrasi_zone_value = zonaEncerrado.id;
      funcionario.ctmbrasi_zonename = zonaEncerrado.nome;
    }
  }));

  if (falhasFechamento.length > 0) {
    const nomes = falhasFechamento.slice(0, 3).join(", ");
    const restantes = falhasFechamento.length - 3;
    avisoFechamentoContratos = [
      avisoFechamentoContratos,
      `N\u00e3o foi poss\u00edvel gravar o encerramento de: ${nomes}${
        restantes > 0 ? ` e mais ${restantes}` : ""
      }. A exibi\u00e7\u00e3o foi ajustada temporariamente.`,
    ].filter(Boolean).join(" ");
  }

  // ========================================
  // CONVERTER REGISTROS PARA A INTERFACE
  // ========================================

  const registrosConvertidos = funcionarios.map(
    (funcionario): RhEmployee => {
      const id = funcionario.ctmbrasi_employeerecordsid;
      const dataTermino = formatarData(
        funcionario.ctmbrasi_contractenddate ||
        funcionario.ctmbrasi_terminationdate,
      );
      const contratoVencido = Boolean(dataTermino && dataTermino <= hoje);

      const feriasFuncionario = ferias.filter(
        (item) => item._ctmbrasi_employee_value === id
      );

      const periodosAtivos = feriasFuncionario.filter(
        (item) =>
          item.statecode === 0 &&
          item.ctmbrasi_vacationstatus !== 583150005
      );

      const contrato = renovacoes.find(
        (item) => item._ctmbrasi_employee_value === id
      );

      const diasVendidos = periodosAtivos.reduce(
        (total, item) => total + (item.ctmbrasi_dayssold || 0),
        0
      );

      const periodos = periodosAtivos
        .filter(
          (item) =>
            item.ctmbrasi_startdate &&
            item.ctmbrasi_enddate
        )
        .map((item) => ({
          recordId: item.ctmbrasi_rhvacationperiodsid,
          dataInicio: formatarData(item.ctmbrasi_startdate),
          dataFim: formatarData(item.ctmbrasi_enddate),
          dias: item.ctmbrasi_totaldays || 0,
        }));

      return {
        recordId: id,

        idFuncionario:
          funcionario.ctmbrasi_employeeid || "",

        nome:
          funcionario.ctmbrasi_fullname || "",

        globalId:
          funcionario.ctmbrasi_globalid || "",

        cargo:
          mapaCargos.get(
            funcionario._ctmbrasi_position_value || ""
          ) ||
          funcionario.ctmbrasi_positionname ||
          "",

        zona: contratoVencido
          ? zonaEncerrado?.nome || "Encerrado"
          : mapaZonas.get(
              funcionario._ctmbrasi_zone_value || ""
            ) ||
            funcionario.ctmbrasi_zonename ||
            "",

        turno:
          mapaTurnos.get(
            funcionario._ctmbrasi_shiftslookup_value || ""
          ) ||
          funcionario.ctmbrasi_shiftslookupname ||
          funcionario.ctmbrasi_shift ||
          "",

        dataAdmissao:
          formatarData(funcionario.ctmbrasi_hiredate),

        dataTerminoReal: dataTermino,

        statusFuncionario:
          contratoVencido ||
          funcionario.statecode === 1 ||
          funcionario.ctmbrasi_employeestatus === 583150003 ||
          funcionario.ctmbrasi_employeestatus === 583150004
            ? "Encerrado"
            : "Ativo",

        genero: funcionario.ctmbrasi_gender,

        iniciaisFuncionario:
          funcionario.ctmbrasi_employeeinitials || "",

        emailBYU:
          funcionario.ctmbrasi_byuemail || "",

        emailPessoal:
          funcionario.ctmbrasi_personalemail || "",

        statusDataverse: contratoVencido
          ? 583150004
          : funcionario.ctmbrasi_employeestatus,

        statusRegistro:
          funcionario.statecode,

        templo:
          funcionario.ctmbrasi_temple,

        idiomas: [
          ...new Set(
            vinculos
              .filter(
                (item) =>
                  item._ctmbrasi_employee_value === id &&
                  item.statecode === 0
              )
              .map(
                (item) =>
                  mapaIdiomas.get(
                    item._ctmbrasi_language_value || ""
                  ) ||
                  item.ctmbrasi_languagename ||
                  ""
              )
              .filter(Boolean)
          ),
        ],

        emailCorporativo:
          funcionario.ctmbrasi_corporateemail || "",

        linkZoom:
          funcionario.ctmbrasi_zoomlink || "",

        feriasMarcadas: periodos.some(
          (periodo) => periodo.dataFim >= hoje
        ),

        feriasConcluidas: feriasFuncionario.some(
          (item) =>
            item.ctmbrasi_vacationstatus === 583150004
        ),

        feriasVendidas: diasVendidos > 0,

        diasVendidosFerias: diasVendidos,

        diasTotaisFerias: periodosAtivos.reduce(
          (total, item) =>
            total + (item.ctmbrasi_totaldays || 0),
          0
        ),

        periodosFerias: periodos,

        statusRenovacao: contrato
          ? statusRenovacao[
              contrato.ctmbrasi_renewalstatus || 0
            ]
          : undefined,

        responsavelAnalise:
          contrato?.ctmbrasi_responsiblename || "",

        dataLimiteDecisao:
          formatarData(contrato?.ctmbrasi_decisiondeadline),

        recomendacaoContrato:
          contrato?.ctmbrasi_recommendationname || "",

        observacoesContrato:
          contrato?.ctmbrasi_notes || "",
      };
    }
  );

  catalogosEmMemoria = catalogos;
  funcionariosEmMemoria = registrosConvertidos;

  return [...registrosConvertidos];
}

// ==========================================
// CONSULTAR CACHE DA SESSÃO
// ==========================================

export function obterFuncionarios(): RhEmployee[] {
  return [...funcionariosEmMemoria];
}

// ==========================================
// COMPATIBILIDADE TEMPORÁRIA
// ==========================================

export function resetarDados(): RhEmployee[] {
  // Nunca exclui ou restaura registros do Dataverse.
  // O botão será substituído por "Atualizar Dados"
  // na próxima etapa.
  return obterFuncionarios();
}

// ==========================================
// VALIDAR CAMPOS RELACIONADOS
// ==========================================

function verificarCamposRelacionados(
  atual: RhEmployee,
  anterior: RhEmployee
): void {
  const propriedades: (keyof RhEmployee)[] = [
    "periodosFerias",
    "feriasMarcadas",
    "feriasConcluidas",
    "feriasVendidas",
    "diasVendidosFerias",
    "diasTotaisFerias",
    "statusRenovacao",
    "responsavelAnalise",
    "dataLimiteDecisao",
    "recomendacaoContrato",
    "observacoesContrato",
  ];

  for (const propriedade of propriedades) {
    if (
      JSON.stringify(atual[propriedade]) !==
      JSON.stringify(anterior[propriedade])
    ) {
      throw new Error(
        `Alteração de ${propriedade} ainda não habilitada. ` +
        "Esse campo depende de outra tabela do Dataverse."
      );
    }
  }
}

// ==========================================
// BUSCAR ID DE UM RELACIONAMENTO
// ==========================================

function buscarId(
  nome: string,
  itens: { id: string; nome: string }[],
  campo: string
): string | undefined {
  if (!nome.trim()) return undefined;

  const id = itens.find(
    (item) =>
      item.nome.trim().toLocaleLowerCase("pt-BR") ===
      nome.trim().toLocaleLowerCase("pt-BR")
  )?.id;

  if (!id) {
    throw new Error(
      `${campo} '${nome}' não existe no Dataverse.`
    );
  }

  return id;
}

async function salvarIdiomasFuncionario(
  funcionario: RhEmployee,
  idiomasSelecionados: string[]
): Promise<void> {
  const catalogos = catalogosEmMemoria;
  if (!catalogos) {
    throw new Error("Catálogos do Dataverse não carregados.");
  }

  const nomesIdiomasDesejados = [
    ...new Set(
      idiomasSelecionados
        .map((idioma) => idioma.trim())
        .filter(Boolean)
    ),
  ];
  const idiomasDesejados = nomesIdiomasDesejados.map((nome) => {
    const id = buscarId(nome, catalogos.idiomas, "Idioma");
    if (!id) {
      throw new Error(`Não foi possível encontrar o idioma ${nome}.`);
    }

    return { nome, id };
  });
  const idsDesejados = new Set(
    idiomasDesejados.map((idioma) => idioma.id.toLowerCase())
  );
  const vinculos = await lerTodas<Ctmbrasi_rhemployeelanguageses>(
    "Idiomas dos funcionários",
    EmployeeLanguages.getAll.bind(EmployeeLanguages)
  );
  const vinculosFuncionario = vinculos.filter(
    (vinculo) =>
      vinculo._ctmbrasi_employee_value?.toLowerCase() ===
      funcionario.recordId.toLowerCase()
  );
  const idsAtivos = new Set(
    vinculosFuncionario
      .filter((vinculo) => vinculo.statecode === 0)
      .map((vinculo) => vinculo._ctmbrasi_language_value?.toLowerCase())
      .filter((id): id is string => Boolean(id))
  );

  for (const idioma of idiomasDesejados) {
    if (idsAtivos.has(idioma.id.toLowerCase())) continue;

    const vinculoInativo = vinculosFuncionario.find(
      (vinculo) =>
        vinculo.statecode === 1 &&
        vinculo._ctmbrasi_language_value?.toLowerCase() ===
          idioma.id.toLowerCase()
    );

    if (vinculoInativo) {
      const resultado = await EmployeeLanguages.update(
        vinculoInativo.ctmbrasi_rhemployeelanguagesid,
        { statecode: 0, statuscode: 1 }
      );

      if (!resultado.success) {
        throw new Error(
          resultado.error?.message ||
          `Não foi possível reativar o idioma ${idioma.nome}.`
        );
      }

      continue;
    }

    const resultado = await EmployeeLanguages.create({
      statecode: 0,
      ctmbrasi_employeelanguagerecord:
        `${funcionario.idFuncionario}-${idioma.nome}`,
      "ctmbrasi_Employee@odata.bind":
        `/ctmbrasi_employeerecordses(${funcionario.recordId})`,
      "ctmbrasi_Language@odata.bind":
        `/ctmbrasi_rhlanguageses(${idioma.id})`,
    });

    if (!resultado.success) {
      throw new Error(
        resultado.error?.message ||
        `Não foi possível associar o idioma ${idioma.nome}.`
      );
    }
  }

  for (const vinculo of vinculosFuncionario) {
    const idiomaId = vinculo._ctmbrasi_language_value?.toLowerCase();
    if (vinculo.statecode !== 0 || !idiomaId || idsDesejados.has(idiomaId)) {
      continue;
    }

    const resultado = await EmployeeLanguages.update(
      vinculo.ctmbrasi_rhemployeelanguagesid,
      { statecode: 1, statuscode: 2 }
    );

    if (!resultado.success) {
      throw new Error(
        resultado.error?.message ||
        `Não foi possível remover o vínculo do idioma ${
          vinculo.ctmbrasi_languagename || idiomaId
        }.`
      );
    }
  }
}

// ==========================================
// SALVAR EDIÇÃO NO DATAVERSE
// ==========================================

export async function salvarEdicaoFuncionario(
  novo: RhEmployee
): Promise<RhEmployee[]> {
  const anterior = funcionariosEmMemoria.find(
    (item) => item.recordId === novo.recordId
  );

  if (!anterior) {
    throw new Error(
      "Funcionário não carregado. Atualize os dados."
    );
  }

  if (!catalogosEmMemoria) {
    throw new Error(
      "Catálogos do Dataverse não carregados."
    );
  }

  if (
    !novo.nome.trim() ||
    !novo.idFuncionario.trim() ||
    !novo.dataAdmissao
  ) {
    throw new Error(
      "Nome, ID funcional e data de admissão são obrigatórios."
    );
  }

  if (
    novo.dataTerminoReal &&
    novo.dataTerminoReal < novo.dataAdmissao
  ) {
    throw new Error(
      "A data de término não pode ser anterior à admissão."
    );
  }

  if (
    funcionariosEmMemoria.some(
      (item) =>
        item.recordId !== novo.recordId &&
        item.idFuncionario.trim().toLowerCase() ===
          novo.idFuncionario.trim().toLowerCase()
    )
  ) {
    throw new Error(
      "Já existe um funcionário com esse ID funcional."
    );
  }

  verificarCamposRelacionados(novo, anterior);

  const normalizarIdiomas = (idiomas: string[]) =>
    [...new Set(
      idiomas
        .map((idioma) => idioma.trim().toLocaleLowerCase("pt-BR"))
        .filter(Boolean)
    )].sort();
  const idiomasAlterados =
    JSON.stringify(normalizarIdiomas(novo.idiomas)) !==
    JSON.stringify(normalizarIdiomas(anterior.idiomas));

  const campos: Partial<Ctmbrasi_employeerecordsesBase> =
    {};

  if (novo.nome !== anterior.nome) {
    campos.ctmbrasi_fullname = novo.nome;
  }

  if (novo.idFuncionario !== anterior.idFuncionario) {
    campos.ctmbrasi_employeeid = novo.idFuncionario;
  }

  if (novo.globalId !== anterior.globalId) {
    campos.ctmbrasi_globalid = novo.globalId ?? "";
  }

  if (novo.genero !== anterior.genero) {
    campos.ctmbrasi_gender = novo.genero;
  }

  if (
    novo.iniciaisFuncionario !==
    anterior.iniciaisFuncionario
  ) {
    campos.ctmbrasi_employeeinitials =
      novo.iniciaisFuncionario ?? "";
  }

  if (novo.emailBYU !== anterior.emailBYU) {
    campos.ctmbrasi_byuemail = novo.emailBYU ?? "";
  }

  if (novo.emailPessoal !== anterior.emailPessoal) {
    campos.ctmbrasi_personalemail =
      novo.emailPessoal ?? "";
  }

  if (
    novo.statusDataverse !== anterior.statusDataverse
  ) {
    if (novo.statusDataverse === undefined) {
      throw new Error("Selecione o status do funcionário.");
    }

    campos.ctmbrasi_employeestatus =
      novo.statusDataverse;
  }

  if (novo.templo !== anterior.templo) {
    campos.ctmbrasi_temple = novo.templo;
  }

  if (novo.statusRegistro !== anterior.statusRegistro) {
    if (novo.statusRegistro === undefined) {
      throw new Error("Selecione o status do registro.");
    }
    campos.statecode = novo.statusRegistro;
    campos.statuscode = novo.statusRegistro === 0 ? 1 : 2;
  }

  if (novo.dataAdmissao !== anterior.dataAdmissao) {
    campos.ctmbrasi_hiredate = novo.dataAdmissao;
  }

  if (novo.dataTerminoReal !== anterior.dataTerminoReal) {
    if (!novo.dataTerminoReal && anterior.dataTerminoReal) {
      throw new Error(
        "A remoção da data de término ainda não está habilitada."
      );
    }

    campos.ctmbrasi_contractenddate =
      novo.dataTerminoReal || undefined;
  }

  if (novo.emailCorporativo !== anterior.emailCorporativo) {
    campos.ctmbrasi_corporateemail =
      novo.emailCorporativo;
  }

  if (novo.linkZoom !== anterior.linkZoom) {
    campos.ctmbrasi_zoomlink = novo.linkZoom;
  }

  // Relacionamento com cargos
  if (novo.cargo !== anterior.cargo) {
    const id = buscarId(
      novo.cargo,
      catalogosEmMemoria.cargos,
      "Cargo"
    );

    if (!id) {
      throw new Error(
        "A remoção de um cargo vinculado exige tratamento adicional."
      );
    }

    campos["ctmbrasi_Position@odata.bind"] =
      `/ctmbrasi_rhpositionses(${id})`;
  }

  // Relacionamento com zonas
  if (novo.zona !== anterior.zona) {
    const id = buscarId(
      novo.zona,
      catalogosEmMemoria.zonas,
      "Zona"
    );

    if (!id) {
      throw new Error(
        "A remoção de uma zona vinculada exige tratamento adicional."
      );
    }

    campos["ctmbrasi_Zone@odata.bind"] =
      `/ctmbrasi_rhzoneses(${id})`;
  }

  // Relacionamento com turnos
  if (novo.turno !== anterior.turno) {
    const id = buscarId(
      novo.turno,
      catalogosEmMemoria.turnos,
      "Turno"
    );

    if (!id) {
      throw new Error(
        "A remoção de um turno vinculado exige tratamento adicional."
      );
    }

    campos["ctmbrasi_ShiftsLookup@odata.bind"] =
      `/ctmbrasi_rhshiftses(${id})`;
  }

  // Somente envia campos realmente alterados.
  if (Object.keys(campos).length > 0) {
    const resposta = await Employees.update(
      novo.recordId,
      campos
    );

    if (!resposta.success) {
      throw new Error(
        resposta.error?.message ||
        "Falha ao salvar funcionário no Dataverse."
      );
    }
  }

  let erroIdiomas: unknown;
  if (idiomasAlterados) {
    try {
      await salvarIdiomasFuncionario(novo, novo.idiomas);
    } catch (error) {
      erroIdiomas = error;
    }
  }

  // Recarrega os registros da fonte oficial.
  const funcionariosAtualizados = await carregarFuncionarios();
  const funcionarioAtualizado = funcionariosAtualizados.find(
    (item) => item.recordId === novo.recordId
  );

  if (!funcionarioAtualizado) {
    throw new Error(
      "Os dados foram enviados ao Dataverse, mas o funcionário não foi encontrado ao atualizar a lista."
    );
  }

  let erroHistorico: unknown;
  try {
    await registrarAlteracoesFuncionario(anterior, funcionarioAtualizado);
  } catch (error) {
    erroHistorico = error;
  }

  if (erroIdiomas || erroHistorico) {
    const mensagens: string[] = [];
    if (erroIdiomas) {
      const detalhe = erroIdiomas instanceof Error ? erroIdiomas.message : String(erroIdiomas);
      mensagens.push(`A alteração de idiomas não foi concluída por completo: ${detalhe}`);
    }
    if (erroHistorico) {
      const detalhe = erroHistorico instanceof Error ? erroHistorico.message : String(erroHistorico);
      mensagens.push(`O histórico não foi registrado corretamente: ${detalhe}`);
    }

    throw new FuncionarioAtualizadoComAvisosError(
      funcionariosAtualizados,
      `O estado atual do funcionário foi recarregado do Dataverse, mas houve um problema. ${mensagens.join(" ")}`
    );
  }

  return funcionariosAtualizados;
}

// ==========================================
// SALVAR FERIAS NO DATAVERSE
// ==========================================


/**
 * PERIODOS DE FERIAS DOS FUNCIONARIOS
 * Microsoft Dataverse - CTM Brasil
 *
 * Cria, atualiza e cancela periodos na tabela relacionada.
 */
const calcularDiasPeriodo = (inicio: string, fim: string): number => {
  const inicioUtc = Date.parse(`${inicio}T00:00:00Z`);
  const fimUtc = Date.parse(`${fim}T00:00:00Z`);
  if (!Number.isFinite(inicioUtc) || !Number.isFinite(fimUtc) || fimUtc < inicioUtc) {
    return 0;
  }
  return Math.floor((fimUtc - inicioUtc) / 86_400_000) + 1;
};

const statusDoPeriodo = (
  inicio: string,
  fim: string,
): NonNullable<Ctmbrasi_rhvacationperiodsesBase["ctmbrasi_vacationstatus"]> => {
  const hoje = getToday();
  if (fim < hoje) return 583150004;
  if (inicio <= hoje) return 583150003;
  return 583150000;
};

export async function salvarFeriasFuncionario(
  novo: RhEmployee,
): Promise<RhEmployee[]> {
  const anterior = funcionariosEmMemoria.find(
    (item) => item.recordId === novo.recordId,
  );

  if (!anterior) {
    throw new Error("Funcion\u00e1rio n\u00e3o carregado. Atualize os dados e tente novamente.");
  }

  const periodos = novo.periodosFerias.map((periodo) => ({
    ...periodo,
    dataInicio: periodo.dataInicio.trim(),
    dataFim: periodo.dataFim.trim(),
    dias: calcularDiasPeriodo(periodo.dataInicio, periodo.dataFim),
  }));

  if (periodos.some((periodo) => !periodo.dataInicio || !periodo.dataFim || periodo.dias <= 0)) {
    throw new Error("Revise as datas dos per\u00edodos de f\u00e9rias antes de salvar.");
  }

  const ordenados = [...periodos].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));
  if (ordenados.some((periodo, indice) =>
    indice > 0 && periodo.dataInicio <= ordenados[indice - 1].dataFim
  )) {
    throw new Error("Os per\u00edodos de f\u00e9rias da mesma pessoa n\u00e3o podem se sobrepor.");
  }

  const diasVendidos = novo.feriasVendidas ? novo.diasVendidosFerias : 0;
  const totalDias = periodos.reduce((total, periodo) => total + periodo.dias, 0);
  if (diasVendidos < 0 || diasVendidos > 10) {
    throw new Error("O abono pecuni\u00e1rio deve ter entre 0 e 10 dias.");
  }
  if (diasVendidos > 0 && periodos.length === 0) {
    throw new Error("Adicione um per\u00edodo de f\u00e9rias antes de informar dias vendidos.");
  }
  if (totalDias + diasVendidos > 30) {
    throw new Error("A soma dos dias de gozo e dos dias vendidos n\u00e3o pode ultrapassar 30 dias.");
  }

  const idsAnteriores = new Set(
    anterior.periodosFerias
      .map((periodo) => periodo.recordId)
      .filter((id): id is string => Boolean(id)),
  );
  for (const periodo of periodos) {
    if (periodo.recordId && !idsAnteriores.has(periodo.recordId)) {
      throw new Error("Um dos per\u00edodos de f\u00e9rias n\u00e3o pertence a este funcion\u00e1rio.");
    }
  }

  const idsMantidos = new Set<string>();
  for (const [indice, periodo] of periodos.entries()) {
    const diasVendidosNoPeriodo = indice === 0 ? diasVendidos : 0;
    const campos: Partial<Omit<Ctmbrasi_rhvacationperiodsesBase, "ctmbrasi_rhvacationperiodsid">> = {
      ctmbrasi_vacationperiodname:
        `${novo.idFuncionario} - ${periodo.dataInicio} a ${periodo.dataFim}`,
      ctmbrasi_startdate: periodo.dataInicio,
      ctmbrasi_enddate: periodo.dataFim,
      ctmbrasi_totaldays: periodo.dias,
      ctmbrasi_dayssold: diasVendidosNoPeriodo,
      ctmbrasi_vacationtype: diasVendidosNoPeriodo > 0 ? 583150001 : 583150000,
      ctmbrasi_vacationstatus: statusDoPeriodo(periodo.dataInicio, periodo.dataFim),
      statecode: 0,
      statuscode: 1,
    };

    if (periodo.recordId) {
      const resultado = await Vacations.update(periodo.recordId, campos);
      if (!resultado.success) {
        throw new Error(
          resultado.error?.message || "N\u00e3o foi poss\u00edvel atualizar um per\u00edodo de f\u00e9rias.",
        );
      }
      idsMantidos.add(periodo.recordId);
      continue;
    }

    const resultado = await Vacations.create({
      ...campos,
      statecode: 0,
      "ctmbrasi_Employee@odata.bind":
        `/ctmbrasi_employeerecordses(${novo.recordId})`,
    } as Omit<Ctmbrasi_rhvacationperiodsesBase, "ctmbrasi_rhvacationperiodsid">);

    if (!resultado.success) {
      throw new Error(
        resultado.error?.message || "N\u00e3o foi poss\u00edvel criar um per\u00edodo de f\u00e9rias.",
      );
    }
  }

  // Periodos removidos da ficha ficam cancelados para preservar o historico.
  for (const id of idsAnteriores) {
    if (idsMantidos.has(id)) continue;
    const resultado = await Vacations.update(id, {
      ctmbrasi_vacationstatus: 583150005,
    });
    if (!resultado.success) {
      throw new Error(
        resultado.error?.message || "N\u00e3o foi poss\u00edvel cancelar um per\u00edodo removido.",
      );
    }
  }

  const funcionariosAtualizados = await carregarFuncionarios();
  const funcionarioAtualizado = funcionariosAtualizados.find(
    (item) => item.recordId === novo.recordId,
  );

  if (!funcionarioAtualizado) {
    throw new Error(
      "As f\u00e9rias foram enviadas ao Dataverse, mas o funcion\u00e1rio n\u00e3o foi encontrado na atualiza\u00e7\u00e3o.",
    );
  }

  try {
    await registrarAlteracoesFuncionario(anterior, funcionarioAtualizado);
  } catch (error) {
    const detalhe = error instanceof Error ? error.message : String(error);
    throw new FuncionarioAtualizadoComAvisosError(
      funcionariosAtualizados,
      `As f\u00e9rias foram salvas, mas o hist\u00f3rico n\u00e3o foi registrado corretamente: ${detalhe}`,
    );
  }

  return funcionariosAtualizados;
}

// ==========================================
// NOVO FUNCIONARIO
// ==========================================

/**
 * CADASTRO DE NOVOS FUNCIONARIOS
 * Microsoft Dataverse - CTM Brasil
 *
 * Cria o funcionario e associa seus idiomas.
 * Nao utiliza localStorage ou registros ficticios.
 */
async function criarFuncionarioNoDataverse(
  dados: RhEmployee
): Promise<string> {

  // ========================================
  // 1. VALIDAR INFORMAÇÕES
  // ========================================

  if (!catalogosEmMemoria) {
    throw new Error(
      "Os catálogos do Dataverse ainda não foram carregados. " +
      "Atualize o sistema e tente novamente."
    );
  }

  const nome = dados.nome.trim();
  const idFuncionario = dados.idFuncionario.trim();
  const dataAdmissao = dados.dataAdmissao;

  if (!nome) {
    throw new Error("Informe o nome do funcionário.");
  }

  if (!idFuncionario) {
    throw new Error("Informe o ID funcional.");
  }

  if (!dataAdmissao) {
    throw new Error("Informe a data de admissão.");
  }

  if (
    dados.dataTerminoReal &&
    dados.dataTerminoReal < dataAdmissao
  ) {
    throw new Error(
      "A data de término não pode ser anterior à admissão."
    );
  }

  if (dados.statusDataverse === undefined) {
    throw new Error("Selecione o status do funcionário.");
  }

  if (dados.statusRegistro === undefined) {
    throw new Error("Selecione o status do registro.");
  }

  // Verificar duplicidade nos registros carregados.
  const duplicado = funcionariosEmMemoria.some(
    (funcionario) =>
      funcionario.idFuncionario.trim().toLowerCase() ===
      idFuncionario.toLowerCase()
  );

  if (duplicado) {
    throw new Error(
      "Já existe um funcionário com esse ID funcional."
    );
  }

  // A criação de férias pertence à tabela de férias.
  if (
    dados.periodosFerias.length > 0 ||
    dados.diasVendidosFerias > 0
  ) {
    throw new Error(
      "Cadastre primeiro o funcionário sem períodos de férias. " +
      "O cadastro de férias será conectado separadamente."
    );
  }

  // ========================================
  // 2. IDENTIFICAR RELACIONAMENTOS
  // ========================================

  const cargoId = buscarId(
    dados.cargo,
    catalogosEmMemoria.cargos,
    "Cargo"
  );

  const zonaId = buscarId(
    dados.zona,
    catalogosEmMemoria.zonas,
    "Zona"
  );

  const turnoId = buscarId(
    dados.turno,
    catalogosEmMemoria.turnos,
    "Turno"
  );

  // Validar todos os idiomas antes de criar.
  const idiomas = [
    ...new Set(
      dados.idiomas
        .map((idioma) => idioma.trim())
        .filter(Boolean)
    ),
  ];

  const idiomasValidados = idiomas.map((idioma) => {
    const id = buscarId(
      idioma,
      catalogosEmMemoria!.idiomas,
      "Idioma"
    );

    if (!id) {
      throw new Error(
        `Não foi possível encontrar o idioma ${idioma}.`
      );
    }

    return { nome: idioma, id };
  });

  // ========================================
  // 3. PREPARAR REGISTRO DATAVERSE
  // ========================================

  const novoFuncionario: Parameters<
    typeof Employees.create
  >[0] = {
    statecode: dados.statusRegistro,
    statuscode: dados.statusRegistro === 0 ? 1 : 2,

    ctmbrasi_employeeid: idFuncionario,

    ctmbrasi_fullname: nome,

    ctmbrasi_hiredate: dataAdmissao,

    ctmbrasi_employeestatus: dados.statusDataverse,

    ctmbrasi_corporateemail:
      dados.emailCorporativo.trim(),

    ctmbrasi_zoomlink:
      dados.linkZoom.trim(),
  };

  if (dados.globalId?.trim()) {
    novoFuncionario.ctmbrasi_globalid = dados.globalId.trim();
  }

  if (dados.genero !== undefined) {
    novoFuncionario.ctmbrasi_gender = dados.genero;
  }

  if (dados.iniciaisFuncionario?.trim()) {
    novoFuncionario.ctmbrasi_employeeinitials =
      dados.iniciaisFuncionario.trim();
  }

  if (dados.emailBYU?.trim()) {
    novoFuncionario.ctmbrasi_byuemail = dados.emailBYU.trim();
  }

  if (dados.emailPessoal?.trim()) {
    novoFuncionario.ctmbrasi_personalemail =
      dados.emailPessoal.trim();
  }

  if (dados.templo !== undefined) {
    novoFuncionario.ctmbrasi_temple = dados.templo;
  }

  if (dados.dataTerminoReal) {
    novoFuncionario.ctmbrasi_contractenddate =
      dados.dataTerminoReal;
  }

  // Cargo
  if (cargoId) {
    novoFuncionario["ctmbrasi_Position@odata.bind"] =
      `/ctmbrasi_rhpositionses(${cargoId})`;
  }

  // Zona
  if (zonaId) {
    novoFuncionario["ctmbrasi_Zone@odata.bind"] =
      `/ctmbrasi_rhzoneses(${zonaId})`;
  }

  // Turno
  if (turnoId) {
    novoFuncionario["ctmbrasi_ShiftsLookup@odata.bind"] =
      `/ctmbrasi_rhshiftses(${turnoId})`;
  }

  // ========================================
  // 4. CRIAR FUNCIONÁRIO NO DATAVERSE
  // ========================================

  const resultado = await Employees.create(
    novoFuncionario
  );

  if (!resultado.success) {
    throw new Error(
      resultado.error?.message ||
      "Não foi possível criar o funcionário no Dataverse."
    );
  }

  const novoId =
    resultado.data?.ctmbrasi_employeerecordsid;

  if (!novoId) {
    throw new Error(
      "A operação de criação foi enviada, mas o Dataverse " +
      "não retornou o ID do registro. Consulte a tabela " +
      "antes de tentar cadastrar novamente."
    );
  }

  // ========================================
  // 5. ASSOCIAR IDIOMAS AO FUNCIONÁRIO
  // ========================================

  try {
    for (const idioma of idiomasValidados) {
      const resultadoIdioma =
        await EmployeeLanguages.create({
          statecode: 0,

          ctmbrasi_employeelanguagerecord:
            `${idFuncionario}-${idioma.nome}`,

          "ctmbrasi_Employee@odata.bind":
            `/ctmbrasi_employeerecordses(${novoId})`,

          "ctmbrasi_Language@odata.bind":
            `/ctmbrasi_rhlanguageses(${idioma.id})`,
        });

      if (!resultadoIdioma.success) {
        throw new Error(
          resultadoIdioma.error?.message ||
          `Falha ao associar ${idioma.nome}.`
        );
      }
    }
  } catch (erro) {
    console.error(
      "Funcionário criado, mas houve erro nos idiomas:",
      erro
    );

    throw new Error(
      `O funcionário ${nome} foi criado no Dataverse ` +
      `(ID: ${novoId}), mas houve falha ao associar ` +
      "um ou mais idiomas. Não cadastre novamente. " +
      "Atualize a página e corrija os vínculos."
    );
  }

  return novoId;
}

export interface EmployeeImportRow {
  rowNumber: number;
  employee: RhEmployee;
}

export interface EmployeeImportFailure {
  rowNumber: number;
  employeeName: string;
  employeeId: string;
  message: string;
}

export interface EmployeeImportResult {
  created: number;
  imported: number;
  failures: EmployeeImportFailure[];
  employees?: RhEmployee[];
  refreshError?: string;
}

export async function importarFuncionarios(
  rows: EmployeeImportRow[],
  onProgress?: (completed: number, total: number) => void
): Promise<EmployeeImportResult> {
  if (!catalogosEmMemoria) {
    throw new Error(
      "Os catálogos do Dataverse ainda não foram carregados. " +
      "Atualize os dados e tente novamente."
    );
  }

  const knownIds = new Set(
    funcionariosEmMemoria
      .map((employee) => employee.idFuncionario.trim().toLocaleLowerCase("pt-BR"))
      .filter(Boolean)
  );
  const failures: EmployeeImportFailure[] = [];
  let created = 0;
  let imported = 0;

  for (const [index, row] of rows.entries()) {
    const employeeId = row.employee.idFuncionario.trim();
    const normalizedId = employeeId.toLocaleLowerCase("pt-BR");

    if (knownIds.has(normalizedId)) {
      failures.push({
        rowNumber: row.rowNumber,
        employeeName: row.employee.nome,
        employeeId,
        message:
          "ID já existe no sistema ou está repetido em outra linha do arquivo.",
      });
      onProgress?.(index + 1, rows.length);
      continue;
    }

    knownIds.add(normalizedId);

    try {
      await criarFuncionarioNoDataverse(row.employee);
      created += 1;
      imported += 1;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Erro inesperado ao criar o funcionário.";
      if (message.includes("foi criado no Dataverse")) {
        created += 1;
      }
      failures.push({
        rowNumber: row.rowNumber,
        employeeName: row.employee.nome,
        employeeId,
        message,
      });
    }
    onProgress?.(index + 1, rows.length);
  }

  if (created === 0) {
    return { created, imported, failures };
  }

  try {
    const employees = await carregarFuncionarios();
    return { created, imported, failures, employees };
  } catch (error) {
    const refreshError =
      error instanceof Error
        ? error.message
        : "Não foi possível atualizar a lista após a importação.";
    console.error(
      "Funcionários importados, mas falha ao recarregar a lista:",
      error
    );
    return { created, imported, failures, refreshError };
  }
}

export async function criarFuncionario(
  dados: RhEmployee
): Promise<RhEmployee[]> {
  const novoId = await criarFuncionarioNoDataverse(dados);

  try {
    const funcionariosAtualizados = await carregarFuncionarios();
    console.info("Funcionário cadastrado no Dataverse:", novoId);
    return funcionariosAtualizados;
  } catch (erro) {
    console.error(
      "Funcionário criado, mas falha ao atualizar a lista:",
      erro
    );

    throw new Error(
      `O funcionário foi criado no Dataverse (ID: ${novoId}), ` +
      "mas não foi possível atualizar a lista. Não repita o cadastro. " +
      "Atualize os dados."
    );
  }
}
