export interface FixDiagnosticErrorsParams {
  documentUri: string;
  alwaysReturnContent: boolean;
}

export interface FixDiagnosticErrorsResult {
  documentUri: string;
  fixesApplied: number;
  newContent?: string | null;
}
