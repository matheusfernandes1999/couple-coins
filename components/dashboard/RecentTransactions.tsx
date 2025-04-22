// components/dashboard/RecentTransactions.tsx
import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Transaction } from '@/types';
import TransactionListItem from './TransactionListItem';

interface RecentTransactionsProps {
  transactions: Transaction[];
  isLoading: boolean;
  onTransactionPress: (transaction: Transaction) => void;
  limit?: number;
}

const RecentTransactions: React.FC<RecentTransactionsProps> = ({
   transactions,
   isLoading,
   onTransactionPress,
   limit
 }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const displayTransactions = limit ? transactions.slice(0, limit) : transactions;
  const renderItem = ({ item }: { item: Transaction }) => (
      <TransactionListItem item={item} onPress={onTransactionPress} />
  );

  return (
    <View style={styles.container}>
       {isLoading && displayTransactions.length === 0 && (
         <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
       )}
       {!isLoading && displayTransactions.length === 0 && (
         <Text style={styles.placeholderText}>Nenhuma transação encontrada para os filtros selecionados.</Text>
       )}

       {displayTransactions.length > 0 && (
         <FlatList
           data={displayTransactions}
           renderItem={renderItem}
           keyExtractor={(item) => item.id}
           scrollEnabled={false}
         />
       )}
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  placeholderText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
    paddingHorizontal: 20,
  },
});

export default RecentTransactions;