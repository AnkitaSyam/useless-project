/**
 * Statistical utilities for facial gesture calibration.
 * Provides outlier filtering (trimmed mean, median), margin separation validation,
 * and true midpoint threshold calculations.
 */

/**
 * Computes the median of a numeric array.
 * @param {number[]} arr 
 * @param {number} fallback 
 * @returns {number}
 */
export function calculateMedian(arr, fallback = 0) {
  if (!arr || arr.length === 0) return fallback;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Computes the trimmed mean of a numeric array, discarding top and bottom percentiles.
 * Ideal for discarding accidental blinks, camera tracking glitches, or transition frames.
 * @param {number[]} arr 
 * @param {number} trimPercent - Percentage to trim from each end (0.0 to 0.45). Default 0.15 (15%).
 * @param {number} fallback 
 * @returns {number}
 */
export function calculateTrimmedMean(arr, trimPercent = 0.15, fallback = 0) {
  if (!arr || arr.length === 0) return fallback;
  if (arr.length < 5) return calculateMedian(arr, fallback);

  const sorted = [...arr].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * Math.min(0.45, Math.max(0, trimPercent)));
  
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  if (trimmed.length === 0) return calculateMedian(arr, fallback);

  const sum = trimmed.reduce((acc, val) => acc + val, 0);
  return sum / trimmed.length;
}

/**
 * Clean neutral baseline samples.
 * During neutral capture, the eyes should be open and mouth resting.
 * Blinking mid-capture causes sharp downward dips in EAR.
 * This filter strips out bottom downward spikes (blinks) and returns the stable resting open EAR.
 * @param {number[]} earSamples 
 * @param {number} fallback 
 * @returns {number}
 */
export function cleanNeutralEAR(earSamples, fallback = 0.34) {
  if (!earSamples || earSamples.length === 0) return fallback;
  
  // Sort ascending
  const sorted = [...earSamples].sort((a, b) => a - b);
  
  // If user blinked mid-capture, the lowest 20-30% will contain blink dips (< 0.22)
  // We trim the bottom 25% to remove blinks, and top 10% to remove wide-eye startled flickers.
  if (sorted.length >= 8) {
    const startIdx = Math.floor(sorted.length * 0.25);
    const endIdx = Math.floor(sorted.length * 0.90);
    const cluster = sorted.slice(startIdx, endIdx);
    if (cluster.length > 0) {
      const sum = cluster.reduce((a, b) => a + b, 0);
      return Number((sum / cluster.length).toFixed(3));
    }
  }

  return Number(calculateTrimmedMean(sorted, 0.20, fallback).toFixed(3));
}

/**
 * Clean closed eye samples (Blink or Wink).
 * When asked to close eyes or wink, the first ~200-300ms often contain open-eye transition frames.
 * Also tracking noise might produce momentary spikes.
 * This extracts the sustained closed state by trimming the top transition frames.
 * @param {number[]} earSamples 
 * @param {number} neutralBaseline - Measured open eye EAR
 * @param {number} fallback 
 * @returns {number}
 */
export function cleanClosedEyeEAR(earSamples, neutralBaseline = 0.34, fallback = 0.16) {
  if (!earSamples || earSamples.length === 0) return fallback;

  // Filter out obvious open frames if any leaked in (e.g. >= 90% of neutral baseline)
  const validClosed = earSamples.filter(val => val < neutralBaseline * 0.92);
  const targetArray = validClosed.length >= 5 ? validClosed : earSamples;

  const sorted = [...targetArray].sort((a, b) => a - b);

  // Discard lowest 5% (camera tracking dropouts) and upper 30% (transition/opening frames)
  if (sorted.length >= 8) {
    const startIdx = Math.max(0, Math.floor(sorted.length * 0.05));
    const endIdx = Math.max(1, Math.floor(sorted.length * 0.70));
    const cluster = sorted.slice(startIdx, endIdx);
    if (cluster.length > 0) {
      const sum = cluster.reduce((a, b) => a + b, 0);
      return Number((sum / cluster.length).toFixed(3));
    }
  }

  return Number(calculateTrimmedMean(sorted, 0.15, fallback).toFixed(3));
}

/**
 * Clean kiss pucker samples.
 * Isolates the sustained peak pucker intensity by trimming low transition/prep frames.
 * @param {number[]} kissSamples 
 * @param {number} neutralKissBaseline 
 * @param {number} fallback 
 * @returns {number}
 */
export function cleanKissSamples(kissSamples, neutralKissBaseline = 0.08, fallback = 0.65) {
  if (!kissSamples || kissSamples.length === 0) return fallback;

  // Filter out neutral/pre-pucker frames if user took a moment to start puckering
  const validPuckers = kissSamples.filter(val => val > neutralKissBaseline + 0.15);
  const targetArray = validPuckers.length >= 5 ? validPuckers : kissSamples;

  const sorted = [...targetArray].sort((a, b) => a - b);

  // Take upper sustained band: trim lowest 30% (onset/release) and top 5% (glitches)
  if (sorted.length >= 8) {
    const startIdx = Math.floor(sorted.length * 0.30);
    const endIdx = Math.max(startIdx + 1, Math.floor(sorted.length * 0.95));
    const cluster = sorted.slice(startIdx, endIdx);
    if (cluster.length > 0) {
      const sum = cluster.reduce((a, b) => a + b, 0);
      return Number((sum / cluster.length).toFixed(3));
    }
  }

  return Number(calculateTrimmedMean(sorted, 0.20, fallback).toFixed(3));
}

/**
 * Validate margins between neutral resting state and gesture states.
 * Ensures the gap is wide enough to avoid false positives and missed triggers.
 * @param {Object} params
 * @returns {Object} Validation summary and per-step flags
 */
export const MIN_MARGINS = {
  BLINK_EAR: 0.08,     // Open EAR vs Closed Blink EAR must differ by >= 0.08
  WINK_EAR: 0.08,      // Open EAR vs Closed Wink EAR must differ by >= 0.08
  WINK_ASYMMETRY: 0.06,// Open opposite eye vs closed eye must differ by >= 0.06
  KISS_SCORE: 0.25,    // Sustained kiss score vs neutral kiss score must differ by >= 0.25
  KISS_MIN_ABSOLUTE: 0.38, // Sustained kiss score must be at least 0.38
};

export function validateMargins({
  openEAR = 0.34,
  closedBlinkEAR = 0.16,
  closedWinkEAR = 0.18,
  neutralKissScore = 0.08,
  sustainedKissScore = 0.65,
}) {
  const blinkMargin = Number((openEAR - closedBlinkEAR).toFixed(3));
  const winkMargin = Number((openEAR - closedWinkEAR).toFixed(3));
  const kissMargin = Number((sustainedKissScore - neutralKissScore).toFixed(3));

  const isBlinkMarginValid = blinkMargin >= MIN_MARGINS.BLINK_EAR;
  const isWinkMarginValid = winkMargin >= MIN_MARGINS.WINK_EAR;
  const isKissMarginValid = kissMargin >= MIN_MARGINS.KISS_SCORE && sustainedKissScore >= MIN_MARGINS.KISS_MIN_ABSOLUTE;

  const allValid = isBlinkMarginValid && isWinkMarginValid && isKissMarginValid;

  const warnings = {};
  if (!isBlinkMarginValid) {
    warnings.blink = `Blink margin (Δ ${blinkMargin}) is too small (< ${MIN_MARGINS.BLINK_EAR}). Open eye (${openEAR}) and closed eye (${closedBlinkEAR}) are too close together.`;
  }
  if (!isWinkMarginValid) {
    warnings.wink = `Wink margin (Δ ${winkMargin}) is too small (< ${MIN_MARGINS.WINK_EAR}). Open eye (${openEAR}) and closed eye (${closedWinkEAR}) are too close together.`;
  }
  if (!isKissMarginValid) {
    warnings.kiss = `Kiss margin (Δ ${kissMargin}) is too small (< ${MIN_MARGINS.KISS_SCORE}) or peak pucker (${sustainedKissScore}) is below minimum (${MIN_MARGINS.KISS_MIN_ABSOLUTE}).`;
  }

  return {
    allValid,
    isBlinkMarginValid,
    isWinkMarginValid,
    isKissMarginValid,
    blinkMargin,
    winkMargin,
    kissMargin,
    warnings,
  };
}

/**
 * Computes personalized thresholds using TRUE MIDPOINTS.
 * Threshold = (Neutral Value + Sustained Gesture Value) / 2.0
 * 
 * @param {Object} rawSamples 
 * @param {Object} defaultThresholds 
 * @returns {Object} Calibrated thresholds and diagnostic metadata
 */
export function computeCalibratedThresholds(rawSamples, defaultThresholds = {}) {
  // 1. Process neutral baseline
  const baseLeftEAR = cleanNeutralEAR(rawSamples.neutralLeftEAR, defaultThresholds.baselineLeftEAR || 0.34);
  const baseRightEAR = cleanNeutralEAR(rawSamples.neutralRightEAR, defaultThresholds.baselineRightEAR || 0.34);
  const openEAR = Number(((baseLeftEAR + baseRightEAR) / 2.0).toFixed(3));
  const baseMouthRatio = calculateTrimmedMean(rawSamples.neutralMouthRatio, 0.15, defaultThresholds.baselineMouthRatio || 0.50);
  const neutralKissScore = calculateTrimmedMean(rawSamples.neutralKissScores, 0.15, 0.08);

  // 2. Process closed eye gestures
  const closedBlinkEAR = cleanClosedEyeEAR(rawSamples.blinkMins, openEAR, 0.16);
  const closedLeftWinkEAR = cleanClosedEyeEAR(rawSamples.leftWinkEAR, openEAR, 0.18);
  const closedRightWinkEAR = cleanClosedEyeEAR(rawSamples.rightWinkEAR, openEAR, 0.18);
  const closedWinkEAR = Number(((closedLeftWinkEAR + closedRightWinkEAR) / 2.0).toFixed(3));

  // 3. Process kiss gesture
  const sustainedKissScore = cleanKissSamples(rawSamples.kissScores, neutralKissScore, 0.65);

  // 4. Validate margins
  const marginValidation = validateMargins({
    openEAR,
    closedBlinkEAR,
    closedWinkEAR,
    neutralKissScore,
    sustainedKissScore,
  });

  // 5. Compute TRUE MIDPOINT thresholds
  // Blink: midpoint between resting open EAR and sustained closed blink EAR
  const calculatedBlinkEAR = Number(((openEAR + closedBlinkEAR) / 2.0).toFixed(3));

  // Wink: midpoint between resting open EAR and sustained closed wink EAR
  const calculatedWinkEAR = Number(((openEAR + closedWinkEAR) / 2.0).toFixed(3));

  // Wink Delta: required difference between open eye and closed eye during wink
  // Halfway between minimum reliable separation (0.05) and full measured wink margin
  const winkDelta = Number(Math.max(0.05, Math.min(0.12, marginValidation.winkMargin * 0.50)).toFixed(3));

  // Kiss: true midpoint between neutral resting mouth pucker and sustained kiss pucker
  const rawKissMidpoint = (neutralKissScore + sustainedKissScore) / 2.0;
  // Guard with sensible safety bounds [0.32, 0.68] so unusual lighting won't break usability
  const calculatedKissThreshold = Number(Math.max(0.32, Math.min(0.68, rawKissMidpoint)).toFixed(3));

  return {
    ...defaultThresholds,
    // Final operational thresholds
    blinkEAR: calculatedBlinkEAR,
    winkEAR: calculatedWinkEAR,
    winkDelta,
    kissThreshold: calculatedKissThreshold,

    // Measured user baselines & gesture values
    openEAR,
    baselineLeftEAR: baseLeftEAR,
    baselineRightEAR: baseRightEAR,
    baselineMouthRatio: Number(baseMouthRatio.toFixed(3)),
    neutralKissScore: Number(neutralKissScore.toFixed(3)),
    closedBlinkEAR,
    closedLeftWinkEAR,
    closedRightWinkEAR,
    closedWinkEAR,
    sustainedKissScore,

    // Separation margins & validation diagnostics
    blinkMargin: marginValidation.blinkMargin,
    winkMargin: marginValidation.winkMargin,
    kissMargin: marginValidation.kissMargin,
    isMarginNarrow: !marginValidation.allValid,
    marginValidation,
  };
}
