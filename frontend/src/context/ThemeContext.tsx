import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'dark' | 'light';
export type UnitSystem = 'metric' | 'field';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  units: UnitSystem;
  toggleUnits: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
  units: 'metric',
  toggleUnits: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Light "paper" is the default theme; dark "night shift" only when the user picked it.
  const [theme, setThemeState] = useState<Theme>(() =>
    localStorage.getItem('petrotwin_theme') === 'dark' ? 'dark' : 'light',
  );
  const [units, setUnits] = useState<UnitSystem>(() =>
    localStorage.getItem('petrotwin_units') === 'field' ? 'field' : 'metric',
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('petrotwin_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('petrotwin_units', units);
  }, [units]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme: () => setThemeState((p) => (p === 'dark' ? 'light' : 'dark')),
        setTheme: setThemeState,
        units,
        toggleUnits: () => setUnits((u) => (u === 'metric' ? 'field' : 'metric')),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
