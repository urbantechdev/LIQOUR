import React, { useState, useEffect } from 'react';
import { Wine } from 'lucide-react';

interface MobileSplashScreenProps {
  /** Optional callback fired when splash screen finishes exit transition */
  onFinish?: () => void;
  /** Force splash screen to show even if viewport is wider than mobile (useful for testing) */
  forceShow?: boolean;
}

export const MobileSplashScreen: React.FC<MobileSplashScreenProps> = ({
  onFinish
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    setIsExiting(false);

    // Auto-dismiss after 2 seconds with smooth exit fade
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        setIsVisible(false);
        if (onFinish) onFinish();
      }, 450);
    }, 2000);

    // Replay handler for when user clicks "Splash" in navigation
    const handleReplay = () => {
      setIsExiting(false);
      setIsVisible(true);
      setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => {
          setIsVisible(false);
          if (onFinish) onFinish();
        }, 450);
      }, 2000);
    };
    window.addEventListener('vaairo-replay-splash', handleReplay);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('vaairo-replay-splash', handleReplay);
    };
  }, [onFinish]);

  // Early dismiss if user taps anywhere
  const handleTapToSkip = () => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onFinish) onFinish();
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <aside
      aria-label="VAAIRO Splash"
      onClick={handleTapToSkip}
      className={`fixed inset-0 z-[999999] bg-[#0A006E] text-white flex items-center justify-center select-none cursor-pointer overflow-hidden transition-all duration-500 ease-out ${
        isExiting
          ? 'opacity-0 scale-105 pointer-events-none'
          : 'opacity-100 scale-100 pointer-events-auto'
      }`}
    >
      <style>{`
        @keyframes headerTitleReveal {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-header-title-reveal {
          animation: headerTitleReveal 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Moving Silent Scanner Sweep Container (Matches Header Design) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
        <div className="silent-scanner-beam" />
      </div>

      {/* Exact Header Title Font Design & Brand Identity */}
      <div className="relative z-20 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 px-6 text-center sm:text-left animate-header-title-reveal">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-white border-2 border-white flex items-center justify-center text-[#0A006E] shadow-2xl shrink-0 relative overflow-hidden">
          <div className="silent-scanner-beam-fast" />
          <Wine className="w-9 h-9 sm:w-11 sm:h-11 text-[#0A006E] stroke-[2.4] drop-shadow-xs relative z-10" />
        </div>

        <div className="min-w-0 flex flex-col items-center sm:items-start">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 sm:gap-3">
            <h1 className="font-montserrat font-black italic text-5xl sm:text-6xl lg:text-7xl tracking-tighter text-white drop-shadow-md leading-none">
              VAAIRO
            </h1>
            <span className="bg-[#FFDE00] text-[#0A006E] text-xs sm:text-sm font-montserrat font-black italic px-3 py-1 rounded-full uppercase tracking-wider inline-flex items-center shadow-md">
              <span>ERP</span>
            </span>
          </div>
          <p className="font-subtitle font-montserrat font-semibold text-xs sm:text-base text-slate-200 tracking-wide mt-2">
            Choose it, get it, Drink it
          </p>
        </div>
      </div>
    </aside>
  );
};

export const SplashScreen = MobileSplashScreen;
