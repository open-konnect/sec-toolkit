export interface JsonToTsOptions {
  rootName: string;
  declarationType: 'interface' | 'type';
}

export interface JsonToTsResult {
  code: string;
  success: boolean;
  error?: string;
}
