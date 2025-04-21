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
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform
} from 'react-native';
import { useTheme } from '../../context/ThemeContext'; // Ajuste o caminho
import { Ionicons } from '@expo/vector-icons';
import { Timestamp, addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase'; // Ajuste o caminho
import { ShoppingListItemData } from '@/types';

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

  // Flag para modo de edição
  const isEditing = !!itemToEdit;

  // --- Estados do Formulário ---
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('un');
  const [store, setStore] = useState('');
  const [estimatedValue, setEstimatedValue] = useState(''); // Valor como string
  const [category, setCategory] = useState('Compras'); // Categoria padrão
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // -----------------------------

  // Reseta o formulário quando o modal é fechado ou aberto
  useEffect(() => {
    if (isVisible) {
      if (isEditing && itemToEdit) {
        // Modo Edição: Preenche com dados existentes
        console.log("Modal opened for editing item:", itemToEdit.id);
        setName(itemToEdit.name);
        setQuantity(itemToEdit.quantity.toString());
        setUnit(itemToEdit.unit);
        setStore(itemToEdit.store || '');
        setEstimatedValue(itemToEdit.estimatedValue?.toString().replace('.', ',') || ''); // Formata se existir
        setCategory(itemToEdit.category || 'Compras');
        setErrorMessage(null);
      } else {
        // Modo Adicionar: Reseta tudo
        console.log("Modal opened for adding new item");
        setName('');
        setQuantity('1');
        setUnit('un');
        setStore('');
        setEstimatedValue('');
        setCategory('Compras');
        setErrorMessage(null);
      }
      setIsLoading(false); // Garante que loading não persista
    }
  }, [isVisible, itemToEdit, isEditing]);

  // --- Handler para Salvar (Adicionar ou Editar) ---
  const handleSaveItem = async () => {
    // Validações essenciais
    if (!currentUser || !groupId || !listId) { /* ... */ return; }
    if (!name.trim()) { /* ... */ return; }
    const numQuantity = parseInt(quantity, 10);
    if (isNaN(numQuantity) || numQuantity <= 0) { /* ... */ return; }

    let validEstimatedValue: number | undefined = undefined;
    if (estimatedValue.trim()) { /* ... validação como antes ... */ }
    // ... (resto das validações como antes) ...
    if (estimatedValue.trim() && (isNaN(parseFloat(estimatedValue.replace(',', '.'))) || parseFloat(estimatedValue.replace(',', '.')) < 0)) {
        setErrorMessage("Digite um valor estimado numérico válido (ou deixe em branco).");
        return;
    } else if (estimatedValue.trim()) {
        validEstimatedValue = parseFloat(estimatedValue.replace(',', '.'));
    }

    const storeValue = store.trim();
    const categoryValue = category.trim() || 'Compras';
    const unitValue = unit.trim() || 'un';

    // Prepara dados comuns
    const itemCommonData: any = {
        name: name.trim(),
        quantity: numQuantity,
        unit: unitValue,
        category: categoryValue,
        // Store e EstimatedValue são adicionados condicionalmente
    };
    if (storeValue) itemCommonData.store = storeValue;
    if (validEstimatedValue !== undefined) itemCommonData.estimatedValue = validEstimatedValue;

    setIsLoading(true);
    setErrorMessage(null);

    try {
        if (isEditing && itemToEdit) {
            // --- ATUALIZAR Item Existente ---
            console.log("Updating shopping item:", itemToEdit.id);
            const itemDocRef = doc(db, "groups", groupId, "shoppingLists", listId, "items", itemToEdit.id);
            // Adiciona apenas os campos que foram atualizados
            // Não atualiza addedBy, addedAt, isBought, etc. aqui
            await updateDoc(itemDocRef, itemCommonData);
            console.log("Item updated successfully!");
        } else {
            // --- CRIAR Novo Item ---
            const newItemData = {
                ...itemCommonData, // Inclui campos comuns
                addedBy: currentUser.uid,
                addedAt: serverTimestamp(),
                isBought: false,
                boughtAt: null,
                boughtBy: null,
                linkedTransactionId: null,
            };
            console.log("Adding shopping item:", newItemData);
            const collectionPath = collection(db, "groups", groupId, "shoppingLists", listId, "items");
            await addDoc(collectionPath, newItemData);
            console.log("Shopping item added successfully!");
        }
        onClose(); // Fecha modal no sucesso

    } catch (error: any) {
        console.error("Error saving shopping item:", error);
        setErrorMessage(`Erro ao ${isEditing ? 'atualizar' : 'adicionar'} item.`);
        if (error.code === 'permission-denied') { /* ... */ }
    } finally {
        setIsLoading(false);
    }
  };  

  // --- Handler para Adicionar Item ---
  const handleAddItem = async () => {
    // Verifica se todas as informações necessárias estão presentes
    if (!currentUser || !groupId || !listId) {
      setErrorMessage("Erro: Informações de usuário, grupo ou lista ausentes.");
      console.error("Missing data:", {currentUser: !!currentUser, groupId, listId});
      return;
    }
    // Validações básicas dos inputs
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
    if (estimatedValue.trim()) {
        const parsedValue = parseFloat(estimatedValue.replace(',', '.'));
        if (!isNaN(parsedValue) && parsedValue >= 0) {
            validEstimatedValue = parsedValue;
        } else {
            setErrorMessage("O Valor Estimado deve ser um número válido (ex: 10,50) ou deixado em branco.");
            return;
        }
    }

    const storeValue = store.trim(); // Pega o valor limpo
    const categoryValue = category.trim() || 'Compras'; // Pega categoria ou default
    const unitValue = unit.trim() || 'un'; // Pega unidade ou default

    // Cria o objeto base SEM os campos opcionais inicialmente
    const newItemData: any = { // Usar 'any' ou Omit<> type
      name: name.trim(),
      quantity: numQuantity,
      unit: unitValue,
      // store: é adicionado abaixo se existir
      category: categoryValue,
      // estimatedValue: é adicionado abaixo se existir
      addedBy: currentUser.uid,
      addedAt: serverTimestamp(),
      isBought: false,
      boughtAt: null,
      boughtBy: null,
      linkedTransactionId: null, // Inicializa como null
    };

    // Adiciona 'store' APENAS se tiver algum valor
    if (storeValue) {
      newItemData.store = storeValue;
    }

    // Adiciona 'estimatedValue' APENAS se for um número válido
    if (validEstimatedValue !== undefined) {
      newItemData.estimatedValue = validEstimatedValue;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      console.log("Adding shopping item:", newItemData);
      const collectionPath = collection(db, "groups", groupId, "shoppingLists", listId, "items");
      await addDoc(collectionPath, newItemData);

      console.log("Shopping item added successfully!");
      onClose();
    } catch (error: any) {
      console.error("Error adding shopping item:", error);
      setErrorMessage("Erro ao salvar item. Verifique sua conexão ou permissões.");
      if (error.code === 'permission-denied') {
        setErrorMessage("Erro: Permissão negada para salvar o item nesta lista.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- UI do Modal ---
  return (
    <Modal
      animationType="slide" // Animação de baixo para cima
      transparent={true}     // Fundo transparente para ver overlay
      visible={isVisible}    // Controla visibilidade
      onRequestClose={onClose} // Permite fechar com botão "Voltar" do Android
    >
      <KeyboardAvoidingView
         behavior={Platform.OS === "ios" ? "padding" : "height"} // Ajusta para teclado
         style={styles.keyboardAvoidingView}
      >
         {/* Overlay escurecido */}
         <View style={styles.modalOverlay}>
            {/* Container principal do modal */}
            <View style={styles.modalContainer}>
                <ScrollView>
                    {/* Cabeçalho com Título e Botão Fechar */}
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{isEditing ? 'Editar Item' : 'Adicionar Item'}</Text>
                        <TouchableOpacity onPress={onClose} disabled={isLoading}>
                           <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Campo: Nome do Item */}
                    <Text style={styles.label}>Nome do Item*</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Ex: Leite Integral"
                        placeholderTextColor={colors.placeholder}
                        editable={!isLoading} // Desabilita durante o loading
                    />

                    {/* Linha: Quantidade e Unidade */}
                    <View style={styles.row}>
                        <View style={styles.column}>
                            <Text style={styles.label}>Qtde*</Text>
                            <TextInput
                                style={styles.input}
                                value={quantity}
                                onChangeText={setQuantity}
                                keyboardType="number-pad" // Teclado numérico
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
                                placeholder="un, kg, L, pct" // Exemplos
                                placeholderTextColor={colors.placeholder}
                                autoCapitalize="none" // Evita capitalização automática
                                editable={!isLoading}
                            />
                        </View>
                    </View>

                    {/* Linha: Valor Estimado e Categoria */}
                    <View style={styles.row}>
                         <View style={styles.column}>
                            <Text style={styles.label}>Valor Est. (R$)</Text>
                            <TextInput
                                style={styles.input}
                                value={estimatedValue}
                                onChangeText={setEstimatedValue}
                                keyboardType="numeric" // Permite decimais
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
                                placeholder="Compras" // Default
                                placeholderTextColor={colors.placeholder}
                                editable={!isLoading}
                            />
                        </View>
                    </View>

                    {/* Campo: Onde Comprar */}
                    <Text style={styles.label}>Onde Comprar (Opcional)</Text>
                    <TextInput
                        style={styles.input}
                        value={store}
                        onChangeText={setStore}
                        placeholder="Ex: Supermercado X, Feira Local"
                        placeholderTextColor={colors.placeholder}
                        editable={!isLoading}
                    />


                    {/* Exibição de Mensagem de Erro */}
                    {errorMessage && (
                        <Text style={styles.errorMessage}>{errorMessage}</Text>
                    )}

                    {/* Botão Salvar */}
                    <TouchableOpacity
                        style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
                        onPress={handleSaveItem} // Renomeado
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

// --- Estilos ---
const getStyles = (colors: any) => StyleSheet.create({
    keyboardAvoidingView: {
        flex: 1, // Ocupa toda a tela para o KAV funcionar bem
    },
    modalOverlay: {
        flex: 1, // Ocupa todo o espaço do KAV
        justifyContent: 'flex-end', // Alinha o modal na parte inferior
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // Fundo semi-transparente
    },
    modalContainer: {
        backgroundColor: colors.bottomSheet, // Cor de fundo do tema
        borderTopLeftRadius: 20, // Bordas arredondadas no topo
        borderTopRightRadius: 20,
        padding: 20, // Espaçamento interno
        paddingBottom: Platform.OS === 'ios' ? 40 : 30, // Padding extra inferior (considera safe area no iOS)
        maxHeight: '90%', // Altura máxima para não ocupar tela inteira
        shadowColor: '#000', // Sombra (iOS)
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5, // Sombra (Android)
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
        marginTop: 10, // Espaço acima de cada label
    },
    input: {
        backgroundColor: colors.surface, // Cor de fundo para inputs/cards
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 16,
        color: colors.textPrimary,
        borderWidth: 1,
        borderColor: colors.border, // Cor sutil de borda
        marginBottom: 10, // Espaço abaixo de cada input
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between', // Espaça as colunas
    },
    column: {
        width: '48%', // Define largura para caber duas colunas com espaço
    },
    errorMessage: {
        color: colors.error, // Cor de erro do tema
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 5,
        fontSize: 14,
    },
    saveButton: {
        backgroundColor: colors.primary, // Cor primária do tema
        paddingVertical: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 20, // Espaço acima do botão
    },
    saveButtonDisabled: {
        backgroundColor: colors.textSecondary, // Cor quando desabilitado
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#FFFFFF', // Texto branco no botão
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default AddShoppingItemModal;