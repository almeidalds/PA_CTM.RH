/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Users,
  ShieldAlert,
  FileWarning,
  Hourglass,
  CalendarPlus,
  Compass,
  Layers3,
  CalendarCheck2,
  CalendarClock,
  AlertOctagon,
  Sparkles,
  Search,
  ArrowUpRight,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  FileText,
  RotateCcw,
  MapPin,
  Clock
} from "lucide-react";
import { RhEmployee, RiskLevel } from "../types/rh";
import { DistributionPanel } from "../components/DashboardAnalytics";
import { DeparturesChart } from "../components/DeparturesChart";
import { KpiCard } from "../components/KpiCard";
import {
  IdiomaChart,
  ZonaChart,
  TurnoChart,
  StatusChart,
  RiscoChart,
  ChartCard
} from "../components/Charts";
import { formatarDataBR, calcularDiasRestantes } from "../utils/dateUtils";
import { calcularRisco } from "../utils/riskUtils";
import { calcularQualidadeDados } from "../utils/dataQualityUtils";
import {
  agruparPorIdioma,
  agruparPorZona,
  agruparPorTurno,
  gerarResumoExecutivo
} from "../utils/groupUtils";
import { RiskBadge } from "../components/RiskBadge";

interface ReportsPageProps {
  employees: RhEmployee[];
  onSelectEmployee: (emp: RhEmployee) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  employees,
  onSelectEmployee
}) => {
  const [showMoreKPIs, setShowMoreKPIs] = useState(false);

  // 1. PROCESSAR MÉTRICAS DOS INDICADORES
  const total = employees.length;
  const ativos = employees.filter((e) => e.statusFuncionario === "Ativo").length;
  const aComecar = employees.filter((e) => e.statusFuncionario === "A começar").length;

  // Saídas previstas
  const saem30 = employees.filter((e) => {
    if (e.statusFuncionario === "Encerrado" || !e.dataTerminoReal) return false;
    const d = calcularDiasRestantes(e.dataTerminoReal);
    return d !== null && d >= 0 && d <= 30;
  }).length;

  const saem60 = employees.filter((e) => {
    if (e.statusFuncionario === "Encerrado" || !e.dataTerminoReal) return false;
    const d = calcularDiasRestantes(e.dataTerminoReal);
    return d !== null && d >= 0 && d <= 60;
  }).length;

  const saem90 = employees.filter((e) => {
    if (e.statusFuncionario === "Encerrado" || !e.dataTerminoReal) return false;
    const d = calcularDiasRestantes(e.dataTerminoReal);
    return d !== null && d >= 0 && d <= 90;
  }).length;

  const saem180 = employees.filter((e) => {
    if (e.statusFuncionario === "Encerrado" || !e.dataTerminoReal) return false;
    const d = calcularDiasRestantes(e.dataTerminoReal);
    return d !== null && d >= 0 && d <= 180;
  }).length;

  // Contratos críticos (0 a 15 dias)
  const contratosCriticos = employees.filter((e) => {
    if (e.statusFuncionario === "Encerrado") return false;
    return calcularRisco(e) === "Crítico";
  }).length;

  // Cadastros com pendência
  const qualidade = calcularQualidadeDados(employees);
  const comPendencia = qualidade.comPendencia;

  // Resumo executivo / Próxima saída real
  const executivo = gerarResumoExecutivo(employees);
  const proximasSaidasDisponiveis = employees
    .filter((e) => e.statusFuncionario === "Ativo" && e.dataTerminoReal)
    .map((e) => ({
      ...e,
      dias: calcularDiasRestantes(e.dataTerminoReal)
    }))
    .filter((e) => e.dias !== null && e.dias >= 0)
    .sort((a, b) => (a.dias || 0) - (b.dias || 0));

  // Zona com maior concentração de saídas nos próximos 90 dias
  const saídasPorZona90: Record<string, number> = {};
  employees.forEach((e) => {
    if (e.statusFuncionario === "Ativo" && e.dataTerminoReal && e.zona) {
      const d = calcularDiasRestantes(e.dataTerminoReal);
      if (d !== null && d >= 0 && d <= 90) {
        saídasPorZona90[e.zona] = (saídasPorZona90[e.zona] || 0) + 1;
      }
    }
  });
  let zonaMaiorConcentracao = "Nenhuma";
  let maxZonaCount = 0;
  Object.entries(saídasPorZona90).forEach(([z, count]) => {
    if (count > maxZonaCount) {
      maxZonaCount = count;
      zonaMaiorConcentracao = `${z} (${count} saídas)`;
    }
  });

  // Agrupamentos para os gráficos do dashboard
  const listIdiomas = agruparPorIdioma(employees);
  const listZonas = agruparPorZona(employees);
  const listTurnos = agruparPorTurno(employees);
  
  return (
    <div className="space-y-5 font-sans">
      
      {/* 2. Top 4 Core Metric Cards - modeled exactly after the mockup's top row cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Funcionários Ativos - highlighted slate/blue card */}
        <KpiCard
          title="Funcionários"
          value={ativos}
          icon={Users}
          colorType="blue"
          subtitle="Aumento de 4% este mês"
          isFirst={true}
        />

        {/* Contratos Críticos */}
        <KpiCard
          title="Contratos Críticos"
          value={contratosCriticos}
          icon={AlertOctagon}
          colorType="red"
          subtitle="Vencimento menor que 15 dias"
        />

        {/* Ausências & Substituições */}
        <KpiCard
          title="Escala & Ausências"
          value={saem30}
          icon={Hourglass}
          colorType="orange"
          subtitle="Saídas iminentes em 30 dias"
        />

        {/* Pendências Cadastrais */}
        <KpiCard
          title="Inconsistências Cadastrais"
          value={comPendencia}
          icon={FileWarning}
          colorType="blue"
          subtitle="Falta de dados críticos"
        />
      </div>

      {/* Collapsible Section for remaining 8 metrics to clean up the page layout */}
      <div className="border-t border-sky-100/80 pt-1 flex justify-center">
        <button
          onClick={() => setShowMoreKPIs(!showMoreKPIs)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-sky-50/50 border border-sky-100 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-yinmn hover:bg-sky-50 transition-all active:scale-95 cursor-pointer"
        >
          <span>{showMoreKPIs ? "Ocultar Métricas Secundárias" : "Exibir Mais Indicadores"}</span>
          {showMoreKPIs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {showMoreKPIs && (
        <div className="adaptive-grid gap-4 animate-fadeIn">
          <KpiCard title="Funcionários a Começar" value={aComecar} icon={CalendarPlus} colorType="blue" subtitle="Admissões futuras" />
          <KpiCard title="Término em 60 Dias" value={saem60} icon={Hourglass} colorType="orange" subtitle="Janela de vencimento médio" />
          <KpiCard title="Término em 90 Dias" value={saem90} icon={Hourglass} colorType="orange" subtitle="Janela de vencimento longo" />
          <KpiCard title="Término em 180 Dias" value={saem180} icon={Hourglass} colorType="gray" subtitle="Janela de estabilidade" />
        </div>
      )}

      {/* 3. Bento Grid - Row 1 - modeled exactly after the mockup's row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Bento Card 1: Project Analytics Chart (Saídas por Mês / Turno) */}
        <DeparturesChart employees={employees} onSelectEmployee={onSelectEmployee} />

      </div>

      {/* 4. Bento Grid - Row 2 - modeled exactly after the mockup's row 3 */}
      <DistributionPanel
        languages={listIdiomas}
        zones={listZonas}
        shifts={listTurnos}
        activeCount={ativos}
        totalCount={total}
      />
      {/* 5. Clean chronological output list of contract endings */}
      <div className="bg-white p-6 rounded-[22px] border border-sky-100 shadow-[0_12px_32px_rgba(0,48,87,0.055)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h4 className="text-base font-extrabold text-oxford">Próximos términos de contratos</h4>
          </div>
        </div>

        <div className="overflow-x-auto no-scrollbar -mx-6 px-6">
          <table className="w-full min-w-[800px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-sky-100 text-slate-400 font-black uppercase text-[10px]">
                <th className="py-3.5 px-3 text-left">Funcionário</th>
                <th className="py-3.5 px-3 text-left">Cargo</th>
                <th className="py-3.5 px-3 text-left">Zona</th>
                <th className="py-3.5 px-3 text-left">Turno</th>
                <th className="py-3.5 px-3 text-left">Idiomas</th>
                <th className="py-3.5 px-3 text-left">Data de Término</th>
                <th className="py-3.5 px-3 text-center">Dias Restantes</th>
                <th className="py-3.5 px-3 text-left">Status</th>
                <th className="py-3.5 px-3 text-center">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100">
              {proximasSaidasDisponiveis.slice(0, 5).map((emp) => {
                const risk = calcularRisco(emp);
                return (
                  <tr key={emp.recordId} className="hover:bg-sky-50/50 transition-colors">
                    <td className="py-4 px-3 font-extrabold text-oxford">{emp.nome}</td>
                    <td className="py-4 px-3 text-slate-500 font-semibold">{emp.cargo}</td>
                    <td className="py-4 px-3 text-slate-500 font-semibold">{emp.zona}</td>
                    <td className="py-4 px-3 text-slate-500 font-semibold">{emp.turno}</td>
                    <td className="py-4 px-3">
                      <div className="flex flex-wrap gap-1">
                        {emp.idiomas?.map((l) => (
                          <span key={l} className="inline-block bg-sky-50 text-yinmn px-2 py-0.5 rounded-md text-[9px] font-bold">
                            {l}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-3 text-slate-400 font-mono font-semibold">{formatarDataBR(emp.dataTerminoReal)}</td>
                    <td className="py-4 px-3 text-center font-bold">
                      {emp.dias !== null && emp.dias <= 30 ? (
                        <span className="text-rose-600 font-black bg-rose-50 px-2 py-1 rounded-md">{emp.dias} dias</span>
                      ) : (
                        <span className="text-slate-700">{emp.dias} dias</span>
                      )}
                    </td>
                    <td className="py-4 px-3">
                      <RiskBadge level={risk} />
                    </td>
                    <td className="py-4 px-3 text-center">
                      <button
                        onClick={() => onSelectEmployee(emp)}
                        className="text-xs text-yinmn hover:text-cadet hover:underline font-extrabold cursor-pointer"
                      >
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                );
              })}
              {proximasSaidasDisponiveis.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 font-semibold">
                    Nenhum término de contrato planejado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
