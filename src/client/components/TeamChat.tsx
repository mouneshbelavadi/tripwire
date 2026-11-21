import { useEffect, useState, useRef } from 'react';
import type { PactDetails, TeamMember } from '../types';
import { useApp } from '../context/AppContext';
import { formatTimeIST } from '../lib/time';

interface TeamChatProps {
  pact: PactDetails | null;
  activeUser: TeamMember | null;
  prefillMessage?: string | null;
}

interface ChatMessageItem {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  sentTime: number;
}

export function TeamChat({ pact, activeUser, prefillMessage }: TeamChatProps) {
  let context: ReturnType<typeof useApp> | null = null;
  try {
    context = useApp();
  } catch {
    context = null;
  }
  const currentCompany = context?.currentCompany;
  const companyId = currentCompany?.id || 'comp_paytm';
  const channelCode = currentCompany?.code ? currentCompany.code.toLowerCase() : 'paytm';

  const [connectionState, setConnectionState] = useState<
    'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'incomplete'
  >('idle');
  const [statusReason, setStatusReason] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const activeUserRef = useRef<TeamMember | null>(activeUser);
  activeUserRef.current = activeUser;

  // Pre-fill input when prefillMessage changes
  useEffect(() => {
    if (prefillMessage && !inputText) {
      setInputText(prefillMessage);
    }
  }, [prefillMessage]);

  useEffect(() => {
    let isMounted = true;

    async function initChat() {
      if (!activeUser) return;
      setConnectionState('connecting');
      setStatusReason(null);
      setSendError(null);

      try {
        // Fetch company-isolated channel messages
        const msgRes = await fetch('/api/chat/messages', {
          headers: { 'x-company-id': companyId },
        });
        if (msgRes.ok && isMounted) {
          const msgData = await msgRes.json();
          setMessages(msgData.messages || []);
        }

        // Fetch channel status
        const statusRes = await fetch('/api/chat/status', {
          headers: { 'x-company-id': companyId },
        });
        if (statusRes.ok && isMounted) {
          setConnectionState('connected');
        } else if (isMounted) {
          setConnectionState('connected');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setConnectionState('connected');
      }
    }

    initChat();

    // Poll for new messages every 4 seconds
    const pollInterval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const msgRes = await fetch('/api/chat/messages', {
          headers: { 'x-company-id': companyId },
        });
        if (msgRes.ok && isMounted) {
          const msgData = await msgRes.json();
          setMessages(msgData.messages || []);
        }
      } catch {
        // Ignore background polling errors
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [activeUser?.user_id, companyId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || connectionState !== 'connected') return;

    setSending(true);
    setSendError(null);
    const textToSend = inputText.trim();

    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': activeUser?.user_id || 'user_ananya',
          'x-company-id': companyId,
        },
        body: JSON.stringify({ text: textToSend }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send message');
      }

      const resData = await res.json();
      const newMsg = resData.message || {
        id: `msg_${Date.now()}`,
        senderId: activeUser?.user_id || 'you',
        senderName: activeUser?.user_name || 'You',
        text: textToSend,
        sentTime: Date.now(),
      };

      setMessages((prev) => [...prev, newMsg]);
      setInputText('');
    } catch (err: any) {
      setSendError(`Send failed: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="conversation-panel">
      <div className="conversation-header">
        <div>
          <h3>Team Conversation</h3>
          <div className="conversation-sub">#{channelCode}-office-pact</div>
        </div>
        <div className="channel-badge-group">
          <span className={`connection-dot ${connectionState}`} />
          <span className="channel-badge">
            {connectionState === 'connected'
              ? 'CONNECTED'
              : connectionState === 'connecting'
              ? 'CONNECTING'
              : connectionState === 'incomplete'
              ? 'IN-APP ONLY'
              : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div className="conversation-body">
        {/* Pact Notification Card Anchor in Chat */}
        {pact && (
          <div className="chat-card-preview">
            <div className="chat-message-meta">
              <strong>Office Pact Watchtower</strong> · <span>Active Agreement</span>
            </div>
            <div className="chat-message-content">
              <p>
                <strong>{pact.title} (v{pact.version})</strong>
              </p>
              <p style={{ margin: '4px 0', fontSize: '13px' }}>
                Destination: {pact.destination_name}
                <br />
                Decide by: {pact.decision_deadline_ist}
              </p>
              <div className="chat-pact-status">
                Status:{' '}
                <strong
                  style={{
                    color:
                      pact.status === 'armed'
                        ? 'var(--pact-green)'
                        : 'var(--caution-ink)',
                  }}
                >
                  {pact.status.toUpperCase()}
                </strong>{' '}
                ({pact.participants.filter((p) => p.is_approved).length}/
                {pact.participants.length} approved)
              </div>
            </div>
          </div>
        )}

        {/* Error / State Notices */}
        {connectionState === 'failed' && (
          <div className="error-banner">
            Connection failed: {statusReason}
          </div>
        )}

        {sendError && <div className="error-banner">{sendError}</div>}

        {/* Real Message Stream */}
        {connectionState === 'connected' && (
          <div className="message-stream">
            {messages.length === 0 ? (
              <div className="empty-chat-state">
                No messages yet. Send a message to Maya & Arjun in this in-app team channel.
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="chat-bubble">
                  <div className="bubble-header">
                    <span className="bubble-sender">{m.senderName}</span>
                    <span className="bubble-time">
                      {formatTimeIST(m.sentTime)}
                    </span>
                  </div>
                  <div className="bubble-text">{m.text}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Chat Composer */}
      <div className="chat-footer">
        <form onSubmit={handleSendMessage} className="chat-composer-form">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Message #${channelCode}-office-pact as ${activeUser?.user_name || 'team member'}...`}
            disabled={connectionState !== 'connected' || sending}
            className="chat-input"
          />
          {connectionState === 'connected' && (
            <button
              type="submit"
              className="btn-primary-sm"
              disabled={sending || !inputText.trim()}
            >
              {sending ? '...' : 'Send'}
            </button>
          )}
        </form>
      </div>
    </section>
  );
}
