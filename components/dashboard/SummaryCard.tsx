// components/dashboard/SummaryCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface SummaryCardProps {
  label: string;
  value: number;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  valueColor: string;
  style?: object
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  value,
  iconName,
  iconColor,
  valueColor,
  style
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={[styles.summaryCard, style]}>
      <Ionicons name={iconName} size={24} color={iconColor} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: valueColor }]}>
        {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </Text>
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 6,
    padding: 15,
    alignItems: 'center',
    elevation: 1
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 5,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 5,
  },
});

export default SummaryCard;