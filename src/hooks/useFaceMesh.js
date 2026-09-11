import { useState, useEffect, useRef, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { LANDMARKS, calculateEAR, calculateKissMetric } from '../utils/geometry';


export function useFaceMesh({ onFrameMetrics = null, baselineMouthRatio = 0.5 } = {}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const isRunningRef = useRef(false);

  // Keep latest callbacks in refs to avoid stale closures in requestAnimationFrame
  const onFrameMetricsRef = useRef(onFrameMetrics);
  onFrameMetricsRef.current = onFrameMetrics;
  const baselineMouthRatioRef = useRef(baselineMouthRatio);
  baselineMouthRatioRef.current = baselineMouthRatio;

  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('Initializing vision model...');
  const [hasFace, setHasFace] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [metrics, setMetrics] = useState({
    leftEAR: 0.35,
    rightEAR: 0.35,
    kissScore: 0,
    rawMouthRatio: 0.5,
    isLeftClosed: false,
    isRightClosed: false,
    isKissActive: false,
  });

  // Initialize Landmarker model
  useEffect(() => {
    let isCancelled = false;

    async function initLandmarker() {
      try {
        setLoadingStatus('Loading vision runtime wasm...');
        const fileset = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );

        if (isCancelled) return;

        setLoadingStatus('Loading facial landmark model...');
        let landmarkerInstance = null;

        // Try GPU delegate with local model first
        try {
          landmarkerInstance = await FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: '/models/face_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFaceBlendshapes: true,
          });
        } catch (gpuError) {
          console.warn('GPU delegate failed or local model path issue, trying CPU with CDN fallback:', gpuError);
          landmarkerInstance = await FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFaceBlendshapes: true,
          });
        }

        if (isCancelled) {
          landmarkerInstance?.close();
          return;
        }

        landmarkerRef.current = landmarkerInstance;
        setLoadingStatus('Requesting webcam access...');
        await startCamera();
      } catch (err) {
        console.error('Vision initialization error:', err);
        if (!isCancelled) {
          setCameraError(err.message || 'Failed to initialize vision engine');
          setIsLoading(false);
        }
      }
    }

    initLandmarker();

    return () => {
      isCancelled = true;
      stopCamera();
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch (e) {
          // Ignore
        }
        landmarkerRef.current = null;
      }
    };
  }, []);

  // Start webcam
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam API is not supported in this browser environment');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setIsLoading(false);
          setLoadingStatus('');
          startTrackingLoop();
        };
      }
    } catch (err) {
      console.warn('Webcam access error:', err);
      setCameraError(err.name === 'NotAllowedError' 
        ? 'Camera permission denied. Please allow camera access, or use Manual Fallback Mode.' 
        : `Camera error: ${err.message || 'Unable to access video device'}`);
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    isRunningRef.current = false;
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  // Main real-time detection loop
  const startTrackingLoop = useCallback(() => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    let lastVideoTime = -1;

    const renderLoop = () => {
      if (!isRunningRef.current) return;

      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (video && landmarker && video.readyState >= 2) {
        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const timestamp = performance.now();

          try {
            const results = landmarker.detectForVideo(video, timestamp);

            if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
              setHasFace(true);
              const landmarks = results.faceLandmarks[0];
              const blendshapes = results.faceBlendshapes?.[0]?.categories || null;

              // Compute Left and Right EAR
              // Note: in mirrored view, subject's left eye is on viewer's right
              const leftEAR = calculateEAR(landmarks, LANDMARKS.LEFT_EYE);
              const rightEAR = calculateEAR(landmarks, LANDMARKS.RIGHT_EYE);

              // Compute Kiss / Lip Pucker metric
              const kiss = calculateKissMetric(landmarks, blendshapes, baselineMouthRatioRef.current);

              const currentMetrics = {
                leftEAR: Number(leftEAR.toFixed(3)),
                rightEAR: Number(rightEAR.toFixed(3)),
                kissScore: Number(kiss.score.toFixed(3)),
                rawMouthRatio: Number(kiss.rawRatio.toFixed(3)),
                timestamp,
                landmarks,
                blendshapes,
              };

              setMetrics(currentMetrics);
              if (onFrameMetricsRef.current) {
                onFrameMetricsRef.current(currentMetrics);
              }

              // Draw landmarks onto canvas overlay if canvas exists
              drawLandmarkOverlay(canvasRef.current, video, landmarks);
            } else {
              setHasFace(false);
              clearCanvas(canvasRef.current);
            }
          } catch (detErr) {
            console.warn('Frame detection error:', detErr);
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();
  }, [onFrameMetrics, baselineMouthRatio]);

  return {
    videoRef,
    canvasRef,
    isLoading,
    loadingStatus,
    hasFace,
    cameraError,
    metrics,
    retryCamera: startCamera,
  };
}

/**
 * Draw minimal, aesthetic facial landmark points & mesh
 */
function drawLandmarkOverlay(canvas, video, landmarks) {
  if (!canvas || !landmarks) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const w = canvas.width;
  const h = canvas.height;

  // Draw eye contours
  drawFeaturePath(ctx, landmarks, [
    LANDMARKS.LEFT_EYE.CORNER_INNER,
    LANDMARKS.LEFT_EYE.TOP_1,
    LANDMARKS.LEFT_EYE.TOP_2,
    LANDMARKS.LEFT_EYE.CORNER_OUTER,
    LANDMARKS.LEFT_EYE.BOTTOM_2,
    LANDMARKS.LEFT_EYE.BOTTOM_1,
  ], true, '#06b6d4');

  drawFeaturePath(ctx, landmarks, [
    LANDMARKS.RIGHT_EYE.CORNER_INNER,
    LANDMARKS.RIGHT_EYE.TOP_1,
    LANDMARKS.RIGHT_EYE.TOP_2,
    LANDMARKS.RIGHT_EYE.CORNER_OUTER,
    LANDMARKS.RIGHT_EYE.BOTTOM_2,
    LANDMARKS.RIGHT_EYE.BOTTOM_1,
  ], true, '#06b6d4');

  // Draw mouth contour
  drawFeaturePath(ctx, landmarks, [
    LANDMARKS.MOUTH.CORNER_LEFT,
    LANDMARKS.MOUTH.UPPER_LIP_TOP,
    LANDMARKS.MOUTH.CORNER_RIGHT,
    LANDMARKS.MOUTH.LOWER_LIP_BOTTOM,
  ], true, '#f43f5e');

  // Draw subtle landmark dots for eyes and lips
  const keyPoints = [
    LANDMARKS.LEFT_EYE.CORNER_OUTER, LANDMARKS.LEFT_EYE.CORNER_INNER,
    LANDMARKS.RIGHT_EYE.CORNER_OUTER, LANDMARKS.RIGHT_EYE.CORNER_INNER,
    LANDMARKS.MOUTH.CORNER_LEFT, LANDMARKS.MOUTH.CORNER_RIGHT,
    LANDMARKS.MOUTH.UPPER_LIP_BOTTOM, LANDMARKS.MOUTH.LOWER_LIP_TOP,
  ];

  ctx.fillStyle = '#a855f7';
  keyPoints.forEach(idx => {
    const pt = landmarks[idx];
    if (pt) {
      ctx.beginPath();
      ctx.arc(pt.x * w, pt.y * h, 2.5, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
}

function drawFeaturePath(ctx, landmarks, indices, close = true, color = '#06b6d4') {
  if (!indices || indices.length < 2) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.shadowColor = color;
  ctx.shadowBlur = 4;
  ctx.beginPath();

  indices.forEach((idx, i) => {
    const pt = landmarks[idx];
    if (pt) {
      const x = pt.x * w;
      const y = pt.y * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  });

  if (close) ctx.closePath();
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function clearCanvas(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
