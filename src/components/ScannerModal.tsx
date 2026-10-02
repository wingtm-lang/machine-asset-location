import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  Keyboard,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Flashlight,
  ArrowRight,
  Search,
} from 'lucide-react';
import jsQR from 'jsqr';
import { useAuth } from '../services/authContext';
import { getTranslation } from '../services/translations';
import { storageService } from '../services/storage';
import { soundService } from '../services/sound';
import { Machine } from '../types';
import { getMachineLabel } from '../utils/machineName';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMachine?: (machine: Machine) => void;
  onQuickMove?: (machine: Machine) => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onSelectMachine,
  onQuickMove,
}) => {
  const { language, canAccessSite } = useAuth();
  const [mode, setMode] = useState<'physical' | 'camera'>('physical');
  const [inputValue, setInputValue] = useState('');
  const [scannedMachine, setScannedMachine] = useState<Machine | null>(null);
  const [searchLatency, setSearchLatency] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Auto-focus input for 2D physical scanner
  useEffect(() => {
    if (isOpen && mode === 'physical') {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mode]);

  // Handle Camera lifecycle
  useEffect(() => {
    if (isOpen && mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, mode, facingMode]);

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Kamera tidak didukung pada peramban ini.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        requestAnimationFrame(tickVideoScan);
      }
    } catch (err: unknown) {
      console.warn('Camera access denied or error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setCameraError(msg || getTranslation('camera_not_allowed', language));
      setMode('physical'); // fallback
    }
  };

  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const capabilities = (track as unknown as { getCapabilities?: () => { torch?: boolean } }).getCapabilities?.();
        if (capabilities?.torch) {
          await (track as unknown as { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
            advanced: [{ torch: !torchOn }],
          });
          setTorchOn(!torchOn);
        } else {
          alert('Lampu senter tidak didukung pada kamera perangkat ini.');
        }
      } catch {
        // Ignore
      }
    }
  };

  const tickVideoScan = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data) {
            handleScanSuccess(code.data);
            return; // stop scanning loop momentarily
          }
        }
      }
    }
    animationFrameId.current = requestAnimationFrame(tickVideoScan);
  };

  // Common Scan Handler
  const handleScanSuccess = (scannedText: string) => {
    setErrorMessage(null);
    const cleanCode = extractCode(scannedText);

    const { machine, searchTimeMs } = storageService.getMachineByCode(cleanCode);
    setSearchLatency(searchTimeMs);

    if (machine) {
      soundService.playSuccess();
      setScannedMachine(machine);
      setInputValue('');
    } else {
      soundService.playError();
      setScannedMachine(null);
      setErrorMessage(`Mesin dengan Barcode/Kode Aset "${cleanCode}" tidak ditemukan di database.`);
    }
  };

  // Extracts 12-digit barcode or asset code if wrapped in URL or text
  const extractCode = (raw: string): string => {
    const text = raw.trim();
    // 12 digits barcode e.g. 000000066145
    const barcodeMatch = text.match(/\b\d{12}\b/);
    if (barcodeMatch) return barcodeMatch[0];

    // Asset code pattern e.g. IDN-8-2009-1396
    const assetMatch = text.match(/IDN-[\w-]+/i);
    if (assetMatch) return assetMatch[0];

    return text;
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    handleScanSuccess(inputValue);
  };

  if (!isOpen) return null;

  const hasSiteAccess = scannedMachine ? canAccessSite(scannedMachine.siteId) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                {getTranslation('scan_modal_title', language)}
              </h3>
              <p className="text-xs text-slate-500">
                {mode === 'physical'
                  ? 'Siap menerima scan dari barcode gun 2D (QR Code)'
                  : 'Arahkan kamera ke QR Code label mesin'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="px-5 pt-3 pb-1 border-b border-slate-100 bg-slate-50/40 flex gap-2">
          <button
            onClick={() => {
              stopCamera();
              setMode('physical');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              mode === 'physical'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>{getTranslation('physical_mode', language)}</span>
          </button>
          <button
            onClick={() => {
              stopCamera();
              setMode('camera');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              mode === 'camera'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>{getTranslation('camera_mode', language)}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* CAMERA VIEWFINDER */}
          {mode === 'camera' && (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-300 shadow-inner">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Viewfinder Target Grid */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-emerald-400/80 rounded-2xl relative shadow-lg">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                  <div className="w-full h-0.5 bg-emerald-400/70 absolute top-1/2 -translate-y-1/2 animate-pulse" />
                </div>
              </div>

              {/* Camera Controls Overlay */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                  }
                  className="p-2 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white backdrop-blur-md border border-slate-600 shadow-md"
                  title={getTranslation('switch_camera', language)}
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-2 rounded-full backdrop-blur-md border border-slate-600 shadow-md ${
                    torchOn ? 'bg-amber-500 text-slate-950' : 'bg-slate-900/80 text-white'
                  }`}
                  title={getTranslation('torch_toggle', language)}
                >
                  <Flashlight className="w-4 h-4" />
                </button>
              </div>

              {cameraError && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
                  <p className="text-xs text-slate-300 mb-3">{cameraError}</p>
                  <button
                    onClick={() => setMode('physical')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
                  >
                    Beralih ke Input Manual
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PHYSICAL SCANNER INPUT / MANUAL INPUT */}
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Input Scanner / Pencarian Barcode:
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={getTranslation('scan_input_placeholder', language)}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-sm text-slate-900 font-mono placeholder:text-slate-400 shadow-xs"
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{getTranslation('search', language)}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 flex items-center justify-between">
              <span>Menerima Barcode 12-digit (cth: 000000066145) atau Kode Aset (cth: IDN-8-2009-1396)</span>
              {searchLatency !== null && (
                <span className="text-emerald-700 font-mono text-[10px] font-bold">
                  ⚡ Latensi: {searchLatency}ms
                </span>
              )}
            </p>
          </form>

          {/* ERROR ALERT */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-800 text-xs animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          {/* SCANNED RESULT CARD (Fase 0 #2) */}
          {scannedMachine && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-slate-900 text-sm">
                    {getMachineLabel(scannedMachine).primary}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    scannedMachine.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : scannedMachine.status === 'BROKEN'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : scannedMachine.status === 'IN_REPAIR'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : scannedMachine.status === 'LOANED'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  {scannedMachine.status}
                </span>
              </div>

              {/* Machine Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[10px] text-slate-500 font-semibold">{getTranslation('asset_code', language)}</div>
                  <div className="font-mono font-bold text-blue-700 truncate">{scannedMachine.assetCode}</div>
                </div>

                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[10px] text-slate-500 font-semibold">{getTranslation('barcode', language)}</div>
                  <div className="font-mono font-bold text-slate-800 truncate">{scannedMachine.barcode}</div>
                </div>

                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[10px] text-slate-500 font-semibold">{getTranslation('current_location', language)}</div>
                  <div className="font-bold text-amber-700 truncate">{scannedMachine.locationId}</div>
                </div>

                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[10px] text-slate-500 font-semibold">{getTranslation('current_site', language)}</div>
                  <div className="font-bold text-emerald-700">{scannedMachine.siteId}</div>
                </div>

                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[10px] text-slate-500 font-semibold">{getTranslation('serial', language)}</div>
                  <div className="font-mono text-slate-700 truncate">{scannedMachine.serial}</div>
                </div>

                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[10px] text-slate-500 font-semibold">{getTranslation('manufacturer', language)}</div>
                  <div className="font-medium text-slate-800 truncate">
                    {scannedMachine.manufacturer} {scannedMachine.model}
                  </div>
                </div>
              </div>

              {/* In Transit Alert */}
              {scannedMachine.pendingTransferId && (
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Mesin dalam status IN TRANSIT (Transfer ID: {scannedMachine.pendingTransferId})</span>
                </div>
              )}

              {/* Site Permission Warning */}
              {!hasSiteAccess && (
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{getTranslation('no_site_access_error', language)} (Site: {scannedMachine.siteId})</span>
                </div>
              )}

              {/* Quick Actions Footer */}
              <div className="flex items-center gap-2 pt-1">
                {onSelectMachine && (
                  <button
                    onClick={() => {
                      onSelectMachine(scannedMachine);
                      onClose();
                    }}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-colors"
                  >
                    {getTranslation('details', language)}
                  </button>
                )}

                {hasSiteAccess && !scannedMachine.pendingTransferId && onQuickMove && (
                  <button
                    onClick={() => {
                      onQuickMove(scannedMachine);
                      onClose();
                    }}
                    className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <span>{getTranslation('move', language)}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
