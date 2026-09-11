import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFaceMesh } from './hooks/useFaceMesh';
import { useGestureDetector, DEFAULT_THRESHOLDS } from './hooks/useGestureDetector';
import { Keyboard } from './components/Keyboard';
import { getFlatKeys } from './utils/keyboardLayouts';
import { TextBar } from './components/TextBar';
import { CameraHUD } from './components/CameraHUD';
import { GestureFeedbackOverlay } from './components/GestureFeedbackOverlay';
import { CalibrationModal } from './components/CalibrationModal';
import { SettingsModal } from './components/SettingsModal';
import { SentMessagesModal } from './components/SentMessagesModal';
import {
  playNavigateSound,
  playSelectSound,
  playBackspaceSound,
  playSendSound,
  speakText,
} from './utils/soundEffects';
import './App.css';

export function App() {
  // Composed text state
  const [text, setText] = useState('');
  const [sentMessages, setSentMessages] = useState([]);
  const [lastSentMessage, setLastSentMessage] = useState('');
  const [showSendSuccess, setShowSendSuccess] = useState(false);

  // Active key scanning state (stored in React useState for reactive re-renders)
  const [activeIndex, setActiveIndex] = useState(0);
  const [isBlinkingKey, setIsBlinkingKey] = useState(false);

  // UI Modals
  const [isCalibrating, setIsCalibrating] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Settings & Thresholds
  const [thresholds, setThresholds] = useState(() => {
    try {
      const saved = localStorage.getItem('gazefree_thresholds');
      return saved ? JSON.parse(saved) : DEFAULT_THRESHOLDS;
    } catch {
      return DEFAULT_THRESHOLDS;
    }
  });

  const [keyboardLayout, setKeyboardLayout] = useState('QWERTY');
  const [autoScan, setAutoScan] = useState(false);
  const [autoScanSpeed, setAutoScanSpeed] = useState(2250); // 1.5x greater than previous 1500ms
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [manualFallback, setManualFallback] = useState(true);

  // Compute total keys for active layout
  const flatKeys = useMemo(() => getFlatKeys(keyboardLayout), [keyboardLayout]);
  const flatKeyCount = flatKeys.length;

  // Stable refs to prevent stale closures inside real-time RAF loop & gesture callbacks
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const flatKeysRef = useRef(flatKeys);
  flatKeysRef.current = flatKeys;

  const keyboardLayoutRef = useRef(keyboardLayout);
  keyboardLayoutRef.current = keyboardLayout;

  const isCalibratingRef = useRef(isCalibrating);
  isCalibratingRef.current = isCalibrating;

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const ttsEnabledRef = useRef(ttsEnabled);
  ttsEnabledRef.current = ttsEnabled;

  // Bounds clamping only when layout key count changes
  useEffect(() => {
    setActiveIndex((prev) => {
      if (prev >= flatKeyCount) {
        console.log(`[GazeFree] Clamping activeIndex ${prev} -> 0 (layout size: ${flatKeyCount})`);
        return 0;
      }
      return prev;
    });
  }, [flatKeyCount]);

  // Send message action
  const handleSendMessage = useCallback(() => {
    setText((currText) => {
      if (!currText.trim()) return currText;

      const messageContent = currText.trim();
      console.log('[GazeFree] 💋 MESSAGE SENT VIA KISS GESTURE:', messageContent);

      playSendSound(soundEnabledRef.current);
      if (ttsEnabledRef.current) {
        speakText(messageContent);
      }

      const newMessage = {
        id: Date.now().toString(),
        text: messageContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };

      setSentMessages(prev => [newMessage, ...prev]);
      setLastSentMessage(messageContent);
      setShowSendSuccess(true);

      setTimeout(() => {
        setShowSendSuccess(false);
      }, 2800);

      return '';
    });
  }, []);

  // Key activation action (from blink or click)
  const handleSelectKey = useCallback((keyItem) => {
    if (!keyItem) return;

    setIsBlinkingKey(true);
    setTimeout(() => setIsBlinkingKey(false), 220);

    if (keyItem.action === 'type') {
      setText(prev => prev + keyItem.value);
      playSelectSound(soundEnabledRef.current);
    } else if (keyItem.action === 'space') {
      setText(prev => prev + ' ');
      playSelectSound(soundEnabledRef.current);
    } else if (keyItem.action === 'backspace') {
      setText(prev => prev.slice(0, -1));
      playBackspaceSound(soundEnabledRef.current);
    } else if (keyItem.action === 'clear') {
      setText('');
      playBackspaceSound(soundEnabledRef.current);
    } else if (keyItem.action === 'send') {
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Navigation handlers with functional state updates & explicit logging
  const handleNavLeft = useCallback(() => {
    playNavigateSound('left', soundEnabledRef.current);
    setActiveIndex((prev) => {
      const count = flatKeysRef.current.length || 32;
      const next = (prev - 1 + count) % count;
      console.log(`[GazeFree] ◀ STEP LEFT: activeIndex ${prev} -> ${next} (Key: ${flatKeysRef.current[next]?.id})`);
      return next;
    });
  }, []);

  const handleNavRight = useCallback(() => {
    playNavigateSound('right', soundEnabledRef.current);
    setActiveIndex((prev) => {
      const count = flatKeysRef.current.length || 32;
      const next = (prev + 1) % count;
      console.log(`[GazeFree] ▶ STEP RIGHT: activeIndex ${prev} -> ${next} (Key: ${flatKeysRef.current[next]?.id})`);
      return next;
    });
  }, []);

  // Blink selection handler
  const handleSelectActiveKey = useCallback(() => {
    const currIndex = activeIndexRef.current;
    const activeKey = flatKeysRef.current[currIndex];
    console.log(`[GazeFree] ⚡ BLINK: selected key "${activeKey?.id}" at index ${currIndex}`);
    if (activeKey) {
      handleSelectKey(activeKey);
    }
  }, [handleSelectKey]);

  // Gesture handler callback - connected from useGestureDetector
  const handleGestureDetected = useCallback((gestureType) => {
    console.log(`[GazeFree] Gesture received: ${gestureType} | isCalibrating: ${isCalibratingRef.current}`);
    if (isCalibratingRef.current) return;

    if (gestureType === 'WINK_LEFT') {
      handleNavLeft();
    } else if (gestureType === 'WINK_RIGHT') {
      handleNavRight();
    } else if (gestureType === 'BLINK') {
      handleSelectActiveKey();
    } else if (gestureType === 'KISS') {
      handleSendMessage();
    }
  }, [handleNavLeft, handleNavRight, handleSelectActiveKey, handleSendMessage]);

  // Gesture detector hook
  const {
    activeGesture,
    cooldownRemaining,
    confidenceData,
    processFrame,
    triggerManualGesture,
  } = useGestureDetector({
    thresholds,
    onGesture: handleGestureDetected,
    enabled: true,
  });

  // FaceMesh vision hook
  const {
    videoRef,
    canvasRef,
    isLoading: isVisionLoading,
    loadingStatus,
    hasFace,
    cameraError,
    metrics,
    retryCamera,
  } = useFaceMesh({
    onFrameMetrics: processFrame,
    baselineMouthRatio: thresholds.baselineMouthRatio || 0.5,
  });

  // Auto-scan timer
  useEffect(() => {
    if (!autoScan || isCalibrating || isSettingsOpen || isHistoryOpen) return;

    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % flatKeyCount);
      playNavigateSound('right', false); // silent or subtle
    }, autoScanSpeed);

    return () => clearInterval(interval);
  }, [autoScan, autoScanSpeed, flatKeyCount, isCalibrating, isSettingsOpen, isHistoryOpen]);

  // Keyboard accessibility fallback (Arrow keys, Space, Enter)
  useEffect(() => {
    if (!manualFallback) return;

    const handleKeyDown = (e) => {
      // Don't trigger if typing in a normal input
      if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        triggerManualGesture('WINK_LEFT');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        triggerManualGesture('WINK_RIGHT');
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        triggerManualGesture('BLINK');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        triggerManualGesture('KISS');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [manualFallback, triggerManualGesture]);

  // Save thresholds
  const handleUpdateThresholds = (newThresholds) => {
    console.log('[App] 🚀 CALIBRATION/SETTINGS APPLIED THRESHOLDS:', newThresholds);
    setThresholds(newThresholds);
    try {
      localStorage.setItem('gazefree_thresholds', JSON.stringify(newThresholds));
    } catch {
      // Ignore
    }
  };

  return (
    <div className="app-viewport">
      {/* Visual Gesture Feedback Overlay (Pulses, Send Chime) */}
      <GestureFeedbackOverlay
        activeGesture={activeGesture}
        lastSentMessage={lastSentMessage}
        showSendSuccess={showSendSuccess}
      />

      {/* Top Composed Text Bar & Status */}
      <TextBar
        text={text}
        onTextChange={setText}
        activeGesture={activeGesture}
        cooldownRemaining={cooldownRemaining}
        cooldownMax={thresholds.cooldownMs || 700}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        sentCount={sentMessages.length}
        autoScan={autoScan}
        onToggleAutoScan={() => setAutoScan(prev => !prev)}
        ttsEnabled={ttsEnabled}
      />

      {/* Main Full-Screen Virtual Keyboard Grid */}
      <main className="main-stage">
        <Keyboard
          layoutType={keyboardLayout}
          activeIndex={activeIndex}
          onKeyClick={handleSelectKey}
          isBlinking={isBlinkingKey}
        />
      </main>

      {/* Live Webcam & Biometrics HUD (Floating Bottom-Right) */}
      <CameraHUD
        videoRef={videoRef}
        canvasRef={canvasRef}
        metrics={metrics}
        thresholds={thresholds}
        confidenceData={confidenceData}
        hasFace={hasFace}
        cameraError={cameraError}
        onRetryCamera={retryCamera}
        isLoading={isVisionLoading}
      />

      {/* Calibration Wizard Modal */}
      <CalibrationModal
        isOpen={isCalibrating}
        onClose={() => setIsCalibrating(false)}
        onApplyThresholds={handleUpdateThresholds}
        currentMetrics={metrics}
        hasFace={hasFace}
        defaultThresholds={thresholds}
      />

      {/* Settings & Sensitivity Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        thresholds={thresholds}
        onUpdateThresholds={handleUpdateThresholds}
        keyboardLayout={keyboardLayout}
        onUpdateLayout={setKeyboardLayout}
        autoScan={autoScan}
        onToggleAutoScan={() => setAutoScan(prev => !prev)}
        autoScanSpeed={autoScanSpeed}
        onUpdateAutoScanSpeed={setAutoScanSpeed}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(prev => !prev)}
        ttsEnabled={ttsEnabled}
        onToggleTTS={() => setTtsEnabled(prev => !prev)}
        manualFallback={manualFallback}
        onToggleManualFallback={() => setManualFallback(prev => !prev)}
        onRestartCalibration={() => {
          setIsSettingsOpen(false);
          setIsCalibrating(true);
        }}
      />

      {/* Sent Messages History Drawer */}
      <SentMessagesModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        messages={sentMessages}
        onClearHistory={() => setSentMessages([])}
      />
    </div>
  );
}

export default App;
