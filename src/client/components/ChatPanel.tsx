import type { PactDetails } from '../types';

interface ChatPanelProps {
  pact: PactDetails | null;
  activeUser: { user_id: string; user_name: string; neighbourhood: string; role: string } | null;
}

export function ChatPanel({ pact, activeUser }: ChatPanelProps) {
  return (
    <section className="conversation-panel">
      <div className="conversation-header">
        <div>
          <h3>Team Conversation</h3>
          <div className="conversation-sub">#bellandur-office-pact</div>
        </div>
        <span className="channel-badge">In-App Team Channel</span>
      </div>

      <div className="conversation-body">
        {pact ? (
          <div className="chat-card-preview">
            <div className="chat-message-meta">
              <strong>System Notice</strong> · <span>Today at 07:30 IST</span>
            </div>
            <div className="chat-message-content">
              <p>
                <strong>Office Pact: {pact.title} (v{pact.version})</strong>
              </p>
              <p style={{ margin: '6px 0', fontSize: '13px' }}>
                Destination: {pact.destination_name}
                <br />
                Deadline: {pact.decision_deadline_ist}
              </p>
              <div className="chat-pact-status">
                Status:{' '}
                <strong style={{ color: pact.status === 'armed' ? 'var(--pact-green)' : 'var(--caution-ink)' }}>
                  {pact.status.toUpperCase()}
                </strong>{' '}
                ({pact.participants.filter((p) => p.is_approved).length}/{pact.participants.length} approved)
              </div>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--ink-secondary)' }}>No active pact selected.</p>
        )}

        <div className="chat-instructions">
          <p>
            Connected as <strong>{activeUser?.user_name}</strong> ({activeUser?.neighbourhood}).
          </p>
          <p style={{ marginTop: '4px', fontSize: '12px', color: 'var(--ink-muted)' }}>
            In-app team channel and two-way group message exchange.
          </p>
        </div>
      </div>

      <div className="chat-footer">
        <input
          type="text"
          placeholder="Message #bellandur-office-pact..."
          disabled
          className="chat-input-placeholder"
        />
      </div>
    </section>
  );
}
