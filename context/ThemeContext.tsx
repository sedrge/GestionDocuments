import { createContext, useContext, useState } from "react";

const Themes = {
  light: {
    bg: "#F5F5F7",
    card: "#FFFFFF",
    text: "#1C1C1E",
    subText: "#8E8E93",
    primary: "#007AFF",
    nav: "#E5E5EA",
    border: "#D1D1D6",
    danger: "#FF3B30",
    success: "#34C759",
  },
  dark: {
    bg: "#121212",
    card: "#1E1E1E",
    text: "#FFFFFF",
    subText: "#A1A1A1",
    primary: "#0A84FF",
    nav: "#2C2C2E",
    border: "#38383A",
    danger: "#FF453A",
    success: "#30D158",
  },
};

const ThemeContext = createContext({
  theme: Themes.light,
  isDark: false,
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }: any) => {
  const [isDark, setIsDark] = useState(false);
  const theme = isDark ? Themes.dark : Themes.light;
  const toggleTheme = () => setIsDark(!isDark);

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
