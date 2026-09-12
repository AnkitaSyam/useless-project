import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  CheckCircle2,
  Eye,
  Smile,
  ArrowRight,
  RotateCcw,
  X,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Play,
} from 'lucide-react';
import {
  computeCalibratedThresholds,
  cleanNeutralEAR,
  cleanClosedEyeEAR,
  cleanKissSamples,
  MIN_MARGINS,
} from '../utils/calibrationStats';

const CALIBRATION_STEPS = [
  {
    id: 'intro',
    title: 'Personalized Calibration',
    subtitle: 'Calibrate your facial gestures for effortless, high-accuracy gaze-free typing.',
    instruction: 'Ensure your face is centered in the camera preview with normal lighting.',
    icon: Sparkles,
  },
  {
    id: 'neutral',
    title: 'Step 1: Neutral Expression',
    subtitle: 'Measuring your natural resting eye and mouth baseline.',
    instruction: 'Look straight at the camera with relaxed, open eyes and natural lips.',
    icon: Eye,
    durationMs: 2000,
    targetKey: 'neutral',
  },
  {
    id: 'blink',
    title: 'Step 2: Blink Both Eyes',
    subtitle: 'Setting selection trigger threshold.',
    instruction: 'Gently close BOTH eyes and keep them closed until the timer completes.',
    icon: Eye,
    durationMs: 1800,
    targetKey: 'blink',
  },
  {
    id: 'wink_left',
    title: 'Step 3: Wink Left Eye',
    subtitle: 'Setting left navigation threshold.',
    instruction: 'Wink your LEFT eye (keep your right eye open) and hold it until the timer completes.',
    icon: Eye,
    durationMs: 1800,
    targetKey: 'wink_left',
  },
  {
    id: 'wink_right',
    title: 'Step 4: Wink Right Eye',
    subtitle: 'Setting right navigation threshold.',
    instruction: 'Wink your RIGHT eye (keep your left eye open) and hold it until the timer completes.',
    icon: Eye,
    durationMs: 1800,
    targetKey: 'wink_right',
  },
  {
    id: 'kiss',
    title: 'Step 5: Kiss / Lip Pucker',
    subtitle: 'Setting send message threshold.',
    instruction: 'Pucker your lips firmly as if blowing a kiss and sustain it until the timer completes.',
    icon: Smile,
    durationMs: 1800,
    targetKey: 'kiss',
  },
  {
    id: 'complete',
    title: 'Calibration Complete!',
    subtitle: 'Your personalized profile has been tuned and verified.',
    instruction: 'Review your personalized thresholds and separation margins below.',
    icon: ShieldCheck,
  },
];

const INITIAL_SAMPLES = {
  neutralLeftEAR: [],
  neutralRightEAR: [],
  neutralMouthRatio: [],
  neutralKissScores: [],
  blinkMins: [],
  leftWinkEAR: [],
  leftWinkOppositeEAR: [],
  rightWinkEAR: [],
  rightWinkOppositeEAR: [],
  kissScores: [],
  kissRatios: [],
};

export function CalibrationModal({
  isOpen = false,
  onClose = null,
  onApplyThresholds = null,
  currentMetrics = null,
  hasFace = false,
  defaultThresholds = {},
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [samples, setSamples] = useState(INITIAL_SAMPLES);

  // Per-step execution state: 'idle' | 'countdown' | 'capturing' | 'captured'
  const [stepState, setStepState] = useState('idle');
  const [countdown, setCountdown] = useState(1);
  const [stepProgress, setStepProgress] = useState(0); // 0 to 100

  const currentStep = CALIBRATION_STEPS[stepIndex];
  const isComplete = currentStep.id === 'complete';
  const isIntro = currentStep.id === 'intro';

  // Check if a step has recorded samples
  const hasStepSamples = (stepId, currentSamples) => {
    if (stepId === 'neutral') return currentSamples.neutralLeftEAR.length >= 8;
    if (stepId === 'blink') return currentSamples.blinkMins.length >= 8;
    if (stepId === 'wink_left') return currentSamples.leftWinkEAR.length >= 8;
    if (stepId === 'wink_right') return currentSamples.rightWinkEAR.length >= 8;
    if (stepId === 'kiss') return currentSamples.kissScores.length >= 8;
    return false;
  };

  // Refs for animation & interval timers
  const captureStartTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
      setStepState('idle');
      setStepProgress(0);
      setSamples(INITIAL_SAMPLES);
    }
  }, [isOpen]);

  // Clean up any timers on step change or close
  const clearTimers = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  // When step changes, set state based on whether we already have samples for this step
  useEffect(() => {
    clearTimers();
    setStepProgress(0);

    if (isIntro || isComplete) {
      setStepState('idle');
      return;
    }

    const hasExistingSamples = hasStepSamples(currentStep.id, samples);
    if (hasExistingSamples) {
      setStepState('captured');
    } else {
      setStepState('idle');
    }
  }, [stepIndex, currentStep.id, isIntro, isComplete, samples]);

  // Clear samples for a specific step
  const clearStepSamples = (stepId) => {
    setSamples(prev => {
      if (stepId === 'neutral') {
        return {
          ...prev,
          neutralLeftEAR: [],
          neutralRightEAR: [],
          neutralMouthRatio: [],
          neutralKissScores: [],
        };
      }
      if (stepId === 'blink') {
        return { ...prev, blinkMins: [] };
      }
      if (stepId === 'wink_left') {
        return { ...prev, leftWinkEAR: [], leftWinkOppositeEAR: [] };
      }
      if (stepId === 'wink_right') {
        return { ...prev, rightWinkEAR: [], rightWinkOppositeEAR: [] };
      }
      if (stepId === 'kiss') {
        return { ...prev, kissScores: [], kissRatios: [] };
      }
      return prev;
    });
  };

  // Start the 1-second preparation countdown then launch sustained capture
  const handleStartCapture = () => {
    clearTimers();
    clearStepSamples(currentStep.id);
    setStepProgress(0);
    setCountdown(1);
    setStepState('countdown');

    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          launchSustainedCapture();
          return 0;
        }
        return prev - 1;
      });
    }, 800);
  };

  // Launch sustained capture for currentStep.durationMs
  const launchSustainedCapture = () => {
    setStepState('capturing');
    const duration = currentStep.durationMs || 1800;
    captureStartTimeRef.current = Date.now();

    timerIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - captureStartTimeRef.current;
      const progress = Math.min(100, (elapsed / duration) * 100);
      setStepProgress(progress);

      if (elapsed >= duration) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
        setStepState('captured');
        setStepProgress(100);
      }
    }, 30);
  };

  // Capture frame metrics during 'capturing' phase
  useEffect(() => {
    if (!isOpen || !hasFace || !currentMetrics || stepState !== 'capturing') return;

    const { leftEAR, rightEAR, kissScore, rawMouthRatio } = currentMetrics;

    // Filter out invalid zero frames
    if (leftEAR <= 0.02 || rightEAR <= 0.02) return;

    const stepId = currentStep.id;

    setSamples(prev => {
      if (stepId === 'neutral') {
        return {
          ...prev,
          neutralLeftEAR: [...prev.neutralLeftEAR, leftEAR],
          neutralRightEAR: [...prev.neutralRightEAR, rightEAR],
          neutralMouthRatio: [...prev.neutralMouthRatio, rawMouthRatio],
          neutralKissScores: [...prev.neutralKissScores, kissScore],
        };
      } else if (stepId === 'blink') {
        return {
          ...prev,
          blinkMins: [...prev.blinkMins, Math.min(leftEAR, rightEAR)],
        };
      } else if (stepId === 'wink_left') {
        return {
          ...prev,
          leftWinkEAR: [...prev.leftWinkEAR, leftEAR],
          leftWinkOppositeEAR: [...prev.leftWinkOppositeEAR, rightEAR],
        };
      } else if (stepId === 'wink_right') {
        return {
          ...prev,
          rightWinkEAR: [...prev.rightWinkEAR, rightEAR],
          rightWinkOppositeEAR: [...prev.rightWinkOppositeEAR, leftEAR],
        };
      } else if (stepId === 'kiss') {
        return {
          ...prev,
          kissScores: [...prev.kissScores, kissScore],
          kissRatios: [...prev.kissRatios, rawMouthRatio],
        };
      }
      return prev;
    });
  }, [isOpen, hasFace, currentMetrics, stepState, currentStep.id]);

  // Compute live step analysis for immediate feedback & margin checks
  const stepAnalysis = useMemo(() => {
    if (isIntro || isComplete) return null;

    const openEAR = cleanNeutralEAR(
      [...samples.neutralLeftEAR, ...samples.neutralRightEAR],
      defaultThresholds.baselineLeftEAR || 0.34
    );
    const neutralKiss = samples.neutralKissScores.length > 0
      ? Number((samples.neutralKissScores.reduce((a, b) => a + b, 0) / samples.neutralKissScores.length).toFixed(3))
      : 0.08;

    const stepId = currentStep.id;

    if (stepId === 'neutral') {
      const left = cleanNeutralEAR(samples.neutralLeftEAR, 0.34);
      const right = cleanNeutralEAR(samples.neutralRightEAR, 0.34);
      return {
        stepId,
        frameCount: samples.neutralLeftEAR.length,
        measuredVal: Number(((left + right) / 2).toFixed(3)),
        leftVal: left,
        rightVal: right,
        isValid: samples.neutralLeftEAR.length >= 8,
        statusText: `Resting Open EAR: ${((left + right) / 2).toFixed(3)}`,
      };
    }

    if (stepId === 'blink') {
      const closed = cleanClosedEyeEAR(samples.blinkMins, openEAR, 0.16);
      const margin = Number((openEAR - closed).toFixed(3));
      const isNarrow = margin < MIN_MARGINS.BLINK_EAR;
      const midpoint = Number(((openEAR + closed) / 2).toFixed(3));
      return {
        stepId,
        frameCount: samples.blinkMins.length,
        measuredVal: closed,
        margin,
        isNarrow,
        midpoint,
        isValid: samples.blinkMins.length >= 8,
        warningText: isNarrow
          ? `Calibration values are too close together (Δ ${margin} < ${MIN_MARGINS.BLINK_EAR}). Your closed eye (${closed}) is too close to your resting open eye (${openEAR}). Please retry in better lighting or close eyes more firmly.`
          : null,
      };
    }

    if (stepId === 'wink_left') {
      const closed = cleanClosedEyeEAR(samples.leftWinkEAR, openEAR, 0.18);
      const margin = Number((openEAR - closed).toFixed(3));
      const isNarrow = margin < MIN_MARGINS.WINK_EAR;
      const midpoint = Number(((openEAR + closed) / 2).toFixed(3));
      return {
        stepId,
        frameCount: samples.leftWinkEAR.length,
        measuredVal: closed,
        margin,
        isNarrow,
        midpoint,
        isValid: samples.leftWinkEAR.length >= 8,
        warningText: isNarrow
          ? `Calibration values are too close together (Δ ${margin} < ${MIN_MARGINS.WINK_EAR}). Please retry while keeping your right eye fully open.`
          : null,
      };
    }

    if (stepId === 'wink_right') {
      const closed = cleanClosedEyeEAR(samples.rightWinkEAR, openEAR, 0.18);
      const margin = Number((openEAR - closed).toFixed(3));
      const isNarrow = margin < MIN_MARGINS.WINK_EAR;
      const midpoint = Number(((openEAR + closed) / 2).toFixed(3));
      return {
        stepId,
        frameCount: samples.rightWinkEAR.length,
        measuredVal: closed,
        margin,
        isNarrow,
        midpoint,
        isValid: samples.rightWinkEAR.length >= 8,
        warningText: isNarrow
          ? `Calibration values are too close together (Δ ${margin} < ${MIN_MARGINS.WINK_EAR}). Please retry while keeping your left eye fully open.`
          : null,
      };
    }

    if (stepId === 'kiss') {
      const sustainedKiss = cleanKissSamples(samples.kissScores, neutralKiss, 0.65);
      const margin = Number((sustainedKiss - neutralKiss).toFixed(3));
      const isNarrow = margin < MIN_MARGINS.KISS_SCORE || sustainedKiss < MIN_MARGINS.KISS_MIN_ABSOLUTE;
      const midpoint = Number(Math.max(0.32, Math.min(0.68, (neutralKiss + sustainedKiss) / 2)).toFixed(3));
      return {
        stepId,
        frameCount: samples.kissScores.length,
        measuredVal: sustainedKiss,
        margin,
        isNarrow,
        midpoint,
        isValid: samples.kissScores.length >= 8,
        warningText: isNarrow
          ? `Calibration values are too close together (Pucker: ${sustainedKiss}, Margin: Δ ${margin}). Please pucker lips more firmly like blowing a kiss.`
          : null,
      };
    }

    return null;
  }, [currentStep.id, samples, defaultThresholds, isIntro, isComplete]);

  // Compute finalized thresholds
  const computedFinal = useMemo(() => {
    if (!isComplete) return null;
    return computeCalibratedThresholds(samples, defaultThresholds);
  }, [isComplete, samples, defaultThresholds]);

  // Per-step retry button handler
  const handleRetryStep = () => {
    clearTimers();
    clearStepSamples(currentStep.id);
    setStepState('idle');
    setStepProgress(0);
  };

  // Jump to specific step to redo from complete screen
  const handleJumpToStep = (index) => {
    setStepIndex(index);
    clearStepSamples(CALIBRATION_STEPS[index].id);
    setStepState('idle');
    setStepProgress(0);
  };

  // Navigation handlers
  const handleNextStep = () => {
    if (stepIndex < CALIBRATION_STEPS.length - 1) {
      clearTimers();
      setStepIndex(stepIndex + 1);
    }
  };

  const handlePrevStep = () => {
    if (stepIndex > 0) {
      clearTimers();
      setStepIndex(stepIndex - 1);
    }
  };

  // Skip and use defaults
  const handleUseDefaults = () => {
    clearTimers();
    if (onApplyThresholds) {
      onApplyThresholds(defaultThresholds);
    }
    if (onClose) onClose();
  };

  // Finish calibration: apply thresholds and log transparently
  const handleFinish = () => {
    const calibrated = computedFinal || computeCalibratedThresholds(samples, defaultThresholds);

    // Grouped, transparent logging for verification
    console.group('%c[WinkKey Calibration] 🎯 Calibration Complete & Applied', 'color: #06b6d4; font-weight: bold; font-size: 13px;');
    console.log('%cMeasured Personal Characteristics:', 'color: #38bdf8; font-weight: bold;');
    console.table({
      'Resting Open Eye (Neutral)': { Measured: calibrated.openEAR, Threshold: '-', Margin: '-' },
      'Blink Gesture': { Measured: calibrated.closedBlinkEAR, Threshold: calibrated.blinkEAR, Margin: `Δ ${calibrated.blinkMargin}` },
      'Left Wink Gesture': { Measured: calibrated.closedLeftWinkEAR, Threshold: calibrated.winkEAR, Margin: `Δ ${calibrated.winkMargin}` },
      'Right Wink Gesture': { Measured: calibrated.closedRightWinkEAR, Threshold: calibrated.winkEAR, Margin: `Δ ${calibrated.winkMargin}` },
      'Wink Asymmetry Delta': { Measured: '-', Threshold: calibrated.winkDelta, Margin: '-' },
      'Kiss / Lip Pucker': { Measured: calibrated.sustainedKissScore, Threshold: calibrated.kissThreshold, Margin: `Δ ${calibrated.kissMargin}` },
    });
    console.log('Runtime Active Thresholds Payload:', {
      blinkEAR: calibrated.blinkEAR,
      winkEAR: calibrated.winkEAR,
      winkDelta: calibrated.winkDelta,
      kissThreshold: calibrated.kissThreshold,
      cooldownMs: calibrated.cooldownMs,
    });
    console.log('Validation Diagnostics:', calibrated.marginValidation);
    console.groupEnd();

    if (onApplyThresholds) {
      onApplyThresholds(calibrated);
    }
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  const StepIcon = currentStep.icon;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="calib-title">
      <div className="calibration-dialog">
        {/* Header */}
        <div className="calib-header">
          <div className="calib-step-indicator">
            {CALIBRATION_STEPS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                className={`step-dot ${idx === stepIndex ? 'step-active' : ''} ${
                  idx < stepIndex ? 'step-done' : ''
                }`}
                onClick={() => {
                  if (idx <= stepIndex || isComplete) {
                    setStepIndex(idx);
                  }
                }}
                title={s.title}
              />
            ))}
          </div>

          <button
            type="button"
            className="calib-close-btn"
            onClick={handleUseDefaults}
            title="Skip & use defaults"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="calib-body">
          <div className="calib-icon-halo">
            <StepIcon size={44} className="calib-hero-icon" />
          </div>

          <h2 id="calib-title" className="calib-heading">{currentStep.title}</h2>
          <p className="calib-subheading">{currentStep.subtitle}</p>

          <div className="calib-instruction-box">
            <p className="instruction-text">{currentStep.instruction}</p>
          </div>

          {/* Real-time feedback monitor */}
          {hasFace && (
            <div className="calib-live-monitor">
              <span className="monitor-badge">Live Sensor</span>
              <div className="monitor-stats">
                <span>Left EAR: <strong>{currentMetrics?.leftEAR?.toFixed(2) || '0.00'}</strong></span>
                <span>Right EAR: <strong>{currentMetrics?.rightEAR?.toFixed(2) || '0.00'}</strong></span>
                <span>Kiss: <strong>{currentMetrics?.kissScore?.toFixed(2) || '0.00'}</strong></span>
              </div>
            </div>
          )}

          {/* Step Capture Controller (for steps 1-5) */}
          {!isIntro && !isComplete && (
            <div className="calib-capture-controller">
              {/* State 1: Ready / Idle */}
              {stepState === 'idle' && (
                <div className="calib-action-prompt">
                  <p className="prompt-hint">Click below when you are ready to hold the gesture for 1.8 - 2 seconds.</p>
                  <button
                    type="button"
                    className="calib-btn-primary btn-start-capture"
                    onClick={handleStartCapture}
                  >
                    <Play size={16} /> Start Capture ({(currentStep.durationMs / 1000).toFixed(1)}s hold)
                  </button>
                </div>
              )}

              {/* State 2: Countdown */}
              {stepState === 'countdown' && (
                <div className="calib-countdown-box">
                  <span className="countdown-label">Get Ready...</span>
                  <span className="countdown-number">{countdown}</span>
                </div>
              )}

              {/* State 3: Capturing */}
              {stepState === 'capturing' && (
                <div className="calib-active-capture">
                  <div className="capturing-header">
                    <span className="capturing-pulse-dot" />
                    <strong>HOLD GESTURE STEADY...</strong>
                    <span className="capturing-timer">
                      {Math.round(stepProgress)}%
                    </span>
                  </div>
                  <div className="step-progress-wrapper">
                    <div
                      className="step-progress-fill"
                      style={{ width: `${stepProgress}%` }}
                    />
                  </div>
                  <p className="capturing-subtext">Sampling stable frames across duration...</p>
                </div>
              )}

              {/* State 4: Captured Results & Per-Step Validation */}
              {stepState === 'captured' && stepAnalysis && (
                <div className="calib-step-feedback">
                  {/* Warning Banner if Margin is Narrow */}
                  {stepAnalysis.warningText && (
                    <div className="calib-margin-warning">
                      <div className="calib-warning-header">
                        <AlertTriangle size={18} className="warning-icon-amber" />
                        <strong>Calibration Warning: Narrow Margin</strong>
                      </div>
                      <p className="warning-text-desc">{stepAnalysis.warningText}</p>
                    </div>
                  )}

                  {/* Success Banner if Margin is Healthy */}
                  {!stepAnalysis.warningText && stepAnalysis.margin !== undefined && (
                    <div className="calib-margin-success">
                      <CheckCircle2 size={18} className="success-icon-green" />
                      <span>
                        Sustained Reading: <strong>{stepAnalysis.measuredVal}</strong> | Margin: <strong>Δ {stepAnalysis.margin}</strong> (Optimal)
                      </span>
                    </div>
                  )}

                  {/* Step Metrics Summary */}
                  <div className="step-metrics-mini">
                    <span>Samples captured: <strong>{stepAnalysis.frameCount} frames</strong></span>
                    {stepAnalysis.midpoint !== undefined && (
                      <span>Calculated Midpoint: <strong>{stepAnalysis.midpoint}</strong></span>
                    )}
                  </div>

                  {/* Per-step retry button */}
                  <div className="step-inline-actions">
                    <button
                      type="button"
                      className="calib-btn-secondary btn-retry-step"
                      onClick={handleRetryStep}
                      title="Discard samples and capture this gesture again"
                    >
                      <RotateCcw size={15} /> Retry this step
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results Summary on Complete Screen */}
          {isComplete && computedFinal && (
            <div className="calib-results-card">
              {/* Overall Narrow Margin Warning */}
              {computedFinal.isMarginNarrow && (
                <div className="calib-margin-warning">
                  <div className="calib-warning-header">
                    <AlertTriangle size={18} className="warning-icon-amber" />
                    <strong>One or more gestures have narrow separation</strong>
                  </div>
                  <p className="warning-text-desc">
                    Calibration detected narrow margins between open and gesture states. You can retry specific steps below to achieve optimal detection accuracy.
                  </p>
                </div>
              )}

              <div className="results-metrics-grid">
                <div className="result-metric-row">
                  <span className="res-label">Measured Resting Open EAR:</span>
                  <span className="res-val">{computedFinal.openEAR}</span>
                </div>

                <div className="result-metric-row">
                  <span className="res-label">Sustained Blink EAR:</span>
                  <span className="res-val">{computedFinal.closedBlinkEAR}</span>
                </div>
                <div className="result-metric-row highlight-row">
                  <span className="res-label">Blink Threshold (Midpoint):</span>
                  <span className="res-val text-cyan">
                    {computedFinal.blinkEAR} <small>(Δ {computedFinal.blinkMargin})</small>
                  </span>
                </div>

                <div className="result-metric-row">
                  <span className="res-label">Sustained Wink EAR:</span>
                  <span className="res-val">{computedFinal.closedWinkEAR}</span>
                </div>
                <div className="result-metric-row highlight-row">
                  <span className="res-label">Wink Threshold (Midpoint):</span>
                  <span className="res-val text-cyan">
                    {computedFinal.winkEAR} <small>(Δ {computedFinal.winkMargin})</small>
                  </span>
                </div>

                <div className="result-metric-row">
                  <span className="res-label">Neutral Lip Pucker:</span>
                  <span className="res-val">{computedFinal.neutralKissScore}</span>
                </div>
                <div className="result-metric-row">
                  <span className="res-label">Sustained Kiss Pucker:</span>
                  <span className="res-val">{computedFinal.sustainedKissScore}</span>
                </div>
                <div className="result-metric-row highlight-row">
                  <span className="res-label">Kiss Threshold (Midpoint):</span>
                  <span className="res-val text-rose">
                    {computedFinal.kissThreshold} <small>(Δ {computedFinal.kissMargin})</small>
                  </span>
                </div>
              </div>

              {/* Per-Step Redo Shortcuts */}
              <div className="calib-redo-shortcuts">
                <span className="shortcuts-title">Redo Specific Step:</span>
                <div className="redo-chip-row">
                  <button
                    type="button"
                    className="redo-chip"
                    onClick={() => handleJumpToStep(1)}
                  >
                    <RotateCcw size={12} /> Neutral
                  </button>
                  <button
                    type="button"
                    className="redo-chip"
                    onClick={() => handleJumpToStep(2)}
                  >
                    <RotateCcw size={12} /> Blink
                  </button>
                  <button
                    type="button"
                    className="redo-chip"
                    onClick={() => handleJumpToStep(3)}
                  >
                    <RotateCcw size={12} /> Left Wink
                  </button>
                  <button
                    type="button"
                    className="redo-chip"
                    onClick={() => handleJumpToStep(4)}
                  >
                    <RotateCcw size={12} /> Right Wink
                  </button>
                  <button
                    type="button"
                    className="redo-chip"
                    onClick={() => handleJumpToStep(5)}
                  >
                    <RotateCcw size={12} /> Kiss
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="calib-footer">
          {isIntro && (
            <>
              <button
                type="button"
                className="calib-btn-secondary"
                onClick={handleUseDefaults}
              >
                Use Recommended Defaults
              </button>
              <button
                type="button"
                className="calib-btn-primary"
                onClick={() => setStepIndex(1)}
              >
                Start Calibration <ArrowRight size={18} />
              </button>
            </>
          )}

          {!isIntro && !isComplete && (
            <>
              <button
                type="button"
                className="calib-btn-secondary"
                onClick={handlePrevStep}
              >
                Back
              </button>

              {/* Retry this step button always accessible in footer */}
              {stepState === 'captured' && (
                <button
                  type="button"
                  className="calib-btn-secondary btn-footer-retry"
                  onClick={handleRetryStep}
                  title="Retry current gesture"
                >
                  <RotateCcw size={15} /> Retry
                </button>
              )}

              <button
                type="button"
                className="calib-btn-primary"
                onClick={handleNextStep}
                disabled={stepState === 'capturing' || stepState === 'countdown'}
              >
                Next Step <ArrowRight size={18} />
              </button>
            </>
          )}

          {isComplete && (
            <div className="calib-complete-actions">
              <button
                type="button"
                className="calib-btn-secondary btn-recalib"
                onClick={() => handleJumpToStep(1)}
                title="Recalibrate all steps from start"
              >
                <RotateCcw size={16} /> Recalibrate All
              </button>
              <button
                type="button"
                className="calib-btn-primary btn-finish"
                onClick={handleFinish}
              >
                <CheckCircle2 size={20} /> Apply & Start Typing
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
