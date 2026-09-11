import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Heart } from 'lucide-react';
import confetti from 'canvas-confetti';

export function GestureFeedbackOverlay({
  activeGesture = null,
  lastSentMessage = null,
  showSendSuccess = false,
}) {
  // Fire confetti on kiss / send
  useEffect(() => {
    if (showSendSuccess) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.2 },
          colors: ['#06b6d4', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'],
        });
      } catch {
        // Ignore if canvas-confetti unavailable
      }
    }
  }, [showSendSuccess]);

  return (
    <div className="gesture-feedback-overlay" pointer-events="none">
      {/* Left Wink Pulse Indicator */}
      <div className={`nav-pulse-indicator pulse-left ${activeGesture === 'WINK_LEFT' ? 'pulse-active' : ''}`}>
        <div className="pulse-arrow-glow">
          <ChevronLeft size={64} strokeWidth={3} />
          <span className="pulse-text">STEP LEFT</span>
        </div>
      </div>

      {/* Right Wink Pulse Indicator */}
      <div className={`nav-pulse-indicator pulse-right ${activeGesture === 'WINK_RIGHT' ? 'pulse-active' : ''}`}>
        <div className="pulse-arrow-glow">
          <ChevronRight size={64} strokeWidth={3} />
          <span className="pulse-text">STEP RIGHT</span>
        </div>
      </div>

      {/* Blink Pulse Flash */}
      {activeGesture === 'BLINK' && (
        <div className="blink-flash-beacon">
          <div className="blink-ring" />
          <span className="blink-tag">SELECTED</span>
        </div>
      )}

      {/* Kiss Gesture Notification */}
      {activeGesture === 'KISS' && (
        <div className="kiss-alert-beacon">
          <div className="kiss-heart-burst">
            <span className="kiss-emoji">💋</span>
            <Heart size={32} className="heart-svg" />
          </div>
          <span className="kiss-tag">KISS DETECTED • SENDING</span>
        </div>
      )}

      {/* Message Sent Banner Notification */}
      {showSendSuccess && (
        <div className="sent-success-toast">
          <div className="toast-icon-wrap">
            <CheckCircle2 size={24} color="#10b981" />
          </div>
          <div className="toast-body">
            <span className="toast-headline">Message Sent!</span>
            <span className="toast-snippet">"{lastSentMessage || 'Message'}"</span>
          </div>
        </div>
      )}
    </div>
  );
}

