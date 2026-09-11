import React, { useMemo } from 'react';
import { Delete, Send, Space, Trash2 } from 'lucide-react';
import { LAYOUTS, getFlatKeys } from '../utils/keyboardLayouts';

export { LAYOUTS, getFlatKeys };

export function Keyboard({
  layoutType = 'QWERTY',
  activeIndex = 0,
  onKeyClick = null,
  isBlinking = false,
}) {
  const currentLayout = LAYOUTS[layoutType] || LAYOUTS.QWERTY;
  const flatKeys = useMemo(() => getFlatKeys(layoutType), [layoutType]);

  const activeKey = flatKeys[activeIndex] || flatKeys[0];

  // Verified render logging for active index tracking
  // console.log(`[Keyboard UI] Active key: index=${activeIndex}, key=${activeKey?.id}`);


  return (
    <div className="keyboard-container" role="region" aria-label="Virtual Facial Gesture Keyboard">
      <div className="keyboard-grid">
        {currentLayout.map((row, rIdx) => (
          <div key={`row-${rIdx}`} className="keyboard-row">
            {row.map((keyItem) => {
              const keyId = typeof keyItem === 'string' ? keyItem : keyItem.id;
              const keyIndex = flatKeys.findIndex((k) => k.id === keyId);
              const isActive = keyIndex === activeIndex;
              const span = typeof keyItem === 'object' && keyItem.span ? keyItem.span : 1;
              const variant = typeof keyItem === 'object' && keyItem.variant ? keyItem.variant : 'normal';

              return (
                <button
                  key={keyId}
                  id={`key-${keyId}`}
                  type="button"
                  tabIndex={-1}
                  className={`key-button ${isActive ? 'key-active' : ''} ${
                    isActive && isBlinking ? 'key-pressed' : ''
                  } key-span-${span} key-variant-${variant}`}
                  onClick={() => onKeyClick && onKeyClick(flatKeys[keyIndex])}
                  aria-selected={isActive}
                  aria-label={typeof keyItem === 'string' ? `Key ${keyItem}` : keyItem.label}
                >
                  {/* Subtle active target crosshair/halo */}
                  {isActive && <span className="active-glow-ring" />}

                  {/* Key Content */}
                  <span className="key-content">
                    {keyId === 'BACKSPACE' && (
                      <span className="special-key">
                        <Delete size={22} className="key-icon" />
                        <span className="key-title">BACK</span>
                      </span>
                    )}
                    {keyId === 'SPACE' && (
                      <span className="special-key">
                        <Space size={24} className="key-icon" />
                        <span className="key-title">SPACE</span>
                      </span>
                    )}
                    {keyId === 'CLEAR' && (
                      <span className="special-key">
                        <Trash2 size={20} className="key-icon" />
                        <span className="key-title">CLEAR</span>
                      </span>
                    )}
                    {keyId === 'SEND' && (
                      <span className="special-key send-key-content">
                        <Send size={22} className="key-icon" />
                        <span className="key-title">SEND</span>
                        <span className="kiss-badge" title="Or Kiss to Send">💋</span>
                      </span>
                    )}
                    {typeof keyItem === 'string' && <span className="letter-char">{keyItem}</span>}
                  </span>

                  {/* Visual index badge for easy visual tracking */}
                  <span className="key-subindex">{keyIndex + 1}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
