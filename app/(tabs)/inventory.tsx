// app/(tabs)/inventory.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SectionList,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
    TextInput, 
    Platform          
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';         
import { useGroup } from '@/context/GroupContext';        
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '@/lib/firebase';                 
import {
    collection, query, onSnapshot, doc,
    updateDoc, addDoc, serverTimestamp,
    writeBatch, deleteDoc, where,
} from 'firebase/firestore';
import { InventoryItemData, ShoppingList } from '@/types';
import InventoryListItem from '@/components/inventory/InventoryListItem';      
import AddInventoryItemModal from '@/components/inventory/AddInventoryItemModal';
import SelectShoppingListModal from '@/components/inventory/SelectShoppingListModal'; 
import InventoryItemDetailModal from '@/components/inventory/InventoryItemDetailModal';
import AddTransactionFAB from '@/components/dashboard/AddTransactionFAB';            
import { showMessage } from 'react-native-flash-message';

interface InventorySection {
    title: string; 
    data: InventoryItemData[];
}

export default function InventoryScreen() {
    const { colors } = useTheme();                       
    const { groupId, isLoadingGroup } = useGroup();        
    const currentUser = auth.currentUser;                 

    const [rawInventoryItems, setRawInventoryItems] = useState<InventoryItemData[]>([]);
    const [isLoading, setIsLoading] = useState(true);                           
    const [searchQuery, setSearchQuery] = useState('');                        
    const [availableShoppingLists, setAvailableShoppingLists] = useState<ShoppingList[]>([]); 

    const [isAddItemModalVisible, setIsAddItemModalVisible] = useState(false);
    const [isSelectListModalVisible, setIsSelectListModalVisible] = useState(false);
    const [itemToAddToShoppingList, setItemToAddToShoppingList] = useState<InventoryItemData | null>(null);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItemData | null>(null);
    const [editingInventoryItem, setEditingInventoryItem] = useState<InventoryItemData | null>(null);

    useEffect(() => {
        if (!groupId) {
            setRawInventoryItems([]);
            setIsLoading(false);
            return () => { };
        }
        if (!isLoadingGroup) setIsLoading(true);

        const inventoryQuery = query(collection(db, "groups", groupId, "inventoryItems"));

        const unsubscribe = onSnapshot(inventoryQuery, (querySnapshot) => {
            const fetchedItems: InventoryItemData[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.name && data.quantity !== undefined && data.unit) {
                    fetchedItems.push({ id: doc.id, groupId: groupId, ...data } as InventoryItemData);
                } else {
                    showMessage({
                        message: "Ops!",
                        description: "Item inválido encontrado no inventário.",
                        backgroundColor: colors.error,
                        color: colors.textPrimary,
                    });
                }
            });
            setRawInventoryItems(fetchedItems);
            setIsLoading(false);
        }, (error) => {
            showMessage({
                message: "Ops!",
                description: "Erro ao carregar o inventário.",
                backgroundColor: colors.error,
                color: colors.textPrimary,
            });
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [groupId, isLoadingGroup]);

    useEffect(() => {
        if (!groupId) {
            setAvailableShoppingLists([]);
            return () => { };
        }
        const listsQuery = query(
            collection(db, "groups", groupId, "shoppingLists"),
            where("archived", "==", false),
        );
        const unsubscribe = onSnapshot(listsQuery, (snapshot) => {
            const lists: ShoppingList[] = [];
            snapshot.forEach(doc => lists.push({ id: doc.id, ...doc.data() } as ShoppingList));
            setAvailableShoppingLists(lists); 
        });
        return () => unsubscribe();
    }, [groupId]);
    
    const handleEditInventoryItem = (item: InventoryItemData) => {
        setEditingInventoryItem(item);  
        setIsAddItemModalVisible(true); 
    };

    const handleDeleteInventoryItem = async (itemId: string) => {
        if (!groupId) { 
            showMessage({
                message: "Ops!",
                description: "Você não está em um grupo.",
                backgroundColor: colors.error,
                color: colors.textPrimary,
            });
            return; 
        }

        const itemDocRef = doc(db, "groups", groupId, "inventoryItems", itemId);
        try {
            await deleteDoc(itemDocRef);
            showMessage({
                message: "Deu certo!",
                description: "Item removido do inventário.",
                backgroundColor: colors.success,
                color: colors.textPrimary,
            });
        } catch (error) {
            showMessage({
                message: "Ops!",
                description: "Erro ao remover o item.",
                backgroundColor: colors.error,
                color: colors.textPrimary,
            });
        }
    };

    const [sortBy, setSortBy] = useState<'name' | 'lastPurchase' | 'nextPurchase'>('name');
    const handleSortChange = () => {
        setSortBy(currentSort => {
            if (currentSort === 'name') return 'lastPurchase';
            if (currentSort === 'lastPurchase') return 'nextPurchase';
            return 'name';
        });
    };

    const inventorySections = useMemo((): InventorySection[] => {
        let filteredItems = rawInventoryItems.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (sortBy === 'lastPurchase') {
            filteredItems.sort((a, b) => (b.lastPurchaseDate?.toMillis() || 0) - (a.lastPurchaseDate?.toMillis() || 0));
        } else if (sortBy === 'nextPurchase') {
            filteredItems.sort((a, b) => (a.nextPurchaseDate?.toMillis() || Infinity) - (b.nextPurchaseDate?.toMillis() || Infinity));
        }

        const grouped: { [key: string]: InventoryItemData[] } = {};
        filteredItems.forEach(item => {
            const categoryKey = item.category?.trim() || 'Sem Categoria';
            if (!grouped[categoryKey]) grouped[categoryKey] = [];
            grouped[categoryKey].push(item);
        });

        const sectionsArray = Object.keys(grouped)
            .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
            .map(categoryTitle => ({
                title: categoryTitle,
                data: sortBy === 'name'
                    ? grouped[categoryTitle].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
                    : grouped[categoryTitle], 
            }));

        return sectionsArray;

    }, [rawInventoryItems, searchQuery, sortBy]);

    const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
        if (!groupId || newQuantity < 0) return;
        console.log(`InventoryScreen: Updating quantity for ${itemId} to ${newQuantity}`);
        const itemDocRef = doc(db, "groups", groupId, "inventoryItems", itemId);
        try {
            await updateDoc(itemDocRef, {
                quantity: newQuantity,
                updatedAt: serverTimestamp(), 
                lastUpdatedBy: currentUser?.uid || null 
            });
        } catch (error) {
            showMessage({
                message: "Ops!",
                description: "Erro ao atualizar a quantidade.",
                backgroundColor: colors.error,
                color: colors.textPrimary,
            });
        }
    };

    const handleAddToShoppingListPress = (item: InventoryItemData) => {
        setItemToAddToShoppingList(item); 
        setIsSelectListModalVisible(true); 
    };

    const handleAddItemToExistingList = async (listId: string, itemData: InventoryItemData) => {
         if (!groupId || !currentUser) return;
         const newItemForShoppingList: any = {
             name: itemData.name,
             quantity: 1, 
             unit: itemData.unit,
             category: itemData.category || 'Compras', 
             addedBy: currentUser.uid,
             addedAt: serverTimestamp(),
             isBought: false, boughtAt: null, boughtBy: null, linkedTransactionId: null,
         };
         
         if (itemData.store) newItemForShoppingList.store = itemData.store;
         const estimated = itemData.nextPurchaseValue ?? itemData.lastPurchaseValue ?? itemData.estimatedValue ?? undefined; // Tenta pegar valor planejado, depois último, depois estimado
         if (estimated !== undefined) newItemForShoppingList.estimatedValue = estimated;

         try {
             const itemsCollectionRef = collection(db, "groups", groupId, "shoppingLists", listId, "items");
             await addDoc(itemsCollectionRef, newItemForShoppingList);
             showMessage({
                message: "Deu certo!",
                description: `"${itemData.name}" adicionado à lista!`,
                backgroundColor: colors.success,
                color: colors.textPrimary,
            });
             closeSelectListModal(); 
         } catch (error) {
             showMessage({
                message: "Ops!",
                description: "Erro ao adicionar o item à lista.",
                backgroundColor: colors.error,
                color: colors.textPrimary,
            });
         }
    };

    const handleAddItemToNewList = async (newListName: string, itemData: InventoryItemData) => {
        if (!groupId || !currentUser || !newListName.trim()) return;
        const trimmedListName = newListName.trim();
        const batch = writeBatch(db);

        try {
             const listsCollectionRef = collection(db, "groups", groupId, "shoppingLists");
             const newListRef = doc(listsCollectionRef);
             const newListId = newListRef.id;
             const newListData = { name: trimmedListName, archived: false, createdAt: serverTimestamp() };
             batch.set(newListRef, newListData);
             
             const newItemForShoppingList: any = { 
                name: itemData.name, quantity: 1, unit: itemData.unit,
                category: itemData.category || 'Compras',
                addedBy: currentUser.uid, addedAt: serverTimestamp(),
                isBought: false, boughtAt: null, boughtBy: null, linkedTransactionId: null,
            };
            if (itemData.store) newItemForShoppingList.store = itemData.store;
            const estimated = itemData.nextPurchaseValue ?? itemData.lastPurchaseValue ?? itemData.estimatedValue ?? undefined;
            if (estimated !== undefined) newItemForShoppingList.estimatedValue = estimated;

             const newItemRef = doc(collection(db, "groups", groupId, "shoppingLists", newListId, "items"));
             batch.set(newItemRef, newItemForShoppingList); 
             await batch.commit();

             Alert.alert("Sucesso!", `Lista "${trimmedListName}" criada e "${itemData.name}" adicionado.`);
             showMessage({
                message: "Deu certo!",
                description: `Lista "${trimmedListName}" criada e "${itemData.name}" adicionado.`,
                backgroundColor: colors.success,
                color: colors.textPrimary,
            });
             closeSelectListModal();
        
        } catch(error) {
            showMessage({
                message: "Ops!",
                description: "Erro ao criar a lista ou adicionar o item.",
                backgroundColor: colors.error,
                color: colors.textPrimary,
            });
        }
    };

    const handleItemPress = (item: InventoryItemData) => {
        setSelectedInventoryItem(item); 
        setIsDetailModalVisible(true);
    };

    const closeAddItemModal = () => { setIsAddItemModalVisible(false); setEditingInventoryItem(null); }; 
    const closeSelectListModal = () => {
        setIsSelectListModalVisible(false);
        setItemToAddToShoppingList(null); 
    };
    const closeDetailModal = () => {
        setIsDetailModalVisible(false);
        setSelectedInventoryItem(null);
    };
    
    const renderInventoryItem = ({ item }: { item: InventoryItemData }) => (
        <InventoryListItem
            item={item}
            onUpdateQuantity={handleUpdateQuantity} 
            onAddToShoppingList={() => handleAddToShoppingListPress(item)} 
            onPress={() => handleItemPress(item)} 
            onEdit={() => handleEditInventoryItem(item)}  
            onDelete={() => handleDeleteInventoryItem(item.id)}
        />
    );

    const renderSectionHeader = ({ section: { title } }: { section: InventorySection }) => (
       <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
       </View>
    );

    const styles = getStyles(colors);

    if (isLoadingGroup || isLoading) {
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

    let sortIconName: React.ComponentProps<typeof Ionicons>['name'] = 'swap-vertical';
    let sortText = 'Nome';
    if (sortBy === 'lastPurchase') { sortText = 'Últ. Compra'; sortIconName = 'arrow-down'; }
    else if (sortBy === 'nextPurchase') { sortText = 'Próx. Compra'; sortIconName = 'arrow-up'; }

    return (
        <View style={styles.container}>
            <View style={styles.searchSortContainer}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Pesquisar item..."
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        returnKeyType="search"
                        clearButtonMode="while-editing"
                    />
                    {searchQuery.length > 0 && Platform.OS !== 'ios' && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity onPress={handleSortChange} style={[styles.sortButton, {display: 'none'}]}>
                    <Ionicons name={sortIconName} size={22} color={colors.primary} />
                     <Text style={styles.sortText}>{sortText}</Text>
                </TouchableOpacity>
            </View>

            {inventorySections.length === 0 ? (
                <View style={styles.centered}>
                    <Ionicons name="file-tray-outline" size={60} color={colors.textSecondary} style={styles.icon} />
                    <Text style={styles.title}>{searchQuery ? 'Nenhum Item Encontrado' : 'Inventário Vazio'}</Text>
                    <Text style={styles.subtitle}>
                        {searchQuery
                            ? `Não encontramos itens com "${searchQuery}".`
                            : 'Adicione itens manualmente ou compre itens da sua lista.'}
                    </Text>
                </View>
            ) : (
                <SectionList
                    sections={inventorySections}      
                    renderItem={renderInventoryItem}  
                    renderSectionHeader={renderSectionHeader} 
                    keyExtractor={(item, index) => item.id + index}
                    contentContainerStyle={styles.listContent} 
                    stickySectionHeadersEnabled={true} 
                    keyboardShouldPersistTaps="handled"
                />
            )}

            <AddTransactionFAB onPress={() => setIsAddItemModalVisible(true)} />

            <AddInventoryItemModal
                isVisible={isAddItemModalVisible}
                onClose={closeAddItemModal}
                groupId={groupId}
                itemToEdit={editingInventoryItem} 
            />
             <SelectShoppingListModal
                isVisible={isSelectListModalVisible}
                onClose={closeSelectListModal}
                groupId={groupId}
                availableLists={availableShoppingLists} 
                itemToAdd={itemToAddToShoppingList}
                onAddToExistingList={handleAddItemToExistingList}
                onAddToNewList={handleAddItemToNewList}           
            />
             <InventoryItemDetailModal 
                isVisible={isDetailModalVisible}
                onClose={closeDetailModal}
                item={selectedInventoryItem}
            />
        </View>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    searchSortContainer: { 
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        marginTop: 15,
        marginBottom: 10,
    },
    searchContainer: {
        flex: 1, 
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: colors.border,
        marginRight: 10,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, height: 45, fontSize: 16, color: colors.textPrimary },
    clearButton: { padding: 5 },
    sortButton: {
        padding: 8,
    },
    sortText: { 
         color: colors.primary,
         fontSize: 10,
         textAlign: 'center',
    },
    listContent: { paddingHorizontal: 15, paddingBottom: 80 },
    sectionHeader: {
        backgroundColor: colors.background, 
        paddingVertical: 10, 
        paddingHorizontal: 0, 
        borderBottomWidth: 1.5, 
        borderBottomColor: colors.border,
        marginTop: 15, 
        marginBottom: 8, 
    },
    sectionHeaderText: {
        fontSize: 17, 
        fontWeight: '600',
        color: colors.textPrimary,
        textTransform: 'capitalize',
    },
    icon: { marginBottom: 20 },
    title: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', maxWidth: '85%' },
});