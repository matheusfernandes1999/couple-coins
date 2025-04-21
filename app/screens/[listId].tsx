// app/shopping/[listId].tsx
import React, { useState, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useNavigation, Stack } from 'expo-router'; 
import { useTheme } from '@/context/ThemeContext';         
import { useGroup } from '@/context/GroupContext';         
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '@/lib/firebase';                  
import {
  collection, 
  query, 
  onSnapshot, 
  doc, 
  serverTimestamp, 
  Timestamp,
  writeBatch,
  getDocs,
  limit,
  where,
  FieldValue,
  addDoc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { InventoryItemData, ShoppingListItemData } from '@/types'; 
import ShoppingListItem from '@/components/dashboard/ShoppingListItem'; 
import AddShoppingItemModal from '@/components/dashboard/AddShoppingItemModal';
import AddTransactionFAB from '@/components/dashboard/AddTransactionFAB';     

export default function ListDetailScreen() {
  const { listId, name: listNameParam } = useLocalSearchParams<{ listId: string, name?: string }>();
  const navigation = useNavigation(); 
  const { colors } = useTheme();      
  const { groupId } = useGroup();     
  const currentUser = auth.currentUser; 

  // Estados da tela
  const [items, setItems] = useState<ShoppingListItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);             
  const [isRefreshing, setIsRefreshing] = useState(false);         
  const [isAddItemModalVisible, setIsAddItemModalVisible] = useState(false); 
  const [editingItem, setEditingItem] = useState<ShoppingListItemData | null>(null);

  // Configura o título da tela dinamicamente usando o nome passado ou um padrão
  useLayoutEffect(() => {
    navigation.setOptions({
       headerTitle: listNameParam || 'Itens da Lista', // Define título do header
       headerStyle: { backgroundColor: colors.primary }, // Estilo do header
       headerTintColor: '#fff', // Cor do texto e ícones do header
       headerTitleStyle: { fontWeight: 'bold'},
       headerShown: true // Garante que o header seja exibido
    });
  }, [navigation, listNameParam, colors]); // Dependências do efeito

  // --- Listener para Itens da Lista Específica (com ordenação no cliente) ---
  useEffect(() => {
    if (!groupId || !listId) {
      setItems([]);
      setIsLoading(false);
      console.warn("ListDetail: Group ID or List ID is missing.");
      return () => {}; 
    }

    setIsLoading(true); // Inicia loading ao buscar/escutar
    console.log(`ListDetail: Setting up items listener for list: ${listId} in group: ${groupId}`);

    // Query para buscar itens DENTRO da sub-subcoleção específica
    const itemsQuery = query(
      collection(db, "groups", groupId, "shoppingLists", listId, "items")
    );

    // Configura o listener em tempo real
    const unsubscribe = onSnapshot(itemsQuery, (querySnapshot) => {
      const fetchedItems: ShoppingListItemData[] = [];
      querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.name && data.quantity !== undefined && data.unit && data.addedBy && data.addedAt && data.isBought !== undefined) {
             fetchedItems.push({ id: doc.id, ...data } as ShoppingListItemData);
          } else {
              console.warn(`ListDetail: Item document ${doc.id} ignored due to incomplete data.`);
          }
      });

      // --- ORDENAÇÃO NO CLIENTE ---
      fetchedItems.sort((a, b) => {
        // 1. Itens não comprados (isBought: false) vêm primeiro
        if (a.isBought !== b.isBought) {
          return a.isBought ? 1 : -1; // false (não comprado) retorna -1, vem antes
        }
        // 2. Para itens com o mesmo status 'isBought', ordena por data de adição (mais recente primeiro)
        // Compara os milissegundos dos Timestamps
        const timeA = a.addedAt?.toMillis() || 0; // Usa 0 se addedAt for nulo (não deve acontecer)
        const timeB = b.addedAt?.toMillis() || 0;
        return timeB - timeA; // Ordem decrescente (maior timestamp = mais recente)
      });
      // --------------------------

      console.log(`ListDetail: Fetched and sorted ${fetchedItems.length} items.`);
      setItems(fetchedItems); // Atualiza o estado com os itens ordenados
      setIsLoading(false); // Finaliza o loading inicial
      setIsRefreshing(false); // Finaliza o refresh se estava ativo
    }, (error) => {
      // Tratamento de erro do listener
      console.error("ListDetail: Error listening to items:", error);
      Alert.alert("Erro", "Não foi possível carregar os itens da lista.");
      setIsLoading(false);
      setIsRefreshing(false);
    });

    // Função de limpeza: remove o listener quando o componente desmontar ou as dependências mudarem
    return () => {
        console.log("ListDetail: Cleaning up items listener for list:", listId);
        unsubscribe();
    }
  }, [groupId, listId]); // Reativa o listener se groupId ou listId mudarem

  // Função Completa: handleToggleBought (para ser usada dentro do componente ListDetailScreen)
// Certifique-se de que 'groupId', 'listId', 'currentUser', 'db', 'writeBatch', 'doc', 'collection',
// 'serverTimestamp', 'Timestamp', 'getDocs', 'query', 'where', 'limit', 'updateDoc', 'set', 'deleteDoc',
// e 'Alert' estejam disponíveis no escopo onde esta função for definida (geralmente dentro do componente React).
// A interface ShoppingListItemData também deve estar importada/definida.

const handleToggleBought = async (item: ShoppingListItemData) => {
  // Verifica dados essenciais que devem vir do escopo do componente (contexto, auth)
  if (!groupId || !listId || !currentUser) {
    Alert.alert("Erro", "Informações de grupo, lista ou usuário ausentes para completar a ação.");
    return; // Interrompe a execução se faltar dados cruciais
  }

  // Referência ao documento do item específico na lista de compras
  const itemDocRef = doc(db, "groups", groupId, "shoppingLists", listId, "items", item.id);
  // Calcula o novo status (o inverso do atual)
  const newStatus = !item.isBought;

  // Cria um Batched Write para garantir que todas as operações sejam atômicas
  const batch = writeBatch(db);
  // Pega um timestamp do servidor para usar em várias atualizações (opcional, mas bom para consistência)
  const currentTimestamp = serverTimestamp();

  try {
    // --- Lógica para quando MARCA o item como comprado ---
    if (newStatus === true) {
      console.log(`ListDetail: Item ${item.id} (${item.name}) marked as bought.`);

      // 1. Prepara atualização do item da lista de compras
      const itemUpdateData: any = { // Usar 'any' ou Partial<> para flexibilidade com linkedTransactionId
          isBought: true,
          boughtAt: currentTimestamp, // Usa o timestamp do servidor
          boughtBy: currentUser.uid,
          // linkedTransactionId será definido abaixo se uma transação for criada
      };

      // 2. Prepara criação da transação (APENAS se houver valor estimado válido)
      const itemValue = item.estimatedValue;
      let transactionId: string | null = null; // Guarda o ID da transação se for criada

      if (itemValue !== undefined && itemValue > 0) {
          // Define o caminho para a subcoleção de transações do grupo
          const transCollectionPath = collection(db, "groups", groupId, "transactions");
          // Cria uma referência para o novo documento de transação (isso gera o ID localmente)
          const newTransactionRef = doc(transCollectionPath);
          transactionId = newTransactionRef.id; // Armazena o ID gerado

          // Prepara os dados da nova transação de despesa
          const transactionData = {
               value: itemValue, // Valor da transação (baseado no estimado)
               type: 'expense' as 'expense', // Tipo despesa
               category: item.category || 'Compras', // Categoria do item ou default
               description: `Compra: ${item.name}`, // Descrição automática
               date: currentTimestamp as Timestamp, // Data da transação (mesma da compra) - Cast para TS
               userId: currentUser.uid, // Usuário que marcou como comprado
               createdAt: serverTimestamp(), // Quando a transação foi criada
          };
          // Adiciona a operação de CRIAÇÃO da transação ao batch
          batch.set(newTransactionRef, transactionData);
          // Adiciona o ID da transação criada aos dados de atualização do item da lista
          itemUpdateData.linkedTransactionId = transactionId;
          console.log(`ListDetail: Transaction creation prepared (${transactionId}) for item ${item.id}.`);
      } else {
           // Se não tem valor, garante que não há link e avisa
           itemUpdateData.linkedTransactionId = null;
           console.warn(`Item ${item.id} checked off without valid estimated value. No transaction created.`);
           // Alert.alert("Atenção", `"${item.name}" marcado como comprado, mas sem valor estimado. Nenhuma despesa foi registrada.`);
      }

       // 3. Prepara interação com o Inventário (busca item existente ou prepara criação)
       const inventoryCollectionRef = collection(db, "groups", groupId, "inventoryItems");
       // Busca item no inventário pelo nome exato (case-sensitive padrão)
       // ATENÇÃO: Para busca case-insensitive, salve um campo nome_lowercase e busque por ele.
       const inventoryQuery = query(inventoryCollectionRef, where("name", "==", item.name), limit(1));

       // Executa a busca pelo item no inventário
       // É necessário fazer essa leitura *antes* de commitar o batch
       const inventorySnapshot = await getDocs(inventoryQuery);

       if (!inventorySnapshot.empty) {
           // --- Item ENCONTRADO no inventário: Atualiza ---
           const inventoryDoc = inventorySnapshot.docs[0];
           const currentInventoryData = inventoryDoc.data() as InventoryItemData;
           const newQuantity = (currentInventoryData.quantity || 0) + item.quantity; // Soma quantidade comprada
           console.log(`ListDetail: Updating inventory item ${inventoryDoc.id}. New quantity: ${newQuantity}`);

           // Prepara os dados para atualizar o item existente no inventário
           const inventoryUpdateData: Partial<InventoryItemData> = { // Usa Partial
               quantity: newQuantity,
               lastPurchaseDate: currentTimestamp as Timestamp, // Cast para TS
               lastPurchaseValue: itemValue !== undefined ? itemValue * item.quantity : null, // Valor TOTAL da compra
               lastPurchaseQuantity: item.quantity, // Quantidade desta compra
               updatedAt: currentTimestamp as Timestamp, // Cast para TS
               lastUpdatedBy: currentUser.uid,
               // Atualiza categoria e unidade se foram definidos no item da lista
               ...(item.category && { category: item.category }),
               ...(item.unit && { unit: item.unit }),
               ...(item.store && { store: item.store }), // Atualiza loja se definida
           };
           // Adiciona a operação de ATUALIZAÇÃO do inventário ao batch
           batch.update(inventoryDoc.ref, inventoryUpdateData);

       } else {
           // --- Item NÃO ENCONTRADO no inventário: Cria novo ---
           console.log(`ListDetail: Item ${item.name} not found in inventory. Creating new entry.`);
           const newInventoryItemRef = doc(inventoryCollectionRef); // Gera referência para novo item

           // Prepara os dados para o novo item do inventário
           // Define tipo explícito para checagem ou usa 'any'/'Partial'
           const newInventoryData: any = {
                name: item.name,
                quantity: item.quantity, // Qtde inicial = qtde comprada
                unit: item.unit,
                category: item.category || 'Geral', // Categoria do item ou default
                lastPurchaseDate: currentTimestamp, // Timestamp do servidor
                lastPurchaseValue: itemValue !== undefined ? itemValue * item.quantity : null,
                lastPurchaseQuantity: item.quantity,
                nextPurchaseDate: null, // Planejamento futuro inicia null
                nextPurchaseValue: null,
                addedAt: currentTimestamp, // Data de adição = data da compra
                updatedAt: currentTimestamp,
                addedBy: currentUser.uid, // Quem comprou/adicionou
                lastUpdatedBy: currentUser.uid,
                groupId: groupId, // Inclui ID do grupo se necessário
                // Adiciona store se existir no item da lista
                ...(item.store && { store: item.store }),
           };
           // Adiciona a operação de CRIAÇÃO do item de inventário ao batch
           batch.set(newInventoryItemRef, newInventoryData);
       }

      // 4. Adiciona atualização do item da LISTA DE COMPRAS ao batch
      batch.update(itemDocRef, itemUpdateData);


    } else {
      // --- AÇÃO: DESMARCANDO ---
      console.log(`ListDetail: Item ${item.id} (${item.name}) unchecked.`);

      // 1. Prepara atualização do item da lista de compras para desmarcar
      batch.update(itemDocRef, {
        isBought: false,
        boughtAt: null,
        boughtBy: null,
        linkedTransactionId: null // Limpa o link da transação
      });

      // 2. Prepara exclusão da transação vinculada (se existir)
      if (item.linkedTransactionId) {
        console.log(`ListDetail: Preparing to delete linked transaction: ${item.linkedTransactionId}`);
        const transactionToDeleteRef = doc(db, "groups", groupId, "transactions", item.linkedTransactionId);
        // Adiciona a operação de EXCLUSÃO da transação ao batch
        batch.delete(transactionToDeleteRef);
      } else {
           console.log(`ListDetail: Unchecking item ${item.id}, no linked transaction found.`);
      }

      // 3. NÃO remove do inventário ao desmarcar (decisão de design atual)
      console.log("ListDetail: Inventory quantity not decreased on uncheck.");
    }

    // 5. Executa TODAS as operações (update item lista + add/delete transação + add/update inventário) no batch
    await batch.commit();
    console.log(`ListDetail: Batch write successful for item ${item.id}, new status isBought=${newStatus}`);
    // Opcional: Adicionar feedback de sucesso (Toast)

  } catch (error: any) {
    console.error("ListDetail: Error in batched write for toggling item/inventory/transaction:", error);
    Alert.alert("Erro", "Não foi possível atualizar o item, inventário e/ou transação correspondente.");
    // Nota: Em caso de erro no batch, nenhuma das operações é aplicada.
  }
}; // --- Fim da função handleToggleBought ---
  // ---------------------------------------------------------------------

  const handleEditItem = (item: ShoppingListItemData) => {
    console.log("Editing item:", item.id);
    setEditingItem(item); // Define o item a ser editado
    setIsAddItemModalVisible(true); // Abre o modal (que agora lida com edição)
};

// --- Handler para EXCLUIR Item (e transação vinculada) ---
  const handleDeleteItem = (itemToDelete: ShoppingListItemData) => {
      if (!groupId || !listId) {
           Alert.alert("Erro", "Não foi possível identificar o grupo ou a lista.");
           return;
      };

      // Confirmação movida para dentro do ShoppingListItem,
      // aqui apenas executamos a exclusão se chamado
      console.log("Deleting item:", itemToDelete.id);
      const itemDocRef = doc(db, "groups", groupId, "shoppingLists", listId, "items", itemToDelete.id);
      const batch = writeBatch(db); // Usa batch para garantir atomicidade

      // 1. Adiciona exclusão do item ao batch
      batch.delete(itemDocRef);

      // 2. Verifica e adiciona exclusão da transação vinculada ao batch
      if (itemToDelete.linkedTransactionId) {
          console.log(`Also deleting linked transaction: ${itemToDelete.linkedTransactionId}`);
          const transDocRef = doc(db, "groups", groupId, "transactions", itemToDelete.linkedTransactionId);
          batch.delete(transDocRef);
      }

      // 3. Commita o batch
      batch.commit()
          .then(() => {
              console.log("Item and potentially linked transaction deleted successfully.");
              Alert.alert("Sucesso", `"${itemToDelete.name}" foi excluído.`);
              // O listener onSnapshot atualizará a lista na UI
          })
          .catch((error) => {
              console.error("Error deleting item/transaction batch:", error);
              Alert.alert("Erro", "Não foi possível excluir o item.");
          });
  };

  // --- Cálculo do Resumo da Lista (usando useMemo para otimização) ---
  const listSummary = useMemo(() => {
      const totalItems = items.length;
      if (totalItems === 0) return { percentage: 0, totalSpent: 0 };

      const boughtItems = items.filter(item => item.isBought);
      const boughtCount = boughtItems.length;
      // Soma o VALOR ESTIMADO dos itens MARCADOS COMO COMPRADOS
      const totalSpent = boughtItems.reduce((sum, item) => sum + (item.estimatedValue || 0), 0);
      const percentage = Math.round((boughtCount / totalItems) * 100);

      return { percentage, totalSpent };
  }, [items]); // Recalcula apenas quando o array 'items' mudar

  // --- Handler de Refresh ---
  const onRefresh = useCallback(() => {
    // Apenas ativa o indicador. O listener onSnapshot cuidará de buscar os dados mais recentes.
    console.log("ListDetail: Refresh triggered.");
    setIsRefreshing(true);
    // O listener já definirá isRefreshing=false quando receber dados.
    // Adiciona um fallback caso o listener demore muito ou falhe silenciosamente.
    setTimeout(() => {
        if (isRefreshing) { // Só para o spinner se ainda estiver ativo
            setIsRefreshing(false);
            console.log("ListDetail: Refresh fallback timeout.");
        }
    }, 3000); // Timeout de 3 segundos
  }, [isRefreshing]); // Depende de isRefreshing para evitar múltiplos timeouts


  // --- Handler para fechar modal (limpa estado de edição) ---
  const closeAddEditModal = () => {
    setIsAddItemModalVisible(false);
    setEditingItem(null); // Limpa item em edição ao fechar
  };

  // --- Renderização ---
  const styles = getStyles(colors); // Pega os estilos do tema

  // Loading inicial (antes do primeiro fetch de itens)
  if (isLoading && items.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Se não encontrou groupId ou listId (não deveria acontecer se navegou corretamente)
  if (!groupId || !listId) {
       return (
          <View style={[styles.container, styles.centered]}>
              <Text style={styles.title}>Erro</Text>
              <Text style={styles.subtitle}>ID do Grupo ou da Lista não encontrado.</Text>
          </View>
       );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: listNameParam || 'Itens da Lista', headerShown: true, headerStyle: { backgroundColor: colors.bottomSheet }, headerTintColor: colors.textPrimary }}
      />
      
      <View style={styles.summaryHeader}>
            <Text style={styles.summaryText}>Comprado: {listSummary.percentage}%</Text>
            <Text style={styles.summaryText}>Gasto (Est.): {listSummary.totalSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
      </View>

      {/* Lista de Itens ou Mensagem de Lista Vazia */}
      {items.length === 0 && !isLoading ? ( // Mostra se não está carregando e não há itens
          <View style={styles.centered}>
            <Ionicons name="cart-outline" size={60} color={colors.textSecondary} style={{marginBottom: 20}}/>
            <Text style={styles.title}>Lista Vazia</Text>
            <Text style={styles.subtitle}>Adicione o primeiro item usando o botão (+).</Text>
          </View>
      ) : (
          <FlatList
            data={items}
            renderItem={({ item }) => (
              <ShoppingListItem
                  item={item}
                  onToggleBought={() => handleToggleBought(item)}
                  onEdit={() => handleEditItem(item)}     // <-- Passa handler de edição
                  onDelete={() => handleDeleteItem(item)} // <-- Passa handler de exclusão
              />
            )}
            keyExtractor={(item) => item.id} // Usa o ID do Firestore como chave
            contentContainerStyle={styles.listContent} // Estilo para espaçamento interno
            // Funcionalidade "Puxar para Atualizar"
            refreshControl={
              <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={onRefresh}
                  colors={[colors.primary]} // Cor do spinner Android
                  tintColor={colors.primary} // Cor do spinner iOS
              />
            }
            ListFooterComponent={isLoading && items.length > 0 ? <ActivityIndicator style={{margin: 20}} color={colors.primary} /> : null}
          />
      )}

      {/* Botão Flutuante para Adicionar Item */}
      <AddTransactionFAB onPress={() => setIsAddItemModalVisible(true)} />

      {/* Modal para Adicionar Item */}
      <AddShoppingItemModal
          isVisible={isAddItemModalVisible}
          onClose={closeAddEditModal} // Usa a função que limpa edição
          groupId={groupId}
          listId={listId}
          itemToEdit={editingItem}
      />
    </View>
  );
}

// --- Estilos ---
const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  listContent: { padding: 15, paddingBottom: 80 },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 5,
  },
  summaryText: {
    fontSize: 14, 
    color: colors.textPrimary,
    fontWeight: '600', 
  },
   title: { // Estilo para mensagem de lista vazia
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 10,
      textAlign: 'center',
  },
  subtitle: { // Estilo para mensagem de lista vazia
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
  },
});