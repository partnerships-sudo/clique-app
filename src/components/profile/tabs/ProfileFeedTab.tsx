import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View, Vibration } from 'react-native';

import { LibCard } from '@/components/library/lib-card';
import { type EntryType } from '@/constants/theme';
import { useRemoveLibraryItem, type LibraryItem } from '@/features/library/api';
import { useBrand } from '@/hooks/use-brand';
import { CAT_FILTERS, createStyles } from '../profile-styles';

interface Props {
  logged: LibraryItem[];
}

export function ProfileFeedTab({ logged }: Props) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [catFilter, setCatFilter] = useState<EntryType | 'all'>('all');
  const [feedSort, setFeedSort] = useState<'recent' | 'alpha'>('recent');
  const removeLibraryItem = useRemoveLibraryItem();

  const feedItems = useMemo(() => {
    const items = catFilter === 'all' ? logged : logged.filter((i) => i.type === catFilter);
    const sorted = [...items];
    if (feedSort === 'alpha') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted;
  }, [logged, catFilter, feedSort]);

  return (
    <View style={styles.tabContent}>
      <View style={[styles.chipScroll, styles.chipRow, styles.chipRowCentered]}>
        {CAT_FILTERS.map((f) => {
          const isActive = catFilter === f.type;
          return (
            <Pressable
              key={f.type}
              style={[styles.chip, isActive && { backgroundColor: f.color }]}
              onPress={() => setCatFilter(f.type)}>
              <SymbolView name={f.sf as any} size={22} tintColor={isActive ? '#fff' : Brand.muted} style={styles.chipIcon} />
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.feedSortRow}>
        <Text style={styles.feedSortLabel}>Sort by</Text>
        {([{ value: 'recent', label: 'Recent' }, { value: 'alpha', label: 'A—Z' }] as const).map((opt) => {
          const isActive = feedSort === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[styles.feedSortBtn, isActive && styles.feedSortBtnActive]}
              onPress={() => setFeedSort(opt.value)}>
              <Text style={[styles.feedSortBtnText, isActive && styles.feedSortBtnTextActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {feedItems.length === 0 ? (
        <Text style={styles.emptyText}>Nothing logged yet.</Text>
      ) : (
        feedItems.map((item) => (
          <Pressable
            key={item.id}
            style={{ marginBottom: 5 }}
            onLongPress={() => {
              Vibration.vibrate(40);
              Alert.alert('Remove from feed?', item.title, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => removeLibraryItem.mutate(item.id) },
              ]);
            }}
            delayLongPress={500}>
            <LibCard item={item} />
          </Pressable>
        ))
      )}
    </View>
  );
}
