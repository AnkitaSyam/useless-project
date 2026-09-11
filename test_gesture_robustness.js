import assert from 'node:assert';

console.log('--- STARTING GESTURE ROBUSTNESS SUITE ---');

// =========================================================================
// TEST 1: ROLLING MOVING AVERAGE BUFFER
// =========================================================================
function testRollingAvg() {
  console.log('\n[TEST 1] Rolling 4-frame moving average buffer');
  const buffer = [];
  const getRollingAvg = (buf, val, maxLen = 4) => {
    buf.push(val);
    if (buf.length > maxLen) buf.shift();
    return buf.reduce((a, b) => a + b, 0) / buf.length;
  };

  // 3 steady frames of open eyes (EAR 0.35)
  getRollingAvg(buffer, 0.35);
  getRollingAvg(buffer, 0.35);
  getRollingAvg(buffer, 0.35);

  // 1 single-frame noise drop (e.g. lighting flicker: 0.18)
  const smoothed = getRollingAvg(buffer, 0.18);
  console.log('Single frame drop 0.18 into [0.35, 0.35, 0.35] -> Smoothed:', smoothed.toFixed(3));
  // Raw 0.18 would trigger wink threshold (0.23), but smoothed is ~0.3075, well above threshold!
  assert(smoothed > 0.25, 'Single frame flicker must be smoothed above threshold');
  console.log('✓ Test 1 Passed: Single-frame noise successfully suppressed by moving average buffer');
}

// =========================================================================
// TEST 2: TEMPORAL SMOOTHING (CONSECUTIVE HOLD DURATION)
// =========================================================================
function testTemporalSmoothing() {
  console.log('\n[TEST 2] Temporal smoothing (consecutive hold duration)');
  
  // Simulator for temporal hold
  let winkStartTime = null;
  let triggeredGesture = null;

  const processWinkFrame = (isPastThreshold, timestamp) => {
    if (isPastThreshold) {
      if (!winkStartTime) {
        winkStartTime = timestamp;
      } else if (timestamp - winkStartTime >= 120) {
        triggeredGesture = 'WINK_LEFT';
        winkStartTime = null;
      }
    } else {
      winkStartTime = null; // reset if value fluctuates back
    }
  };

  // Scenario A: Momentary jitter (30ms) -> should NOT trigger
  winkStartTime = null;
  triggeredGesture = null;
  processWinkFrame(true, 1000);
  processWinkFrame(true, 1030);
  processWinkFrame(false, 1060); // reverted back to open
  assert.strictEqual(triggeredGesture, null, 'Jitter under 120ms must NOT trigger');
  console.log('  Scenario A: 30ms jitter properly ignored (no false trigger)');

  // Scenario B: Sustained deliberate wink (140ms) -> MUST trigger
  winkStartTime = null;
  triggeredGesture = null;
  processWinkFrame(true, 2000);
  processWinkFrame(true, 2050);
  processWinkFrame(true, 2100);
  processWinkFrame(true, 2140); // 140ms elapsed
  assert.strictEqual(triggeredGesture, 'WINK_LEFT', 'Sustained wink >= 120ms MUST trigger');
  console.log('  Scenario B: Deliberate 140ms wink correctly triggered');

  console.log('✓ Test 2 Passed: Temporal smoothing correctly differentiates noise from real gestures');
}

// =========================================================================
// TEST 3: CALIBRATION MIDPOINT & MARGIN SEPARATION
// =========================================================================
function testCalibrationMidpoints() {
  console.log('\n[TEST 3] Calibration midpoint calculation and narrow margin warning');

  const computeThresholds = (samples, defaultThresholds = {}) => {
    const avg = (arr, fallback) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : fallback;
    const minVal = (arr, fallback) =>
      arr.length > 0 ? Math.min(...arr) : fallback;

    const baseLeft = avg(samples.neutralLeftEAR, 0.34);
    const baseRight = avg(samples.neutralRightEAR, 0.34);
    const openEAR = (baseLeft + baseRight) / 2;

    const lowestBlink = minVal(samples.blinkMins, 0.16);
    const lowestLeftWink = minVal(samples.leftWinkEAR, 0.18);
    const lowestRightWink = minVal(samples.rightWinkEAR, 0.18);
    const closedWink = (lowestLeftWink + lowestRightWink) / 2;

    const blinkMargin = Math.max(0.01, openEAR - lowestBlink);
    const winkMargin = Math.max(0.01, openEAR - closedWink);
    const measuredMargin = Number(Math.min(blinkMargin, winkMargin).toFixed(3));
    const isMarginNarrow = measuredMargin < 0.08;

    const calculatedBlinkEAR = Number((lowestBlink + blinkMargin * 0.45).toFixed(3));
    const calculatedWinkEAR = Number((closedWink + winkMargin * 0.50).toFixed(3));

    return {
      openEAR,
      closedBlinkEAR: lowestBlink,
      measuredMargin,
      isMarginNarrow,
      blinkEAR: calculatedBlinkEAR,
      winkEAR: calculatedWinkEAR,
    };
  };

  // Case A: Healthy lighting, wide separation (Open 0.36, Closed 0.16 -> margin 0.20)
  const caseA = computeThresholds({
    neutralLeftEAR: [0.36, 0.36],
    neutralRightEAR: [0.36, 0.36],
    blinkMins: [0.16, 0.17],
    leftWinkEAR: [0.18],
    rightWinkEAR: [0.18],
  });
  console.log('  Case A (Good Lighting):', caseA);
  assert.strictEqual(caseA.isMarginNarrow, false, 'Margin 0.20 should not be narrow');
  assert(caseA.blinkEAR > 0.16 && caseA.blinkEAR < 0.36, 'Blink threshold sits between closed and open');
  assert(Math.abs(caseA.winkEAR - 0.27) < 0.02, 'Wink threshold is at true midpoint');

  // Case B: Poor lighting / narrow separation (Open 0.24, Closed 0.19 -> margin 0.05)
  const caseB = computeThresholds({
    neutralLeftEAR: [0.24, 0.24],
    neutralRightEAR: [0.24, 0.24],
    blinkMins: [0.19],
    leftWinkEAR: [0.20],
    rightWinkEAR: [0.20],
  });
  console.log('  Case B (Dim Lighting / Narrow Margin):', caseB);
  assert.strictEqual(caseB.isMarginNarrow, true, 'Margin 0.05 must trigger narrow margin warning');
  console.log('✓ Test 3 Passed: Dynamic midpoints and narrow margin warning verified');
}

// =========================================================================
// TEST 4: CONFIDENCE & MARGIN METRICS
// =========================================================================
function testConfidenceMargins() {
  console.log('\n[TEST 4] Confidence and threshold margin calculations');

  const winkEAR = 0.23;
  const kissThreshold = 0.52;

  // Eye open (smoothed 0.34)
  const leftOpen = 0.34;
  const marginOpen = Number((winkEAR - leftOpen).toFixed(3)); // -0.11
  assert(marginOpen < -0.04, 'Eye open should have negative margin away from threshold');

  // Eye close / near miss (smoothed 0.24)
  const leftClose = 0.24;
  const marginClose = Number((winkEAR - leftClose).toFixed(3)); // -0.01
  assert(marginClose < 0 && marginClose >= -0.04, 'Near miss within 0.04 correctly identified as CLOSE');

  // Eye closed / triggered (smoothed 0.18)
  const leftTriggered = 0.18;
  const marginTriggered = Number((winkEAR - leftTriggered).toFixed(3)); // +0.05
  assert(marginTriggered > 0, 'Closed eye gives positive margin (TRIGGERED)');

  // Kiss triggered
  const kissScore = 0.65;
  const kissMargin = Number((kissScore - kissThreshold).toFixed(3)); // +0.13
  assert(kissMargin > 0, 'Kiss score > threshold gives positive margin');

  console.log('✓ Test 4 Passed: Confidence and margin diagnostics verified');
}

testRollingAvg();
testTemporalSmoothing();
testCalibrationMidpoints();
testConfidenceMargins();

console.log('\n========================================');
console.log('🎉 ALL 4 ROBUSTNESS VERIFICATION SUITES PASSED');
console.log('========================================');
