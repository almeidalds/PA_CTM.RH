
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CTM Brasil - Recursos Humanos
 * Catálogos corporativos do Microsoft Dataverse.
 *
 * Tabelas:
 * - Cargos
 * - Zonas
 * - Turnos
 * - Idiomas
 *
 * Nenhum dado é armazenado localmente.
 */

import type {
  IGetAllOptions,
} from "../generated/models/CommonModels";

import {
  Ctmbrasi_rhpositionsesService,
} from "../generated/services/Ctmbrasi_rhpositionsesService";

import {
  Ctmbrasi_rhzonesesService,
} from "../generated/services/Ctmbrasi_rhzonesesService";

import {
  Ctmbrasi_rhshiftsesService,
} from "../generated/services/Ctmbrasi_rhshiftsesService";

import {
  Ctmbrasi_rhlanguagesesService,
} from "../generated/services/Ctmbrasi_rhlanguagesesService";

import type {
  Ctmbrasi_rhpositionses,
} from "../generated/models/Ctmbrasi_rhpositionsesModel";

import type {
  Ctmbrasi_rhzoneses,
} from "../generated/models/Ctmbrasi_rhzonesesModel";

import type {
  Ctmbrasi_rhshiftses,
} from "../generated/models/Ctmbrasi_rhshiftsesModel";
import type {
  Ctmbrasi_rhshiftsesBase,
} from "../generated/models/Ctmbrasi_rhshiftsesModel";

import type {
  Ctmbrasi_rhlanguageses,
} from "../generated/models/Ctmbrasi_rhlanguagesesModel";

// ==========================================
// INTERFACES
// ==========================================

export interface CatalogoItem {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
}

export interface TurnoItem extends CatalogoItem {
  horarioInicio: string;
  horarioFim: string;
  turnoTemplo: boolean;
}

export interface CatalogosRH {
  cargos: CatalogoItem[];
  zonas: CatalogoItem[];
  turnos: TurnoItem[];
  idiomas: CatalogoItem[];
}

export type CatalogSettings = Pick<
  import("../types/rh").AppSettings,
  "idiomas" | "cargos" | "zonas"
>;

// ==========================================
// PAGINAÇÃO DATAVERSE
// ==========================================

interface ResultadoPagina<T> {
  success: boolean;
  data?: T[];
  error?: { message?: string };
  skipToken?: string;
}

type LeitorDataverse<T> = (
  options?: IGetAllOptions
) => Promise<ResultadoPagina<T>>;

async function buscarTodasPaginas<T>(
  nomeTabela: string,
  leitor: LeitorDataverse<T>,
  colunas: string[]
): Promise<T[]> {
  const registros: T[] = [];
  const tokensUtilizados = new Set<string>();

  let skipToken: string | undefined;

  do {
    const resultado = await leitor({
      select: colunas,
      maxPageSize: 500,
      ...(skipToken ? { skipToken } : {}),
    });

    if (
      !resultado.success ||
      !Array.isArray(resultado.data)
    ) {
      throw new Error(
        `Erro ao consultar ${nomeTabela}: ${
          resultado.error?.message ||
          "Verifique a conexão e as permissões do Dataverse."
        }`
      );
    }

    registros.push(...resultado.data);

    skipToken = resultado.skipToken || undefined;

    if (skipToken) {
      if (tokensUtilizados.has(skipToken)) {
        throw new Error(
          `Paginação repetida na tabela ${nomeTabela}.`
        );
      }

      tokensUtilizados.add(skipToken);
    }

    if (registros.length > 100000) {
      throw new Error(
        `Limite de segurança excedido: ${nomeTabela}.`
      );
    }
  } while (skipToken);

  return registros;
}

// ==========================================
// CARGOS
// ==========================================

export async function listarCargosDataverse():
  Promise<CatalogoItem[]> {

  const registros =
    await buscarTodasPaginas<Ctmbrasi_rhpositionses>(
      "Cargos",
      (options) =>
        Ctmbrasi_rhpositionsesService.getAll(options),
      [
        "ctmbrasi_rhpositionsid",
        "ctmbrasi_positioncode",
        "ctmbrasi_positionname",
        "ctmbrasi_active",
        "statecode",
      ]
    );

  return registros.map((registro) => ({
    id: registro.ctmbrasi_rhpositionsid,
    codigo: registro.ctmbrasi_positioncode || "",
    nome: registro.ctmbrasi_positionname || "",
    ativo:
      registro.statecode === 0 &&
      registro.ctmbrasi_active !== false,
  }));
}

// ==========================================
// ZONAS
// ==========================================

export async function listarZonasDataverse():
  Promise<CatalogoItem[]> {

  const registros =
    await buscarTodasPaginas<Ctmbrasi_rhzoneses>(
      "Zonas",
      (options) =>
        Ctmbrasi_rhzonesesService.getAll(options),
      [
        "ctmbrasi_rhzonesid",
        "ctmbrasi_zonecode",
        "ctmbrasi_zonename",
        "ctmbrasi_active",
        "statecode",
      ]
    );

  return registros.map((registro) => ({
    id: registro.ctmbrasi_rhzonesid,
    codigo: registro.ctmbrasi_zonecode || "",
    nome: registro.ctmbrasi_zonename || "",
    ativo:
      registro.statecode === 0 &&
      registro.ctmbrasi_active !== false,
  }));
}

// ==========================================
// TURNOS
// ==========================================

export async function listarTurnosDataverse():
  Promise<TurnoItem[]> {

  const registros =
    await buscarTodasPaginas<Ctmbrasi_rhshiftses>(
      "Turnos",
      (options) =>
        Ctmbrasi_rhshiftsesService.getAll(options),
      [
        "ctmbrasi_rhshiftsid",
        "ctmbrasi_shiftcode",
        "ctmbrasi_shiftname",
        "ctmbrasi_starttime",
        "ctmbrasi_endtime",
        "ctmbrasi_templeshift",
        "ctmbrasi_active",
        "statecode",
      ]
    );

  return registros.map((registro) => ({
    id: registro.ctmbrasi_rhshiftsid,
    codigo: registro.ctmbrasi_shiftcode || "",
    nome: registro.ctmbrasi_shiftname || "",
    horarioInicio: registro.ctmbrasi_starttime || "",
    horarioFim: registro.ctmbrasi_endtime || "",
    turnoTemplo:
      registro.ctmbrasi_templeshift === true,
    ativo:
      registro.statecode === 0 &&
      registro.ctmbrasi_active !== false,
  }));
}

export async function salvarTurnosDataverse(
  turnos: TurnoItem[],
): Promise<TurnoItem[]> {
  const nomes = new Set<string>();
  const codigos = new Set<string>();

  for (const turno of turnos) {
    const nome = turno.nome.trim();
    const codigo = turno.codigo.trim();
    if (!nome || !codigo) {
      throw new Error("Informe o nome e o código de todos os turnos.");
    }

    const nomeNormalizado = nome.toLocaleLowerCase("pt-BR");
    const codigoNormalizado = codigo.toLocaleLowerCase("pt-BR");
    if (nomes.has(nomeNormalizado) || codigos.has(codigoNormalizado)) {
      throw new Error("Os nomes e códigos dos turnos devem ser únicos.");
    }
    nomes.add(nomeNormalizado);
    codigos.add(codigoNormalizado);
  }

  const turnosAtuais = await listarTurnosDataverse();
  const atuaisPorId = new Map(turnosAtuais.map((turno) => [turno.id, turno]));

  for (const turno of turnos) {
    const campos: Partial<Ctmbrasi_rhshiftsesBase> = {};
    const atual = turno.id ? atuaisPorId.get(turno.id) : undefined;
    const codigo = turno.codigo.trim();
    const nome = turno.nome.trim();
    const horarioInicio = turno.horarioInicio.trim();
    const horarioFim = turno.horarioFim.trim();

    if (!turno.id || atual?.codigo !== codigo) {
      campos.ctmbrasi_shiftcode = codigo;
    }
    if (!turno.id || atual?.nome !== nome) {
      campos.ctmbrasi_shiftname = nome;
    }
    if (!turno.id || atual?.horarioInicio !== horarioInicio) {
      campos.ctmbrasi_starttime = horarioInicio;
    }
    if (!turno.id || atual?.horarioFim !== horarioFim) {
      campos.ctmbrasi_endtime = horarioFim;
    }
    if (!turno.id || atual?.turnoTemplo !== turno.turnoTemplo) {
      campos.ctmbrasi_templeshift = turno.turnoTemplo;
    }
    if (!turno.id || atual?.ativo !== turno.ativo) {
      campos.ctmbrasi_active = turno.ativo;
      campos.statecode = turno.ativo ? 0 : 1;
      campos.statuscode = turno.ativo ? 1 : 2;
    }

    if (turno.id && Object.keys(campos).length === 0) continue;

    const result = turno.id
      ? await Ctmbrasi_rhshiftsesService.update(turno.id, campos)
      : await Ctmbrasi_rhshiftsesService.create({
          ctmbrasi_shiftcode: codigo,
          ctmbrasi_shiftname: nome,
          ctmbrasi_starttime: horarioInicio,
          ctmbrasi_endtime: horarioFim,
          ctmbrasi_templeshift: turno.turnoTemplo,
          ctmbrasi_active: turno.ativo,
          statecode: turno.ativo ? 0 : 1,
          statuscode: turno.ativo ? 1 : 2,
        });

    if (!result.success) {
      throw new Error(
        `Não foi possível salvar o turno "${turno.nome}": ${
          result.error?.message || "erro retornado pelo Dataverse."
        }`,
      );
    }
  }

  return listarTurnosDataverse();
}

// ==========================================
// IDIOMAS
// ==========================================

export async function listarIdiomasDataverse():
  Promise<CatalogoItem[]> {

  const registros =
    await buscarTodasPaginas<Ctmbrasi_rhlanguageses>(
      "Idiomas",
      (options) =>
        Ctmbrasi_rhlanguagesesService.getAll(options),
      [
        "ctmbrasi_rhlanguagesid",
        "ctmbrasi_languagecode",
        "ctmbrasi_languagename",
        "ctmbrasi_active",
        "statecode",
      ]
    );

  return registros.map((registro) => ({
    id: registro.ctmbrasi_rhlanguagesid,
    codigo: registro.ctmbrasi_languagecode || "",
    nome: registro.ctmbrasi_languagename || "",
    ativo:
      registro.statecode === 0 &&
      registro.ctmbrasi_active !== false,
  }));
}

// ==========================================
// CARREGAR TODOS OS CATÁLOGOS
// ==========================================

export async function carregarCatalogosDataverse():
  Promise<CatalogosRH> {

  const [
    cargos,
    zonas,
    turnos,
    idiomas,
  ] = await Promise.all([
    listarCargosDataverse(),
    listarZonasDataverse(),
    listarTurnosDataverse(),
    garantirIdiomaPortuguesDataverse(),
  ]);

  return {
    cargos,
    zonas,
    turnos,
    idiomas,
  };
}

interface CatalogMutationResult {
  success: boolean;
  error?: { message?: string };
}

const normalizarCatalogo = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");

function gerarCodigoCatalogo(nome: string, usados: Set<string>) {
  const slug = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "ITEM";
  const base = `AUTO-${slug}`;
  let codigo = base;
  let sufixo = 2;
  while (usados.has(normalizarCatalogo(codigo))) {
    codigo = `${base.slice(0, 48 - String(sufixo).length)}-${sufixo}`;
    sufixo += 1;
  }
  usados.add(normalizarCatalogo(codigo));
  return codigo;
}

let idiomaPortuguesEmGarantia: Promise<CatalogoItem[]> | null = null;

async function garantirIdiomaPortuguesDataverse(): Promise<CatalogoItem[]> {
  if (idiomaPortuguesEmGarantia) return idiomaPortuguesEmGarantia;

  idiomaPortuguesEmGarantia = (async () => {
    const idiomas = await listarIdiomasDataverse();
    const portugues = idiomas.find(
      (idioma) => normalizarCatalogo(idioma.nome) === normalizarCatalogo("Português"),
    );

    if (portugues?.ativo) return idiomas;

    const resultado = portugues
      ? await Ctmbrasi_rhlanguagesesService.update(portugues.id, {
          ctmbrasi_active: true,
          statecode: 0,
          statuscode: 1,
        })
      : await Ctmbrasi_rhlanguagesesService.create({
          ctmbrasi_languagecode: gerarCodigoCatalogo(
            "Português",
            new Set(idiomas.map((idioma) => normalizarCatalogo(idioma.codigo))),
          ),
          ctmbrasi_languagename: "Português",
          ctmbrasi_active: true,
          statecode: 0,
          statuscode: 1,
        });

    if (!resultado.success) {
      throw new Error(
        `Não foi possível disponibilizar Português no catálogo: ${
          resultado.error?.message || "erro retornado pelo Dataverse."
        }`,
      );
    }

    return listarIdiomasDataverse();
  })().finally(() => {
    idiomaPortuguesEmGarantia = null;
  });

  return idiomaPortuguesEmGarantia;
}

async function sincronizarCatalogo(
  tabela: string,
  atual: CatalogoItem[],
  desejados: string[],
  criar: (nome: string, codigo: string) => Promise<CatalogMutationResult>,
  atualizar: (
    item: CatalogoItem,
    ativo: boolean,
  ) => Promise<CatalogMutationResult>,
): Promise<void> {
  const nomes = new Set<string>();
  for (const rawName of desejados) {
    const nome = rawName.trim();
    const normalizado = normalizarCatalogo(nome);
    if (!normalizado) {
      throw new Error(`Há um item sem nome na lista de ${tabela}.`);
    }
    if (nomes.has(normalizado)) {
      throw new Error(`Há nomes repetidos na lista de ${tabela}: "${nome}".`);
    }
    nomes.add(normalizado);
  }

  const porNome = new Map<string, CatalogoItem>();
  for (const item of atual) {
    const normalizado = normalizarCatalogo(item.nome);
    if (normalizado && !porNome.has(normalizado)) {
      porNome.set(normalizado, item);
    }
  }
  const mantidos = new Set<string>();
  const codigosUsados = new Set(
    atual.map((item) => normalizarCatalogo(item.codigo)).filter(Boolean),
  );

  const executar = async (
    nome: string,
    operacao: Promise<CatalogMutationResult>,
  ) => {
    const resultado = await operacao;
    if (!resultado.success) {
      throw new Error(
        `Não foi possível salvar ${tabela} "${nome}": ${
          resultado.error?.message || "erro retornado pelo Dataverse."
        }`,
      );
    }
  };

  for (const rawName of desejados) {
    const nome = rawName.trim();
    const existente = porNome.get(normalizarCatalogo(nome));
    if (existente) {
      mantidos.add(existente.id);
      if (!existente.ativo) {
        await executar(nome, atualizar(existente, true));
      }
    } else {
      const codigo = gerarCodigoCatalogo(nome, codigosUsados);
      await executar(nome, criar(nome, codigo));
    }
  }

  for (const item of atual) {
    if (item.ativo && !mantidos.has(item.id)) {
      await executar(item.nome, atualizar(item, false));
    }
  }
}

export async function salvarCatalogosDataverse(
  settings: CatalogSettings,
): Promise<CatalogosRH> {
  const [idiomas, cargos, zonas] = await Promise.all([
    listarIdiomasDataverse(),
    listarCargosDataverse(),
    listarZonasDataverse(),
  ]);

  try {
    await sincronizarCatalogo(
      "idiomas",
      idiomas,
      settings.idiomas,
      (nome, codigo) =>
        Ctmbrasi_rhlanguagesesService.create({
          ctmbrasi_languagecode: codigo,
          ctmbrasi_languagename: nome,
          ctmbrasi_active: true,
          statecode: 0,
          statuscode: 1,
        }),
      (item, ativo) =>
        Ctmbrasi_rhlanguagesesService.update(item.id, {
          ctmbrasi_active: ativo,
          statecode: ativo ? 0 : 1,
          statuscode: ativo ? 1 : 2,
        }),
    );

    await sincronizarCatalogo(
      "cargos",
      cargos,
      settings.cargos,
      (nome, codigo) =>
        Ctmbrasi_rhpositionsesService.create({
          ctmbrasi_positioncode: codigo,
          ctmbrasi_positionname: nome,
          ctmbrasi_active: true,
          statecode: 0,
          statuscode: 1,
        }),
      (item, ativo) =>
        Ctmbrasi_rhpositionsesService.update(item.id, {
          ctmbrasi_active: ativo,
          statecode: ativo ? 0 : 1,
          statuscode: ativo ? 1 : 2,
        }),
    );

    await sincronizarCatalogo(
      "zonas",
      zonas,
      settings.zonas,
      (nome, codigo) =>
        Ctmbrasi_rhzonesesService.create({
          ctmbrasi_zonecode: codigo,
          ctmbrasi_zonename: nome,
          ctmbrasi_active: true,
          statecode: 0,
          statuscode: 1,
        }),
      (item, ativo) =>
        Ctmbrasi_rhzonesesService.update(item.id, {
          ctmbrasi_active: ativo,
          statecode: ativo ? 0 : 1,
          statuscode: ativo ? 1 : 2,
        }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro inesperado.";
    throw new Error(
      `${message} Algumas alterações anteriores podem já ter sido gravadas; ` +
      "tente salvar novamente para sincronizar as listas.",
    );
  }

  return carregarCatalogosDataverse();
}
