// components/insights/TemporalTrends.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext'; // Ajuste o caminho
import { Transaction } from '@/types'; // Ajuste o caminho
import { Ionicons } from '@expo/vector-icons'; // Para ícones opcionais

// Função auxiliar interna para formatar moeda
const formatCurrencyLocal = (value: number | null | undefined): string => {
    if (value !== undefined && value !== null && !isNaN(value)) {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    return 'R$ --,--';
};

interface TemporalTrendsProps {
  transactions: Transaction[]; // Transações do período selecionado
  totalExpenses: number; // Gasto total no período (para cálculo de %)
}

const daysOfWeek = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const TemporalTrends: React.FC<TemporalTrendsProps> = ({ transactions, totalExpenses }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  // Calcula os gastos por dia da semana e FDS vs Semana útil
  const analysis = useMemo(() => {
    const spendingByDay = [0, 0, 0, 0, 0, 0, 0]; // Domingo a Sábado
    let weekendSpending = 0;
    let weekdaySpending = 0;

    transactions.forEach(t => {
      if (t.type === 'expense' && t.date) {
        const date = t.date.toDate();
        const dayIndex = date.getDay(); // 0 = Domingo, 6 = Sábado

        spendingByDay[dayIndex] += t.value;

        if (dayIndex === 0 || dayIndex === 6) { // Domingo ou Sábado
          weekendSpending += t.value;
        } else { // Segunda a Sexta
          weekdaySpending += t.value;
        }
      }
    });

    let busiestDayIndex = -1;
    let maxSpent = -1;
    spendingByDay.forEach((spent, index) => {
      if (spent > maxSpent) {
        maxSpent = spent;
        busiestDayIndex = index;
      }
    });

    const busiestDay = busiestDayIndex !== -1 ? daysOfWeek[busiestDayIndex] : 'N/A';
    const weekendPercentage = totalExpenses > 0 ? Math.round((weekendSpending / totalExpenses) * 100) : 0;
    const weekdayPercentage = totalExpenses > 0 ? Math.round((weekdaySpending / totalExpenses) * 100) : 0;


    return {
      busiestDay,
      maxSpentOnBusiestDay: maxSpent > 0 ? maxSpent : 0, // Retorna 0 se não houver gasto
      weekendSpending,
      weekdaySpending,
      weekendPercentage,
      weekdayPercentage
    };
  }, [transactions, totalExpenses]); // Recalcula se as transações ou gasto total mudam

  // Não renderiza nada se não houver gastos para analisar
  if (totalExpenses <= 0) {
      return (
          <View style={styles.container}>
              <Text style={styles.noDataText}>Sem dados de gastos para análise temporal.</Text>
          </View>
      );
  }

  return (
    <View style={styles.container}>
       <View style={styles.insightRow}>
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} style={styles.icon} />
            <View style={styles.textContainer}>
                <Text style={styles.label}>Dia com Maior Gasto:</Text>
                <Text style={styles.value}>{analysis.busiestDay} ({formatCurrencyLocal(analysis.maxSpentOnBusiestDay)})</Text>
            </View>
       </View>
        <View style={styles.separator} />
       <View style={styles.insightRow}>
             <Ionicons name="moon-outline" size={20} color={colors.textSecondary} style={styles.icon} />
             <View style={styles.textContainer}>
                <Text style={styles.label}>Gasto Fim de Semana:</Text>
                <Text style={styles.value}>{formatCurrencyLocal(analysis.weekendSpending)} ({analysis.weekendPercentage}%)</Text>
            </View>
       </View>
       <View style={styles.insightRow}>
            <Ionicons name="sunny-outline" size={20} color={colors.textSecondary} style={styles.icon} />
            <View style={styles.textContainer}>
                <Text style={styles.label}>Gasto Dias Úteis:</Text>
                <Text style={styles.value}>{formatCurrencyLocal(analysis.weekdaySpending)} ({analysis.weekdayPercentage}%)</Text>
            </View>
       </View>
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    // Estilo para o container geral da seção, se necessário
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12, // Espaço entre linhas de insight
  },
  icon: {
      marginRight: 12,
      width: 20, // Largura fixa para alinhamento
      textAlign: 'center',
  },
  textContainer: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between', // Alinha label e valor
      alignItems: 'center', // Alinha verticalmente
      flexWrap: 'wrap', // Permite quebrar linha se necessário
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 5,
  },
  value: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'right', // Alinha valor à direita
  },
  separator: {
      height: 1,
      backgroundColor: colors.border + '50',
      marginVertical: 8,
      marginHorizontal: 10, // Pequena margem horizontal
  },
   noDataText: {
    fontSize: 14, color: colors.textSecondary, textAlign: 'center',
    paddingVertical: 10, fontStyle: 'italic',
  },
});

export default TemporalTrends;