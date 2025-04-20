// app/(tabs)/budget.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useGroup } from '../../context/GroupContext';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../lib/firebase';
import { collection, query, onSnapshot, orderBy, where, doc, deleteDoc, Timestamp, increment, serverTimestamp, updateDoc } from 'firebase/firestore'; // Add deleteDoc, increment
import { BudgetData, Transaction } from '@/types';
import AddBudgetModal from '@/components/budget/AddBudgetModal'; // Ajuste o caminho
import BudgetListItem from '@/components/budget/BudgetListItem'; // Ajuste o caminho
import AddTransactionFAB from '@/components/dashboard/AddTransactionFAB';
import { getMonthYear } from '@/utils/helpers';

// Interface para as seções
interface BudgetSection {
    title: string;
    data: BudgetData[];
}

export default function BudgetScreen() {
  const { colors } = useTheme();
  const { groupId, groupData, isLoadingGroup } = useGroup(); // Pega groupData para categorias
  const currentUser = auth.currentUser;

  // --- Estados ---
  const [allBudgets, setAllBudgets] = useState<BudgetData[]>([]); // Todos os orçamentos/metas do grupo
  const [transactionsMonth, setTransactionsMonth] = useState<Transaction[]>([]); // Transações do mês atual
  const [isLoadingBudgets, setIsLoadingBudgets] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false); // Loading separado para transações
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetData | null>(null);
  // ----------------

  const currentMonthYear = useMemo(() => getMonthYear(new Date()), []); // Calcula mês/ano atual uma vez

  // --- Listener para Orçamentos/Metas ---
  useEffect(() => {
    if (!groupId) {
        setAllBudgets([]);
        setIsLoadingBudgets(false);
        return () => {};
    }
    if (!isLoadingGroup) setIsLoadingBudgets(true);

    console.log("BudgetScreen: Setting up budgets listener for group:", groupId);
    const budgetsQuery = query(
        collection(db, "groups", groupId, "budgets")
        // TODO: Adicionar where('isArchived', '==', false) se implementar arquivamento
        // orderBy('type', 'asc'), // Opcional: Ordenar por tipo (goal/monthly)
        // orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(budgetsQuery, (snapshot) => {
        const fetchedBudgets: BudgetData[] = [];
        snapshot.forEach(doc => fetchedBudgets.push({ id: doc.id, ...doc.data() } as BudgetData));
        console.log(`BudgetScreen: Fetched ${fetchedBudgets.length} budgets/goals.`);
        setAllBudgets(fetchedBudgets);
        setIsLoadingBudgets(false);
    }, (error) => {
        console.error("BudgetScreen: Error listening to budgets:", error);
        Alert.alert("Erro", "Não foi possível carregar orçamentos/metas.");
        setIsLoadingBudgets(false);
    });

    return () => unsubscribe();
  }, [groupId, isLoadingGroup]);


   // --- Listener para Transações do Mês ATUAL (para cálculo de gastos) ---
   useEffect(() => {
    if (!groupId) {
        setTransactionsMonth([]);
        setIsLoadingTransactions(false);
        return () => {};
    }

    // Só busca transações se já não estiver carregando
    if (!isLoadingGroup && !isLoadingBudgets) setIsLoadingTransactions(true);

    console.log("BudgetScreen: Setting up transactions listener for month:", currentMonthYear);

    const startOfMonth = Timestamp.fromDate(new Date(parseInt(currentMonthYear.substring(0, 4)), parseInt(currentMonthYear.substring(5, 7)) - 1, 1));
    const endOfMonth = Timestamp.fromDate(new Date(parseInt(currentMonthYear.substring(0, 4)), parseInt(currentMonthYear.substring(5, 7)), 0, 23, 59, 59));

    const transQuery = query(
        collection(db, "groups", groupId, "transactions"),
        where("type", "==", "expense")
    );

    const unsubscribe = onSnapshot(transQuery, (snapshot) => {
        const fetchedTransactions: Transaction[] = [];
        snapshot.forEach(doc => fetchedTransactions.push({ id: doc.id, ...doc.data() } as Transaction));
        console.log(`BudgetScreen: Fetched ${fetchedTransactions.length} transactions for the month.`);
        setTransactionsMonth(fetchedTransactions);
        setIsLoadingTransactions(false);
    }, (error) => {
        console.error("BudgetScreen: Error listening to monthly transactions:", error);
        // Não mostra alerta aqui para não ser muito intrusivo, mas loga
        setIsLoadingTransactions(false);
    });

    return () => unsubscribe();

  }, [groupId, currentMonthYear, isLoadingGroup, isLoadingBudgets]); // Depende do grupo e do mês atual


  // --- Processamento para SectionList e Cálculo de Gastos ---
   const budgetSections = useMemo((): BudgetSection[] => {
    console.log("Recalculating budget sections...");
    const monthly: BudgetData[] = [];
    const goals: BudgetData[] = [];
    const spentByCategory: { [category: string]: number } = {}; // Cache de gastos

    // Calcula gastos totais por categoria do mês atual
    transactionsMonth.forEach(t => {
        if (t.category) {
            spentByCategory[t.category] = (spentByCategory[t.category] || 0) + t.value;
        }
    });

    // Separa orçamentos/metas e adiciona gastos calculados
    allBudgets.forEach(b => {
        if (b.type === 'monthly' && b.monthYear === currentMonthYear) { // Apenas mês atual
             // Adiciona o gasto calculado ao item antes de passar para o componente filho
             const budgetWithSpent = { ...b, spentAmount: spentByCategory[b.category || ''] || 0 };
             monthly.push(budgetWithSpent);
        } else if (b.type === 'goal') {
             goals.push(b);
        }
    });

    // Ordena metas (ex: por data alvo, mais próxima primeiro, nulls por último)
    goals.sort((a, b) => (a.targetDate?.toMillis() || Infinity) - (b.targetDate?.toMillis() || Infinity));
    // Ordena orçamentos mensais (ex: alfabeticamente)
    monthly.sort((a, b) => a.name.localeCompare(b.name));

    const sections: BudgetSection[] = [];
    if (monthly.length > 0) sections.push({ title: `Orçamento de ${new Date().toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'})}`, data: monthly });
    if (goals.length > 0) sections.push({ title: "Metas de Poupança", data: goals });

    return sections;

  }, [allBudgets, transactionsMonth, currentMonthYear]); // Depende dos dados brutos


  // --- Handlers ---
  const handleEditBudget = (budget: BudgetData) => {
      console.log("Editing budget/goal:", budget.id);
      setEditingBudget(budget);
      setIsModalVisible(true);
  };

  const handleDeleteBudget = async (budgetId: string) => {
      if (!groupId) return;
      // Confirmação é feita no componente filho
      console.log("Deleting budget/goal:", budgetId);
      const budgetDocRef = doc(db, "groups", groupId, "budgets", budgetId);
      try {
          await deleteDoc(budgetDocRef);
          Alert.alert("Sucesso", "Orçamento/Meta excluído.");
      } catch (error) {
          console.error("Error deleting budget/goal:", error);
          Alert.alert("Erro", "Não foi possível excluir o item.");
      }
  };

   // Handler para adicionar poupança (passado para BudgetListItem)
   const handleAddSavings = async (budgetId: string, amountToAdd: number) => {
      if (!groupId || !currentUser || amountToAdd <= 0) return;
      console.log(`Adding ${amountToAdd} to goal ${budgetId}`);
      const budgetDocRef = doc(db, "groups", groupId, "budgets", budgetId);
      try {
          await updateDoc(budgetDocRef, {
              amountSaved: increment(amountToAdd), // Incrementa atomicamente
              updatedAt: serverTimestamp()
          });
          // O listener onSnapshot atualizará a UI. Feedback opcional:
          // Alert.alert("Sucesso", `${amountToAdd.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})} adicionado à meta!`);
      } catch (error) {
          console.error("Error adding savings:", error);
          Alert.alert("Erro", "Não foi possível adicionar o valor à meta.");
      }
  };


  // Fecha modal e limpa edição
  const closeModal = () => {
      setIsModalVisible(false);
      setEditingBudget(null);
  };

  // --- Renderização ---
  const styles = getStyles(colors);

  if (isLoadingGroup || isLoadingBudgets) {
      return ( <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={colors.primary} /></View> );
  }
  if (!groupId) {
      return (
            <View style={[styles.container, styles.centered]}>
                <Ionicons name="alert-circle-outline" size={60} color={colors.textSecondary} style={styles.icon} />
                <Text style={styles.title}>Sem Grupo</Text>
                <Text style={styles.subtitle}>Você precisa estar em um grupo para usar o inventário.</Text>
            </View>
      );
  }

  return (
    <View style={styles.container}>
       {/* Usa SectionList para agrupar */}
        {budgetSections.length === 0 ? (
            <View style={styles.centered}>
                <Ionicons name="wallet-outline" size={60} color={colors.textSecondary} style={styles.icon}/>
                <Text style={styles.title}>Sem Orçamentos ou Metas</Text>
                <Text style={styles.subtitle}>Crie seu primeiro orçamento ou meta de poupança no botão (+).</Text>
            </View>
        ) : (
            <SectionList
                sections={budgetSections}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <BudgetListItem
                        item={item}
                        groupId={groupId}
                        // Passa o gasto calculado APENAS para itens mensais
                        // A prop 'spentAmount' foi removida do BudgetListItem, ele busca internamente
                        onEdit={() => handleEditBudget(item)}
                        onDelete={handleDeleteBudget} // Passa handler correto
                        //onAddSavings={handleAddSavings} // Passa handler para adicionar poupança
                    />
                )}
                renderSectionHeader={({ section: { title } }) => (
                    <Text style={styles.sectionHeader}>{title}</Text>
                )}
                contentContainerStyle={styles.listContent}
                stickySectionHeadersEnabled={false} // Opcional
                 ListFooterComponent={isLoadingTransactions ? <ActivityIndicator style={{ margin: 20 }} color={colors.primary} /> : null} // Loading das transações
            />
        )}

      {/* FAB para Adicionar Orçamento/Meta */}
      <AddTransactionFAB onPress={() => { setEditingBudget(null); setIsModalVisible(true); }} />

      {/* Modal para Adicionar/Editar */}
      <AddBudgetModal
        isVisible={isModalVisible}
        onClose={closeModal}
        groupId={groupId}
        existingCategories={groupData?.categories || []} // Passa categorias do grupo
        budgetToEdit={editingBudget} // Passa item para editar
      />
    </View>
  );
}

// --- Estilos ---
const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    listContent: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 80 },
    icon: { marginBottom: 20 },
    title: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', maxWidth: '85%' },
    sectionHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
        backgroundColor: colors.background, // Garante fundo para sticky
        paddingVertical: 10,
        paddingHorizontal: 5, // Pequeno padding interno
        marginTop: 15, // Espaço acima da seção
        marginBottom: 5,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
});