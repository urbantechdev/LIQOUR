import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { useErp } from '../../context/ErpContext';
import {
  ShieldAlert,
  Clock,
  LogOut,
  CheckCircle2,
  Maximize2,
  Lock,
  Activity,
  CornerDownLeft
} from 'lucide-react';

const INACTIVITY_LIMIT_MS = 2 * 60 * 1000; // 2 minutes (120,000ms) of inactivity
const COUNTDOWN_SECONDS = 30; // 30-second countdown to 0

let manualFullscreenExit = false;
let autoFullscreenUnsupportedOrBlocked = false;

export const isPlatformFullscreen = (): boolean => {
  if (typeof document === 'undefined') return false;
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  if (
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  ) {
    return true;
  }
  try {
    if (window.parent && window.parent !== window && window.parent.document) {
      const parentDoc = window.parent.document as Document & {
        webkitFullscreenElement?: Element | null;
        mozFullScreenElement?: Element | null;
        msFullscreenElement?: Element | null;
      };
      if (
        parentDoc.fullscreenElement ||
        parentDoc.webkitFullscreenElement ||
        parentDoc.mozFullScreenElement ||
        parentDoc.msFullscreenElement
      ) {
        return true;
      }
    }
  } catch {
    // ignore cross-origin parent frame access
  }
  return false;
};

export const requestPlatformFullscreen = async (force = false): Promise<boolean> => {
  if (typeof document === 'undefined') return false;

  if (force) {
    manualFullscreenExit = false;
    autoFullscreenUnsupportedOrBlocked = false;
    try {
      sessionStorage.removeItem('vaairo_manual_exit_fullscreen');
    } catch {
      // ignore storage errors
    }
  }

  if ((manualFullscreenExit || autoFullscreenUnsupportedOrBlocked) && !force) {
    return false;
  }

  if (isPlatformFullscreen()) {
    return true;
  }

  try {
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
      mozRequestFullScreen?: () => Promise<void> | void;
      msRequestFullscreen?: () => Promise<void> | void;
    };

    if (docEl.requestFullscreen) {
      await docEl.requestFullscreen({ navigationUI: 'hide' }).catch(() => docEl.requestFullscreen());
    } else if (docEl.webkitRequestFullscreen) {
      await docEl.webkitRequestFullscreen();
    } else if (docEl.mozRequestFullScreen) {
      await docEl.mozRequestFullScreen();
    } else if (docEl.msRequestFullscreen) {
      await docEl.msRequestFullscreen();
    }

    if (isPlatformFullscreen()) {
      window.dispatchEvent(new CustomEvent('vaairo:fullscreen-change'));
      return true;
    }
  } catch {
    // Fall through to parent document attempt if inside a same-origin frame
  }

  try {
    if (
      window.parent &&
      window.parent !== window &&
      window.parent.document?.documentElement?.requestFullscreen
    ) {
      await window.parent.document.documentElement.requestFullscreen();
      if (isPlatformFullscreen()) {
        window.dispatchEvent(new CustomEvent('vaairo:fullscreen-change'));
        return true;
      }
    }
  } catch {
    // Ignore cross-origin or browser gesture restriction silently
  }

  if (!isPlatformFullscreen()) {
    autoFullscreenUnsupportedOrBlocked = true;
  }
  return isPlatformFullscreen();
};

export const exitPlatformFullscreen = async (): Promise<void> => {
  manualFullscreenExit = true;
  try {
    sessionStorage.setItem('vaairo_manual_exit_fullscreen', 'true');
  } catch {
    // ignore storage errors
  }
  try {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      mozFullScreenElement?: Element | null;
      msFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
      mozCancelFullScreen?: () => Promise<void> | void;
      msExitFullscreen?: () => Promise<void> | void;
    };
    if (
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    ) {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
      }
    } else if (
      window.parent &&
      window.parent !== window &&
      window.parent.document?.fullscreenElement
    ) {
      await window.parent.document.exitFullscreen();
    }
  } catch {
    // Ignore errors silently
  } finally {
    window.dispatchEvent(new CustomEvent('vaairo:fullscreen-change'));
  }
};

export const SessionSecurityMonitor: React.FC = () => {
  const { isAuthenticated, currentUser, currentRole, activeBranch, logout } = useErp();

  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);

  const inactivityTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const isPromptOpenRef = useRef(false);

  // Keep ref synced with state so event listeners always read latest value
  useEffect(() => {
    isPromptOpenRef.current = isPromptOpen;
  }, [isPromptOpen]);

  // 1. AUTO FULL-SCREEN INJECTION WHEN USING THIS PLATFORM
  // Note: Never listen on mouseup/touchend/keydown in capture phase as fullscreen requests mid-gesture
  // can cancel button click synthesis or cause focus shifts.
  useEffect(() => {
    manualFullscreenExit = false;
    try {
      sessionStorage.removeItem('vaairo_manual_exit_fullscreen');
    } catch {
      // ignore storage errors
    }
  }, []);

  // Clear all timers helper
  const clearAllTimers = useCallback(() => {
    if (inactivityTimerRef.current !== null) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Start the 2-minute inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (!isAuthenticated) {
      clearAllTimers();
      isPromptOpenRef.current = false;
      setIsPromptOpen(false);
      setSecondsLeft(COUNTDOWN_SECONDS);
      return;
    }

    // Do not reset via background mouse movement once the 30-second countdown prompt is actively displayed
    if (isPromptOpenRef.current) {
      return;
    }

    if (inactivityTimerRef.current !== null) {
      window.clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = window.setTimeout(() => {
      setSecondsLeft(COUNTDOWN_SECONDS);
      isPromptOpenRef.current = true;
      setIsPromptOpen(true);
    }, INACTIVITY_LIMIT_MS);
  }, [isAuthenticated, clearAllTimers]);

  // Continue Session handler (from popup button or keyboard shortcut)
  const handleContinueSession = useCallback(() => {
    clearAllTimers();
    isPromptOpenRef.current = false;
    setIsPromptOpen(false);
    setSecondsLeft(COUNTDOWN_SECONDS);
    inactivityTimerRef.current = window.setTimeout(() => {
      setSecondsLeft(COUNTDOWN_SECONDS);
      isPromptOpenRef.current = true;
      setIsPromptOpen(true);
    }, INACTIVITY_LIMIT_MS);
  }, [clearAllTimers]);

  // Log off immediately or when 30s countdown hits 0
  const handleAutoLogOff = useCallback(() => {
    clearAllTimers();
    isPromptOpenRef.current = false;
    setIsPromptOpen(false);
    logout();
  }, [clearAllTimers, logout]);

  // Allow manual trigger via custom event (e.g. from Header security timer button)
  useEffect(() => {
    const onManualTrigger = () => {
      if (!isAuthenticated) return;
      clearAllTimers();
      setSecondsLeft(COUNTDOWN_SECONDS);
      isPromptOpenRef.current = true;
      setIsPromptOpen(true);
    };
    window.addEventListener('vaairo:trigger-countdown', onManualTrigger);
    return () => window.removeEventListener('vaairo:trigger-countdown', onManualTrigger);
  }, [isAuthenticated, clearAllTimers]);

  // Keyboard shortcut when prompt is open (Enter or Escape continues session)
  useEffect(() => {
    if (!isPromptOpen || !isAuthenticated) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        handleContinueSession();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPromptOpen, isAuthenticated, handleContinueSession]);

  // 2. LISTEN FOR USER ACTIVITY WHEN AUTHENTICATED
  useEffect(() => {
    if (!isAuthenticated) {
      clearAllTimers();
      setIsPromptOpen(false);
      return;
    }

    resetInactivityTimer();

    const activityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'wheel',
      'click'
    ];

    const onUserActivity = () => {
      if (!isPromptOpenRef.current) {
        resetInactivityTimer();
      }
    };

    activityEvents.forEach(evt => {
      window.addEventListener(evt, onUserActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach(evt => {
        window.removeEventListener(evt, onUserActivity);
      });
      clearAllTimers();
    };
  }, [isAuthenticated, resetInactivityTimer, clearAllTimers]);

  // 3. 30-SECOND COUNTDOWN TO 0 WHEN PROMPT IS OPEN
  useEffect(() => {
    if (!isPromptOpen || !isAuthenticated) {
      if (countdownIntervalRef.current !== null) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    countdownIntervalRef.current = window.setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (countdownIntervalRef.current !== null) {
            window.clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current !== null) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [isPromptOpen, isAuthenticated]);

  // Trigger auto log-off cleanly via effect when countdown reaches 0
  useEffect(() => {
    if (isPromptOpen && isAuthenticated && secondsLeft <= 0) {
      handleAutoLogOff();
    }
  }, [secondsLeft, isPromptOpen, isAuthenticated, handleAutoLogOff]);

  // Urgency phase calculations
  const progressRatio = Math.max(0, Math.min(1, secondsLeft / COUNTDOWN_SECONDS));
  const progressPercentage = Math.round(progressRatio * 100);
  const isCritical = secondsLeft <= 8;
  const isWarning = secondsLeft > 8 && secondsLeft <= 16;

  // SVG Circular Dial geometry
  const dialSize = 188;
  const strokeWidth = 8;
  const center = dialSize / 2;
  const radius = center - strokeWidth - 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progressRatio);

  // Orbiting indicator dot coordinates on the SVG circle
  const angleRad = (progressRatio * 360 - 90) * (Math.PI / 180);
  const dotX = center + radius * Math.cos(angleRad);
  const dotY = center + radius * Math.sin(angleRad);

  // Dynamic semantic colors by urgency phase
  const phaseConfig = isCritical
    ? {
        label: 'Critical Auto-Lock Imminent',
        accentHex: '#DC2626',
        secondaryHex: '#EF4444',
        glowClass: 'from-red-600/35 via-rose-500/15 to-transparent',
        ringTextClass: 'text-red-600',
        barGradient: 'from-red-600 via-rose-500 to-amber-500',
        statusDot: 'bg-red-500',
        borderAccent: 'border-red-500'
      }
    : isWarning
    ? {
        label: 'Session Lock Approaching',
        accentHex: '#D97706',
        secondaryHex: '#F59E0B',
        glowClass: 'from-amber-500/30 via-yellow-500/15 to-transparent',
        ringTextClass: 'text-amber-600',
        barGradient: 'from-amber-500 via-yellow-500 to-[#0A006E]',
        statusDot: 'bg-amber-400',
        borderAccent: 'border-amber-400'
      }
    : {
        label: '2-Min Inactivity Guard Active',
        accentHex: '#0A006E',
        secondaryHex: '#2563EB',
        glowClass: 'from-[#FFDE00]/25 via-[#0A006E]/40 to-transparent',
        ringTextClass: 'text-[#0A006E]',
        barGradient: 'from-[#0A006E] via-indigo-600 to-[#FFDE00]',
        statusDot: 'bg-[#FFDE00]',
        borderAccent: 'border-slate-200'
      };

  const formattedTime = `00:${String(secondsLeft).padStart(2, '0')}`;

  if (!isAuthenticated || !isPromptOpen) {
    return null;
  }

  return (
    <div
      key="session-security-backdrop"
      className="fixed inset-0 z-[10000] bg-slate-950/75 backdrop-blur-xl flex items-center justify-center p-4 overflow-hidden select-none animate-in fade-in duration-150"
    >
      {/* Ambient Animated Radial Aura Behind Modal */}
      <div
        className={`pointer-events-none absolute w-[520px] h-[520px] rounded-full bg-radial ${phaseConfig.glowClass} blur-3xl transition-opacity duration-500 ${
          isCritical ? 'opacity-90 scale-110' : 'opacity-55 scale-100'
        }`}
      />

      {/* Main Countdown Window Card */}
      <div
        key="session-security-modal"
        className={`relative w-full max-w-[460px] rounded-[32px] bg-white text-slate-900 border-2 ${phaseConfig.borderAccent} shadow-[0_32px_90px_-12px_rgba(0,0,0,0.65)] overflow-hidden animate-in zoom-in-95 duration-150`}
      >
        {/* Header Strip */}
        <div className="relative z-10 px-6 pt-5 pb-4 bg-[#FFDE00] text-[#0A006E] flex items-center justify-between border-b-2 border-[#0A006E]">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-[0_0_24px_rgba(10,0,110,0.3)] shrink-0 ${
                isCritical ? 'animate-pulse' : ''
              }`}
            >
              <ShieldAlert className="w-5 h-5 stroke-[2.4]" />
            </div>

            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-[#0A006E]/80">
                <span className={`w-2 h-2 rounded-full ${phaseConfig.statusDot} animate-ping`} />
                <span>{phaseConfig.label}</span>
              </div>
              <h3 className="font-montserrat font-black italic text-lg text-[#0A006E] tracking-tight leading-snug">
                Terminal Session Timeout
              </h3>
            </div>
          </div>

          {/* Digital Chrono Readout */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0A006E] border border-[#0A006E] font-mono tabular-nums text-xs font-bold text-[#FFDE00]">
            <Clock className="w-3.5 h-3.5 text-[#FFDE00] animate-spin" style={{ animationDuration: '6s' }} />
            <span>{formattedTime}</span>
          </div>
        </div>

        {/* Countdown Body (White Background) */}
        <div className="relative z-10 px-6 pt-6 pb-5 bg-white text-slate-900 flex flex-col items-center">
          <div className="relative flex items-center justify-center" style={{ width: dialSize, height: dialSize }}>
            {/* Expanding Sonar Ripple on Each Tick */}
            <motion.div
              key={`sonar-${secondsLeft}`}
              initial={{ scale: 0.78, opacity: 0.45 }}
              animate={{ scale: 1.22, opacity: 0 }}
              transition={{ duration: 0.95, ease: 'easeOut' }}
              className="absolute inset-3 rounded-full border pointer-events-none"
              style={{ borderColor: phaseConfig.accentHex }}
            />

            {/* Rotating Outer Technical Ring */}
            <svg
              width={dialSize}
              height={dialSize}
              viewBox={`0 0 ${dialSize} ${dialSize}`}
              className="absolute inset-0 pointer-events-none opacity-30 animate-spin"
              style={{ animationDuration: '24s' }}
            >
              <circle
                cx={center}
                cy={center}
                r={radius + 11}
                fill="none"
                stroke={phaseConfig.accentHex}
                strokeWidth="1.2"
                strokeDasharray="4 8"
              />
            </svg>

            {/* Primary SVG Progress Ring & 30 Segmented Ticks */}
            <svg
              width={dialSize}
              height={dialSize}
              viewBox={`0 0 ${dialSize} ${dialSize}`}
              className="relative z-10"
            >
              <defs>
                <linearGradient id="vaairoCountdownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={phaseConfig.accentHex} />
                  <stop offset="100%" stopColor={phaseConfig.secondaryHex} />
                </linearGradient>
                <filter id="vaairoGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* 30 Second Perimeter Tick Marks */}
              {Array.from({ length: COUNTDOWN_SECONDS }).map((_, idx) => {
                const tickAngle = (idx / COUNTDOWN_SECONDS) * 360 - 90;
                const rad = (tickAngle * Math.PI) / 180;
                const innerR = radius - 12;
                const outerR = radius - 7;
                const x1 = center + innerR * Math.cos(rad);
                const y1 = center + innerR * Math.sin(rad);
                const x2 = center + outerR * Math.cos(rad);
                const y2 = center + outerR * Math.sin(rad);
                const isActiveTick = idx < secondsLeft;
                return (
                  <line
                    key={idx}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isActiveTick ? phaseConfig.accentHex : 'rgba(15, 23, 42, 0.14)'}
                    strokeWidth={idx % 5 === 0 ? '2.2' : '1.4'}
                    strokeLinecap="round"
                    style={{ transition: 'stroke 0.25s ease' }}
                  />
                );
              })}

              {/* Background Track Circle */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="rgba(15, 23, 42, 0.08)"
                strokeWidth={strokeWidth}
              />

              {/* Smooth Animated Progress Arc */}
              <motion.circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="url(#vaairoCountdownGrad)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                transform={`rotate(-90 ${center} ${center})`}
                filter="url(#vaairoGlow)"
              />

              {/* Orbiting Leading Edge Node */}
              {secondsLeft > 0 && (
                <motion.circle
                  animate={{ cx: dotX, cy: dotY }}
                  transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                  r={5.5}
                  fill="#FFFFFF"
                  stroke={phaseConfig.accentHex}
                  strokeWidth="3"
                />
              )}
            </svg>

            {/* Center Animated Flip Counter */}
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center pointer-events-none">
              <div className="h-14 flex items-center justify-center overflow-hidden">
                <motion.span
                  key={secondsLeft}
                  initial={{ y: 18, opacity: 0, scale: 0.8 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                  className={`font-mono font-black text-5xl tabular-nums tracking-tight leading-none ${phaseConfig.ringTextClass}`}
                >
                  {String(secondsLeft).padStart(2, '0')}
                </motion.span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 mt-1">
                seconds remaining
              </span>
            </div>
          </div>

          {/* Operator Context & Explanation */}
          <div className="mt-4 text-center space-y-1.5 max-w-sm">
            <p className="text-sm font-bold text-slate-900" style={{ textWrap: 'balance' }}>
              No terminal input detected for 2 minutes
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Protecting active session for{' '}
              <strong className="text-[#0A006E] font-bold">{currentUser.name}</strong>
              <span className="mx-1.5 text-slate-400">·</span>
              <span className="text-slate-700 font-medium">{currentRole.replace('_', ' ')}</span>
              {activeBranch?.name ? (
                <>
                  <span className="mx-1.5 text-slate-400">·</span>
                  <span className="text-slate-500">{activeBranch.name}</span>
                </>
              ) : null}
            </p>
          </div>

          {/* Smooth Linear Timeline Bar with Shimmer */}
          <div className="w-full mt-5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono tabular-nums font-semibold">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#0A006E]" />
                <span>Auto-Lock Progress</span>
              </span>
              <span>{progressPercentage}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${phaseConfig.barGradient} relative overflow-hidden transition-all duration-700 ease-linear`}
                style={{ width: `${progressPercentage}%` }}
              >
                <div className="silent-scanner-beam-fast" />
              </div>
            </div>
          </div>

          {/* Primary & Secondary Action Controls */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-12 gap-3 mt-6">
            <button
              type="button"
              onClick={handleAutoLogOff}
              className="sm:col-span-5 py-3.5 px-4 rounded-2xl border border-slate-200 hover:border-red-300 bg-slate-100 hover:bg-red-50 active:scale-[0.98] text-slate-700 hover:text-red-700 font-montserrat font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Lock Now</span>
            </button>

            <button
              type="button"
              onClick={handleContinueSession}
              autoFocus
              className="sm:col-span-7 relative overflow-hidden py-3.5 px-5 rounded-2xl bg-[#FFDE00] hover:bg-[#e5c700] active:scale-[0.98] text-[#0A006E] border border-[#0A006E]/15 font-montserrat font-black italic text-sm flex items-center justify-center gap-2 shadow-[0_10px_25px_-5px_rgba(10,0,110,0.2)] transition cursor-pointer whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4 text-[#0A006E] shrink-0 stroke-[2.5]" />
              <span>Continue Session</span>
              <span className="ml-1 px-1.5 py-0.5 rounded bg-[#0A006E]/12 text-[#0A006E] font-mono not-italic text-[10px] font-bold inline-flex items-center gap-0.5">
                <CornerDownLeft className="w-2.5 h-2.5" />
                Enter
              </span>
            </button>
          </div>
        </div>

        {/* Quiet Footer Bar */}
        <div className="relative z-10 px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
          <div className="flex items-center gap-1.5">
            <Maximize2 className="w-3.5 h-3.5 text-[#0A006E]" />
            <span>Full-Screen Terminal Guard</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono tabular-nums text-slate-600">
            <Lock className="w-3 h-3 text-[#0A006E]" />
            <span>Press Enter or Esc to resume</span>
          </div>
        </div>
      </div>
    </div>
  );
};
