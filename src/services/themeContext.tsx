import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemePreset, NavLayoutStyle, AccentColor } from '../types';
import { storageService } from './storage';

interface ThemeContextType {
  themePreset: ThemePreset;
  layoutStyle: NavLayoutStyle;
  accentColor: AccentColor;
  cardRadius: string;
  setThemePreset: (theme: ThemePreset) => void;
  setLayoutStyle: (layout: NavLayoutStyle) => void;
  setAccentColor: (color: AccentColor) => void;
  setCardRadius: (radius: string) => void;
  // Helpers
  isSkyCyan: boolean;
  isSageEmerald: boolean;
  isDarkSlate: boolean;
  isCleanLight: boolean;
  isMidnightNavy: boolean;
  isSidebar: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const settings = storageService.getSettings();

  const [themePreset, setThemePresetState] = useState<ThemePreset>(
    settings.themePreset || 'sky_cyan'
  );
  const [layoutStyle, setLayoutStyleState] = useState<NavLayoutStyle>(
    settings.layoutStyle || 'sidebar'
  );
  const [accentColor, setAccentColorState] = useState<AccentColor>(
    settings.accentColor || 'emerald'
  );
  const [cardRadius, setCardRadiusState] = useState<string>(
    settings.cardRadius || 'rounded-2xl'
  );

  const setThemePreset = (theme: ThemePreset) => {
    setThemePresetState(theme);
    const curr = storageService.getSettings();
    storageService.updateSettings({ ...curr, themePreset: theme });
  };

  const setLayoutStyle = (layout: NavLayoutStyle) => {
    setLayoutStyleState(layout);
    const curr = storageService.getSettings();
    storageService.updateSettings({ ...curr, layoutStyle: layout });
  };

  const setAccentColor = (color: AccentColor) => {
    setAccentColorState(color);
    const curr = storageService.getSettings();
    storageService.updateSettings({ ...curr, accentColor: color });
  };

  const setCardRadius = (radius: string) => {
    setCardRadiusState(radius);
    const curr = storageService.getSettings();
    storageService.updateSettings({ ...curr, cardRadius: radius });
  };

  return (
    <ThemeContext.Provider
      value={{
        themePreset,
        layoutStyle,
        accentColor,
        cardRadius,
        setThemePreset,
        setLayoutStyle,
        setAccentColor,
        setCardRadius,
        isSkyCyan: themePreset === 'sky_cyan',
        isSageEmerald: themePreset === 'sage_emerald',
        isDarkSlate: themePreset === 'dark_slate',
        isCleanLight: themePreset === 'clean_light',
        isMidnightNavy: themePreset === 'midnight_navy',
        isSidebar: layoutStyle === 'sidebar',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
