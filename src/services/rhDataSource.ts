
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

// ==========================================
// CACHE TEMPORÁRIO DA SESSÃO
// ==========================================

let funcionariosEmMemoria: RhEmployee[] = [];
let catalogosEmMemoria: CatalogosRH | null = null;

const formatarData = (valor?: string | null) =>
  (valor || "").slice(0, 10);

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

  const hoje = new Date().toISOString().slice(0, 10);

  // ========================================
  // CONVERTER REGISTROS PARA A INTERFACE
  // ========================================

  const registrosConvertidos = funcionarios.map(
    (funcionario): RhEmployee => {
      const id = funcionario.ctmbrasi_employeerecordsid;

      const feriasFuncionario = ferias.filter(
        (item) => item._ctmbrasi_employee_value === id
      );

      const periodosAtivos = feriasFuncionario.filter(
        (item) => item.ctmbrasi_vacationstatus !== 583150005
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

        cargo:
          mapaCargos.get(
            funcionario._ctmbrasi_position_value || ""
          ) ||
          funcionario.ctmbrasi_positionname ||
          "",

        zona:
          mapaZonas.get(
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

        dataTerminoReal:
          formatarData(
            funcionario.ctmbrasi_contractenddate ||
            funcionario.ctmbrasi_terminationdate
          ),

        statusFuncionario:
          funcionario.ctmbrasi_employeestatus === 583150003 ||
          funcionario.ctmbrasi_employeestatus === 583150004
            ? "Encerrado"
            : "Ativo",

        idiomas: [
          ...new Set(
            vinculos
              .filter(
                (item) =>
                  item._ctmbrasi_employee_value === id
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
    "idiomas",
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

  if (
    novo.statusFuncionario !==
    anterior.statusFuncionario
  ) {
    throw new Error(
      "A alteração de status será habilitada em outra etapa."
    );
  }

  const campos: Partial<Ctmbrasi_employeerecordsesBase> =
    {};

  if (novo.nome !== anterior.nome) {
    campos.ctmbrasi_fullname = novo.nome;
  }

  if (novo.idFuncionario !== anterior.idFuncionario) {
    campos.ctmbrasi_employeeid = novo.idFuncionario;
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

  // Recarrega os registros da fonte oficial.
  return carregarFuncionarios();
}

// ==========================================
// NOVO FUNCIONÁRIO
// ==========================================


/**
 * CADASTRO DE NOVOS FUNCIONÁRIOS
 * Microsoft Dataverse - CTM Brasil
 *
 * Cria o funcionário e associa seus idiomas.
 * Não utiliza localStorage ou registros fictícios.
 */
export async function criarFuncionario(
  dados: RhEmployee
): Promise<RhEmployee[]> {

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

  // A tabela possui opções próprias para status.
  // "A começar" ainda não tem correspondência exata.
  if (
    dados.statusFuncionario !== "Ativo" &&
    dados.statusFuncionario !== "Encerrado"
  ) {
    throw new Error(
      "Selecione Ativo ou Encerrado. O status 'A começar' " +
      "ainda precisa de uma regra própria no Dataverse."
    );
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
    statecode: 0,

    ctmbrasi_employeeid: idFuncionario,

    ctmbrasi_fullname: nome,

    ctmbrasi_hiredate: dataAdmissao,

    ctmbrasi_employeestatus:
      dados.statusFuncionario === "Encerrado"
        ? 583150004
        : 583150000,

    ctmbrasi_corporateemail:
      dados.emailCorporativo.trim(),

    ctmbrasi_zoomlink:
      dados.linkZoom.trim(),
  };

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

  // ========================================
  // 6. ATUALIZAR A INTERFACE
  // ========================================

  try {
    const funcionariosAtualizados =
      await carregarFuncionarios();

    console.info(
      "Funcionário cadastrado no Dataverse:",
      novoId
    );

    return funcionariosAtualizados;

  } catch (erro) {
    console.error(
      "Funcionário criado, mas falha ao atualizar a lista:",
      erro
    );

    throw new Error(
      `O funcionário ${nome} foi criado no Dataverse ` +
      `(ID: ${novoId}), mas não foi possível atualizar ` +
      "a lista. Não repita o cadastro. Atualize os dados."
    );
  }
}

