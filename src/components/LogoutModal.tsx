import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../services/authContext';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const { logout } = useAuth();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleExecuteLogout = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      logout();
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-[2px] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white text-slate-900 rounded-[28px] w-full max-w-[340px] sm:max-w-[360px] p-7 shadow-2xl animate-in zoom-in-95 duration-200 select-none flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close 'X' button at top right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer rounded-full focus:outline-none"
          aria-label="Close"
        >
          <X className="w-4 h-4 stroke-[2]" />
        </button>

        {/* Minimalist Flat Cartoon Vector Illustration */}
        <div className="w-36 h-36 flex items-center justify-center mt-1 mb-1">
          <svg
            viewBox="0 0 160 160"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Background Floor Shadow */}
            <ellipse cx="80" cy="142" rx="55" ry="6" fill="#F1F5F9" />

            {/* Plant on the Left */}
            <g transform="translate(26, 102)">
              <path
                d="M10 38 C 4 30, 2 18, 6 8 C 12 18, 14 28, 12 38 Z"
                fill="#2DD4BF"
              />
              <path
                d="M14 38 C 18 24, 28 14, 34 10 C 30 22, 24 32, 16 38 Z"
                fill="#14B8A6"
              />
              <path
                d="M12 38 C 10 26, 12 12, 18 2 C 20 14, 18 28, 14 38 Z"
                fill="#0D9488"
              />
              <path
                d="M6 38 C 2 32, -2 24, 0 16 C 4 22, 6 30, 8 38 Z"
                fill="#5EEAD4"
              />
            </g>

            {/* Door Frame & Open Teal Door */}
            <rect
              x="46"
              y="28"
              width="50"
              height="106"
              rx="4"
              fill="#0F766E"
            />
            {/* Door Inner Aperture */}
            <rect
              x="49"
              y="31"
              width="44"
              height="100"
              rx="2"
              fill="#042F2E"
            />

            {/* Angled Open Door Leaf */}
            <path
              d="M48 31 L88 38 L88 132 L48 128 Z"
              fill="#0D9488"
            />
            <path
              d="M52 38 L84 43 L84 76 L52 73 Z"
              fill="#115E59"
              opacity="0.85"
            />
            <path
              d="M52 82 L84 85 L84 121 L52 118 Z"
              fill="#115E59"
              opacity="0.85"
            />

            {/* Door Knob / Handle */}
            <rect
              x="83"
              y="80"
              width="7"
              height="3.5"
              rx="1.5"
              fill="#F8FAFC"
            />
            <circle cx="84" cy="81.5" r="1.5" fill="#CBD5E1" />

            {/* Character (Administrator Peeking/Stepping Out) */}
            <g transform="translate(86, 32)">
              {/* Confused / Sparkle Marks above head */}
              <path
                d="M12 2 L14 5 M18 4 L18 8 M22 3 L20 6"
                stroke="#64748B"
                strokeWidth="1.2"
                strokeLinecap="round"
              />

              {/* Hair */}
              <path
                d="M14 10 C 10 10, 8 15, 8 20 C 8 26, 12 28, 14 28 C 16 28, 19 25, 20 20 C 20 14, 18 10, 14 10 Z"
                fill="#1E293B"
              />

              {/* Face & Ear */}
              <ellipse cx="14" cy="18" rx="4.5" ry="5.5" fill="#FCD34D" />
              <path
                d="M12 17 C 12 18, 13 18.5, 14 18.5"
                stroke="#92400E"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
              <circle cx="12.5" cy="16.5" r="0.8" fill="#1E293B" />

              {/* Hand on Door */}
              <circle cx="2" cy="46" r="2.5" fill="#FCD34D" />

              {/* Shirt / Top (Pale Coral / Pink) */}
              <path
                d="M10 24 C 6 26, 4 33, 4 45 L17 45 C 18 35, 16 26, 10 24 Z"
                fill="#FDA4AF"
              />
              {/* Arm reaching forward */}
              <path
                d="M7 28 C 2 34, 0 42, 3 47 C 5 45, 6 36, 10 32 Z"
                fill="#F43F5E"
              />

              {/* Pants / Skirt (Teal Green) */}
              <path
                d="M4 45 L18 45 L17 76 C 14 77, 10 77, 4 76 Z"
                fill="#0D9488"
              />

              {/* Legs & Shoes */}
              <rect x="5" y="76" width="3.5" height="18" rx="1.5" fill="#FCD34D" />
              <rect x="11" y="76" width="3.5" height="18" rx="1.5" fill="#FCD34D" />
              <ellipse cx="6" cy="94" rx="3.5" ry="2" fill="#1E293B" />
              <ellipse cx="12" cy="94" rx="3.5" ry="2" fill="#1E293B" />
            </g>

            {/* Cute Black/Grey Cat beside door */}
            <g transform="translate(102, 105)">
              {/* Cat Body */}
              <ellipse cx="16" cy="20" rx="9" ry="6" fill="#334155" />
              {/* Cat Head */}
              <circle cx="8" cy="15" rx="5" ry="5" fill="#334155" />
              {/* Cat Ears */}
              <polygon points="5,12 8,7 9,13" fill="#1E293B" />
              <polygon points="9,12 12,8 13,13" fill="#1E293B" />
              {/* Cat Tail Upward & Curved */}
              <path
                d="M24 18 C 28 14, 30 6, 27 2 C 25 6, 23 12, 22 17 Z"
                fill="#334155"
              />
              {/* Cat Legs */}
              <rect x="9" y="22" width="2" height="10" rx="1" fill="#1E293B" />
              <rect x="13" y="23" width="2" height="9" rx="1" fill="#1E293B" />
              <rect x="19" y="23" width="2" height="9" rx="1" fill="#1E293B" />
              <rect x="23" y="22" width="2" height="10" rx="1" fill="#1E293B" />
            </g>
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-slate-900 tracking-tight text-center mt-2 mb-2">
          Are you logging out?
        </h2>

        {/* Subtitle & Description */}
        <p className="text-[13px] leading-relaxed text-slate-500 text-center max-w-[280px] mb-6 font-normal">
          You can always log back in at any time.
        </p>

        {/* Action Buttons: Cancel (Pill White) & Log out (Pill Black) */}
        <div className="flex items-center justify-center gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-6 rounded-full text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-none cursor-pointer focus:outline-none"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteLogout}
            className="flex-1 py-2.5 px-6 rounded-full text-xs font-semibold text-white bg-black hover:bg-neutral-800 active:bg-neutral-900 transition-colors shadow-none cursor-pointer focus:outline-none"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutModal;
