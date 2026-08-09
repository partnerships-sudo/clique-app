import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'clique:saved_accounts';

export type SavedAccount = {
  userId: string;
  email: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string;
};

export async function getSavedAccounts(): Promise<SavedAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Add or update an account in the saved list. */
export async function upsertSavedAccount(account: SavedAccount): Promise<void> {
  const accounts = await getSavedAccounts();
  const idx = accounts.findIndex((a) => a.userId === account.userId);
  if (idx >= 0) accounts[idx] = account;
  else accounts.push(account);
  await AsyncStorage.setItem(KEY, JSON.stringify(accounts));
}

/** Refresh just the tokens for an existing saved account (called on auth state change). */
export async function refreshSavedAccountTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const accounts = await getSavedAccounts();
  const idx = accounts.findIndex((a) => a.userId === userId);
  if (idx >= 0) {
    accounts[idx] = { ...accounts[idx], accessToken, refreshToken };
    await AsyncStorage.setItem(KEY, JSON.stringify(accounts));
  }
}

/** Remove a specific account from the saved list (full sign out). */
export async function removeSavedAccount(userId: string): Promise<void> {
  const accounts = await getSavedAccounts();
  await AsyncStorage.setItem(
    KEY,
    JSON.stringify(accounts.filter((a) => a.userId !== userId)),
  );
}
