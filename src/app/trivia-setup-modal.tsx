import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts } from '@/constants/theme';
import {
  usePremiereTriviaItems,
  useAddPremiereTriviaItem,
  useDeletePremiereTriviaItem,
  type TriviaItem,
  type TriviaOption,
} from '@/features/premieres/api';
import {
  useScreeningRoomTriviaItems,
  useAddScreeningRoomTriviaItem,
  useDeleteScreeningRoomTriviaItem,
  type ScreeningRoomTriviaItem,
} from '@/features/screening-rooms/api';

type Params = {
  id: string;
  type: 'premiere' | 'screening_room';
  showTitle?: string;
};

function formatMs(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseMmSs(mm: string, ss: string): number {
  const m = parseInt(mm, 10) || 0;
  const s = parseInt(ss, 10) || 0;
  return (m * 60 + s) * 1000;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

type ItemType = 'trivia' | 'poll' | 'message';

export default function TriviaSetupModal() {
  const params = useLocalSearchParams<Params>();
  const isPremiere = params.type !== 'screening_room';

  // ── Data hooks ──────────────────────────────────────────────────────────────
  const { data: premiereItems = [] } = usePremiereTriviaItems(isPremiere ? params.id : null);
  const { data: roomItems = [] } = useScreeningRoomTriviaItems(!isPremiere ? params.id : null);
  const items = (isPremiere ? premiereItems : roomItems) as (TriviaItem | ScreeningRoomTriviaItem)[];

  const addPremiere = useAddPremiereTriviaItem();
  const addRoom = useAddScreeningRoomTriviaItem();
  const deletePremiere = useDeletePremiereTriviaItem();
  const deleteRoom = useDeleteScreeningRoomTriviaItem();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [itemType, setItemType] = useState<ItemType>('trivia');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [correctIdx, setCorrectIdx] = useState<number | null>(null);
  const [timeMm, setTimeMm] = useState('');
  const [timeSs, setTimeSs] = useState('');

  function resetForm() {
    setItemType('trivia');
    setQuestion('');
    setOptions(['', '']);
    setCorrectIdx(null);
    setTimeMm('');
    setTimeSs('');
    setShowForm(false);
  }

  async function handleSave() {
    const trimmedQuestion = question.trim();
    const filledOptions = options.map((o) => o.trim()).filter(Boolean);

    if (!trimmedQuestion) return Alert.alert(itemType === 'message' ? 'Missing message' : 'Missing question', itemType === 'message' ? 'Please enter a message.' : 'Please enter a question.');
    if (itemType !== 'message' && filledOptions.length < 2) return Alert.alert('Not enough options', 'Add at least 2 answer options.');
    if (itemType === 'trivia' && correctIdx === null) return Alert.alert('No correct answer', 'Tap an option to mark it as correct.');
    const triggerMs = parseMmSs(timeMm, timeSs);
    if (triggerMs === 0) return Alert.alert('Missing timestamp', 'Enter a timestamp (mm:ss) for when this should appear.');

    const builtOptions: TriviaOption[] = itemType === 'message'
      ? []
      : filledOptions.map((label, i) => ({
          label,
          ...(itemType === 'trivia' ? { is_correct: i === correctIdx } : {}),
        }));

    if (isPremiere) {
      await addPremiere.mutateAsync({
        premiere_id: params.id,
        type: itemType,
        question: trimmedQuestion,
        options: builtOptions,
        trigger_ms: triggerMs,
      });
    } else {
      await addRoom.mutateAsync({
        screening_room_id: params.id,
        type: itemType,
        question: trimmedQuestion,
        options: builtOptions,
        trigger_ms: triggerMs,
      });
    }
    resetForm();
  }

  function handleDelete(id: string) {
    Alert.alert('Delete?', 'Remove this trivia/poll item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          if (isPremiere) deletePremiere.mutate({ id, premiereId: params.id });
          else deleteRoom.mutate({ id, roomId: params.id });
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={16}>
          <Text style={styles.backBtn}>✕</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Trivia & Polls</Text>
          {params.showTitle ? (
            <Text style={styles.headerSub} numberOfLines={1}>{params.showTitle}</Text>
          ) : null}
        </View>
        {!showForm && (
          <Pressable onPress={() => setShowForm(true)} style={styles.addBtn} hitSlop={8}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </Pressable>
        )}
        {showForm && <View style={{ width: 52 }} />}
      </View>

      {showForm ? (
        /* ── Add Form ────────────────────────────────────────────────── */
        <ScrollView style={styles.form} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Type toggle */}
          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.typeToggle}>
            {(['trivia', 'poll', 'message'] as ItemType[]).map((t) => (
              <Pressable
                key={t}
                style={[styles.typeBtn, itemType === t && styles.typeBtnActive]}
                onPress={() => { setItemType(t); setCorrectIdx(null); }}
              >
                <Text style={[styles.typeBtnText, itemType === t && styles.typeBtnTextActive]}>
                  {t === 'trivia' ? '🧠 Trivia' : t === 'poll' ? '📊 Poll' : '💬 Message'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Question / Message */}
          <Text style={styles.fieldLabel}>{itemType === 'message' ? 'Message' : 'Question'}</Text>
          <TextInput
            style={styles.questionInput}
            placeholder={itemType === 'message' ? 'e.g. Fun fact: it took 4 attempts to get this scene right' : 'e.g. What year did this film release?'}
            placeholderTextColor="#9CA3AF"
            value={question}
            onChangeText={setQuestion}
            multiline
            maxLength={280}
          />

          {/* Options — hidden for message type */}
          {itemType !== 'message' && <>
          <Text style={styles.fieldLabel}>
            Answer Options {itemType === 'trivia' ? '— tap to mark correct' : ''}
          </Text>
          {options.map((opt, i) => (
            <View key={i} style={styles.optionRow}>
              <Pressable
                style={[
                  styles.optionLetter,
                  itemType === 'trivia' && correctIdx === i && styles.optionLetterCorrect,
                ]}
                onPress={() => itemType === 'trivia' && setCorrectIdx(i)}
              >
                <Text style={[
                  styles.optionLetterText,
                  itemType === 'trivia' && correctIdx === i && styles.optionLetterTextCorrect,
                ]}>
                  {OPTION_LETTERS[i]}
                </Text>
              </Pressable>
              <TextInput
                style={styles.optionInput}
                placeholder={`Option ${OPTION_LETTERS[i]}`}
                placeholderTextColor="#9CA3AF"
                value={opt}
                onChangeText={(val) => {
                  const next = [...options];
                  next[i] = val;
                  setOptions(next);
                }}
                maxLength={80}
              />
              {options.length > 2 && (
                <Pressable
                  hitSlop={12}
                  onPress={() => {
                    const next = options.filter((_, j) => j !== i);
                    setOptions(next);
                    if (correctIdx === i) setCorrectIdx(null);
                    else if (correctIdx !== null && correctIdx > i) setCorrectIdx(correctIdx - 1);
                  }}
                >
                  <Text style={styles.removeOption}>✕</Text>
                </Pressable>
              )}
            </View>
          ))}
          {options.length < 4 && (
            <Pressable style={styles.addOptionBtn} onPress={() => setOptions([...options, ''])}>
              <Text style={styles.addOptionText}>+ Add option</Text>
            </Pressable>
          )}

          </>}

          {/* Timestamp */}
          <Text style={styles.fieldLabel}>Timestamp (from stream start)</Text>
          <View style={styles.timeRow}>
            <TextInput
              style={styles.timeInput}
              placeholder="00"
              placeholderTextColor="#9CA3AF"
              value={timeMm}
              onChangeText={(v) => setTimeMm(v.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.timeSep}>:</Text>
            <TextInput
              style={styles.timeInput}
              placeholder="00"
              placeholderTextColor="#9CA3AF"
              value={timeSs}
              onChangeText={(v) => setTimeSs(v.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.timeHint}>  mm : ss</Text>
          </View>

          {/* Actions */}
          <View style={styles.formActions}>
            <Pressable style={styles.cancelBtn} onPress={resetForm}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        /* ── Item List ───────────────────────────────────────────────── */
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>No questions yet</Text>
              <Text style={styles.emptySub}>
                Tap <Text style={{ fontFamily: BrandFonts.syneBold }}>+ Add</Text> to schedule trivia, polls, or messages. They fire automatically in the live chat at the timestamp you set.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View style={styles.itemCardLeft}>
                <View style={styles.itemBadgeRow}>
                  <View style={[styles.itemTypeBadge, item.type === 'trivia' ? styles.triviaBadge : item.type === 'poll' ? styles.pollBadge : styles.messageBadge]}>
                    <Text style={styles.itemTypeBadgeText}>{item.type === 'trivia' ? '🧠 Trivia' : item.type === 'poll' ? '📊 Poll' : '💬 Message'}</Text>
                  </View>
                  <Text style={styles.itemTimestamp}>⏱ {formatMs(item.trigger_ms)}</Text>
                  {item.fired_at && <Text style={styles.firedBadge}>✓ Fired</Text>}
                </View>
                <Text style={styles.itemQuestion}>{item.question}</Text>
                <View style={styles.itemOptions}>
                  {(item.options as TriviaOption[]).map((opt, i) => (
                    <Text key={i} style={[styles.itemOption, opt.is_correct && styles.itemOptionCorrect]}>
                      {OPTION_LETTERS[i]}) {opt.label}{opt.is_correct ? ' ✓' : ''}
                    </Text>
                  ))}
                </View>
              </View>
              <Pressable onPress={() => handleDelete(item.id)} hitSlop={12} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>🗑</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0A' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { fontFamily: BrandFonts.interRegular, fontSize: 18, color: 'rgba(255,255,255,0.5)', width: 36 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: '#fff' },
  headerSub: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  addBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: '#fff' },

  // ── List ──
  listContent: { padding: 16, gap: 12 },

  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontFamily: BrandFonts.syneBold, fontSize: 18, color: '#fff', marginBottom: 8 },
  emptySub: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 20 },

  itemCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    gap: 8,
  },
  itemCardLeft: { flex: 1 },
  itemBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  itemTypeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  triviaBadge: { backgroundColor: 'rgba(139,92,246,0.25)' },
  pollBadge: { backgroundColor: 'rgba(16,185,129,0.25)' },
  messageBadge: { backgroundColor: 'rgba(251,191,36,0.2)' },
  itemTypeBadgeText: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: '#fff' },
  itemTimestamp: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  firedBadge: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: '#10B981' },
  itemQuestion: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff', marginBottom: 6 },
  itemOptions: { gap: 2 },
  itemOption: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  itemOptionCorrect: { color: '#10B981' },
  deleteBtn: { paddingLeft: 4, justifyContent: 'flex-start' },
  deleteBtnText: { fontSize: 16 },

  // ── Form ──
  form: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  fieldLabel: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 20,
  },

  typeToggle: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  typeBtnActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  typeBtnText: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  typeBtnTextActive: { fontFamily: BrandFonts.syneBold, color: '#fff' },

  questionInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: BrandFonts.interRegular,
    fontSize: 15,
    color: '#fff',
    minHeight: 72,
    textAlignVertical: 'top',
  },

  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  optionLetter: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  optionLetterCorrect: { backgroundColor: '#10B981' },
  optionLetterText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  optionLetterTextCorrect: { color: '#fff' },
  optionInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: BrandFonts.interRegular,
    fontSize: 14,
    color: '#fff',
  },
  removeOption: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: 'rgba(255,255,255,0.35)' },
  addOptionBtn: { marginTop: 2, paddingVertical: 8 },
  addOptionText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: 'rgba(255,255,255,0.4)' },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeInput: {
    width: 56,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: BrandFonts.syneBold,
    fontSize: 20,
    color: '#fff',
    textAlign: 'center',
  },
  timeSep: { fontFamily: BrandFonts.syneBold, fontSize: 22, color: 'rgba(255,255,255,0.5)', paddingHorizontal: 2 },
  timeHint: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: 'rgba(255,255,255,0.3)', marginLeft: 8 },

  formActions: { flexDirection: 'row', gap: 12, marginTop: 32 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
  },
  cancelBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: 'rgba(255,255,255,0.5)' },
  saveBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  saveBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#0A0A0A' },
});
