// app/transactions.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Platform,
  ScrollView, // Adicionado ScrollView para filtros
  Alert,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTheme } from "@/context/ThemeContext";
import { useGroup } from "@/context/GroupContext";
import { Ionicons } from "@expo/vector-icons";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { Transaction } from "@/types";
import TransactionListItem from "@/components/dashboard/TransactionListItem"; // <-- Usa o componente reutilizável
import AddTransactionModal from "@/components/dashboard/AddTransactionModal"; // Para Edição
import TransactionDetailModal from "@/components/dashboard/TransactionDetailModal"; // Para Detalhes

export default function AllTransactionsScreen() {
  const { colors } = useTheme();
  const { groupId, groupData, isLoadingGroup } = useGroup(); // Pega dados do grupo
  const router = useRouter(); // Para navegação futura, se necessário
  const currentUser = auth.currentUser;

  // --- Estados ---
  const [rawTransactions, setRawTransactions] = useState<Transaction[]>([]); // Transações brutas
  const [isLoading, setIsLoading] = useState(true);
  // Filtros
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<
    "all" | "income" | "expense"
  >("all");
  const [transactionSearchQuery, setTransactionSearchQuery] = useState("");
  // Modais
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false); // Para edição via AddTransactionModal
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  // ----------------

  // --- Listener para TODAS as Transações ---
  useEffect(() => {
    if (!groupId) {
      setRawTransactions([]);
      setIsLoading(false);
      return () => {};
    }
    if (!isLoadingGroup) setIsLoading(true);

    console.log(
      "AllTransactionsScreen: Setting up listener for group:",
      groupId
    );
    const transQuery = query(
      collection(db, "groups", groupId, "transactions"),
      orderBy("date", "desc") // Ordena por data no Firestore (REQUER ÍNDICE date Desc)
    );

    const unsubscribe = onSnapshot(
      transQuery,
      (snapshot) => {
        const fetched: Transaction[] = [];
        snapshot.forEach((doc) => {
          /* ... preenche fetched como antes ... */
          const data = doc.data();
          if (
            data.value !== undefined &&
            data.type &&
            data.category &&
            data.userId &&
            data.date &&
            data.createdAt
          ) {
            fetched.push({ id: doc.id, ...data } as Transaction);
          }
        });
        console.log(
          `AllTransactionsScreen: Fetched ${fetched.length} transactions.`
        );
        setRawTransactions(fetched); // Guarda transações brutas ordenadas pelo Firestore
        setIsLoading(false);
      },
      (error) => {
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [groupId, isLoadingGroup]);

  // --- Lógica de Filtragem (useMemo) ---
  const filteredTransactions = useMemo(() => {
    console.log(
      "AllTransactionsScreen: Recalculating filtered transactions..."
    );
    let itemsToFilter = [...rawTransactions]; // Usa a lista bruta ordenada por data

    // 1. Filtra por Tipo
    if (transactionTypeFilter !== "all") {
      itemsToFilter = itemsToFilter.filter(
        (t) => t.type === transactionTypeFilter
      );
    }
    // 2. Filtra por Categorias
    if (selectedCategories.length > 0) {
      itemsToFilter = itemsToFilter.filter((t) =>
        selectedCategories.includes(t.category)
      );
    }
    // 3. Filtra por Busca de Texto
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
    rawTransactions,
    selectedCategories,
    transactionTypeFilter,
    transactionSearchQuery,
  ]);
  
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
    console.log("Deleting transaction:", transactionId);
    const transDocRef = doc(
      db,
      "groups",
      groupId,
      "transactions",
      transactionId
    );
    try {
      await deleteDoc(transDocRef);
      handleCloseDetailModal();
      Alert.alert("Sucesso", "Transação excluída.");
    } catch (error) {
    }
  };
  
  const ListHeader = () => (
    <View style={styles.filtersSection}>
      <View style={styles.typeFilterContainer}>
        <TouchableOpacity
          style={[
            styles.typeFilterButton,
            styles.typeFilterButtonSegmented,
            styles.typeFilterButtonLeft,
            transactionTypeFilter === "all" && styles.typeFilterButtonActive,
          ]}
          onPress={() => setTransactionTypeFilter("all")}
        >
          <Text
            style={[
              styles.typeFilterButtonText,
              transactionTypeFilter === "all" &&
                styles.typeFilterButtonTextActive,
            ]}
          >
            Todas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.typeFilterButton,
            styles.typeFilterButtonSegmented,
            transactionTypeFilter === "income" && styles.typeFilterButtonActive,
          ]}
          onPress={() => setTransactionTypeFilter("income")}
        >
          <Text
            style={[
              styles.typeFilterButtonText,
              transactionTypeFilter === "income" &&
                styles.typeFilterButtonTextActive,
            ]}
          >
            Entradas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.typeFilterButton,
            styles.typeFilterButtonSegmented,
            styles.typeFilterButtonRight,
            transactionTypeFilter === "expense" &&
              styles.typeFilterButtonActive,
          ]}
          onPress={() => setTransactionTypeFilter("expense")}
        >
          <Text
            style={[
              styles.typeFilterButtonText,
              transactionTypeFilter === "expense" &&
                styles.typeFilterButtonTextActive,
            ]}
          >
            Saídas
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={18}
          color={colors.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por categoria ou descrição..."
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
        )}{" "}
      </View>
      <View style={styles.filterContainer}>
        <Text style={styles.filterTitle}>Filtrar por Categoria:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChips}
        >
          <TouchableOpacity
              onPress={() =>
              handleCategoryFilterChange("Todas")
            }
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
              Todas
            </Text>
          </TouchableOpacity>
          {(groupData?.categories || [])
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

  const styles = getStyles(colors);

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
        <Stack.Screen
          options={{ title: "Todas as transações", headerShown: true, headerStyle: { backgroundColor: colors.bottomSheet }, headerTintColor: colors.textPrimary }}
        />
        <Text style={styles.emptyText}>Grupo não encontrado.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: "Todas as transações", headerShown: true, headerStyle: { backgroundColor: colors.bottomSheet }, headerTintColor: colors.textPrimary }}
      />
      
      <ListHeader />
      
      <FlatList
        data={filteredTransactions} 
        renderItem={(
          { item }
        ) => (
          <TransactionListItem item={item} onPress={handleTransactionPress} />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isLoading ? ( 
            <View style={styles.centered}>
              <Ionicons
                name="receipt-outline"
                size={60}
                color={colors.textSecondary}
                style={{ marginTop: 30 }}
              />
              <Text style={styles.emptyTitle}>
                {transactionSearchQuery ||
                selectedCategories.length > 0 ||
                transactionTypeFilter !== "all"
                  ? "Nenhuma Transação Encontrada"
                  : "Sem Transações"}
              </Text>
              <Text style={styles.emptyText}>
                {transactionSearchQuery ||
                selectedCategories.length > 0 ||
                transactionTypeFilter !== "all"
                  ? "Nenhuma transação corresponde aos filtros aplicados."
                  : "Registre sua primeira entrada ou saída."}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoading ? (
            <ActivityIndicator style={{ margin: 20 }} color={colors.primary} />
          ) : null
        }
      />

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
    container: { flex: 1, backgroundColor: colors.background, paddingVertical: 16 },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    listContent: { paddingHorizontal: 15, paddingTop: 0, paddingBottom: 20 }, 
    emptyTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginTop: 15,
      marginBottom: 5,
      textAlign: "center",
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      paddingHorizontal: 20,
    },
    filtersSection: {
      paddingBottom: 10,
      marginBottom: 5,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: 15,
    },
    typeFilterContainer: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginBottom: 15,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      overflow: "hidden",
    },
    typeFilterButton: { flex: 1, paddingVertical: 10, alignItems: "center" },
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
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 8,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 15,
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
      flex: 1,
      height: 40,
      fontSize: 15,
      color: colors.textPrimary,
    },
    clearButton: { padding: 5 },
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
      borderRadius: 15,
      marginRight: 8,
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
