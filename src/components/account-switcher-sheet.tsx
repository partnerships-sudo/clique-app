import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

export function AccountSwitcherSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const insets = useSafeAreaInsets();
  const { savedAccounts, switchAccount, signOut, user } = useSession();

  async function handleSwitch(userId: string) {
    if (userId === user?.id) {
      onClose();
      return;
    }
    onClose();
    try {
      await switchAccount(userId);
    } catch {
      // If the refresh token is expired the user will land on auth screen anyway
    }
  }

  function handleAddAccount() {
    onClose();
    // Navigate to login without signing out — the current session stays in saved list
    router.push('/(auth)');
  }

  function handleFullSignOut() {
    onClose();
    setTimeout(() => signOut({ forgetDevice: true }), 300);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Switch account</Text>

        {savedAccounts.map((account) => {
          const isCurrent = account.userId === user?.id;
          return (
            <Pressable
              key={account.userId}
              style={[styles.row, isCurrent && styles.rowActive]}
              onPress={() => handleSwitch(account.userId)}>
              <Avatar
                name={account.fullName || account.email}
                size={44}
                avatarUrl={account.avatarUrl ?? undefined}
              />
              <View style={styles.rowMeta}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {account.fullName || account.email}
                </Text>
                {account.username ? (
                  <Text style={styles.rowHandle} numberOfLines={1}>@{account.username}</Text>
                ) : (
                  <Text style={styles.rowHandle} numberOfLines={1}>{account.email}</Text>
                )}
              </View>
              {isCurrent && (
                <SymbolView name="checkmark.circle.fill" size={20} tintColor={Brand.trust} type="monochrome" />
              )}
            </Pressable>
          );
        })}

        <Pressable style={styles.addRow} onPress={handleAddAccount}>
          <View style={styles.addIcon}>
            <SymbolView name="plus" size={18} tintColor={Brand.trust} type="monochrome" />
          </View>
          <Text style={styles.addLabel}>Add another account</Text>
        </Pressable>

        <Pressable style={styles.signOutRow} onPress={handleFullSignOut}>
          <Text style={styles.signOutText}>Sign out of this account</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
      backgroundColor: Brand.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 12,
      paddingHorizontal: 20,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: Brand.border,
      alignSelf: 'center',
      marginBottom: 16,
    },
    title: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 16,
      color: Brand.ink,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 14,
      marginBottom: 4,
    },
    rowActive: {
      backgroundColor: Brand.tlight,
    },
    rowMeta: {
      flex: 1,
    },
    rowName: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 14,
      color: Brand.ink,
    },
    rowHandle: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
      marginTop: 1,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      marginTop: 4,
      borderTopWidth: 1,
      borderTopColor: Brand.border,
    },
    addIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: Brand.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 14,
      color: Brand.trust,
    },
    signOutRow: {
      alignItems: 'center',
      paddingVertical: 14,
    },
    signOutText: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 13,
      color: '#E84F4F',
    },
  });
}
