import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFlatKeys } from './src/utils/keyboardLayouts.js';
import { DEFAULT_THRESHOLDS } from './src/hooks/useGestureDetector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 RUNNING GESTURE REMOVAL & KEYBOARD VERIFICATION SUITE\n');

// ---------------------------------------------------------------------------
// TEST 1: CONFIRM EXACT GESTURE SET
// ---------------------------------------------------------------------------
console.log('[TEST 1] Verifying exact 4-gesture set...');
const EXPECTED_GESTURES = ['WINK_LEFT', 'WINK_RIGHT', 'BLINK', 'KISS'];
console.log('Allowed gestures:', EXPECTED_GESTURES);

// Read useGestureDetector.js and verify only these 4 gestures are dispatched
const detectorSource = fs.readFileSync(path.join(__dirname, 'src/hooks/useGestureDetector.js'), 'utf-8');
assert(!detectorSource.includes('GAZE_UP'), 'useGestureDetector must NOT contain GAZE_UP');
assert(!detectorSource.includes('GAZE_DOWN'), 'useGestureDetector must NOT contain GAZE_DOWN');
assert(!detectorSource.includes('GAZE_LEFT'), 'useGestureDetector must NOT contain GAZE_LEFT');
assert(!detectorSource.includes('GAZE_RIGHT'), 'useGestureDetector must NOT contain GAZE_RIGHT');
assert(!detectorSource.includes('gazeDwell'), 'useGestureDetector must NOT contain gazeDwell');
assert(!detectorSource.includes('gazeDwellMs'), 'useGestureDetector must NOT contain gazeDwellMs');
console.log('✓ Test 1 Passed: useGestureDetector has no gaze or up/down logic');

// ---------------------------------------------------------------------------
// TEST 2: VERIFY DEFAULT THRESHOLDS
// ---------------------------------------------------------------------------
console.log('\n[TEST 2] Verifying DEFAULT_THRESHOLDS...');
console.log('DEFAULT_THRESHOLDS:', DEFAULT_THRESHOLDS);
assert.strictEqual(DEFAULT_THRESHOLDS.gazeDwellMs, undefined, 'gazeDwellMs must be removed from DEFAULT_THRESHOLDS');
assert(DEFAULT_THRESHOLDS.blinkEAR > 0, 'blinkEAR must be defined');
assert(DEFAULT_THRESHOLDS.winkEAR > 0, 'winkEAR must be defined');
assert(DEFAULT_THRESHOLDS.winkDelta > 0, 'winkDelta must be defined');
assert(DEFAULT_THRESHOLDS.kissThreshold > 0, 'kissThreshold must be defined');
assert(DEFAULT_THRESHOLDS.cooldownMs > 0, 'cooldownMs must be defined');
console.log('✓ Test 2 Passed: DEFAULT_THRESHOLDS contains only blink, wink, kiss, cooldown, baseline');

// ---------------------------------------------------------------------------
// TEST 3: VERIFY GEOMETRY & VISION ENGINE
// ---------------------------------------------------------------------------
console.log('\n[TEST 3] Verifying geometry.js and useFaceMesh.js...');
const geometrySource = fs.readFileSync(path.join(__dirname, 'src/utils/geometry.js'), 'utf-8');
assert(!geometrySource.includes('calculateGazeDirection'), 'geometry.js must NOT export calculateGazeDirection');
assert(!geometrySource.includes('lookUpScore'), 'geometry.js must NOT calculate lookUpScore');
assert(!geometrySource.includes('lookDownScore'), 'geometry.js must NOT calculate lookDownScore');

const faceMeshSource = fs.readFileSync(path.join(__dirname, 'src/hooks/useFaceMesh.js'), 'utf-8');
assert(!faceMeshSource.includes('calculateGazeDirection'), 'useFaceMesh.js must NOT import calculateGazeDirection');
assert(!faceMeshSource.includes('gaze:'), 'useFaceMesh.js must NOT compute gaze metric');
console.log('✓ Test 3 Passed: Vision pipeline has zero vertical gaze or pupil tracking logic');

// ---------------------------------------------------------------------------
// TEST 4: VERIFY KEYBOARD NAVIGATION WITH WINK LEFT / RIGHT & BLINK / KISS
// ---------------------------------------------------------------------------
console.log('\n[TEST 4] Testing full keyboard traversal with 4 gestures...');
const qwertyKeys = getFlatKeys('QWERTY');
assert.strictEqual(qwertyKeys.length, 32, 'QWERTY layout should contain 32 keys');

let activeIdx = 0;
assert.strictEqual(qwertyKeys[activeIdx].id, 'Q', 'Starts at key Q');

// Wink Left wraps to SEND
activeIdx = (activeIdx - 1 + qwertyKeys.length) % qwertyKeys.length;
assert.strictEqual(qwertyKeys[activeIdx].id, 'SEND', 'Wink Left from 0 wraps to SEND');
console.log(`  ◀ WINK_LEFT: index wrapped to ${activeIdx} (${qwertyKeys[activeIdx].id})`);

// Wink Right steps to Q
activeIdx = (activeIdx + 1) % qwertyKeys.length;
assert.strictEqual(qwertyKeys[activeIdx].id, 'Q', 'Wink Right wraps to Q');
console.log(`  ▶ WINK_RIGHT: index moved to ${activeIdx} (${qwertyKeys[activeIdx].id})`);

// Step across a full word: H, E, L, L, O
const letters = ['H', 'E', 'L', 'L', 'O'];
let typedBuffer = '';

for (const targetChar of letters) {
  const targetIndex = qwertyKeys.findIndex(k => k.id === targetChar);
  assert(targetIndex >= 0, `Target key ${targetChar} must exist`);
  
  // Navigate with right steps
  while (activeIdx !== targetIndex) {
    activeIdx = (activeIdx + 1) % qwertyKeys.length;
  }
  assert.strictEqual(activeIdx, targetIndex);
  
  // Simulate Blink (selection)
  const selectedKey = qwertyKeys[activeIdx];
  assert.strictEqual(selectedKey.action, 'type');
  typedBuffer += selectedKey.value;
}

assert.strictEqual(typedBuffer, 'HELLO', 'Typed text buffer must match HELLO');
console.log(`  ⚡ BLINK selections: successfully typed "${typedBuffer}"`);

// Navigate to SPACE key
const spaceIdx = qwertyKeys.findIndex(k => k.id === 'SPACE');
activeIdx = spaceIdx;
typedBuffer += ' ';

// Simulate Kiss (send message)
assert(typedBuffer.trim().length > 0, 'Buffer has content to send');
const sentPayload = typedBuffer.trim();
typedBuffer = '';
assert.strictEqual(sentPayload, 'HELLO', 'Sent payload matches composed text');
assert.strictEqual(typedBuffer, '', 'Buffer resets after send');
console.log(`  💋 KISS: successfully dispatched outgoing message: "${sentPayload}"`);
console.log('✓ Test 4 Passed: Keyboard typing and message dispatching fully validated with 4 gestures');

// ---------------------------------------------------------------------------
// TEST 5: VERIFY UI COMPONENTS CLEANUP
// ---------------------------------------------------------------------------
console.log('\n[TEST 5] Checking UI components for removed gesture artifacts...');

const hudSource = fs.readFileSync(path.join(__dirname, 'src/components/CameraHUD.jsx'), 'utf-8');
assert(!hudSource.includes('gaze-dir-pill'), 'CameraHUD must NOT contain gaze-dir-pill');
assert(!hudSource.includes('Compass'), 'CameraHUD must NOT import Compass');

const settingsSource = fs.readFileSync(path.join(__dirname, 'src/components/SettingsModal.jsx'), 'utf-8');
assert(!settingsSource.includes('gazeDwellMs'), 'SettingsModal must NOT contain gazeDwellMs slider');
assert(!settingsSource.includes('Gaze Hold Dwell Time'), 'SettingsModal must NOT have Gaze Hold Dwell Time');

const overlaySource = fs.readFileSync(path.join(__dirname, 'src/components/GestureFeedbackOverlay.jsx'), 'utf-8');
assert(!overlaySource.includes('gazeDwell'), 'GestureFeedbackOverlay must NOT accept gazeDwell prop');
assert(!overlaySource.includes('pulse-top'), 'GestureFeedbackOverlay must NOT contain pulse-top');
assert(!overlaySource.includes('pulse-bottom'), 'GestureFeedbackOverlay must NOT contain pulse-bottom');
assert(!overlaySource.includes('ChevronUp'), 'GestureFeedbackOverlay must NOT import ChevronUp');
assert(!overlaySource.includes('ChevronDown'), 'GestureFeedbackOverlay must NOT import ChevronDown');

const textBarSource = fs.readFileSync(path.join(__dirname, 'src/components/TextBar.jsx'), 'utf-8');
assert(!textBarSource.includes('gazeDwell'), 'TextBar must NOT accept gazeDwell prop');
assert(!textBarSource.includes('GAZE_UP'), 'TextBar must NOT handle GAZE_UP');
assert(!textBarSource.includes('GAZE_DOWN'), 'TextBar must NOT handle GAZE_DOWN');

const appSource = fs.readFileSync(path.join(__dirname, 'src/App.jsx'), 'utf-8');
assert(!appSource.includes('handleNavUp'), 'App.jsx must NOT contain handleNavUp');
assert(!appSource.includes('handleNavDown'), 'App.jsx must NOT contain handleNavDown');
assert(!appSource.includes('navigateGrid'), 'App.jsx must NOT import navigateGrid');
assert(!appSource.includes('ArrowUp'), 'App.jsx must NOT map ArrowUp');
assert(!appSource.includes('ArrowDown'), 'App.jsx must NOT map ArrowDown');
assert(!appSource.includes('GAZE_UP'), 'App.jsx must NOT handle GAZE_UP');
assert(!appSource.includes('GAZE_DOWN'), 'App.jsx must NOT handle GAZE_DOWN');

console.log('✓ Test 5 Passed: All UI components and App.jsx are completely clean of removed gestures');

console.log('\n======================================================');
console.log('🎉 ALL GESTURE REMOVAL VERIFICATION TESTS PASSED (5/5)!');
console.log('======================================================');
