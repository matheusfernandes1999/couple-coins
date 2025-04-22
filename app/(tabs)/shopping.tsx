// app/(tabs)/shopping.tsx
import React, { useState, useEffect, useRef } from 'react'; 
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useGroup } from '@/context/GroupContext';   
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/lib/firebase';           
import { collection, query, onSnapshot, where, doc, updateDoc, Unsubscribe } from 'firebase/firestore'; 
import { ShoppingList, ShoppingListItemData, ShoppingListSummary } from '@/types'; 
import AddShoppingListModal from '@/components/dashboard/AddShoppingListModal';     
import AddTransactionFAB from '@/components/dashboard/AddTransactionFAB';        
import { useRouter } from 'expo-router';
import { showMessage } from 'react-native-flash-message';

export default function ShoppingScreen() {
  const { colors } = useTheme();
  const { groupId, isLoadingGroup } = useGroup();
  const router = useRouter();

  const [listsWithSummaries, setListsWithSummaries] = useState<ShoppingList[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const itemListenersRef = useRef<Record<string, Unsubscribe>>({});

  useEffect(() => {
    Object.values(itemListenersRef.current).forEach(unsub => unsub());
    itemListenersRef.current = {};

    if (!groupId) {
      setListsWithSummaries([]);
      setIsLoadingData(false);
      return () => { 
         Object.values(itemListenersRef.current).forEach(unsub => unsub());
         itemListenersRef.current = {};
      };
    }

    if (!isLoadingGroup) setIsLoadingData(true);
    setListsWithSummaries([]); 

    const listsQuery = query(
      collection(db, "groups", groupId, "shoppingLists"),
      where("archived", "==", false),
    );

    const unsubscribeLists = onSnapshot(listsQuery, (querySnapshot) => {
      const fetchedListsMap = new Map<string, ShoppingList>();
      querySnapshot.forEach((doc) => {
        fetchedListsMap.set(doc.id, { id: doc.id, ...doc.data() } as ShoppingList);
      });
      const fetchedListIds = Array.from(fetchedListsMap.keys());
      console.log(`ShoppingScreen: Fetched ${fetchedListIds.length} active list IDs.`);
      setIsLoadingData(false); 
      setListsWithSummaries(Array.from(fetchedListsMap.values()));
      Object.keys(itemListenersRef.current).forEach(listId => {
          if (!fetchedListsMap.has(listId)) {
              console.log(`ShoppingScreen: Cleaning up item listener for removed list ${listId}`);
              itemListenersRef.current[listId](); 
              delete itemListenersRef.current[listId]; 
          }
      });

      fetchedListIds.forEach(listId => {
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

                setListsWithSummaries(currentLists =>
                    currentLists.map(currentList =>
                        currentList.id === listId ? { ...currentList, summary } : currentList
                    )
                );
            }, (error) => {
                console.error(`ShoppingScreen: Error listening to items in list ${listId}:`, error);
                 setListsWithSummaries(currentLists =>
                     currentLists.map(currentList =>
                         currentList.id === listId ? { ...currentList, summary: undefined } : currentList // Limpa resumo em caso de erro
                     )
                 );
            });
            itemListenersRef.current[listId] = unsubscribeItem;
        }
      });

    }, (error) => {
      console.error("ShoppingScreen: Error listening to lists:", error);
      setIsLoadingData(false);
       Object.values(itemListenersRef.current).forEach(unsub => unsub());
       itemListenersRef.current = {};
    });

    return () => {
      console.log("ShoppingScreen: Cleaning up ALL listeners for group:", groupId);
      unsubscribeLists();
      Object.values(itemListenersRef.current).forEach(unsub => unsub());
      itemListenersRef.current = {};
    };
  }, [groupId, isLoadingGroup]); 
  
  const handleArchiveToggle = async (listId: string, currentStatus: boolean) => {
    if (!groupId) return;
    const listDocRef = doc(db, "groups", groupId, "shoppingLists", listId);
    try {
      await updateDoc(listDocRef, { archived: !currentStatus });
      showMessage({
        message: "Sucesso!",
        description: `Lista ${!currentStatus ? "desarquivada" : "arquivada"} com sucesso.`,
        backgroundColor: colors.success,
        color: colors.textPrimary,
      });
    } catch (error) {
      showMessage({
        message: "Ops!",
        description: "Não foi possível arquivar/desarquivar a lista.",
        backgroundColor: colors.error,
        color: colors.textPrimary,
      });
    }
  };

  const navigateToListDetail = (list: ShoppingList) => {
    router.push({
      pathname: "/screens/[listId]", 
      params: { listId: list.id, name: list.name }
    });
  };

  const navigateToArchived = () => {
    router.push("/screens/archived"); 
  };

  const renderListItem = ({ item }: { item: ShoppingList }) => (
    <TouchableOpacity onPress={() => navigateToListDetail(item)} style={styles.listItem}>
      <View style={styles.listItemContent}>
        <Ionicons name="list-circle-outline" size={32} color={colors.primary} style={styles.listIcon} />
        <View style={styles.listTextContainer}>
          <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.listSummary}>
            {item.summary 
              ? `${item.summary.percentageBought}% • Est. ${item.summary.totalEstimatedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
              : 'Sem items' 
            }
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => handleArchiveToggle(item.id, item.archived)} style={styles.archiveButton}>
        <Ionicons name="archive-outline" size={22} color={colors.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const styles = getStyles(colors);

  if (isLoadingGroup || (isLoadingData && listsWithSummaries.length === 0)) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!groupId) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle-outline" size={60} color={colors.textSecondary} style={styles.icon} />
        <Text style={styles.title}>Sem Grupo</Text>
        <Text style={styles.subtitle}>Crie ou entre em um grupo para ver suas listas.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.archivedButton} onPress={navigateToArchived}>
        <Ionicons name="archive" size={18} color={colors.secondary} />
        <Text style={styles.archivedButtonText}> Ver Listas Arquivadas</Text>
      </TouchableOpacity>

      {listsWithSummaries.length === 0 && !isLoadingData ? (
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
        />
      )}

      <AddTransactionFAB onPress={() => setIsModalVisible(true)} />

      <AddShoppingListModal
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        groupId={groupId} 
      />
    </View>
  );
}

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
  archivedButtonText: { color: colors.secondary, fontSize: 15, fontWeight: '500', marginLeft: 5 },
});