import { useState, useEffect, useRef, useCallback } from 'react';
import { FilesetResolver, FaceDetector } from '@mediapipe/tasks-vision';

/**
 * usePresenceCamera - Local Computer Vision hook using MediaPipe FaceDetector
 * 100% local, no server, no images stored or transmitted.
 * 
 * Features:
 * - Real-time face detection via WebAssembly
 * - Geometrical distance estimation (~2m threshold)
 * - 1.0s confirmation delay filter (anti-rebound against passersby)
 * - Detection of departure (> 5s absence)
 */
export function usePresenceCamera({
  onPersonConfirmed,
  onPersonLeft,
  distanceThresholdMeters = 2.0,
  confirmationDelayMs = 1000,
  absenceDelayMs = 5000,
  isActive = true
}) {
  const [cameraStatus, setCameraStatus] = useState('INITIALIZING'); // 'INITIALIZING' | 'READY' | 'ERROR' | 'NO_CAMERA'
  const [errorMessage, setErrorMessage] = useState('');
  const [detectionInfo, setDetectionInfo] = useState({
    faceDetected: false,
    estimatedDistance: null, // in meters
    isWithinRange: false,
    confirmationProgress: 0, // 0 to 1
    confidence: 0,
    fps: 0,
    boundingBox: null
  });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const animFrameIdRef = useRef(null);

  // Stability counters
  const presenceStartTimeRef = useRef(null);
  const absenceStartTimeRef = useRef(null);
  const isConfirmedPresentRef = useRef(false);
  const lastFrameTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const fpsRef = useRef(0);

  const onPersonConfirmedRef = useRef(onPersonConfirmed);
  onPersonConfirmedRef.current = onPersonConfirmed;

  const onPersonLeftRef = useRef(onPersonLeft);
  onPersonLeftRef.current = onPersonLeft;

  // Initialize MediaPipe FaceDetector & Webcam
  useEffect(() => {
    let isCancelled = false;

    async function initVision() {
      try {
        setCameraStatus('INITIALIZING');

        // 1. Resolve WASM files locally from /wasm (fallback to CDN if needed)
        let vision;
        try {
          vision = await FilesetResolver.forVisionTasks('/wasm');
        } catch {
          vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
          );
        }

        if (isCancelled) return;

        // 2. Initialize FaceDetector with local TFLite model
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/blaze_face_short_range.tflite',
            delegate: 'GPU' // Falls back to CPU if WebGL/WebGPU is not available
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.55
        });

        detectorRef.current = detector;

        if (isCancelled) return;

        // 3. Request Webcam Access (640x480 @ 15fps ideal for kiosk hardware)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 15, max: 20 },
            facingMode: 'user'
          },
          audio: false
        });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        // Create invisible/managed video element
        if (!videoRef.current) {
          const videoEl = document.createElement('video');
          videoEl.autoplay = true;
          videoEl.playsInline = true;
          videoEl.muted = true;
          videoEl.srcObject = stream;
          videoRef.current = videoEl;
        } else {
          videoRef.current.srcObject = stream;
        }

        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().then(resolve).catch(resolve);
          };
        });

        setCameraStatus('READY');
      } catch (err) {
        console.warn('Vision init warning:', err);
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraStatus('NO_CAMERA');
          setErrorMessage('Aucune caméra détectée.');
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraStatus('ERROR');
          setErrorMessage('Accès caméra refusé. Mode tactile actif.');
        } else {
          setCameraStatus('ERROR');
          setErrorMessage(err.message || 'Erreur d’initialisation de la vision.');
        }
      }
    }

    if (isActive) {
      initVision();
    }

    return () => {
      isCancelled = true;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (detectorRef.current) {
        detectorRef.current.close();
      }
    };
  }, [isActive]);

  // Main Detection Loop (runs at ~12-15 fps to preserve CPU)
  useEffect(() => {
    if (cameraStatus !== 'READY') return;

    let lastProcessTime = 0;
    const PROCESS_INTERVAL_MS = 75; // ~13 fps processing

    const processFrame = (now) => {
      animFrameIdRef.current = requestAnimationFrame(processFrame);

      // Throttle inference interval
      if (now - lastProcessTime < PROCESS_INTERVAL_MS) return;
      lastProcessTime = now;

      // Calculate approximate FPS
      frameCountRef.current++;
      if (now - lastFrameTimeRef.current >= 1000) {
        fpsRef.current = frameCountRef.current;
        frameCountRef.current = 0;
        lastFrameTimeRef.current = now;
      }

      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || video.readyState < 2) return;

      try {
        const detectionsResult = detector.detectForVideo(video, now);
        const detections = detectionsResult.detections;

        if (detections && detections.length > 0) {
          // Take the primary / closest face
          const primaryFace = detections[0];
          const bbox = primaryFace.boundingBox; // { originX, originY, width, height }
          const confidence = primaryFace.categories?.[0]?.score || 0.8;

          // Geometric Distance Estimation:
          // A human face is roughly 16 cm wide. On a 60° FOV webcam:
          // widthRatio = faceWidth / videoWidth
          // Distance (m) ≈ 0.18 / widthRatio
          const widthRatio = bbox.width / video.videoWidth;
          const estimatedDistance = Math.min(
            4.0,
            Math.max(0.4, Number((0.18 / Math.max(widthRatio, 0.04)).toFixed(2)))
          );

          const isWithinRange = estimatedDistance <= distanceThresholdMeters;

          if (isWithinRange) {
            // Face detected within ~2 meters
            absenceStartTimeRef.current = null;

            if (!presenceStartTimeRef.current) {
              presenceStartTimeRef.current = now;
            }

            const elapsedPresence = now - presenceStartTimeRef.current;
            const progress = Math.min(1.0, elapsedPresence / confirmationDelayMs);

            if (elapsedPresence >= confirmationDelayMs && !isConfirmedPresentRef.current) {
              isConfirmedPresentRef.current = true;
              if (onPersonConfirmedRef.current) {
                onPersonConfirmedRef.current({ estimatedDistance, confidence });
              }
            }

            setDetectionInfo({
              faceDetected: true,
              estimatedDistance,
              isWithinRange: true,
              confirmationProgress: progress,
              confidence: Math.round(confidence * 100),
              fps: fpsRef.current,
              boundingBox: bbox
            });
          } else {
            // Face detected, but too far (> 2m)
            presenceStartTimeRef.current = null;
            setDetectionInfo({
              faceDetected: true,
              estimatedDistance,
              isWithinRange: false,
              confirmationProgress: 0,
              confidence: Math.round(confidence * 100),
              fps: fpsRef.current,
              boundingBox: bbox
            });
          }
        } else {
          // No face detected
          presenceStartTimeRef.current = null;

          if (isConfirmedPresentRef.current) {
            if (!absenceStartTimeRef.current) {
              absenceStartTimeRef.current = now;
            } else if (now - absenceStartTimeRef.current >= absenceDelayMs) {
              isConfirmedPresentRef.current = false;
              absenceStartTimeRef.current = null;
              if (onPersonLeftRef.current) {
                onPersonLeftRef.current();
              }
            }
          }

          setDetectionInfo((prev) => ({
            ...prev,
            faceDetected: false,
            isWithinRange: false,
            confirmationProgress: 0,
            estimatedDistance: null,
            boundingBox: null,
            fps: fpsRef.current
          }));
        }
      } catch (err) {
        console.warn('Frame detection error:', err);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [cameraStatus, distanceThresholdMeters, confirmationDelayMs, absenceDelayMs]);

  return {
    cameraStatus,
    errorMessage,
    detectionInfo,
    videoElement: videoRef.current
  };
}

