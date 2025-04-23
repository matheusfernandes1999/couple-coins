// app/(tabs)/home.tsx
import React, { useState, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Text,
    TouchableOpacity,
    Keyboard         
} from 'react-native';
import { useTheme } from '@/context/ThemeContext'; 
import { useGroup } from '@/context/GroupContext';  
import { auth, db } from '@/lib/firebase'; 
import {
  doc, setDoc, serverTimestamp, onSnapshot, addDoc,
  collection, arrayUnion, updateDoc, query, where, getDocs,
  deleteDoc
} from 'firebase/firestore';
import { useNavigation, useRouter } from 'expo-router';

import { Transaction, FinancialSummary } from '@/types';
import { getMonthYear, getWeekRange, generateInviteCode } from '@/utils/helpers';

import FinancialSummaryDisplay from '@/components/dashboard/FinancialSummary';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import NoGroupView from '@/components/dashboard/NoGroupView';
import AddTransactionFAB from '@/components/dashboard/AddTransactionFAB';
import AddTransactionModal from '@/components/dashboard/AddTransactionModal';
import TransactionDetailModal from '@/components/dashboard/TransactionDetailModal';

import { Ionicons } from '@expo/vector-icons';
import { showMessage } from "react-native-flash-message";

export default function HomeScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { groupId, groupData, isLoadingGroup, groupError, fetchUserGroupId } = useGroup();
  const currentUser = auth.currentUser;
  const router = useRouter();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState<FinancialSummary>({ income: 0, expenses: 0, balance: 0 });
  const [weeklySummary, setWeeklySummary] = useState<FinancialSummary>({ income: 0, expenses: 0, balance: 0 });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [summaryViewType, setSummaryViewType] = useState<'month' | 'week'>('month');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<'all' | 'income' | 'expense'>('all');

  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [newGroupNameInput, setNewGroupNameInput] = useState('');
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false); 
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null); 

  const calculateSummaries = useCallback((trans: Transaction[]) => {
    const now = new Date();
    const currentMonthStr = getMonthYear(now);
    const currentWeekRange = getWeekRange(now);
    let monthlyIncome = 0, monthlyExpenses = 0, weeklyIncome = 0, weeklyExpenses = 0;

    trans.forEach(t => {
      if (!t.date) return;
      const transactionDate = t.date.toDate();
      if (getMonthYear(transactionDate) === currentMonthStr) {
        if (t.type === 'income') monthlyIncome += t.value;
        else if (t.type === 'expense') monthlyExpenses += t.value;
      }
      if (transactionDate >= currentWeekRange.start && transactionDate <= currentWeekRange.end) {
        if (t.type === 'income') weeklyIncome += t.value;
        else if (t.type === 'expense') weeklyExpenses += t.value;
      }
    });
    setMonthlySummary({ income: monthlyIncome, expenses: monthlyExpenses, balance: monthlyIncome - monthlyExpenses });
    setWeeklySummary({ income: weeklyIncome, expenses: weeklyExpenses, balance: weeklyIncome - weeklyExpenses });
  }, []);

  useEffect(() => {
    if (!groupId) { 
      setTransactions([]);
      calculateSummaries([]);
      setIsLoadingTransactions(false);
      return;
    }
    if (!isLoadingGroup) setIsLoadingTransactions(true);

    const transactionsQuery = query(
      collection(db, "groups", groupId, "transactions")
    );

    const unsubscribeTransactions = onSnapshot(transactionsQuery, (querySnapshot) => {
      const fetchedTransactions: Transaction[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.value !== undefined && data.type && data.category && data.userId && data.date && data.createdAt) {
           fetchedTransactions.push({ id: doc.id, ...data, groupId: groupId } as Transaction);
        } else {
           console.warn(`Transaction document ${doc.id} ignored due to incomplete data.`);
        }
      });

      fetchedTransactions.sort((a, b) => (b.date?.toMillis() || 0) - (a.date?.toMillis() || 0));

      console.log(`HomeScreen: Fetched ${fetchedTransactions.length} transactions.`);
      setTransactions(fetchedTransactions); 
      calculateSummaries(fetchedTransactions); 
      setIsLoadingTransactions(false);
      setIsRefreshing(false); 
    }, (error) => {
      console.error("HomeScreen: Error listening to transactions:", error);
      showMessage({
        message: "Ops!",
        description: "Não foi possível carregar as transações.",
        backgroundColor: colors.error,
        color: colors.textPrimary,
      });
      setTransactions([]);
      calculateSummaries([]);
      setIsLoadingTransactions(false);
      setIsRefreshing(false);
    });

    return () => {
      unsubscribeTransactions();
    };
  }, [groupId, calculateSummaries, isLoadingGroup]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => router.push("/screens/insights")}
          style={{ marginRight: 15 }}
        >
          <Ionicons name="flash" size={24} color={"#fff"} />
        </TouchableOpacity>
      ),
      title: "Início",
    });
  }, [navigation, router]);
  
  const handleCreateGroup = async () => {
    if (!currentUser || !newGroupNameInput.trim()) { 
      showMessage({
        message: "Ops!",
        description: "Digite um nome válido!",
        backgroundColor: colors.error,
        color: colors.textPrimary,
      });
      return; 
    }
    setIsCreatingGroup(true);
    Keyboard.dismiss();
    try {
      const newInviteCode = generateInviteCode();
      const groupsRef = collection(db, "groups");
      const newGroupRef = await addDoc(groupsRef, {
        groupName: newGroupNameInput.trim(), members: [currentUser.uid],
        inviteCode: newInviteCode, createdAt: serverTimestamp(),
        categories: ['Salário', 'Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Compras', 'Contas', 'Outros'],
      });
      await setDoc(doc(db, "users", currentUser.uid), { groupId: newGroupRef.id }, { merge: true });
      setNewGroupNameInput('');
      showMessage({
        message: "Parabéns!",
        description: "Grupo criado!",
        backgroundColor: colors.success,
        color: colors.textPrimary,
      });

      fetchUserGroupId();
    } catch (error) { 
      showMessage({
        message: "Ops!",
        description: "Não foi possível criar o grupo.",	
        backgroundColor: colors.error,
        color: colors.textPrimary,
      });
      console.error(error); 
    }
    finally { setIsCreatingGroup(false); }
  };

  const handleJoinGroup = async () => {
    if (!currentUser || !inviteCodeInput.trim()) { 
      showMessage({
        message: "Ops!",
        description: "Digite um código válido!",
        backgroundColor: colors.error,
        color: colors.textPrimary,
      });
      return; 
    }
    const codeToJoin = inviteCodeInput.trim().toUpperCase();
    setIsJoiningGroup(true);
    Keyboard.dismiss();
    try {
      const q = query(collection(db, "groups"), where("inviteCode", "==", codeToJoin));
      const snapshot = await getDocs(q);
      if (snapshot.empty) throw new Error("Código inválido.");
      if (snapshot.size > 1) throw new Error("Erro: Código duplicado.");
      const groupDoc = snapshot.docs[0];
      await updateDoc(groupDoc.ref, { members: arrayUnion(currentUser.uid) });
      await setDoc(doc(db, "users", currentUser.uid), { groupId: groupDoc.id }, { merge: true });
      setInviteCodeInput('');
      showMessage({
        message: "Deu certo!",
        description: "Você entrou no grupo!",
        backgroundColor: colors.success,
        color: colors.textPrimary,
      });
      fetchUserGroupId();
    } catch (error: any) { 
      showMessage({
        message: "Ops!",
        description: error.message || "Não foi possível entrar.",
        backgroundColor: colors.error,
        color: colors.textPrimary,
      });
      console.error(error); 
    }
    finally { setIsJoiningGroup(false); }
  };

  const onRefresh = useCallback(async () => {
    showMessage({
      message: "Atualizando...",
      backgroundColor: colors.bottomSheet,
      color: colors.textPrimary,
    });
    setIsRefreshing(true);
    fetchUserGroupId();
    setTimeout(() => { if (isRefreshing) setIsRefreshing(false); }, 5000);
  }, [fetchUserGroupId, isRefreshing]);

  const handleAddTransactionPress = () => {
    if (!groupId) { 
      showMessage({
        message: "Ops!",
        description: "Grupo não carregado.",
        backgroundColor: colors.bottomSheet,
        color: colors.textPrimary,
      }); 
      return; 
    }
    setEditingTransaction(null);
    setIsAddModalVisible(true);
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
    if (!groupId) { 
      showMessage({
        message: "Ops!",
        description: "ID do grupo não encontrado.",
        backgroundColor: colors.error,
        color: colors.textPrimary,
      });
      return; 
    }
    const transDocRef = doc(db, "groups", groupId, "transactions", transactionId);
    try {
        await deleteDoc(transDocRef);
        handleCloseDetailModal();
        showMessage({
          message: "Deu certo!",
          description: "Transação excluída!",
          backgroundColor: colors.success,
        color: colors.textPrimary,
        });
    } catch (error) {  
        showMessage({
          message: "Ops!",
          description: "Não foi possível excluir.",
          backgroundColor: colors.error,
        color: colors.textPrimary,
        });
        console.error(error); 
    }
  };

  const navigateToAllTransactions = () => {
    router.push('/screens/history');
  };
  
  const filteredTransactions = useMemo(() => {
    let itemsToFilter = [...transactions];

    if (transactionTypeFilter !== 'all') {
      itemsToFilter = itemsToFilter.filter(t => t.type === transactionTypeFilter);
    }
    if (selectedCategories.length > 0) {
      itemsToFilter = itemsToFilter.filter(t => selectedCategories.includes(t.category));
    }
    return itemsToFilter;
  }, [transactions, selectedCategories, transactionTypeFilter]);

    const handleCycleTransactionTypeFilter = () => {
      setTransactionTypeFilter(currentFilter => {
          if (currentFilter === 'all') return 'income';
          if (currentFilter === 'income') return 'expense';
          return 'all';
      });
    };

    let typeFilterText = 'Todas';
    let typeFilterIcon: React.ComponentProps<typeof Ionicons>['name'] = 'podium-outline';
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
  
  const styles = getStyles(colors);

  if (isLoadingGroup && !isRefreshing) { return ( <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={colors.primary} /></View> ); }
  if (groupError && !isLoadingGroup) { return ( <View style={[styles.container, styles.centered]}><Text style={[styles.errorText, {color: colors.error}]}>Erro: {groupError}</Text></View> ); }
  if (!groupId) { return ( <NoGroupView newGroupName={newGroupNameInput} inviteCode={inviteCodeInput} isCreating={isCreatingGroup} isJoining={isJoiningGroup} onNewGroupNameChange={setNewGroupNameInput} onInviteCodeChange={setInviteCodeInput} onCreateGroup={handleCreateGroup} onJoinGroup={handleJoinGroup} /> ); }
  if (!groupData) { return ( <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={colors.primary} /></View> ); }

  const showContentLoading = isLoadingTransactions && transactions.length === 0 && !isRefreshing;
  const availableCategories = groupData?.categories || [];

  return (
    <View style={styles.container}>
      <View style={styles.summaryHeader}>
        <Text style={[styles.summaryText, summaryViewType === 'month' && styles.summaryTextActive]} onPress={() => setSummaryViewType('month')}>Mês</Text>
        <Text style={[styles.summaryText, summaryViewType === 'week' && styles.summaryTextActive]} onPress={() => setSummaryViewType('week')}>Semana</Text>
        <TouchableOpacity style={[styles.viewAllButton]} onPress={navigateToAllTransactions}><Text style={styles.summaryTextAll}>Ver todas</Text><Ionicons name="arrow-forward" size={16} color="white"/></TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={ <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} /> }
        keyboardShouldPersistTaps="handled"
      >
         <FinancialSummaryDisplay
             monthlySummary={monthlySummary}
             weeklySummary={weeklySummary}
             displayType={summaryViewType}
         />

        <View style={styles.transactionFiltersContainer}>
            <Text style={styles.filterSectionTitle}>
              Transações recentes
            </Text>
            <View style={styles.singleFilterLine}>
                <TouchableOpacity style={[styles.cycleFilterButton, { backgroundColor: valueColor + '20'}]} onPress={handleCycleTransactionTypeFilter}>
                    <Ionicons name={typeFilterIcon} size={18} color={valueColor} />
                </TouchableOpacity>
            </View>
        </View>

        {showContentLoading ? (
           <ActivityIndicator size="large" color={colors.primary} style={styles.groupLoadingIndicator} />
        ) : (
           <>
             <RecentTransactions
                 transactions={filteredTransactions}
                 isLoading={isLoadingTransactions || isRefreshing}
                 onTransactionPress={handleTransactionPress}
                 limit={4}
             />
           </>
        )}
      </ScrollView>

      <AddTransactionFAB onPress={handleAddTransactionPress} />

      <AddTransactionModal
          isVisible={isAddModalVisible}
          onClose={closeAddEditModal}
          groupId={groupId}
          existingCategories={availableCategories}
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

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.bottomSheet,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 15,
  },
  summaryText: {
    fontSize: 14, 
    color: colors.textPrimary,
    paddingVertical: 5,
    paddingHorizontal: 22,
    fontWeight: '600', 
  },
  summaryTextAll: {
    fontSize: 14, 
    color: colors.textPrimary,
    paddingVertical: 5,
    paddingHorizontal: 12,
    fontWeight: '600', 
  },
  summaryTextActive: {
    borderBottomColor: colors.secondary,
    borderBottomWidth: 3,
    paddingHorizontal: 22,
    fontWeight: 'bold',
  },
  container: { flex: 1, backgroundColor: colors.background },
  scrollContainer: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 20, flex: 1 },
  groupLoadingIndicator: { marginTop: 50, marginBottom: 20 },
  errorText: { textAlign: 'center', fontSize: 16, lineHeight: 22 },

  transactionFiltersContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, marginTop: 15, marginBottom: 10, borderTopWidth: 1, borderTopColor: colors.border + '80', paddingTop: 15 },
  filterSectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary},
  
  singleFilterLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cycleFilterButton: {
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
  viewAllButton: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 18,
  },
});