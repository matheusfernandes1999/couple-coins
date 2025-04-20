// app/settings.tsx
import React, { useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '@/context/ThemeContext'; // Importa o hook
import { Stack, useNavigation } from 'expo-router'; // Para opções de header
import { Ionicons } from '@expo/vector-icons';

// Define o tipo para as opções de tema, incluindo ícone
type ThemeOption = {
  label: string;
  value: 'light' | 'dark' | 'system';
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

export default function SettingsScreen() {
  const { themeMode, setThemeMode, colors, effectiveTheme } = useTheme();
  const navigation = useNavigation();

  // Define o título e estilo do header dinamicamente
   useLayoutEffect(() => {
     navigation.setOptions({
       title: 'Configurações de Tema',
       headerStyle: { backgroundColor: colors.surface }, // Fundo do header
       headerTintColor: colors.textPrimary, // Cor do título e botão voltar
       headerTitleStyle: { color: colors.textPrimary },
     });
   }, [navigation, colors]);


  const themeOptions: ThemeOption[] = [
    { label: 'Claro', value: 'light', icon: 'sunny-outline' },
    { label: 'Escuro', value: 'dark', icon: 'moon-outline' },
    { label: 'Padrão do Sistema', value: 'system', icon: 'settings-outline' },
  ];

  // Cria os estilos dinamicamente
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      paddingVertical: 20,
      paddingHorizontal: 15,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 15,
      marginTop: 10,
    },
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingVertical: 15,
      paddingHorizontal: 20,
      borderRadius: 10,
      marginBottom: 10,
      borderWidth: 1,
    },
     optionButtonSelected: { // Estilo específico para botão selecionado
        borderColor: colors.primary,
        borderWidth: 2, // Borda mais grossa para indicar seleção
     },
    optionIcon: {
      marginRight: 15,
    },
    optionLabel: {
      fontSize: 16,
      color: colors.textPrimary,
      flex: 1, // Para empurrar o checkmark para a direita
    },
    checkmarkIcon: {
      // Estilos para o ícone de checkmark (visível apenas se selecionado)
    },
  });


  return (
    <View style={styles.container}>
       {/* Stack.Screen aqui permite definir opções específicas para esta tela */}
       {/* As opções definidas em useLayoutEffect acima também funcionam */}
      <Stack.Screen options={{ title: 'Configurações de Tema' }} />
      <ScrollView style={styles.scrollView}>
        <Text style={styles.sectionTitle}>Aparência</Text>
        {themeOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
               styles.optionButton,
               themeMode === option.value && styles.optionButtonSelected // Aplica estilo extra se selecionado
            ]}
            onPress={() => setThemeMode(option.value)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={option.icon}
              size={22}
              color={colors.textSecondary} // Cor do ícone da opção
              style={styles.optionIcon}
            />
            <Text style={styles.optionLabel}>{option.label}</Text>
             {themeMode === option.value && ( // Mostra checkmark se selecionado
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={colors.primary} // Cor do checkmark
                style={styles.checkmarkIcon}
              />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}