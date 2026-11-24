/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  AlertTriangle,
  Flame,
  FileQuestion,
  TrendingUp,
  MapPin,
  Clock,
  Languages,
  Plane,
  Info,
  Calendar,
  CornerDownRight
} from "lucide-react";
import { AppSettings, RhEmployee } from "../types/rh";
import { calcularRisco } from "../utils/riskUtils";
import { formatarDataBR, calcularDiasRestantes } from "../utils/dateUtils";
import { calcularStatusFerias } from "../utils/vacationUtils";
import { obterSubstituicoes } from "../services/additionalDataSource";
import { normalizarTurno } from "../constants/turnos";

interface RisksPageProps {
  employees: RhEmployee[];
  catalogs: Pick<AppSettings, "idiomas" | "zonas" | "turnos">;
  onSelectEmployee: (emp: RhEmployee) => void;
}

type HeatmapMode = "idioma_turno" | "idioma_zona" | "zona_turno" | "periodo_ausencia";

type HeatmapRisk = "Sem dados" | "Verde" | "Azul" | "Amarelo" | "Laranja" | "Vermelho";

type SelectedCellInfo = {
  title: string;
  activeCount: number;
  contratos30: number;
  contratos60: number;
  subsPendentes: number;
  ausenciasFuturas: number;
  nivel: HeatmapRisk;
  recomendacao: string;
  funcionarios: RhEmployee[];
  listaNomes?: string[];
};

function valoresUnicos(valores: Array<string | undefined>): string[] {
  const vistos = new Set<string>();
  return valores.reduce<string[]>((resultado, valor) => {
    const nome = valor?.trim();
    if (!nome) return resultado;

    const chave = nome.toLocaleLowerCase("pt-BR");
    if (!vistos.has(chave)) {
      vistos.add(chave);
      resultado.push(nome);
    }

    return resultado;
  }, []);
}

export const RisksPage: React.FC<RisksPageProps> = ({ employees, catalogs, onSelectEmployee }) => {
  const [activeView, setActiveView] = useState<"ranking" | "heatmap">("heatmap");
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("idioma_turno");
  const [selectedCellInfo, setSelectedCellInfo] = useState<SelectedCellInfo | null>(null);

  const actives = employees.filter((e) => e.statusFuncionario === "Ativo");
  const substitutions = obterSubstituicoes();
  const IDIOMAS = valoresUnicos([
    ...catalogs.idiomas,
    ...actives.flatMap((employee) => employee.idiomas || []),
  ]);
  const ZONAS = valoresUnicos([
    ...catalogs.zonas,
    ...actives.map((employee) => employee.zona),
  ]);
  const TURNOS = valoresUnicos([
    ...catalogs.turnos,
    ...actives.map((employee) => employee.turno),
  ].map(normalizarTurno));

  const incompletosImpeditivos = actives.filter(
    (e) => !e.dataTerminoReal || e.dataTerminoReal.trim() === ""
  ).length;

  const idiomasCount = new Map<string, number>();
  actives.forEach((e) => {
    const idiomasFuncionario = new Set(
      (e.idiomas || []).map((idioma) => idioma.trim().toLocaleLowerCase("pt-BR"))
    );
    idiomasFuncionario.forEach((idioma) => {
      idiomasCount.set(idioma, (idiomasCount.get(idioma) || 0) + 1);
    });
  });

  const baixaCoberturaIdiomas = IDIOMAS
    .map((idioma) => ({
      nome: idioma,
      quantidade: idiomasCount.get(idioma.trim().toLocaleLowerCase("pt-BR")) || 0,
    }))
    .filter((idioma) => idioma.quantidade <= 1);

  const totalVacationCritical = actives.filter((e) => calcularStatusFerias(e) === "Férias críticas").length;
  const contratos30Dias = actives.filter((employee) => {
    const dias = calcularDiasRestantes(employee.dataTerminoReal);
    return dias !== null && dias >= 0 && dias <= 30;
  });
  const contratos60Dias = actives.filter((employee) => {
    const dias = calcularDiasRestantes(employee.dataTerminoReal);
    return dias !== null && dias > 30 && dias <= 60;
  });
  const combinacoesZonaTurno = new Map<string, number>();
  actives.forEach((employee) => {
    if (!employee.zona?.trim() || !employee.turno?.trim()) return;
    const chave = `${employee.zona.trim().toLocaleLowerCase("pt-BR")}|${normalizarTurno(employee.turno).toLocaleLowerCase("pt-BR")}`;
    combinacoesZonaTurno.set(chave, (combinacoesZonaTurno.get(chave) || 0) + 1);
  });
  const coberturasZonaTurnoUnicas = Array.from(combinacoesZonaTurno.entries())
    .filter(([, count]) => count === 1)
    .map(([chave]) => {
      const [zona, turno] = chave.split("|");
      const employee = actives.find((item) =>
    item.zona.trim().toLocaleLowerCase("pt-BR") === zona &&
    normalizarTurno(item.turno).toLocaleLowerCase("pt-BR") === turno
      );
      return employee ? `${employee.zona} • ${normalizarTurno(employee.turno)}` : `${zona} • ${turno}`;
    });

  // 2. CONSTRUÇÃO DO RANKING DE RISCOS OPERACIONAIS
  const topRiscosAlerts = [
    ...(contratos30Dias.length > 0 ? [{
      id: "contratos-30",
      title: "Contratos com término nos próximos 30 dias",
      severity: "Crítico" as const,
      category: "Contrato",
      desc: `${contratos30Dias.length} funcionário(s) ativo(s) têm término de contrato previsto nos próximos 30 dias.`,
      recommendation: "Revise as decisões de renovação e planeje a cobertura dos vínculos com vencimento próximo.",
      icon: Flame,
    }] : []),
    ...(baixaCoberturaIdiomas.length > 0 ? [{
      id: "cobertura-idiomas",
      title: "Idiomas com cobertura baixa ou inexistente",
      severity: "Alto" as const,
      category: "Idioma",
      desc: `Cobertura ativa de até um funcionário nos idiomas: ${baixaCoberturaIdiomas.map((idioma) => `${idioma.nome} (${idioma.quantidade})`).join(", ")}.`,
      recommendation: "Avalie alternativas de cobertura ou remanejamento para esses idiomas.",
      icon: Languages,
    }] : []),
    ...(totalVacationCritical > 0 ? [{
      id: "ferias-criticas",
      title: "Funcionários com férias críticas",
      severity: "Alto" as const,
      category: "Férias",
      desc: `${totalVacationCritical} funcionário(s) ativo(s) estão classificados com férias críticas.`,
      recommendation: "Revise os períodos aquisitivos e programe as férias para reduzir o risco trabalhista e operacional.",
      icon: Plane,
    }] : []),
    ...(contratos60Dias.length > 0 ? [{
      id: "contratos-60",
      title: "Contratos com término entre 31 e 60 dias",
      severity: "Médio" as const,
      category: "Contrato",
      desc: `${contratos60Dias.length} funcionário(s) ativo(s) têm término previsto entre 31 e 60 dias.`,
      recommendation: "Inicie a análise de renovação e prepare alternativas de cobertura.",
      icon: Clock,
    }] : []),
    ...(incompletosImpeditivos > 0 ? [{
      id: "datas-incompletas",
      title: "Cadastros ativos sem data de término",
      severity: "Médio" as const,
      category: "Integridade",
      desc: `${incompletosImpeditivos} funcionário(s) ativo(s) estão sem data de término de contrato.`,
      recommendation: "Complete as datas de término para que esses vínculos possam ser considerados nas projeções.",
      icon: FileQuestion,
    }] : []),
    ...(coberturasZonaTurnoUnicas.length > 0 ? [{
      id: "cobertura-zona-turno",
      title: "Combinações de zona e turno com cobertura unitária",
      severity: "Médio" as const,
      category: "Zona e turno",
      desc: `Há apenas um funcionário ativo nas combinações: ${coberturasZonaTurnoUnicas.join(", ")}.`,
      recommendation: "Verifique se há possibilidade de cobertura alternativa para essas zonas e turnos.",
      icon: MapPin,
    }] : []),
  ];

  const contratosRiscoMaximo = actives
    .map((e) => ({ ...e, risco: calcularRisco(e) }))
    .filter((e) => e.risco === "Crítico" || e.risco === "Alto")
    .sort((a, b) => {
      const diasA = calcularDiasRestantes(a.dataTerminoReal) ?? 999;
      const diasB = calcularDiasRestantes(b.dataTerminoReal) ?? 999;
      return diasA - diasB;
    });

  // 3. MOTOR CALCULAR CÉLULA DO HEATMAP
  const calcularMetricasCelula = (filtros: { idioma?: string; turno?: string; zona?: string }) => {
    // Filtrar instrutores ativos nessa interseção
    const ativosCelula = actives.filter((e) => {
      const matchLang = !filtros.idioma || e.idiomas?.some((l) => l.trim().toLocaleLowerCase("pt-BR") === filtros.idioma?.trim().toLocaleLowerCase("pt-BR"));
      const matchTurno = !filtros.turno || normalizarTurno(e.turno || "").trim().toLocaleLowerCase("pt-BR") === normalizarTurno(filtros.turno).trim().toLocaleLowerCase("pt-BR");
      const matchZona = !filtros.zona || e.zona?.trim().toLocaleLowerCase("pt-BR") === filtros.zona?.trim().toLocaleLowerCase("pt-BR");
      return matchLang && matchTurno && matchZona;
    });

    const activeCount = ativosCelula.length;

    // Vencimentos de contrato críticos
    const contratos30 = ativosCelula.filter((e) => {
      const d = calcularDiasRestantes(e.dataTerminoReal);
      return d !== null && d >= 0 && d <= 30;
    }).length;

    const contratos60 = ativosCelula.filter((e) => {
      const d = calcularDiasRestantes(e.dataTerminoReal);
      return d !== null && d > 30 && d <= 60;
    }).length;

    // Substituições pendentes/sem responsável
    const subsPendentes = substitutions.filter((s) => {
      if (s.status === "Cancelada" || s.status === "Concluída") return false;
      const matchAbsentEmployee = ativosCelula.some((e) => e.nome === s.instrutorAusente);
      return matchAbsentEmployee && (!s.substituto || s.substituto.trim() === "");
    }).length;

    // Ausências futuras (férias marcadas)
    const ausenciasFuturas = ativosCelula.filter((e) => e.periodosFerias && e.periodosFerias.length > 0).length;

    // Calcular nível de risco
    let nivel: HeatmapRisk = activeCount === 0 ? "Sem dados" : "Verde";
    let recomendacao = "Combinação sem funcionários ativos cadastrados. Verifique se há demanda de cobertura.";

    if (activeCount === 0) {
      recomendacao = "Não há funcionários ativos cadastrados nesta combinação.";
    } else if (activeCount === 1) {
      if (contratos30 > 0 || subsPendentes > 0) {
        nivel = "Vermelho";
        recomendacao = "Risco de colapso de grade acadêmica! O único funcionário ativo possui contrato expirando em 30 dias ou ausência não coberta.";
      } else {
        nivel = "Laranja";
        recomendacao = "Vulnerabilidade operacional. Há apenas um funcionário ativo; qualquer licença poderá causar desfalque.";
      }
    } else if (activeCount >= 2) {
      if (contratos30 > 0 || subsPendentes > 0) {
        nivel = "Amarelo";
        recomendacao = "Atenção requerida. Há contratos vencendo ou ausências pendentes que demandam novas alocações.";
      } else if (contratos60 > 0 || ausenciasFuturas > 0) {
        nivel = "Azul";
        recomendacao = "Acompanhamento preventivo. Planeje a escala de férias futura para evitar acúmulos.";
      }
    }

    return {
      activeCount,
      contratos30,
      contratos60,
      subsPendentes,
      ausenciasFuturas,
      nivel,
      recomendacao,
      funcionarios: ativosCelula,
    };
  };

  const getHeatmapColor = (nivel: string) => {
    switch (nivel) {
      case "Sem dados":
        return "bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200";
      case "Vermelho":
        return "bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-100/30 border border-rose-300";
      case "Laranja":
        return "bg-orange-400 hover:bg-orange-500 text-white shadow-md shadow-orange-100/20 border border-orange-200";
      case "Amarelo":
        return "bg-amber-300 hover:bg-amber-400 text-slate-800 border border-amber-200";
      case "Azul":
        return "bg-sky-200 hover:bg-sky-300 text-sky-800 border border-sky-100";
      default:
        return "bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-50";
    }
  };

  const MESES = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() + index);
    const ano = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, "0");

    return {
      label: date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      key: `${ano}-${mes}`,
    };
  });

  // Cálculo de limite simultâneo por mês para Período x Ausências
  const obterAusenciasNoMes = (anoMes: string) => {
    // Quantas pessoas têm férias ou substituição cobrindo qualquer dia desse mês?
    const ausentesSet = new Set<string>();
    
    // Varre férias
    actives.forEach((emp) => {
      emp.periodosFerias?.forEach((f) => {
        const [ano, mes] = anoMes.split("-").map(Number);
        const inicioMes = `${anoMes}-01`;
        const fimMes = new Date(ano, mes, 0).toISOString().slice(0, 10);
        if (f.dataInicio && f.dataFim && f.dataInicio <= fimMes && f.dataFim >= inicioMes) {
          ausentesSet.add(emp.nome);
        }
      });
    });

    // Varre substituições
    substitutions.forEach((s) => {
      const funcionarioAtivo = actives.some(
        (employee) => employee.nome.trim().toLocaleLowerCase("pt-BR") === s.instrutorAusente.trim().toLocaleLowerCase("pt-BR")
      );
      if (funcionarioAtivo && s.status !== "Cancelada" && s.status !== "Concluída") {
        const [ano, mes] = anoMes.split("-").map(Number);
        const inicioMes = `${anoMes}-01`;
        const fimMes = new Date(ano, mes, 0).toISOString().slice(0, 10);
        if (s.dataInicio && s.dataFim && s.dataInicio <= fimMes && s.dataFim >= inicioMes) {
          ausentesSet.add(s.instrutorAusente);
        }
      }
    });

    const count = ausentesSet.size;
    let nivel: "Verde" | "Amarelo" | "Laranja" | "Vermelho" = "Verde";
    let recomendacao = "Mês seguro. Menos de 4 ausências simultâneas projetadas.";

    if (count > 8) {
      nivel = "Vermelho";
      recomendacao = `Crítico! Limite excedido com ${count} instrutores ausentes no mesmo período. Risco sério de quebra de turmas!`;
    } else if (count >= 6) {
      nivel = "Laranja";
      recomendacao = `Alto Risco! ${count} ausências simultâneas projetadas. Recomenda-se suspender novos pedidos de folga para este mês.`;
    } else if (count >= 4) {
      nivel = "Amarelo";
      recomendacao = `Atenção. ${count} ausências programadas. Recomenda-se planejar a cobertura preventiva da equipe.`;
    }

    return {
      count,
      nivel,
      recomendacao,
      ausentesList: Array.from(ausentesSet)
    };
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-[22px] border border-white bg-gradient-to-br from-slate-100 to-white p-5 shadow-[0_12px_30px_rgba(0,48,87,0.07)] gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-oxford flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <span>Gestão Preditiva de Riscos de Pessoal</span>
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Análise baseada nos funcionários ativos e nos catálogos de zonas, turnos e idiomas carregados do Dataverse.
          </p>
        </div>

        {/* View Toggle */}
        <div className="bg-slate-100 p-1 rounded-xl flex self-start">
          <button
            onClick={() => setActiveView("heatmap")}
            className={`text-xs font-black py-1.5 px-3.5 rounded-lg transition-all cursor-pointer ${
              activeView === "heatmap" ? "bg-white text-yinmn shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Mapa de Calor de Riscos
          </button>
          <button
            onClick={() => setActiveView("ranking")}
            className={`text-xs font-black py-1.5 px-3.5 rounded-lg transition-all cursor-pointer ${
              activeView === "ranking" ? "bg-white text-yinmn shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Análise e Ranking de Riscos
          </button>
        </div>
      </div>

      {activeView === "ranking" ? (
        /* RANKING ORIGINAL VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 px-1">
              <TrendingUp className="w-4 h-4 text-yinmn" />
              <span>Ranking de Riscos Operacionais Ativos</span>
            </h3>

            <div className="space-y-4">
              {topRiscosAlerts.length === 0 && (
                <div className="rounded-2xl border border-sky-100 bg-white p-5 text-sm font-medium text-slate-500">
                  Não foram encontrados alertas com os dados atuais dos funcionários ativos.
                </div>
              )}
              {topRiscosAlerts.map((alert, idx) => {
                const Icon = alert.icon;
                return (
                  <div
                    key={alert.id}
                    className={`p-5 bg-white rounded-[22px] border border-sky-100 shadow-[0_10px_26px_rgba(0,48,87,0.05)] hover:shadow-[0_16px_34px_rgba(0,48,87,0.10)] hover:-translate-y-0.5 transition-all duration-300 flex gap-4 ${
                      alert.severity === "Crítico"
                        ? "border-l-4 border-l-rose-500"
                        : alert.severity === "Alto"
                        ? "border-l-4 border-l-amber-500"
                        : "border-l-4 border-l-yinmn"
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl self-start ${
                      alert.severity === "Crítico"
                        ? "bg-rose-50 text-rose-600"
                        : alert.severity === "Alto"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-sky-50 text-yinmn"
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center justify-between flex-wrap gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          #{idx + 1} - {alert.category}
                        </span>
                        <span className={`text-[9px] uppercase font-black px-2.5 py-0.5 rounded-full ${
                          alert.severity === "Crítico"
                            ? "bg-rose-50 text-rose-600 border border-rose-100/50"
                            : alert.severity === "Alto"
                            ? "bg-amber-50 text-amber-600 border border-amber-100/50"
                            : "bg-sky-50 text-yinmn border border-sky-200"
                        }`}>
                          {alert.severity}
                        </span>
                      </div>

                      <h4 className="text-sm font-extrabold text-oxford">{alert.title}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed font-semibold">{alert.desc}</p>
                      
                      <div className="pt-3 mt-3 border-t border-sky-100 bg-sky-50/50 p-3 rounded-xl">
                        <span className="text-[9px] font-black uppercase tracking-wider text-yinmn block">
                          Ação Recomendada pelo RH
                        </span>
                        <p className="text-xs text-oxford font-semibold mt-1 leading-relaxed">{alert.recommendation}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side */}
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-[22px] border border-sky-100 shadow-[0_10px_26px_rgba(0,48,87,0.05)] space-y-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-oxford">Contratos Críticos & Altos</h4>
                <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">Regularização contratual imediata</p>
              </div>

              <div className="space-y-2.5">
                {contratosRiscoMaximo.length === 0 && (
                  <p className="text-xs text-slate-400">
                    Nenhum funcionário ativo está classificado com risco contratual alto ou crítico.
                  </p>
                )}
                {contratosRiscoMaximo.slice(0, 4).map((emp) => {
                  const dias = calcularDiasRestantes(emp.dataTerminoReal);
                  return (
                    <div
                      key={emp.recordId}
                      className="p-3 bg-slate-50/50 rounded-xl border border-sky-100 flex items-center justify-between hover:border-jordy/50 hover:bg-sky-50 transition-all duration-250 cursor-pointer text-xs"
                      onClick={() => onSelectEmployee(emp)}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-extrabold text-oxford truncate">{emp.nome}</p>
                        <span className="text-[10px] text-slate-400 font-bold block truncate">{emp.cargo}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-rose-600 block bg-rose-50 px-2 py-0.5 rounded-md">{dias} dias</span>
                        <span className="text-[9px] text-slate-400 font-medium block mt-0.5">{formatarDataBR(emp.dataTerminoReal)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* HEATMAP INTERACTIVE VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Heatmap controls & Matrix rendering */}
          <div className="lg:col-span-3 space-y-5">
            {/* Matrices selectors */}
            <div className="flex gap-2 flex-wrap bg-slate-100/80 p-1.5 rounded-2xl self-start max-w-max">
              <button
                onClick={() => {
                  setHeatmapMode("idioma_turno");
                  setSelectedCellInfo(null);
                }}
                className={`text-[10px] font-black uppercase tracking-wider py-2 px-3.5 rounded-xl transition-all cursor-pointer ${
                  heatmapMode === "idioma_turno" ? "bg-white text-yinmn shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Idioma x Turno
              </button>
              
              <button
                onClick={() => {
                  setHeatmapMode("idioma_zona");
                  setSelectedCellInfo(null);
                }}
                className={`text-[10px] font-black uppercase tracking-wider py-2 px-3.5 rounded-xl transition-all cursor-pointer ${
                  heatmapMode === "idioma_zona" ? "bg-white text-yinmn shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Idioma x Zona
              </button>

              <button
                onClick={() => {
                  setHeatmapMode("zona_turno");
                  setSelectedCellInfo(null);
                }}
                className={`text-[10px] font-black uppercase tracking-wider py-2 px-3.5 rounded-xl transition-all cursor-pointer ${
                  heatmapMode === "zona_turno" ? "bg-white text-yinmn shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Zona x Turno
              </button>

              <button
                onClick={() => {
                  setHeatmapMode("periodo_ausencia");
                  setSelectedCellInfo(null);
                }}
                className={`text-[10px] font-black uppercase tracking-wider py-2 px-3.5 rounded-xl transition-all cursor-pointer ${
                  heatmapMode === "periodo_ausencia" ? "bg-white text-yinmn shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Período x Ausências (Limite 8)
              </button>
            </div>

            {/* Matrix Render Box */}
            <div className="bg-white p-5 rounded-3xl border border-sky-100 shadow-sm overflow-x-auto">
              
              {/* MATRIX 1: Idioma x Turno */}
              {heatmapMode === "idioma_turno" && (
                <div className="min-w-[600px] text-xs">
                  {IDIOMAS.length === 0 || TURNOS.length === 0 ? (
                    <p className="py-8 text-center text-sm font-medium text-slate-400">
                      Não há idiomas ou turnos cadastrados para exibir nesta análise.
                    </p>
                  ) : <>
                  <div className="grid border-b border-sky-100 pb-3 text-[10px] uppercase font-black text-slate-400 tracking-wider" style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${TURNOS.length}, minmax(100px, 1fr))` }}>
                    <div>Idioma de Ensino</div>
                    {TURNOS.map((t) => (
                      <div key={t} className="text-center">{t}</div>
                    ))}
                  </div>

                  <div className="divide-y divide-sky-100">
                    {IDIOMAS.map((idioma) => (
                      <div key={idioma} className="grid py-3.5 items-center" style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${TURNOS.length}, minmax(100px, 1fr))` }}>
                        <div className="font-extrabold text-oxford">{idioma}</div>
                        {TURNOS.map((turno) => {
                          const met = calcularMetricasCelula({ idioma, turno });
                          return (
                            <div key={turno} className="px-2">
                              <button
                                type="button"
                                onClick={() => setSelectedCellInfo({ title: `${idioma} • ${turno}`, ...met })}
                                aria-label={`${idioma}, ${turno}: ${met.activeCount} funcionários ativos`}
                                className={`w-full py-3 text-center rounded-xl cursor-pointer transition-all hover:scale-105 hover:shadow-sm font-extrabold text-xs ${getHeatmapColor(met.nivel)}`}
                              >
                                {met.activeCount} ativos
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  </>}
                </div>
              )}

              {/* MATRIX 2: Idioma x Zona */}
              {heatmapMode === "idioma_zona" && (
                <div className="min-w-[700px] text-xs">
                  {IDIOMAS.length === 0 || ZONAS.length === 0 ? (
                    <p className="py-8 text-center text-sm font-medium text-slate-400">
                      Não há idiomas ou zonas cadastrados para exibir nesta análise.
                    </p>
                  ) : <>
                  <div className="grid border-b border-sky-100 pb-3 text-[10px] uppercase font-black text-slate-400 tracking-wider" style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${ZONAS.length}, minmax(100px, 1fr))` }}>
                    <div>Idioma de Ensino</div>
                    {ZONAS.map((z) => (
                      <div key={z} className="text-center">{z}</div>
                    ))}
                  </div>

                  <div className="divide-y divide-sky-100">
                    {IDIOMAS.map((idioma) => (
                      <div key={idioma} className="grid py-3.5 items-center" style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${ZONAS.length}, minmax(100px, 1fr))` }}>
                        <div className="font-extrabold text-oxford">{idioma}</div>
                        {ZONAS.map((zona) => {
                          const met = calcularMetricasCelula({ idioma, zona });
                          return (
                            <div key={zona} className="px-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedCellInfo({ title: `${idioma} • ${zona}`, ...met })}
                                aria-label={`${idioma}, ${zona}: ${met.activeCount} funcionários ativos`}
                                className={`w-full py-3 text-center rounded-xl cursor-pointer transition-all hover:scale-105 hover:shadow-sm font-extrabold text-xs ${getHeatmapColor(met.nivel)}`}
                              >
                                {met.activeCount} ativos
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  </>}
                </div>
              )}

              {/* MATRIX 3: Zona x Turno */}
              {heatmapMode === "zona_turno" && (
                <div className="min-w-[600px] text-xs">
                  {ZONAS.length === 0 || TURNOS.length === 0 ? (
                    <p className="py-8 text-center text-sm font-medium text-slate-400">
                      Não há zonas ou turnos cadastrados para exibir nesta análise.
                    </p>
                  ) : <>
                  <div className="grid border-b border-sky-100 pb-3 text-[10px] uppercase font-black text-slate-400 tracking-wider" style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${TURNOS.length}, minmax(100px, 1fr))` }}>
                    <div>Região / Campus</div>
                    {TURNOS.map((t) => (
                      <div key={t} className="text-center">{t}</div>
                    ))}
                  </div>

                  <div className="divide-y divide-sky-100">
                    {ZONAS.map((zona) => (
                      <div key={zona} className="grid py-3.5 items-center" style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${TURNOS.length}, minmax(100px, 1fr))` }}>
                        <div className="font-extrabold text-oxford">{zona}</div>
                        {TURNOS.map((turno) => {
                          const met = calcularMetricasCelula({ zona, turno });
                          return (
                            <div key={turno} className="px-2">
                              <button
                                type="button"
                                onClick={() => setSelectedCellInfo({ title: `${zona} • ${turno}`, ...met })}
                                aria-label={`${zona}, ${turno}: ${met.activeCount} funcionários ativos`}
                                className={`w-full py-3 text-center rounded-xl cursor-pointer transition-all hover:scale-105 hover:shadow-sm font-extrabold text-xs ${getHeatmapColor(met.nivel)}`}
                              >
                                {met.activeCount} ativos
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  </>}
                </div>
              )}

              {/* MATRIX 4: Período x Ausências */}
              {heatmapMode === "periodo_ausencia" && (
                <div className="space-y-4">
                  <div className="p-3 bg-sky-50 border border-sky-100/60 rounded-2xl flex items-start gap-2 text-xs text-yinmn">
                    <Info className="w-4 h-4 text-yinmn shrink-0 mt-0.5" />
                    <p className="font-semibold leading-relaxed">
                      Esta matriz monitora a regra operacional crítica: **no máximo 8 professores ausentes** (férias marcadas ou afastamentos cadastrados) no mesmo mês. Meses com mais de 8 ausências ficam em **Vermelho** (Crítico).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {MESES.map((mes) => {
                    const res = obterAusenciasNoMes(mes.key);
                      
                    let cardColor = "border-emerald-100 bg-emerald-50/30 text-emerald-800";
                      if (res.nivel === "Vermelho") cardColor = "border-red-200 bg-red-50/30 text-red-900";
                      if (res.nivel === "Laranja") cardColor = "border-orange-200 bg-orange-50/30 text-orange-900";
                      if (res.nivel === "Amarelo") cardColor = "border-amber-200 bg-amber-50/30 text-amber-900";

                      return (
                        <div
                          key={mes.key}
                          onClick={() => setSelectedCellInfo({
                            title: `Previsão: ${mes.label}`,
                            activeCount: actives.length,
                            ausenciasFuturas: res.count,
                            contratos30: 0,
                            contratos60: 0,
                            subsPendentes: 0,
                            funcionarios: [],
                            nivel: res.nivel,
                            recomendacao: res.recomendacao,
                            listaNomes: res.ausentesList,
                          })}
                          className={`p-4 rounded-3xl border-2 cursor-pointer transition-all hover:scale-102 hover:shadow-sm ${cardColor}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-black text-oxford">{mes.label}</span>
                            <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-full ${
                              res.nivel === "Vermelho" ? "bg-red-500 text-white animate-pulse" : "bg-white text-slate-700 border"
                            }`}>
                              {res.count} Ausentes
                            </span>
                          </div>

                          <div className="mt-3.5 space-y-1 text-xs">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              <span>Status de Ausência Coletiva:</span>
                            </div>
                            <span className="font-extrabold block text-slate-700">{res.nivel}</span>
                            <p className="text-[10px] text-slate-400 leading-snug font-medium mt-1">{res.recomendacao}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Legendas coloridas */}
            <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-4 flex-wrap text-[10px] font-black uppercase tracking-wider text-slate-500">
              <span className="shrink-0">Risco da Célula:</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-100 border border-slate-300 block" /> Sem dados</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-100 border border-emerald-300 block" /> Estável</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sky-200 border border-sky-300 block" /> OK</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-300 border border-amber-400 block" /> Atenção</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-400 border border-orange-500 block" /> Alto Risco</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500 border border-rose-600 block" /> Urgente</span>
            </div>
          </div>

          {/* Right Side: Clicked Cell Tooltip Details */}
          <div className="lg:col-span-1">
            <div className="bg-white p-5 rounded-3xl border border-sky-100 shadow-sm space-y-4 sticky top-4">
              <div className="border-b border-sky-100/60 pb-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Inspeção Detalhada de Risco</h4>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Selecione uma célula para ver recomendações</p>
              </div>

              {selectedCellInfo ? (
                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-black text-yinmn tracking-wider block">Combinação analisada</span>
                    <p className="text-sm font-black text-oxford mt-0.5">{selectedCellInfo.title}</p>
                  </div>

                  <div className="p-3 bg-slate-50/50 rounded-2xl border border-sky-100 space-y-2 font-semibold">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Funcionários Ativos:</span>
                      <span className="font-extrabold text-oxford">{selectedCellInfo.activeCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ausências Futuras/Férias:</span>
                      <span className="font-extrabold text-oxford">{selectedCellInfo.ausenciasFuturas}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Vencendo em 30 dias:</span>
                      <span className="font-extrabold text-oxford">{selectedCellInfo.contratos30}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Vencendo em 60 dias:</span>
                      <span className="font-extrabold text-oxford">{selectedCellInfo.contratos60}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Substitutos Pendentes:</span>
                      <span className="font-extrabold text-oxford">{selectedCellInfo.subsPendentes}</span>
                    </div>
                  </div>

                  {selectedCellInfo.funcionarios.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-black text-slate-400">
                        Funcionários nesta combinação ({selectedCellInfo.funcionarios.length})
                      </span>
                      {selectedCellInfo.funcionarios.map((employee) => (
                        <button
                          key={employee.recordId}
                          type="button"
                          onClick={() => onSelectEmployee(employee)}
                          className="block w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-left text-[11px] font-bold text-oxford hover:bg-sky-50"
                        >
                          {employee.nome}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Lista de nomes ausentes para Período x Ausências */}
                  {selectedCellInfo.listaNomes && selectedCellInfo.listaNomes.length > 0 && (
                    <div className="p-3 bg-red-50/20 border border-red-100/40 rounded-2xl space-y-1.5">
                      <span className="text-[9px] uppercase font-black text-red-600 tracking-wider block">Ausentes Programados ({selectedCellInfo.listaNomes.length})</span>
                      <div className="space-y-1">
                        {selectedCellInfo.listaNomes.map((n: string) => (
                          <div key={n} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                            <CornerDownRight className="w-3 h-3 text-red-400 shrink-0" />
                            <span>{n}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-black text-slate-400">Nível de Risco Calculado</span>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black border uppercase ${
                      selectedCellInfo.nivel === "Sem dados"
                        ? "bg-slate-50 text-slate-500 border-slate-200"
                        : selectedCellInfo.nivel === "Vermelho"
                        ? "bg-rose-50 text-rose-600 border-rose-200"
                        : selectedCellInfo.nivel === "Laranja"
                        ? "bg-orange-50 text-orange-600 border-orange-200"
                        : "bg-emerald-50 text-emerald-600 border-emerald-200"
                    }`}>
                      {selectedCellInfo.nivel}
                    </span>
                  </div>

                  <div className="p-3 bg-sky-50 rounded-2xl border border-sky-100 space-y-1.5">
                    <span className="text-[9px] uppercase font-black text-yinmn tracking-wider block">Recomendação Operacional</span>
                    <p className="text-xs text-slate-700 leading-relaxed font-semibold">{selectedCellInfo.recomendacao}</p>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 font-semibold italic">
                  Clique em qualquer quadrante colorido da matriz para inspecionar os fatores de risco e obter ações preventivas.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
