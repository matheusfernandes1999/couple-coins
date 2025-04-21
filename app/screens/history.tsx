// app/history.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Alert,
  RefreshControl,
  TextInput,
  ScrollView,
} from "react-native";
import { Stack } from "expo-router";
import { useTheme } from "@/context/ThemeContext";
import { useGroup } from "@/context/GroupContext";
import { Ionicons } from "@expo/vector-icons";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  Timestamp,
  getDocs,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { Transaction, FinancialSummary } from "@/types";
import TransactionListItem from "@/components/dashboard/TransactionListItem";
import SummaryCard from "@/components/dashboard/SummaryCard";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import AddTransactionModal from "@/components/dashboard/AddTransactionModal";
import TransactionDetailModal from "@/components/dashboard/TransactionDetailModal";

const getMonthBounds = (
  year: number,
  month: number
): { start: Date; end: Date } => {
  const start = new Date(year, month - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
};
const formatMonthYear = (date: Date): string => {
  const month = date.toLocaleDateString("pt-BR", { month: "long" });
  const year = date.toLocaleDateString("pt-BR", { year: "numeric" });
  return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
};
export default function HistoryScreen() {
  const { colors } = useTheme();
  const { groupId, groupData, isLoadingGroup } = useGroup();
  const styles = getStyles(colors);
  const [mode, setMode] = useState<"month" | "range">("month");
  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date());
  const [startDate, setStartDate] = useState<Date>(
    () =>
      getMonthBounds(new Date().getFullYear(), new Date().getMonth() + 1).start
  );
  const [endDate, setEndDate] = useState<Date>(
    () =>
      getMonthBounds(new Date().getFullYear(), new Date().getMonth() + 1).end
  );
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [periodSummary, setPeriodSummary] = useState<FinancialSummary>({
    income: 0,
    expenses: 0,
    balance: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<
    "all" | "income" | "expense"
  >("all");
  const [transactionSearchQuery, setTransactionSearchQuery] = useState("");
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);

    const handleCycleTransactionTypeFilter = () => {
        setTransactionTypeFilter(currentFilter => {
            if (currentFilter === 'all') return 'income';
            if (currentFilter === 'income') return 'expense';
            return 'all';
        });
    };

  useEffect(() => {
    if (mode === "month") {
      const bounds = getMonthBounds(
        currentMonthDate.getFullYear(),
        currentMonthDate.getMonth() + 1
      );
      if (
        startDate.getTime() !== bounds.start.getTime() ||
        endDate.getTime() !== bounds.end.getTime()
      ) {
        setStartDate(bounds.start);
        setEndDate(bounds.end);
      }
    }
  }, [currentMonthDate, mode, startDate, endDate]);

  const fetchTransactions = useCallback(async () => {
    if (!groupId || !startDate || !endDate || isLoadingGroup) {
      if (!isLoadingGroup) {
        setTransactions([]);
        setPeriodSummary({ income: 0, expenses: 0, balance: 0 });
        setIsLoading(false);
        setIsRefreshing(false);
      }
      return;
    }
    if (endDate < startDate) {
      setError("Data final anterior à inicial.");
      setTransactions([]);
      setPeriodSummary({ income: 0, expenses: 0, balance: 0 });
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (!isRefreshing) setIsLoading(true);
    setError(null);

    try {
      const startTimestamp = Timestamp.fromDate(startDate);
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      const endTimestamp = Timestamp.fromDate(endOfDay);

      const transQuery = query(
        collection(db, "groups", groupId, "transactions"),
        where("date", ">=", startTimestamp),
        where("date", "<=", endTimestamp)
      );

      const querySnapshot = await getDocs(transQuery);
      const fetchedTransactions: Transaction[] = [];
      let income = 0;
      let expenses = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (
          data.value !== undefined &&
          data.type &&
          data.category &&
          data.userId &&
          data.date &&
          data.createdAt
        ) {
          const transaction = { id: doc.id, ...data } as Transaction;
          fetchedTransactions.push(transaction);
          if (transaction.type === "income") income += transaction.value;
          else if (transaction.type === "expense")
            expenses += transaction.value;
        } else {
          
        }
      });

      setTransactions(fetchedTransactions);
      setPeriodSummary({ income, expenses, balance: income - expenses });
    } catch (error: any) {
      if (error.code === "failed-precondition") {
        setError("Índice do Firestore necessário (campo 'date' descendente).");
      } else {
        setError("Não foi possível carregar as transações.");
      }
      setTransactions([]);
      setPeriodSummary({ income: 0, expenses: 0, balance: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [groupId, startDate, endDate, isLoadingGroup]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filteredTransactions = useMemo(() => {
    let itemsToFilter = [...transactions];
    if (transactionTypeFilter !== "all") {
      itemsToFilter = itemsToFilter.filter(
        (t) => t.type === transactionTypeFilter
      );
    }
    if (selectedCategories.length > 0) {
      itemsToFilter = itemsToFilter.filter((t) =>
        selectedCategories.includes(t.category)
      );
    }
    const queryLower = transactionSearchQuery.toLowerCase();
    if (queryLower.length > 0) {
      itemsToFilter = itemsToFilter.filter(
        (t) =>
          t.category.toLowerCase().includes(queryLower) ||
          t.description?.toLowerCase().includes(queryLower)
      );
    }
    return itemsToFilter;
  }, [
    transactions,
    selectedCategories,
    transactionTypeFilter,
    transactionSearchQuery,
  ]);

  const handleStartDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    setShowStartDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      if (endDate && selectedDate > endDate) {
        Alert.alert("Data Inválida", "Início > Fim.");
        return;
      }
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      setStartDate(startOfDay);
    }
    if (Platform.OS === "android") setShowStartDatePicker(false);
  };
  const handleEndDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    setShowEndDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      if (startDate && selectedDate < startDate) {
        Alert.alert("Data Inválida", "Fim < Início.");
        return;
      }
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      setEndDate(endOfDay);
    }
    if (Platform.OS === "android") setShowEndDatePicker(false);
  };
  const goToPreviousMonth = () => {
    setCurrentMonthDate((d) => {
      const n = new Date(d);
      n.setDate(1);
      n.setMonth(d.getMonth() - 1);
      return n;
    });
  };
  const goToNextMonth = () => {
    setCurrentMonthDate((prevDate) => {
      const n = new Date(prevDate);
      n.setDate(1);
      n.setMonth(prevDate.getMonth() + 1);
      const today = new Date();
      const currentActualMonth = today.getMonth();
      const currentActualYear = today.getFullYear();
      if (
        n.getFullYear() > currentActualYear ||
        (n.getFullYear() === currentActualYear &&
          n.getMonth() > currentActualMonth)
      ) {
        return prevDate;
      }
      return n;
    });
  };
  const isNextMonthDisabled = useMemo(() => {
    const nextMonthChecker = new Date(currentMonthDate);
    nextMonthChecker.setDate(1);
    nextMonthChecker.setMonth(currentMonthDate.getMonth() + 1);
    const today = new Date();
    return (
      nextMonthChecker.getFullYear() > today.getFullYear() ||
      (nextMonthChecker.getFullYear() === today.getFullYear() &&
        nextMonthChecker.getMonth() > today.getMonth())
    );
  }, [currentMonthDate]);
  const handleCategoryFilterChange = (category: string) => {
    setSelectedCategories((prev) =>
      category === "Todas"
        ? []
        : prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };
  const handleTransactionPress = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDetailModalVisible(true);
  };
  const handleCloseDetailModal = () => {
    setIsDetailModalVisible(false);
    setSelectedTransaction(null);
  };
  const closeAddEditModal = () => {
    setIsAddModalVisible(false);
    setEditingTransaction(null);
  };
  const handleEditTransaction = (transaction: Transaction) => {
    handleCloseDetailModal();
    setEditingTransaction(transaction);
    setIsAddModalVisible(true);
  };
  const handleDeleteTransaction = async (transactionId: string) => {
    if (!groupId) return;
    const docRef = doc(db, "groups", groupId, "transactions", transactionId);
    try {
      await deleteDoc(docRef);
      handleCloseDetailModal();
      Alert.alert("Sucesso", "Excluído.");
      setTransactions((p) => p.filter((t) => t.id !== transactionId));
    } catch (e) {
      Alert.alert("Erro", "Falha ao excluir.");
      console.error(e);
    }
  };

  const onRefresh = useCallback(async () => {
    if (!groupId) {
      setIsRefreshing(false);
      return;
    }
    setIsRefreshing(true);
    setError(null);
    try {
      await fetchTransactions();
    } catch (e) {
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchTransactions, groupId]);

  const toggleDateSelectionMode = () => {
    setMode(prevMode => prevMode === 'month' ? 'range' : 'month');
  };

  let typeFilterText = 'Todas';
  let typeFilterIcon: React.ComponentProps<typeof Ionicons>['name'] = 'chevron-collapse-outline';
  let valueColor = '#ffbf00';

  if (transactionTypeFilter === 'income') {
    typeFilterText = 'Entradas';
    typeFilterIcon = 'arrow-up-circle';
    valueColor = colors.success;
  } else if (transactionTypeFilter === 'expense') {
    typeFilterText = 'Saídas';
    typeFilterIcon = 'arrow-down-circle';
    valueColor = colors.error;
  }

  const ListFilterHeader = useCallback(() => {
    const availableCategories = groupData?.categories || [];
    return (
      <View style={styles.filtersSection}>
        <View style={styles.filterContainer}>
          <Text style={styles.filterTitle}>Filtrar por Categoria:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChips}
          >
            <TouchableOpacity
              onPress={() => handleCategoryFilterChange("Todas")}
              style={[
                styles.chip,
                selectedCategories.length === 0
                  ? styles.chipSelected
                  : styles.chipIdle,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedCategories.length === 0
                    ? styles.chipTextSelected
                    : styles.chipTextIdle,
                ]}
              >
                Todas.
              </Text>
            </TouchableOpacity>
            {availableCategories
              .sort((a, b) => a.localeCompare(b))
              .map((cat: string) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => handleCategoryFilterChange(cat)}
                  style={[
                    styles.chip,
                    selectedCategories.includes(cat)
                      ? styles.chipSelected
                      : styles.chipIdle,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedCategories.includes(cat)
                        ? styles.chipTextSelected
                        : styles.chipTextIdle,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View>
      </View>
    );
  }, [
    groupData,
    colors,
    transactionTypeFilter,
    selectedCategories,
    handleCategoryFilterChange,
  ]);

  const renderTransactionItem = ({ item }: { item: Transaction }) => (
    <TransactionListItem item={item} onPress={handleTransactionPress} />
  );

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
        <Stack.Screen options={{ title: "Histórico" }} />
        <Text style={styles.emptyText}>Grupo não encontrado.</Text>
      </View>
    );
  }
  if (!groupData && !isLoadingGroup) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const getBalanceColor = (balance: number) =>
    balance >= 0 ? colors.success : colors.error;

  return (
    <View style={styles.container}>
        <Stack.Screen
            options={{
                title: "Todas as transações",
                headerShown: true,
                headerStyle: { backgroundColor: colors.bottomSheet },
                headerTintColor: colors.textPrimary,
            }}
        />

        <View style={styles.periodSelectorContainer}>
            <View style={styles.dateControlRow}>
                    <View style={styles.dateControlWrapper}>
                        {mode === 'month' ? (
                            <View style={styles.monthNavigator}>
                                <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}><Ionicons name="chevron-back" size={28} color={colors.primary} /></TouchableOpacity>
                                <TouchableOpacity><Text style={styles.monthYearText}>{formatMonthYear(currentMonthDate)}</Text></TouchableOpacity>
                                <TouchableOpacity onPress={goToNextMonth} style={styles.navButton} disabled={isNextMonthDisabled} ><Ionicons name="chevron-forward" size={28} color={colors.primary} style={isNextMonthDisabled ? { opacity: 0.3 } : {}}/></TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.rangeSelector}>
                                <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartDatePicker(true)}>
                                    <Text style={styles.dateButtonText}>{startDate.toLocaleDateString('pt-BR')}</Text>
                                    <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                                <Text style={styles.dateSeparator}>até</Text>
                                <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndDatePicker(true)}>
                                    <Text style={styles.dateButtonText}>{endDate.toLocaleDateString('pt-BR')}</Text>
                                    <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                    <TouchableOpacity onPress={toggleDateSelectionMode} style={styles.modeToggleButton}>
                        <Ionicons name={mode === 'month' ? "swap-horizontal" : "swap-horizontal"} size={24} color={colors.primary} />
                    </TouchableOpacity>
            </View>
        </View>

      <View style={styles.summaryContainer}>
        <SummaryCard
          label="Entradas"
          value={periodSummary.income}
          iconName="arrow-up-circle-outline"
          iconColor={colors.success}
          valueColor={colors.success}
          style={styles.summaryCardStyle}
        />
        <SummaryCard
          label="Saídas"
          value={periodSummary.expenses}
          iconName="arrow-down-circle-outline"
          iconColor={colors.error}
          valueColor={colors.error}
          style={styles.summaryCardStyle}
        />
        <SummaryCard
          label="Balanço"
          value={periodSummary.balance}
          iconName="wallet-outline"
          iconColor={colors.primary}
          valueColor={getBalanceColor(periodSummary.balance)}
          style={styles.summaryCardStyle}
        />
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
        
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-around", gap: 18, width: "80%", marginHorizontal: 15, paddingHorizontal: 10, backgroundColor: colors.bottomSheet, borderRadius: 8, marginBottom: 10 }}>
        <View style={[styles.outerSearchContainer]}>
        <Ionicons
          name="search"
          size={18}
          color={colors.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar categoria ou descrição..."
          placeholderTextColor={colors.placeholder}
          value={transactionSearchQuery}
          onChangeText={setTransactionSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {transactionSearchQuery.length > 0 && Platform.OS !== "ios" && (
          <TouchableOpacity
            onPress={() => setTransactionSearchQuery("")}
            style={styles.clearButton}
          >
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
        </View>
        <View style={styles.singleFilterLine}>
            <TouchableOpacity style={[styles.cycleFilterButton, { backgroundColor: valueColor + '20'}]} onPress={handleCycleTransactionTypeFilter}>
                <Ionicons name={typeFilterIcon} size={18} color={valueColor} />
            </TouchableOpacity>
        </View>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={filteredTransactions}
        renderItem={renderTransactionItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListFilterHeader}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.centeredEmptyList}>
              <Ionicons
                name="receipt-outline"
                size={50}
                color={colors.textSecondary}
                style={{ marginBottom: 15 }}
              />
              <Text style={styles.emptyTitle}>
                {selectedCategories.length > 0 ||
                transactionTypeFilter !== "all"
                  ? "Nenhuma Transação Encontrada"
                  : "Sem Transações no Período"}
              </Text>
              <Text style={styles.emptyText}>
                {selectedCategories.length > 0 ||
                transactionTypeFilter !== "all"
                  ? "Nenhuma transação corresponde aos filtros aplicados."
                  : "Não há registros para as datas selecionadas."}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoading ? (
            <ActivityIndicator
              style={{ marginVertical: 20 }}
              color={colors.primary}
            />
          ) : null
        }
        keyboardShouldPersistTaps="always"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={11}
      />

      {showStartDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={handleStartDateChange}
          maximumDate={endDate || new Date()}
        />
      )}
      {showEndDatePicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="default"
          onChange={handleEndDateChange}
          minimumDate={startDate}
          maximumDate={new Date()}
        />
      )}

      <AddTransactionModal
        isVisible={isAddModalVisible}
        onClose={closeAddEditModal}
        groupId={groupId}
        existingCategories={groupData?.categories || []}
        transactionToEdit={editingTransaction}
      />
      <TransactionDetailModal
        isVisible={isDetailModalVisible}
        onClose={handleCloseDetailModal}
        transaction={selectedTransaction}
        onEdit={handleEditTransaction}
        onDelete={handleDeleteTransaction}
      />
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    dateControlRow: { 
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dateControlWrapper: {
        flex: 1,
        marginRight: 10,
    },
    modeToggleButton: {
        padding: 8,
    },
    container: { flex: 1, backgroundColor: colors.background },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    centeredEmptyList: { alignItems: "center", padding: 30, marginTop: 20 },
    listContent: { paddingBottom: 20 },
    periodSelectorContainer: {
      paddingVertical: 8,
      paddingHorizontal: 4,
      backgroundColor: colors.bottomSheet,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 10,
    },
    modeSelector: {
      flexDirection: "row",
      justifyContent: "center",
      marginBottom: 15,
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      overflow: "hidden",
    },
    modeButton: { flex: 1, paddingVertical: 10, alignItems: "center" },
    modeButtonActive: { backgroundColor: colors.primary },
    modeButtonText: { fontSize: 14, fontWeight: "600", color: colors.primary },
    modeButtonTextActive: { color: "#FFF" },
    monthNavigator: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    navButton: { padding: 5 },
    monthYearText: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    rangeSelector: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    dateButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 10,
      backgroundColor: colors.background,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    dateButtonText: { fontSize: 14, color: colors.textPrimary },
    dateSeparator: { marginHorizontal: 10, color: colors.textSecondary },
    summaryContainer: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingHorizontal: 10,
      marginBottom: 15,
      marginTop: 5,
    },
    summaryCardStyle: {
      width: "32%",
      paddingVertical: 10,
      paddingHorizontal: 5,
      marginBottom: 0,
    },
    errorText: {
      color: colors.error,
      textAlign: "center",
      marginVertical: 10,
      paddingHorizontal: 15,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginTop: 15,
      marginBottom: 8,
      textAlign: "center",
    },
    emptyText: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: "center",
    },
    outerSearchContainer: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
      height: 48,
      fontSize: 15,
      color: colors.textPrimary,
      width: "100%",
    },
    clearButton: { padding: 5 },
    filtersSection: {
      paddingBottom: 10,
      marginHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + "80",
      marginBottom: 10,
    },
     singleFilterLine: { // Para alinhar título e botão de ciclo
        flexDirection: 'row',
        alignItems: 'center',
     },
     cycleFilterButton: { // Botão que alterna Todas/Entradas/Saídas
      padding: 12,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
     },
     cycleFilterButtonText: {
         fontSize: 13,
         fontWeight: '500',
         color: colors.primary,
     },
    typeFilterButtonSegmented: {
      borderColor: colors.primary,
      borderLeftWidth: 0.5,
      borderRightWidth: 0.5,
    },
    typeFilterButtonLeft: { borderLeftWidth: 0 },
    typeFilterButtonRight: { borderRightWidth: 0 },
    typeFilterButtonActive: { backgroundColor: colors.primary },
    typeFilterButtonText: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.primary,
    },
    typeFilterButtonTextActive: { color: "#FFFFFF", fontWeight: "bold" },
    filterContainer: { marginBottom: 0 },
    filterTitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 10,
    },
    filterChips: {
      flexDirection: "row",
      alignItems: "center",
      paddingBottom: 5,
    },
    chip: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 8,
      marginRight: 4,
      borderWidth: 1,
    },
    chipIdle: { backgroundColor: colors.surface, borderColor: colors.border },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: { fontSize: 12 },
    chipTextIdle: { color: colors.textSecondary },
    chipTextSelected: { color: "#FFFFFF", fontWeight: "bold" },
  });
