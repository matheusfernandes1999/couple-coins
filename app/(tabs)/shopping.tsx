// app/(tabs)/shopping.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'; // Adicionado useRef
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext'; // Ajuste o caminho
import { useGroup } from '../../context/GroupContext';   // Ajuste o caminho
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../lib/firebase';           // Ajuste o caminho
import { collection, query, onSnapshot, orderBy, where, doc, updateDoc, Unsubscribe } from 'firebase/firestore'; // Import Unsubscribe
import { ShoppingList, ShoppingListItemData, ShoppingListSummary } from '@/types'; // Ajuste o caminho
import AddShoppingListModal from '@/components/dashboard/AddShoppingListModal';     // Ajuste o caminho
import AddTransactionFAB from '@/components/dashboard/AddTransactionFAB';         // Ajuste o caminho
import { useRouter } from 'expo-router';

export default function ShoppingScreen() {
  const { colors } = useTheme();
  const { groupId, isLoadingGroup } = useGroup();
  const router = useRouter();

  // Estado para listas com resumos
  const [listsWithSummaries, setListsWithSummaries] = useState<ShoppingList[]>([]);
  // Loading das listas e resumos (combinado para simplificar UI)
  const [isLoadingData, setIsLoadingData] = useState(true);
  // Modal de adicionar lista
  const [isModalVisible, setIsModalVisible] = useState(false);
  // Ref para armazenar funções de unsubscribe dos listeners de itens
  const itemListenersRef = useRef<Record<string, Unsubscribe>>({}); // Guarda { listId: unsubscribeFn }

  // --- Listener Principal para Listas Ativas ---
  useEffect(() => {
    // Limpa listeners de itens anteriores ao (re)iniciar
    Object.values(itemListenersRef.current).forEach(unsub => unsub());
    itemListenersRef.current = {};

    if (!groupId) {
      setListsWithSummaries([]);
      setIsLoadingData(false);
      return () => { // Garante cleanup se groupId ficar null
         Object.values(itemListenersRef.current).forEach(unsub => unsub());
         itemListenersRef.current = {};
      };
    }

    // Inicia loading sempre que o grupo muda
    if (!isLoadingGroup) setIsLoadingData(true);
    setListsWithSummaries([]); // Limpa ao trocar grupo

    console.log("ShoppingScreen: Setting up ACTIVE lists listener for group:", groupId);
    const listsQuery = query(
      collection(db, "groups", groupId, "shoppingLists"),
      where("archived", "==", false),
    );

    const unsubscribeLists = onSnapshot(listsQuery, (querySnapshot) => {
      const fetchedListsMap = new Map<string, ShoppingList>(); // Usa Map para fácil atualização
      querySnapshot.forEach((doc) => {
        fetchedListsMap.set(doc.id, { id: doc.id, ...doc.data() } as ShoppingList);
      });
      const fetchedListIds = Array.from(fetchedListsMap.keys());
      console.log(`ShoppingScreen: Fetched ${fetchedListIds.length} active list IDs.`);
      setIsLoadingData(false); // Termina loading DAS LISTAS

      // Atualiza o estado principal das listas (inicialmente sem resumos)
      // Isso garante que as listas apareçam rapidamente
      setListsWithSummaries(Array.from(fetchedListsMap.values()));

      // --- Gerencia Sub-listeners para Itens e Resumos ---
      // Remove listeners de listas que não existem mais
      Object.keys(itemListenersRef.current).forEach(listId => {
          if (!fetchedListsMap.has(listId)) {
              console.log(`ShoppingScreen: Cleaning up item listener for removed list ${listId}`);
              itemListenersRef.current[listId](); // Chama unsubscribe
              delete itemListenersRef.current[listId]; // Remove da ref
          }
      });

      // Cria listeners para novas listas ou atualiza existentes
      fetchedListIds.forEach(listId => {
        // Só cria listener se não existir um ativo para essa lista
        if (!itemListenersRef.current[listId]) {
            console.log(`ShoppingScreen: Setting up item listener for list ${listId}`);
            const itemsQuery = query(collection(db, "groups", groupId, "shoppingLists", listId, "items"));

            const unsubscribeItem = onSnapshot(itemsQuery, (itemsSnapshot) => {
                console.log(`ShoppingScreen: Items updated for list ${listId}. Recalculating summary.`);
                let totalValue = 0;
                let boughtCount = 0;
                const totalItems = itemsSnapshot.size;

                itemsSnapshot.forEach(itemDoc => {
                    const itemData = itemDoc.data() as Omit<ShoppingListItemData, 'id'>;
                    totalValue += itemData.estimatedValue || 0;
                    if (itemData.isBought) {
                        boughtCount++;
                    }
                });

                const percentage = totalItems > 0 ? Math.round((boughtCount / totalItems) * 100) : 0;
                const summary: ShoppingListSummary = { percentageBought: percentage, totalEstimatedValue: totalValue };

                // Atualiza o resumo APENAS para a lista específica no estado
                setListsWithSummaries(currentLists =>
                    currentLists.map(currentList =>
                        currentList.id === listId ? { ...currentList, summary } : currentList
                    )
                );
            }, (error) => {
                console.error(`ShoppingScreen: Error listening to items in list ${listId}:`, error);
                // Opcional: Limpar resumo ou mostrar erro na UI da lista específica
                 setListsWithSummaries(currentLists =>
                     currentLists.map(currentList =>
                         currentList.id === listId ? { ...currentList, summary: undefined } : currentList // Limpa resumo em caso de erro
                     )
                 );
            });
            // Armazena a função de unsubscribe na Ref
            itemListenersRef.current[listId] = unsubscribeItem;
        }
      });
      // -------------------------------------------------

    }, (error) => {
      console.error("ShoppingScreen: Error listening to lists:", error);
      setIsLoadingData(false);
       Object.values(itemListenersRef.current).forEach(unsub => unsub());
       itemListenersRef.current = {};
    });

    // Função de limpeza principal: desinscreve do listener das listas E de todos os listeners de itens ativos
    return () => {
      console.log("ShoppingScreen: Cleaning up ALL listeners for group:", groupId);
      unsubscribeLists();
      Object.values(itemListenersRef.current).forEach(unsub => unsub());
      itemListenersRef.current = {};
    };
  }, [groupId, isLoadingGroup]); // Dependências principais

  // --- Handler para Arquivar/Desarquivar ---
  const handleArchiveToggle = async (listId: string, currentStatus: boolean) => {
    if (!groupId) return;
    const listDocRef = doc(db, "groups", groupId, "shoppingLists", listId);
    try {
      await updateDoc(listDocRef, { archived: !currentStatus });
      console.log(`List ${listId} archive status set to ${!currentStatus}`);
      // Feedback visual opcional (Toast)
    } catch (error) {
      console.error("Error toggling archive status:", error);
      Alert.alert("Erro", "Não foi possível arquivar/desarquivar a lista.");
    }
  };

  // --- Handler Navegação para Detalhes ---
  const navigateToListDetail = (list: ShoppingList) => {
    // Passa nome para evitar busca extra na tela de detalhe se desejar
    router.push({
      pathname: "/screens/[listId]", // Ajuste se sua rota for diferente
      params: { listId: list.id, name: list.name }
    });
  };

  // --- Handler Navegação para Arquivadas ---
  const navigateToArchived = () => {
    router.push("/screens/archived"); // Ajuste se sua rota for diferente
  };

  // --- Render Item da Lista de Listas ---
  const renderListItem = ({ item }: { item: ShoppingList }) => (
    <TouchableOpacity onPress={() => navigateToListDetail(item)} style={styles.listItem}>
      <View style={styles.listItemContent}>
        <Ionicons name="list-circle-outline" size={32} color={colors.primary} style={styles.listIcon} />
        <View style={styles.listTextContainer}>
          <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.listSummary}>
            {item.summary // Verifica se o resumo foi calculado
              ? `${item.summary.percentageBought}% • Est. ${item.summary.totalEstimatedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
              : 'Carregando...' // Mostra enquanto calcula/espera listener
            }
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => handleArchiveToggle(item.id, item.archived)} style={styles.archiveButton}>
        <Ionicons name="archive-outline" size={22} color={colors.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // --- Renderização Principal ---
  const styles = getStyles(colors);

  // Loading inicial geral
  if (isLoadingGroup || (isLoadingData && listsWithSummaries.length === 0)) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Sem grupo definido
  if (!groupId) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle-outline" size={60} color={colors.textSecondary} style={styles.icon} />
        <Text style={styles.title}>Sem Grupo</Text>
        <Text style={styles.subtitle}>Crie ou entre em um grupo para ver suas listas.</Text>
      </View>
    );
  }

  // Tela principal
  return (
    <View style={styles.container}>
      {/* Botão para ver arquivadas */}
      <TouchableOpacity style={styles.archivedButton} onPress={navigateToArchived}>
        <Ionicons name="archive" size={18} color={colors.primary} />
        <Text style={styles.archivedButtonText}> Ver Listas Arquivadas</Text>
      </TouchableOpacity>

      {/* Exibição das Listas Ativas */}
      {listsWithSummaries.length === 0 && !isLoadingData ? ( // Mostra se terminou de carregar e está vazio
        <View style={styles.centered}>
           <Ionicons name="cart-outline" size={60} color={colors.textSecondary} style={styles.icon}/>
           <Text style={styles.title}>Nenhuma Lista Ativa</Text>
           <Text style={styles.subtitle}>Use o botão (+) para criar uma nova lista.</Text>
        </View>
      ) : (
        <FlatList
          data={listsWithSummaries}
          renderItem={renderListItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          // Não precisa mais do ListFooterComponent para loading de resumos aqui
        />
      )}

      {/* FAB para adicionar NOVA LISTA */}
      <AddTransactionFAB onPress={() => setIsModalVisible(true)} />

      {/* Modal para adicionar NOVA LISTA */}
      <AddShoppingListModal
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        groupId={groupId} // Passa o ID do grupo atual
      />
    </View>
  );
}

// --- Estilos ---
const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  listContent: { paddingHorizontal: 15, paddingTop: 5, paddingBottom: 80 },
  icon: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: 'center' },
  listItem: { backgroundColor: colors.surface, padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border },
  listItemContent: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  listIcon: { marginRight: 12 },
  listTextContainer: { flex: 1 },
  listName: { fontSize: 17, fontWeight: '500', color: colors.textPrimary, marginBottom: 3 },
  listSummary: { fontSize: 13, color: colors.textSecondary },
  archiveButton: { padding: 5 },
  archivedButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginHorizontal: 15, marginBottom: 10, marginTop: 10 },
  archivedButtonText: { color: colors.primary, fontSize: 15, fontWeight: '500', marginLeft: 5 },
});