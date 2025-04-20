// context/ThemeContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/Colors'; // Importa nossa paleta

// Tipos para o contexto
type ThemeMode = 'light' | 'dark' | 'system';
type EffectiveTheme = 'light' | 'dark';

interface ThemeContextProps {
  themeMode: ThemeMode; // Preferência do usuário (light, dark, system)
  effectiveTheme: EffectiveTheme; // Tema real aplicado (light ou dark)
  colors: typeof Colors.light; // Cores do tema efetivo
  setThemeMode: (mode: ThemeMode) => void; // Função para mudar a preferência
  isSystemTheme: boolean; // Indica se o tema atual é baseado no sistema
}

// Cria o contexto com valores padrão iniciais (serão substituídos)
const ThemeContext = createContext<ThemeContextProps>({
  themeMode: 'system',
  effectiveTheme: 'light', // Começa como light por padrão antes de carregar
  colors: Colors.light,
  setThemeMode: () => {},
  isSystemTheme: true,
});

// Hook customizado para usar o contexto facilmente
export const useTheme = () => useContext(ThemeContext);

// Chave para salvar no AsyncStorage
const THEME_STORAGE_KEY = '@MyApp:themePreference';

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme() ?? 'light'; // Tema do OS
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system'); // Preferência do usuário

  // Carrega a preferência salva ao iniciar o app
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode && (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system')) {
          setThemeModeState(savedMode as ThemeMode);
        }
      } catch (error) {
        console.error('Erro ao carregar preferência de tema:', error);
      }
    };
    loadThemePreference();
  }, []);

  // Salva a preferência quando ela muda
  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error('Erro ao salvar preferência de tema:', error);
    }
  };

  // Determina o tema efetivo (light ou dark)
  const effectiveTheme = themeMode === 'system' ? systemColorScheme : themeMode;
  const colors = Colors[effectiveTheme]; // Pega as cores corretas da paleta
  const isSystemTheme = themeMode === 'system';

  return (
    <ThemeContext.Provider value={{ themeMode, effectiveTheme, colors, setThemeMode, isSystemTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};