// components/insights/UpcomingBillsInsight.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '@/context/ThemeContext'; // Ajuste o caminho
import { db } from '@/lib/firebase'; // Ajuste o caminho
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { BillReminder } from '@/types'; // Ajuste o caminho
import { Ionicons } from '@expo/vector-icons';

const formatCurrency = (value: number): string => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (timestamp?: Timestamp | null): string => timestamp ? timestamp.toDate().toLocaleDateString('pt-BR') : 'N/A';

interface UpcomingBillsInsightProps {
  groupId: string;
  daysAhead?: number; // Quantos dias no futuro olhar (default 30)
}

const UpcomingBillsInsight: React.FC<UpcomingBillsInsightProps> = ({ groupId, daysAhead = 30 }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [upcomingTotal, setUpcomingTotal] = useState<number>(0);
  const [upcomingCount, setUpcomingCount] = useState<number>(0);
  const [nextBill, setNextBill] = useState<BillReminder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) {
      setIsLoading(false);
      return;
    }

    const fetchUpcomingBills = async () => {
      setIsLoading(true);
      setError(null);
      setNextBill(null);
      setUpcomingCount(0);
      setUpcomingTotal(0);

      try {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0); // Início de hoje
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + daysAhead); // X dias à frente
        endDate.setHours(23, 59, 59, 999); // Fim do último dia

        const startTimestamp = Timestamp.fromDate(startDate);
        const endTimestamp = Timestamp.fromDate(endDate);

        // Query: Contas não pagas, com vencimento entre hoje e X dias, ordenadas por data
        const billsQuery = query(
            collection(db, "groups", groupId, "bills"),
            where("isPaid", "==", false),
            where("dueDate", ">=", startTimestamp),
            where("dueDate", "<=", endTimestamp),
            orderBy("dueDate", "asc")
            // limit(10) // Opcional: Limitar a consulta inicial se houver muitas contas
        );

        const snapshot = await getDocs(billsQuery);
        let total = 0;
        let count = 0;
        let firstBill: BillReminder | null = null;

        snapshot.forEach(doc => {
            const bill = { id: doc.id, ...doc.data() } as BillReminder;
            if (!firstBill) {
                 firstBill = bill; // Pega a primeira (mais próxima)
            }
            total += bill.value;
            count++;
        });

        setUpcomingTotal(total);
        setUpcomingCount(count);
        setNextBill(firstBill);

      } catch (err: any) {
        console.error("Error fetching upcoming bills:", err);
        setError(`Erro ao buscar próximas contas.`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUpcomingBills();

  }, [groupId, daysAhead]); // Recarrega se o grupo ou período mudar

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator color={colors.textSecondary} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : upcomingCount === 0 ? (
         <View style={styles.emptyContainer}>
             <Ionicons name="checkmark-circle-outline" size={24} color={colors.success} />
             <Text style={styles.emptyText}>Nenhuma conta prevista para os próximos {daysAhead} dias.</Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryRow}>
             <Ionicons name="cash-outline" size={22} color={colors.primary} style={styles.icon}/>
             <Text style={styles.summaryText}>Total Próximas Contas:</Text>
             <Text style={styles.summaryValue}>{formatCurrency(upcomingTotal)} ({upcomingCount} conta{upcomingCount > 1 ? 's' : ''})</Text>
          </View>
          {nextBill && (
              <View style={styles.nextBillRow}>
                   <Ionicons name="time-outline" size={20} color={colors.textSecondary} style={styles.icon}/>
                  <Text style={styles.nextBillLabel}>Próximo Vencimento:</Text>
                   <Text style={styles.nextBillValue} numberOfLines={1}>
                       {nextBill.name} em {formatDate(nextBill.dueDate)} ({formatCurrency(nextBill.value)})
                   </Text>
              </View>
          )}
        </>
      )}
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
    container: { paddingVertical: 10 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    nextBillRow: { flexDirection: 'column', alignItems: 'center', marginTop: 5 },
    icon: { marginRight: 8 },
    summaryText: { fontSize: 15, color: colors.textPrimary, fontWeight: '500', flexShrink: 1, marginRight: 5 },
    summaryValue: { fontSize: 15, fontWeight: 'bold', color: colors.primary, textAlign: 'right', flex: 1 },
    nextBillLabel: { fontSize: 13, color: colors.textSecondary, marginRight: 5},
    nextBillValue: { fontSize: 13, color: colors.textSecondary, fontWeight:'500', flex: 1, textAlign: 'right' },
    emptyContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
    emptyText: { fontSize: 14, color: colors.success, fontStyle: 'italic', marginLeft: 8 },
    errorText: { fontSize: 14, color: colors.error, textAlign: 'center', fontStyle: 'italic', paddingVertical: 10 },
});

export default UpcomingBillsInsight;