import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandFonts, type BrandPalette, type TypeColorPalette } from '@/constants/theme';
import { type ShakeReco, useShakeReco } from '@/features/recommendations/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';
import { useShake } from '@/hooks/use-shake';

const ShakespearContext = createContext<{ trigger: () => void }>({ trigger: () => {} });
export function useShakespear() { return useContext(ShakespearContext); }

function RatingDots({ rating, color }: { rating: number | null; color: string }) {
  if (!rating) return null;
  const filled = Math.round(rating);
  return (
    <View style={styles.ratingRow}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View
          key={i}
          style={[styles.ratingDot, { backgroundColor: i < filled ? color : 'rgba(150,150,150,0.3)' }]}
        />
      ))}
    </View>
  );
}

function ShakespearCard({
  reco,
  Brand,
  TypeColors,
}: {
  reco: ShakeReco;
  Brand: BrandPalette;
  TypeColors: TypeColorPalette;
}) {
  const typeInfo = TypeColors[reco.type] ?? TypeColors.watch;
  return (
    <View style={[styles.card, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
      {reco.poster ? (
        <Image source={{ uri: reco.poster }} style={styles.poster} resizeMode="cover" />
      ) : (
        <View style={[styles.poster, styles.posterPlaceholder, { backgroundColor: typeInfo.bg }]}>
          <Text style={styles.posterEmoji}>{typeInfo.icon}</Text>
        </View>
      )}
      <View style={styles.meta}>
        <View style={[styles.typeBadge, { backgroundColor: typeInfo.bg }]}>
          <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>
            {typeInfo.icon} {typeInfo.label}
          </Text>
        </View>
        <Text style={[styles.itemTitle, { color: Brand.ink }]} numberOfLines={2}>
          {reco.title}
        </Text>
        {reco.sub ? (
          <Text style={[styles.itemSub, { color: Brand.muted }]} numberOfLines={1}>
            {reco.sub}
          </Text>
        ) : null}
        {reco.avg_rating ? (
          <>
            <RatingDots rating={reco.avg_rating} color={typeInfo.color} />
            <Text style={[styles.ratingLabel, { color: Brand.muted }]}>
              avg {reco.avg_rating}/5 from your Clique
            </Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

export function ShakespearProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [reco, setReco] = useState<ShakeReco | null>(null);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const insets = useSafeAreaInsets();
  const { fetch: fetchReco } = useShakeReco();

  const animateIn = useCallback(() => {
    scaleAnim.setValue(0.88);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 260 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const trigger = useCallback(async () => {
    setReco(null);
    setEmpty(false);
    setLoading(true);
    setVisible(true);
    animateIn();
    try {
      const result = await fetchReco();
      if (result) {
        setReco(result);
      } else {
        setEmpty(true);
      }
    } catch {
      setEmpty(true);
    } finally {
      setLoading(false);
    }
  }, [fetchReco, animateIn]);

  const shakeAgain = useCallback(async () => {
    setLoading(true);
    setEmpty(false);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 300 }),
    ]).start();
    try {
      const result = await fetchReco();
      if (result) {
        setReco(result);
      } else {
        setEmpty(true);
      }
    } catch {
      setEmpty(true);
    } finally {
      setLoading(false);
    }
  }, [fetchReco, scaleAnim]);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 150, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  }, [scaleAnim, opacityAnim]);

  useShake(trigger);

  const styles2 = useMemo(() => createStyles(Brand), [Brand]);
  const ctx = useMemo(() => ({ trigger }), [trigger]);

  return (
    <ShakespearContext.Provider value={ctx}>
      {children}
      <Modal transparent visible={visible} animationType="none" onRequestClose={dismiss}>
        <Pressable style={styles2.backdrop} onPress={dismiss}>
          <Animated.View
            style={[styles2.sheet, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
            <Pressable onPress={() => {}}>
              <Text style={[styles2.headline, { color: Brand.trust }]}>Okay Shake-speare,</Text>
              <Text style={[styles2.subheadline, { color: Brand.ink }]}>
                here's your random reco:
              </Text>

              {loading ? (
                <View style={styles2.loadingState}>
                  <ActivityIndicator color={Brand.trust} size="large" />
                  <Text style={[styles2.loadingText, { color: Brand.muted }]}>
                    Shaking up something good...
                  </Text>
                </View>
              ) : empty ? (
                <View style={styles2.emptyState}>
                  <Text style={styles2.emptyEmoji}>🎭</Text>
                  <Text style={[styles2.emptyText, { color: Brand.muted }]}>
                    Not enough data yet. Rate more things and your Clique will have better picks for you.
                  </Text>
                </View>
              ) : reco ? (
                <ShakespearCard reco={reco} Brand={Brand} TypeColors={TypeColors} />
              ) : null}

              <View style={styles2.buttonRow}>
                <Pressable
                  style={[styles2.btn, styles2.btnSecondary, { borderColor: Brand.border, backgroundColor: Brand.paper }]}
                  onPress={shakeAgain}
                  disabled={loading}>
                  <Text style={[styles2.btnSecondaryText, { color: loading ? Brand.muted : Brand.ink }]}>
                    🎲 Shake again
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles2.btn, styles2.btnPrimary, { backgroundColor: Brand.trust }]}
                  onPress={dismiss}>
                  <Text style={styles2.btnPrimaryText}>Got it</Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </ShakespearContext.Provider>
  );
}

const styles = StyleSheet.create({
  ratingRow: { flexDirection: 'row', gap: 5, marginTop: 8 },
  ratingDot: { width: 8, height: 8, borderRadius: 4 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 20,
    flexDirection: 'row',
  },
  poster: { width: 100, height: 148 },
  posterPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  posterEmoji: { fontSize: 36 },
  meta: { flex: 1, padding: 14, justifyContent: 'center', gap: 2 },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  typeBadgeText: { fontFamily: BrandFonts.syneBold, fontSize: 11 },
  itemTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16, lineHeight: 21 },
  itemSub: { fontFamily: BrandFonts.interRegular, fontSize: 12, marginTop: 2 },
  ratingLabel: { fontFamily: BrandFonts.interRegular, fontSize: 11, marginTop: 4 },
});

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    sheet: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: Brand.card,
      borderRadius: 28,
      padding: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 12,
    },
    headline: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 22,
      letterSpacing: -0.5,
      marginBottom: 2,
    },
    subheadline: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 15,
      opacity: 0.7,
    },
    loadingState: { alignItems: 'center', paddingVertical: 32, gap: 14 },
    loadingText: { fontFamily: BrandFonts.interRegular, fontSize: 14 },
    emptyState: { alignItems: 'center', paddingVertical: 24, gap: 10 },
    emptyEmoji: { fontSize: 38 },
    emptyText: { fontFamily: BrandFonts.interRegular, fontSize: 13.5, textAlign: 'center', lineHeight: 20 },
    buttonRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
    btn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
    btnSecondary: { borderWidth: 1 },
    btnSecondaryText: { fontFamily: BrandFonts.syneBold, fontSize: 14 },
    btnPrimary: {},
    btnPrimaryText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' },
  });
}
