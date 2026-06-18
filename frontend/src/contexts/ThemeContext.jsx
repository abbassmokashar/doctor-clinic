import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { settingsAPI } from '../services/api';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });
  const [appName, setAppNameState] = useState(() => {
    return localStorage.getItem('appName') || 'Doctor Clinic';
  });

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Persist app name
  useEffect(() => {
    if (appName) localStorage.setItem('appName', appName);
  }, [appName]);

  const setTheme = useCallback(async (newTheme) => {
    setThemeState(newTheme);
    try {
      await settingsAPI.update({ colorTheme: newTheme });
    } catch {
      // Silently fail - theme is still applied locally
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  const setAppName = useCallback(async (newName) => {
    setAppNameState(newName);
    try {
      await settingsAPI.update({ appName: newName });
    } catch {
      // Silently fail
    }
  }, []);

  // Load settings from backend on mount
  useEffect(() => {
    settingsAPI.getAll()
      .then((res) => {
        const data = res.data;
        if (data.colorTheme === 'light' || data.colorTheme === 'dark') {
          setThemeState(data.colorTheme);
        }
        if (data.appName) {
          setAppNameState(data.appName);
        }
      })
      .catch(() => {});
  }, []);

  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark, appName, setAppName }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
