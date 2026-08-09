import { useEffect, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { BrandFonts } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

const ITEM_H = 20;
const VISIBLE = 3;
const DRUM_PAD = 1 * ITEM_H;

export { ITEM_H };

export function DrumPicker({
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
  const Brand = useBrand();
  const internalRef = useRef<ScrollView>(null);
  const ref = externalRef ?? internalRef;

  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onMomentumScrollEnd(e: { nativeEvent: { contentOffset: { y: number } } }) {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    onSelect(Math.max(0, Math.min(idx, items.length - 1)));
  }

  return (
    <View style={{ flex: 1, height: VISIBLE * ITEM_H }}>
      {/* Centre highlight bar */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: DRUM_PAD,
          left: 3,
          right: 3,
          height: ITEM_H,
          backgroundColor: Brand.tlight,
          borderRadius: 10,
          borderWidth: 1.5,
          borderColor: Brand.trust + '55',
        }}
      />

      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentContainerStyle={{ paddingVertical: DRUM_PAD }}
      >
        {items.map((label, i) => {
          const selected = i === selectedIndex;
          return (
            <View key={label + i} style={{ height: ITEM_H, justifyContent: 'center', alignItems: 'center' }}>
              <Text
                style={{
                  fontFamily: selected ? BrandFonts.syneBold : BrandFonts.interRegular,
                  fontSize: selected ? 13 : 11,
                  color: selected ? Brand.ink : Brand.muted,
                }}>
                {label}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Top fade */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: DRUM_PAD, backgroundColor: Brand.card, opacity: 0.82 }}
      />
      {/* Bottom fade */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: DRUM_PAD, backgroundColor: Brand.card, opacity: 0.82 }}
      />
    </View>
  );
}

// ─── iOS-style wheel column ───────────────────────────────────────────────────
// Uses an invisible ScrollView for gesture capture (proven to work in this app),
// overlaid with a visual display showing selected value large + next value below.

const WHEEL_SNAP = 44;

export function WheelColumn({
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
  const Brand = useBrand();
  const internalRef = useRef<ScrollView>(null);
  const ref = externalRef ?? internalRef;

  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: selectedIndex * WHEEL_SNAP, animated: false });
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to correct position when selectedIndex changes externally
  useEffect(() => {
    ref.current?.scrollTo({ y: selectedIndex * WHEEL_SNAP, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  function onScrollEnd(e: { nativeEvent: { contentOffset: { y: number } } }) {
    const idx = Math.round(e.nativeEvent.contentOffset.y / WHEEL_SNAP);
    onSelect(Math.max(0, Math.min(idx, items.length - 1)));
  }

  const nextIdx = (selectedIndex + 1) % items.length;
  const COLUMN_H = 80;

  return (
    <View style={{ flex: 1, height: COLUMN_H }}>
      {/* Transparent ScrollView underneath — captures gestures, no opacity tricks */}
      <ScrollView
        ref={ref}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' }}
        snapToInterval={WHEEL_SNAP}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: WHEEL_SNAP }}
      >
        {items.map((_, i) => (
          <View key={i} style={{ height: WHEEL_SNAP, backgroundColor: 'transparent' }} />
        ))}
      </ScrollView>

      {/* Visual display on top — pointer events none so touches fall through to ScrollView */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 5 }}>
        <Text style={{ fontFamily: BrandFonts.syneBold, fontSize: 22, color: Brand.ink, lineHeight: 26 }}>
          {items[selectedIndex]}
        </Text>
        <Text style={{ fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted }}>
          {items[nextIdx]}
        </Text>
      </View>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function daysInMonth(monthIdx: number, year: number): number {
  return new Date(year, monthIdx + 1, 0).getDate();
}

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
