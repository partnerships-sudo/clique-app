'use client';

import { createContext, useContext, useState, useCallback } from 'react';

type LogModalContextType = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const LogModalContext = createContext<LogModalContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

export function LogModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return (
    <LogModalContext.Provider value={{ isOpen, open, close }}>
      {children}
    </LogModalContext.Provider>
  );
}

export function useLogModal() {
  return useContext(LogModalContext);
}
