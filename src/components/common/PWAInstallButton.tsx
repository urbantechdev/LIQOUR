import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Smartphone,
  Monitor,
  Share2,
  PlusSquare,
  CheckCircle2,
  X,
  Wifi,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  variant?: 'header' | 'menu' | 'banner';
}

export const Windows11Icon: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <rect x="1" y="1" width="10" height="10" rx="1.4" />
    <rect x="13" y="1" width="10" height="10" rx="1.4" />
    <rect x="1" y="13" width="10" height="10" rx="1.4" />
    <rect x="13" y="13" width="10" height="10" rx="1.4" />
  </svg>
);

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, isInIframe, swReady, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [installNotice, setInstallNotice] = useState<string | null>(null);

  // If already running as an installed standalone PWA, hide the install button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        setInstallNotice('VAAIRO ERP & Liquor Hub installed to your device!');
        setTimeout(() => setInstallNotice(null), 4000);
        return;
      }
    }
    setShowGuideModal(true);
  };

  return (
    <>
      {variant === 'menu' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-montserrat font-bold text-[#0A006E] bg-[#FFDE00]/25 hover:bg-[#FFDE00]/50 transition flex items-center justify-between gap-2 cursor-pointer"
        >
          <span className="flex items-center gap-2.5">
            <Windows11Icon className="w-6 h-6 text-[#0A006E] shrink-0" />
            <span>{isIOS ? 'Install App on iOS' : 'Install VAAIRO App'}</span>
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[#0A006E] text-[#FFDE00] font-mono text-[9px] font-black uppercase">
            APP
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          aria-label={isIOS ? 'Install on iOS' : 'Install App'}
          title={
            isInstallable
              ? 'Install VAAIRO ERP & Liquor Hub App'
              : isIOS
              ? 'Install VAAIRO App on iPhone or iPad Home Screen'
              : 'Install VAAIRO App (Offline-Ready)'
          }
          className="p-1.5 bg-transparent border-0 shadow-none flex items-center justify-center transition shrink-0 cursor-pointer text-[#FFDE00] hover:text-white hover:scale-110 active:scale-95"
        >
          <Windows11Icon className="w-8 h-8 sm:w-9 sm:h-9 shrink-0" />
        </button>
      )}

      {installNotice &&
        (typeof document !== 'undefined'
          ? createPortal(
              <div className="fixed top-28 right-6 z-[10000] px-4 py-2.5 rounded-2xl bg-[#34D186] text-[#FFDE00] border-2 border-[#FFDE00] shadow-xl font-montserrat font-black text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-[#FFDE00] shrink-0" />
                <span>{installNotice}</span>
              </div>,
              document.body
            )
          : null)}

      {showGuideModal &&
        (typeof document !== 'undefined'
          ? createPortal(
              <div
                className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4"
                onClick={() => setShowGuideModal(false)}
              >
                <div
                  className="bg-white text-slate-900 rounded-none sm:rounded-3xl max-w-lg w-full h-dvh sm:h-auto max-h-dvh sm:max-h-[90vh] shadow-2xl border-0 sm:border-2 border-[#0A006E] overflow-hidden flex flex-col justify-between animate-in fade-in zoom-in-95"
                  onClick={e => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="bg-[#FFDE00] px-6 py-5 text-[#0A006E] flex items-start justify-between border-b-4 border-[#0A006E]">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-md shrink-0">
                        <Download className="w-6 h-6 stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-montserrat font-black italic text-lg sm:text-xl text-[#0A006E] tracking-tight">
                            Install VAAIRO PWA
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-[10px] uppercase">
                            Offline Ready
                          </span>
                        </div>
                        <p className="text-xs text-[#0A006E]/80 font-semibold mt-0.5">
                          Standalone POS Terminal, ERP &amp; Direct Liquor Hub App
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowGuideModal(false)}
                      className="w-8 h-8 rounded-full bg-[#0A006E]/10 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] flex items-center justify-center transition cursor-pointer"
                      aria-label="Close Install Guide"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
                    {/* PWA Status Strip */}
                    <div className="grid grid-cols-3 gap-2 bg-[#F0F2F0] p-3 rounded-2xl border border-slate-200">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-montserrat font-black text-[10px] text-slate-900 uppercase">
                            Web Manifest
                          </div>
                          <div className="text-[10px] text-slate-500">Standalone</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-[#0A006E] shrink-0" />
                        <div>
                          <div className="font-montserrat font-black text-[10px] text-slate-900 uppercase">
                            Service Worker
                          </div>
                          <div className="text-[10px] text-emerald-700 font-bold">
                            {swReady ? 'Active & Caching' : 'Registered'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <div className="font-montserrat font-black text-[10px] text-slate-900 uppercase">
                            POS Queue
                          </div>
                          <div className="text-[10px] text-slate-500">Offline Sync</div>
                        </div>
                      </div>
                    </div>

                    {/* Direct Native Prompt Button if supported */}
                    {isInstallable && (
                      <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-600 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-montserrat font-black text-xs text-[#1E9E60]">
                            One-Click Native Installation Ready
                          </div>
                          <div className="text-[11px] text-emerald-800 mt-0.5">
                            Your browser supports direct home screen &amp; desktop app installation.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await install();
                            if (ok) setShowGuideModal(false);
                          }}
                          className="px-4 py-2.5 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 shrink-0 shadow-md transition cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>Install Now</span>
                        </button>
                      </div>
                    )}

                    {/* iOS Safari Instructions */}
                    <div
                      className={`p-4 rounded-2xl border space-y-2.5 ${
                        isIOS
                          ? 'bg-amber-50/70 border-2 border-[#0A006E]'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-montserrat font-black text-xs text-[#0A006E]">
                          <Smartphone className="w-4 h-4 text-[#0A006E]" />
                          <span>Install on iPhone / iPad (iOS Safari)</span>
                        </div>
                        {isIOS && (
                          <span className="px-2 py-0.5 rounded-full bg-[#0A006E] text-[#FFDE00] font-mono text-[9px] font-bold">
                            Detected Device
                          </span>
                        )}
                      </div>
                      <ol className="space-y-1.5 text-xs text-slate-700 list-decimal list-inside">
                        <li className="flex items-center gap-2">
                          <span className="font-bold text-[#0A006E]">1.</span>
                          <span>
                            Tap the <strong>Share</strong> button
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white border border-slate-300 text-[#0A006E]">
                            <Share2 className="w-3 h-3" />
                          </span>
                          <span>in the Safari toolbar.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="font-bold text-[#0A006E]">2.</span>
                          <span>
                            Scroll down and tap <strong>Add to Home Screen</strong>
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white border border-slate-300 text-[#0A006E]">
                            <PlusSquare className="w-3 h-3" />
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="font-bold text-[#0A006E]">3.</span>
                          <span>
                            Tap <strong>Add</strong> in the top-right corner to launch VAAIRO in full standalone mode.
                          </span>
                        </li>
                      </ol>
                    </div>

                    {/* Android & Desktop Chrome / Edge Instructions */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center gap-2 font-montserrat font-black text-xs text-slate-900">
                        <Monitor className="w-4 h-4 text-[#0A006E]" />
                        <span>Install on Desktop (Chrome / Edge) or Android</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-600">
                        <li className="flex items-start gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-[#0A006E] shrink-0 mt-0.5" />
                          <span>
                            <strong>Desktop Chrome / Edge:</strong> Click the{' '}
                            <strong>Install VAAIRO ERP</strong> icon on the right side of the browser address bar.
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-[#0A006E] shrink-0 mt-0.5" />
                          <span>
                            <strong>Android Chrome:</strong> Tap the browser menu (<strong>⋮</strong>) and select{' '}
                            <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                          </span>
                        </li>
                        {isInIframe && (
                          <li className="flex items-start gap-2 text-amber-900 bg-amber-100/80 p-2 rounded-xl border border-amber-300 mt-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-800 shrink-0 mt-0.5" />
                            <span>
                              <strong>Preview Tip:</strong> If viewing inside a preview frame, open the app in a standalone browser tab to trigger the native browser install prompt.
                            </span>
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-mono text-slate-500">
                      VAAIRO PWA • Offline POS &amp; KRA Queue Enabled
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowGuideModal(false)}
                      className="px-5 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-white font-montserrat font-bold text-xs transition cursor-pointer"
                    >
                      Got It
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )
          : null)}
    </>
  );
};
