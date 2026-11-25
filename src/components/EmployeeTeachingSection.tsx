import { useEffect, useState } from "react";
import { AlertCircle, GraduationCap, LoaderCircle, Pencil, Plus } from "lucide-react";
import type { RhEmployee } from "../types/rh";
import type { TeachingData } from "../types/teaching";
import {
  loadEmployeeTeachingQualifications,
  TEACHING_DATA_CHANGED_EVENT,
} from "../services/teachingQualificationsDataSource";
import { TeachingQualificationPanel } from "./TeachingQualificationPanel";

interface EmployeeTeachingSectionProps {
  employee: RhEmployee;
}

export function EmployeeTeachingSection({ employee }: EmployeeTeachingSectionProps) {
  const [data, setData] = useState<TeachingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [managerOpen, setManagerOpen] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loadEmployeeTeachingQualifications(employee.recordId));
    } catch (refreshError) {
      console.error("Falha ao carregar habilitações de ensino do funcionário:", refreshError);
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Não foi possível carregar as habilitações de ensino.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [employee.recordId]);

  useEffect(() => {
    const handleChanged = (event: Event) => {
      const updated = (event as CustomEvent<TeachingData>).detail;
      setData({
        modalities: updated.modalities,
        qualifications: updated.qualifications.filter(
          (qualification) =>
            qualification.employeeId.toLowerCase() === employee.recordId.toLowerCase(),
        ),
      });
    };
    window.addEventListener(TEACHING_DATA_CHANGED_EVENT, handleChanged);
    return () => window.removeEventListener(TEACHING_DATA_CHANGED_EVENT, handleChanged);
  }, [employee.recordId]);

  const modalityById = new Map(
    (data?.modalities || []).map((modality) => [modality.id.toLowerCase(), modality]),
  );
  const qualifications = [...(data?.qualifications || [])].sort((left, right) => {
    const leftModality = modalityById.get(left.modalityId.toLowerCase());
    const rightModality = modalityById.get(right.modalityId.toLowerCase());
    return `${leftModality?.trainingCode} ${leftModality?.name}`.localeCompare(
      `${rightModality?.trainingCode} ${rightModality?.name}`,
      "pt-BR",
    );
  });

  return (
    <>
      <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_8px_24px_rgba(0,48,87,0.045)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-yinmn">
              <GraduationCap className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-oxford">Apto a Ensinar</h3>
              <p className="mt-0.5 text-xs text-slate-500">Treinamentos e modalidades disponíveis para Distritos.</p>
            </div>
          </div>
          <button type="button" onClick={() => setManagerOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold text-yinmn hover:bg-sky-100">
            {qualifications.length ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {qualifications.length ? "Gerenciar" : "Adicionar"}
          </button>
        </header>

        {error ? (
          <div role="alert" className="flex items-start gap-2 p-4 text-sm text-rose-700 sm:px-5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 p-5 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando habilitações do Dataverse...
          </div>
        ) : qualifications.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">Nenhum tipo de treinamento foi encontrado para este instrutor. Clique em "Adicionar" para criar uma habilitação.</div>
        ) : (
          <div className="grid flex-1 gap-3 p-4 sm:grid-cols-2 sm:p-5">
            {qualifications.map((qualification) => {
              const modality = modalityById.get(qualification.modalityId.toLowerCase());
              return (
                <div key={qualification.id} className="min-h-28 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-yinmn">{modality?.trainingCode || "Sem código"}</p>
                      <strong className="mt-1 block truncate text-sm text-oxford">{modality?.name || "Modalidade não encontrada"}</strong>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${qualification.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                      {qualification.active ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(modality?.kinds.length ? modality.kinds : ["Sem subdivisão"]).map((kind) => <span key={kind} className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">{kind}</span>)}
                  </div>
                  {qualification.notes && <p className="mt-2 line-clamp-2 text-xs text-slate-500">{qualification.notes}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {managerOpen && (
        <TeachingQualificationPanel
          employees={[employee]}
          initialEmployeeId={employee.recordId}
          lockEmployee
          onClose={() => setManagerOpen(false)}
          onChanged={(updated) =>
            setData({
              modalities: updated.modalities,
              qualifications: updated.qualifications.filter(
                (qualification) =>
                  qualification.employeeId.toLowerCase() === employee.recordId.toLowerCase(),
              ),
            })
          }
        />
      )}
    </>
  );
}
