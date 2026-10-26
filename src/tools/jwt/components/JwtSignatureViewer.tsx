import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { CopyButton } from '../../../components/ui/CopyButton';

export interface JwtSignatureViewerProps {
  rawSignature: string;
  alg?: string;
}

export const JwtSignatureViewer: React.FC<JwtSignatureViewerProps> = ({
  rawSignature,
  alg
}) => {
  const hasSignature = Boolean(rawSignature && rawSignature.trim().length > 0);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-slate-300">
            Signature Segment
          </span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
            {alg ? `alg: ${alg}` : 'No Algorithm'}
          </span>
        </div>
        {hasSignature && <CopyButton text={rawSignature} />}
      </div>

      <div className="p-4 space-y-4">
        {/* Verification Status Warning Box */}
        <div className="p-3.5 rounded-lg bg-sky-950/40 border border-sky-800/60 text-sky-200 text-xs">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-sky-300 block">
                Decoding a JWT does not verify its signature.
              </span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                This client-side tool extracts and parses the encoded JSON structures in your browser.
                To confirm this token was actually signed by the legitimate issuer and has not been forged,
                your backend API or identity gateway must verify the signature using the issuer’s public key or shared secret.
              </p>
            </div>
          </div>
        </div>

        {/* Raw Signature string */}
        <div>
          <span className="text-[11px] font-mono text-slate-400 block mb-1">
            Raw Signature (Base64URL):
          </span>
          {hasSignature ? (
            <div className="p-3 rounded-lg bg-slate-950/90 font-mono text-xs text-rose-300/90 break-all select-all border border-slate-800/80">
              {rawSignature}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-slate-950/60 font-mono text-xs text-slate-500 italic border border-slate-800">
              No signature bytes present in token.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
