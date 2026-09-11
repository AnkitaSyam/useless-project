import React from 'react';
import { X, MessageSquare, Volume2, Trash2, Clock } from 'lucide-react';
import { speakText } from '../utils/soundEffects';

export function SentMessagesModal({
  isOpen = false,
  onClose = null,
  messages = [],
  onClearHistory = null,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="history-title">
      <div className="history-dialog">
        <div className="settings-header">
          <div className="settings-title-group">
            <MessageSquare size={20} className="settings-icon" />
            <h2 id="history-title" className="settings-heading">Sent Messages History</h2>
          </div>
          <button
            type="button"
            className="calib-close-btn"
            onClick={onClose}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="history-body">
          {messages.length === 0 ? (
            <div className="empty-history-state">
              <MessageSquare size={48} className="empty-icon" />
              <p className="empty-title">No messages sent yet</p>
              <p className="empty-subtitle">Compose a message and make the kiss gesture 💋 or select SEND to output it.</p>
            </div>
          ) : (
            <div className="history-list">
              {messages.map((item) => (
                <div key={item.id} className="history-item-card">
                  <div className="history-item-header">
                    <span className="history-timestamp">
                      <Clock size={12} /> {item.timestamp}
                    </span>
                    <button
                      type="button"
                      className="history-speak-btn"
                      onClick={() => speakText(item.text)}
                      title="Speak aloud"
                    >
                      <Volume2 size={16} />
                    </button>
                  </div>
                  <div className="history-item-text">{item.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="history-footer">
          {messages.length > 0 && (
            <button
              type="button"
              className="settings-action-btn btn-danger"
              onClick={onClearHistory}
            >
              <Trash2 size={16} /> Clear All
            </button>
          )}
          <button
            type="button"
            className="settings-action-btn btn-primary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
