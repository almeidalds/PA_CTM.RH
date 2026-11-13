/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useRef } from "react";
import churchLogo from "../../logo/church_jesus_christ_simplified_symbol.png";
import {
  BarChart3, Users2, CalendarDays, Settings,
  X, PanelLeftClose, PanelLeftOpen,
  FolderSync, UserRoundPlus, ShieldAlert, FileClock, Bell,
} from "lucide-react";

export type TabId =
  | "dashboard"
  | "team"
  | "futureHires"
  | "schedule"
  | "risks"
  | "settings";
type TeamTab = "list" | "pending";
type ScheduleTab = "vacations" | "replacement";
type RisksTab = "heatmap" | "contracts" | "alerts";

interface NavigationTabsProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  teamSubTab: TeamTab;
  scheduleSubTab: ScheduleTab;
  risksSubTab: RisksTab;
  setTeamSubTab: (tab: TeamTab) => void;
  setScheduleSubTab: (tab: ScheduleTab) => void;
  setRisksSubTab: (tab: RisksTab) => void;
  pendingCount: number;
  criticalRiskCount: number;
  criticalVacationCount: number;
  systemAlertCount: number;
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

interface MenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  count?: number;
  action: () => void;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = (props) => {
  const drawer = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = drawer.current;
    if (!dialog) return;
    if (!props.isOpen) { dialog.close(); return; }
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop.matches) props.onClose(); };
    desktop.addEventListener("change", closeOnDesktop);
    closeOnDesktop();
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      document.body.style.overflow = previousOverflow;
      dialog.close();
      previousFocus?.focus();
    };
  }, [props.isOpen, props.onClose]);

  const navigate = (tab: TabId, select?: () => void) => () => {
    select?.();
    props.setActiveTab(tab);
    props.onClose();
  };
  const groups: { label: string; items: MenuItem[] }[] = [
    { label: "Visão geral", items: [
      { label: "Relatórios", icon: BarChart3, active: props.activeTab === "dashboard", action: navigate("dashboard") },
    ] },
    { label: "Funcionários e cadastros", items: [
      { label: "Funcionários", icon: Users2, active: props.activeTab === "team" && props.teamSubTab === "list", action: navigate("team", () => props.setTeamSubTab("list")) },
      { label: "Contratações Futuras", icon: UserRoundPlus, active: props.activeTab === "futureHires", action: navigate("futureHires") },
    ] },
    { label: "Escalas e ausências", items: [
      { label: "Férias e ausências", icon: CalendarDays, count: props.criticalVacationCount, active: props.activeTab === "schedule" && props.scheduleSubTab === "vacations", action: navigate("schedule", () => props.setScheduleSubTab("vacations")) },
      { label: "Simular reposições", icon: UserRoundPlus, active: props.activeTab === "schedule" && props.scheduleSubTab === "replacement", action: navigate("schedule", () => props.setScheduleSubTab("replacement")) },
    ] },
    { label: "Riscos e contratos", items: [
      { label: "Análise preditiva", icon: ShieldAlert, count: props.criticalRiskCount, active: props.activeTab === "risks" && props.risksSubTab === "heatmap", action: navigate("risks", () => props.setRisksSubTab("heatmap")) },
      { label: "Prazos contratuais", icon: FileClock, active: props.activeTab === "risks" && props.risksSubTab === "contracts", action: navigate("risks", () => props.setRisksSubTab("contracts")) },
      { label: "Painel de alertas", icon: Bell, count: props.systemAlertCount, active: props.activeTab === "risks" && props.risksSubTab === "alerts", action: navigate("risks", () => props.setRisksSubTab("alerts")) },
    ] },
    { label: "Sistema", items: [
      { label: "Configurações", icon: Settings, active: props.activeTab === "settings", action: navigate("settings") },
    ] },
  ];
  const focusStyle = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yinmn focus-visible:ring-offset-2";
  const content = (collapsed: boolean, mobile = false) => (
    <div className="flex h-full min-h-0 flex-col border-r border-sky-100 bg-white text-oxford shadow-[10px_0_32px_rgba(0,48,87,0.05)]">
      <div className={`flex shrink-0 items-center gap-3 px-1 py-5 lg:px-4 ${collapsed ? "flex-col" : "flex-col lg:flex-row"}`}>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#006184] p-1.5"
        >
          <img
            src={churchLogo}
            alt="Símbolo de Jesus Cristo"
            className="h-full w-full object-contain"
          />
        </div>
        {!collapsed && <div className={`min-w-0 flex-1 ${mobile ? "" : "sr-only lg:not-sr-only"}`}><p className="text-[15px] font-bold tracking-tight">RH <span className="text-yinmn">CTM</span></p></div>}
        <button type="button" onClick={mobile ? props.onClose : props.onToggleCollapse} aria-label={mobile ? "Fechar menu" : collapsed ? "Expandir barra lateral" : "Recolher barra lateral"} title={mobile ? "Fechar menu" : collapsed ? "Expandir barra lateral" : "Recolher barra lateral"} className={`rounded-lg p-2 text-slate-400 hover:bg-sky-50 hover:text-yinmn ${!mobile ? "hidden lg:block" : ""} ${focusStyle}`}>
          {mobile ? <X className="h-4 w-4" /> : collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      <nav aria-label="Navegação principal" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {groups.map((group, index) => <div key={group.label} role="group" aria-label={group.label} className={collapsed && index > 0 ? "border-t border-sky-100 pt-3" : ""}>
          <p className={collapsed ? "sr-only" : "sr-only px-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400 lg:not-sr-only lg:mb-2"}>{group.label}</p>
          <div className="space-y-1">{group.items.map((item) => <button key={item.label} type="button" onClick={item.action} aria-current={item.active ? "page" : undefined} title={`${item.label}${item.count ? ` (${item.count})` : ""}`} className={`relative flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition-all ${focusStyle} ${collapsed ? "justify-center" : "justify-center lg:justify-start"} ${item.active ? "bg-gradient-to-r from-yinmn to-cadet font-semibold text-white shadow-[0_8px_18px_rgba(0,97,132,0.22)]" : "font-medium text-slate-500 hover:bg-sky-50 hover:text-yinmn"}`}>
            <item.icon className="h-4 w-4 shrink-0" />
            <span className={collapsed ? "sr-only" : "sr-only flex-1 lg:not-sr-only"}>{item.label}</span>
            {!!item.count && <>
              {collapsed ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-white" aria-label={`${item.count} ocorrências`} />
              ) : (
                <>
                  <span className={`hidden rounded-md px-1.5 py-0.5 text-[10px] font-bold lg:inline-flex ${item.active ? "bg-white/20 text-white" : "bg-amber-50 text-amber-800"}`}>{item.count}<span className="sr-only"> ocorrências</span></span>
                  <span className="absolute right-1.5 top-1.5 hidden h-2 w-2 rounded-full bg-amber-400 ring-2 ring-white md:block lg:hidden" aria-label={`${item.count} ocorrências`} />
                </>
              )}
            </>}
          </button>)}</div>
        </div>)}
      </nav>
    </div>
  );
  return <>
    <aside aria-label="Barra lateral" className="sticky top-0 hidden h-full shrink-0 transition-[width] duration-200 motion-reduce:transition-none md:block" style={{ width: props.isCollapsed ? "5rem" : "clamp(5rem, calc(100vw - 814px), 16rem)" }}>{content(props.isCollapsed)}</aside>
    <dialog ref={drawer} aria-label="Menu de navegação" onCancel={props.onClose} onClick={(event) => { if (event.target === event.currentTarget) props.onClose(); }} className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm md:hidden">
      <div className="h-full w-[min(20rem,88vw)] shadow-xl">{content(false, true)}</div>
    </dialog>
  </>;
};
