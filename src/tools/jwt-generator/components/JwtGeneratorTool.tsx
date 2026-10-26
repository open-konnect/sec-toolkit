import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { JwtSignAlgorithm } from '../types';
import { generateJwt } from '../logic/jwtSigner';
import { CopyButton } from '../../../components/ui/CopyButton';
import { ClearButton } from '../../../components/ui/ClearButton';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { WarningMessage } from '../../../components/ui/WarningMessage';
import { KeyRound, ShieldAlert, Sparkles, ExternalLink, Lock } from 'lucide-react';
import { analytics } from '../../../lib/analytics';

export const JwtGeneratorTool: React.FC = () => {
  const [alg, setAlg] = useState<JwtSignAlgorithm>('HS256');
  const [secret, setSecret] = useState<string>('your-256-bit-secret-key-goes-here');
  
  const now = Math.floor(Date.now() / 1000);
  const [headerText, setHeaderText] = useState<string>(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }, null, 2)
  );
  const [payloadText, setPayloadText] = useState<string>(
    JSON.stringify({
      sub: 'usr_1049284',
      name: 'Alice Developer',
      role: 'admin',
      iat: now,
      exp: now + 3600
    }, null, 2)
  );

  const [generatedToken, setGeneratedToken] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Update header JSON when algorithm changes
  const handleAlgChange = (newAlg: JwtSignAlgorithm) => {
    setAlg(newAlg);
    try {
      const parsed = JSON.parse(headerText);
      parsed.alg = newAlg;
      setHeaderText(JSON.stringify(parsed, null, 2));
    } catch {
      setHeaderText(JSON.stringify({ alg: newAlg, typ: 'JWT' }, null, 2));
    }
    analytics.track('tool_used', { tool: 'jwt-generator', action: 'change_algorithm', algorithm: newAlg });
  };

  // Re-sign token
  useEffect(() => {
    let isCancelled = false;
    generateJwt({
      algorithm: alg,
      headerJson: headerText,
      payloadJson: payloadText,
      secret
    }).then((res) => {
      if (!isCancelled) {
        if (res.success) {
          setGeneratedToken(res.token);
          setError(null);
        } else {
          setGeneratedToken('');
          setError(res.error || 'Failed to sign token.');
        }
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [alg, headerText, payloadText, secret]);

  const addExpirationHours = (hours: number) => {
    try {
      const parsed = JSON.parse(payloadText);
      const currentNow = Math.floor(Date.now() / 1000);
      parsed.iat = currentNow;
      parsed.exp = currentNow + (hours * 3600);
      setPayloadText(JSON.stringify(parsed, null, 2));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Prominent Privacy & Local Execution Notice */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-900/40 flex items-start gap-3">
        <Lock className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <span className="font-semibold text-emerald-300 block">
            100% Client-Side HMAC Generation
          </span>
          <p className="text-slate-300 leading-relaxed">
            Your signing secret and payload claims are processed locally in your browser using the Web Cryptography API.
            Neither your secret key nor the generated JWT is ever transmitted over the network.
          </p>
        </div>
      </div>

      {/* Controls Bar: Algorithm & Secret */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Algorithm:</span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              {(['HS256', 'HS384', 'HS512', 'none'] as JwtSignAlgorithm[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => handleAlgChange(a)}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                    alg === a
                      ? (a === 'none' ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white')
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <Link
            to="/jwt-decoder"
            className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors"
          >
            <span>Open JWT Decoder & Security Analyzer</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {alg === 'none' && (
          <WarningMessage
            title="Warning: 'alg: none' Token"
            message="Unsecured JWTs have no cryptographic signature. Anyone can tamper with their payload. Never use unsecured tokens in production environments."
          />
        )}

        {alg !== 'none' && (
          <div className="space-y-1.5">
            <label htmlFor="jwt-secret" className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span>HMAC Secret Key:</span>
            </label>
            <input
              id="jwt-secret"
              type="text"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter your secret signing key..."
              className="w-full px-3.5 py-2 rounded-lg border border-slate-800 bg-slate-950 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
        )}
      </div>

      {/* Header and Payload Editors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Header Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-rose-400 uppercase tracking-wider">
              JOSE Header (JSON)
            </span>
            <ClearButton onClear={() => setHeaderText('{\n  "alg": "HS256",\n  "typ": "JWT"\n}')} label="Reset Header" />
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
            <textarea
              rows={6}
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              className="w-full bg-transparent font-mono text-xs text-rose-300 focus:outline-none resize-none"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Payload Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-purple-400 uppercase tracking-wider">
              Payload Claims (JSON)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => addExpirationHours(1)}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
                title="Set expiration to 1 hour from now"
              >
                +1 Hour Exp
              </button>
              <button
                type="button"
                onClick={() => addExpirationHours(24)}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
                title="Set expiration to 24 hours from now"
              >
                +24 Hours Exp
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
            <textarea
              rows={8}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              className="w-full bg-transparent font-mono text-xs text-purple-300 focus:outline-none resize-y"
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Generated Token Result */}
      {generatedToken && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
              Generated Compact Token (header.payload.signature)
            </span>
            <CopyButton text={generatedToken} label="Copy JWT" />
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 font-mono text-xs leading-relaxed break-all select-all selection:bg-brand-500 selection:text-slate-950 text-emerald-300">
            {generatedToken}
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
            <span>Length: {generatedToken.length} characters</span>
            <Link to="/jwt-decoder" className="text-emerald-400 hover:underline">
              Test in JWT Analyzer →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
