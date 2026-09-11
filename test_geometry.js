import { calculateEAR, calculateKissMetric, LANDMARKS, distance } from './src/utils/geometry.js';
import assert from 'node:assert';

console.log('🧪 Starting Geometry & Gesture Logic Validation...');

// 1. Mock Open Eyes landmarks (478 points)
const mockLandmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

// Set left eye corners & eyelids for normal open eye (EAR ~ 0.35)
mockLandmarks[LANDMARKS.LEFT_EYE.CORNER_OUTER] = { x: 0.65, y: 0.40, z: 0 };
mockLandmarks[LANDMARKS.LEFT_EYE.CORNER_INNER] = { x: 0.55, y: 0.40, z: 0 }; // width = 0.10
mockLandmarks[LANDMARKS.LEFT_EYE.TOP_1] = { x: 0.62, y: 0.38, z: 0 };
mockLandmarks[LANDMARKS.LEFT_EYE.BOTTOM_1] = { x: 0.62, y: 0.42, z: 0 }; // vertical 1 = 0.04
mockLandmarks[LANDMARKS.LEFT_EYE.TOP_2] = { x: 0.58, y: 0.38, z: 0 };
mockLandmarks[LANDMARKS.LEFT_EYE.BOTTOM_2] = { x: 0.58, y: 0.42, z: 0 }; // vertical 2 = 0.04
// EAR = (0.04 + 0.04) / (2 * 0.10) = 0.40

const openLeftEAR = calculateEAR(mockLandmarks, LANDMARKS.LEFT_EYE);
console.log(`✓ Open Left EAR: ${openLeftEAR.toFixed(3)} (Expected ~0.40)`);
assert(openLeftEAR >= 0.35, 'Open Left EAR should be >= 0.35');

// Simulate wink/closed eye (eyelids touching, vertical ~ 0.005)
mockLandmarks[LANDMARKS.LEFT_EYE.TOP_1] = { x: 0.62, y: 0.40, z: 0 };
mockLandmarks[LANDMARKS.LEFT_EYE.BOTTOM_1] = { x: 0.62, y: 0.402, z: 0 };
mockLandmarks[LANDMARKS.LEFT_EYE.TOP_2] = { x: 0.58, y: 0.40, z: 0 };
mockLandmarks[LANDMARKS.LEFT_EYE.BOTTOM_2] = { x: 0.58, y: 0.402, z: 0 };

const closedLeftEAR = calculateEAR(mockLandmarks, LANDMARKS.LEFT_EYE);
console.log(`✓ Closed Left EAR (Wink): ${closedLeftEAR.toFixed(3)} (Expected < 0.15)`);
assert(closedLeftEAR < 0.15, 'Closed Left EAR should be < 0.15');

// 2. Mock Kiss Gesture
// Inter-ocular distance
mockLandmarks[LANDMARKS.RIGHT_EYE.CORNER_OUTER] = { x: 0.35, y: 0.40, z: 0 };
// Interocular = 0.65 - 0.35 = 0.30

// Neutral mouth: width ~ 0.15 (ratio 0.15 / 0.30 = 0.50)
mockLandmarks[LANDMARKS.MOUTH.CORNER_LEFT] = { x: 0.425, y: 0.70, z: 0 };
mockLandmarks[LANDMARKS.MOUTH.CORNER_RIGHT] = { x: 0.575, y: 0.70, z: 0 };
mockLandmarks[LANDMARKS.MOUTH.UPPER_LIP_BOTTOM] = { x: 0.50, y: 0.695, z: 0 };
mockLandmarks[LANDMARKS.MOUTH.LOWER_LIP_TOP] = { x: 0.50, y: 0.705, z: 0 };

const neutralKiss = calculateKissMetric(mockLandmarks, null, 0.50);
console.log(`✓ Neutral Mouth Kiss Score: ${neutralKiss.score.toFixed(3)} (Expected low, < 0.2)`);
assert(neutralKiss.score < 0.2, 'Neutral mouth should have low kiss score');

// Puckered mouth: width drops to 0.08 (corners pulled in), lips closed
mockLandmarks[LANDMARKS.MOUTH.CORNER_LEFT] = { x: 0.46, y: 0.70, z: 0 };
mockLandmarks[LANDMARKS.MOUTH.CORNER_RIGHT] = { x: 0.54, y: 0.70, z: 0 };
mockLandmarks[LANDMARKS.MOUTH.UPPER_LIP_BOTTOM] = { x: 0.50, y: 0.70, z: 0 };
mockLandmarks[LANDMARKS.MOUTH.LOWER_LIP_TOP] = { x: 0.50, y: 0.702, z: 0 };

const puckeredKiss = calculateKissMetric(mockLandmarks, [{ categoryName: 'mouthPucker', score: 0.85 }], 0.50);
console.log(`✓ Puckered Mouth Kiss Score: ${puckeredKiss.score.toFixed(3)} (Expected high, >= 0.7)`);
assert(puckeredKiss.score >= 0.7, 'Puckered mouth should produce high kiss score');

console.log('\n🎉 ALL GEOMETRY TESTS PASSED SUCCESSFULLY!');
