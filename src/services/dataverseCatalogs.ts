
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
    listarIdiomasDataverse(),
  ]);

  return {
    cargos,
    zonas,
    turnos,
    idiomas,
  };
}
