
using System;
using System.Globalization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace CTM.RH.Dataverse.Plugins
{
    /// <summary>
    /// Operacao principal da Custom API
    /// ctmbrasi_EfetivarContratacaoFutura.
    ///
    /// Binding: Entity
    /// Tabela: ctmbrasi_rhcontratacoesfuturas
    ///
    /// Entrada:
    /// - Target (EntityReference, automatico)
    /// - DataRealInicio (String YYYY-MM-DD)
    ///
    /// Saida:
    /// - FuncionarioId (Guid)
    /// - JaEfetivado (Boolean)
    /// </summary>
    public sealed class EfetivarContratacaoFuturaPlugin : IPlugin
    {
        // ==========================================
        // CONFIGURACAO DAS TABELAS E COLUNAS
        // ==========================================

        private static class Schema
        {
            public const string Action =
                "ctmbrasi_EfetivarContratacaoFutura";

            public const string FutureTable =
                "ctmbrasi_rhcontratacoesfuturas";

            public const string EmployeeTable =
                "ctmbrasi_employeerecords";

            public const string PositionTable =
                "ctmbrasi_rhpositions";

            public const string ZoneTable =
                "ctmbrasi_rhzones";

            // ======================================
            // CAMPOS DA CONTRATACAO FUTURA
            // ======================================

            // Confirmar os nomes logicos no Dataverse.

            public const string FutureName =
                "ctmbrasi_instrutoranovo";

            public const string FutureEmployeeId =
                "ctmbrasi_matricula";

            public const string FuturePosition =
                "ctmbrasi_cargo";

            public const string FutureZoneText =
                "ctmbrasi_zona";

            public const string FutureZoneLookup =
                "ctmbrasi_zonas";

            public const string FutureStartDate =
                "ctmbrasi_datarealdeinicio";

            public const string FutureConfirmation =
                "ctmbrasi_statusdeconfirmacao";

            public const string FuturePhase =
                "ctmbrasi_fase";

            public const string FutureLinkedEmployee =
                "ctmbrasi_funcionarioefetivado";

            // ======================================
            // CAMPOS DO FUNCIONARIO
            // ======================================

            public const string EmployeeId =
                "ctmbrasi_employeeid";

            public const string EmployeeName =
                "ctmbrasi_fullname";

            public const string EmployeeHireDate =
                "ctmbrasi_hiredate";

            public const string EmployeeStatus =
                "ctmbrasi_employeestatus";

            public const string EmployeePosition =
                "ctmbrasi_position";

            public const string EmployeeZone =
                "ctmbrasi_zone";

            public const string ZoneName =
                "ctmbrasi_zonename";
        }

        // ==========================================
        // VALORES DE STATUS DO DATAVERSE
        // ==========================================

        private const int Confirmed = 583150001;
        private const int Pending = 583150000;
        private const int Effective = 583150001;
        private const int ActiveEmployee = 583150000;

        // ==========================================
        // OPERACAO PRINCIPAL DO PLUG-IN
        // ==========================================

        public void Execute(IServiceProvider serviceProvider)
        {
            var context =
                (IPluginExecutionContext)
                serviceProvider.GetService(
                    typeof(IPluginExecutionContext)
                );

            var factory =
                (IOrganizationServiceFactory)
                serviceProvider.GetService(
                    typeof(IOrganizationServiceFactory)
                );

            var tracing =
                (ITracingService)
                serviceProvider.GetService(
                    typeof(ITracingService)
                );

            if (context == null || factory == null)
            {
                throw new InvalidPluginExecutionException(
                    "Contexto Dataverse indisponivel."
                );
            }

            // ======================================
            // VALIDAR CUSTOM API
            // ======================================

            if (
                !string.Equals(
                    context.MessageName,
                    Schema.Action,
                    StringComparison.OrdinalIgnoreCase
                ) ||
                context.Stage != 30
            )
            {
                throw new InvalidPluginExecutionException(
                    "A Custom API nao esta vinculada " +
                    "a operacao principal esperada."
                );
            }

            // ======================================
            // VALIDAR TRANSACAO
            // ======================================

            if (!context.IsInTransaction)
            {
                throw new InvalidPluginExecutionException(
                    "A efetivacao exige execucao " +
                    "transacional. Verifique o registro " +
                    "da Custom API."
                );
            }

            try
            {
                // ==================================
                // 1. VALIDAR REGISTRO DE ORIGEM
                // ==================================

                if (
                    !context.InputParameters.Contains("Target") ||
                    !(context.InputParameters["Target"]
                        is EntityReference target) ||
                    target.Id == Guid.Empty ||
                    !string.Equals(
                        target.LogicalName,
                        Schema.FutureTable,
                        StringComparison.OrdinalIgnoreCase
                    )
                )
                {
                    throw new InvalidPluginExecutionException(
                        "Registro de contratacao invalido."
                    );
                }

                // ==================================
                // 2. VALIDAR DATA REAL DE INICIO
                // ==================================

                if (
                    !context.InputParameters.Contains(
                        "DataRealInicio"
                    ) ||
                    !(context.InputParameters[
                        "DataRealInicio"
                    ] is string startDateText) ||
                    !DateTime.TryParseExact(
                        startDateText,
                        "yyyy-MM-dd",
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.None,
                        out DateTime startDate
                    )
                )
                {
                    throw new InvalidPluginExecutionException(
                        "DataRealInicio deve estar " +
                        "no formato YYYY-MM-DD."
                    );
                }

                // ==================================
                // 3. OBTER SERVICO DATAVERSE
                // ==================================

                // Utilizar a identidade de quem
                // iniciou a operacao.

                var service =
                    factory.CreateOrganizationService(
                        context.InitiatingUserId
                    );

                // ==================================
                // 4. CONSULTAR CONTRATACAO
                // ==================================

                var hire = service.Retrieve(
                    Schema.FutureTable,
                    target.Id,
                    new ColumnSet(true)
                );

                if (hire == null)
                {
                    throw new InvalidPluginExecutionException(
                        "Contratacao nao localizada."
                    );
                }

                var phase =
                    hire.GetAttributeValue<OptionSetValue>(
                        Schema.FuturePhase
                    )?.Value;
                var confirmation =
                    hire.GetAttributeValue<OptionSetValue>(
                        Schema.FutureConfirmation
                    )?.Value;
                var linkedEmployee =
                    hire.GetAttributeValue<EntityReference>(
                        Schema.FutureLinkedEmployee
                    );

                tracing?.Trace(
                    "Contratacao {0}: fase={1}; status de confirmacao={2}.",
                    hire.Id,
                    phase?.ToString() ?? "nao definido",
                    confirmation?.ToString() ?? "nao definido"
                );

                // ==================================
                // 5. VALIDAR EFETIVACAO ANTERIOR
                // ==================================

                // Se a contratacao ja foi efetivada,
                // retornar o funcionario existente.

                if (phase == Effective)
                {
                    if (
                        linkedEmployee == null ||
                        linkedEmployee.Id == Guid.Empty ||
                        !string.Equals(
                            linkedEmployee.LogicalName,
                            Schema.EmployeeTable,
                            StringComparison.OrdinalIgnoreCase
                        )
                    )
                    {
                        throw new InvalidPluginExecutionException(
                            "Contratacao efetivada sem " +
                            "vinculo valido. Encaminhe ao " +
                            "RH para conciliacao."
                        );
                    }

                    var existingEmployee =
                        service.Retrieve(
                            Schema.EmployeeTable,
                            linkedEmployee.Id,
                            new ColumnSet(
                                Schema.EmployeeId
                            )
                        );

                    var originalMatricula =
                        RequiredText(
                            hire,
                            Schema.FutureEmployeeId,
                            "Matricula"
                        );

                    if (
                        !string.Equals(
                            existingEmployee
                                .GetAttributeValue<string>(
                                    Schema.EmployeeId
                                )?.Trim(),
                            originalMatricula,
                            StringComparison.OrdinalIgnoreCase
                        )
                    )
                    {
                        throw new InvalidPluginExecutionException(
                            "Vinculo efetivado inconsistente " +
                            "com a matricula da contratacao."
                        );
                    }

                    context.OutputParameters[
                        "FuncionarioId"
                    ] = linkedEmployee.Id;

                    context.OutputParameters[
                        "JaEfetivado"
                    ] = true;

                    return;
                }

                // ==================================
                // 6. VALIDAR FASE PENDENTE
                // ==================================

                if (phase != Pending)
                {
                    throw new InvalidPluginExecutionException(
                        "A contratacao nao esta pendente " +
                        "de efetivacao."
                    );
                }

                // ==================================
                // 7. VALIDAR CONFIRMACAO
                // ==================================

                if (
                    confirmation != Confirmed
                )
                {
                    throw new InvalidPluginExecutionException(
                        "O inicio precisa estar confirmado " +
                        "antes da efetivacao. Status atual: " +
                        (confirmation?.ToString() ?? "nao definido") +
                        "; valor esperado: " +
                        Confirmed.ToString(CultureInfo.InvariantCulture) +
                        "."
                    );
                }

                // ==================================
                // 8. VALIDAR VINCULO EXISTENTE
                // ==================================

                if (linkedEmployee != null)
                {
                    throw new InvalidPluginExecutionException(
                        "Existe vinculo de funcionario " +
                        "inconsistente em uma contratacao " +
                        "pendente."
                    );
                }

                // ==================================
                // 9. VALIDAR DADOS OBRIGATORIOS
                // ==================================

                var fullName = RequiredText(
                    hire,
                    Schema.FutureName,
                    "Nome completo"
                );

                var matricula = RequiredText(
                    hire,
                    Schema.FutureEmployeeId,
                    "Matricula"
                );

                // ==================================
                // 10. VALIDAR CARGO
                // ==================================

                var position =
                    hire.GetAttributeValue<EntityReference>(
                        Schema.FuturePosition
                    );

                if (
                    position == null ||
                    position.Id == Guid.Empty ||
                    !string.Equals(
                        position.LogicalName,
                        Schema.PositionTable,
                        StringComparison.OrdinalIgnoreCase
                    )
                )
                {
                    throw new InvalidPluginExecutionException(
                        "Cargo/posicao precisa ser um " +
                        "lookup valido para RH Positions."
                    );
                }

                // ==================================
                // 11. VALIDAR ZONA
                // ==================================

                var zone = ResolveZone(
                    service,
                    hire
                );

                if (zone == null)
                {
                    throw new InvalidPluginExecutionException(
                        "Zona obrigatoria. Associe uma " +
                        "zona valida antes de efetivar."
                    );
                }

                // ==================================
                // 12. CONFERIR RELACIONAMENTOS
                // ==================================

                service.Retrieve(
                    Schema.PositionTable,
                    position.Id,
                    new ColumnSet(false)
                );

                service.Retrieve(
                    Schema.ZoneTable,
                    zone.Id,
                    new ColumnSet(false)
                );

                // ==================================
                // 13. VERIFICAR MATRICULA DUPLICADA
                // ==================================

                var existing = new QueryExpression(
                    Schema.EmployeeTable
                )
                {
                    ColumnSet = new ColumnSet(
                        Schema.EmployeeId
                    ),
                    TopCount = 2
                };

                existing.Criteria.AddCondition(
                    Schema.EmployeeId,
                    ConditionOperator.Equal,
                    matricula
                );

                var matches =
                    service.RetrieveMultiple(
                        existing
                    ).Entities;

                if (matches.Count > 0)
                {
                    throw new InvalidPluginExecutionException(
                        "Ja existe funcionario cadastrado " +
                        "com essa matricula. Resolva o " +
                        "conflito antes de efetivar."
                    );
                }

                // ==================================
                // 14. PREPARAR NOVO FUNCIONARIO
                // ==================================

                var employee = new Entity(
                    Schema.EmployeeTable
                );

                employee[Schema.EmployeeId] =
                    matricula;

                employee[Schema.EmployeeName] =
                    fullName;

                employee[Schema.EmployeeHireDate] =
                    DateTime.SpecifyKind(
                        startDate.Date,
                        DateTimeKind.Utc
                    );

                employee[Schema.EmployeeStatus] =
                    new OptionSetValue(
                        ActiveEmployee
                    );

                // Cargo vinculado
                employee[Schema.EmployeePosition] =
                    new EntityReference(
                        Schema.PositionTable,
                        position.Id
                    );

                // Zona vinculada
                employee[Schema.EmployeeZone] =
                    new EntityReference(
                        Schema.ZoneTable,
                        zone.Id
                    );

                // ==================================
                // 15. CRIAR FUNCIONARIO
                // ==================================

                var employeeId = service.Create(
                    employee
                );

                if (employeeId == Guid.Empty)
                {
                    throw new InvalidPluginExecutionException(
                        "A criacao do funcionario nao " +
                        "retornou identificador."
                    );
                }

                // ==================================
                // 16. ATUALIZAR CONTRATACAO FUTURA
                // ==================================

                var patch = new Entity(
                    Schema.FutureTable,
                    hire.Id
                );

                patch[Schema.FuturePhase] =
                    new OptionSetValue(
                        Effective
                    );

                patch[Schema.FutureLinkedEmployee] =
                    new EntityReference(
                        Schema.EmployeeTable,
                        employeeId
                    );

                patch[Schema.FutureStartDate] =
                    DateTime.SpecifyKind(
                        startDate.Date,
                        DateTimeKind.Utc
                    );

                service.Update(patch);

                // ==================================
                // 17. RETORNAR RESULTADO
                // ==================================

                context.OutputParameters[
                    "FuncionarioId"
                ] = employeeId;

                context.OutputParameters[
                    "JaEfetivado"
                ] = false;

                tracing?.Trace(
                    "Efetivacao concluida: {0}",
                    employeeId
                );
            }

            // ======================================
            // TRATAMENTO DE ERROS
            // ======================================

            catch (InvalidPluginExecutionException)
            {
                // Propaga o erro para permitir
                // rollback da transacao.
                throw;
            }

            catch (Exception ex)
            {
                tracing?.Trace(
                    "EfetivarContratacaoFutura: {0}",
                    ex.ToString()
                );

                throw new InvalidPluginExecutionException(
                    "Falha na efetivacao. A transacao " +
                    "deve ser revertida. Consulte o " +
                    "log do plug-in.",
                    ex
                );
            }
        }

        // ==========================================
        // VALIDAR CAMPOS TEXTUAIS
        // ==========================================

        private static string RequiredText(
            Entity source,
            string logicalName,
            string label
        )
        {
            string value =
                source.GetAttributeValue<string>(
                    logicalName
                )?.Trim();

            if (string.IsNullOrWhiteSpace(value))
            {
                throw new InvalidPluginExecutionException(
                    label +
                    " obrigatorio(a) para efetivacao."
                );
            }

            return value;
        }

        // ==========================================
        // LOCALIZAR ZONA DO FUNCIONARIO
        // ==========================================

        private static EntityReference ResolveZone(
            IOrganizationService service,
            Entity hire
        )
        {
            // ======================================
            // PRIMEIRA OPCAO: LOOKUP DIRETO
            // ======================================

            if (
                hire.Attributes.Contains(
                    Schema.FutureZoneLookup
                )
            )
            {
                var lookup =
                    hire.GetAttributeValue<EntityReference>(
                        Schema.FutureZoneLookup
                    );

                if (lookup != null)
                {
                    if (
                        !string.Equals(
                            lookup.LogicalName,
                            Schema.ZoneTable,
                            StringComparison.OrdinalIgnoreCase
                        )
                    )
                    {
                        throw new InvalidPluginExecutionException(
                            "Lookup de zona aponta para " +
                            "tabela inesperada."
                        );
                    }

                    return lookup;
                }
            }

            // ======================================
            // SEGUNDA OPCAO: NOME DA ZONA
            // ======================================

            string zoneName =
                hire.GetAttributeValue<string>(
                    Schema.FutureZoneText
                )?.Trim();

            if (string.IsNullOrWhiteSpace(zoneName))
            {
                return null;
            }

            var query = new QueryExpression(
                Schema.ZoneTable
            )
            {
                ColumnSet = new ColumnSet(false),
                TopCount = 2
            };

            query.Criteria.AddCondition(
                Schema.ZoneName,
                ConditionOperator.Equal,
                zoneName
            );

            var matches =
                service.RetrieveMultiple(
                    query
                ).Entities;

            if (matches.Count != 1)
            {
                throw new InvalidPluginExecutionException(
                    "Zona inexistente ou ambigua. " +
                    "Corrija o cadastro de origem."
                );
            }

            return new EntityReference(
                Schema.ZoneTable,
                matches[0].Id
            );
        }
    }
}
