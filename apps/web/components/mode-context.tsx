'use client';

import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

export type Audience = 'citizen' | 'teacher' | 'researcher';

type ModeContextValue = {
  expert: boolean;
  setExpert: Dispatch<SetStateAction<boolean>>;
  audience: Audience;
  setAudience: (value: Audience) => void;
};

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [expert, setExpert] = useState(false);
  const [audience, setAudienceState] = useState<Audience>('citizen');
  useEffect(() => {
    const stored = window.localStorage.getItem('parallax-audience-mode');
    if (stored === 'citizen' || stored === 'teacher' || stored === 'researcher') setAudienceState(stored);
  }, []);
  function setAudience(value: Audience) {
    setAudienceState(value);
    window.localStorage.setItem('parallax-audience-mode', value);
  }
  const value = useMemo(() => ({ expert, setExpert, audience, setAudience }), [expert, audience]);
  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  const value = useContext(ModeContext);
  if (!value) throw new Error('useMode must be used inside ModeProvider');
  return value;
}
