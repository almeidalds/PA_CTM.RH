/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normalized = status?.trim();

  let bgClass = "bg-gray-100 text-gray-700 border-gray-200";
  let dotClass = "bg-gray-400";

  if (normalized === "Ativo") {
    bgClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    dotClass = "bg-emerald-600";
  } else if (normalized === "Encerrado") {
    bgClass = "bg-rose-50 text-rose-700 border-rose-200";
    dotClass = "bg-red-500";
  } else if (normalized === "A começar") {
    bgClass = "bg-sky-50 text-sky-700 border-sky-200";
    dotClass = "bg-sky-600";
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${bgClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {normalized || "Desconhecido"}
    </span>
  );
};
