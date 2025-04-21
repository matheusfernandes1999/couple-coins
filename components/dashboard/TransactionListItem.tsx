// components/dashboard/TransactionListItem.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction } from '@/types';
import { useTheme } from '../../context/ThemeContext';

interface TransactionListItemProps {
  item: Transaction;
  onPress: (item: Transaction) => void;
}

const TransactionListItem: React.FC<TransactionListItemProps> = ({ item, onPress }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const isIncome = item.type === 'income';
  const valueColor = isIncome ? colors.success : colors.error;
  const valueSign = isIncome ? '+' : '-';
  const iconName = isIncome ? 'arrow-up-circle' : 'arrow-down-circle';

  return (
    <TouchableOpacity onPress={() => onPress(item)} style={styles.container} activeOpacity={0.7}>
        {/* Ícone */}
        <View style={[styles.iconContainer, { backgroundColor: valueColor + '20'}]}>
             <Ionicons name={iconName} size={24} color={valueColor} />
        </View>

        {/* Detalhes */}
        <View style={styles.detailsContainer}>
            <Text style={styles.categoryText} numberOfLines={1}>{item.category}</Text>
            {item.description ? <Text style={styles.descriptionText} numberOfLines={1}>{item.description}</Text> : null}
        </View>

        {/* Valor e Data */}
        <View style={styles.amountContainer}>
            <Text style={[styles.amountText, { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit>
                {valueSign} {item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </Text>
             <Text style={styles.dateText}>{item.date.toDate().toLocaleDateString('pt-BR')}</Text>
        </View>
    </TouchableOpacity>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 8,
  },
  iconContainer: {
      padding: 8,
      borderRadius: 20,
      marginRight: 12,
      alignItems: 'center',
      justifyContent: 'center',
  },
  detailsContainer: {
    flex: 1,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  descriptionText: {
     fontSize: 13,
     color: colors.textSecondary,
  },
  amountContainer: {
      alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  dateText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

export default TransactionListItem;