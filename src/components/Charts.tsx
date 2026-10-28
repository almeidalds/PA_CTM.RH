/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { GroupCount } from "../utils/groupUtils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, 
  PieChart, Pie, Legend, CartesianGrid
} from 'recharts';

import {
  Globe,
  Languages,
  Clock,
  ShieldAlert,
  CheckCircle,
  TrendingUp,
  HelpCircle,
  Sparkles,
  MapPin,
  AlertTriangle,
  UserCheck,
  CalendarClock,
  UserX,
  Info,
  CalendarCheck
} from "lucide-react";

interface ChartCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export const ChartCard: React.FC<ChartCardProps> = ({ title, description, children }) => (
  <div className="bg-white p-6 rounded-[22px] border border-sky-100 shadow-[0_12px_32px_rgba(57,88,134,0.055)] flex flex-col h-full hover:shadow-[0_18px_38px_rgba(57,88,134,0.11)] hover:-translate-y-0.5 transition-all duration-300">
    <div className="mb-5">
      <h4 className="text-base font-extrabold text-oxford tracking-tight">{title}</h4>
      <p className="text-[11px] text-slate-400 font-medium mt-1 leading-snug">{description}</p>
    </div>
    <div className="flex-1 flex items-center justify-center min-h-[240px] w-full">
      {children}
    </div>
  </div>
);

const COLORS = ["#638ecb", "#8aaee0", "#8aaee0", "#f43f5e", "#f59e0b", "#5aa76c", "#8aaee0", "#395886"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-oxford/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-xl border border-slate-700/50">
        <p className="font-extrabold text-[10px] text-slate-300 uppercase tracking-widest mb-1">{label || payload[0].payload.name}</p>
        <p className="font-black text-sm">{payload[0].value} <span className="text-[10px] font-normal text-slate-400">registros</span></p>
      </div>
    );
  }
  return null;
};

// 1. INSTRUTORES POR IDIOMA (Horizontal Bar Chart)
interface IdiomaChartProps {
  data: GroupCount[];
}
export const IdiomaChart: React.FC<IdiomaChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-slate-400">
        <Globe className="w-8 h-8 opacity-40 mb-2" />
        <p className="text-xs font-semibold">Sem dados de idiomas para exibir</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold', fill: '#395886' }} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F0F3FA', radius: 4 }} />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// 2. SAÍDAS POR MÊS
interface SaidasMesChartProps {
  data: { mes: string; count: number }[];
}
export const SaidasMesChart: React.FC<SaidasMesChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Clock className="w-8 h-8 opacity-40 mb-2" />
        <p className="text-xs font-semibold">Nenhuma saída de contrato prevista</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D5DEEF" />
        <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748B' }} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748B' }} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F0F3FA' }} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={32}>
           {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.count > 0 ? "#f43f5e" : "#d5deef"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// 3. INSTRUTORES POR ZONA (Donut Chart)
interface ZonaChartProps {
  data: GroupCount[];
}
export const ZonaChart: React.FC<ZonaChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-slate-400">
        <MapPin className="w-8 h-8 opacity-40 mb-2" />
        <p className="text-xs font-semibold">Sem dados geográficos para exibir</p>
      </div>
    );
  }

  const pieColors = ["#638ecb", "#8aaee0", "#5aa76c", "#F59E0B", "#8aaee0", "#64748B"];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          innerRadius={70}
          outerRadius={95}
          paddingAngle={4}
          dataKey="count"
          stroke="none"
          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
          labelLine={false}
          cx="50%"
          cy="45%"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#395886', paddingTop: '20px' }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

// 4. INSTRUTORES POR TURNO
interface TurnoChartProps {
  data: GroupCount[];
}
export const TurnoChart: React.FC<TurnoChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-slate-400">
        <Clock className="w-8 h-8 opacity-40 mb-2" />
        <p className="text-xs font-semibold">Sem dados de turnos para exibir</p>
      </div>
    );
  }

  const turnoColors = ["#638ecb", "#8aaee0", "#8aaee0"];

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D5DEEF" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold', fill: '#64748B' }} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold', fill: '#64748B' }} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F0F3FA' }} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={turnoColors[index % turnoColors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// 5. DISTRIBUIÇÃO POR STATUS
interface StatusChartProps {
  data: GroupCount[];
}
export const StatusChart: React.FC<StatusChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-slate-400">
        <Info className="w-8 h-8 opacity-40 mb-2" />
        <p className="text-xs font-semibold">Sem dados de status de funcionários</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    Ativo: "#638ecb",
    "A começar": "#8aaee0",
    Encerrado: "#f43f5e",
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          innerRadius={0}
          outerRadius={95}
          dataKey="count"
          stroke="#fff"
          strokeWidth={2}
          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
          labelLine={true}
          cx="50%"
          cy="45%"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={statusColors[entry.name] || COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#395886', paddingTop: '20px' }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

// 6. CONTRATOS POR FAIXA DE RISCO
interface RiscoChartProps {
  data: { name: string; count: number; percentage: number }[];
}
export const RiscoChart: React.FC<RiscoChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-slate-400">
        <ShieldAlert className="w-8 h-8 opacity-40 mb-2" />
        <p className="text-xs font-semibold">Sem dados de análise de riscos</p>
      </div>
    );
  }

  const riscoColors: Record<string, string> = {
    Crítico: "#ef4444",
    Alto: "#f59e0b",
    Médio: "#638ecb",
    Baixo: "#8aaee0",
    "Sem risco": "#10b981",
    "Cadastro incompleto": "#64748b",
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis dataKey="name" type="category" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#395886' }} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F0F3FA', radius: 4 }} />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={riscoColors[entry.name] || COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
