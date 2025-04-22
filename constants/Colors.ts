// constants/Colors.ts

// Definindo tipos para melhor organização e autocompletar
type ColorTheme = {
  primary: string;       // Cor principal (botões, links importantes)
  secondary: string;     // Cor secundária/accent (destaques, ícones positivos)
  background: string;    // Fundo principal da tela
  bottomSheet: string;   // Fundo de bottom sheets (modal de ações)
  surface: string;       // Fundo de elementos elevados (cards, inputs)
  textPrimary: string;   // Cor principal do texto
  textSecondary: string; // Cor secundária do texto (legendas, placeholders)
  border: string;        // Cor de bordas sutis
  error: string;         // Cor para indicar erros
  success: string;       // Cor para indicar sucesso (pode ser a 'secondary')
  warning: string;       // Cor para avisos (não definido no tema, mas pode ser útil)
  icon: string;          // Cor padrão para ícones
  placeholder: string;   // Cor específica para placeholders em inputs
};

const lightColors: ColorTheme = {
  primary: 'rgb(0, 155, 77)',       // Azul vibrante e confiável
  secondary: '#34C759',     // Verde para sucesso e positividade
  background: '#F2F2F7',    // Cinza muito claro (quase branco) iOS style
  bottomSheet: '#FFFFFF', // Branco puro para fundo de bottom sheets
  surface: '#FFFFFF',       // Branco puro para cards e inputs
  textPrimary: '#000000',   // Preto para máxima legibilidade
  textSecondary: '#6e6e73', // Cinza escuro para texto secundário
  border: '#D1D1D6',        // Cinza claro para bordas
  error: '#FF3B30',         // Vermelho padrão iOS para erros
  success: '#34C759',       // Verde (mesmo que secundário)
  warning: '#FF9500',       // Laranja para avisos (não definido no tema, mas pode ser útil)
  icon: '#8A8A8E',          // Cinza médio para ícones não interativos
  placeholder: '#C7C7CD',   // Cinza bem claro para placeholders
};

const darkColors: ColorTheme = {
  primary: 'rgb(5, 151, 78)',       // Azul um pouco mais brilhante para contraste no escuro
  secondary: '#30D158',     // Verde mais brilhante
  background: '#000000',    // Preto puro para OLEDs e alto contraste
  bottomSheet: '#1C1C1E', // Cinza muito escuro (quase preto) para fundo de bottom sheets
  surface: '#1C1C1E',       // Cinza muito escuro (quase preto) para cards/inputs
  textPrimary: '#FFFFFF',   // Branco para texto principal
  textSecondary: '#8e8e93', // Cinza claro para texto secundário
  border: '#38383A',        // Cinza escuro para bordas
  error: '#FF453A',         // Vermelho mais brilhante para erros
  success: '#30D158',       // Verde (mesmo que secundário)
  warning: '#FF9F0A',       // Laranja para avisos (não definido no tema, mas pode ser útil)
  icon: '#8A8A8E',          // Cinza médio (funciona bem em ambos os temas)
  placeholder: '#636366',   // Cinza escuro para placeholders
};

export const Colors = {
  light: lightColors,
  dark: darkColors,
};

// Exemplo de como usar (fora deste arquivo):
// import { Colors } from './constants/Colors';
// import { useColorScheme } from 'react-native';
// const colorScheme = useColorScheme() ?? 'light';
// const colors = Colors[colorScheme];
// <View style={{backgroundColor: colors.background}}>...</View>