// app/(tabs)/inventory.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SectionList, // Alterado de FlatList para SectionList
    ActivityIndicator,
    Alert,
    TouchableOpacity,
    TextInput,        // Adicionado TextInput
    Keyboard,         // Adicionado Keyboard (opcional, para fechar)
    Platform          // Adicionado Platform para estilo do input de busca
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';         // Ajuste o caminho
import { useGroup } from '@/context/GroupContext';         // Ajuste o caminho
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '@/lib/firebase';                  // Ajuste o caminho
import {
    collection, query, onSnapshot, orderBy, doc,
    updateDoc, addDoc, serverTimestamp, Timestamp,
    writeBatch, getDocs, deleteDoc, where, limit     // Funções do Firestore necessárias
} from 'firebase/firestore';
import { InventoryItemData, ShoppingList, ShoppingListItemData } from '@/types'; // Ajuste o caminho
import InventoryListItem from '@/components/inventory/InventoryListItem';         // Ajuste o caminho
import AddInventoryItemModal from '@/components/inventory/AddInventoryItemModal'; // Ajuste o caminho
import SelectShoppingListModal from '@/components/inventory/SelectShoppingListModal'; // Ajuste o caminho
import InventoryItemDetailModal from '@/components/inventory/InventoryItemDetailModal'; // Ajuste o caminho
import AddTransactionFAB from '@/components/dashboard/AddTransactionFAB';             // Ajuste o caminho

// Interface para as seções do SectionList
interface InventorySection {
    title: string; // Nome da categoria (cabeçalho da seção)
    data: InventoryItemData[]; // Itens dentro dessa categoria
}

export default function InventoryScreen() {
    const { colors } = useTheme();                          // Hook do tema
    const { groupId, isLoadingGroup } = useGroup();        // Hook do contexto do grupo
    const currentUser = auth.currentUser;                   // Usuário logado

    // --- Estados ---
    const [rawInventoryItems, setRawInventoryItems] = useState<InventoryItemData[]>([]); // Lista bruta vinda do Firestore
    const [isLoading, setIsLoading] = useState(true);                           // Loading dos itens do inventário
    const [searchQuery, setSearchQuery] = useState('');                         // Estado do input de busca
    const [availableShoppingLists, setAvailableShoppingLists] = useState<ShoppingList[]>([]); // Listas de compras ativas

    // Estados dos Modais
    const [isAddItemModalVisible, setIsAddItemModalVisible] = useState(false);
    const [isSelectListModalVisible, setIsSelectListModalVisible] = useState(false);
    const [itemToAddToShoppingList, setItemToAddToShoppingList] = useState<InventoryItemData | null>(null);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItemData | null>(null);
    const [editingInventoryItem, setEditingInventoryItem] = useState<InventoryItemData | null>(null);

    // --- Listener para Itens do Inventário ---
    // --- Listener para Itens do Inventário ---
    useEffect(() => {
        if (!groupId) {
            setRawInventoryItems([]);
            setIsLoading(false);
            return () => { };
        }
        if (!isLoadingGroup) setIsLoading(true);

        console.log("InventoryScreen: Setting up inventory listener for group:", groupId);
        const inventoryQuery = query(collection(db, "groups", groupId, "inventoryItems"));

        const unsubscribe = onSnapshot(inventoryQuery, (querySnapshot) => {
            const fetchedItems: InventoryItemData[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // --- VALIDAÇÃO CORRIGIDA ---
                // Verifica apenas os campos essenciais para exibição inicial.
                // addedAt e outros timestamps podem ser null temporariamente.
                if (data.name && data.quantity !== undefined && data.unit) {
                    // Adiciona mesmo que alguns campos (como addedAt) ainda não tenham sido resolvidos pelo servidor
                    fetchedItems.push({ id: doc.id, groupId: groupId, ...data } as InventoryItemData);
                } else {
                    console.warn(`Inventory item ${doc.id} ignored due to missing essential data (name, quantity, or unit):`, { name: data.name, quantity: data.quantity, unit: data.unit });
                }
                // --------------------------
            });
            console.log(`InventoryScreen: Fetched ${fetchedItems.length} raw items passing validation.`);
            setRawInventoryItems(fetchedItems);
            setIsLoading(false);
        }, (error) => {
            console.error("InventoryScreen: Error listening to items:", error);
            Alert.alert("Erro", "Não foi possível carregar o inventário.");
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [groupId, isLoadingGroup]); // Depende do ID do grupo e do loading do contexto

    // --- Listener para Listas de Compras Ativas (para o modal de seleção) ---
    useEffect(() => {
        if (!groupId) {
            setAvailableShoppingLists([]);
            return () => { };
        }
        // Busca listas não arquivadas, ordenadas por nome
        const listsQuery = query(
            collection(db, "groups", groupId, "shoppingLists"),
            where("archived", "==", false),
            //orderBy("name", "asc")
        );
        const unsubscribe = onSnapshot(listsQuery, (snapshot) => {
            const lists: ShoppingList[] = [];
            snapshot.forEach(doc => lists.push({ id: doc.id, ...doc.data() } as ShoppingList));
            setAvailableShoppingLists(lists); // Atualiza as listas disponíveis
        });
        return () => unsubscribe(); // Limpa o listener
    }, [groupId]); // Depende apenas do groupId

    // --- Handler para INICIAR Edição ---
    const handleEditInventoryItem = (item: InventoryItemData) => {
        console.log("InventoryScreen: Editing item", item.id);
        setEditingInventoryItem(item);   // Define o item a ser editado
        setIsAddItemModalVisible(true); // Abre o modal Add/Edit
    };

    // --- Handler para EXCLUIR Item ---
    const handleDeleteInventoryItem = async (itemId: string) => {
        if (!groupId) { Alert.alert("Erro", "ID do grupo não encontrado."); return; }

        // A confirmação agora está no componente filho, aqui só executamos
        console.log("InventoryScreen: Deleting item", itemId);
        const itemDocRef = doc(db, "groups", groupId, "inventoryItems", itemId);
        try {
            await deleteDoc(itemDocRef);
            console.log("Inventory item deleted successfully.");
            Alert.alert("Sucesso", "Item removido do inventário.");
            // O listener onSnapshot removerá o item da UI.
        } catch (error) {
            console.error("InventoryScreen: Error deleting inventory item:", error);
            Alert.alert("Erro", "Não foi possível remover o item.");
        }
    };

    // --- Handler para ORDENAÇÃO (Exemplo de ciclo simples) ---
    const [sortBy, setSortBy] = useState<'name' | 'lastPurchase' | 'nextPurchase'>('name');
    const handleSortChange = () => {
        setSortBy(currentSort => {
            if (currentSort === 'name') return 'lastPurchase';
            if (currentSort === 'lastPurchase') return 'nextPurchase';
            return 'name'; // Volta para nome
        });
        console.log("Changing sort to:", sortBy); // O log mostrará o estado *antes* da atualização
    };

    const inventorySections = useMemo((): InventorySection[] => {
        console.log("Recalculating sections, search:", searchQuery, "sortBy:", sortBy);
        // 1. Filtra
        let filteredItems = rawInventoryItems.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        // 2. Ordena ANTES de agrupar (por data)
        if (sortBy === 'lastPurchase') {
            filteredItems.sort((a, b) => (b.lastPurchaseDate?.toMillis() || 0) - (a.lastPurchaseDate?.toMillis() || 0));
        } else if (sortBy === 'nextPurchase') {
            filteredItems.sort((a, b) => (a.nextPurchaseDate?.toMillis() || Infinity) - (b.nextPurchaseDate?.toMillis() || Infinity));
        }

        // 3. Agrupa por categoria
        const grouped: { [key: string]: InventoryItemData[] } = {};
        filteredItems.forEach(item => {
            const categoryKey = item.category?.trim() || 'Sem Categoria';
            if (!grouped[categoryKey]) grouped[categoryKey] = [];
            grouped[categoryKey].push(item);
        });

        // 4. Formata e Ordena Seções/Itens (por nome se aplicável)
        const sectionsArray = Object.keys(grouped)
            .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
            .map(categoryTitle => ({
                title: categoryTitle,
                data: sortBy === 'name'
                    ? grouped[categoryTitle].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
                    : grouped[categoryTitle], // Mantém ordem da data se não for ordenar por nome
            }));

        return sectionsArray;

    }, [rawInventoryItems, searchQuery, sortBy]);

    // --- Handlers ---
    // Atualiza quantidade no Firestore
    const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
        if (!groupId || newQuantity < 0) return; // Não permite negativo
        console.log(`InventoryScreen: Updating quantity for ${itemId} to ${newQuantity}`);
        const itemDocRef = doc(db, "groups", groupId, "inventoryItems", itemId);
        try {
            await updateDoc(itemDocRef, {
                quantity: newQuantity,
                updatedAt: serverTimestamp(), // Atualiza timestamp da modificação
                lastUpdatedBy: currentUser?.uid || null // Quem modificou
            });
            // O listener onSnapshot atualizará a UI automaticamente
        } catch (error) {
            console.error("InventoryScreen: Error updating quantity:", error);
            Alert.alert("Erro", "Não foi possível atualizar a quantidade.");
        }
    };

    // Abre modal para selecionar lista de compras
    const handleAddToShoppingListPress = (item: InventoryItemData) => {
        console.log("InventoryScreen: Add to shopping list pressed for", item.name);
        setItemToAddToShoppingList(item); // Guarda o item para adicionar
        setIsSelectListModalVisible(true); // Abre o modal de seleção
    };

    // Adiciona item do inventário a uma lista existente
    const handleAddItemToExistingList = async (listId: string, itemData: InventoryItemData) => {
         if (!groupId || !currentUser) return;
         console.log(`InventoryScreen: Adding ${itemData.name} to existing list ${listId}`);

         // Prepara dados do novo item para a lista de compras
         const newItemForShoppingList: any = {
             name: itemData.name,
             quantity: 1, // Padrão 1 ao adicionar da despensa
             unit: itemData.unit,
             category: itemData.category || 'Compras', // Categoria original ou default
             addedBy: currentUser.uid,
             addedAt: serverTimestamp(),
             isBought: false, boughtAt: null, boughtBy: null, linkedTransactionId: null,
         };
         // Adiciona campos opcionais se existirem no inventário
         if (itemData.store) newItemForShoppingList.store = itemData.store;
         const estimated = itemData.nextPurchaseValue ?? itemData.lastPurchaseValue ?? itemData.estimatedValue ?? undefined; // Tenta pegar valor planejado, depois último, depois estimado
         if (estimated !== undefined) newItemForShoppingList.estimatedValue = estimated;

         try {
             // Adiciona à sub-subcoleção de itens da lista escolhida
             const itemsCollectionRef = collection(db, "groups", groupId, "shoppingLists", listId, "items");
             await addDoc(itemsCollectionRef, newItemForShoppingList);
             Alert.alert("Sucesso", `"${itemData.name}" adicionado à lista!`);
             closeSelectListModal(); // Fecha o modal de seleção
         } catch (error) {
             console.error("InventoryScreen: Error adding item to existing list:", error);
             Alert.alert("Erro", "Não foi possível adicionar o item à lista.");
         }
    };

    // Cria nova lista e adiciona item do inventário a ela
    const handleAddItemToNewList = async (newListName: string, itemData: InventoryItemData) => {
        if (!groupId || !currentUser || !newListName.trim()) return;
        console.log(`InventoryScreen: Creating new list "${newListName}" and adding ${itemData.name}`);
        const trimmedListName = newListName.trim();
        const batch = writeBatch(db); // Usa batch para criar lista e item juntos

        try {
             // 1. Referência e Dados da Nova Lista
             const listsCollectionRef = collection(db, "groups", groupId, "shoppingLists");
             const newListRef = doc(listsCollectionRef);
             const newListId = newListRef.id;
             const newListData = { name: trimmedListName, archived: false, createdAt: serverTimestamp() };
             batch.set(newListRef, newListData); // Adiciona criação da lista ao batch

             // 2. Dados do novo item para a lista de compras (mesma lógica do anterior)
             const newItemForShoppingList: any = { /* ... como em handleAddItemToExistingList ... */
                name: itemData.name, quantity: 1, unit: itemData.unit,
                category: itemData.category || 'Compras',
                addedBy: currentUser.uid, addedAt: serverTimestamp(),
                isBought: false, boughtAt: null, boughtBy: null, linkedTransactionId: null,
            };
            if (itemData.store) newItemForShoppingList.store = itemData.store;
            const estimated = itemData.nextPurchaseValue ?? itemData.lastPurchaseValue ?? itemData.estimatedValue ?? undefined;
            if (estimated !== undefined) newItemForShoppingList.estimatedValue = estimated;

             // Cria referência para o item DENTRO da nova lista
             const newItemRef = doc(collection(db, "groups", groupId, "shoppingLists", newListId, "items"));
             batch.set(newItemRef, newItemForShoppingList); // Adiciona criação do item ao batch

             // 3. Commita o batch
             await batch.commit();

             Alert.alert("Sucesso!", `Lista "${trimmedListName}" criada e "${itemData.name}" adicionado.`);
             closeSelectListModal(); // Fecha modal de seleção

        } catch(error) {
            console.error("InventoryScreen: Error creating list and adding item:", error);
            Alert.alert("Erro", "Não foi possível criar a lista ou adicionar o item.");
        }
    };

    // Abre modal de detalhes do item
    const handleItemPress = (item: InventoryItemData) => {
        console.log("InventoryScreen: Item pressed", item.id);
        setSelectedInventoryItem(item); // Guarda o item clicado
        setIsDetailModalVisible(true);  // Abre o modal
    };

    // Funções para fechar modais
    const closeAddItemModal = () => { setIsAddItemModalVisible(false); setEditingInventoryItem(null); }; // Limpa edição
    const closeSelectListModal = () => {
        setIsSelectListModalVisible(false);
        setItemToAddToShoppingList(null); // Limpa item selecionado
    };
    const closeDetailModal = () => {
        setIsDetailModalVisible(false);
        setSelectedInventoryItem(null); // Limpa seleção
    };
    // ---------------------------------------------------------

    // --- Render Item e Header para SectionList ---
    const renderInventoryItem = ({ item }: { item: InventoryItemData }) => (
        <InventoryListItem
            item={item}
            onUpdateQuantity={handleUpdateQuantity} // Passa handler para atualizar qtde
            onAddToShoppingList={() => handleAddToShoppingListPress(item)} // Passa handler para add na lista
            onPress={() => handleItemPress(item)} // Passa handler para ver detalhes
            onEdit={() => handleEditInventoryItem(item)}   // <-- Handler Editar
            onDelete={() => handleDeleteInventoryItem(item.id)}
        />
    );

    const renderSectionHeader = ({ section: { title } }: { section: InventorySection }) => (
       <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
       </View>
    );
    // -----------------------------------------


    // --- Renderização Principal ---
    const styles = getStyles(colors); // Pega estilos do tema

    // Loading inicial (do contexto do grupo ou dos itens)
    if (isLoadingGroup || isLoading) {
        return ( <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={colors.primary} /></View> );
    }

    // Se usuário não está em grupo (verificado pelo contexto)
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

    // Renderização normal da tela
    return (
        <View style={styles.container}>
            {/* Input de Busca */}
            <View style={styles.searchSortContainer}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Pesquisar item..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        returnKeyType="search"
                        clearButtonMode="while-editing" // Botão 'X' no iOS
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


            {/* Lista Agrupada ou Mensagem de Vazio/Não Encontrado */}
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
                    sections={inventorySections}      // Dados agrupados por categoria
                    renderItem={renderInventoryItem}  // Como renderizar cada item
                    renderSectionHeader={renderSectionHeader} // Como renderizar o cabeçalho da categoria
                    keyExtractor={(item, index) => item.id + index} // Chave única
                    contentContainerStyle={styles.listContent} // Estilo do container
                    stickySectionHeadersEnabled={true} // Cabeçalhos fixos no topo
                    keyboardShouldPersistTaps="handled" // Ajuda com teclado e scroll
                    // RefreshControl poderia ser adicionado aqui se desejado
                />
            )}

            {/* FAB para Adicionar Item Manualmente */}
            <AddTransactionFAB onPress={() => setIsAddItemModalVisible(true)} />

            {/* Modais */}
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
                availableLists={availableShoppingLists} // Passa listas ativas
                itemToAdd={itemToAddToShoppingList} // Passa item selecionado
                onAddToExistingList={handleAddItemToExistingList} // Handler para lista existente
                onAddToNewList={handleAddItemToNewList}           // Handler para nova lista
            />
             <InventoryItemDetailModal // Modal para ver detalhes
                isVisible={isDetailModalVisible}
                onClose={closeDetailModal}
                item={selectedInventoryItem} // Passa item selecionado
            />
        </View>
    );
}

// --- Estilos ---
const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    searchSortContainer: { // Novo container para busca e sort
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        marginTop: 15,
        marginBottom: 10,
    },
    searchContainer: {
        flex: 1, // Ocupa a maior parte do espaço
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: colors.border,
        marginRight: 10, // Espaço antes do botão sort
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, height: 45, fontSize: 16, color: colors.textPrimary },
    clearButton: { padding: 5 },
    sortButton: { // Botão para ordenar
        padding: 8,
        // backgroundColor: colors.surface,
        // borderRadius: 8,
        // borderWidth: 1,
        // borderColor: colors.border,
    },
    sortText: { // Texto opcional para sort
         color: colors.primary,
         fontSize: 10,
         textAlign: 'center',
    },
    listContent: { paddingHorizontal: 15, paddingBottom: 80 },
    sectionHeader: {
        backgroundColor: colors.background, // Fundo da tela para efeito sticky
        paddingVertical: 10, // Mais espaçamento vertical
        paddingHorizontal: 0, // Usa padding do listContent
        borderBottomWidth: 1.5, // Linha mais grossa
        borderBottomColor: colors.border,
        marginTop: 15, // Mais espaço acima da seção
        marginBottom: 8, // Espaço abaixo do header antes dos itens
    },
    sectionHeaderText: {
        fontSize: 17, // Maior
        fontWeight: '600', // Semi-bold
        color: colors.textPrimary,
        textTransform: 'capitalize', // Capitaliza a categoria
    },
    icon: { marginBottom: 20 },
    title: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', maxWidth: '85%' },
});