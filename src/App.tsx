
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CTM Brasil - Recursos Humanos
 * Aplicativo integrado ao Microsoft Dataverse
 */

import { useCallback, useEffect, useState } from "react";

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
import { AlertsPage } from "./pages/AlertsPage";
import { FutureHiresPage } from "./pages/FutureHiresPage";

import { SectionTabs } from "./components/SectionTabs";
import { EmployeeDetailsPanel } from "./components/EmployeeDetailsPanel";
import { PendingEditorPanel } from "./components/PendingEditorPanel";
import { VacationFormPanel } from "./components/VacationFormPanel";

import type {
  RhEmployee,
  AppSettings,
} from "./types/rh";

import {
  carregarFuncionarios,
  obterAvisoFechamentoContratos,
  salvarEdicaoFuncionario,
  salvarFeriasFuncionario,
  FuncionarioAtualizadoComAvisosError,
  criarFuncionario,
  importarFuncionarios,
  type EmployeeImportRow,
} from "./services/rhDataSource";

import {
  carregarCatalogosDataverse,
  salvarCatalogosDataverse,
  salvarTurnosDataverse,
  type TurnoItem,
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
  turnos: [],
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

  const [shiftsCatalog, setShiftsCatalog] = useState<TurnoItem[]>([]);

  const [loading, setLoading] = useState(true);

  const [dataError, setDataError] =
    useState<string>("");

  const [systemAlertCount, setSystemAlertCount] = useState(0);

  const [mutationError, setMutationError] =
    useState<string>("");
  const [mutationWarning, setMutationWarning] = useState(false);

  // ========================================
  // NAVEGAÇÃO
  // ========================================

  const [activeTab, setActiveTab] =
    useState<TabId>("dashboard");

  const [teamSubTab, setTeamSubTab] =
    useState<"list" | "pending">("list");

  const [scheduleSubTab, setScheduleSubTab] =
    useState<
      "vacations" | "replacement"
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

  const [
    vacationEmployee,
    setVacationEmployee,
  ] = useState<RhEmployee | null>(null);

  // ========================================
  // CARREGAR DADOS REAIS DO DATAVERSE
  // ========================================

  const reloadData = async (): Promise<void> => {
    setLoading(true);
    setDataError("");
    setMutationError("");
    setMutationWarning(false);

    try {
      // Recuperar funcionários e relacionamentos.
      const funcionarios = await carregarFuncionarios();
      const avisoContratos = obterAvisoFechamentoContratos();

      // Recuperar os catálogos corporativos.
      const catalogos =
        await carregarCatalogosDataverse();

      setShiftsCatalog(catalogos.turnos);

      // Atualizar funcionários.
      setEmployees(funcionarios);

      if (avisoContratos) {
        setMutationError(avisoContratos);
        setMutationWarning(true);
      }

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

        turnos: catalogos.turnos
          .filter((item) => item.ativo)
          .map((item) => item.nome),
      });

      // Fechar painéis que possam conter dados antigos.
      setSelectedEmployee(null);
      setEditingEmployee(null);
      setVacationEmployee(null);

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
      setMutationWarning(false);

      setSelectedEmployee((atual) =>
        atual?.recordId === updated.recordId
          ? listaAtualizada.find(
              (item) =>
                item.recordId === updated.recordId
            ) || null
          : atual
      );

    } catch (error) {
      if (error instanceof FuncionarioAtualizadoComAvisosError) {
        setEmployees(error.funcionariosAtualizados);
        setSelectedEmployee((atual) =>
          atual?.recordId === updated.recordId
            ? error.funcionariosAtualizados.find(
                (item) => item.recordId === updated.recordId
              ) || null
            : atual
        );
        setMutationError(error.message);
        setMutationWarning(true);
        return;
      }

      const mensagem =
        error instanceof Error
          ? error.message
          : String(error);

      setMutationError(mensagem);
      setMutationWarning(false);

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
      setMutationWarning(false);

    } catch (error) {
      setMutationError(
        error instanceof Error
          ? error.message
          : String(error)
      );
      setMutationWarning(false);

      throw error;
    }
  };

  const handleImportEmployees = async (
    rows: EmployeeImportRow[],
    onProgress: (completed: number, total: number) => void,
  ) => {
    const result = await importarFuncionarios(rows, onProgress);
    if (result.employees) {
      setEmployees(result.employees);
      setMutationError("");
      setMutationWarning(false);
    }
    if (result.refreshError) {
      setMutationError(result.refreshError);
      setMutationWarning(false);
    }
    return result;
  };

  const handleSaveShifts = async (shifts: TurnoItem[]) => {
    const savedShifts = await salvarTurnosDataverse(shifts);
    setShiftsCatalog(savedShifts);
    setAppSettings((current) => ({
      ...current,
      turnos: savedShifts
        .filter((shift) => shift.ativo)
        .map((shift) => shift.nome),
    }));
    return savedShifts;
  };

  const handleSaveSettings = async (
    settings: AppSettings,
  ): Promise<AppSettings> => {
    const catalogs = await salvarCatalogosDataverse(settings);
    const savedSettings: AppSettings = {
      idiomas: catalogs.idiomas
        .filter((item) => item.ativo)
        .map((item) => item.nome),
      cargos: catalogs.cargos
        .filter((item) => item.ativo)
        .map((item) => item.nome),
      zonas: catalogs.zonas
        .filter((item) => item.ativo)
        .map((item) => item.nome),
      turnos: catalogs.turnos
        .filter((item) => item.ativo)
        .map((item) => item.nome),
    };
    setAppSettings(savedSettings);
    setShiftsCatalog(catalogs.turnos);
    return savedSettings;
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

  const handleConfigureVacation = (employee: RhEmployee) => {
    setSelectedEmployee(null);
    setVacationEmployee(employee);
  };

  const handleSaveVacation = async (updated: RhEmployee): Promise<void> => {
    try {
      const updatedEmployees = await salvarFeriasFuncionario(updated);
      setEmployees(updatedEmployees);
      setMutationError("");
      setMutationWarning(false);
    } catch (error) {
      if (error instanceof FuncionarioAtualizadoComAvisosError) {
        setEmployees(error.funcionariosAtualizados);
        setMutationError(error.message);
        setMutationWarning(true);
        return;
      }

      setMutationError(error instanceof Error ? error.message : String(error));
      setMutationWarning(false);
      throw error;
    }
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

  const handleAlertCountChange = useCallback((count: number) => {
    setSystemAlertCount(count);
  }, []);

  const pageTitle: Record<TabId, string> = {
    dashboard: "Visão geral",
    team: "Funcionários e Cadastros",
    futureHires: "Contratações Futuras",
    schedule: "Escalas e ausências",
    risks: "Riscos e contratos",
    settings: "Configurações",
  };

  // ========================================
  // INTERFACE
  // ========================================

  return (
    <div className="h-dvh min-h-[100svh] w-full min-w-0 overflow-hidden bg-white text-oxford font-sans">
      <div
        className="
          app-workspace
          flex h-full min-h-0 w-full min-w-0
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
          overflow-x-hidden overflow-y-auto
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
            min-w-0
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
              className={`rounded-lg border p-4 text-sm ${
                mutationWarning
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              <strong>{mutationWarning ? "Salvo com aviso:" : "Erro ao salvar:"}</strong>{" "}
              {mutationError}

              <button
                type="button"
                className="ml-3 underline"
                onClick={() => {
                  setMutationError("")
                  setMutationWarning(false);
                }}
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

          {((!loading && !dataError) || activeTab === "futureHires") && (
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
                        label: "Funcionários",
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
                          | "replacement"
                      )
                    }

                    items={[
                      {
                        id: "vacations",
                        label: "Férias e ausências",
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
                      onConfigureVacation={handleConfigureVacation}
                    />
                  )}

                  {scheduleSubTab === "replacement" && (
                    <ReplacementPage
                      employees={employees}
                      languages={appSettings.idiomas}
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
                      catalogs={appSettings}
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
                    <AlertsPage
                      employees={employees}
                      onSelectEmployee={setSelectedEmployee}
                      onRefreshData={() => {
                        void reloadData();
                      }}
                      onAlertCountChange={handleAlertCountChange}
                    />
                  )}

                </div>
              )}

              {/* CONFIGURAÇÕES */}

              {activeTab === "settings" && (
                <SettingsPage
                  settings={appSettings}
                  employees={employees}
                  shifts={shiftsCatalog}
                  onImportEmployees={handleImportEmployees}
                  onSaveShifts={handleSaveShifts}
                  onSave={handleSaveSettings}
                />
              )}

              {activeTab === "futureHires" && (
                <FutureHiresPage />
              )}

            </>
          )}

        </main>

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
        onConfigureVacation={handleConfigureVacation}
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

      <VacationFormPanel
        employee={vacationEmployee}
        allEmployees={employees}
        onClose={() => setVacationEmployee(null)}
        onSave={handleSaveVacation}
      />

    </div>
    </div>
  );
}
