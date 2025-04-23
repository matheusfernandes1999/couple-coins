// app/(tabs)/budget.tsx
import React, { useState, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import {
    View, Text, StyleSheet, SectionList, ActivityIndicator,
    TouchableOpacity, RefreshControl 
} from 'react-native';
import { router, Stack, useNavigation } from 'expo-router'; 
import { useTheme } from '@/context/ThemeContext';        
import { useGroup } from '@/context/GroupContext';         
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/lib/firebase';                  
import {
    collection, query, onSnapshot, where, doc,
    deleteDoc, Timestamp, 
    getDocs
} from 'firebase/firestore';
import { BudgetData, Transaction, ProcessedBudgetData, } from '@/types';
import AddBudgetModal from '@/components/budget/AddBudgetModal';        
import BudgetListItem from '@/components/budget/BudgetListItem';         
import AddTransactionFAB from '@/components/dashboard/AddTransactionFAB';
import { showMessage } from 'react-native-flash-message';
import ConfirmationModal from '@/components/modal/ConfirmationModal';

    interface BudgetSection {
        data: ProcessedBudgetData[]; 
    }

    const formatToMonthYearString = (date: Date): string => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    const formatMonthYearDisplay = (date: Date): string => {
        const month = date.toLocaleDateString('pt-BR', { month: 'long'});
        const year = date.toLocaleDateString('pt-BR', { year: 'numeric'});
        return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
    }

export default function BudgetScreen() {
  const { colors } = useTheme();
  const { groupId, groupData, isLoadingGroup } = useGroup();
  const styles = getStyles(colors);
  const navigation = useNavigation();

  const [allBudgets, setAllBudgets] = useState<BudgetData[]>([]);
  const [transactionsForDisplayedMonth, setTransactionsForDisplayedMonth] = useState<Transaction[]>([]);
  const [isLoadingBudgets, setIsLoadingBudgets] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false); 
  const [isModalVisible, setIsModalVisible] = useState(false); 
  const [editingBudget, setEditingBudget] = useState<BudgetData | null>(null);
  const [displayMonthDate, setDisplayMonthDate] = useState(() => { 
      const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [budgetIdToDelete, setBudgetIdToDelete] = useState<string | null>(null);

  const fetchBudgets = useCallback(() => {
    if (!groupId || isLoadingGroup) {
        setAllBudgets([]);
        setIsLoadingBudgets(!isLoadingGroup);
        return () => {};
    }
    setIsLoadingBudgets(true); 
    const budgetsQuery = query(collection(db, "groups", groupId, "budgets"));

    const unsubscribe = onSnapshot(budgetsQuery, (snapshot) => {
        const fetchedBudgets: BudgetData[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
             if(data.name && data.targetAmount !== undefined && data.type){
                 fetchedBudgets.push({ id: doc.id, ...data } as BudgetData);
             } else { console.warn(`Budget ${doc.id} ignored.`); }
        });
        setAllBudgets(fetchedBudgets);
        setIsLoadingBudgets(false);
    }, (error) => {
        showMessage({
            message: "Ops!",
            description: "Não foi possível carregar orçamentos/metas.",
            backgroundColor: colors.error,
            color: colors.textPrimary,
        });
        setIsLoadingBudgets(false);
    });
    return unsubscribe; 
  }, [groupId, isLoadingGroup]);

  useEffect(() => {
    const unsubscribe = fetchBudgets();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [fetchBudgets]); 
  
   const fetchMonthlyTransactions = useCallback(async () => {
    if (!groupId || isLoadingGroup || isLoadingBudgets) {
        setTransactionsForDisplayedMonth([]);
        setIsLoadingTransactions(false);
        return;
    }

    const currentMonthYearString = formatToMonthYearString(displayMonthDate);
    setIsLoadingTransactions(true);

    const year = displayMonthDate.getFullYear();
    const month = displayMonthDate.getMonth();
    const startDate = Timestamp.fromDate(new Date(year, month, 1, 0, 0, 0, 0));
    const endDate = Timestamp.fromDate(new Date(year, month + 1, 0, 23, 59, 59, 999));

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
             if (data.value !== undefined && data.category && data.date) {
                fetchedTransactions.push({ id: doc.id, ...data } as Transaction);
             }
        });
        setTransactionsForDisplayedMonth(fetchedTransactions);
    } catch (error: any) {
        if (error.code === 'failed-precondition') {
            showMessage({
                message: "Índice Necessário",
                description: "Para calcular os gastos do orçamento, um índice composto (type, date) é necessário no Firestore. Verifique os logs para o link de criação.",
                backgroundColor: colors.warning,
                color: colors.textPrimary,
            });
        } else { 
            showMessage({
                message: "Ops!",
                description: "Não foi possível carregar os gastos do mês.",
                backgroundColor: colors.error,
                color: colors.textPrimary,
            });        
        }
        setTransactionsForDisplayedMonth([]); 
    } finally {
        setIsLoadingTransactions(false); 
    }
  }, [groupId, displayMonthDate, isLoadingGroup, isLoadingBudgets]); 

  useEffect(() => {
      fetchMonthlyTransactions();
  }, [fetchMonthlyTransactions]); 

   const budgetSections = useMemo((): BudgetSection[] => {
    if (isLoadingBudgets) return [];

    const monthly: ProcessedBudgetData[] = [];
    const spentByCategory: { [category: string]: number } = {};
    const currentMonthYearString = formatToMonthYearString(displayMonthDate);

    transactionsForDisplayedMonth.forEach(t => {
        if (t.category) { spentByCategory[t.category] = (spentByCategory[t.category] || 0) + t.value; }
    });

    allBudgets.forEach(b => {
        if (b.type === 'monthly') {
             if (b.monthYear === currentMonthYearString) {
                 let totalSpentForBudget = 0;
                 b.categories?.forEach(cat => { totalSpentForBudget += (spentByCategory[cat] || 0); });
                 monthly.push({ ...b, spentAmount: totalSpentForBudget });
             }
        } 
    });

    monthly.sort((a, b) => a.name.localeCompare(b.name));

    const sections: BudgetSection[] = [];
    if (monthly.length > 0) sections.push({ data: monthly });

    return sections;

  }, [allBudgets, transactionsForDisplayedMonth, displayMonthDate, isLoadingBudgets]);

    const handleEditBudget = (budget: BudgetData) => { setEditingBudget(budget); setIsModalVisible(true); };

    const handleDeleteBudget = (budgetId: string) => {
        console.log("BudgetScreen: Delete requested for", budgetId);
        setBudgetIdToDelete(budgetId);
        setShowConfirmDeleteModal(true);
    };

      useLayoutEffect(() => {
        navigation.setOptions({
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/screens/recurring")}
              style={{ marginRight: 15 }}
            >
              <Ionicons name="card-outline" size={24} color={"#fff"} />
            </TouchableOpacity>
          ),
          title: "Orçamentos",
        });
      }, [navigation, router]);

    const confirmDeleteBudget = async () => {
        if (!groupId || !budgetIdToDelete) return; 

        console.log("BudgetScreen: Confirming deletion for", budgetIdToDelete);
        const budgetDocRef = doc(db, "groups", groupId, "budgets", budgetIdToDelete);
        try {
            await deleteDoc(budgetDocRef);
            showMessage({
                message: "Deu certo!",
                description: "Orçamento excluído com sucesso.",
                backgroundColor: colors.success,
                color: colors.textPrimary,
            });
        } catch (error) {
            console.error("Error deleting budget/goal:", error);
            showMessage({
                message: "Ops!",
                description: "Não foi possível excluir o orçamento.",
                backgroundColor: colors.error,
                color: colors.textPrimary,
            });
        } finally {
            setShowConfirmDeleteModal(false); 
            setBudgetIdToDelete(null); 
        }
    };

    const budgetNameToDelete = useMemo(() => {
        if (!budgetIdToDelete) return 'este item';
        return allBudgets.find(b => b.id === budgetIdToDelete)?.name || 'este item';
    }, [budgetIdToDelete, allBudgets]);

  const closeModal = () => { setIsModalVisible(false); setEditingBudget(null); };
  const goToPreviousMonth = () => { setDisplayMonthDate(d => { const n = new Date(d); n.setDate(1); n.setMonth(d.getMonth() - 1); return n; }); };
  const goToNextMonth = () => {
    setDisplayMonthDate(prevDate => {
        const newDate = new Date(prevDate);
        newDate.setDate(1); 
        newDate.setMonth(prevDate.getMonth() + 1);
        return newDate; 
    });
  };
  // Refresh
  const onRefresh = useCallback(async () => {
      if (!groupId) { setIsRefreshing(false); return; }
        showMessage({
        message: "Atualizando...",
        backgroundColor: colors.bottomSheet,
        color: colors.textPrimary,
        });
      setIsRefreshing(true);
      try {
          const budgetUnsub = fetchBudgets();
          await fetchMonthlyTransactions();
          if(budgetUnsub) budgetUnsub();
      } catch(e) { 
        showMessage({
            message: "Erro ao atualizar",
            backgroundColor: colors.error,
            color: colors.textPrimary,
        });
       }
      finally { setIsRefreshing(false); }
   }, [groupId, fetchBudgets, fetchMonthlyTransactions]);
   
   if (isLoadingGroup || (isLoadingBudgets && allBudgets.length === 0 && !isRefreshing)) {
       return ( <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={colors.primary} /></View> );
   }
   
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

       <View style={styles.monthNavigator}>
           <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
               <Ionicons name="chevron-back" size={28} color={colors.secondary} />
           </TouchableOpacity>
           <Text style={styles.monthYearText}>{formatMonthYearDisplay(displayMonthDate)}</Text>
           <TouchableOpacity onPress={goToNextMonth} style={styles.navButton} >
               <Ionicons name="chevron-forward" size={28} color={colors.secondary} />
           </TouchableOpacity>
       </View>

       {isLoadingBudgets && budgetSections.length === 0 ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
       ) : budgetSections.length === 0 ? (
            <View style={styles.centered}>
                <Ionicons name="wallet-outline" size={60} color={colors.textSecondary} style={styles.icon}/>
                <Text style={styles.title}>Vazio por Aqui</Text>
                <Text style={styles.subtitle}>Nenhum orçamento definido para {formatMonthYearDisplay(displayMonthDate)}.</Text>
                <Text style={styles.subtitle}>Use o botão (+) para começar.</Text>
                {isLoadingTransactions && <ActivityIndicator size="small" color={colors.textSecondary} style={{marginTop: 15}}/>}
            </View>
        ) : (
            <SectionList
                sections={budgetSections} 
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => ( 
                    <BudgetListItem
                        item={item}
                        groupId={groupId}
                        onEdit={() => handleEditBudget(item)}
                        onDelete={handleDeleteBudget}
                    />
                )}
                contentContainerStyle={styles.listContent}
                stickySectionHeadersEnabled={false}
                ListFooterComponent={isLoadingTransactions ? <ActivityIndicator style={{ margin: 20 }} color={colors.primary} /> : null}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary}/>
                }
            />
        )}

      <AddTransactionFAB onPress={() => { setEditingBudget(null); setIsModalVisible(true); }} />

      <AddBudgetModal
        isVisible={isModalVisible}
        onClose={closeModal}
        groupId={groupId}
        existingCategories={groupData?.categories || []} 
        budgetToEdit={editingBudget}
      />

        <ConfirmationModal
            isVisible={showConfirmDeleteModal}
            onClose={() => { setShowConfirmDeleteModal(false); setBudgetIdToDelete(null); }}
            onConfirm={confirmDeleteBudget} 
            title="Confirmar Exclusão"
            message={`Deseja realmente excluir o orçamento/meta "${budgetNameToDelete}"?`} 
            confirmButtonText="Excluir"
            isDestructive={true}
       />
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    listContent: { paddingHorizontal: 15, paddingTop: 0, paddingBottom: 80 },
    icon: { marginBottom: 20 },
    title: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', maxWidth: '85%', lineHeight: 22 },
    monthNavigator: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 10 },
    navButton: { padding: 5 },
    monthYearText: { fontSize: 17, fontWeight: 'bold', color: colors.textPrimary },
    sectionHeader: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, backgroundColor: colors.background, paddingVertical: 12, paddingHorizontal: 15, marginTop: 10, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }, 
});