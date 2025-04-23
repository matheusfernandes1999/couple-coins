// components/insights/CategorySpendingChange.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext'; // Ajuste o caminho
import { SpendingChange } from '@/types'; // Ajuste o caminho
import { Ionicons } from '@expo/vector-icons';

const formatCurrencyLocal = (value: number | null | undefined): string => {
    if (value !== undefined && value !== null && !isNaN(value)) {
      return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    }
    return "R$ --,--"; // Retorna um placeholder se inválido
  };

interface CategorySpendingChangeProps {
  currentSpendingMap: Map<string, number>;
  previousSpendingMap: Map<string, number>;
  isLoading: boolean; // Indica se os dados base estão carregando
}

const CategorySpendingChange: React.FC<CategorySpendingChangeProps> = ({
  currentSpendingMap,
  previousSpendingMap,
  isLoading,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  // Calcula os dados de variação usando useMemo
  const spendingChangesData = useMemo((): SpendingChange[] => {
    // Não calcula se não houver dados atuais
    if (currentSpendingMap.size === 0 && previousSpendingMap.size === 0) return [];

    const changes: SpendingChange[] = [];
    const allCategories = new Set([...currentSpendingMap.keys(), ...previousSpendingMap.keys()]);

    allCategories.forEach(category => {
        const current = currentSpendingMap.get(category) || 0;
        const previous = previousSpendingMap.get(category) || 0;
        const changeAmount = current - previous;

        // Só inclui se houve gasto em algum dos períodos
        if (current === 0 && previous === 0) return;

        let changePercent: number | null | typeof Infinity = null;
        if (previous !== 0) {
            changePercent = Math.round((changeAmount / previous) * 100);
        } else if (current > 0) {
            changePercent = Infinity; // Gasto novo
        } // Se ambos 0, percentual é null

        changes.push({ category, current, previous, changeAmount, changePercent });
    });

    // Ordena por maior AUMENTO absoluto primeiro, depois por maior REDUÇÃO absoluta
    changes.sort((a, b) => {
        // Prioriza maiores aumentos
        if (a.changeAmount > 0 && b.changeAmount <= 0) return -1;
        if (a.changeAmount <= 0 && b.changeAmount > 0) return 1;
        // Se ambos aumentos, ordena pelo maior
        if (a.changeAmount > 0 && b.changeAmount > 0) return b.changeAmount - a.changeAmount;
        // Se ambos reduções (ou zero), ordena pela maior redução (menor changeAmount)
        if (a.changeAmount <= 0 && b.changeAmount <= 0) return a.changeAmount - b.changeAmount;
        return 0;
    });

    return changes;

  }, [currentSpendingMap, previousSpendingMap]); // Recalcula se os mapas de gastos mudarem

  // --- Renderização do Item da Lista de Variação ---
  const renderSpendingChangeItem = ({ item }: { item: SpendingChange }) => {
    const changeColor = item.changeAmount > 0 ? colors.error : colors.success;
    const changeSign = item.changeAmount > 0 ? '+' : '';
    const iconName: React.ComponentProps<typeof Ionicons>['name'] =
        item.changeAmount === 0 ? 'remove-outline' : (item.changeAmount > 0 ? 'arrow-up' : 'arrow-down');
    const iconColor = item.changeAmount === 0 ? colors.textSecondary : changeColor;

    let percentString = '';
    if (item.changePercent === Infinity) percentString = '- Novo';
    else if (item.changePercent === -100) percentString = '- Gasto Zerado'; // Se era >0 e agora é 0
    else if (item.changePercent !== null) percentString = `(${changeSign}${item.changePercent}%)`;

    return (
        <View style={styles.trendItem}>
             <Ionicons name={iconName} size={18} color={iconColor} style={styles.trendIcon}/>
            <View style={styles.trendTextContainer}>
                <Text style={styles.trendCategory} numberOfLines={1}>{item.category}</Text>
                 <Text style={styles.trendDetail} numberOfLines={1}>
                     {formatCurrencyLocal(item.current)} (vs {formatCurrencyLocal(item.previous)})
                 </Text>
            </View>
            <Text style={[styles.trendAmountChange, { color: changeColor }]}>
                {changeSign}{formatCurrencyLocal(item.changeAmount)} {percentString}
            </Text>
        </View>
    );
  };
  // ------------------------------------------------------

  if (isLoading) {
       return <ActivityIndicator color={colors.textSecondary} style={{ marginVertical: 15 }}/>;
  }

  if (spendingChangesData.length === 0) {
      return <Text style={styles.noDataText}>Sem dados suficientes para comparar tendências.</Text>;
  }

  return (
    <FlatList
      data={spendingChangesData}
      renderItem={renderSpendingChangeItem}
      keyExtractor={(item) => item.category}
      scrollEnabled={false} // Deixa ScrollView pai rolar
      // style={styles.listContainer} // Estilo opcional para a lista em si
    />
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  // listContainer: {}, // Estilo se necessário
  trendItem: {
      flexDirection: 'row',
      alignItems: 'center', // Alinha ícone e texto verticalmente
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '50', // Separador sutil
  },
  trendIcon: {
      marginRight: 10,
      width: 18, // Largura fixa para ícone
      textAlign: 'center',
  },
  trendTextContainer: {
      flex: 1, // Ocupa espaço disponível
      marginRight: 8,
  },
  trendCategory: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textPrimary,
      marginBottom: 2,
  },
  trendDetail: {
      fontSize: 12,
      color: colors.textSecondary,
  },
  trendAmountChange: {
      fontSize: 13,
      fontWeight: 'bold',
      textAlign: 'right',
      minWidth: 100, // Garante espaço mínimo para valores
  },
  noDataText: {
      fontSize: 14, color: colors.textSecondary, textAlign: 'center',
      paddingVertical: 15, fontStyle: 'italic',
  },
});

export default CategorySpendingChange;