
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CTM Brasil - RH
 * Integração de funcionários com Microsoft Dataverse.
 *
 * Fonte oficial:
 * ctmbrasi_employeerecordses
 *
 * Não utiliza localStorage nem dados fictícios.
 */

import {
Ctmbrasi_employeerecordsesService,
} from "../generated/services/Ctmbrasi_employeerecordsesService";

import type {
Ctmbrasi_employeerecordses,
} from "../generated/models/Ctmbrasi_employeerecordsesModel";

// ==========================================
// CAMPOS UTILIZADOS PELO SISTEMA
// ==========================================

const CAMPOS_FUNCIONARIO = [
"ctmbrasi_employeerecordsid",
"ctmbrasi_employeeid",
"ctmbrasi_fullname",
"ctmbrasi_corporateemail",
"ctmbrasi_hiredate",
"ctmbrasi_contractenddate",
"ctmbrasi_terminationdate",
"ctmbrasi_employeestatus",
"ctmbrasi_zoomlink",
"ctmbrasi_shift",
"_ctmbrasi_position_value",
"_ctmbrasi_zone_value",
"_ctmbrasi_shiftslookup_value",
];

// ==========================================
// CONSULTAR TODOS OS FUNCIONÁRIOS
// ==========================================

export async function listarFuncionariosDataverse(): Promise<
Ctmbrasi_employeerecordses[]
> {
const funcionarios: Ctmbrasi_employeerecordses[] = [];

const tokensUtilizados = new Set<string>();

let skipToken: string | undefined;

do {
const resultado =
    await Ctmbrasi_employeerecordsesService.getAll({
    select: CAMPOS_FUNCIONARIO,
    maxPageSize: 500,
    ...(skipToken ? { skipToken } : {}),
    });

if (!resultado.success || !Array.isArray(resultado.data)) {
    throw new Error(
    "Não foi possível consultar os funcionários no Dataverse. " +
    (resultado.error?.message ||
        "Verifique a conexão e as permissões da tabela.")
    );
}

funcionarios.push(...resultado.data);

skipToken = resultado.skipToken || undefined;

if (skipToken) {
    if (tokensUtilizados.has(skipToken)) {
    throw new Error(
        "O Dataverse retornou uma página repetida."
    );
    }

    tokensUtilizados.add(skipToken);
}

if (funcionarios.length > 100000) {
    throw new Error(
    "Limite de segurança da consulta de funcionários excedido."
    );
}
} while (skipToken);

return funcionarios;
}

// ==========================================
// CONSULTAR FUNCIONÁRIO PELO GUID
// ==========================================

export async function buscarFuncionarioDataverse(
id: string
): Promise<Ctmbrasi_employeerecordses> {
if (!id.trim()) {
throw new Error("O ID do funcionário é obrigatório.");
}

const resultado =
await Ctmbrasi_employeerecordsesService.get(id, {
    select: CAMPOS_FUNCIONARIO,
});

if (!resultado.success || !resultado.data) {
throw new Error(
    resultado.error?.message ||
    "Funcionário não encontrado no Dataverse."
);
}

return resultado.data;
}
