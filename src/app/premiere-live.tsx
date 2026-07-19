import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBrand } from '@/hooks/use-brand';
import { BrandFonts } from '@/constants/theme';
import { usePremiere } from '@/features/premieres/api';

export default function PremiereLive() {
  const Brand = useBrand();
  const params = useLocalSearchParams<{ id: string }>();
  const { data: premiere } = usePremiere(params.id ?? null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0D1A' }} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>● LIVE</Text>
        </View>
        <Text style={styles.title} numberOfLines={1}>{premiere?.show_title}</Text>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={{ fontFamily: BrandFonts.syneBold, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Leave</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: BrandFonts.syneExtraBold, fontSize: 22, color: '#fff', marginBottom: 8 }}>
          Live chat coming next 🎬
        </Text>
        <Text style={{ fontFamily: BrandFonts.interRegular, fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingHorizontal: 40 }}>
          The live chat and replay will be built in the next step.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  liveBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  liveBadgeText: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 10,
    color: '#fff',
    letterSpacing: 0.5,
  },
  title: {
    flex: 1,
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    marginHorizontal: 12,
  },
});
