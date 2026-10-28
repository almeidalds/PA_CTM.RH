/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { LucideIcon, ArrowUpRight, TrendingUp } from "lucide-react";

type KpiColorType = "green" | "blue" | "orange" | "red" | "gray";

interface KpiCardProps {
  id?: string;
  title: string;
  value: string | number;
  icon: LucideIcon;
  colorType: KpiColorType;
  trend?: string;
  subtitle?: string;
  onClick?: () => void;
  isFirst?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  id,
  title,
  value,
  icon: Icon,
  colorType,
  trend = "Estável este mês",
  subtitle,
  onClick,
  isFirst = false
}) => {
  if (isFirst) {
    return (
      <div
        id={id}
        onClick={onClick}
        className={`group relative min-h-[148px] overflow-hidden rounded-[18px] bg-gradient-to-br from-[#638ecb] via-[#638ecb] to-[#395886] p-4 text-white shadow-[0_12px_28px_rgba(57,88,134,0.20)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(57,88,134,0.26)] ${
          onClick ? "cursor-pointer active:scale-[0.98]" : "cursor-default"
        }`}
      >
        <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl transition-transform duration-500 group-hover:scale-125" />
        <div className="absolute bottom-0 right-0 flex h-20 w-[48%] items-end gap-1.5 px-4 opacity-25" aria-hidden="true">
          {[34, 58, 44, 72, 52, 82, 64].map((height, index) => (
            <span key={index} className="flex-1 rounded-t-sm bg-white" style={{ height: `${height}%` }} />
          ))}
        </div>

        <div className="relative flex items-start justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
            {title}
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 transition-colors group-hover:bg-white/25">
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>

        <div className="relative mt-3.5 flex items-baseline gap-1">
          <span className="text-3xl font-bold tracking-[-0.04em]">
            {value}
          </span>
        </div>

        <div className="relative mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/12 px-2.5 py-1 text-[9px] font-medium text-white/95 backdrop-blur-sm">
          <TrendingUp className="h-3 w-3" />
          <span>{subtitle || trend}</span>
        </div>
      </div>
    );
  }

  const cardColorClasses: Record<KpiColorType, string> = {
    green: "bg-[#eef8f4] border-[#dceee8]",
    blue: "bg-[#d5deef] border-[#b1c9ef]",
    orange: "bg-[#fff7ea] border-[#f3e7cf]",
    red: "bg-[#fff0f3] border-[#f4dce3]",
    gray: "bg-[#f0f3fa] border-[#d5deef]"
  };

  const iconColorClasses: Record<KpiColorType, string> = {
    green: "text-emerald-700 bg-white/70",
    blue: "text-cadet bg-white/70",
    orange: "text-amber-700 bg-white/70",
    red: "text-rose-700 bg-white/70",
    gray: "text-slate-600 bg-slate-100"
  };

  const selectedIconClass = iconColorClasses[colorType] || iconColorClasses.blue;
  const selectedCardClass = cardColorClasses[colorType] || cardColorClasses.blue;

  return (
    <div
      id={id}
      onClick={onClick}
      className={`group relative min-h-[148px] overflow-hidden rounded-[18px] border p-4 shadow-[0_8px_22px_rgba(57,88,134,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_13px_28px_rgba(57,88,134,0.11)] ${selectedCardClass} ${
        onClick ? "cursor-pointer active:scale-[0.98]" : "cursor-default"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="max-w-[75%] text-[11px] font-semibold uppercase leading-relaxed tracking-[0.12em] text-slate-500">
          {title}
        </span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover:scale-105 ${selectedIconClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-2">
        <span className="text-3xl font-bold tracking-[-0.04em] text-oxford">
          {value}
        </span>
        <ArrowUpRight className="h-4 w-4 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-yinmn" />
      </div>

      <div className="mt-3 inline-flex items-center gap-1.5 text-[9px] font-medium text-slate-500">
        <div className={`h-1.5 w-1.5 rounded-full ${colorType === "red" ? "bg-rose-500" : colorType === "orange" ? "bg-amber-500" : "bg-emerald-500"}`} />
        <span>{subtitle || trend}</span>
      </div>
    </div>
  );
};

