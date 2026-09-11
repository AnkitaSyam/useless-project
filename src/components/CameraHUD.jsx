import React, { useState } from 'react';
import { Eye, Smile, Minimize2, Maximize2, AlertCircle, RefreshCw } from 'lucide-react';

export function CameraHUD({
  videoRef,
  canvasRef,
  metrics,
  thresholds,
  confidenceData = null,
  hasFace = false,
  cameraError = null,
  onRetryCamera = null,
  isLoading = false,
}) {
  const [minimized, setMinimized] = useState(false);

  // In mirrored mode, video is flipped horizontally with transform: scaleX(-1)
  // Use smoothed moving-average metrics from confidenceData if available
  const leftEAR = confidenceData?.smoothedLeftEAR ?? metrics?.leftEAR ?? 0;
  const rightEAR = confidenceData?.smoothedRightEAR ?? metrics?.rightEAR ?? 0;
  const kissScore = confidenceData?.smoothedKissScore ?? metrics?.kissScore ?? 0;

  // Live margins from active thresholds (how close smoothed value is to triggering)
  // Positive = past threshold (active/triggered)
  // Negative = distance remaining until threshold
  const leftMargin = confidenceData?.leftMargin ?? Number((thresholds.winkEAR - leftEAR).toFixed(3));
  const rightMargin = confidenceData?.rightMargin ?? Number((thresholds.winkEAR - rightEAR).toFixed(3));
  const blinkMargin = confidenceData?.blinkMargin ?? Number((thresholds.blinkEAR - Math.max(leftEAR, rightEAR)).toFixed(3));
  const kissMargin = confidenceData?.kissMargin ?? Number((kissScore - thresholds.kissThreshold).toFixed(3));

  const isLeftClosed = leftMargin >= 0;
  const isRightClosed = rightMargin >= 0;
  const isKissActive = kissMargin >= 0;
  const isBlinkActive = blinkMargin >= 0;

  const renderMarginBadge = (margin, nearThreshold = 0.04) => {
    if (margin >= 0) {
      return <span className="hud-margin-badge badge-triggered">+{margin.toFixed(2)} GO</span>;
    } else if (margin >= -nearThreshold) {
      return <span className="hud-margin-badge badge-close">{margin.toFixed(2)} CLOSE</span>;
    } else {
      return <span className="hud-margin-badge badge-normal">{margin.toFixed(2)}</span>;
    }
  };

  const renderKissMarginBadge = (margin) => {
    if (margin >= 0) {
      return <span className="hud-margin-badge badge-triggered-kiss">+{margin.toFixed(2)} GO</span>;
    } else if (margin >= -0.07) {
      return <span className="hud-margin-badge badge-close">{margin.toFixed(2)} CLOSE</span>;
    } else {
      return <span className="hud-margin-badge badge-normal">{margin.toFixed(2)}</span>;
    }
  };

  return (
    <aside className={`camera-hud-container ${minimized ? 'hud-minimized' : ''}`} aria-label="Webcam and biometric telemetry">
      {/* HUD Header Bar */}
      <div className="camera-hud-header">
        <div className="hud-status-badge">
          <span
            className={`status-circle ${
              cameraError ? 'status-err' : hasFace ? 'status-ok' : 'status-warn'
            }`}
          />
          <span className="status-label-text">
            {cameraError ? 'Camera Error' : hasFace ? 'Face Tracked' : 'Searching Face...'}
          </span>
        </div>

        <button
          type="button"
          className="hud-toggle-btn"
          onClick={() => setMinimized(!minimized)}
          title={minimized ? 'Expand Camera View' : 'Minimize Camera View'}
        >
          {minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
        </button>
      </div>

      {/* Main Video & Overlay Area */}
      {!minimized && (
        <div className="hud-video-wrapper">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="hud-video-stream"
          />
          <canvas
            ref={canvasRef}
            className="hud-canvas-overlay"
          />

          {isLoading && (
            <div className="hud-loading-scrim">
              <div className="spinner-orbit" />
              <span>Starting Vision...</span>
            </div>
          )}

          {cameraError && (
            <div className="hud-error-scrim">
              <AlertCircle size={24} color="#f43f5e" />
              <p className="hud-error-msg">{cameraError}</p>
              {onRetryCamera && (
                <button
                  type="button"
                  className="retry-cam-btn"
                  onClick={onRetryCamera}
                >
                  <RefreshCw size={14} /> Retry
                </button>
              )}
            </div>
          )}

          {/* Biometric Gauges & Live Confidence Telemetry Overlay */}
          <div className="hud-biometrics-panel">
            {/* Left Eye EAR Meter & Margin */}
            <div className={`metric-gauge-card ${isLeftClosed ? 'gauge-triggered' : ''}`}>
              <div className="gauge-label-row">
                <span className="gauge-title">
                  <Eye size={12} /> Left Eye
                </span>
                <div className="gauge-stats-group">
                  <span className="gauge-val">{leftEAR.toFixed(2)}</span>
                  {renderMarginBadge(leftMargin)}
                </div>
              </div>
              <div className="gauge-bar-track">
                <div
                  className="gauge-bar-fill eye-fill"
                  style={{ width: `${Math.min(100, (leftEAR / 0.5) * 100)}%` }}
                />
                {/* Threshold Marker */}
                <div
                  className="gauge-threshold-pin"
                  style={{ left: `${(thresholds.winkEAR / 0.5) * 100}%` }}
                  title={`Wink Threshold (${thresholds.winkEAR})`}
                />
              </div>
            </div>

            {/* Right Eye EAR Meter & Margin */}
            <div className={`metric-gauge-card ${isRightClosed ? 'gauge-triggered' : ''}`}>
              <div className="gauge-label-row">
                <span className="gauge-title">
                  <Eye size={12} /> Right Eye
                </span>
                <div className="gauge-stats-group">
                  <span className="gauge-val">{rightEAR.toFixed(2)}</span>
                  {renderMarginBadge(rightMargin)}
                </div>
              </div>
              <div className="gauge-bar-track">
                <div
                  className="gauge-bar-fill eye-fill"
                  style={{ width: `${Math.min(100, (rightEAR / 0.5) * 100)}%` }}
                />
                {/* Threshold Marker */}
                <div
                  className="gauge-threshold-pin"
                  style={{ left: `${(thresholds.winkEAR / 0.5) * 100}%` }}
                  title={`Wink Threshold (${thresholds.winkEAR})`}
                />
              </div>
            </div>

            {/* Mouth / Kiss Meter & Margin */}
            <div className={`metric-gauge-card ${isKissActive ? 'gauge-triggered-kiss' : ''}`}>
              <div className="gauge-label-row">
                <span className="gauge-title">
                  <Smile size={12} /> Kiss / Pucker
                </span>
                <div className="gauge-stats-group">
                  <span className="gauge-val">{kissScore.toFixed(2)}</span>
                  {renderKissMarginBadge(kissMargin)}
                </div>
              </div>
              <div className="gauge-bar-track">
                <div
                  className="gauge-bar-fill kiss-fill"
                  style={{ width: `${Math.min(100, kissScore * 100)}%` }}
                />
                {/* Threshold Marker */}
                <div
                  className="gauge-threshold-pin kiss-pin"
                  style={{ left: `${thresholds.kissThreshold * 100}%` }}
                  title={`Kiss Send Threshold (${thresholds.kissThreshold})`}
                />
              </div>
            </div>

            {/* Blink Margin & Key Selection Telemetry */}
            <div className="gauge-label-row blink-telemetry-row">
              <span className="gauge-title">
                <Eye size={12} /> Blink Selection
              </span>
              <div className="telemetry-badges">
                <span
                  className={`blink-margin-badge ${
                    isBlinkActive ? 'badge-triggered' : blinkMargin >= -0.04 ? 'badge-close' : ''
                  }`}
                  title="Blink margin distance from threshold"
                >
                  Blink Δ {blinkMargin >= 0 ? `+${blinkMargin.toFixed(2)}` : blinkMargin.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Active Runtime Thresholds Bar */}
            <div className="hud-runtime-thresholds" title="Active thresholds verified at runtime">
              <span className="hud-thresh-tag">Blink &lt; {thresholds.blinkEAR}</span>
              <span className="hud-thresh-tag">Wink &lt; {thresholds.winkEAR}</span>
              <span className="hud-thresh-tag">Kiss &gt; {thresholds.kissThreshold}</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
