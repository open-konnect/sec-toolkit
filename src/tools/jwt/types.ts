import { SecurityFindingData } from '../../components/tool/SecurityFinding';

export interface JwtHeader {
  alg?: string;
  typ?: string;
  kid?: string;
  cty?: string;
  [key: string]: unknown;
}

export interface JwtPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  [key: string]: unknown;
}

export interface ParsedJwt {
  raw: string;
  segments: {
    rawHeader: string;
    rawPayload: string;
    rawSignature: string;
  };
  header: JwtHeader | null;
  payload: JwtPayload | null;
  hasSignature: boolean;
  isValidStructure: boolean;
  parseError?: string;
}

export interface JwtAnalysisResult {
  parsed: ParsedJwt | null;
  findings: SecurityFindingData[];
  overallStatus: 'valid_structure' | 'invalid_structure' | 'empty';
}
