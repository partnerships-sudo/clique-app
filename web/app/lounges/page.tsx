'use client';

import { useSession } from '@web/providers/session-provider';
import { useFollowedRooms } from '@web/lib/news';

export default function LoungesPage() {
  const { user } = useSession();
  const { data: rooms = [], isLoading } = useFollowedRooms(user?.id);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: '0 0 4px', letterSpacing: -0.4 }}>Your Lounges</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 22px', lineHeight: 1.5 }}>
        Discussions rooms you follow, all in one place.
      </p>

      {!user && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 14 }}>
          Sign in to see your followed lounges.
        </div>
      )}

      {user && isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3,4].map((i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
            }}>
              <div style={{ width: 54, height: 80, borderRadius: 8, background: 'var(--border)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 14, width: '60%', background: 'var(--border)', borderRadius: 5, marginBottom: 8 }} />
                <div style={{ height: 11, width: '30%', background: 'var(--border)', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {user && !isLoading && rooms.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>🎭</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>No lounges yet</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 280, margin: '0 auto', lineHeight: 1.6 }}>
            You haven't joined any lounges yet. Search for a show or film and follow its room.
          </div>
        </div>
      )}

      {user && !isLoading && rooms.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rooms.map((room) => (
            <div key={`${room.externalId}|${room.mediaType}`} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px',
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 14, cursor: 'default',
            }}>
              {/* Poster */}
              <div style={{
                width: 54, height: 80, borderRadius: 8, overflow: 'hidden',
                background: 'var(--tlight)', flexShrink: 0,
                border: '1px solid var(--border)',
              }}>
                {room.contentPoster
                  ? <img src={room.contentPoster} alt={room.contentTitle} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                      {room.mediaType === 'tv' ? '📺' : '🎬'}
                    </div>}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {room.contentTitle}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px',
                    borderRadius: 20, background: 'var(--tlight)', color: 'var(--trust)',
                  }}>
                    {room.mediaType === 'tv' ? 'TV Series' : room.mediaType === 'movie' ? 'Film' : room.mediaType}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {room.followerCount} {room.followerCount === 1 ? 'follower' : 'followers'}
                  </span>
                </div>
              </div>

              <span style={{ fontSize: 18, color: 'var(--muted)' }}>›</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
