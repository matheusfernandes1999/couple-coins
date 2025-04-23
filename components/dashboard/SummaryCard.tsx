// components/dashboard/SummaryCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext'; // Ajuste o caminho se necessário

interface SummaryCardProps {
  label: string;
  value: number | null | undefined; // <-- Permite nulo ou indefinido
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  valueColor: string; // Cor principal do valor
  style?: object; // Estilos extras para o container
  isPercentage?: boolean; // <-- Indica se valor é porcentagem
  subText?: string | null | undefined; // <-- Texto adicional abaixo do valor
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  value,
  iconName,
  iconColor,
  valueColor,
  style,
  isPercentage = false, // Default é não ser porcentagem
  subText
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  // --- Formatação do Valor ---
  let displayValue = 'N/A'; // Valor padrão se nulo/indefinido/NaN
  if (value !== undefined && value !== null && !isNaN(value)) {
      if (isPercentage) {
          // Formata como porcentagem, adiciona sinal +/-
          const sign = value > 0 ? '+' : (value < 0 ? '' : ''); // Não mostra sinal para 0%
          // Mostra 0 casas decimais para porcentagem
          displayValue = `${sign}${value.toFixed(0)}%`;
      } else {
          // Formata como moeda BRL
          displayValue = value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      }
  } else if (value === null || value === undefined){
       // Se explicitamente nulo ou indefinido (ex: previsão não calculável)
       displayValue = '--'; // Ou outro placeholder
  }
  // --------------------------

  return (
    // Container principal do card, aplica estilos base e extras
    <View style={[styles.summaryCard, style]}>
      {/* Ícone */}
      <Ionicons name={iconName} size={24} color={iconColor} />
      {/* Rótulo (Label) */}
      <Text style={styles.summaryLabel} numberOfLines={2}>{label}</Text>
      {/* Valor Principal Formatado */}
      <Text
          style={[styles.summaryValue, { color: valueColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit // Tenta ajustar tamanho da fonte se não couber
      >
          {displayValue}
      </Text>
      {/* Subtexto (Opcional) - Ex: Nome da categoria */}
      {subText && (
          <Text style={styles.summarySubText} numberOfLines={1} ellipsizeMode="tail">
              {subText}
          </Text>
      )}
    </View>
  );
};

// --- Estilos ---
const getStyles = (colors: any) => StyleSheet.create({
  summaryCard: {
    backgroundColor: colors.surface, // Fundo do card
    borderRadius: 10, // Bordas mais arredondadas
    paddingVertical: 12,   // Espaçamento vertical interno
    paddingHorizontal: 8, // Espaçamento horizontal interno
    alignItems: 'center', // Centraliza conteúdo horizontalmente
    borderWidth: 1,         // Borda sutil
    borderColor: colors.border,
    shadowColor: "#000",    // Sombra iOS
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,          // Sombra Android
    marginBottom: 10,      // Espaço abaixo do card (se em coluna)
    minHeight: 125,        // Altura mínima para consistência visual
    justifyContent: 'center', // Centraliza conteúdo verticalmente
  },
  summaryLabel: {
    fontSize: 13,           // Tamanho do rótulo
    color: colors.textSecondary, // Cor secundária
    marginTop: 8,           // Espaço após o ícone
    textAlign: 'center',    // Centraliza texto
    minHeight: 30, // Garante espaço para 2 linhas
  },
  summaryValue: {
    fontSize: 17,           // Tamanho do valor principal
    fontWeight: 'bold',     // Negrito
    marginTop: 4,           // Espaço após o rótulo
    textAlign: 'center',    // Centraliza
    // A cor é definida inline via props
  },
  summarySubText: { // Estilo para o subtexto (ex: nome da categoria)
      fontSize: 12,           // Menor que o valor principal
      color: colors.textSecondary, // Cor secundária
      marginTop: 3,           // Espaço após o valor principal
      textAlign: 'center',    // Centraliza
      fontWeight: '500',      // Leve destaque
  }
});

export default SummaryCard;