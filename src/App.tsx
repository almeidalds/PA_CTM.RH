
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CTM Brasil - Recursos Humanos
 * Aplicativo integrado ao Microsoft Dataverse
 */

import { useEffect, useState } from "react";

import { AppHeader } from "./components/AppHeader";
import {
  NavigationTabs,
  type TabId,
} from "./components/NavigationTabs";

import { ReportsPage } from "./pages/ReportsPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { RisksPage } from "./pages/RisksPage";
import { PendingPage } from "./pages/PendingPage";
import { ReplacementPage } from "./pages/ReplacementPage";
import { VacationsPage } from "./pages/VacationsPage";
import { ContractsPage } from "./pages/ContractsPage";
import { SettingsPage } from "./pages/SettingsPage";

import { FloatingActionBar } from "./components/FloatingActionBar";
import { SectionTabs } from "./components/SectionTabs";
import { EmployeeDetailsPanel } from "./components/EmployeeDetailsPanel";
import { PendingEditorPanel } from "./components/PendingEditorPanel";

import type {
  RhEmployee,
  AppSettings,
} from "./types/rh";

import {
  carregarFuncionarios,
  salvarEdicaoFuncionario,
  criarFuncionario,
} from "./services/rhDataSource";

import {
  carregarCatalogosDataverse,
} from "./services/dataverseCatalogs";

import { calcularQualidadeDados } from "./utils/dataQualityUtils";
import { calcularRisco } from "./utils/riskUtils";
import { calcularStatusFerias } from "./utils/vacationUtils";

// ==========================================
// CONFIGURAÇÕES INICIAIS
// ==========================================

// Não utilizar dados fictícios.
const CONFIGURACOES_VAZIAS: AppSettings = {
  idiomas: [],
  cargos: [],
  zonas: [],
};

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function App() {

  // ========================================
  // DADOS CORPORATIVOS
  // ========================================

  const [employees, setEmployees] =
    useState<RhEmployee[]>([]);

  const [appSettings, setAppSettings] =
    useState<AppSettings>(CONFIGURACOES_VAZIAS);

  const [loading, setLoading] = useState(true);

  const [dataError, setDataError] =
    useState<string>("");

  const [mutationError, setMutationError] =
    useState<string>("");

  // ========================================
  // NAVEGAÇÃO
  // ========================================

  const [activeTab, setActiveTab] =
    useState<TabId>("dashboard");

  const [teamSubTab, setTeamSubTab] =
    useState<"list" | "pending">("list");

  const [scheduleSubTab, setScheduleSubTab] =
    useState<
      "vacations" | "substitutions" | "replacement"
    >("vacations");

  const [risksSubTab, setRisksSubTab] =
    useState<
      "heatmap" | "contracts" | "alerts"
    >("heatmap");

  // ========================================
  // BARRA LATERAL
  // ========================================

  const [isSidebarOpen, setIsSidebarOpen] =
    useState(false);

  const [isSidebarCollapsed, setIsSidebarCollapsed] =
    useState(false);

  // ========================================
  // MODAIS E PAINÉIS
  // ========================================

  const [
    selectedEmployee,
    setSelectedEmployee,
  ] = useState<RhEmployee | null>(null);

  const [
    editingEmployee,
    setEditingEmployee,
  ] = useState<RhEmployee | null>(null);

  // ========================================
  // CARREGAR DADOS REAIS DO DATAVERSE
  // ========================================

  const reloadData = async (): Promise<void> => {
    setLoading(true);
    setDataError("");
    setMutationError("");

    try {
      // Recuperar funcionários e relacionamentos.
      const funcionarios = await carregarFuncionarios();

      // Recuperar os catálogos corporativos.
      const catalogos =
        await carregarCatalogosDataverse();

      // Atualizar funcionários.
      setEmployees(funcionarios);

      // Utilizar apenas opções ativas nos formulários.
      setAppSettings({
        idiomas: catalogos.idiomas
          .filter((item) => item.ativo)
          .map((item) => item.nome),

        cargos: catalogos.cargos
          .filter((item) => item.ativo)
          .map((item) => item.nome),

        zonas: catalogos.zonas
          .filter((item) => item.ativo)
          .map((item) => item.nome),
      });

      // Fechar painéis que possam conter dados antigos.
      setSelectedEmployee(null);
      setEditingEmployee(null);

    } catch (error) {
      console.error(
        "Erro ao carregar dados do Dataverse:",
        error
      );

      // Nunca substituir erros por dados fictícios.
      setEmployees([]);
      setAppSettings(CONFIGURACOES_VAZIAS);

      setDataError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os dados."
      );

    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // CARREGAMENTO INICIAL
  // ========================================

  useEffect(() => {
    void reloadData();
  }, []);

  // ========================================
  // ATUALIZAR DADOS
  // ========================================

  // Compatibilidade com o cabeçalho e a barra
  // de ações. Não exclui dados do Dataverse.
  const handleResetData = () => {
    void reloadData();
  };

  // ========================================
  // EDITAR FUNCIONÁRIO
  // ========================================

  const handleSaveEmployee = async (
    updated: RhEmployee
  ): Promise<void> => {

    try {
      const listaAtualizada =
        await salvarEdicaoFuncionario(updated);

      setEmployees(listaAtualizada);
      setMutationError("");

      setSelectedEmployee((atual) =>
        atual?.recordId === updated.recordId
          ? listaAtualizada.find(
              (item) =>
                item.recordId === updated.recordId
            ) || null
          : atual
      );

    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : String(error);

      setMutationError(mensagem);

      // Propagar o erro para o formulário.
      throw error;
    }
  };

  // ========================================
  // CRIAR FUNCIONÁRIO
  // ========================================

  const handleCreateEmployee = async (
    employee: RhEmployee
  ): Promise<void> => {

    try {
      const listaAtualizada =
        await criarFuncionario(employee);

      setEmployees(listaAtualizada);
      setMutationError("");

    } catch (error) {
      setMutationError(
        error instanceof Error
          ? error.message
          : String(error)
      );

      throw error;
    }
  };

  // ========================================
  // ABRIR EDIÇÃO
  // ========================================

  const handleDetailsEditShortcut = (
    employee: RhEmployee
  ) => {
    setSelectedEmployee(null);
    setEditingEmployee(employee);
  };

  // ========================================
  // INDICADORES
  // ========================================

  const pendingCount =
    calcularQualidadeDados(employees).comPendencia;

  const criticalRiskCount = employees.filter(
    (employee) =>
      employee.statusFuncionario === "Ativo" &&
      calcularRisco(employee) === "Crítico"
  ).length;

  const criticalVacationCount = employees.filter(
    (employee) =>
      employee.statusFuncionario === "Ativo" &&
      calcularStatusFerias(employee) ===
        "Férias críticas"
  ).length;

  // Substituições ainda serão conectadas.
  // Não contabilizar registros locais.
  const systemAlertCount = criticalRiskCount;

  const pageTitle: Record<TabId, string> = {
    dashboard: "Visão geral",
    team: "Equipe e cadastros",
    schedule: "Escalas e ausências",
    risks: "Riscos e contratos",
    settings: "Configurações",
  };

  // ========================================
  // INTERFACE
  // ========================================

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-white text-oxford font-sans">
      <div
        className="
          app-workspace
          flex h-full min-h-0 w-full
          overflow-hidden bg-white
        "
      >

      {/* ================================= */}
      {/* MENU LATERAL                      */}
      {/* ================================= */}

      <NavigationTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}

        pendingCount={pendingCount}

        teamSubTab={teamSubTab}
        scheduleSubTab={scheduleSubTab}
        risksSubTab={risksSubTab}

        setTeamSubTab={setTeamSubTab}
        setScheduleSubTab={setScheduleSubTab}
        setRisksSubTab={setRisksSubTab}

        criticalRiskCount={criticalRiskCount}
        criticalVacationCount={criticalVacationCount}
        systemAlertCount={systemAlertCount}

        isOpen={isSidebarOpen}
        isCollapsed={isSidebarCollapsed}

        onClose={() => setIsSidebarOpen(false)}

        onToggleCollapse={() =>
          setIsSidebarCollapsed((valor) => !valor)
        }
      />

      {/* ================================= */}
      {/* CONTEÚDO PRINCIPAL                */}
      {/* ================================= */}

      <div
        className="
          flex-1 flex flex-col
          min-w-0 min-h-0 h-full
          overflow-y-auto
        "
      >

        {/* CABEÇALHO */}

        <AppHeader
          employeeCount={employees.length}
          pageTitle={pageTitle[activeTab]}

          onMenuToggle={() =>
            setIsSidebarOpen(true)
          }

          onSidebarToggle={() =>
            setIsSidebarCollapsed((valor) => !valor)
          }

          isSidebarCollapsed={isSidebarCollapsed}

          onResetData={handleResetData}

        />

        {/* ÁREA DE TRABALHO */}

        <main
          className="
            flex-1
            max-w-[1440px]
            w-full
            mx-auto
            p-3 sm:p-4 lg:p-5 xl:p-6
            space-y-5
            dashboard-enter
          "
        >

          {/* ================================= */}
          {/* CARREGAMENTO                      */}
          {/* ================================= */}

          {loading && (
            <div
              role="status"
              className="
                bg-sky-50
                border border-sky-200
                rounded-lg
                p-5
                text-sm
                text-sky-900
              "
            >
              Carregando informações do Microsoft
              Dataverse...
            </div>
          )}

          {/* ================================= */}
          {/* ERROS DE GRAVAÇÃO                  */}
          {/* ================================= */}

          {mutationError && (
            <div
              role="alert"
              className="
                bg-rose-50
                border border-rose-200
                rounded-lg
                p-4
                text-sm
                text-rose-800
              "
            >
              <strong>Erro ao salvar:</strong>{" "}
              {mutationError}

              <button
                type="button"
                className="ml-3 underline"
                onClick={() =>
                  setMutationError("")
                }
              >
                Fechar
              </button>
            </div>
          )}

          {/* ================================= */}
          {/* ERROS DE CONEXÃO                   */}
          {/* ================================= */}

          {dataError && (
            <div
              role="alert"
              className="
                bg-rose-50
                border border-rose-200
                rounded-lg
                p-5
                text-sm
                text-rose-900
              "
            >
              <p className="font-bold">
                Não foi possível conectar ao Dataverse.
              </p>

              <p className="mt-2">
                {dataError}
              </p>

              <button
                type="button"
                onClick={handleResetData}
                className="
                  mt-4
                  px-4 py-2
                  bg-white
                  border border-rose-200
                  rounded-lg
                  font-semibold
                "
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* ================================= */}
          {/* NENHUM FUNCIONÁRIO                 */}
          {/* ================================= */}

          {!loading &&
            !dataError &&
            employees.length === 0 && (
              <div
                role="status"
                className="
                  bg-white
                  border border-slate-200
                  rounded-lg
                  p-5
                  text-sm
                  text-slate-600
                "
              >
                Nenhum funcionário foi encontrado
                na tabela do Dataverse.
              </div>
            )}

          {/* ================================= */}
          {/* PÁGINAS DO SISTEMA                 */}
          {/* ================================= */}

          {!loading && !dataError && (
            <>

              {/* DASHBOARD */}

              {activeTab === "dashboard" && (
                <ReportsPage
                  employees={employees}
                  onSelectEmployee={
                    setSelectedEmployee
                  }
                />
              )}

              {/* EQUIPE */}

              {activeTab === "team" && (
                <div className="space-y-6">

                  <SectionTabs
                    activeId={teamSubTab}

                    onChange={(id) =>
                      setTeamSubTab(
                        id as "list" | "pending"
                      )
                    }

                    items={[
                      {
                        id: "list",
                        label: "Quadro de Colaboradores",
                      },
                      {
                        id: "pending",
                        label: "Pendências",
                        badge: pendingCount,
                      },
                    ]}
                  />

                  {teamSubTab === "list" ? (
                    <EmployeesPage
                      appSettings={appSettings}
                      employees={employees}

                      onCreateEmployee={
                        handleCreateEmployee
                      }

                      onSelectEmployee={
                        setSelectedEmployee
                      }

                      onEditEmployee={
                        setEditingEmployee
                      }
                    />
                  ) : (
                    <PendingPage
                      employees={employees}
                      onEditEmployee={
                        setEditingEmployee
                      }
                    />
                  )}

                </div>
              )}

              {/* ESCALA E AUSÊNCIAS */}

              {activeTab === "schedule" && (
                <div className="space-y-6">

                  <SectionTabs
                    activeId={scheduleSubTab}

                    onChange={(id) =>
                      setScheduleSubTab(
                        id as
                          | "vacations"
                          | "substitutions"
                          | "replacement"
                      )
                    }

                    items={[
                      {
                        id: "vacations",
                        label: "Controle de Férias",
                      },
                      {
                        id: "substitutions",
                        label: "Gestão de Substituições",
                      },
                      {
                        id: "replacement",
                        label: "Simular Reposições",
                      },
                    ]}
                  />

                  {scheduleSubTab === "vacations" && (
                    <VacationsPage
                      appSettings={appSettings}
                      employees={employees}

                      onSave={async (
                        updated,
                        createSubst
                      ) => {
                        if (createSubst) {
                          throw new Error(
                            "A criação automática de " +
                            "substituições será conectada " +
                            "ao Dataverse em outra etapa."
                          );
                        }

                        await handleSaveEmployee(updated);
                      }}
                    />
                  )}

                  {scheduleSubTab ===
                    "substitutions" && (
                    <div
                      className="
                        bg-white
                        border border-slate-200
                        rounded-lg p-6
                      "
                    >
                      <h2 className="font-bold">
                        Gestão de Substituições
                      </h2>

                      <p className="text-sm text-slate-500 mt-2">
                        Esta área está temporariamente
                        indisponível enquanto conectamos
                        os registros de substituições
                        ao Dataverse.
                      </p>
                    </div>
                  )}

                  {scheduleSubTab === "replacement" && (
                    <ReplacementPage
                      employees={employees}
                      onSelectEmployee={
                        setSelectedEmployee
                      }
                    />
                  )}

                </div>
              )}

              {/* RISCOS E CONTRATOS */}

              {activeTab === "risks" && (
                <div className="space-y-6">

                  <SectionTabs
                    activeId={risksSubTab}

                    onChange={(id) =>
                      setRisksSubTab(
                        id as
                          | "heatmap"
                          | "contracts"
                          | "alerts"
                      )
                    }

                    items={[
                      {
                        id: "heatmap",
                        label: "Análise Preditiva",
                      },
                      {
                        id: "contracts",
                        label: "Prazos Contratuais",
                      },
                      {
                        id: "alerts",
                        label: "Painel de Alertas",
                        badge: systemAlertCount,
                      },
                    ]}
                  />

                  {risksSubTab === "heatmap" && (
                    <RisksPage
                      employees={employees}
                      onSelectEmployee={
                        setSelectedEmployee
                      }
                    />
                  )}

                  {risksSubTab === "contracts" && (
                    <ContractsPage
                      employees={employees}

                      onSelectEmployee={
                        setSelectedEmployee
                      }

                      onUpdateEmployee={(employee) => {
                        void handleSaveEmployee(
                          employee
                        ).catch(() => {
                          // Mensagem exibida acima.
                        });
                      }}
                    />
                  )}

                  {risksSubTab === "alerts" && (
                    <div
                      className="
                        bg-white
                        border border-slate-200
                        rounded-lg p-6
                      "
                    >
                      <h2 className="font-bold">
                        Alertas
                      </h2>

                      <p className="text-sm text-slate-500 mt-2">
                        A integração dos registros e
                        estados de alertas ao Dataverse
                        será realizada em outra etapa.
                      </p>
                    </div>
                  )}

                </div>
              )}

              {/* CONFIGURAÇÕES */}

              {activeTab === "settings" && (
                <SettingsPage
                  settings={appSettings}

                  onSave={async () => {
                    throw new Error(
                      "A gravação dos catálogos no " +
                      "Dataverse ainda não foi " +
                      "implementada. Nenhuma " +
                      "alteração foi salva."
                    );
                  }}
                />
              )}

            </>
          )}

        </main>

        {/* ================================= */}
        {/* RODAPÉ                           */}
        {/* ================================= */}

        <footer
          className="
            px-6 py-6
            text-center
            text-[10px]
            uppercase
            font-bold
            tracking-wider
            text-slate-400
            bg-transparent
            border-t
            border-sky-100/80
            leading-relaxed
            break-words
          "
        >
          RH Dashboard © 2026 •
          Centro de Treinamento Missionário do Brasil
        </footer>

      </div>

      {/* ================================= */}
      {/* DETALHES DO FUNCIONÁRIO           */}
      {/* ================================= */}

      <EmployeeDetailsPanel
        employee={selectedEmployee}
        onClose={() =>
          setSelectedEmployee(null)
        }
        onEdit={handleDetailsEditShortcut}
      />

      {/* ================================= */}
      {/* FORMULÁRIO DE EDIÇÃO              */}
      {/* ================================= */}

      <PendingEditorPanel
        employee={editingEmployee}
        appSettings={appSettings}
        onClose={() =>
          setEditingEmployee(null)
        }
        onSave={handleSaveEmployee}
      />

      {/* ================================= */}
      {/* BARRA DE AÇÕES                    */}
      {/* ================================= */}

      <FloatingActionBar
        systemAlertCount={systemAlertCount}
        pendingCount={pendingCount}
        criticalVacationCount={
          criticalVacationCount
        }

        onResetData={handleResetData}

        activeTab={activeTab}
        setActiveTab={setActiveTab}

        setTeamSubTab={setTeamSubTab}
        setScheduleSubTab={setScheduleSubTab}
        setRisksSubTab={setRisksSubTab}
      />

    </div>
    </div>
  );
}
