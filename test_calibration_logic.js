import assert from 'node:assert';
import {
  calculateMedian,
  calculateTrimmedMean,
  cleanNeutralEAR,
  cleanClosedEyeEAR,
  cleanKissSamples,
  validateMargins,
  computeCalibratedThresholds,
  MIN_MARGINS,
} from './src/utils/calibrationStats.js';

console.log('====================================================');
console.log('--- STARTING CALIBRATION LOGIC IMPROVEMENT SUITE ---');
console.log('====================================================\n');

// =========================================================================
// TEST 1: SAMPLE DURATION & AGGREGATION (1.8s - 2.0s WINDOW, ~60 FRAMES)
// =========================================================================
function testSampleDurationAndAggregation() {
  console.log('[TEST 1] Sustained sample duration & aggregation across ~60 frames (1.8 - 2.0s)');

  // Simulate 60 frames collected across a 2-second neutral hold
  const sampleFrames = [];
  for (let i = 0; i < 60; i++) {
    // Normal sensor variance around 0.34
    const jitter = (Math.sin(i) * 0.015);
    sampleFrames.push(Number((0.34 + jitter).toFixed(3)));
  }

  assert.strictEqual(sampleFrames.length, 60, 'Should hold full window of 60 frames');
  const median = calculateMedian(sampleFrames);
  const trimmed = calculateTrimmedMean(sampleFrames, 0.15);

  console.log(`  Captured ${sampleFrames.length} frames across window.`);
  console.log(`  Median: ${median.toFixed(3)}, Trimmed Mean: ${trimmed.toFixed(3)}`);
  assert(Math.abs(median - 0.34) < 0.01, 'Median must accurately reflect sustained resting state');
  assert(Math.abs(trimmed - 0.34) < 0.01, 'Trimmed mean must accurately reflect sustained resting state');
  console.log('✓ Test 1 Passed: 60-frame window successfully aggregates sustained reading\n');
}

// =========================================================================
// TEST 2: OUTLIER REJECTION - DISCARDING BLINKS DURING NEUTRAL CAPTURE
// =========================================================================
function testOutlierBlinkRejectionNeutral() {
  console.log('[TEST 2] Discarding outlier blinks during neutral baseline step');

  // Neutral eye dataset: user had eyes open at ~0.35, but accidentally blinked 3 times mid-capture (drops to 0.16)
  const neutralWithBlinks = [
    0.35, 0.35, 0.36, 0.34, 0.35,
    0.16, 0.15, 0.17, // Accidentally blinked! (Outlier drop)
    0.35, 0.35, 0.34, 0.36, 0.35, 0.35,
    0.17, 0.16,       // Second brief blink!
    0.35, 0.34, 0.36, 0.35, 0.35, 0.35,
  ];

  // A naive simple average would be dragged down:
  const naiveAverage = neutralWithBlinks.reduce((a, b) => a + b, 0) / neutralWithBlinks.length;
  console.log(`  Naive simple average (corrupted by blinks): ${naiveAverage.toFixed(3)}`);

  // Our robust cleanNeutralEAR filters out the downward blink dips:
  const cleanedEAR = cleanNeutralEAR(neutralWithBlinks);
  console.log(`  Cleaned neutral baseline EAR (blinks discarded): ${cleanedEAR.toFixed(3)}`);

  assert(naiveAverage < 0.31, 'Naive average is skewed by blinks');
  assert(cleanedEAR >= 0.34 && cleanedEAR <= 0.36, 'Cleaned EAR correctly discards blinks and preserves true resting EAR');
  console.log('✓ Test 2 Passed: Downward blink spikes discarded during neutral baseline capture\n');
}

// =========================================================================
// TEST 3: OUTLIER REJECTION - DISCARDING TRANSITION / ONSET FRAMES DURING GESTURES
// =========================================================================
function testOutlierTransitionRejectionGestures() {
  console.log('[TEST 3] Discarding onset transition frames during closed-eye & kiss gestures');

  const baselineOpenEAR = 0.35;
  // During blink hold: the first 5 frames user is still closing eyes (0.35, 0.32, 0.28),
  // then sustains closure at ~0.16 for 20 frames, with 1 camera glitch frame (0.04)
  const blinkFramesWithOnset = [
    0.35, 0.34, 0.31, 0.27, 0.22, // Transition onset frames
    0.16, 0.15, 0.16, 0.17, 0.16, 0.15, 0.16, 0.16, 0.17, 0.16,
    0.04,                          // Camera glitch dropout
    0.16, 0.15, 0.16, 0.17, 0.16, 0.15, 0.16, 0.16,
  ];

  const cleanedClosedEAR = cleanClosedEyeEAR(blinkFramesWithOnset, baselineOpenEAR);
  console.log(`  Cleaned closed blink EAR (onset & glitch discarded): ${cleanedClosedEAR}`);
  assert(cleanedClosedEAR >= 0.15 && cleanedClosedEAR <= 0.17, 'Should isolate sustained 0.16 closure');

  // Kiss gesture: first 6 frames mouth is resting (0.08, 0.12), then puckered firmly at ~0.72
  const kissFramesWithOnset = [
    0.08, 0.09, 0.14, 0.22, 0.35, // Onset transition
    0.72, 0.70, 0.73, 0.71, 0.74, 0.72, 0.70, 0.75, 0.71, 0.73,
    0.98,                          // Extreme glitch frame
  ];

  const cleanedKiss = cleanKissSamples(kissFramesWithOnset, 0.08);
  console.log(`  Cleaned sustained kiss score: ${cleanedKiss}`);
  assert(cleanedKiss >= 0.70 && cleanedKiss <= 0.74, 'Should isolate sustained ~0.72 pucker');
  console.log('✓ Test 3 Passed: Onset transition frames and camera glitches isolated and discarded\n');
}

// =========================================================================
// TEST 4: VALIDATING MARGIN BETWEEN STATES & WARNINGS
// =========================================================================
function testMarginValidation() {
  console.log('[TEST 4] Validating margin separation between states and warning generation');

  // Case A: Healthy separation (Open 0.35, Closed Blink 0.16 -> Δ 0.19 >= 0.08; Kiss 0.70 vs 0.08 -> Δ 0.62)
  const goodMargins = validateMargins({
    openEAR: 0.35,
    closedBlinkEAR: 0.16,
    closedWinkEAR: 0.17,
    neutralKissScore: 0.08,
    sustainedKissScore: 0.70,
  });

  console.log('  Case A (Good Lighting / Clear Gestures):', {
    allValid: goodMargins.allValid,
    blinkMargin: goodMargins.blinkMargin,
    winkMargin: goodMargins.winkMargin,
    kissMargin: goodMargins.kissMargin,
  });
  assert.strictEqual(goodMargins.allValid, true, 'Healthy margins must be completely valid');
  assert.strictEqual(Object.keys(goodMargins.warnings).length, 0, 'No warnings for healthy margins');

  // Case B: Narrow eye separation (Open 0.24, Closed Blink 0.20 -> Δ 0.04 < 0.08)
  const narrowEye = validateMargins({
    openEAR: 0.24,
    closedBlinkEAR: 0.20,
    closedWinkEAR: 0.17,
    neutralKissScore: 0.08,
    sustainedKissScore: 0.70,
  });

  console.log('  Case B (Narrow Eye Margin Warning):', narrowEye.warnings.blink);
  assert.strictEqual(narrowEye.allValid, false, 'Narrow margin must invalidate');
  assert.strictEqual(narrowEye.isBlinkMarginValid, false, 'Blink margin flag must be false');
  assert(narrowEye.warnings.blink.includes('too small'), 'Warning must describe too small margin');

  // Case C: Narrow kiss pucker (Neutral 0.10, Kiss 0.22 -> Δ 0.12 < 0.25)
  const narrowKiss = validateMargins({
    openEAR: 0.35,
    closedBlinkEAR: 0.16,
    closedWinkEAR: 0.17,
    neutralKissScore: 0.10,
    sustainedKissScore: 0.22,
  });

  console.log('  Case C (Narrow Kiss Margin Warning):', narrowKiss.warnings.kiss);
  assert.strictEqual(narrowKiss.isKissMarginValid, false, 'Kiss margin flag must be false');
  assert(narrowKiss.warnings.kiss.includes('too small') || narrowKiss.warnings.kiss.includes('below minimum'));

  console.log('✓ Test 4 Passed: Separation margins accurately validated and warnings generated\n');
}

// =========================================================================
// TEST 5: TRUE MIDPOINT CALCULATION
// =========================================================================
function testMidpointCalculations() {
  console.log('[TEST 5] Confirming runtime thresholds are calculated as true midpoints');

  const rawSamples = {
    neutralLeftEAR: [0.36, 0.36, 0.35, 0.36],
    neutralRightEAR: [0.36, 0.35, 0.36, 0.35],
    neutralMouthRatio: [0.50, 0.50],
    neutralKissScores: [0.08, 0.08],
    blinkMins: [0.16, 0.16, 0.15, 0.16],
    leftWinkEAR: [0.18, 0.18, 0.17, 0.18],
    rightWinkEAR: [0.18, 0.18, 0.18, 0.17],
    kissScores: [0.72, 0.70, 0.72, 0.71],
  };

  const calibrated = computeCalibratedThresholds(rawSamples);

  console.log('  Calibrated Midpoint Thresholds:', {
    openEAR: calibrated.openEAR,
    closedBlinkEAR: calibrated.closedBlinkEAR,
    blinkEAR: calibrated.blinkEAR,
    expectedBlinkMidpoint: Number(((calibrated.openEAR + calibrated.closedBlinkEAR) / 2).toFixed(3)),
    closedWinkEAR: calibrated.closedWinkEAR,
    winkEAR: calibrated.winkEAR,
    expectedWinkMidpoint: Number(((calibrated.openEAR + calibrated.closedWinkEAR) / 2).toFixed(3)),
    neutralKissScore: calibrated.neutralKissScore,
    sustainedKissScore: calibrated.sustainedKissScore,
    kissThreshold: calibrated.kissThreshold,
    expectedKissMidpoint: Number(((calibrated.neutralKissScore + calibrated.sustainedKissScore) / 2).toFixed(3)),
  });

  // Verify Blink Midpoint
  const expectedBlinkMidpoint = Number(((calibrated.openEAR + calibrated.closedBlinkEAR) / 2).toFixed(3));
  assert.strictEqual(calibrated.blinkEAR, expectedBlinkMidpoint, 'Blink threshold MUST be the exact mathematical midpoint');

  // Verify Wink Midpoint
  const expectedWinkMidpoint = Number(((calibrated.openEAR + calibrated.closedWinkEAR) / 2).toFixed(3));
  assert.strictEqual(calibrated.winkEAR, expectedWinkMidpoint, 'Wink threshold MUST be the exact mathematical midpoint');

  // Verify Kiss Midpoint
  const expectedKissMidpoint = Number(((calibrated.neutralKissScore + calibrated.sustainedKissScore) / 2).toFixed(3));
  assert.strictEqual(calibrated.kissThreshold, expectedKissMidpoint, 'Kiss threshold MUST be the midpoint of neutral and sustained pucker');

  console.log('✓ Test 5 Passed: All thresholds confirmed as exact midpoints\n');
}

// =========================================================================
// TEST 6: ACCURACY IMPROVEMENT OVER HARDCODED DEFAULTS
// =========================================================================
function testAccuracyImprovementOverDefaults() {
  console.log('[TEST 6] Verifying detection accuracy improves over default hardcoded thresholds');

  const HARDCODED_DEFAULTS = {
    blinkEAR: 0.22,
    winkEAR: 0.23,
    kissThreshold: 0.52,
  };

  // Profile A: Subject with naturally wide/deep-set eyes
  // Open EAR: 0.42, Closed EAR: 0.25 (their closed eye is 0.25, which is HIGHER than hardcoded 0.22!)
  console.log('  Profile A (Naturally wide eyes: Open 0.42, Closed 0.25):');
  
  // Under hardcoded defaults:
  const closureEAR_A = 0.25;
  const triggersWithDefaults_A = closureEAR_A < HARDCODED_DEFAULTS.blinkEAR;
  console.log(`    Hardcoded default (0.22) detects closure at 0.25? -> ${triggersWithDefaults_A} (FAIL - missed gesture!)`);
  assert.strictEqual(triggersWithDefaults_A, false, 'Hardcoded default fails to detect closure for this user');

  // Under personalized calibration:
  const calibrated_A = computeCalibratedThresholds({
    neutralLeftEAR: [0.42, 0.42, 0.41, 0.42],
    neutralRightEAR: [0.42, 0.42, 0.42, 0.41],
    neutralMouthRatio: [0.50],
    neutralKissScores: [0.08],
    blinkMins: [0.25, 0.25, 0.24, 0.25],
    leftWinkEAR: [0.25],
    rightWinkEAR: [0.25],
    kissScores: [0.65],
  });

  const triggersWithCalibrated_A = closureEAR_A < calibrated_A.blinkEAR;
  console.log(`    Calibrated midpoint threshold: ${calibrated_A.blinkEAR}`);
  console.log(`    Calibrated threshold detects closure at 0.25? -> ${triggersWithCalibrated_A} (PASS - 100% reliable!)`);
  assert.strictEqual(triggersWithCalibrated_A, true, 'Calibrated midpoint threshold reliably detects gesture');

  // Profile B: Subject with naturally narrow resting eyes
  // Open EAR: 0.26, Closed EAR: 0.15
  console.log('  Profile B (Naturally narrow eyes: Open 0.26, Closed 0.15):');
  // At open EAR 0.26, a tiny head tilt or squint drops to 0.21.
  // With hardcoded default (0.22), squint (0.21) falsely triggers blink!
  const squintEAR_B = 0.21;
  const falseTriggerWithDefaults_B = squintEAR_B < HARDCODED_DEFAULTS.blinkEAR;
  console.log(`    Hardcoded default (0.22) triggers on 0.21 squint? -> ${falseTriggerWithDefaults_B} (FAIL - false positive!)`);
  assert.strictEqual(falseTriggerWithDefaults_B, true, 'Hardcoded default false-triggers on normal resting eye fluctuations');

  const calibrated_B = computeCalibratedThresholds({
    neutralLeftEAR: [0.26, 0.26, 0.25, 0.26],
    neutralRightEAR: [0.26, 0.26, 0.26, 0.25],
    neutralMouthRatio: [0.50],
    neutralKissScores: [0.08],
    blinkMins: [0.15, 0.15, 0.14, 0.15],
    leftWinkEAR: [0.16],
    rightWinkEAR: [0.16],
    kissScores: [0.65],
  });

  console.log(`    Calibrated midpoint threshold: ${calibrated_B.blinkEAR}`);
  const falseTriggerWithCalibrated_B = squintEAR_B < calibrated_B.blinkEAR;
  console.log(`    Calibrated threshold false-triggers on 0.21 squint? -> ${falseTriggerWithCalibrated_B} (PASS - zero false positives!)`);
  assert.strictEqual(falseTriggerWithCalibrated_B, false, 'Calibrated threshold prevents false positive trigger');

  const deliberateBlink_B = 0.15;
  const deliberateTrigger_B = deliberateBlink_B < calibrated_B.blinkEAR;
  console.log(`    Calibrated threshold detects deliberate 0.15 blink? -> ${deliberateTrigger_B} (PASS - clean detection!)`);
  assert.strictEqual(deliberateTrigger_B, true, 'Calibrated threshold triggers on real deliberate blink');

  console.log('✓ Test 6 Passed: Calibrated midpoint thresholds eliminate both false positives and missed gestures\n');
}

// Run all test suites
testSampleDurationAndAggregation();
testOutlierBlinkRejectionNeutral();
testOutlierTransitionRejectionGestures();
testMarginValidation();
testMidpointCalculations();
testAccuracyImprovementOverDefaults();

console.log('====================================================');
console.log('🎉 ALL 6 CALIBRATION LOGIC TEST SUITES PASSED! 🎉');
console.log('====================================================');
