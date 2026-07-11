import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import type { FeedFilterValue } from '@/features/feed/api';
import { useBrand } from '@/hooks/use-brand';

const FILTERS: { value: FeedFilterValue; label: string; symbol: string }[] = [
  { value: 'all', label: 'All', symbol: 'square.grid.2x2' },
  { value: 'watch', label: 'TV & Film', symbol: 'movieclapper' },
  { value: 'read', label: 'Books', symbol: 'book.closed' },
  { value: 'play', label: 'Games', symbol: 'gamecontroller' },
  { value: 'podcast', label: 'Podcasts', symbol: 'mic' },
  { value: 'listen', label: 'Music', symbol: 'headphones' },
];

export function FilterChips({
  value,
  onChange,
  hiddenTypes,
  onHide,
  onShow,
}: {
  value: FeedFilterValue;
  onChange: (value: FeedFilterValue) => void;
  /** When provided (with onHide/onShow), enables long-press-to-remove + the "+" restore chip. */
  hiddenTypes?: Set<EntryType>;
  onHide?: (type: EntryType) => void;
  onShow?: (type: EntryType) => void;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [restoreSheetVisible, setRestoreSheetVisible] = useState(false);
  const customizable = !!hiddenTypes && !!onHide && !!onShow;

  const visibleFilters = customizable
    ? FILTERS.filter((f) => f.value === 'all' || !hiddenTypes!.has(f.value as EntryType))
    : FILTERS;
  const hiddenFilters = customizable ? FILTERS.filter((f) => hiddenTypes!.has(f.value as EntryType)) : [];

  function handleLongPress(filter: (typeof FILTERS)[number]) {
    if (!customizable || filter.value === 'all') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(
      `Remove ${filter.label}?`,
      `${filter.label} posts won't show up in your feed anymore. Tap the + chip at the end anytime to bring it back.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            if (value === filter.value) onChange('all');
            onHide!(filter.value as EntryType);
          },
        },
      ],
    );
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.row}
        contentContainerStyle={styles.content}>
        {visibleFilters.map((filter) => {
          const active = filter.value === value;
          return (
            <Pressable
              key={filter.value}
              onPress={() => onChange(filter.value)}
              onLongPress={() => handleLongPress(filter)}
              delayLongPress={350}
              style={styles.item}>
              <View style={[styles.tile, active && styles.tileActive]}>
                <SymbolView
                  name={filter.symbol as any}
                  size={28}
                  tintColor={active ? '#fff' : Brand.muted}
                  type="monochrome"
                />
              </View>
              <Text style={[styles.label, active && styles.labelActive]}>{filter.label}</Text>
            </Pressable>
          );
        })}
        {customizable && hiddenFilters.length > 0 && (
          <Pressable onPress={() => setRestoreSheetVisible(true)} style={styles.item}>
            <View style={styles.tile}>
              <SymbolView name="plus" size={26} tintColor={Brand.muted} type="monochrome" />
            </View>
            <Text style={styles.label}>Add back</Text>
          </Pressable>
        )}
      </ScrollView>

      {customizable && (
        <RestoreSheet
          visible={restoreSheetVisible}
          onClose={() => setRestoreSheetVisible(false)}
          hiddenFilters={hiddenFilters}
          onShow={onShow!}
        />
      )}
    </>
  );
}

function RestoreSheet({
  visible,
  onClose,
  hiddenFilters,
  onShow,
}: {
  visible: boolean;
  onClose: () => void;
  hiddenFilters: typeof FILTERS;
  onShow: (type: EntryType) => void;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Removed from your feed</Text>
          <Text style={styles.sheetSubtitle}>Tap one to bring it back</Text>
          {hiddenFilters.map((filter) => (
            <Pressable
              key={filter.value}
              style={styles.restoreRow}
              onPress={() => {
                onShow(filter.value as EntryType);
                if (hiddenFilters.length === 1) onClose();
              }}>
              <View style={styles.restoreIconWrap}>
                <SymbolView name={filter.symbol as any} size={22} tintColor={Brand.trust} type="monochrome" />
              </View>
              <Text style={styles.restoreLabel}>{filter.label}</Text>
              <View style={styles.restoreAddBtn}>
                <SymbolView name="plus" size={14} tintColor="#fff" type="monochrome" />
              </View>
            </Pressable>
          ))}
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    row: { marginBottom: 14 },
    content: { gap: 10, paddingRight: 16 },
    item: { alignItems: 'center', gap: 7 },
    tile: {
      width: 61,
      height: 61,
      borderRadius: 16,
      backgroundColor: Brand.card,
      borderWidth: 1.5,
      borderColor: Brand.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
    tileActive: {
      backgroundColor: Brand.trust,
      borderColor: Brand.trust,
      shadowOpacity: 0.22,
      shadowRadius: 10,
    },
    label: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 11,
      color: Brand.muted,
    },
    labelActive: {
      fontFamily: BrandFonts.syneBold,
      color: Brand.trust,
    },

    // Restore sheet
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: Brand.paper,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 34,
    },
    grabber: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: Brand.border,
      alignSelf: 'center',
      marginBottom: 16,
    },
    sheetTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 18, color: Brand.ink, textAlign: 'center' },
    sheetSubtitle: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12.5,
      color: Brand.muted,
      textAlign: 'center',
      marginTop: 3,
      marginBottom: 18,
    },
    restoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: Brand.card,
      borderRadius: 16,
      padding: 12,
      marginBottom: 10,
    },
    restoreIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    restoreLabel: { flex: 1, fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.ink },
    restoreAddBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: Brand.trust,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtn: {
      marginTop: 6,
      paddingVertical: 13,
      borderRadius: 16,
      backgroundColor: Brand.card,
      alignItems: 'center',
    },
    cancelText: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.trust },
  });
}
