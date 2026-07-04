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
  const [logoUrl, setLogoUrlState] = useState(() => {
    return localStorage.getItem('logoUrl') || '';
  });
  const [logoStyle, setLogoStyleState] = useState(() => {
    return localStorage.getItem('logoStyle') || 'icon';
  });
  const [faviconUrl, setFaviconUrlState] = useState(() => {
    return localStorage.getItem('faviconUrl') || '';
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

  // Persist logo settings
  useEffect(() => {
    if (logoUrl) localStorage.setItem('logoUrl', logoUrl);
    else localStorage.removeItem('logoUrl');
  }, [logoUrl]);
  useEffect(() => {
    localStorage.setItem('logoStyle', logoStyle);
  }, [logoStyle]);

  // Persist favicon
  useEffect(() => {
    if (faviconUrl) localStorage.setItem('faviconUrl', faviconUrl);
    else localStorage.removeItem('faviconUrl');
  }, [faviconUrl]);

  // Update document favicon
  useEffect(() => {
    let link = document.querySelector("link[rel*='icon']");
    if (faviconUrl) {
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = faviconUrl;
    } else {
      // Restore default favicon
      if (link) {
        link.href = 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><text y=\'.9em\' font-size=\'90\'>🏥</text></svg>';
      }
    }
  }, [faviconUrl]);

  // Update document title with app name
  useEffect(() => {
    document.title = appName ? `${appName} Management System` : 'Doctor Clinic Management System';
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

  const setLogoUrl = useCallback(async (url) => {
    setLogoUrlState(url);
    try {
      await settingsAPI.update({ logoUrl: url });
    } catch {
      // Silently fail
    }
  }, []);

  const setLogoStyle = useCallback(async (style) => {
    setLogoStyleState(style);
    try {
      await settingsAPI.update({ logoStyle: style });
    } catch {
      // Silently fail
    }
  }, []);

  const setFaviconUrl = useCallback(async (url) => {
    setFaviconUrlState(url);
    try {
      await settingsAPI.update({ faviconUrl: url });
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
        if (data.logoUrl) {
          setLogoUrlState(data.logoUrl);
        }
        if (data.logoStyle) {
          setLogoStyleState(data.logoStyle);
        }
        if (data.faviconUrl) {
          setFaviconUrlState(data.faviconUrl);
        }
      })
      .catch(() => {});
  }, []);

  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{
      theme, setTheme, toggleTheme, isDark,
      appName, setAppName,
      logoUrl, setLogoUrl,
      logoStyle, setLogoStyle,
      faviconUrl, setFaviconUrl,
    }}>
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
