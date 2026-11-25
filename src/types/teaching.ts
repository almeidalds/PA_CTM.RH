export type TeachingModalityKind = "Idioma" | "Doutrina" | "Sem subdivisão";

export interface TeachingModality {
  id: string;
  trainingCode: string;
  name: string;
  kinds: TeachingModalityKind[];
  active: boolean;
  notes: string;
}

export interface TeachingQualification {
  id: string;
  employeeId: string;
  modalityId: string;
  name: string;
  active: boolean;
  notes: string;
}

export interface TeachingData {
  modalities: TeachingModality[];
  qualifications: TeachingQualification[];
}

export interface TeachingQualificationInput {
  id?: string;
  employeeId: string;
  employeeName: string;
  modalityId: string;
  active: boolean;
  notes: string;
}

export interface TeachingModalityInput {
  id?: string;
  trainingCode: string;
  name: string;
  kinds: TeachingModalityKind[];
  active: boolean;
  notes: string;
}

export type TeachingStatusFilter = "active" | "inactive" | "all";
export type TeachingView = "modality" | "instructor";
