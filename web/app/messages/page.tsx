'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from '@web/providers/session-provider';
import {
  useDmThreads, useDmMessages, useSendDm,
  useGroupThreads, useGroupMessages, useSendGroupMessage, useCreateGroup,
  useSearchPeople,
  type DmThread, type GroupThread, type DmMessage, type GroupMessage,
} from '@web/lib/messages';
import { useCurrentProfile } from '@web/lib/feed';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Avatar({
  name, avatarUrl, size = 40,
}: { name: string; avatarUrl: string | null; size?: number }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt={name} style={{
        width: size, height: size, borderRadius: '50%',
        objectFit: 'cover', flexShrink: 0,
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'var(--tlight)', color: 'var(--trust)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

// ── Thread row ────────────────────────────────────────────────────────────────

function DmThreadRow({
  thread, active, onClick,
}: { thread: DmThread; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', width: '100%', border: 'none',
      background: active ? 'var(--tlight)' : 'transparent',
      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      borderRadius: 10, transition: 'background 0.12s',
    }}>
      <Avatar name={thread.name} avatarUrl={thread.avatarUrl} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{thread.name}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0, marginLeft: 6 }}>{timeAgo(thread.lastTime)}</span>
        </div>
        <div style={{
          fontSize: 12.5, color: 'var(--muted)', marginTop: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {thread.lastIsMine ? 'You: ' : ''}{thread.lastText}
        </div>
      </div>
    </button>
  );
}

function GroupThreadRow({
  thread, active, onClick,
}: { thread: GroupThread; active: boolean; onClick: () => void }) {
  const name = thread.name || `Group · ${thread.memberCount} people`;
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', width: '100%', border: 'none',
      background: active ? 'var(--tlight)' : 'transparent',
      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      borderRadius: 10, transition: 'background 0.12s',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        background: 'var(--trust)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
      }}>
        👥
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{name}</span>
          {thread.lastTime && (
            <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0, marginLeft: 6 }}>{timeAgo(thread.lastTime)}</span>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {thread.lastUser ? `${thread.lastUser}: ` : ''}{thread.lastText ?? 'No messages yet'}
        </div>
      </div>
    </button>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ isMine, text, time }: { isMine: boolean; text: string; time: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start',
      marginBottom: 6,
    }}>
      <div style={{
        maxWidth: '72%', padding: '9px 13px', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isMine ? 'var(--trust)' : 'var(--paper)',
        color: isMine ? '#fff' : 'var(--ink)',
        fontSize: 14, lineHeight: 1.45,
        border: isMine ? 'none' : '1px solid var(--border)',
      }}>
        <div>{text}</div>
        <div style={{ fontSize: 10, opacity: 0.6, marginTop: 3, textAlign: isMine ? 'right' : 'left' }}>
          {timeAgo(time)}
        </div>
      </div>
    </div>
  );
}

// ── DM conversation ───────────────────────────────────────────────────────────

function DmConversation({ userId, thread }: { userId: string; thread: DmThread }) {
  const { data: messages = [], isLoading } = useDmMessages(userId, thread.friendId);
  const sendDm = useSendDm();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sendDm.isPending) return;
    const content = text.trim();
    setText('');
    await sendDm.mutateAsync({ senderId: userId, friendId: thread.friendId, content });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <Avatar name={thread.name} avatarUrl={thread.avatarUrl} size={36} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{thread.name}</div>
          {thread.username && <div style={{ fontSize: 12, color: 'var(--muted)' }}>@{thread.username}</div>}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
        {isLoading && <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}
        {!isLoading && messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>👋</div>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>Say hi to {thread.name}!</div>
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} isMine={m.sender_id === userId} text={m.content} time={m.created_at} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{
        padding: '12px 16px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${thread.name}…`}
          style={inputStyle}
          onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
        <button type="submit" disabled={!text.trim() || sendDm.isPending} style={sendBtnStyle}>
          ↑
        </button>
      </form>
    </div>
  );
}

// ── Group conversation ────────────────────────────────────────────────────────

function GroupConversation({
  userId, userName, userAvatar, thread,
}: { userId: string; userName: string; userAvatar: string | null; thread: GroupThread }) {
  const { data: messages = [], isLoading } = useGroupMessages(thread.id);
  const sendMsg = useSendGroupMessage();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sendMsg.isPending) return;
    const content = text.trim();
    setText('');
    await sendMsg.mutateAsync({
      groupId: thread.id, userId, text: content,
      senderName: userName, senderAvatar: userAvatar,
    });
  }

  const groupName = thread.name || `Group · ${thread.memberCount} people`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: 'var(--trust)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
        }}>👥</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{groupName}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{thread.memberCount} members</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
        {isLoading && <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}
        {!isLoading && messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>No messages yet. Start the conversation!</div>
          </div>
        )}
        {messages.map((m) => {
          const isMine = m.user_id === userId;
          return (
            <div key={m.id} style={{ marginBottom: 8 }}>
              {!isMine && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2, paddingLeft: 4 }}>
                  {m.sender_name}
                </div>
              )}
              <Bubble isMine={isMine} text={m.text} time={m.created_at} />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{
        padding: '12px 16px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message group…"
          style={inputStyle}
          onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
        <button type="submit" disabled={!text.trim() || sendMsg.isPending} style={sendBtnStyle}>
          ↑
        </button>
      </form>
    </div>
  );
}

// ── New DM / Group modal ──────────────────────────────────────────────────────

function NewConversationModal({
  userId,
  onClose,
  onDmStarted,
  onGroupCreated,
}: {
  userId: string;
  onClose: () => void;
  onDmStarted: (thread: DmThread) => void;
  onGroupCreated: (groupId: string) => void;
}) {
  const [mode, setMode] = useState<'dm' | 'group'>('dm');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ id: string; name: string; avatarUrl: string | null }[]>([]);
  const [groupName, setGroupName] = useState('');
  const { data: results = [] } = useSearchPeople(query);
  const createGroup = useCreateGroup();

  function togglePerson(p: { id: string; full_name: string | null; username: string | null; avatar_url: string | null }) {
    const name = p.full_name || p.username || 'Someone';
    setSelected((prev) =>
      prev.find((s) => s.id === p.id)
        ? prev.filter((s) => s.id !== p.id)
        : [...prev, { id: p.id, name, avatarUrl: p.avatar_url }],
    );
  }

  async function handleCreate() {
    if (mode === 'dm' && selected.length === 1) {
      const p = selected[0];
      onDmStarted({
        friendId: p.id, name: p.name, username: null, avatarUrl: p.avatarUrl,
        lastText: '', lastTime: new Date().toISOString(), lastIsMine: false, isUnread: false,
      });
    } else if (mode === 'group' && selected.length >= 1) {
      const groupId = await createGroup.mutateAsync({
        userId, name: groupName.trim() || null,
        memberIds: selected.map((s) => s.id),
      });
      onGroupCreated(groupId);
    }
    onClose();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 420, background: 'var(--card)',
        borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
      }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>New conversation</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--muted)' }}>✕</button>
        </div>

        {/* DM / Group toggle */}
        <div style={{ display: 'flex', padding: '12px 14px 0', gap: 6 }}>
          {(['dm', 'group'] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setSelected([]); }} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none',
              background: mode === m ? 'var(--trust)' : 'var(--paper)',
              color: mode === m ? '#fff' : 'var(--muted)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {m === 'dm' ? '💬 Direct message' : '👥 Group chat'}
            </button>
          ))}
        </div>

        <div style={{ padding: '12px 14px' }}>
          {mode === 'group' && (
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (optional)"
              style={{ ...inputStyle, marginBottom: 8 }}
              onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          )}

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            autoFocus
            style={inputStyle}
            onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />

          {/* Selected chips */}
          {selected.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {selected.map((s) => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'var(--tlight)', borderRadius: 20, padding: '3px 10px 3px 6px',
                  fontSize: 12, fontWeight: 600, color: 'var(--trust)',
                }}>
                  <Avatar name={s.name} avatarUrl={s.avatarUrl} size={18} />
                  {s.name}
                  <button onClick={() => setSelected((p) => p.filter((x) => x.id !== s.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--trust)', fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Search results */}
          <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 8 }}>
            {results.map((p) => {
              const name = p.full_name || p.username || 'Someone';
              const isSelected = selected.some((s) => s.id === p.id);
              return (
                <button key={p.id} onClick={() => togglePerson(p)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 6px', width: '100%', border: 'none',
                  background: isSelected ? 'var(--tlight)' : 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', borderRadius: 8,
                }}>
                  <Avatar name={name} avatarUrl={p.avatar_url} size={32} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{name}</div>
                    {p.username && <div style={{ fontSize: 11, color: 'var(--muted)' }}>@{p.username}</div>}
                  </div>
                  {isSelected && <span style={{ marginLeft: 'auto', color: 'var(--trust)', fontSize: 16 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: '12px 14px 16px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleCreate}
            disabled={(mode === 'dm' && selected.length !== 1) || (mode === 'group' && selected.length < 1) || createGroup.isPending}
            style={{
              width: '100%', background: 'var(--trust)', color: '#fff', border: 'none',
              borderRadius: 12, padding: '12px 0', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              opacity: ((mode === 'dm' && selected.length !== 1) || (mode === 'group' && selected.length < 1)) ? 0.4 : 1,
            }}
          >
            {createGroup.isPending ? 'Creating…' : mode === 'dm' ? 'Start conversation' : `Create group (${selected.length + 1} people)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyPane({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12,
    }}>
      <div style={{ fontSize: 52 }}>💬</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>Your messages</div>
      <div style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center', maxWidth: 240, lineHeight: 1.6 }}>
        Send private photos and messages to a friend or group.
      </div>
      <button onClick={onNew} style={{
        background: 'var(--trust)', color: '#fff', border: 'none',
        borderRadius: 12, padding: '10px 22px', fontSize: 14, fontWeight: 700,
        cursor: 'pointer', fontFamily: 'inherit', marginTop: 8,
      }}>
        New message
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ActiveConvo =
  | { kind: 'dm'; thread: DmThread }
  | { kind: 'group'; thread: GroupThread };

export default function MessagesPage() {
  const { user } = useSession();
  const { data: profile } = useCurrentProfile();
  const { data: dmThreads = [], isLoading: dmLoading } = useDmThreads(user?.id);
  const { data: groupThreads = [], isLoading: groupLoading } = useGroupThreads(user?.id);

  const [active, setActive] = useState<ActiveConvo | null>(null);
  const [showNew, setShowNew] = useState(false);

  const isLoading = dmLoading || groupLoading;
  const hasAny = dmThreads.length > 0 || groupThreads.length > 0;

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Sign in to view your messages.</p>
      </div>
    );
  }

  const userName = profile?.full_name || profile?.username || user.email || 'You';
  const userAvatar = profile?.avatar_url ?? null;

  return (
    <div style={{
      display: 'flex', height: 'calc(100dvh - 32px)',
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 16, overflow: 'hidden', width: '100%',
    }}>
      {/* ── Thread list panel ── */}
      <div style={{
        width: 280, flexShrink: 0, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 14px 10px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', letterSpacing: -0.3 }}>Messages</span>
          <button onClick={() => setShowNew(true)} style={{
            background: 'var(--tlight)', border: 'none', borderRadius: 8,
            width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 18, color: 'var(--trust)',
          }} title="New conversation">
            ✏️
          </button>
        </div>

        {/* Thread list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
          {isLoading && (
            <div style={{ padding: 20 }}>
              {[1,2,3].map((i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 13, width: '60%', background: 'var(--border)', borderRadius: 6, marginBottom: 6 }} />
                    <div style={{ height: 11, width: '80%', background: 'var(--border)', borderRadius: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && !hasAny && (
            <div style={{ textAlign: 'center', padding: '30px 14px', color: 'var(--muted)', fontSize: 13 }}>
              No conversations yet
            </div>
          )}

          {/* DMs */}
          {dmThreads.map((t) => (
            <DmThreadRow
              key={t.friendId}
              thread={t}
              active={active?.kind === 'dm' && active.thread.friendId === t.friendId}
              onClick={() => setActive({ kind: 'dm', thread: t })}
            />
          ))}

          {/* Groups */}
          {groupThreads.length > 0 && (
            <>
              {dmThreads.length > 0 && (
                <div style={{ padding: '10px 10px 4px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  Groups
                </div>
              )}
              {groupThreads.map((t) => (
                <GroupThreadRow
                  key={t.id}
                  thread={t}
                  active={active?.kind === 'group' && active.thread.id === t.id}
                  onClick={() => setActive({ kind: 'group', thread: t })}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Conversation pane ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!active && <EmptyPane onNew={() => setShowNew(true)} />}

        {active?.kind === 'dm' && (
          <DmConversation key={active.thread.friendId} userId={user.id} thread={active.thread} />
        )}

        {active?.kind === 'group' && (
          <GroupConversation
            key={active.thread.id}
            userId={user.id}
            userName={userName}
            userAvatar={userAvatar}
            thread={active.thread}
          />
        )}
      </div>

      {/* ── New conversation modal ── */}
      {showNew && (
        <NewConversationModal
          userId={user.id}
          onClose={() => setShowNew(false)}
          onDmStarted={(thread) => { setActive({ kind: 'dm', thread }); setShowNew(false); }}
          onGroupCreated={(groupId) => {
            // Refresh and open new group
            setShowNew(false);
          }}
        />
      )}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  flex: 1, width: '100%', padding: '10px 14px',
  border: '1px solid var(--border)', borderRadius: 22,
  fontSize: 14, background: 'var(--paper)', color: 'var(--ink)',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

const sendBtnStyle: React.CSSProperties = {
  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
  background: 'var(--trust)', color: '#fff', border: 'none',
  fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
