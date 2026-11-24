export interface TranslationCapability {
  id: string;
  employeeId: string;
  employeeLanguageId: string;
  languageId: string;
  languageName: string;
  name: string;
  workshops: boolean;
  devotionals: boolean;
  active: boolean;
  notes: string;
}

export interface TranslationLanguageLink {
  id: string;
  employeeId: string;
  languageId: string;
  languageName: string;
  active: boolean;
}

export interface TranslationLanguage {
  id: string;
  name: string;
  active: boolean;
}

export interface TranslationData {
  capabilities: TranslationCapability[];
  employeeLanguages: TranslationLanguageLink[];
  languages: TranslationLanguage[];
}

export interface TranslationCapabilityInput {
  id?: string;
  employeeId: string;
  employeeName: string;
  employeeLanguageId: string;
  workshops: boolean;
  devotionals: boolean;
  active: boolean;
  notes: string;
}

export type TranslationActivityFilter = "all" | "workshops" | "devotionals" | "both";
export type TranslationStatusFilter = "active" | "inactive" | "all";
