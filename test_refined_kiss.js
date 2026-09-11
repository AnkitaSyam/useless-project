import assert from 'node:assert';
import { distance, LANDMARKS } from './src/utils/geometry.js';

export function testRefinedKissMetric(landmarks, blendshapes = null, baselineMouthRatio = 0.5) {
  if (!landmarks || landmarks.length < 468) return { score: 0, rawRatio: 0.5 };

  const leftCorner = landmarks[LANDMARKS.MOUTH.CORNER_LEFT];
  const rightCorner = landmarks[LANDMARKS.MOUTH.CORNER_RIGHT];
  const upperLip = landmarks[LANDMARKS.MOUTH.UPPER_LIP_BOTTOM];
  const lowerLip = landmarks[LANDMARKS.MOUTH.LOWER_LIP_TOP];

  const outerLeftEye = landmarks[LANDMARKS.LEFT_EYE.CORNER_OUTER];
  const outerRightEye = landmarks[LANDMARKS.RIGHT_EYE.CORNER_OUTER];
  const interOcularDist = distance(outerLeftEye, outerRightEye);

  if (interOcularDist === 0) return { score: 0, rawRatio: 0.5 };

  const mouthWidth = distance(leftCorner, rightCorner);
  const rawRatio = mouthWidth / interOcularDist;

  // Lip vertical gap
  const lipGap = distance(upperLip, lowerLip);
  const lipGapRatio = lipGap / interOcularDist;

  // 1. Horizontal Width Compression: drops during pucker (narrower mouth)
  const widthDrop = Math.max(0, (baselineMouthRatio - rawRatio) / (baselineMouthRatio * 0.32));
  const widthScore = Math.min(1.0, widthDrop);

  // 2. Vertical Lip Compression: lips must be pressed together (not open like talking or yawn)
  // Tight threshold: gap ratio under 0.045
  const compressionScore = Math.max(0, Math.min(1.0, 1.0 - (lipGapRatio / 0.04)));

  // Squint / smile rejection: if corners widen or lips part, score drops to 0
  const geometricKiss = widthScore * (compressionScore * compressionScore);

  // 3. Blendshape integration with smile & jaw-open penalization
  let blendshapeScore = null;
  if (blendshapes && Array.isArray(blendshapes)) {
    const puckerShape = blendshapes.find(b => b.categoryName === 'mouthPucker')?.score || 0;
    const jawOpen = blendshapes.find(b => b.categoryName === 'jawOpen')?.score || 0;
    const smileL = blendshapes.find(b => b.categoryName === 'mouthSmileLeft')?.score || 0;
    const smileR = blendshapes.find(b => b.categoryName === 'mouthSmileRight')?.score || 0;
    const maxInterference = Math.max(jawOpen * 1.5, smileL * 1.2, smileR * 1.2);

    blendshapeScore = Math.max(0, puckerShape - maxInterference);
  }

  const finalScore = blendshapeScore !== null
    ? (blendshapeScore * 0.6 + geometricKiss * 0.4)
    : geometricKiss;

  return {
    score: Math.min(1.0, Math.max(0, finalScore)),
    rawRatio,
    lipGapRatio,
    widthScore,
    compressionScore,
    blendshapeScore,
  };
}

// Validation tests
const mock = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
mock[LANDMARKS.LEFT_EYE.CORNER_OUTER] = { x: 0.65, y: 0.4 };
mock[LANDMARKS.RIGHT_EYE.CORNER_OUTER] = { x: 0.35, y: 0.4 }; // dist = 0.30

// Case 1: Neutral Mouth (width = 0.15, ratio = 0.50, closed)
mock[LANDMARKS.MOUTH.CORNER_LEFT] = { x: 0.425, y: 0.7 };
mock[LANDMARKS.MOUTH.CORNER_RIGHT] = { x: 0.575, y: 0.7 };
mock[LANDMARKS.MOUTH.UPPER_LIP_BOTTOM] = { x: 0.5, y: 0.698 };
mock[LANDMARKS.MOUTH.LOWER_LIP_TOP] = { x: 0.5, y: 0.702 };
const neutral = testRefinedKissMetric(mock, null, 0.5);
console.log('Case 1 Neutral Score:', neutral.score);
assert(neutral.score < 0.1, 'Neutral mouth should be near 0');

// Case 2: Talking / Open mouth (corners narrow slightly to 0.12, but lips open gap = 0.03)
mock[LANDMARKS.MOUTH.CORNER_LEFT] = { x: 0.44, y: 0.7 };
mock[LANDMARKS.MOUTH.CORNER_RIGHT] = { x: 0.56, y: 0.7 };
mock[LANDMARKS.MOUTH.UPPER_LIP_BOTTOM] = { x: 0.5, y: 0.68 };
mock[LANDMARKS.MOUTH.LOWER_LIP_TOP] = { x: 0.5, y: 0.72 }; // gap = 0.04 (ratio = 0.133)
const talking = testRefinedKissMetric(mock, [{ categoryName: 'jawOpen', score: 0.6 }], 0.5);
console.log('Case 2 Talking Score:', talking.score);
assert(talking.score < 0.1, 'Talking/open mouth should be rejected');

// Case 3: True Kiss (corners narrow to 0.09, lips tightly sealed gap = 0.003)
mock[LANDMARKS.MOUTH.CORNER_LEFT] = { x: 0.455, y: 0.7 };
mock[LANDMARKS.MOUTH.CORNER_RIGHT] = { x: 0.545, y: 0.7 }; // width = 0.09, ratio = 0.30
mock[LANDMARKS.MOUTH.UPPER_LIP_BOTTOM] = { x: 0.5, y: 0.699 };
mock[LANDMARKS.MOUTH.LOWER_LIP_TOP] = { x: 0.5, y: 0.701 }; // gap = 0.002
const kiss = testRefinedKissMetric(mock, [{ categoryName: 'mouthPucker', score: 0.85 }], 0.5);
console.log('Case 3 True Kiss Score:', kiss.score);
assert(kiss.score >= 0.7, 'True kiss should score high');

console.log('✓ All kiss metric tests passed!');
