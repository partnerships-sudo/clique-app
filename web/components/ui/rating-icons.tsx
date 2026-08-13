'use client';

/**
 * Web port of src/components/rating-icons.tsx
 * Renders 5 rating icons (stars, hotdogs, popcorn, sodas) with full/half/empty states.
 */

export type RatingIconStyle = 'stars' | 'hotdogs' | 'popcorn' | 'sodas';

export const RATING_ICON_OPTIONS: { value: RatingIconStyle; emoji: string; label: string }[] = [
  { value: 'stars',   emoji: '⭐', label: 'Stars'    },
  { value: 'hotdogs', emoji: '🌭', label: 'Hotdogs'  },
  { value: 'popcorn', emoji: '🍿', label: 'Popcorn'  },
  { value: 'sodas',   emoji: '🥤', label: 'Sodas'    },
];

const ICON_BY_STYLE: Record<RatingIconStyle, string> = {
  stars:   '★',
  hotdogs: '🌭',
  popcorn: '🍿',
  sodas:   '🥤',
};

const ACCENT = '#F4A340';
const EMPTY_COLOR = '#D0D0D0';

function starState(n: number, rating: number): 'full' | 'half' | 'empty' {
  if (n <= Math.floor(rating)) return 'full';
  if (n === Math.ceil(rating) && rating % 1 !== 0) return 'half';
  return 'empty';
}

// ── Display (read-only) ───────────────────────────────────────────────────────

export function RatingIcons({
  rating,
  iconStyle,
  size = 13,
  color = ACCENT,
}: {
  rating: number;
  iconStyle: RatingIconStyle | null | undefined;
  size?: number;
  color?: string;
}) {
  const style = iconStyle ?? 'stars';

  if (style === 'stars') {
    return (
      <span style={{ display: 'inline-flex', gap: 1 }}>
        {[1,2,3,4,5].map((n) => {
          const state = starState(n, rating);
          if (state === 'full') {
            return <span key={n} style={{ fontSize: size, color, lineHeight: 1 }}>★</span>;
          }
          if (state === 'half') {
            return (
              <span key={n} style={{ position: 'relative', display: 'inline-block', width: size * 0.6, overflow: 'hidden', fontSize: size, lineHeight: 1 }}>
                <span style={{ color: EMPTY_COLOR, position: 'absolute' }}>★</span>
                <span style={{ color, position: 'absolute', width: '50%', overflow: 'hidden', display: 'inline-block' }}>★</span>
              </span>
            );
          }
          return <span key={n} style={{ fontSize: size, color: EMPTY_COLOR, lineHeight: 1 }}>★</span>;
        })}
      </span>
    );
  }

  const icon = ICON_BY_STYLE[style];
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1,2,3,4,5].map((n) => {
        const state = starState(n, rating);
        if (state === 'half') {
          return (
            <span key={n} style={{ position: 'relative', display: 'inline-block', fontSize: size, lineHeight: 1 }}>
              <span style={{ opacity: 0.25 }}>{icon}</span>
              <span style={{
                position: 'absolute', left: 0, top: 0,
                width: '50%', overflow: 'hidden', display: 'inline-block',
              }}>{icon}</span>
            </span>
          );
        }
        return (
          <span key={n} style={{ fontSize: size, opacity: state === 'full' ? 1 : 0.25, lineHeight: 1 }}>
            {icon}
          </span>
        );
      })}
    </span>
  );
}

// ── Interactive picker ────────────────────────────────────────────────────────

export function RatingPicker({
  value,
  iconStyle,
  onChange,
  size = 32,
}: {
  value: number;
  iconStyle: RatingIconStyle | null | undefined;
  onChange: (v: number) => void;
  size?: number;
}) {
  const style = iconStyle ?? 'stars';
  const icon = ICON_BY_STYLE[style];
  const slotPx = size + 16;

  function handlePress(n: number) {
    if (value === n) onChange(n - 0.5);
    else if (value === n - 0.5) onChange(0);
    else onChange(n);
  }

  return (
    <span style={{ display: 'inline-flex' }}>
      {[1,2,3,4,5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => handlePress(n)}
          style={{
            width: slotPx, height: slotPx,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          {style === 'stars' ? (
            (() => {
              const state = starState(n, value);
              if (state === 'full') return <span style={{ fontSize: size, color: ACCENT, lineHeight: 1 }}>★</span>;
              if (state === 'half') return (
                <span style={{ position: 'relative', display: 'inline-block', width: size * 0.6, overflow: 'hidden', fontSize: size, lineHeight: 1 }}>
                  <span style={{ color: EMPTY_COLOR, position: 'absolute' }}>★</span>
                  <span style={{ color: ACCENT, position: 'absolute', width: '50%', overflow: 'hidden', display: 'inline-block' }}>★</span>
                </span>
              );
              return <span style={{ fontSize: size, color: EMPTY_COLOR, lineHeight: 1 }}>★</span>;
            })()
          ) : (
            <span style={{ fontSize: size, opacity: n <= value ? 1 : 0.28, lineHeight: 1 }}>
              {icon}
            </span>
          )}
        </button>
      ))}
    </span>
  );
}
