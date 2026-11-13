import { useId, useState } from "react";
import { Globe, MapPin, Clock, Users } from "lucide-react";
import type { GroupCount } from "../utils/groupUtils";

interface DistributionPanelProps {
  languages: GroupCount[];
  zones: GroupCount[];
  shifts: GroupCount[];
  activeCount: number;
  totalCount: number;
}

export function DistributionPanel({ languages, zones, shifts, activeCount, totalCount }: DistributionPanelProps) {
  const [selected, setSelected] = useState("idiomas");
  const panelId = useId();
  const views = [
    { id: "idiomas", label: "Idiomas", icon: Globe, data: languages, title: "Idiomas da equipe ativa", description: "Percentual sobre as atribuições de idiomas; uma pessoa pode contar em mais de um idioma.", base: activeCount },
    { id: "zonas", label: "Zonas", icon: MapPin, data: zones, title: "Distribuição por região", description: "Percentual dos colaboradores ativos em cada zona.", base: activeCount },
    { id: "turnos", label: "Turnos", icon: Clock, data: shifts, title: "Distribuição por turno", description: "Percentual dos colaboradores ativos em cada turno.", base: activeCount },
  ];
  const view = views.find((item) => item.id === selected)!;
  const rows = view.data.filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...rows.map((item) => item.count));
  const totalInView = selected === "idiomas"
    ? rows.reduce((sum, item) => sum + item.count, 0)
    : view.base;
  return (
    <section aria-label="Distribuição e cobertura de funcionários" className="overflow-hidden rounded-[22px] border border-sky-100 bg-white shadow-[0_12px_32px_rgba(0,48,87,0.055)]">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-yinmn">Panorama da equipe</p><h3 className="text-lg font-bold tracking-tight text-oxford sm:text-xl">Distribuição e cobertura</h3><p className="mt-1 text-xs text-slate-500">Visão geral da equipe ativa por idioma, zona e turno.</p></div>
          <span className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold text-yinmn"><Users className="h-4 w-4" />{activeCount} de {totalCount} ativos</span>
        </div>
      </div>
      <div role="group" aria-label="Categoria de distribuição" className="flex gap-2 overflow-x-auto border-y border-sky-100 bg-slate-50/60 px-5 py-3 sm:px-6">
        {views.map((item) => <button type="button" key={item.id} aria-pressed={selected === item.id} aria-controls={panelId} onClick={() => setSelected(item.id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yinmn ${selected === item.id ? "bg-yinmn text-white shadow-sm" : "text-slate-500 hover:bg-white hover:text-yinmn"}`}><item.icon className="h-4 w-4" />{item.label}</button>)}
      </div>
      <div id={panelId} className="p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-2"><div><h4 className="text-sm font-bold text-oxford">{view.title}</h4><p className="mt-1 text-xs leading-relaxed text-slate-500">{view.description}</p></div><span className="text-xs text-slate-500">{selected === "idiomas" ? `${totalInView} atribuições` : `Base: ${view.base} colaboradores`}</span></div>
        {rows.some((item) => item.count > 0) ? <ul className="grid gap-x-8 gap-y-4 xl:grid-cols-2">
          {rows.map((item) => <li key={item.name} className="min-w-0 rounded-xl border border-slate-100 px-4 py-3">
            <div className="mb-2.5 flex items-start justify-between gap-4"><span className="min-w-0 break-words text-xs font-medium leading-relaxed text-slate-700">{item.name}</span><span className="shrink-0 text-sm font-bold tabular-nums text-oxford">{item.count}<span className="ml-2 text-[11px] font-normal text-slate-500">{item.percentage}%</span></span></div>
            <div role="progressbar" aria-label={`${item.name}: ${item.count} ${selected === "idiomas" ? "atribuições" : "colaboradores"}, ${item.percentage}%`} aria-valuenow={Math.round(item.count / max * 100)} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-yinmn transition-[width] duration-300" style={{ width: `${item.count / max * 100}%` }} /></div>
          </li>)}
        </ul> : <div className="rounded-xl bg-slate-50 py-10 text-center"><view.icon className="mx-auto mb-3 h-7 w-7 text-slate-400" /><p className="text-sm font-medium text-slate-600">Sem dados para esta categoria</p><p className="mt-1 text-xs text-slate-500">Os indicadores aparecem quando há registros disponíveis.</p></div>}
        {rows.length > 0 && <p className="mt-4 text-[11px] leading-relaxed text-slate-500">Barras comparadas à categoria mais frequente. Percentuais calculados sobre {selected === "idiomas" ? "as atribuições de idiomas" : "a equipe ativa"}.</p>}
      </div>
    </section>
  );
}
