import React, { useEffect, useRef, useState } from 'react';

export interface CenterScreenFeedbackData {
  type: 'SUCCESS' | 'ERROR';
  title: string;
  message?: string;
  subtext?: string;
  durationMs?: number;
}

interface CenterScreenFeedbackProps {
  feedback: CenterScreenFeedbackData | null;
  onDismiss?: () => void;
}

const ANIMATED_FEEDBACK_KEYFRAMES = `
  @keyframes centerFeedbackPop {
    0% {
      opacity: 0;
      transform: scale(0.75) translateY(12px);
    }
    50% {
      opacity: 1;
      transform: scale(1.04) translateY(-2px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  @keyframes centerAutoPopAndFade {
    0% {
      opacity: 0;
      transform: scale(0.78) translateY(12px);
    }
    22% {
      opacity: 1;
      transform: scale(1.03) translateY(-2px);
    }
    35%, 72% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
    100% {
      opacity: 0;
      transform: scale(0.92) translateY(-8px);
    }
  }
  @keyframes centerBackdropAutoFade {
    0% {
      opacity: 0;
    }
    20%, 72% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
  @keyframes centerTickDraw {
    0% {
      stroke-dashoffset: 60;
      opacity: 0;
    }
    30% {
      opacity: 1;
    }
    100% {
      stroke-dashoffset: 0;
      opacity: 1;
    }
  }
  @keyframes centerXDraw {
    0% {
      stroke-dashoffset: 50;
      opacity: 0;
    }
    30% {
      opacity: 1;
    }
    100% {
      stroke-dashoffset: 0;
      opacity: 1;
    }
  }
  @keyframes centerPulseRing {
    0% {
      transform: scale(0.85);
      opacity: 0.9;
    }
    50% {
      transform: scale(1.28);
      opacity: 0;
    }
    100% {
      transform: scale(1.35);
      opacity: 0;
    }
  }
  @keyframes centerShakeHorizontal {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px) rotate(-2deg); }
    40% { transform: translateX(8px) rotate(2deg); }
    60% { transform: translateX(-5px) rotate(-1deg); }
    80% { transform: translateX(5px) rotate(1deg); }
  }
  .animate-center-pop {
    animation: centerFeedbackPop 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .animate-center-auto-lifecycle {
    animation: centerAutoPopAndFade 0.72s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .animate-backdrop-auto-lifecycle {
    animation: centerBackdropAutoFade 0.72s ease-out forwards;
  }
  .animate-tick-path {
    stroke-dasharray: 60;
    stroke-dashoffset: 60;
    animation: centerTickDraw 0.34s 0.06s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .animate-x-path-1 {
    stroke-dasharray: 50;
    stroke-dashoffset: 50;
    animation: centerXDraw 0.28s 0.05s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .animate-x-path-2 {
    stroke-dasharray: 50;
    stroke-dashoffset: 50;
    animation: centerXDraw 0.28s 0.14s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .animate-center-pulse-ring {
    animation: centerPulseRing 1.1s cubic-bezier(0.16, 1, 0.3, 1) infinite;
  }
  .animate-center-shake {
    animation: centerShakeHorizontal 0.38s ease-in-out;
  }
`;

export const AnimatedSuccessTickLogo: React.FC<{ size?: 'xs' | 'sm' | 'md' | 'lg' }> = ({
  size = 'md'
}) => {
  const dimensions =
    size === 'xs'
      ? 'w-5 h-5 border'
      : size === 'sm'
      ? 'w-7 h-7 border-2'
      : size === 'lg'
      ? 'w-20 h-20 sm:w-24 sm:h-24 border-4'
      : 'w-10 h-10 border-2';
  const svgDimensions =
    size === 'xs'
      ? 'w-3.5 h-3.5'
      : size === 'sm'
      ? 'w-4 h-4'
      : size === 'lg'
      ? 'w-12 h-12 sm:w-14 sm:h-14'
      : 'w-6 h-6';

  return (
    <span className="relative inline-flex items-center justify-center shrink-0">
      <style>{ANIMATED_FEEDBACK_KEYFRAMES}</style>
      <span
        className={`absolute ${
          size === 'lg' ? '-inset-3' : '-inset-1'
        } rounded-full bg-[#34D186]/30 animate-center-pulse-ring pointer-events-none`}
      />
      <span
        className={`relative ${dimensions} rounded-full bg-gradient-to-tr from-[#1E9E60] via-[#34D186] to-[#5AE09F] text-white flex items-center justify-center shadow-[0_8px_22px_rgba(52,209,134,0.45)] border-white animate-center-pop`}
      >
        <svg
          className={`${svgDimensions} stroke-white fill-none drop-shadow-xs`}
          viewBox="0 0 52 52"
        >
          <circle cx="26" cy="26" r="23" stroke="rgba(255,255,255,0.32)" strokeWidth="3.5" />
          <path
            className="animate-tick-path"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="5.5"
            d="M14 27l8.5 8.5L38 17"
          />
        </svg>
      </span>
    </span>
  );
};

export const AnimatedErrorLogo: React.FC<{ size?: 'xs' | 'sm' | 'md' | 'lg' }> = ({
  size = 'md'
}) => {
  const dimensions =
    size === 'xs'
      ? 'w-5 h-5 border'
      : size === 'sm'
      ? 'w-7 h-7 border-2'
      : size === 'lg'
      ? 'w-20 h-20 sm:w-24 sm:h-24 border-4'
      : 'w-10 h-10 border-2';
  const svgDimensions =
    size === 'xs'
      ? 'w-3.5 h-3.5'
      : size === 'sm'
      ? 'w-4 h-4'
      : size === 'lg'
      ? 'w-12 h-12 sm:w-14 sm:h-14'
      : 'w-6 h-6';

  return (
    <span className="relative inline-flex items-center justify-center shrink-0">
      <style>{ANIMATED_FEEDBACK_KEYFRAMES}</style>
      <span
        className={`absolute ${
          size === 'lg' ? '-inset-3' : '-inset-1'
        } rounded-full bg-rose-500/30 animate-center-pulse-ring pointer-events-none`}
      />
      <span
        className={`relative ${dimensions} rounded-full bg-gradient-to-tr from-red-600 via-rose-600 to-amber-600 text-white flex items-center justify-center shadow-[0_8px_22px_rgba(225,29,72,0.45)] border-white animate-center-shake`}
      >
        <svg
          className={`${svgDimensions} stroke-white fill-none drop-shadow-xs`}
          viewBox="0 0 52 52"
        >
          <circle cx="26" cy="26" r="23" stroke="rgba(255,255,255,0.32)" strokeWidth="3.5" />
          <path
            className="animate-x-path-1"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="5.5"
            d="M17 17l18 18"
          />
          <path
            className="animate-x-path-2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="5.5"
            d="M35 17L17 35"
          />
        </svg>
      </span>
    </span>
  );
};

export const CenterScreenFeedback: React.FC<CenterScreenFeedbackProps> = ({
  feedback,
  onDismiss
}) => {
  const [visible, setVisible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [current, setCurrent] = useState<CenterScreenFeedbackData | null>(null);
  const [animSeq, setAnimSeq] = useState(0);

  // Store onDismiss in a ref so parent re-renders never reset our auto-fade timers
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const feedbackKey = feedback
    ? `${feedback.type}|${feedback.title}|${feedback.message || ''}|${feedback.subtext || ''}`
    : '';

  useEffect(() => {
    if (!feedback) {
      setVisible(false);
      setIsFadingOut(false);
      return;
    }

    setCurrent(feedback);
    setVisible(true);
    setIsFadingOut(false);
    setAnimSeq(prev => prev + 1);

    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 500);

    const dismissTimer = setTimeout(() => {
      setVisible(false);
      setIsFadingOut(false);
      setCurrent(null);
      if (onDismissRef.current) {
        onDismissRef.current();
      }
    }, 700);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
    // Depend strictly on feedbackKey so parent re-renders never cancel the auto-fade timer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbackKey]);

  if (!current || !visible) return null;

  const isSuccess = current.type === 'SUCCESS';

  const handleCompleteDismiss = () => {
    setVisible(false);
    setIsFadingOut(false);
    setCurrent(null);
    if (onDismissRef.current) {
      onDismissRef.current();
    }
  };

  return (
    <div
      key={animSeq}
      role="status"
      aria-live="polite"
      onClick={handleCompleteDismiss}
      className={`fixed inset-0 z-[100000] flex items-center justify-center p-4 pointer-events-none select-none transition-opacity duration-200 ease-out ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <style>{ANIMATED_FEEDBACK_KEYFRAMES}</style>

      {/* Dim backdrop vignette — auto-fades via CSS keyframe */}
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[3px] animate-backdrop-auto-lifecycle" />

      {/* Center Animated Modal Badge — pops in, shows tick/error, and fades itself out automatically */}
      <div
        onAnimationEnd={e => {
          if (e.animationName === 'centerAutoPopAndFade') {
            handleCompleteDismiss();
          }
        }}
        className={`relative z-10 animate-center-auto-lifecycle rounded-[32px] p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-[0_24px_64px_rgba(0,0,0,0.38)] min-w-[270px] max-w-sm border backdrop-blur-xl ${
          isSuccess
            ? 'bg-white/95 text-slate-900 border-[#34D186]/50 shadow-emerald-950/20'
            : 'bg-white/95 text-slate-900 border-rose-400/50 shadow-rose-950/20'
        }`}
      >
        {/* Animated Icon Circle with Glowing Pulse Rings */}
        <div className="relative flex items-center justify-center mb-4">
          {isSuccess ? (
            <AnimatedSuccessTickLogo size="lg" />
          ) : (
            <AnimatedErrorLogo size="lg" />
          )}
        </div>

        {/* Title */}
        <h4
          className={`font-montserrat font-black text-xl sm:text-2xl tracking-tight ${
            isSuccess ? 'text-[#1E9E60]' : 'text-rose-950'
          }`}
        >
          {current.title}
        </h4>

        {/* Message / Product Name */}
        {current.message && (
          <p className="mt-1.5 text-xs sm:text-sm font-semibold text-slate-700 max-w-[260px] leading-snug line-clamp-2">
            {current.message}
          </p>
        )}

        {/* Subtext / Price / Amount Badge */}
        {current.subtext && (
          <div className="mt-2.5">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-black shadow-xs ${
                isSuccess
                  ? 'bg-emerald-100 text-[#1E9E60] border border-[#34D186]/50'
                  : 'bg-rose-100 text-rose-900 border border-rose-300'
              }`}
            >
              {current.subtext}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
