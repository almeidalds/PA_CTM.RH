import { useEffect, useState } from "react";
import { AlertCircle, Languages, LoaderCircle, Pencil } from "lucide-react";
import type { RhEmployee } from "../types/rh";
import type { TranslationCapability, TranslationData } from "../types/translation";
import { loadEmployeeTranslationCapabilities } from "../services/translationCapabilitiesDataSource";
import { TranslationManagementPanel } from "./TranslationManagementPanel";

interface EmployeeTranslationSectionProps {
  employee: RhEmployee;
}

export function EmployeeTranslationSection({ employee }: EmployeeTranslationSectionProps) {
  const [capabilities, setCapabilities] = useState<TranslationCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [managing, setManaging] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setCapabilities(await loadEmployeeTranslationCapabilities(employee.recordId));
    } catch (refreshError) {
      console.error("Falha ao carregar as habilitações do funcionário:", refreshError);
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Não foi possível carregar as habilitações de tradução.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [employee.recordId]);

  const handleChanged = (data: TranslationData) => {
    setCapabilities(
      data.capabilities.filter(
        (capability) => capability.employeeId.toLowerCase() === employee.recordId.toLowerCase(),
      ),
    );
  };

  return (
    <>
      <section className="flex h-full min-w-0 flex-col space-y-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_24px_rgba(0,48,87,0.045)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-xs font-bold text-oxford">
            <span className="h-4 w-1 rounded-full bg-jordy" />
            <Languages className="h-4 w-4 text-yinmn" />
            Habilitações de Tradução
          </h3>
          <button type="button" onClick={() => setManaging(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-sky-50 px-3 text-[11px] font-bold text-yinmn transition hover:bg-sky-100">
            <Pencil className="h-3.5 w-3.5" /> Editar Habilitações
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando do Dataverse...
          </div>
        ) : error ? (
          <div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        ) : capabilities.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 p-4 text-center text-xs text-slate-500">
            Nenhuma habilitação de tradução cadastrada.
          </div>
        ) : (
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            {[...capabilities]
              .sort((left, right) => left.languageName.localeCompare(right.languageName, "pt-BR"))
              .map((capability) => (
                <article key={capability.id} className="min-h-28 rounded-xl border border-transparent bg-slate-50 p-3.5 transition-colors hover:border-sky-200 hover:bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm text-oxford">{capability.languageName}</strong>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${capability.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                      {capability.active ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold">
                    <span className={`rounded-lg px-2 py-1 ${capability.workshops ? "bg-sky-100 text-yinmn" : "bg-white text-slate-400"}`}>Workshops: {capability.workshops ? "Sim" : "Não"}</span>
                    <span className={`rounded-lg px-2 py-1 ${capability.devotionals ? "bg-violet-100 text-violet-700" : "bg-white text-slate-400"}`}>Devocionais: {capability.devotionals ? "Sim" : "Não"}</span>
                  </div>
                  {capability.notes && <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-slate-500">{capability.notes}</p>}
                </article>
              ))}
          </div>
        )}
      </section>

      {managing && (
        <TranslationManagementPanel
          employees={[employee]}
          initialEmployeeId={employee.recordId}
          lockEmployee
          onClose={() => setManaging(false)}
          onChanged={handleChanged}
        />
      )}
    </>
  );
}
