export interface LegalSectionDto {
  id: string;
  heading: string;
  content: string;
}

export interface LegalDocumentDto {
  title: string;
  lastUpdated: string;
  sections: LegalSectionDto[];
}
