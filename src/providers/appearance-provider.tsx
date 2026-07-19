import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

export type AppearancePref = 'system' | 'light' | 'dark';

const STORAGE_KEY = '@appearance_pref';

interface AppearanceContextValue {
  pref: AppearancePref;
  setPref: (pref: AppearancePref) => Promise<void>;
  scheme: 'light' | 'dark';
}

const AppearanceContext = createContext<AppearanceContextValue>({
  pref: 'system',
  setPref: async () => {},
  scheme: 'light',
});

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = (useSystemColorScheme() ?? 'light') as 'light' | 'dark';
  const [pref, setPrefState] = useState<AppearancePref>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'light' || val === 'dark' || val === 'system') {
        setPrefState(val);
      }
    });
  }, []);

  async function setPref(next: AppearancePref) {
    setPrefState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }

  const scheme: 'light' | 'dark' = pref === 'system' ? systemScheme : pref;

  return (
    <AppearanceContext.Provider value={{ pref, setPref, scheme }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  return useContext(AppearanceContext);
}
