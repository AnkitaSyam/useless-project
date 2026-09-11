import React, { useState } from 'react';
import { Volume2, Copy, Check, MessageSquare, Sparkles, Sliders, Play, Pause } from 'lucide-react';
import { speakText } from '../utils/soundEffects';

const COMMON_WORDS = [
  'THE', 'AND', 'YOU', 'THAT', 'WAS', 'FOR', 'ARE', 'WITH', 'HIS', 'THEY',
  'HELLO', 'HELP', 'PLEASE', 'THANK', 'YES', 'NO', 'WATER', 'TIRED', 'PAIN',
  'HUNGRY', 'HAPPY', 'GOOD', 'NEED', 'WANT', 'LOVE', 'NAME', 'TIME', 'TODAY'
];

export function TextBar({
  text = '',
  onTextChange = null,
  activeGesture = null,
  cooldownRemaining = 0,
  cooldownMax = 700,
  onOpenSettings = null,
  onOpenHistory = null,
  sentCount = 0,
  autoScan = false,
  onToggleAutoScan = null,
  ttsEnabled = true,
}) {
  const [copied, setCopied] = useState(false);

  // Compute predictive suggestions from common words
  const words = text.trim().split(/\s+/);
  const currentToken = words[words.length - 1]?.toUpperCase() || '';
  const suggestions = currentToken.length >= 1
    ? COMMON_WORDS.filter(w => w.startsWith(currentToken) && w !== currentToken).slice(0, 3)
    : [];

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  const handleSpeak = () => {
    if (text) {
      speakText(text);
    }
  };

  const handleWordSelect = (word) => {
    if (!onTextChange) return;
    const wordsCopy = [...words];
    wordsCopy[wordsCopy.length - 1] = word;
    onTextChange(wordsCopy.join(' ') + ' ');
  };

  // Human friendly status badge
  let gestureLabel = 'READY';
  let gestureClass = 'status-ready';

  if (activeGesture === 'WINK_LEFT') {
    gestureLabel = '◀ STEP LEFT';
    gestureClass = 'status-wink-left';
  } else if (activeGesture === 'WINK_RIGHT') {
    gestureLabel = '▶ STEP RIGHT';
    gestureClass = 'status-wink-right';
  } else if (activeGesture === 'BLINK') {
    gestureLabel = '⚡ BLINK (TYPE KEY)';
    gestureClass = 'status-blink';
  } else if (activeGesture === 'KISS') {
    gestureLabel = '💋 KISS GESTURE (SENDING)';
    gestureClass = 'status-kiss';
  }

  const cooldownPercent = cooldownMax > 0 ? (cooldownRemaining / cooldownMax) * 100 : 0;

  return (
    <header className="textbar-header">
      {/* Top action row */}
      <div className="textbar-top-row">
        <div className="app-branding">
          <span className="brand-dot" />
          <h1 className="brand-title">GazeFree</h1>
          <span className="brand-badge">Facial Gestures</span>
        </div>

        {/* Real-time gesture status pill */}
        <div className="gesture-status-wrapper">
          <div className={`gesture-pill ${gestureClass}`}>
            <span className="status-indicator-dot" />
            <span className="status-text">{gestureLabel}</span>
          </div>
          {cooldownRemaining > 0 && (
            <div className="cooldown-track" title="Gesture debounce cooldown">
              <div
                className="cooldown-bar"
                style={{ width: `${cooldownPercent}%` }}
              />
            </div>
          )}
        </div>

        {/* Quick controls */}
        <div className="header-controls">
          {onToggleAutoScan && (
            <button
              type="button"
              className={`control-pill-btn ${autoScan ? 'active-scan' : ''}`}
              onClick={onToggleAutoScan}
              title={autoScan ? 'Auto-Scan Active (Click to Pause)' : 'Enable Auto-Scan'}
            >
              {autoScan ? <Pause size={16} /> : <Play size={16} />}
              <span>{autoScan ? 'Scanning' : 'Manual Wink'}</span>
            </button>
          )}

          <button
            type="button"
            className="control-icon-btn"
            onClick={onOpenHistory}
            title={`View Sent History (${sentCount})`}
          >
            <MessageSquare size={18} />
            {sentCount > 0 && <span className="counter-badge">{sentCount}</span>}
          </button>

          <button
            type="button"
            className="control-icon-btn"
            onClick={onOpenSettings}
            title="Gesture Settings & Calibration"
          >
            <Sliders size={18} />
          </button>
        </div>
      </div>

      {/* Main text box display */}
      <div className="text-display-card">
        <div className="text-content-area">
          {text ? (
            <span className="typed-text">{text}</span>
          ) : (
            <span className="placeholder-text">Wink left/right to move • Blink both eyes to select key • Kiss to send</span>
          )}
          <span className="animated-caret" />
        </div>

        {/* Right side utility icons */}
        <div className="text-actions-group">
          {text && (
            <>
              <button
                type="button"
                className="text-action-btn"
                onClick={handleSpeak}
                title="Speak text aloud"
              >
                <Volume2 size={18} />
              </button>
              <button
                type="button"
                className="text-action-btn"
                onClick={handleCopy}
                title="Copy to clipboard"
              >
                {copied ? <Check size={18} color="#10b981" /> : <Copy size={18} />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Word prediction quick chips */}
      {suggestions.length > 0 && (
        <div className="word-suggestions-row">
          <Sparkles size={14} className="sparkle-icon" />
          <span className="suggestion-label">Suggestions:</span>
          {suggestions.map((w) => (
            <button
              key={w}
              type="button"
              className="suggestion-chip"
              onClick={() => handleWordSelect(w)}
            >
              +{w}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
