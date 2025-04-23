// app/recurring.tsx
import React, { useState, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useGroup } from '@/context/GroupContext';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '@/lib/firebase';
import {
    collection, query, onSnapshot, orderBy, where, doc,
    updateDoc, Timestamp, addDoc, serverTimestamp, // Mantém funções para Bills
    deleteDoc, // Para deletar Bills (opcional)
    writeBatch
} from 'firebase/firestore';
// Importa APENAS BillReminder
import { BillReminder, RecurrenceFrequency } from '@/types'; // Ajuste o caminho
// Importa componentes de Bill
import BillListItem from '@/components/recurring/BillListItem';           // Ajuste o caminho
import AddBillModal from '@/components/recurring/AddBillModal';           // Ajuste o caminho
import AddTransactionFAB from '@/components/dashboard/AddTransactionFAB'; // Assume componente FAB genérico

// Helper para calcular próxima data (se ainda usado em handleMarkBillPaid)
const calculateNextDueDate = (currentDue: Date, frequency: RecurrenceFrequency, interval: number): Date => {
    const nextDate = new Date(currentDue);
    switch (frequency) {
        case 'daily': nextDate.setDate(nextDate.getDate() + interval); break;
        case 'weekly': nextDate.setDate(nextDate.getDate() + 7 * interval); break;
        case 'monthly': nextDate.setMonth(nextDate.getMonth() + interval); break;
        case 'yearly': nextDate.setFullYear(nextDate.getFullYear() + interval); break;
    }
    return nextDate;
};

export default function RecurringManagementScreen() {
  const { colors } = useTheme();
  const { groupId, groupData, isLoadingGroup } = useGroup(); // Pega categorias para passar ao modal
  const styles = getStyles(colors);
  const router = useRouter();
  const navigation = useNavigation();
  const currentUser = auth.currentUser;

  // --- Estados (APENAS para Bills) ---
  const [bills, setBills] = useState<BillReminder[]>([]);
  const [isLoadingBills, setIsLoadingBills] = useState(true);
  const [isBillModalVisible, setIsBillModalVisible] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<BillReminder | null>(null); // Apenas BillReminder
  // -----------------------------------

  // --- Listener APENAS para Contas ---
  useEffect(() => {
    if (!groupId || isLoadingGroup) {
        setBills([]);
        setIsLoadingBills(!isLoadingGroup);
        return () => {};
    }

    setIsLoadingBills(true);
    console.log("RecurringScreen: Setting up BILLS listener for group:", groupId);
    // Ordena por não pagas primeiro, depois por data de vencimento
    const billQuery = query(
        collection(db, "groups", groupId, "bills"),
        orderBy("isPaid", "asc"),
        orderBy("dueDate", "asc")
    );
    const unsubBills = onSnapshot(billQuery, (snapshot) => {
        const items: BillReminder[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Validação Mínima
            if (data.name && data.value !== undefined && data.category && data.dueDate && data.isPaid !== undefined) {
                 items.push({ id: doc.id, ...data } as BillReminder);
            } else {
                 console.warn(`Bill reminder ${doc.id} ignored due to incomplete data.`);
            }
        });
        console.log(`RecurringScreen: Fetched ${items.length} bills.`);
        setBills(items);
        setIsLoadingBills(false);
    }, (error) => {
        console.error("RecurringScreen: Error listening to bills:", error);
        Alert.alert("Erro", "Não foi possível carregar as contas.");
        setIsLoadingBills(false);
    });

    return () => { unsubBills(); }; // Limpa listener
  }, [groupId, isLoadingGroup]);
  // ------------------------------------

    useLayoutEffect(() => {
        navigation.setOptions({
            title: 'Contas', // Título mais genérico agora
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { color: colors.textPrimary },
            headerShown: true // Garante que está visível
        });
    }, [navigation, colors]);
  
  // --- Handlers (APENAS para Bills) ---
  const handleEditBill = (item: BillReminder) => {
      setItemToEdit(item);
      setIsBillModalVisible(true);
  };

  // Marca conta como paga E cria transação
  const handleMarkBillPaid = async (billId: string) => {
      if (!groupId || !currentUser) return;
      console.log("Marking bill paid:", billId);
      const billRef = doc(db, "groups", groupId, "bills", billId);
      const billDoc = bills.find(b => b.id === billId); // Pega dados locais

      if(!billDoc) { Alert.alert("Erro", "Conta não encontrada."); return; }
      if(billDoc.isPaid) return; // Já está paga
      if(!billDoc.category) { Alert.alert("Erro", "Defina uma categoria para esta conta antes de pagar."); return; }

       // Usa Batch Write para atualizar conta E criar transação
       const batch = writeBatch(db);

      try {
           const updateData: any = { isPaid: true, lastPaidDate: Timestamp.now() };
           let nextDueDate: Date | null = null;

           // Calcula próxima data se for recorrente
            if (billDoc.isRecurring && billDoc.frequency && billDoc.interval) {
                const currentDueDate = billDoc.dueDate.toDate();
                nextDueDate = calculateNextDueDate(currentDueDate, billDoc.frequency, billDoc.interval);
                if (!billDoc.endDate || nextDueDate <= billDoc.endDate.toDate()) {
                     updateData.dueDate = Timestamp.fromDate(nextDueDate);
                     updateData.isPaid = false; // Reseta para próxima ocorrência
                } else { nextDueDate = null; /* Fim da recorrência */ }
            }

            // Adiciona atualização da conta ao batch
            batch.update(billRef, updateData);

           // Adiciona criação da transação ao batch
            const transactionData = {
                value: billDoc.value, category: billDoc.category, date: billDoc.dueDate, // Usa data de VENCIMENTO
                description: `Pagamento: ${billDoc.name}`, type: 'expense' as 'expense',
                notes: billDoc.notes || '', userId: currentUser.uid, createdAt: serverTimestamp(),
                relatedBillId: billId // Opcional: Link para a conta
            };
            const transColRef = collection(db, "groups", groupId, "transactions");
            const newTransRef = doc(transColRef); // Gera ID para a nova transação
            batch.set(newTransRef, transactionData);

            // Commita o batch
            await batch.commit();

            console.log(`Bill ${billId} marked paid/updated, transaction created.`);
            Alert.alert("Pago!", `Conta "${billDoc.name}" registrada como paga.`);

      } catch (error) {
          console.error("Error marking bill paid / creating transaction:", error);
          Alert.alert("Erro", "Não foi possível concluir a operação.");
      }
  };

    const handleDeleteBill = async (billId: string) => {
        if (!groupId) { Alert.alert("Erro", "Grupo não identificado."); return; }
        // A confirmação agora é feita no BillListItem, aqui apenas executamos
        console.log("RecurringScreen: Deleting bill", billId);
        const billRef = doc(db, "groups", groupId, "bills", billId);
        try {
            await deleteDoc(billRef);
            Alert.alert("Sucesso", "Conta/Lembrete excluído.");
            // O listener onSnapshot removerá da UI
        } catch (error) {
            console.error("Error deleting bill:", error);
            Alert.alert("Erro", "Não foi possível excluir a conta.");
        }
    };

  // Fecha o modal Add/Edit Bill
  const closeBillModal = () => {
      setIsBillModalVisible(false);
      setItemToEdit(null);
  };
  // ------------------------------------

  // --- Render Item ---
  const renderItem = ({ item }: { item: BillReminder }) => (
      <BillListItem
          item={item}
          onEdit={() => handleEditBill(item)}
          onMarkPaid={handleMarkBillPaid}
          onDelete={() => handleDeleteBill(item.id)} // <-- Passa o handler de exclusão
      />
  );

  // --- Renderização Principal ---
  const isLoading = isLoadingGroup || isLoadingBills; // Loading combinado

  return (
    <View style={styles.container}>

      {isLoading && bills.length === 0 ? ( // Loading inicial
          <ActivityIndicator size="large" color={colors.primary} style={styles.loadingIndicator} />
      ) : bills.length === 0 ? ( // Mensagem de lista vazia
          <View style={styles.centered}>
                <Ionicons name="document-text-outline" size={60} color={colors.textSecondary} style={styles.icon}/>
                <Text style={styles.title}>Nenhuma Conta</Text>
                <Text style={styles.subtitle}>Adicione suas contas a pagar ou lembretes usando o botão (+).</Text>
          </View>
      ) : ( // Lista de Contas
          <FlatList
              data={bills}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              // RefreshControl opcional aqui para rebuscar contas
          />
      )}

      {/* FAB para Adicionar NOVA CONTA */}
      <AddTransactionFAB
          onPress={() => { setItemToEdit(null); setIsBillModalVisible(true); }}
       />

      {/* Modal para Adicionar/Editar CONTA */}
      <AddBillModal
          isVisible={isBillModalVisible}
          onClose={closeBillModal}
          groupId={groupId!} // Passa groupId (já verificado que não é null aqui)
          existingCategories={groupData?.categories || []} // Passa categorias
          billToEdit={itemToEdit} // Passa conta para editar (ou null)
      />
    </View>
  );
}

// --- Estilos ---
const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingIndicator: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    icon: { marginBottom: 20 },
    title: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', maxWidth: '85%', lineHeight: 22 },
    listContent: { paddingHorizontal: 15, paddingTop: 15, paddingBottom: 90 }, // Padding para lista e FAB
    fab: { position: 'absolute', margin: 16, right: 0, bottom: 0 },
    // Adicionar sectionHeader se voltar a usar SectionList
});

// Helper para calcular próxima data (se movido para utils, importe de lá)
// const calculateNextDueDate = (currentDue: Date, frequency: RecurrenceFrequency, interval: number): Date => { /* ... */ };
// --- Helper para calcular próxima data (Precisa ser robusto) ---
// Esta é uma implementação SIMPLES. Use bibliotecas como date-fns para mais precisão
// com meses de tamanhos diferentes e anos bissextos.
