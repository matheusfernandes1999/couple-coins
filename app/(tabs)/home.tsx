// app/(tabs)/home.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Text, // Adicionado Text
    TouchableOpacity, // Adicionado TouchableOpacity
    TextInput,       // Adicionado TextInput
    Platform,        // Adicionado Platform
    Keyboard         // Adicionado Keyboard (opcional)
} from 'react-native';
import { useTheme } from '../../context/ThemeContext'; // Ajuste o caminho
import { useGroup } from '../../context/GroupContext';   // Ajuste o caminho
import { auth, db } from '../../lib/firebase'; 
import {
  doc, getDoc, setDoc, serverTimestamp, onSnapshot, addDoc,
  collection, arrayUnion, updateDoc, query, where, Timestamp, getDocs,
  deleteDoc
} from 'firebase/firestore';
import { useRouter } from 'expo-router'; // Importar useRouter

// Tipos (assumindo que estão em @/types ou similar)
import { Transaction, FinancialSummary } from '@/types';
// Helpers (assumindo que estão em @/utils/helpers ou similar)
import { getMonthYear, getWeekRange, generateInviteCode } from '@/utils/helpers';

// Componentes Filhos (ajuste os caminhos se necessário)
import FinancialSummaryDisplay from '@/components/dashboard/FinancialSummary';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import NoGroupView from '@/components/dashboard/NoGroupView';
import AddTransactionFAB from '@/components/dashboard/AddTransactionFAB';
import AddTransactionModal from '@/components/dashboard/AddTransactionModal';
import TransactionDetailModal from '@/components/dashboard/TransactionDetailModal';
import { Ionicons } from '@expo/vector-icons'; // Importar Ionicons

export default function HomeScreen() {
  const { colors } = useTheme();
  const { groupId, groupData, isLoadingGroup, groupError, fetchUserGroupId } = useGroup(); // Hook do grupo
  const currentUser = auth.currentUser; // Usuário logado
  const router = useRouter(); // Hook de navegação

  // --- Estados Específicos da HomeScreen ---
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]); // Transações brutas do listener
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false); // Loading das transações
  const [monthlySummary, setMonthlySummary] = useState<FinancialSummary>({ income: 0, expenses: 0, balance: 0 });
  const [weeklySummary, setWeeklySummary] = useState<FinancialSummary>({ income: 0, expenses: 0, balance: 0 });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]); // Filtro de categoria
  const [summaryViewType, setSummaryViewType] = useState<'month' | 'week'>('month'); // Visão Mês/Semana
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<'all' | 'income' | 'expense'>('all'); // Filtro Entrada/Saída/Todas

  // Estados UI "Sem Grupo"
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [newGroupNameInput, setNewGroupNameInput] = useState('');
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Estados Modais
  const [isAddModalVisible, setIsAddModalVisible] = useState(false); // Para Add/Edit Transação
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false); // Para Detalhes Transação
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null); // Transação selecionada
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null); // Transação em edição
  // ------------------------------------------


  // --- Funções de Cálculo ---
  const calculateSummaries = useCallback((trans: Transaction[]) => {
    const now = new Date();
    const currentMonthStr = getMonthYear(now);
    const currentWeekRange = getWeekRange(now);
    let monthlyIncome = 0, monthlyExpenses = 0, weeklyIncome = 0, weeklyExpenses = 0;

    trans.forEach(t => {
      if (!t.date) return;
      const transactionDate = t.date.toDate();
      // Mês
      if (getMonthYear(transactionDate) === currentMonthStr) {
        if (t.type === 'income') monthlyIncome += t.value;
        else if (t.type === 'expense') monthlyExpenses += t.value;
      }
      // Semana
      if (transactionDate >= currentWeekRange.start && transactionDate <= currentWeekRange.end) {
        if (t.type === 'income') weeklyIncome += t.value;
        else if (t.type === 'expense') weeklyExpenses += t.value;
      }
    });

    setMonthlySummary({ income: monthlyIncome, expenses: monthlyExpenses, balance: monthlyIncome - monthlyExpenses });
    setWeeklySummary({ income: weeklyIncome, expenses: weeklyExpenses, balance: weeklyIncome - weeklyExpenses });
  }, []); // Sem dependências externas


  // --- Listener de Transações ---
  useEffect(() => {
    if (!groupId) { // Só executa se tiver um ID de grupo do contexto
      setTransactions([]);
      calculateSummaries([]);
      setIsLoadingTransactions(false);
      return;
    }

    console.log("HomeScreen: Setting up transactions listener for group:", groupId);
    // Inicia loading apenas se o loading principal do grupo já terminou
    if (!isLoadingGroup) setIsLoadingTransactions(true);

    // Query para buscar TODAS as transações do grupo (subcoleção)
    const transactionsQuery = query(
      collection(db, "groups", groupId, "transactions")
      // A ordenação por data é feita no cliente após o fetch
    );

    // Configura o listener em tempo real
    const unsubscribeTransactions = onSnapshot(transactionsQuery, (querySnapshot) => {
      const fetchedTransactions: Transaction[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Validação básica
        if (data.value !== undefined && data.type && data.category && data.userId && data.date && data.createdAt) {
           fetchedTransactions.push({ id: doc.id, ...data, groupId: groupId } as Transaction);
        } else {
           console.warn(`Transaction document ${doc.id} ignored due to incomplete data.`);
        }
      });

      // Ordenação no cliente (mais recentes primeiro)
      fetchedTransactions.sort((a, b) => (b.date?.toMillis() || 0) - (a.date?.toMillis() || 0));

      console.log(`HomeScreen: Fetched ${fetchedTransactions.length} transactions.`);
      setTransactions(fetchedTransactions); // Atualiza estado com transações brutas ordenadas
      calculateSummaries(fetchedTransactions); // Recalcula resumos
      setIsLoadingTransactions(false); // Finaliza loading das transações
      setIsRefreshing(false); // Finaliza refresh se estava ativo
    }, (error) => {
      console.error("HomeScreen: Error listening to transactions:", error);
      Alert.alert("Erro", "Não foi possível carregar as transações.");
      setTransactions([]);
      calculateSummaries([]);
      setIsLoadingTransactions(false);
      setIsRefreshing(false);
    });

    // Limpa o listener ao desmontar ou quando groupId mudar
    return () => {
      console.log("HomeScreen: Cleaning up transactions listener for:", groupId);
      unsubscribeTransactions();
    };
  }, [groupId, calculateSummaries, isLoadingGroup]); // Dependências

  // --- Handlers ---
  // Criar Grupo
  const handleCreateGroup = async () => {
    if (!currentUser || !newGroupNameInput.trim()) { Alert.alert("Erro", "Digite um nome."); return; }
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
      Alert.alert("Sucesso", "Grupo criado!");
      fetchUserGroupId(); // Atualiza contexto
    } catch (error) { Alert.alert("Erro", "Não foi possível criar o grupo."); console.error(error); }
    finally { setIsCreatingGroup(false); }
  };

  // Entrar Grupo
  const handleJoinGroup = async () => {
    if (!currentUser || !inviteCodeInput.trim()) { Alert.alert("Erro", "Digite um código válido."); return; }
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
      Alert.alert("Sucesso!", "Você entrou no grupo.");
      fetchUserGroupId(); // Atualiza contexto
    } catch (error: any) { Alert.alert("Erro", error.message || "Não foi possível entrar."); console.error(error); }
    finally { setIsJoiningGroup(false); }
  };

  // Mudar Filtro de Categoria
  const handleCategoryFilterChange = (category: string) => {
    setSelectedCategories(prev => category === 'Todas' ? [] : (prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]));
  };

  // Puxar para Atualizar
  const onRefresh = useCallback(async () => {
    console.log("Refreshing HomeScreen data...");
    setIsRefreshing(true);
    fetchUserGroupId(); // Revalida o grupo e usuário
    // O listener de transações será reativado se groupId mudar ou buscará updates.
    // O próprio listener define isRefreshing = false.
    setTimeout(() => { if (isRefreshing) setIsRefreshing(false); }, 5000); // Timeout de segurança
  }, [fetchUserGroupId, isRefreshing]);

  // Abrir Modal de Adicionar/Editar Transação
  const handleAddTransactionPress = () => {
    if (!groupId) { Alert.alert("Erro", "Grupo não carregado."); return; }
    setEditingTransaction(null);
    setIsAddModalVisible(true);
  };

  // Abrir Modal de Detalhes da Transação
  const handleTransactionPress = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDetailModalVisible(true);
  };

  // Fechar Modal de Detalhes
  const handleCloseDetailModal = () => {
    setIsDetailModalVisible(false);
    setSelectedTransaction(null);
  };

  // Fechar Modal de Adicionar/Editar
  const closeAddEditModal = () => {
      setIsAddModalVisible(false);
      setEditingTransaction(null);
  };

  // Iniciar Edição de Transação
  const handleEditTransaction = (transaction: Transaction) => {
    handleCloseDetailModal();
    setEditingTransaction(transaction);
    setIsAddModalVisible(true);
  };

  // Excluir Transação
  const handleDeleteTransaction = async (transactionId: string) => {
    if (!groupId) { Alert.alert("Erro", "ID do grupo não encontrado."); return; }
    console.log("Deleting transaction:", transactionId);
    const transDocRef = doc(db, "groups", groupId, "transactions", transactionId);
    try {
        await deleteDoc(transDocRef);
        handleCloseDetailModal(); // Fecha modal se estava aberto
        Alert.alert("Sucesso", "Transação excluída.");
    } catch (error) { Alert.alert("Erro", "Não foi possível excluir."); console.error(error); }
  };

  // Navegar para Tela Cheia de Transações
  const navigateToAllTransactions = () => {
      console.log("Navigating to all transactions screen...");
      router.push('/screens/transactions'); // Rota para a tela de histórico completo
  };
  // ---------------------------------------------------------

  // --- Lógica de Filtragem (useMemo) ---
  const filteredTransactions = useMemo(() => {
    console.log("HomeScreen: Recalculating filtered transactions...");
    let itemsToFilter = [...transactions];

    // 1. Filtra por Tipo
    if (transactionTypeFilter !== 'all') {
        itemsToFilter = itemsToFilter.filter(t => t.type === transactionTypeFilter);
    }
    // 2. Filtra por Categorias
    if (selectedCategories.length > 0) {
        itemsToFilter = itemsToFilter.filter(t => selectedCategories.includes(t.category));
    }

    return itemsToFilter;
  }, [transactions, selectedCategories, transactionTypeFilter]);
  // ---------------------------------------

  // --- Renderização ---
  const styles = getStyles(colors);

  // Loading Geral / Erro / Sem Grupo
  if (isLoadingGroup && !isRefreshing) { return ( <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={colors.primary} /></View> ); }
  if (groupError && !isLoadingGroup) { return ( <View style={[styles.container, styles.centered]}><Text style={[styles.errorText, {color: colors.error}]}>Erro: {groupError}</Text></View> ); }
  if (!groupId) { return ( <NoGroupView /* ... props para criar/entrar ... */ newGroupName={newGroupNameInput} inviteCode={inviteCodeInput} isCreating={isCreatingGroup} isJoining={isJoiningGroup} onNewGroupNameChange={setNewGroupNameInput} onInviteCodeChange={setInviteCodeInput} onCreateGroup={handleCreateGroup} onJoinGroup={handleJoinGroup} /> ); }
  if (!groupData) { return ( <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={colors.primary} /></View> ); }

  // Loading específico das transações
  const showContentLoading = isLoadingTransactions && transactions.length === 0 && !isRefreshing;
  const availableCategories = groupData?.categories || [];


  // Renderização principal da tela logada e com grupo
  return (
    <View style={styles.container}>
       {/* ScrollView Principal */}
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={ <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} /> }
        keyboardShouldPersistTaps="handled"
      >
        {/* Seletor de Visão do Resumo (Mês/Semana) */}
         <View style={styles.summaryToggleContainer}>
            <TouchableOpacity
                style={[styles.toggleButton, summaryViewType === 'month' && styles.toggleButtonActive]}
                onPress={() => setSummaryViewType('month')}>
                <Text style={[styles.toggleButtonText, summaryViewType === 'month' && styles.toggleButtonTextActive]}>Mês Atual</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.toggleButton, summaryViewType === 'week' && styles.toggleButtonActive]}
                onPress={() => setSummaryViewType('week')}>
                 <Text style={[styles.toggleButtonText, summaryViewType === 'week' && styles.toggleButtonTextActive]}>Semana Atual</Text>
            </TouchableOpacity>
         </View>

         {/* Exibição do Resumo */}
         <FinancialSummaryDisplay
             monthlySummary={monthlySummary}
             weeklySummary={weeklySummary}
             displayType={summaryViewType}
         />

        {/* --- Área de Filtros de Transações --- */}
        <View style={styles.transactionFiltersContainer}>
            <Text style={styles.filterSectionTitle}>Transações Recentes</Text>

             {/* Filtro por Tipo */}
            <View style={styles.typeFilterContainer}>
                 <TouchableOpacity
                    style={[styles.typeFilterButton, styles.typeFilterButtonSegmented, styles.typeFilterButtonLeft, transactionTypeFilter === 'all' && styles.typeFilterButtonActive]}
                    onPress={() => setTransactionTypeFilter('all')}>
                    <Text style={[styles.typeFilterButtonText, transactionTypeFilter === 'all' && styles.typeFilterButtonTextActive]}>Todas</Text>
                 </TouchableOpacity>
                 <TouchableOpacity
                     style={[styles.typeFilterButton, styles.typeFilterButtonSegmented, transactionTypeFilter === 'income' && styles.typeFilterButtonActive]}
                     onPress={() => setTransactionTypeFilter('income')}>
                     <Text style={[styles.typeFilterButtonText, transactionTypeFilter === 'income' && styles.typeFilterButtonTextActive]}>Entradas</Text>
                 </TouchableOpacity>
                 <TouchableOpacity
                     style={[styles.typeFilterButton, styles.typeFilterButtonSegmented, styles.typeFilterButtonRight, transactionTypeFilter === 'expense' && styles.typeFilterButtonActive]}
                     onPress={() => setTransactionTypeFilter('expense')}>
                     <Text style={[styles.typeFilterButtonText, transactionTypeFilter === 'expense' && styles.typeFilterButtonTextActive]}>Saídas</Text>
                 </TouchableOpacity>
            </View>
        </View>
        {/* ------------------------------------ */}


        {/* Loading das Transações ou Lista */}
        {showContentLoading ? (
           <ActivityIndicator size="large" color={colors.primary} style={styles.groupLoadingIndicator} />
        ) : (
           <>
             {/* Lista de Transações Recentes (Filtrada) */}
             <RecentTransactions
                 transactions={filteredTransactions}
                 isLoading={isLoadingTransactions || isRefreshing}
                 onTransactionPress={handleTransactionPress}
                 limit={2}
             />
             {/* Botão para Ver Todas */}
              <TouchableOpacity style={styles.viewAllButton} onPress={navigateToAllTransactions}>
                  <Text style={styles.viewAllButtonText}>Ver Histórico Completo</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
           </>
        )}
      </ScrollView>

      {/* FAB para Adicionar Transação */}
      <AddTransactionFAB onPress={handleAddTransactionPress} />

      {/* Modais */}
      <AddTransactionModal
          isVisible={isAddModalVisible}
          onClose={closeAddEditModal}
          groupId={groupId}
          existingCategories={availableCategories}
          // onCategoryAdd={handleAddCategory} // Removido
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
} // Fim do componente HomeScreen

// --- Estilos ---
const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContainer: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 20, flex: 1 },
  groupLoadingIndicator: { marginTop: 50, marginBottom: 20 },
  errorText: { textAlign: 'center', fontSize: 16, lineHeight: 22 },
  summaryToggleContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, marginBottom: 5 },
  toggleButton: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, marginHorizontal: 5 },
  toggleButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleButtonText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  toggleButtonTextActive: { color: '#FFFFFF' },
  transactionFiltersContainer: { paddingHorizontal: 15, marginTop: 15, marginBottom: 10, borderTopWidth: 1, borderTopColor: colors.border + '80', paddingTop: 15 },
  filterSectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 15 },
  typeFilterContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.primary, overflow: 'hidden' },
  typeFilterButton: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  typeFilterButtonSegmented: { borderColor: colors.primary, borderLeftWidth: 0.5, borderRightWidth: 0.5 }, // Linhas divisórias
  typeFilterButtonLeft: { borderLeftWidth: 0 }, // Remove borda extra esquerda
  typeFilterButtonRight: { borderRightWidth: 0 }, // Remove borda extra direita
  typeFilterButtonActive: { backgroundColor: colors.primary },
  typeFilterButtonText: { fontSize: 14, fontWeight: '500', color: colors.primary },
  typeFilterButtonTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 15 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 40, fontSize: 15, color: colors.textPrimary },
  clearButton: { padding: 5 },
  filterContainer: { marginBottom: 5 },
  filterChips: { flexDirection: 'row', alignItems: 'center', paddingBottom: 5 }, // Reduzido padding bottom
  chip: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 15, marginRight: 8, borderWidth: 1 }, // Chip menor
  chipIdle: { backgroundColor: colors.surface, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12 }, // Texto menor
  chipTextIdle: { color: colors.textSecondary },
  chipTextSelected: { color: '#FFFFFF', fontWeight: 'bold' },
  viewAllButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginHorizontal: 15, marginTop: 10, marginBottom: 20 },
  viewAllButtonText: { color: colors.primary, fontSize: 15, fontWeight: '500', marginRight: 5 },
});