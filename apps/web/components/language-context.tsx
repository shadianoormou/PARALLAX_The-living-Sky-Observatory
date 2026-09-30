'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'en' | 'bn';

const DICTIONARY: Record<Language, Record<string, string>> = {
  en: {},
  bn: {
    'nav.explore': 'অন্বেষণ',
    'nav.mysteries': 'আকাশের রহস্য',
    'nav.citizen': 'নাগরিক বিজ্ঞান',
    'nav.classroom': 'শ্রেণিকক্ষ + পাইলট',
    'nav.parallax': 'PARALLAX X',
    'nav.science': 'বিজ্ঞানের পদ্ধতি',
    'nav.validation': 'যাচাই ফলাফল',
    'shell.open': 'মানমন্দির খুলুন',
    'shell.public': 'সবার জন্য',
    'shell.expert': 'বিশেষজ্ঞ',
    'shell.language': 'ভাষা',
    'shell.audience': 'ব্যবহারকারী মোড',
    'shell.skip': 'মূল কনটেন্টে যান',
    'shell.highContrast': 'উচ্চ কনট্রাস্ট চালু/বন্ধ করুন',
    'shell.largeText': 'বড় লেখা চালু/বন্ধ করুন',
    'global.eyebrow': 'GLOBAL ACCESS / বিশ্বজুড়ে ব্যবহারযোগ্য',
    'global.title': 'সীমান্ত পেরিয়ে পর্যালোচনার জন্য তৈরি।',
    'global.body': 'PARALLAX X আলাদা ভাষা, পেশা ও সহায়ক প্রযুক্তির ব্যবহারকারীদের একই traceable evidence handoff-এ যুক্ত করে—বিশ্বব্যাপী adoption দাবি না করে।',
    'global.share': 'শুধু-পড়া evidence link',
    'global.modes': 'Citizen · Teacher · Researcher',
    'global.accessibility': 'Keyboard · contrast · screen reader',
    'global.pilot': 'Pilot dashboard খুলুন',
  },
};

type LanguageContextValue = {
  language: Language;
  setLanguage: (value: Language) => void;
  t: (key: string, fallback: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  useEffect(() => {
    const stored = window.localStorage.getItem('parallax-language');
    if (stored === 'en' || stored === 'bn') setLanguageState(stored);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const setLanguage = useCallback((value: Language) => {
    setLanguageState(value);
    window.localStorage.setItem('parallax-language', value);
  }, []);
  const t = useCallback((key: string, fallback: string) => DICTIONARY[language][key] ?? fallback, [language]);
  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}
