import React, { createContext, useContext, useEffect, useState } from 'react';
import { getBaseUrl } from '@/lib/api';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ColorPreset {
  id: string;
  name: string;
  hex: string;
  light: {
    primary: string;
    ring: string;
    gradient: string;
  };
  dark: {
    primary: string;
    ring: string;
    gradient: string;
  };
}

export const INVENTORY_COLOR_PRESETS: ColorPreset[] = [
  {
    id: 'warm-amber',
    name: 'Warm Amber',
    hex: '#7d4e30',
    light: {
      primary: '25 40% 35%',
      ring: '25 40% 35%',
      gradient: 'linear-gradient(135deg, hsl(25 40% 35%) 0%, hsl(25 30% 50%) 100%)',
    },
    dark: {
      primary: '38 92% 50%',
      ring: '38 92% 50%',
      gradient: 'linear-gradient(135deg, hsl(38 92% 50%) 0%, hsl(25 95% 53%) 100%)',
    },
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    hex: '#2563eb',
    light: {
      primary: '217 91% 60%',
      ring: '217 91% 60%',
      gradient: 'linear-gradient(135deg, hsl(217 91% 60%) 0%, hsl(199 89% 48%) 100%)',
    },
    dark: {
      primary: '217 91% 65%',
      ring: '217 91% 65%',
      gradient: 'linear-gradient(135deg, hsl(217 91% 65%) 0%, hsl(199 89% 55%) 100%)',
    },
  },
  {
    id: 'emerald-green',
    name: 'Emerald Green',
    hex: '#16a34a',
    light: {
      primary: '152 76% 36%',
      ring: '152 76% 36%',
      gradient: 'linear-gradient(135deg, hsl(152 76% 36%) 0%, hsl(160 84% 39%) 100%)',
    },
    dark: {
      primary: '152 69% 45%',
      ring: '152 69% 45%',
      gradient: 'linear-gradient(135deg, hsl(152 69% 45%) 0%, hsl(160 75% 50%) 100%)',
    },
  },
  {
    id: 'royal-purple',
    name: 'Royal Purple',
    hex: '#7c3aed',
    light: {
      primary: '262 83% 58%',
      ring: '262 83% 58%',
      gradient: 'linear-gradient(135deg, hsl(262 83% 58%) 0%, hsl(280 80% 50%) 100%)',
    },
    dark: {
      primary: '263 70% 66%',
      ring: '263 70% 66%',
      gradient: 'linear-gradient(135deg, hsl(263 70% 66%) 0%, hsl(280 75% 65%) 100%)',
    },
  },
  {
    id: 'rose-pink',
    name: 'Rose Pink',
    hex: '#e11d48',
    light: {
      primary: '338 78% 48%',
      ring: '338 78% 48%',
      gradient: 'linear-gradient(135deg, hsl(338 78% 48%) 0%, hsl(325 78% 54%) 100%)',
    },
    dark: {
      primary: '338 85% 62%',
      ring: '338 85% 62%',
      gradient: 'linear-gradient(135deg, hsl(338 85% 62%) 0%, hsl(325 80% 65%) 100%)',
    },
  },
  {
    id: 'slate-indigo',
    name: 'Slate Indigo',
    hex: '#3730a3',
    light: {
      primary: '234 62% 46%',
      ring: '234 62% 46%',
      gradient: 'linear-gradient(135deg, hsl(234 62% 46%) 0%, hsl(245 58% 55%) 100%)',
    },
    dark: {
      primary: '234 89% 74%',
      ring: '234 89% 74%',
      gradient: 'linear-gradient(135deg, hsl(234 89% 74%) 0%, hsl(245 75% 75%) 100%)',
    },
  },
  {
    id: 'sunset-orange',
    name: 'Sunset Orange',
    hex: '#ea580c',
    light: {
      primary: '24 95% 53%',
      ring: '24 95% 53%',
      gradient: 'linear-gradient(135deg, hsl(24 95% 53%) 0%, hsl(38 92% 50%) 100%)',
    },
    dark: {
      primary: '24 95% 58%',
      ring: '24 95% 58%',
      gradient: 'linear-gradient(135deg, hsl(24 95% 58%) 0%, hsl(38 90% 55%) 100%)',
    },
  },
  {
    id: 'crimson-red',
    name: 'Crimson Red',
    hex: '#dc2626',
    light: {
      primary: '0 72% 51%',
      ring: '0 72% 51%',
      gradient: 'linear-gradient(135deg, hsl(0 72% 51%) 0%, hsl(348 83% 47%) 100%)',
    },
    dark: {
      primary: '0 84% 65%',
      ring: '0 84% 65%',
      gradient: 'linear-gradient(135deg, hsl(0 84% 65%) 0%, hsl(348 85% 65%) 100%)',
    },
  },
];

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  primaryColor: string;
  setThemeMode: (mode: ThemeMode) => void;
  setPrimaryColor: (colorId: string) => void;
  toggleTheme: () => void;
  colorPresets: ColorPreset[];
  syncWithBackend: (themeMode?: ThemeMode, primaryColor?: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_THEME_KEY = 'inventory_theme_mode';
const STORAGE_COLOR_KEY = 'inventory_primary_color';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_THEME_KEY) as ThemeMode | null;
    return saved || 'system';
  });

  const [primaryColor, setPrimaryColorState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_COLOR_KEY);
    return saved || 'warm-amber';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Attempt to sync from backend system-settings on mount if not customized
  useEffect(() => {
    const fetchBackendTheme = async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/api/system-settings`);
        if (res.ok) {
          const json = await res.json();
          const data = json.data || json;
          const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
          const savedColor = localStorage.getItem(STORAGE_COLOR_KEY);
          
          if (!savedTheme && data.themeMode) {
            setThemeModeState(data.themeMode as ThemeMode);
          }
          if (!savedColor && data.primaryColor) {
            setPrimaryColorState(data.primaryColor);
          }
        }
      } catch (err) {
        // non-fatal, local fallback is already in place
      }
    };
    fetchBackendTheme();
  }, []);

  // Handle system color scheme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateResolved = () => {
      if (themeMode === 'system') {
        setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
      } else {
        setResolvedTheme(themeMode);
      }
    };

    updateResolved();
    mediaQuery.addEventListener('change', updateResolved);
    return () => mediaQuery.removeEventListener('change', updateResolved);
  }, [themeMode]);

  // Apply dark mode class and color preset variables to DOM
  useEffect(() => {
    const root = document.documentElement;

    // Toggle dark class
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Apply color preset CSS variables
    const preset = INVENTORY_COLOR_PRESETS.find(p => p.id === primaryColor) || INVENTORY_COLOR_PRESETS[0];
    const activeColor = resolvedTheme === 'dark' ? preset.dark : preset.light;

    root.style.setProperty('--primary', activeColor.primary);
    root.style.setProperty('--ring', activeColor.ring);
    root.style.setProperty('--gradient-primary', activeColor.gradient);
  }, [resolvedTheme, primaryColor]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem(STORAGE_THEME_KEY, mode);
  };

  const setPrimaryColor = (colorId: string) => {
    setPrimaryColorState(colorId);
    localStorage.setItem(STORAGE_COLOR_KEY, colorId);
  };

  const toggleTheme = () => {
    setThemeMode(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const syncWithBackend = (newMode?: ThemeMode, newColor?: string) => {
    if (newMode) setThemeMode(newMode);
    if (newColor) setPrimaryColor(newColor);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        resolvedTheme,
        primaryColor,
        setThemeMode,
        setPrimaryColor,
        toggleTheme,
        colorPresets: INVENTORY_COLOR_PRESETS,
        syncWithBackend,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
