import { useEffect, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { BrandFonts } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

// ─── Shared constants ─────────────────────────────────────────────────────────

export const ITEM_H = 32;   // row height
const VISIBLE   = 3;        // rows visible at once (odd → selected is centred)
const PAD       = Math.floor(VISIBLE / 2) * ITEM_H; // top/bottom padding

// ─── Shared implementation ────────────────────────────────────────────────────

function PickerColumn({
  items,
  selectedIndex,
  onSelect,
  scrollRef: externalRef,
}: {
  items: string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  scrollRef?: React.RefObject<ScrollView | null>;
}) {
  const Brand       = useBrand();
  const internalRef = useRef<ScrollView>(null);
  const ref         = externalRef ?? internalRef;

  // Set initial scroll position without animation
  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow external index changes (e.g. day clamping when month changes)
  useEffect(() => {
    ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  function onScrollEnd(e: { nativeEvent: { contentOffset: { y: number } } }) {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    onSelect(Math.max(0, Math.min(idx, items.length - 1)));
  }

  const TOTAL_H = VISIBLE * ITEM_H;

  return (
    <View style={{ flex: 1, height: TOTAL_H, overflow: 'hidden' }}>

      {/* ── Selection highlight bar ── */}
      <View
        pointerEvents="none"
        style={{
          position:        'absolute',
          top:             PAD,
          left:            6,
          right:           6,
          height:          ITEM_H,
          backgroundColor: Brand.tlight,
          borderRadius:    12,
          borderWidth:     1.5,
          borderColor:     Brand.trust + '55',
        }}
      />

      {/* ── Scrollable item list ── */}
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}
        contentContainerStyle={{ paddingVertical: PAD }}
      >
        {items.map((label, i) => {
          const dist       = Math.abs(i - selectedIndex);
          const opacity    = dist === 0 ? 1 : dist === 1 ? 0.45 : 0.2;
          const fontFamily = dist === 0 ? BrandFonts.syneBold : BrandFonts.interRegular;
          const fontSize   = dist === 0 ? 17 : dist === 1 ? 14 : 12;
          return (
            <View key={label + i} style={{ height: ITEM_H, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontFamily, fontSize, color: Brand.ink, opacity }}>
                {label}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* ── Top fade ── */}
      <View
        pointerEvents="none"
        style={{
          position:        'absolute',
          top:             0,
          left:            0,
          right:           0,
          height:          PAD,
          backgroundColor: Brand.card,
          opacity:         0.78,
        }}
      />
      {/* ── Bottom fade ── */}
      <View
        pointerEvents="none"
        style={{
          position:        'absolute',
          bottom:          0,
          left:            0,
          right:           0,
          height:          PAD,
          backgroundColor: Brand.card,
          opacity:         0.78,
        }}
      />
    </View>
  );
}

// ─── Public exports ───────────────────────────────────────────────────────────

/** Single-column picker (standalone, used in signup & watch-parties). */
export function DrumPicker(props: {
  items: string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  scrollRef?: React.RefObject<ScrollView | null>;
}) {
  return <PickerColumn {...props} />;
}

/** Column picker designed to sit inside a flex-row multi-column layout. */
export function WheelColumn(props: {
  items: string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  scrollRef?: React.RefObject<ScrollView | null>;
}) {
  return <PickerColumn {...props} />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function daysInMonth(monthIdx: number, year: number): number {
  return new Date(year, monthIdx + 1, 0).getDate();
}

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
