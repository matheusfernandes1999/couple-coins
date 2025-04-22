// components/dashboard/AddShoppingItemModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { ShoppingListItemData } from '@/types';
import { showMessage } from 'react-native-flash-message';

interface AddShoppingItemModalProps {
  isVisible: boolean;
  onClose: () => void;
  groupId: string | null;
  listId: string | null;
  itemToEdit?: ShoppingListItemData | null;
}

const AddShoppingItemModal: React.FC<AddShoppingItemModalProps> = ({ isVisible, onClose, groupId, listId, itemToEdit }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const currentUser = auth.currentUser;

  const isEditing = !!itemToEdit;

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('un');
  const [store, setStore] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [category, setCategory] = useState('Compras');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  useEffect(() => {
    if (isVisible) {
      if (isEditing && itemToEdit) {
        setName(itemToEdit.name);
        setQuantity(itemToEdit.quantity.toString());
        setUnit(itemToEdit.unit);
        setStore(itemToEdit.store || '');
        setEstimatedValue(itemToEdit.estimatedValue?.toString().replace('.', ',') || '');
        setCategory(itemToEdit.category || 'Compras');
        setErrorMessage(null);
      } else {
        setName('');
        setQuantity('1');
        setUnit('un');
        setStore('');
        setEstimatedValue('');
        setCategory('Compras');
        setErrorMessage(null);
      }
      setIsLoading(false);
    }
  }, [isVisible, itemToEdit, isEditing]);

  const handleSaveItem = async () => {
    if (!currentUser || !groupId || !listId) {
        setErrorMessage("Erro: Informações de usuário, grupo ou lista ausentes.");
        console.error("Missing data:", {currentUser: !!currentUser, groupId, listId});
        return;
      }
      
    if (!name.trim()) {
        setErrorMessage("Digite o nome do item.");
        return;
      }

    const numQuantity = parseInt(quantity, 10);
    if (isNaN(numQuantity) || numQuantity <= 0) {
        setErrorMessage("Digite uma quantidade numérica válida maior que zero.");
        return;
    }

    let validEstimatedValue: number | undefined = undefined;

    if (estimatedValue.trim() && (isNaN(parseFloat(estimatedValue.replace(',', '.'))) || parseFloat(estimatedValue.replace(',', '.')) < 0)) {
        setErrorMessage("Digite um valor estimado numérico válido (ou deixe em branco).");
        return;
    } else if (estimatedValue.trim()) {
        validEstimatedValue = parseFloat(estimatedValue.replace(',', '.'));
    }

    const storeValue = store.trim();
    const categoryValue = category.trim() || 'Compras';
    const unitValue = unit.trim() || 'un';

    const itemCommonData: any = {
        name: name.trim(),
        quantity: numQuantity,
        unit: unitValue,
        category: categoryValue,
    };
    if (storeValue) itemCommonData.store = storeValue;
    if (validEstimatedValue !== undefined) itemCommonData.estimatedValue = validEstimatedValue;

    setIsLoading(true);
    setErrorMessage(null);

    try {
        if (isEditing && itemToEdit) {
            console.log("Updating shopping item:", itemToEdit.id);
            const itemDocRef = doc(db, "groups", groupId, "shoppingLists", listId, "items", itemToEdit.id);
            await updateDoc(itemDocRef, itemCommonData);
            showMessage({
                message: "Deu certo!",
                description: "Item atualizado com sucesso!",
                backgroundColor: colors.success,
                color: colors.textPrimary,
            });
        } else {
            const newItemData = {
                ...itemCommonData, 
                addedBy: currentUser.uid,
                addedAt: serverTimestamp(),
                isBought: false,
                boughtAt: null,
                boughtBy: null,
                linkedTransactionId: null,
            };
            const collectionPath = collection(db, "groups", groupId, "shoppingLists", listId, "items");
            await addDoc(collectionPath, newItemData);
            showMessage({
                message: "Deu certo!",
                description: "Item adicionado com sucesso!",
                backgroundColor: colors.success,
                color: colors.textPrimary,
            });
        }
        onClose();

    } catch (error: any) {
        setErrorMessage(`Erro ao ${isEditing ? 'atualizar' : 'adicionar'} item.`);
        if (error.code === 'permission-denied') {
            setErrorMessage("Você não tem permissão para adicionar itens a esta lista.");
        }
    } finally {
        setIsLoading(false);
    }
  };  

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}    
      onRequestClose={onClose} 
    >
      <KeyboardAvoidingView
         behavior={Platform.OS === "ios" ? "padding" : "height"}
         style={styles.keyboardAvoidingView}
      >
         <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                <ScrollView>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{isEditing ? 'Editar Item' : 'Adicionar Item'}</Text>
                        <TouchableOpacity onPress={onClose} disabled={isLoading}>
                           <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>Nome do Item*</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Ex: Leite Integral"
                        placeholderTextColor={colors.placeholder}
                        editable={!isLoading}
                    />

                    <View style={styles.row}>
                        <View style={styles.column}>
                            <Text style={styles.label}>Qtde*</Text>
                            <TextInput
                                style={styles.input}
                                value={quantity}
                                onChangeText={setQuantity}
                                keyboardType="number-pad"
                                placeholder="1"
                                placeholderTextColor={colors.placeholder}
                                editable={!isLoading}
                            />
                        </View>
                        <View style={styles.column}>
                            <Text style={styles.label}>Unidade*</Text>
                            <TextInput
                                style={styles.input}
                                value={unit}
                                onChangeText={setUnit}
                                placeholder="un, kg, L, pct"
                                placeholderTextColor={colors.placeholder}
                                autoCapitalize="none"
                                editable={!isLoading}
                            />
                        </View>
                    </View>

                    <View style={styles.row}>
                         <View style={styles.column}>
                            <Text style={styles.label}>Valor Est. (R$)</Text>
                            <TextInput
                                style={styles.input}
                                value={estimatedValue}
                                onChangeText={setEstimatedValue}
                                keyboardType="numeric"
                                placeholder="Opcional"
                                placeholderTextColor={colors.placeholder}
                                editable={!isLoading}
                            />
                        </View>
                         <View style={styles.column}>
                            <Text style={styles.label}>Categoria Gasto</Text>
                            <TextInput
                                style={styles.input}
                                value={category}
                                onChangeText={setCategory}
                                placeholder="Compras" 
                                placeholderTextColor={colors.placeholder}
                                editable={!isLoading}
                            />
                        </View>
                    </View>

                    <Text style={styles.label}>Onde Comprar (Opcional)</Text>
                    <TextInput
                        style={styles.input}
                        value={store}
                        onChangeText={setStore}
                        placeholder="Ex: Supermercado X, Feira Local"
                        placeholderTextColor={colors.placeholder}
                        editable={!isLoading}
                    />

                    {errorMessage && (
                        <Text style={styles.errorMessage}>{errorMessage}</Text>
                    )}

                    <TouchableOpacity
                        style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
                        onPress={handleSaveItem}
                        disabled={isLoading}
                    >
                        {isLoading
                           ? <ActivityIndicator color="#FFF" />
                           : <Text style={styles.saveButtonText}>{isEditing ? 'Atualizar Item' : 'Adicionar Item'}</Text>
                        }
                    </TouchableOpacity>
                </ScrollView>
            </View>
         </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
    keyboardAvoidingView: {
        flex: 1, 
    },
    modalOverlay: {
        flex: 1, 
        justifyContent: 'flex-end', 
        backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    },
    modalContainer: {
        backgroundColor: colors.bottomSheet, 
        borderTopLeftRadius: 20, 
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 30, 
        maxHeight: '90%', 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5, 
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    label: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 5,
        marginTop: 10, 
    },
    input: {
        backgroundColor: colors.surface, 
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 16,
        color: colors.textPrimary,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 10, 
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between', 
    },
    column: {
        width: '48%', 
    },
    errorMessage: {
        color: colors.error,
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 5,
        fontSize: 14,
    },
    saveButton: {
        backgroundColor: colors.primary, 
        paddingVertical: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 20, 
    },
    saveButtonDisabled: {
        backgroundColor: colors.textSecondary, 
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default AddShoppingItemModal;