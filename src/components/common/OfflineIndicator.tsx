import React from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const { isOnline, wasOfflineRecently } = useOnlineStatus();

  if (isOnline && !wasOfflineRecently) {
    return null;
  }

  if (!isOnline) {
    return (
      <div className="fixed bottom-28 left-4 z-40 max-w-sm flex items-center gap-2.5 rounded-2xl bg-amber-500 text-slate-950 border-2 border-[#0A006E] px-4 py-2.5 text-xs font-montserrat font-black shadow-2xl animate-in fade-in pointer-events-none">
        <span className="h-2.5 w-2.5 rounded-full bg-[#0A006E] animate-ping shrink-0" />
        <WifiOff className="w-4 h-4 text-[#0A006E] shrink-0" />
        <div>
          <div>Offline Mode — Local PWA Cache Active</div>
          <div className="text-[10px] font-sans font-semibold text-slate-900">
            POS sales &amp; 16% VAT invoices are buffered locally.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-28 left-4 z-40 flex items-center gap-2 rounded-2xl bg-[#34D186] text-[#FFDE00] border-2 border-[#FFDE00] px-4 py-2 text-xs font-montserrat font-black shadow-xl animate-in fade-in pointer-events-none">
      <Wifi className="w-4 h-4 text-[#FFDE00] shrink-0" />
      <span>Back Online — ERP &amp; 16% VAT Ledger Synchronized</span>
    </div>
  );
};
