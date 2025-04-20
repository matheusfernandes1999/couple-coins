// components/dashboard/RecentTransactions.tsx
import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Transaction } from '@/types';
import TransactionListItem from './TransactionListItem'; // <-- Importa o novo componente

interface RecentTransactionsProps {
  transactions: Transaction[];
  isLoading: boolean;
  onTransactionPress: (transaction: Transaction) => void;
  limit?: number; // Opcional: Limitar número de itens exibidos
}

const RecentTransactions: React.FC<RecentTransactionsProps> = ({
   transactions,
   isLoading,
   onTransactionPress,
   limit
 }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  // Limita as transações se a prop 'limit' for passada
  const displayTransactions = limit ? transactions.slice(0, limit) : transactions;

  // Usa o novo TransactionListItem no renderItem
  const renderItem = ({ item }: { item: Transaction }) => (
      <TransactionListItem item={item} onPress={onTransactionPress} />
  );

  return (
    // Container principal não precisa mais de padding horizontal se a lista tiver
    <View style={styles.container}>
       {/* O Título "Últimas Transações" foi movido para HomeScreen */}
       {/* <Text style={styles.sectionTitle}>Últimas Transações</Text> */}

       {/* Loading ou Lista Vazia */}
       {isLoading && displayTransactions.length === 0 && (
         <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
       )}
       {!isLoading && displayTransactions.length === 0 && (
         <Text style={styles.placeholderText}>Nenhuma transação encontrada para os filtros selecionados.</Text>
       )}

       {/* FlatList usando o novo item */}
       {displayTransactions.length > 0 && (
         <FlatList
           data={displayTransactions}
           renderItem={renderItem} // Renderiza TransactionListItem
           keyExtractor={(item) => item.id}
           scrollEnabled={false} // Desabilita scroll interno se dentro de outro ScrollView
           // Não precisa de contentContainerStyle se não houver padding extra
         />
       )}
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    // paddingHorizontal: 15, // Removido, FlatList pode ter seu próprio padding
    marginBottom: 20, // Espaço abaixo da lista
  },
  // sectionTitle: { /* ... */ }, // Removido ou mantido se necessário
  placeholderText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
});

export default RecentTransactions;