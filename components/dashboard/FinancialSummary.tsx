// components/dashboard/FinancialSummary.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import SummaryCard from './SummaryCard';
import { FinancialSummary } from '@/types';

interface FinancialSummaryProps {
  monthlySummary: FinancialSummary;
  weeklySummary: FinancialSummary;
  displayType: 'month' | 'week';
}

const FinancialSummaryDisplay: React.FC<FinancialSummaryProps> = ({
  monthlySummary,
  weeklySummary,
  displayType,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const getBalanceColor = (balance: number) => balance >= 0 ? colors.success : colors.error;

  return (
    <View style={styles.container}> 

      {displayType === 'month' && (
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <SummaryCard
              label="Entradas" value={monthlySummary.income}
              iconName="arrow-up-circle-outline" iconColor={colors.success}
              valueColor={colors.success} style={styles.cardHalf}
            />
            <SummaryCard
              label="Saídas" value={monthlySummary.expenses}
              iconName="arrow-down-circle-outline" iconColor={colors.error}
              valueColor={colors.error} style={styles.cardHalf}
            />
          </View>
          <SummaryCard
            label="Balanço" value={monthlySummary.balance}
            iconName="wallet-outline" iconColor={colors.primary}
            valueColor={getBalanceColor(monthlySummary.balance)} style={styles.cardFull}
          />
        </View>
      )}

      {displayType === 'week' && (
        <View style={styles.summarySection}>
            <View style={styles.summaryRow}>
               <SummaryCard
                 label="Entradas" value={weeklySummary.income}
                 iconName="arrow-up-circle-outline" iconColor={colors.success}
                 valueColor={colors.success} style={styles.cardThird}
               />
               <SummaryCard
                 label="Saídas" value={weeklySummary.expenses}
                 iconName="arrow-down-circle-outline" iconColor={colors.error}
                 valueColor={colors.error} style={styles.cardThird}
               />
               <SummaryCard
                 label="Balanço" value={weeklySummary.balance}
                 iconName="wallet-outline" iconColor={colors.primary}
                 valueColor={getBalanceColor(weeklySummary.balance)} style={styles.cardThird}
               />
            </View>
        </View>
      )}
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
      paddingHorizontal: 15,
  },
  summarySection: {
    
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardHalf: { width: '48%', marginBottom: 15 },
  cardFull: { width: '100%', marginBottom: 15 },
  cardThird: { width: '32%', marginBottom: 15 },
});

export default FinancialSummaryDisplay;