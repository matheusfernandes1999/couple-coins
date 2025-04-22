// app/(tabs)/budget.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, SectionList, ActivityIndicator,
    Alert, TouchableOpacity, RefreshControl // Adicionado RefreshControl
} from 'react-native';
import { Stack } from 'expo-router'; // Para configurar header
import { useTheme } from '../../context/ThemeContext';         // Ajuste o caminho
import { useGroup } from '../../context/GroupContext';         // Ajuste o caminho
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../lib/firebase';                  // Ajuste o caminho
import {
    collection, query, onSnapshot, orderBy, where, doc,
    deleteDoc, Timestamp, increment, serverTimestamp, updateDoc,
    getDocs // Necessário para buscar transações do mês específico
} from 'firebase/firestore';
// Importa tipos atualizados
import { BudgetData, Transaction, ProcessedBudgetData, FinancialSummary } from '@/types'; // Ajuste o caminho
import AddBudgetModal from '@/components/budget/AddBudgetModal';         // Ajuste o caminho
import BudgetListItem from '@/components/budget/BudgetListItem';         // Ajuste o caminho
import AddTransactionFAB from '@/components/dashboard/AddTransactionFAB'; // Ajuste o caminho

// --- Interface para as seções do SectionList ---
interface BudgetSection {
    data: ProcessedBudgetData[]; // Usa o tipo processado que inclui spentAmount
}

// --- Funções Auxiliares de Data ---
// Formata Date para string YYYY-MM
const formatToMonthYearString = (date: Date): string => {
     return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
// Formata Date para display "Mês Longo Ano" (ex: "Abril 2025")
const formatMonthYearDisplay = (date: Date): string => {
     // Capitaliza primeira letra do mês
     const month = date.toLocaleDateString('pt-BR', { month: 'long'});
     const year = date.toLocaleDateString('pt-BR', { year: 'numeric'});
     return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
}
// ---------------------------------

export default function BudgetScreen() {
  const { colors } = useTheme();
  const { groupId, groupData, isLoadingGroup, fetchUserGroupId } = useGroup(); // Pega groupData para categorias e função de fetch
  const currentUser = auth.currentUser;
  const styles = getStyles(colors);

  // --- Estados ---
  const [allBudgets, setAllBudgets] = useState<BudgetData[]>([]); // Orçamentos/Metas brutos do Firestore
  const [transactionsForDisplayedMonth, setTransactionsForDisplayedMonth] = useState<Transaction[]>([]); // GUARDA APENAS DESPESAS DO MÊS EXIBIDO
  const [isLoadingBudgets, setIsLoadingBudgets] = useState(true); // Loading inicial dos orçamentos
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false); // Loading das transações do mês
  const [isModalVisible, setIsModalVisible] = useState(false); // Visibilidade do modal Add/Edit
  const [editingBudget, setEditingBudget] = useState<BudgetData | null>(null); // Orçamento/Meta em edição
  const [displayMonthDate, setDisplayMonthDate] = useState(() => { // Mês/Ano a ser exibido
      const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); // Início do mês atual
  });
  const [isRefreshing, setIsRefreshing] = useState(false); // Estado para RefreshControl
  // ----------------

  // --- Listener para Orçamentos/Metas ---
  const fetchBudgets = useCallback(() => {
    if (!groupId || isLoadingGroup) {
        setAllBudgets([]);
        setIsLoadingBudgets(!isLoadingGroup); // Para se não houver grupo
        return () => {}; // Retorna função vazia
    }
    setIsLoadingBudgets(true); // Inicia loading dos orçamentos
    console.log("BudgetScreen: Setting up budgets listener for group:", groupId);
    const budgetsQuery = query(collection(db, "groups", groupId, "budgets")); // Pode adicionar orderBy aqui se precisar

    const unsubscribe = onSnapshot(budgetsQuery, (snapshot) => {
        const fetchedBudgets: BudgetData[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Validação Mínima
             if(data.name && data.targetAmount !== undefined && data.type){
                 fetchedBudgets.push({ id: doc.id, ...data } as BudgetData);
             } else { console.warn(`Budget ${doc.id} ignored.`); }
        });
        console.log(`BudgetScreen: Fetched ${fetchedBudgets.length} budgets/goals.`);
        setAllBudgets(fetchedBudgets);
        setIsLoadingBudgets(false); // Termina loading dos orçamentos
    }, (error) => {
        console.error("BudgetScreen: Error listening to budgets:", error);
        Alert.alert("Erro", "Não foi possível carregar orçamentos/metas.");
        setIsLoadingBudgets(false);
    });
    return unsubscribe; // Retorna função de cleanup
  }, [groupId, isLoadingGroup]); // Dependências do fetchBudgets

  useEffect(() => {
    const unsubscribe = fetchBudgets(); // Chama a função
    return () => { if (unsubscribe) unsubscribe(); }; // Cleanup
  }, [fetchBudgets]); // Depende da função memoizada

   // --- BUSCA PONTUAL (getDocs) para Transações do Mês EXIBIDO ---
   const fetchMonthlyTransactions = useCallback(async () => {
    // Só busca se tiver grupo e os orçamentos já tiverem sido carregados (evita buscas desnecessárias)
    if (!groupId || isLoadingGroup || isLoadingBudgets) {
        setTransactionsForDisplayedMonth([]);
        setIsLoadingTransactions(false);
        return;
    }

    const currentMonthYearString = formatToMonthYearString(displayMonthDate);
    console.log("BudgetScreen: Fetching transactions for month:", currentMonthYearString);
    setIsLoadingTransactions(true); // Inicia loading das transações

    const year = displayMonthDate.getFullYear();
    const month = displayMonthDate.getMonth(); // 0-indexado
    const startDate = Timestamp.fromDate(new Date(year, month, 1, 0, 0, 0, 0));
    const endDate = Timestamp.fromDate(new Date(year, month + 1, 0, 23, 59, 59, 999));

    // Query busca DESPESAS no intervalo de data
    // ** REQUER ÍNDICE: type ASC, date ASC/DESC (ou date ASC/DESC, type ASC) **
    const transQuery = query(
        collection(db, "groups", groupId, "transactions"),
        where("type", "==", "expense"),
        where("date", ">=", startDate),
        where("date", "<=", endDate)
    );

    try {
        const snapshot = await getDocs(transQuery);
        const fetchedTransactions: Transaction[] = [];
        snapshot.forEach(doc => {
             const data = doc.data();
             // Validação pode ser mais robusta aqui se necessário
             if (data.value !== undefined && data.category && data.date) {
                fetchedTransactions.push({ id: doc.id, ...data } as Transaction);
             }
        });
        console.log(`BudgetScreen: Fetched ${fetchedTransactions.length} expense transactions for month.`);
        setTransactionsForDisplayedMonth(fetchedTransactions); // Guarda as despesas do mês
    } catch (error: any) {
        console.error("BudgetScreen: Error fetching monthly transactions:", error);
        if (error.code === 'failed-precondition') {
             Alert.alert("Índice Necessário", "Para calcular os gastos do orçamento, um índice composto (type, date) é necessário no Firestore. Verifique os logs para o link de criação.");
        } else { Alert.alert("Erro", "Não foi possível carregar os gastos do mês."); }
        setTransactionsForDisplayedMonth([]); // Limpa em caso de erro
    } finally {
        setIsLoadingTransactions(false); // Termina loading das transações
    }
  }, [groupId, displayMonthDate, isLoadingGroup, isLoadingBudgets]); // Depende do grupo, mês exibido e loadings

  // Efeito que chama a busca de transações
  useEffect(() => {
      fetchMonthlyTransactions();
  }, [fetchMonthlyTransactions]); // Depende da função memoizada


  // --- Processamento para SectionList (Calcula gastos e agrupa) ---
   const budgetSections = useMemo((): BudgetSection[] => {
    // Só processa se os orçamentos já carregaram
    if (isLoadingBudgets) return [];

    console.log("Recalculating budget sections for month:", formatMonthYearDisplay(displayMonthDate));
    const monthly: ProcessedBudgetData[] = [];
    const spentByCategory: { [category: string]: number } = {};
    const currentMonthYearString = formatToMonthYearString(displayMonthDate);

    // 1. Pré-calcula gastos por categoria do mês exibido (usa estado `transactionsForDisplayedMonth`)
    // Não recalcula a cada render se transactionsForDisplayedMonth não mudou
    transactionsForDisplayedMonth.forEach(t => {
        if (t.category) { spentByCategory[t.category] = (spentByCategory[t.category] || 0) + t.value; }
    });

    // 2. Separa orçamentos/metas e adiciona gastos calculados aos mensais
    allBudgets.forEach(b => {
        if (b.type === 'monthly') {
             if (b.monthYear === currentMonthYearString) {
                 let totalSpentForBudget = 0;
                 // Soma gastos das categorias vinculadas a este orçamento
                 b.categories?.forEach(cat => { totalSpentForBudget += (spentByCategory[cat] || 0); });
                 monthly.push({ ...b, spentAmount: totalSpentForBudget }); // Adiciona o gasto
             }
        } 
    });

    // 3. Ordena
    monthly.sort((a, b) => a.name.localeCompare(b.name));

    // 4. Monta seções
    const sections: BudgetSection[] = [];
    if (monthly.length > 0) sections.push({ data: monthly });

    return sections;

  }, [allBudgets, transactionsForDisplayedMonth, displayMonthDate, isLoadingBudgets]); // Depende dos dados brutos e mês


  // --- Handlers ---
  const handleEditBudget = (budget: BudgetData) => { setEditingBudget(budget); setIsModalVisible(true); };
  const handleDeleteBudget = async (budgetId: string) => {
      if (!groupId) return;
      Alert.alert("Confirmar Exclusão", "Deseja realmente excluir este item?", [
           { text: "Cancelar", style: "cancel"},
           { text: "Excluir", style: "destructive", onPress: async () => {
                const budgetDocRef = doc(db, "groups", groupId, "budgets", budgetId);
                try { await deleteDoc(budgetDocRef); Alert.alert("Sucesso", "Item excluído."); }
                catch (error) { console.error(error); Alert.alert("Erro", "Não foi possível excluir."); }
           }}
       ]);
   };

  const closeModal = () => { setIsModalVisible(false); setEditingBudget(null); };
  // Navegação de Mês
  const goToPreviousMonth = () => { setDisplayMonthDate(d => { const n = new Date(d); n.setDate(1); n.setMonth(d.getMonth() - 1); return n; }); };
  const goToNextMonth = () => {
    setDisplayMonthDate(prevDate => {
        const newDate = new Date(prevDate);
        newDate.setDate(1); // Normaliza dia
        newDate.setMonth(prevDate.getMonth() + 1); // Simplesmente avança para o próximo mês
        return newDate; // Sempre permite avançar
    });
  };
  // Refresh
  const onRefresh = useCallback(async () => {
      if (!groupId) { setIsRefreshing(false); return; }
      console.log("BudgetScreen: Refresh triggered.");
      setIsRefreshing(true);
      try {
          // Rebusca orçamentos E transações do mês atual
          const budgetUnsub = fetchBudgets(); // Assumindo que fetchBudgets retorna o unsubscribe
          await fetchMonthlyTransactions();
          if(budgetUnsub) budgetUnsub(); // Desinscreve se não precisar mais do listener após refresh
      } catch(e) { console.error("Error during refresh:", e); }
      finally { setIsRefreshing(false); }
   }, [groupId, fetchBudgets, fetchMonthlyTransactions]); // Depende das funções de busca memoizadas
  // ---------------


  // --- Renderização ---

  // Loading inicial (do contexto ou dos orçamentos iniciais)
   if (isLoadingGroup || (isLoadingBudgets && allBudgets.length === 0 && !isRefreshing)) {
       return ( <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={colors.primary} /></View> );
   }
   // Sem grupo
   if (!groupId) {
       return (
            <View style={[styles.container, styles.centered]}>
                 <Stack.Screen options={{ title: 'Orçamento' }} />
                <Ionicons name="alert-circle-outline" size={60} color={colors.textSecondary} style={styles.icon} />
                <Text style={styles.title}>Sem Grupo</Text>
                <Text style={styles.subtitle}>Crie ou entre em um grupo para gerenciar orçamentos.</Text>
            </View>
       );
   }

  return (
    <View style={styles.container}>
       <Stack.Screen options={{ title: 'Orçamentos' }} />

       {/* Navegador de Mês */}
       <View style={styles.monthNavigator}>
           <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
               <Ionicons name="chevron-back" size={28} color={colors.primary} />
           </TouchableOpacity>
           <Text style={styles.monthYearText}>{formatMonthYearDisplay(displayMonthDate)}</Text>
           <TouchableOpacity onPress={goToNextMonth} style={styles.navButton} >
               <Ionicons name="chevron-forward" size={28} color={colors.primary} />
           </TouchableOpacity>
       </View>

       {/* SectionList */}
        {/* Mostra loading se buscando orçamentos pela primeira vez ou se não há seções ainda */}
       {isLoadingBudgets && budgetSections.length === 0 ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
       ) : budgetSections.length === 0 ? (
            // Mensagem se não há itens para o mês/metas gerais (APÓS carregar)
            <View style={styles.centered}>
                <Ionicons name="wallet-outline" size={60} color={colors.textSecondary} style={styles.icon}/>
                <Text style={styles.title}>Vazio por Aqui</Text>
                <Text style={styles.subtitle}>Nenhum orçamento definido para {formatMonthYearDisplay(displayMonthDate)}.</Text>
                <Text style={styles.subtitle}>Use o botão (+) para começar.</Text>
                {/* Mostra loading das transações se aplicável */}
                {isLoadingTransactions && <ActivityIndicator size="small" color={colors.textSecondary} style={{marginTop: 15}}/>}
            </View>
        ) : (
            <SectionList
                sections={budgetSections} // Usa as seções processadas
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => ( // Item aqui já é ProcessedBudgetData
                    <BudgetListItem
                        item={item}
                        groupId={groupId}
                        onEdit={() => handleEditBudget(item)}
                        onDelete={handleDeleteBudget}
                    />
                )}
                contentContainerStyle={styles.listContent}
                stickySectionHeadersEnabled={false}
                // Mostra loading no rodapé se buscando transações
                ListFooterComponent={isLoadingTransactions ? <ActivityIndicator style={{ margin: 20 }} color={colors.primary} /> : null}
                 refreshControl={ // Pull to refresh
                        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary}/>
                 }
            />
        )}

      {/* FAB para Adicionar Orçamento/Meta */}
      <AddTransactionFAB onPress={() => { setEditingBudget(null); setIsModalVisible(true); }} />

      {/* Modal para Adicionar/Editar */}
      <AddBudgetModal
        isVisible={isModalVisible}
        onClose={closeModal}
        groupId={groupId}
        existingCategories={groupData?.categories || []} // Passa categorias existentes
        budgetToEdit={editingBudget} // Passa item para editar (ou null)
      />
    </View>
  );
}

// --- Estilos ---
const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    listContent: { paddingHorizontal: 15, paddingTop: 0, paddingBottom: 80 }, // Reduzido paddingTop
    icon: { marginBottom: 20 },
    title: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', maxWidth: '85%', lineHeight: 22 },
    monthNavigator: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 10 },
    navButton: { padding: 5 },
    monthYearText: { fontSize: 17, fontWeight: 'bold', color: colors.textPrimary },
    sectionHeader: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, backgroundColor: colors.background, paddingVertical: 12, paddingHorizontal: 15, marginTop: 10, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }, // Ajustado marginTop/Bottom e paddingHorizontal
});