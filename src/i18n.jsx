import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';

const translations = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

const LanguageContext = createContext();

const DEFAULT_LANGUAGE = 'zh-CN';

function getInitialLanguage() {
  const saved = localStorage.getItem('rop-ide-language');
  if (saved && translations[saved]) {
    return saved;
  }
  const browserLang = navigator.language || navigator.userLanguage;
  if (browserLang.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en-US';
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage);

  const setLanguage = useCallback((lang) => {
    if (translations[lang]) {
      setLanguageState(lang);
      localStorage.setItem('rop-ide-language', lang);
      document.documentElement.lang = lang;
    }
  }, []);

  const t = useCallback((key, params = {}) => {
    const dict = translations[language] || translations[DEFAULT_LANGUAGE];
    let text = dict[key] || key;
    Object.keys(params).forEach((k) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
    });
    return text;
  }, [language]);

  const formatDate = useCallback((date, options = {}) => {
    const locale = language === 'zh-CN' ? 'zh-CN' : 'en-US';
    return new Date(date).toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      ...options,
    });
  }, [language]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, formatDate }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export function useTranslation() {
  const { t } = useLanguage();
  return t;
}