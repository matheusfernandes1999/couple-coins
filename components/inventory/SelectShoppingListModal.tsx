// components/inventory/SelectShoppingListModal.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { ShoppingList, InventoryItemData } from '@/types'; // Adiciona InventoryItemData

interface SelectShoppingListModalProps {
  isVisible: boolean;
  onClose: () => void;
  groupId: string | null;
  availableLists: ShoppingList[]; // Recebe as listas ativas
  itemToAdd: InventoryItemData | null; // Item do inventário a ser adicionado
  onAddToExistingList: (listId: string, itemData: InventoryItemData) => Promise<void>;
  onAddToNewList: (newListName: string, itemData: InventoryItemData) => Promise<void>;
}

const SelectShoppingListModal: React.FC<SelectShoppingListModalProps> = ({
  isVisible, onClose, groupId, availableLists, itemToAdd,
  onAddToExistingList, onAddToNewList
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false); // Loading para criar lista + item

  // Reseta estado interno ao fechar/abrir
  useEffect(() => {
      if (!isVisible) {
          setShowNewListInput(false);
          setNewListName('');
          setIsCreatingList(false);
      }
  }, [isVisible]);


  const handleSelectExisting = (listId: string) => {
      if (itemToAdd) {
          onAddToExistingList(listId, itemToAdd); // Chama handler do pai
      }
      // onClose(); // O pai fecha o modal após a ação
  };

  const handleCreateAndAdd = async () => {
      if (itemToAdd && newListName.trim()) {
          setIsCreatingList(true); // Ativa loading
          await onAddToNewList(newListName.trim(), itemToAdd); // Chama handler do pai
          setIsCreatingList(false); // Desativa loading
          // onClose(); // O pai fecha o modal após a ação
      } else if (!newListName.trim()) {
          Alert.alert("Erro", "Digite um nome para a nova lista.");
      }
  };

  const renderListItem = ({ item }: { item: ShoppingList }) => (
      <TouchableOpacity style={styles.listItem} onPress={() => handleSelectExisting(item.id)}>
          <Ionicons name="list" size={20} color={colors.textSecondary} style={styles.listIcon}/>
          <Text style={styles.listName}>{item.name}</Text>
      </TouchableOpacity>
  );

  return (
     <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
        <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Adicionar "{itemToAdd?.name}" a:</Text>
                    <TouchableOpacity onPress={onClose}><Ionicons name="close-circle" size={28} color={colors.textSecondary} /></TouchableOpacity>
                </View>

                {/* Lista de Listas Existentes */}
                <Text style={styles.subHeader}>Listas Existentes</Text>
                {availableLists.length === 0 ? (
                    <Text style={styles.emptyText}>Nenhuma lista de compras ativa encontrada.</Text>
                ) : (
                    <FlatList
                        data={availableLists}
                        renderItem={renderListItem}
                        keyExtractor={(item) => item.id}
                        style={styles.list}
                        />
                )}


                {/* Opção de Criar Nova Lista */}
                <View style={styles.separator} />
                {!showNewListInput ? (
                    <TouchableOpacity style={styles.createButton} onPress={() => setShowNewListInput(true)}>
                        <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                        <Text style={styles.createButtonText}>Criar Nova Lista</Text>
                    </TouchableOpacity>
                ) : (
                    <View>
                        <Text style={styles.label}>Nome da Nova Lista*</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ex: Compras Semana"
                            value={newListName}
                            onChangeText={setNewListName}
                            editable={!isCreatingList}
                        />
                         <TouchableOpacity
                            style={[styles.saveButton, isCreatingList && styles.saveButtonDisabled]}
                            onPress={handleCreateAndAdd}
                            disabled={isCreatingList}
                          >
                             {isCreatingList ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Criar e Adicionar Item</Text>}
                         </TouchableOpacity>
                          <TouchableOpacity style={styles.cancelButton} onPress={() => setShowNewListInput(false)}>
                               <Text style={styles.cancelButtonText}>Cancelar</Text>
                          </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    </Modal>
  );
};

// Estilos
const getStyles = (colors: any) => StyleSheet.create({
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)'},
    modalContainer: { backgroundColor: colors.bottomSheet, borderRadius: 15, padding: 20, width: '90%', maxHeight: '80%'},
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, flexShrink: 1, marginRight: 10 },
    subHeader: { fontSize: 16, fontWeight: '500', color: colors.textSecondary, marginBottom: 10 },
    list: { maxHeight: 150, marginBottom: 10 }, // Limita altura da lista
    listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    listIcon: { marginRight: 10 },
    listName: { fontSize: 16, color: colors.textPrimary },
    emptyText: { color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center', marginVertical: 10 },
    separator: { height: 1, backgroundColor: colors.border, marginVertical: 15 },
    createButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
    createButtonText: { color: colors.primary, fontSize: 16, fontWeight: '500', marginLeft: 5 },
    label: { fontSize: 14, color: colors.textSecondary, marginBottom: 5 },
    input: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 10, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
    saveButton: { backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    saveButtonDisabled: { backgroundColor: colors.textSecondary },
    saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    cancelButton: { alignItems: 'center', marginTop: 15},
    cancelButtonText: { color: colors.textSecondary, fontSize: 14 }
});

export default SelectShoppingListModal;