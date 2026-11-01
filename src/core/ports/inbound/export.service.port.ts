export type ExportFormat = 'csv' | 'json';

export interface ExportResult {
  contentType: string;
  filename: string;
  body: string;
}

export interface ExportServicePort {
  exportFoodItems(userId: string, format: ExportFormat): Promise<ExportResult>;
}
