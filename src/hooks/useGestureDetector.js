import { useState, useRef, useEffect, useCallback } from 'react';

export const DEFAULT_THRESHOLDS = {
  blinkEAR: 0.22,          // EAR below this = eye closed
  winkEAR: 0.23,           // EAR below this for single eye
  winkDelta: 0.07,         // Difference between open and closed eye for wink
  kissThreshold: 0.52,     // Kiss score (0 to 1) required to trigger send
  cooldownMs: 700,         // Cooldown: 1/2 times greater (1.5x of previous 450ms)
  baselineLeftEAR: 0.34,   // Relaxed neutral EAR
  baselineRightEAR: 0.34,
  baselineMouthRatio: 0.50,
};

export function useGestureDetector({
  thresholds = DEFAULT_THRESHOLDS,
  onGesture = null,
  enabled = true,
}) {
  const onGestureRef = useRef(onGesture);
  onGestureRef.current = onGesture;

  const thresholdsRef = useRef(thresholds);
  thresholdsRef.current = thresholds;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const [activeGesture, setActiveGesture] = useState(null); // 'WINK_LEFT' | 'WINK_RIGHT' | 'BLINK' | 'KISS'
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [confidenceData, setConfidenceData] = useState({
    leftMargin: 0,
    rightMargin: 0,
    blinkMargin: 0,
    kissMargin: 0,
    smoothedLeftEAR: 0.35,
    smoothedRightEAR: 0.35,
    smoothedKissScore: 0,
    activeThresholds: DEFAULT_THRESHOLDS,
  });
  const [debugState, setDebugState] = useState({
    leftEyeState: 'open',
    rightEyeState: 'open',
    mouthState: 'neutral',
  });

  const lastTriggerTimeRef = useRef(0);
  const gestureHistoryRef = useRef([]);
  const eyeClosureStartTimeRef = useRef(null);
  const leftWinkStartTimeRef = useRef(null);
  const rightWinkStartTimeRef = useRef(null);
  const kissStartTimeRef = useRef(null);

  // 4-frame rolling moving average buffers to filter single-frame noise
  const leftEARBufferRef = useRef([]);
  const rightEARBufferRef = useRef([]);
  const kissScoreBufferRef = useRef([]);

  const getRollingAvg = (buf, val, maxLen = 4) => {
    buf.push(val);
    if (buf.length > maxLen) buf.shift();
    return buf.reduce((a, b) => a + b, 0) / buf.length;
  };

  // Runtime logging to verify calibrated thresholds are actively loaded
  useEffect(() => {
    console.log('[useGestureDetector] 🎯 ACTIVE RUNTIME THRESHOLDS LOADED:', {
      blinkEAR: thresholds.blinkEAR,
      winkEAR: thresholds.winkEAR,
      winkDelta: thresholds.winkDelta,
      kissThreshold: thresholds.kissThreshold,
      cooldownMs: thresholds.cooldownMs,
    });
  }, [thresholds]);

  // Process a frame's metrics
  const processFrame = useCallback((frameMetrics) => {
    if (!enabledRef.current || !frameMetrics) {
      leftWinkStartTimeRef.current = null;
      rightWinkStartTimeRef.current = null;
      eyeClosureStartTimeRef.current = null;
      kissStartTimeRef.current = null;
      return;
    }

    const currentThresholds = thresholdsRef.current || DEFAULT_THRESHOLDS;
    const now = performance.now();
    const timeSinceLastTrigger = now - lastTriggerTimeRef.current;
    const cooldown = currentThresholds.cooldownMs || 700;

    // Rolling moving average across 4 consecutive frames
    const smoothedLeftEAR = Number(getRollingAvg(leftEARBufferRef.current, frameMetrics.leftEAR).toFixed(3));
    const smoothedRightEAR = Number(getRollingAvg(rightEARBufferRef.current, frameMetrics.rightEAR).toFixed(3));
    const smoothedKissScore = Number(getRollingAvg(kissScoreBufferRef.current, frameMetrics.kissScore).toFixed(3));

    // Live margin indicators (how far smoothed value is from threshold)
    // Positive margin = passed threshold (active)
    // Negative margin = distance remaining to trigger
    const leftMargin = Number((currentThresholds.winkEAR - smoothedLeftEAR).toFixed(3));
    const rightMargin = Number((currentThresholds.winkEAR - smoothedRightEAR).toFixed(3));
    const blinkMargin = Number((currentThresholds.blinkEAR - Math.max(smoothedLeftEAR, smoothedRightEAR)).toFixed(3));
    const kissMargin = Number((smoothedKissScore - currentThresholds.kissThreshold).toFixed(3));

    setConfidenceData({
      leftMargin,
      rightMargin,
      blinkMargin,
      kissMargin,
      smoothedLeftEAR,
      smoothedRightEAR,
      smoothedKissScore,
      activeThresholds: currentThresholds,
    });

    // Check if in cooldown
    if (timeSinceLastTrigger < cooldown) {
      setCooldownRemaining(Math.max(0, cooldown - timeSinceLastTrigger));
      return;
    } else {
      setCooldownRemaining(0);
    }

    // Determine individual eye closure status using smoothed values
    const isLeftClosed = smoothedLeftEAR < currentThresholds.winkEAR;
    const isRightClosed = smoothedRightEAR < currentThresholds.winkEAR;
    const earDelta = Math.abs(smoothedLeftEAR - smoothedRightEAR);

    // Update debug state
    setDebugState({
      leftEyeState: isLeftClosed ? 'closed' : 'open',
      rightEyeState: isRightClosed ? 'closed' : 'open',
      mouthState: smoothedKissScore >= currentThresholds.kissThreshold ? 'kissing' : 'neutral',
    });

    let detected = null;

    // 1. KISS gesture check (temporal smoothing: must hold pucker >= 200ms)
    if (smoothedKissScore >= currentThresholds.kissThreshold) {
      if (!kissStartTimeRef.current) {
        kissStartTimeRef.current = now;
      } else if (now - kissStartTimeRef.current >= 200) {
        // Sustained pucker for >= 200ms confirms deliberate kiss gesture
        detected = 'KISS';
        kissStartTimeRef.current = null;
        console.log(`[useGestureDetector] 💋 KISS Triggered! (Smoothed: ${smoothedKissScore} >= ${currentThresholds.kissThreshold})`);
      }
    } else {
      kissStartTimeRef.current = null;
    }

    // 2. Eye gestures (temporal smoothing: must hold past threshold for 110-130ms)
    if (!detected) {
      // Both eyes closed -> BLINK
      if (isLeftClosed && isRightClosed) {
        // Reset individual wink timers
        leftWinkStartTimeRef.current = null;
        rightWinkStartTimeRef.current = null;

        if (!eyeClosureStartTimeRef.current) {
          eyeClosureStartTimeRef.current = now;
        } else {
          const duration = now - eyeClosureStartTimeRef.current;
          // Must stay closed consecutively between 110ms and 700ms
          if (duration >= 110 && duration <= 700) {
            detected = 'BLINK';
            eyeClosureStartTimeRef.current = null;
            console.log(`[useGestureDetector] ⚡ BLINK Triggered! (Duration: ${Math.round(duration)}ms, Max EAR: ${Math.max(smoothedLeftEAR, smoothedRightEAR)} < ${currentThresholds.blinkEAR})`);
          }
        }
      } 
      // User's Left Eye Wink (left closed, right open, delta satisfied)
      else if (isLeftClosed && !isRightClosed && (smoothedRightEAR - smoothedLeftEAR) >= currentThresholds.winkDelta) {
        eyeClosureStartTimeRef.current = null;
        rightWinkStartTimeRef.current = null;

        if (!leftWinkStartTimeRef.current) {
          leftWinkStartTimeRef.current = now;
        } else if (now - leftWinkStartTimeRef.current >= 120) {
          // Sustained left wink for >= 120ms filters out single-frame jitter
          detected = 'WINK_LEFT';
          leftWinkStartTimeRef.current = null;
          console.log(`[useGestureDetector] ◀ WINK_LEFT Triggered! (Left: ${smoothedLeftEAR} < ${currentThresholds.winkEAR}, Right: ${smoothedRightEAR}, Delta: ${(smoothedRightEAR - smoothedLeftEAR).toFixed(2)})`);
        }
      }
      // User's Right Eye Wink (right closed, left open, delta satisfied)
      else if (isRightClosed && !isLeftClosed && (smoothedLeftEAR - smoothedRightEAR) >= currentThresholds.winkDelta) {
        eyeClosureStartTimeRef.current = null;
        leftWinkStartTimeRef.current = null;

        if (!rightWinkStartTimeRef.current) {
          rightWinkStartTimeRef.current = now;
        } else if (now - rightWinkStartTimeRef.current >= 120) {
          // Sustained right wink for >= 120ms filters out single-frame jitter
          detected = 'WINK_RIGHT';
          rightWinkStartTimeRef.current = null;
          console.log(`[useGestureDetector] ▶ WINK_RIGHT Triggered! (Right: ${smoothedRightEAR} < ${currentThresholds.winkEAR}, Left: ${smoothedLeftEAR}, Delta: ${(smoothedLeftEAR - smoothedRightEAR).toFixed(2)})`);
        }
      } else {
        // Eyes open or insufficient delta - reset temporal hold timers
        eyeClosureStartTimeRef.current = null;
        leftWinkStartTimeRef.current = null;
        rightWinkStartTimeRef.current = null;
      }
    }

    // If gesture detected, dispatch with cooldown
    if (detected) {
      lastTriggerTimeRef.current = now;
      setActiveGesture(detected);

      // Record history
      gestureHistoryRef.current.push({
        type: detected,
        time: now,
        leftEAR: smoothedLeftEAR,
        rightEAR: smoothedRightEAR,
        kissScore: smoothedKissScore,
      });
      if (gestureHistoryRef.current.length > 50) {
        gestureHistoryRef.current.shift();
      }

      if (onGestureRef.current) {
        onGestureRef.current(detected, frameMetrics);
      }

      // Reset active gesture visually after 300ms
      setTimeout(() => {
        setActiveGesture(prev => (prev === detected ? null : prev));
      }, 300);
    }
  }, []);

  // Reset cooldown immediately when manually triggered
  const triggerManualGesture = useCallback((gestureType) => {
    const now = performance.now();
    lastTriggerTimeRef.current = now;
    setActiveGesture(gestureType);

    if (onGestureRef.current) {
      onGestureRef.current(gestureType, { manual: true });
    }

    setTimeout(() => {
      setActiveGesture(prev => (prev === gestureType ? null : prev));
    }, 300);
  }, []);

  return {
    activeGesture,
    cooldownRemaining,
    debugState,
    confidenceData,
    processFrame,
    triggerManualGesture,
  };
}
