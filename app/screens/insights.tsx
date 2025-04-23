// app/(tabs)/insights.tsx
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useNavigation } from "expo-router";
import { useTheme } from "@/context/ThemeContext";
import { useGroup } from "@/context/GroupContext";
import * as Progress from "react-native-progress"; // Import progress bar
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  Timestamp,
  getDocs,
  orderBy,
} from "firebase/firestore";
import {
  Transaction,
  FinancialSummary,
  CategorySpending,
  BudgetData,
  SpendingChange,
} from "@/types";
import SummaryCard from "@/components/dashboard/SummaryCard"; // Reutiliza o card de resumo
import TemporalTrends from "@/components/insights/TemporalTrends";
import CategorySpendingChange from "@/components/insights/CategorySpendingChange";

const getMonthBounds = (date: Date): { start: Date; end: Date } => {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  // Início do mês: dia 1, 00:00:00
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  // Fim do mês: dia 0 do mês seguinte, 23:59:59.999
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

const formatCurrency = (value: number | null | undefined): string => {
  if (value !== undefined && value !== null && !isNaN(value)) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
  return "R$ --,--"; // Retorna um placeholder se inválido
};

const calculateSummaryAndSpending = (
  transactions: Transaction[]
): { summary: FinancialSummary; spendingMap: Map<string, number> } => {
  let income = 0;
  let expenses = 0;
  const spendingMap = new Map<string, number>(); // Usa Map para melhor performance
  transactions.forEach((t) => {
    if (t.type === "income") {
      income += t.value;
    } else if (t.type === "expense") {
      expenses += t.value;
      const cat = t.category || "Sem Categoria"; // Agrupa gastos sem categoria
      spendingMap.set(cat, (spendingMap.get(cat) || 0) + t.value);
    }
  });
  return {
    summary: { income, expenses, balance: income - expenses },
    spendingMap,
  };
};
// -----------------------------------

export default function InsightsScreen() {
  const { colors } = useTheme();
  const { groupId, groupData, isLoadingGroup } = useGroup(); // Pega categorias de groupData
  const styles = getStyles(colors);
  const navigation = useNavigation();
  const [isFetchingCurrent, setIsFetchingCurrent] = useState(false); // Loading específico
  const [isFetchingPrevious, setIsFetchingPrevious] = useState(false);
  // --- Estados ---
  const [periodType, setPeriodType] = useState<"current_month" | "last_month">(
    "current_month"
  ); // Período de análise
  // Dados do Período Atual
  const [currentPeriodTransactions, setCurrentPeriodTransactions] = useState<
    Transaction[]
  >([]);
  const [currentPeriodSummary, setCurrentPeriodSummary] =
    useState<FinancialSummary>({ income: 0, expenses: 0, balance: 0 });
  const [currentCategorySpendingMap, setCurrentCategorySpendingMap] = useState<
    Map<string, number>
  >(new Map());
  // Dados do Período Anterior
  const [prevPeriodTransactions, setPrevPeriodTransactions] = useState<
    Transaction[]
  >([]); // Não exibido, apenas para cálculo
  const [prevPeriodSummary, setPrevPeriodSummary] = useState<FinancialSummary>({
    income: 0,
    expenses: 0,
    balance: 0,
  });
  const [prevCategorySpendingMap, setPrevCategorySpendingMap] = useState<
    Map<string, number>
  >(new Map());
  // Orçamentos do Mês Atual (baseado no período selecionado)

  const [isLoading, setIsLoading] = useState(true);
  // Erro
  const [error, setError] = useState<string | null>(null);
  // ---------------

  // --- Calcula Datas dos Períodos ---
  const {
    currentStartDate,
    currentEndDate,
    prevStartDate,
    prevEndDate,
    currentMonthYearString,
  } = useMemo(() => {
    const now = new Date();
    let targetDate = new Date(now.getFullYear(), now.getMonth(), 1); // Início do mês atual
    if (periodType === "last_month") {
      targetDate.setMonth(now.getMonth() - 1); // Vai para o mês anterior
    }
    const currentBounds = getMonthBounds(targetDate);

    const prevTargetDate = new Date(targetDate);
    prevTargetDate.setMonth(targetDate.getMonth() - 1); // Calcula o mês anterior ao exibido
    const prevBounds = getMonthBounds(prevTargetDate);

    const monthYearStr = `${targetDate.getFullYear()}-${String(
      targetDate.getMonth() + 1
    ).padStart(2, "0")}`;

    return {
      currentStartDate: currentBounds.start,
      currentEndDate: currentBounds.end,
      prevStartDate: prevBounds.start,
      prevEndDate: prevBounds.end,
      currentMonthYearString: monthYearStr,
    };
  }, [periodType]);

  // --- Função Genérica para Buscar Transações ---
  const fetchTransactionsForDateRange = useCallback(
    async (
      startDt: Date | null,
      endDt: Date | null
    ): Promise<Transaction[]> => {
      if (!groupId || !startDt || !endDt) return []; // Retorna vazio se dados inválidos

      console.log(
        `Workspaceing transactions from ${startDt.toISOString()} to ${endDt.toISOString()}`
      );
      const startTimestamp = Timestamp.fromDate(startDt);
      const endTimestamp = Timestamp.fromDate(endDt); // endDate já é fim do dia

      // REQUER ÍNDICE: date Desc (ou Asc)
      const transQuery = query(
        collection(db, "groups", groupId, "transactions"),
        where("date", ">=", startTimestamp),
        where("date", "<=", endTimestamp),
        orderBy("date", "desc")
      );
      try {
        const snapshot = await getDocs(transQuery);
        const fetched: Transaction[] = [];
        snapshot.forEach((doc) =>
          fetched.push({ id: doc.id, ...doc.data() } as Transaction)
        );
        return fetched;
      } catch (error: any) {
        console.error("Error fetching transaction range:", error);
        if (error.code === "failed-precondition") {
          setError("Índice do Firestore necessário (campo 'date').");
        } else {
          setError("Erro ao buscar transações.");
        }
        return [];
      }
    },
    [groupId]
  ); // Depende só do groupId

  // --- Efeito para Buscar Todos os Dados ---
  useEffect(() => {
    if (
      !groupId ||
      isLoadingGroup ||
      !currentStartDate ||
      !currentEndDate ||
      !prevStartDate ||
      !prevEndDate
    ) {
      // Se não tem grupo ou datas, ou contexto está carregando, limpa tudo
      setCurrentPeriodTransactions([]);
      setCurrentPeriodSummary({ income: 0, expenses: 0, balance: 0 });
      setCurrentCategorySpendingMap(new Map());
      setPrevPeriodTransactions([]);
      setPrevPeriodSummary({ income: 0, expenses: 0, balance: 0 });
      setPrevCategorySpendingMap(new Map());
      setIsLoading(!isLoadingGroup); // Define loading baseado no contexto
      setIsFetchingCurrent(true); setIsFetchingPrevious(true);
      return;
    }

    const loadAllData = async () => {
      setIsLoading(true); // Loading geral para todas as buscas
      setError(null);

      // Promises para buscar dados em paralelo
      const currentTransPromise = fetchTransactionsForDateRange(
        currentStartDate,
        currentEndDate
      );
      const prevTransPromise = fetchTransactionsForDateRange(
        prevStartDate,
        prevEndDate
      );

      try {
        // Aguarda todas as buscas
        const [currentTrans, prevTrans] = await Promise.all([
          currentTransPromise,
          prevTransPromise,
        ]);

        // Processa Transações Atuais
        const { summary: currentSummary, spendingMap: currentSpendingMap } =
        calculateSummaryAndSpending(currentTrans);
        setCurrentPeriodTransactions(currentTrans);
        setCurrentPeriodSummary(currentSummary);
        setCurrentCategorySpendingMap(currentSpendingMap);
        setIsFetchingCurrent(false);
         // Guarda o MAP agora

        // Processa Transações Anteriores
        const { summary: prevSummary, spendingMap: prevSpendingMap } =
        calculateSummaryAndSpending(prevTrans);
        setPrevPeriodTransactions(prevTrans);
        setPrevPeriodSummary(prevSummary);
        setPrevCategorySpendingMap(prevSpendingMap);
        setIsFetchingPrevious(false) // Guarda o MAP anterior

      } catch (error: any) {
        console.error("Error loading data:", error);
        setError(
          "Falha ao carregar dados para insights."
        );
      } finally {
        setIsLoading(false);
      } // Finaliza loading geral
    };

    loadAllData();
  }, [
    groupId,
    isLoadingGroup,
    currentStartDate,
    currentEndDate,
    prevStartDate,
    prevEndDate,
    currentMonthYearString,
    fetchTransactionsForDateRange,
  ]);
  // ---------------------------------------------------

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Insights", // Título mais genérico agora
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.textPrimary,
      headerTitleStyle: { color: colors.textPrimary },
      headerShown: true, // Garante que está visível
    });
  }, [navigation, colors]);

  const spendingChangePercent = useMemo(() => {
    const currentExpenses = currentPeriodSummary.expenses;
    const prevExpenses = prevPeriodSummary.expenses;
    if (prevExpenses === 0 && currentExpenses > 0) return Infinity; // Aumento infinito
    if (prevExpenses === 0 && currentExpenses === 0) return 0; // Sem mudança
    if (prevExpenses > 0 && currentExpenses === 0) return -100; // Redução total
    if (prevExpenses > 0) {
      return Math.round(
        ((currentExpenses - prevExpenses) / prevExpenses) * 100
      );
    }
    return null; // Não calcula se gasto anterior foi 0
  }, [currentPeriodSummary.expenses, prevPeriodSummary.expenses]);

  // 2. Insight: Previsão de Gasto Mensal (Projeção Linear)
  const spendingForecast = useMemo(() => {
    // Só calcula se estiver vendo o mês atual
    const now = new Date();
    if (periodType !== "current_month" || currentPeriodSummary.expenses <= 0)
      return null;

    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const today = now.getDate(); // Dia atual (1-31)
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate(); // Total de dias no mês

    if (today >= daysInMonth) return currentPeriodSummary.expenses; // Mês acabou, previsão é o gasto atual

    const dailyAverage = currentPeriodSummary.expenses / today;
    return Math.round(dailyAverage * daysInMonth);
  }, [periodType, currentPeriodSummary.expenses]);

  // 3. Insight: Categoria com Maior Aumento (Absoluto)
  const topSpendingIncreaseCategory = useMemo(() => {
    let maxIncrease = -Infinity;
    let categoryName: string | null = null;
    // Compara gasto atual vs anterior para cada categoria ATUAL
    currentCategorySpendingMap.forEach((currentSpent, category) => {
      const prevSpent = prevCategorySpendingMap.get(category) || 0;
      const increase = currentSpent - prevSpent;
      if (increase > 0 && increase > maxIncrease) {
        maxIncrease = increase;
        categoryName = category;
      }
    });
    // Considera categorias que existiam antes mas não agora (redução 100%) - opcional
    // prevCategorySpendingMap.forEach((prevSpent, category) => { ... });
    if (categoryName && maxIncrease > 0)
      return { name: categoryName, increase: maxIncrease };
    return null;
  }, [currentCategorySpendingMap, prevCategorySpendingMap]);

  // 5. Insight: Detalhes de Gastos por Categoria (Lista Ordenada)
  const categorySpendingList = useMemo(() => {
    return Array.from(currentCategorySpendingMap.entries())
      .map(([category, totalSpent]) => ({
        category,
        totalSpent,
        percentage:
          currentPeriodSummary.expenses > 0
            ? Math.round((totalSpent / currentPeriodSummary.expenses) * 100)
            : 0,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent); // Ordena por maior gasto
  }, [currentCategorySpendingMap, currentPeriodSummary.expenses]);

  // 6. Insight: Detalhes de Mudança de Gastos (Trend Analysis)
  const spendingChangesData = useMemo((): SpendingChange[] => {
    const changes: SpendingChange[] = [];
    const allCategories = new Set([
      ...currentCategorySpendingMap.keys(),
      ...prevCategorySpendingMap.keys(),
    ]); // Pega todas as categorias de ambos os períodos

    allCategories.forEach((category) => {
      const current = currentCategorySpendingMap.get(category) || 0;
      const previous = prevCategorySpendingMap.get(category) || 0;
      const changeAmount = current - previous;

      // Calcula percentual apenas se o gasto anterior não for zero
      let changePercent: number | null = null;
      if (previous !== 0) {
        changePercent = Math.round((changeAmount / previous) * 100);
      } else if (current > 0) {
        changePercent = Infinity; // Indica um aumento de 0 para >0
      }

      // Inclui na lista apenas se houve alguma mudança significativa (ou sempre?)
      // Critério de exemplo: mudança absoluta > R$ 10 ou percentual > 20%
      if (
        Math.abs(changeAmount) > 10 ||
        (changePercent !== null && Math.abs(changePercent) >= 20)
      ) {
        changes.push({
          category,
          current,
          previous,
          changeAmount,
          changePercent,
        });
      }
    });

    // Ordena por maior aumento absoluto
    changes.sort((a, b) => b.changeAmount - a.changeAmount);
    return changes;
  }, [currentCategorySpendingMap, prevCategorySpendingMap]);
  // ---------------------------------------

  // --- Renderização do Item de Gasto por Categoria ---
  const renderCategorySpendingItem = ({ item }: { item: CategorySpending }) => (
    <View style={styles.categoryItem}>
      <Text style={styles.categoryName}>{item.category}</Text>
      <View style={styles.categoryValues}>
        <Text style={styles.categorySpent}>
          {formatCurrency(item.totalSpent)}
        </Text>
        <Text style={styles.categoryPercentage}>({item.percentage}%)</Text>
      </View>
      <Progress.Bar
        progress={item.percentage ? item.percentage / 100 : 0}
        width={100} // Largura fixa pequena
        height={5}
        color={colors.primary}
        unfilledColor={colors.border + "50"}
        borderColor={"transparent"}
        borderRadius={3}
        style={{ marginLeft: 10 }} // Espaço antes da barra
      />
    </View>
  );

  const renderSpendingChangeItem = ({ item }: { item: SpendingChange }) => {
    const changeColor = item.changeAmount > 0 ? colors.error : colors.success + '80';
    const changeSign = item.changeAmount > 0 ? "+" : "";
    let percentString = "";
    if (item.changePercent === Infinity) percentString;
    else if (item.changePercent !== null)
      percentString = `${changeSign}${item.changePercent}%`;

    return (
      <View style={styles.trendItem}>
        <Text style={styles.trendCategory}>{item.category}</Text>
        <View style={styles.trendValues}>
          <Text style={styles.trendAmountCurrent}>
            Atual: {formatCurrency(item.current)}
          </Text>
          <Text style={styles.trendAmountPrevious}>
           Anterior: {formatCurrency(item.previous)}
          </Text>
          <Text style={[styles.trendAmountChange, { color: changeColor }]}>
            Diferença: {changeSign} {formatCurrency(item.changeAmount)} {percentString && (<Text>ou {percentString}</Text>)}
          </Text>
        </View>
      </View>
    );
  };
  // ------------------------------------------------------

  // --- Renderização Principal ---
  if (isLoadingGroup) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!groupId) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>Entre em um grupo.</Text>
      </View>
    );
  }

  const periodLabel = periodType === 'current_month' ? "Mês Atual" : "Mês Anterior";

  return (
    <ScrollView style={styles.container}>
      {/* Seletor de Período */}
      <View style={styles.periodSelector}>
        <TouchableOpacity
          style={[
            styles.periodButton,
            periodType === "last_month" && styles.periodButtonActive,
          ]}
          onPress={() => setPeriodType("last_month")}
        >
          <Text
            style={[
              styles.periodButtonText,
              periodType === "last_month" && styles.periodButtonTextActive,
            ]}
          >
            Mês Anterior
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.periodButton,
            periodType === "current_month" && styles.periodButtonActive,
          ]}
          onPress={() => setPeriodType("current_month")}
        >
          <Text
            style={[
              styles.periodButtonText,
              periodType === "current_month" && styles.periodButtonTextActive,
            ]}
          >
            Mês Atual
          </Text>
        </TouchableOpacity>

        {/* Adicionar botão para 'Intervalo Personalizado' no futuro */}
      </View>
      {/* Loading ou Conteúdo */}
      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 50 }}
        />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <>
          {/* --- Resumo com Insights --- */}
          <View style={styles.summaryContainer}>
            <SummaryCard
              label={`Variação Gasto`}
              value={spendingChangePercent}
              isPercentage={true}
              iconName={
                spendingChangePercent === null || spendingChangePercent === 0
                  ? "remove-outline"
                  : spendingChangePercent > 0
                  ? "trending-up-outline"
                  : "trending-down-outline"
              }
              iconColor={
                spendingChangePercent === null || spendingChangePercent === 0
                  ? colors.textSecondary
                  : spendingChangePercent > 0
                  ? colors.error
                  : colors.success
              }
              valueColor={
                spendingChangePercent === null || spendingChangePercent === 0
                  ? colors.textSecondary
                  : spendingChangePercent > 0
                  ? colors.error
                  : colors.success
              }
              style={styles.summaryCardStyle}
            />
            <SummaryCard
              label="Previsão Gasto Mês"
              value={spendingForecast}
              iconName="calculator-outline"
              iconColor={colors.primary}
              valueColor={colors.textPrimary}
              style={styles.summaryCardStyle}
            />
            <SummaryCard
              label="Maior Aumento"
              value={topSpendingIncreaseCategory?.increase}
              subText={topSpendingIncreaseCategory?.name ?? "N/A"}
              iconName="arrow-up-circle-outline"
              iconColor={
                topSpendingIncreaseCategory
                  ? colors.error
                  : colors.textSecondary
              }
              valueColor={
                topSpendingIncreaseCategory
                  ? colors.error
                  : colors.textSecondary
              }
              style={styles.summaryCardStyle}
            />
          </View>

          {/* Gastos por Categoria */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>
              Gastos por Categoria
            </Text>
            {categorySpendingList.length > 0 ? (
              <FlatList
                data={categorySpendingList}
                renderItem={renderCategorySpendingItem}
                keyExtractor={(item) => item.category}
                scrollEnabled={false}
              />
            ) : (
              <Text style={styles.noDataText}>Nenhum gasto neste período.</Text>
            )}
          </View>

            <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Padrões de Gastos</Text>
                <TemporalTrends
                    transactions={currentPeriodTransactions}
                    totalExpenses={currentPeriodSummary.expenses}
                />
            </View>

            <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Variação por Categoria</Text>
                    <CategorySpendingChange
                    currentSpendingMap={currentCategorySpendingMap}
                    previousSpendingMap={prevCategorySpendingMap}
                    isLoading={isFetchingCurrent || isFetchingPrevious} // Passa loading relevante
                    />
            </View>

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>
              Análise de Tendências
            </Text>
            {spendingChangesData.length > 0 ? (
              <FlatList
                data={spendingChangesData}
                renderItem={renderSpendingChangeItem}
                keyExtractor={(item) => item.category}
                scrollEnabled={false}
              />
            ) : (
              <Text style={styles.noDataText}>
                Sem dados suficientes para análise de tendências.
              </Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

// --- Estilos (Adiciona estilos para novas seções) ---
const getStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    periodSelector: {
      flexDirection: "row",
      justifyContent: "center",
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    periodButton: {
      paddingVertical: 8,
      paddingHorizontal: 20,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginHorizontal: 8,
    },
    periodButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    periodButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    periodButtonTextActive: {
      color: "#FFFFFF",
    },
    summaryContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      padding: 12,
    }, // Padding em volta
    summaryCardStyle: {
      width: "32%",
      paddingVertical: 10,
      paddingHorizontal: 5,
      marginBottom: 0,
    },
    sectionContainer: {
      marginHorizontal: 15,
      marginTop: 20,
      marginBottom: 10,
      padding: 15,
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 15,
    },
    noDataText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      paddingVertical: 15,
      fontStyle: "italic",
    },
    errorText: {
      color: colors.error,
      textAlign: "center",
      marginVertical: 15,
      paddingHorizontal: 15,
      fontSize: 15,
    },

    // Estilos para lista de Orçamento vs Gasto
    budgetItem: {
      backgroundColor: colors.background + "99",
      padding: 12,
      borderRadius: 8,
      marginBottom: 10,
    },
    budgetHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 6,
    },
    budgetName: {
      fontSize: 15,
      fontWeight: "bold",
      color: colors.textPrimary,
      flex: 1,
      marginRight: 8,
    },
    budgetCategories: {
      fontSize: 11,
      color: colors.textSecondary,
      fontStyle: "italic",
      marginBottom: 4,
    },
    budgetDetails: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 8,
      flexWrap: "wrap",
    },
    budgetText: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 3,
      marginRight: 10,
    },
    // Estilos para lista de Gastos por Categoria
    categoryItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + "80",
    },
    categoryName: {
      fontSize: 15,
      color: colors.textPrimary,
      flexShrink: 1,
      marginRight: 10,
    },
    categoryValues: { flexDirection: "row", alignItems: "baseline" },
    categorySpent: { fontSize: 15, fontWeight: "bold", color: colors.error },
    categoryPercentage: {
      fontSize: 12,
      color: colors.textSecondary,
      marginLeft: 5,
    },
    // Estilos para Análise de Tendências
    trendItem: {
      flexDirection: "column",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + "50",
    },
    trendCategory: {
      fontSize: 14,
      color: colors.textPrimary,
      flex: 1, // Ocupa espaço
      marginRight: 8,
    },
    trendValues: {
      flexDirection: "column",
      alignItems: "center", 
      justifyContent: "center", // Alinha à direita
    },
    trendAmountCurrent: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    trendAmountChange: {
      fontSize: 12,
    },
    trendAmountPrevious: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  });
