import React, { useRef, useEffect } from 'react';
import { Camera, AlertTriangle, ShieldCheck, Cpu, X, CheckCircle, UserCheck } from 'lucide-react';

export default function CameraDebugHud({
  isOpen,
  onClose,
  detectionInfo,
  cameraStatus,
  errorMessage,
  videoElement
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // Use a ref for detectionInfo to avoid restarting the canvas render loop on every detection frame
  const detectionInfoRef = useRef(detectionInfo);
  detectionInfoRef.current = detectionInfo;

  useEffect(() => {
    if (!isOpen || !videoElement) return;

    let isRunning = true;

    const initCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        if (isRunning) animFrameRef.current = requestAnimationFrame(initCanvas);
        return;
      }

      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');

      const render = () => {
        if (!isRunning) return;

        if (videoElement.readyState >= 2) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

          const currentDetection = detectionInfoRef.current;
          if (currentDetection && currentDetection.boundingBox) {
            const scaleX = canvas.width / (videoElement.videoWidth || 640);
            const scaleY = canvas.height / (videoElement.videoHeight || 480);

            const { originX, originY, width, height } = currentDetection.boundingBox;
            const x = originX * scaleX;
            const y = originY * scaleY;
            const w = width * scaleX;
            const h = height * scaleY;

            // Box color: Emerald if <= 2m, Amber if > 2m
            ctx.strokeStyle = currentDetection.isWithinRange ? '#10b981' : '#f59e0b';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, w, h);

            // Distance Tag
            ctx.fillStyle = currentDetection.isWithinRange ? '#10b981' : '#f59e0b';
            ctx.fillRect(x, Math.max(0, y - 22), 150, 20);

            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 11px monospace';
            ctx.fillText(
              `~${currentDetection.estimatedDistance}m (${currentDetection.confidence}%)`,
              x + 4,
              Math.max(14, y - 7)
            );
          }
        }

        animFrameRef.current = requestAnimationFrame(render);
      };

      render();
    };

    initCanvas();

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isOpen, videoElement]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-16 right-3 z-50 select-none animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="bg-slate-900/95 backdrop-blur-xl border-2 border-slate-700 rounded-3xl p-5 shadow-2xl w-80 md:w-96 text-white">
        {/* Header with Close Button */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-amber-400" />
            <div>
              <h4 className="font-black text-sm text-white">Vision IA • MediaPipe</h4>
              <p className="text-[10px] text-slate-400">Détection de présence en temps réel (~2m)</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono font-bold bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-lg text-slate-300">
              {detectionInfo.fps || 0} FPS
            </span>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition"
              title="Fermer le moniteur caméra"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Camera Feed Canvas */}
        {cameraStatus === 'READY' ? (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-slate-800 shadow-inner">
            <canvas ref={canvasRef} className="w-full h-full object-cover" />
            {detectionInfo.isWithinRange && (
              <div className="absolute top-2 left-2 bg-emerald-500 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow">
                Visiteur à portée (&lt; 2m)
              </div>
            )}
            {detectionInfo.faceDetected && !detectionInfo.isWithinRange && (
              <div className="absolute top-2 left-2 bg-amber-500 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow">
                Visiteur éloigné (&gt; 2m)
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-950 p-6 rounded-2xl text-center text-xs text-slate-400 border border-slate-800">
            <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="font-semibold text-slate-300">
              {cameraStatus === 'INITIALIZING' ? 'Initialisation de MediaPipe...' : errorMessage || 'Caméra désactivée ou indisponible.'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Utilisez le bouton "Simulation manuelle" en bas.</p>
          </div>
        )}

        {/* Real-time Metrics and Confirmation Filter */}
        <div className="mt-3.5 space-y-2.5 text-xs">
          {/* Anti-rebound 1.0s confirmation progress */}
          <div>
            <div className="flex justify-between font-bold mb-1">
              <span className="text-slate-400 flex items-center space-x-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Confirmation anti-passants (1,0s) :</span>
              </span>
              <span className="font-mono text-amber-400 font-black">
                {Math.round(detectionInfo.confirmationProgress * 100)} %
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700/60">
              <div
                className="bg-emerald-400 h-full transition-all duration-100 ease-out"
                style={{ width: `${detectionInfo.confirmationProgress * 100}%` }}
              />
            </div>
          </div>

          {/* Distance Indicator */}
          <div className="flex justify-between items-center py-1.5 px-3 bg-slate-950/70 rounded-xl border border-slate-800">
            <span className="text-slate-400 font-semibold">Distance estimée :</span>
            <span className="font-mono font-bold text-white text-xs">
              {detectionInfo.estimatedDistance ? (
                <span className={detectionInfo.isWithinRange ? 'text-emerald-400 font-black' : 'text-amber-400'}>
                  {detectionInfo.estimatedDistance} m
                </span>
              ) : (
                <span className="text-slate-500 font-normal">Aucun visage</span>
              )}
            </span>
          </div>

          {/* Privacy Notice */}
          <div className="pt-2 border-t border-slate-800 flex items-center space-x-2 text-[10px] text-emerald-400/90 font-medium">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span>Traitement 100% local en mémoire vive (zéro image enregistrée).</span>
          </div>
        </div>
      </div>
    </div>
  );
}
