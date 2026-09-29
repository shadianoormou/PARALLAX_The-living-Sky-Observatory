'use client';

import { createContext, useContext, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

type ModeContextValue = {
  expert: boolean;
  setExpert: Dispatch<SetStateAction<boolean>>;
};

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [expert, setExpert] = useState(false);
  const value = useMemo(() => ({ expert, setExpert }), [expert]);
  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  const value = useContext(ModeContext);
  if (!value) throw new Error('useMode must be used inside ModeProvider');
  return value;
}
