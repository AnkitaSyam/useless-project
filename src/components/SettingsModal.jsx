import React from 'react';
import { X, Sliders, Volume2, Sparkles, RotateCcw, Keyboard, Eye, Smile, Clock } from 'lucide-react';
import { DEFAULT_THRESHOLDS } from '../hooks/useGestureDetector';

export function SettingsModal({
  isOpen = false,
  onClose = null,
  thresholds = DEFAULT_THRESHOLDS,
  onUpdateThresholds = null,
  keyboardLayout = 'QWERTY',
  onUpdateLayout = null,
  autoScan = false,
  onToggleAutoScan = null,
  autoScanSpeed = 1500,
  onUpdateAutoScanSpeed = null,
  soundEnabled = true,
  onToggleSound = null,
  ttsEnabled = true,
  onToggleTTS = null,
  manualFallback = false,
  onToggleManualFallback = null,
  onRestartCalibration = null,
}) {
  if (!isOpen) return null;

  const handleSliderChange = (key, value) => {
    if (onUpdateThresholds) {
      onUpdateThresholds({
        ...thresholds,
        [key]: parseFloat(value),
      });
    }
  };

  const handleResetDefaults = () => {
    if (onUpdateThresholds) {
      onUpdateThresholds(DEFAULT_THRESHOLDS);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="settings-dialog">
        <div className="settings-header">
          <div className="settings-title-group">
            <Sliders size={20} className="settings-icon" />
            <h2 id="settings-title" className="settings-heading">Preferences & Gesture Sensitivity</h2>
          </div>
          <button
            type="button"
            className="calib-close-btn"
            onClick={onClose}
            title="Close Settings"
          >
            <X size={18} />
          </button>
        </div>

        <div className="settings-body">
          {/* Section: Gesture Thresholds */}
          <div className="settings-section">
            <h3 className="section-title">
              <Eye size={16} /> Eye Gesture Thresholds
            </h3>

            {/* Blink EAR */}
            <div className="setting-control-row">
              <div className="control-label-group">
                <span className="control-name">Blink EAR Threshold</span>
                <span className="control-hint">EAR below this triggers blink key selection</span>
              </div>
              <div className="control-slider-group">
                <input
                  type="range"
                  min="0.12"
                  max="0.32"
                  step="0.01"
                  value={thresholds.blinkEAR}
                  onChange={(e) => handleSliderChange('blinkEAR', e.target.value)}
                />
                <span className="slider-val-badge">{thresholds.blinkEAR}</span>
              </div>
            </div>

            {/* Wink EAR */}
            <div className="setting-control-row">
              <div className="control-label-group">
                <span className="control-name">Wink EAR Threshold</span>
                <span className="control-hint">EAR for single eye closure</span>
              </div>
              <div className="control-slider-group">
                <input
                  type="range"
                  min="0.14"
                  max="0.34"
                  step="0.01"
                  value={thresholds.winkEAR}
                  onChange={(e) => handleSliderChange('winkEAR', e.target.value)}
                />
                <span className="slider-val-badge">{thresholds.winkEAR}</span>
              </div>
            </div>

            {/* Wink Delta */}
            <div className="setting-control-row">
              <div className="control-label-group">
                <span className="control-name">Wink Asymmetry Delta</span>
                <span className="control-hint">Difference required between open & closed eye</span>
              </div>
              <div className="control-slider-group">
                <input
                  type="range"
                  min="0.03"
                  max="0.16"
                  step="0.01"
                  value={thresholds.winkDelta}
                  onChange={(e) => handleSliderChange('winkDelta', e.target.value)}
                />
                <span className="slider-val-badge">{thresholds.winkDelta}</span>
              </div>
            </div>
          </div>

          {/* Section: Kiss / Send Threshold */}
          <div className="settings-section">
            <h3 className="section-title">
              <Smile size={16} /> Mouth Kiss / Send Threshold
            </h3>

            <div className="setting-control-row">
              <div className="control-label-group">
                <span className="control-name">Kiss Pucker Strength</span>
                <span className="control-hint">Lower = easier to trigger, Higher = requires firmer pucker</span>
              </div>
              <div className="control-slider-group">
                <input
                  type="range"
                  min="0.35"
                  max="0.80"
                  step="0.02"
                  value={thresholds.kissThreshold}
                  onChange={(e) => handleSliderChange('kissThreshold', e.target.value)}
                />
                <span className="slider-val-badge">{thresholds.kissThreshold}</span>
              </div>
            </div>
          </div>

          {/* Section: Cooldown & Auto-Scan */}
          <div className="settings-section">
            <h3 className="section-title">
              <Clock size={16} /> Timing & Scanning
            </h3>

            {/* Debounce cooldown */}
            <div className="setting-control-row">
              <div className="control-label-group">
                <span className="control-name">Gesture Cooldown / Debounce</span>
                <span className="control-hint">Pause after gesture to prevent accidental repeats</span>
              </div>
              <div className="control-slider-group">
                <input
                  type="range"
                  min="250"
                  max="1200"
                  step="50"
                  value={thresholds.cooldownMs || 700}
                  onChange={(e) => handleSliderChange('cooldownMs', e.target.value)}
                />
                <span className="slider-val-badge">{thresholds.cooldownMs || 700}ms</span>
              </div>
            </div>

            {/* Auto scan toggle */}
            <div className="setting-control-row">
              <div className="control-label-group">
                <span className="control-name">Auto-Scanning</span>
                <span className="control-hint">Automatically cycle active key across grid</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={autoScan}
                  onChange={onToggleAutoScan}
                />
                <span className="slider-round" />
              </label>
            </div>

            {autoScan && (
              <div className="setting-control-row">
                <div className="control-label-group">
                  <span className="control-name">Scan Speed</span>
                  <span className="control-hint">Time spent on each key before moving</span>
                </div>
                <div className="control-slider-group">
                  <input
                    type="range"
                    min="600"
                    max="3000"
                    step="100"
                    value={autoScanSpeed}
                    onChange={(e) => onUpdateAutoScanSpeed && onUpdateAutoScanSpeed(parseInt(e.target.value))}
                  />
                  <span className="slider-val-badge">{autoScanSpeed}ms</span>
                </div>
              </div>
            )}
          </div>

          {/* Section: Accessibility & Layout */}
          <div className="settings-section">
            <h3 className="section-title">
              <Keyboard size={16} /> Accessibility & Layout
            </h3>

            {/* Layout selector */}
            <div className="setting-control-row">
              <div className="control-label-group">
                <span className="control-name">Keyboard Layout</span>
                <span className="control-hint">Switch between QWERTY and Alphabetical</span>
              </div>
              <div className="button-group-toggle">
                <button
                  type="button"
                  className={`toggle-option ${keyboardLayout === 'QWERTY' ? 'selected' : ''}`}
                  onClick={() => onUpdateLayout && onUpdateLayout('QWERTY')}
                >
                  QWERTY
                </button>
                <button
                  type="button"
                  className={`toggle-option ${keyboardLayout === 'ALPHABETICAL' ? 'selected' : ''}`}
                  onClick={() => onUpdateLayout && onUpdateLayout('ALPHABETICAL')}
                >
                  Alphabetical
                </button>
              </div>
            </div>

            {/* Manual fallback mode */}
            <div className="setting-control-row">
              <div className="control-label-group">
                <span className="control-name">Keyboard / Click Fallback</span>
                <span className="control-hint">Allows Arrows (left/right), Space (select), Enter (send)</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={manualFallback}
                  onChange={onToggleManualFallback}
                />
                <span className="slider-round" />
              </label>
            </div>

            {/* Sound effects */}
            <div className="setting-control-row">
              <div className="control-label-group">
                <span className="control-name">Tactile Sound Effects</span>
                <span className="control-hint">Synthesized mechanical audio feedback</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={onToggleSound}
                />
                <span className="slider-round" />
              </label>
            </div>

            {/* Text-To-Speech */}
            <div className="setting-control-row">
              <div className="control-label-group">
                <span className="control-name">Text-To-Speech on Send</span>
                <span className="control-hint">Read aloud outgoing messages automatically</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={ttsEnabled}
                  onChange={onToggleTTS}
                />
                <span className="slider-round" />
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="settings-footer">
          <button
            type="button"
            className="settings-action-btn btn-danger"
            onClick={handleResetDefaults}
          >
            <RotateCcw size={16} /> Reset Defaults
          </button>

          <button
            type="button"
            className="settings-action-btn btn-secondary"
            onClick={onRestartCalibration}
          >
            <Sparkles size={16} /> Re-run Calibration
          </button>

          <button
            type="button"
            className="settings-action-btn btn-primary"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
