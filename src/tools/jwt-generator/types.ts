export type JwtSignAlgorithm = 'HS256' | 'HS384' | 'HS512' | 'none';

export interface JwtGenerateParams {
  algorithm: JwtSignAlgorithm;
  headerJson: string;
  payloadJson: string;
  secret: string;
}

export interface JwtGenerateResult {
  token: string;
  success: boolean;
  error?: string;
  headerEncoded: string;
  payloadEncoded: string;
  signatureEncoded: string;
}
