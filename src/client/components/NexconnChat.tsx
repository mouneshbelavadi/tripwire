import { useEffect, useState, useRef } from 'react';
import type { PactDetails, TeamMember } from '../types';
import {
  NCEngine,
  GroupChannel,
  SendTextMessageParams,
  MessageHandler,
  ConnectionStatusHandler,
  ConnectionStatus,
  LogLevel,
  AreaCode,
} from '@nexconn/chat';

interface NexconnChatProps {
  pact: PactDetails | null;
  activeUser: TeamMember | null;
}

interface ChatMessageItem {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  sentTime: number;
}

export function NexconnChat({ pact, activeUser }: NexconnChatProps) {
  const [connectionState, setConnectionState] = useState<
    'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'incomplete'
  >('idle');
  const [statusReason, setStatusReason] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const groupRef = useRef<GroupChannel | null>(null);
  const activeUserRef = useRef<TeamMember | null>(activeUser);
  activeUserRef.current = activeUser;

  useEffect(() => {
    let isMounted = true;
    const handlerId = `pact_msg_handler_${Date.now()}`;
    const connHandlerId = `pact_conn_handler_${Date.now()}`;

    async function initChat() {
      if (!activeUser) return;
      setConnectionState('connecting');
      setStatusReason(null);
      setSendError(null);

      try {
        // 1. Fetch token from protected server endpoint
        const tokenRes = await fetch('/api/chat/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': activeUser.user_id,
          },
        });

        const tokenData = await tokenRes.json();

        if (!isMounted) return;

        if (tokenRes.status === 503 || tokenData.sponsorIntegration === 'incomplete') {
          // Invariant: Mark sponsor integration incomplete if keys are missing
          setConnectionState('incomplete');
          setStatusReason(
            tokenData.reason || 'NEXCONN_APP_KEY, APP_SECRET or API_BASE missing in environment.'
          );
          return;
        }

        if (!tokenRes.ok || !tokenData.accessToken) {
          throw new Error(tokenData.error || 'Failed to issue Nexconn access token');
        }

        // 2. Initialize Nexconn SDK once
        try {
          NCEngine.initialize({
            appKey: tokenData.appKey,
            logLevel: LogLevel.WARN,
            areaCode: AreaCode.SG,
          });
        } catch (initErr) {
          // May already be initialized in session
          console.debug('NCEngine initialize notice:', initErr);
        }

        // 3. Register owned ConnectionStatusHandler
        NCEngine.addConnectionStatusHandler(
          connHandlerId,
          new ConnectionStatusHandler({
            onConnectionStatusChanged: (event: any) => {
              if (!isMounted) return;
              if (event.status === ConnectionStatus.CONNECTED) {
                setConnectionState('connected');
              } else if (
                event.status === ConnectionStatus.CONNECTING ||
                event.status === ConnectionStatus.SUSPENDED
              ) {
                setConnectionState('reconnecting');
              } else if (event.status === ConnectionStatus.DISCONNECTED) {
                setConnectionState('failed');
                setStatusReason('Disconnected from server');
              }
            },
          })
        );

        // 4. Register owned MessageHandler
        NCEngine.addMessageHandler(
          handlerId,
          new MessageHandler({
            onMessageReceived: (event: any) => {
              if (!isMounted || !event?.message) return;
              const msg = event.message;
              const textContent =
                msg.content?.text || msg.content?.content || JSON.stringify(msg.content);
              const sender = msg.senderUserId === activeUserRef.current?.user_id ? 'You' : msg.senderUserId;

              setMessages((prev) => [
                ...prev,
                {
                  id: msg.messageUId || msg.messageId || String(Date.now()),
                  senderId: msg.senderUserId,
                  senderName: sender,
                  text: textContent,
                  sentTime: msg.sentTime || Date.now(),
                },
              ]);
            },
          })
        );

        // 5. Connect with user token
        const connectResult = await NCEngine.connect({ token: tokenData.accessToken });
        if (!isMounted) return;

        if (connectResult.isOk) {
          setConnectionState('connected');
          groupRef.current = new GroupChannel(tokenData.groupId);
        } else {
          setConnectionState('failed');
          setStatusReason(`Connect error code: ${connectResult.code}`);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setConnectionState('failed');
        setStatusReason(err.message || 'SDK initialization failed');
      }
    }

    initChat();

    return () => {
      isMounted = false;
      try {
        NCEngine.removeMessageHandler(handlerId);
        NCEngine.removeConnectionStatusHandler(connHandlerId);
        NCEngine.disconnect();
      } catch (cleanupErr) {
        // Ignore disconnect errors during unmount
      }
    };
  }, [activeUser?.user_id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !groupRef.current || connectionState !== 'connected') return;

    setSending(true);
    setSendError(null);
    const textToSend = inputText.trim();

    try {
      const params = new SendTextMessageParams({ text: textToSend });
      const result = await groupRef.current.sendMessage(params);

      if (result.isOk && result.data) {
        setMessages((prev) => [
          ...prev,
          {
            id: result.data!.messageId || String(Date.now()),
            senderId: activeUser?.user_id || 'you',
            senderName: activeUser?.user_name || 'You',
            text: textToSend,
            sentTime: Date.now(),
          },
        ]);
        setInputText('');
      } else {
        setSendError(`Send failed: code ${result.code}`);
      }
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
          <div className="conversation-sub">#bellandur-office-pact</div>
        </div>
        <div className="channel-badge-group">
          <span className={`connection-dot ${connectionState}`} />
          <span className="channel-badge">
            {connectionState === 'connected'
              ? 'CONNECTED'
              : connectionState === 'connecting'
              ? 'CONNECTING'
              : connectionState === 'reconnecting'
              ? 'RECONNECTING'
              : connectionState === 'incomplete'
              ? 'INCOMPLETE'
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

        {/* Sponsor Track Incomplete Banner (When keys missing per astra.md) */}
        {connectionState === 'incomplete' && (
          <div className="sponsor-incomplete-box">
            <div className="incomplete-title">Nexconn Track: Credentials Pending</div>
            <p className="incomplete-desc">
              {statusReason || 'Environment keys are missing.'}
            </p>
            <div className="incomplete-details">
              <div><strong>Channel:</strong> group_office_pact</div>
              <div><strong>SDK Versions:</strong> @nexconn/chat 26.5.1, engine 26.5.1</div>
              <div><strong>Session Identity:</strong> {activeUser?.user_name} ({activeUser?.user_id})</div>
            </div>
            <div className="incomplete-disclaimer">
              Per strict project rules, mock chat is never disguised as a live SDK connection. Once credentials are set in .env, live WebSocket connectivity will activate automatically.
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
                No messages yet. Send a message to Maya & Arjun in this group channel.
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="chat-bubble">
                  <div className="bubble-header">
                    <span className="bubble-sender">{m.senderName}</span>
                    <span className="bubble-time">
                      {new Date(m.sentTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
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
            placeholder={
              connectionState === 'connected'
                ? `Message #bellandur-office-pact as ${activeUser?.user_name}...`
                : connectionState === 'incomplete'
                ? 'Chat paused: Nexconn credentials pending in .env'
                : 'Connecting to Nexconn...'
            }
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
