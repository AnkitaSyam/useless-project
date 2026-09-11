/**
 * Facial landmark geometry calculations for Eye Aspect Ratio (EAR)
 * and Lip Pucker (Kiss gesture) detection using MediaPipe FaceMesh landmarks.
 */

// MediaPipe standard FaceMesh landmark indices
export const LANDMARKS = {
  // Left eye (subject's left eye)
  LEFT_EYE: {
    CORNER_INNER: 362,
    CORNER_OUTER: 263,
    TOP_1: 385,
    TOP_2: 387,
    BOTTOM_1: 380,
    BOTTOM_2: 373,
  },
  // Right eye (subject's right eye)
  RIGHT_EYE: {
    CORNER_INNER: 133,
    CORNER_OUTER: 33,
    TOP_1: 160,
    TOP_2: 158,
    BOTTOM_1: 144,
    BOTTOM_2: 153,
  },
  // Mouth
  MOUTH: {
    CORNER_LEFT: 61,
    CORNER_RIGHT: 291,
    UPPER_LIP_TOP: 0,
    UPPER_LIP_BOTTOM: 13,
    LOWER_LIP_TOP: 14,
    LOWER_LIP_BOTTOM: 17,
  },
  // Face anchors for scale normalization
  FACE: {
    NOSE_TIP: 1,
    CHIN: 152,
    LEFT_TEMPLE: 356,
    RIGHT_TEMPLE: 127,
  },
};

/**
 * 2D or 3D Euclidean distance between two landmark points
 */
export function distance(p1, p2, useZ = false) {
  if (!p1 || !p2) return 0;
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  if (useZ && p1.z !== undefined && p2.z !== undefined) {
    const dz = p1.z - p2.z;
    return Math.hypot(dx, dy, dz);
  }
  return Math.hypot(dx, dy);
}

/**
 * Eye Aspect Ratio (EAR)
 * Computes ratio of vertical eyelid distances to horizontal eye width.
 * Standard formula: (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
 */
export function calculateEAR(landmarks, eyeIndices) {
  if (!landmarks || landmarks.length < 468) return 0;

  const p1 = landmarks[eyeIndices.CORNER_OUTER];
  const p4 = landmarks[eyeIndices.CORNER_INNER];
  const p2 = landmarks[eyeIndices.TOP_1];
  const p6 = landmarks[eyeIndices.BOTTOM_1];
  const p3 = landmarks[eyeIndices.TOP_2];
  const p5 = landmarks[eyeIndices.BOTTOM_2];

  if (!p1 || !p4 || !p2 || !p6 || !p3 || !p5) return 0;

  const vertical1 = distance(p2, p6);
  const vertical2 = distance(p3, p5);
  const horizontal = distance(p1, p4);

  if (horizontal === 0) return 0;
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

/**
 * Lip Pucker / Kiss metric
 * A true kiss/pucker gesture requires:
 * 1. Lip corners horizontally narrowed (mouth width shrinks by 25-45%)
 * 2. Lips vertically compressed together (lipGap is near 0, NOT open like talking or yawn)
 * 3. Squint / smile rejection (if lips part or corners spread, score drops to 0)
 * 4. Blendshape validation with jaw-open & smile penalty
 */
export function calculateKissMetric(landmarks, blendshapes = null, baselineMouthRatio = 0.5) {
  if (!landmarks || landmarks.length < 468) return { score: 0, rawRatio: 0.5, lipGapRatio: 0 };

  const leftCorner = landmarks[LANDMARKS.MOUTH.CORNER_LEFT];
  const rightCorner = landmarks[LANDMARKS.MOUTH.CORNER_RIGHT];
  const upperLip = landmarks[LANDMARKS.MOUTH.UPPER_LIP_BOTTOM];
  const lowerLip = landmarks[LANDMARKS.MOUTH.LOWER_LIP_TOP];

  // Inter-ocular distance as stable scale reference
  const outerLeftEye = landmarks[LANDMARKS.LEFT_EYE.CORNER_OUTER];
  const outerRightEye = landmarks[LANDMARKS.RIGHT_EYE.CORNER_OUTER];
  const interOcularDist = distance(outerLeftEye, outerRightEye);

  if (interOcularDist === 0) return { score: 0, rawRatio: 0.5, lipGapRatio: 0 };

  const mouthWidth = distance(leftCorner, rightCorner);
  const rawRatio = mouthWidth / interOcularDist;

  // Lip vertical gap
  const lipGap = distance(upperLip, lowerLip);
  const lipGapRatio = lipGap / interOcularDist;

  // 1. Horizontal Width Compression: drops during pucker (narrower mouth)
  const widthDrop = Math.max(0, (baselineMouthRatio - rawRatio) / (baselineMouthRatio * 0.32));
  const widthScore = Math.min(1.0, widthDrop);

  // 2. Vertical Lip Compression: lips must be pressed together (not open like talking or yawn)
  // Strict threshold: gap ratio under 0.045
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

  // Combined score (weights blendshape heavily if present, falls back gracefully to geometry)
  const finalScore = blendshapeScore !== null
    ? (blendshapeScore * 0.60 + geometricKiss * 0.40)
    : geometricKiss;

  return {
    score: Math.min(1.0, Math.max(0, finalScore)),
    rawRatio,
    mouthWidth,
    lipGapRatio,
    widthScore,
    compressionScore,
    blendshapeScore,
  };
}

