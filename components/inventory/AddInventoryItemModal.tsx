// components/inventory/AddInventoryItemModal.tsx
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
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Timestamp, addDoc, collection, serverTimestamp, doc, updateDoc } from 'firebase/firestore'; // Adicionado doc, updateDoc
import { db, auth } from '../../lib/firebase'; // Ajuste o caminho
import { InventoryItemData } from '@/types'; // Ajuste o caminho

// Interface para as props do modal
interface AddInventoryItemModalProps {
  isVisible: boolean;        // Controla se o modal está visível
  onClose: () => void;       // Função para fechar o modal
  groupId: string | null;    // ID do grupo para salvar o item
  itemToEdit?: InventoryItemData | null; // <-- Item para editar (opcional)
}

const AddInventoryItemModal: React.FC<AddInventoryItemModalProps> = ({
   isVisible,
   onClose,
   groupId,
   itemToEdit // <-- Recebe o item para editar
  }) => {
  const { colors } = useTheme();        // Hook para acessar as cores do tema
  const styles = getStyles(colors);     // Gera os estilos com as cores do tema
  const currentUser = auth.currentUser; // Usuário logado atualmente

  // Flag para determinar se está no modo de edição
  const isEditing = !!itemToEdit;

  // --- Estados Internos do Formulário ---
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1'); // Quantidade ATUAL no inventário
  const [unit, setUnit] = useState('un');
  const [category, setCategory] = useState('');
  const [lastPurchaseDate, setLastPurchaseDate] = useState<Date | null>(null);
  const [showLastPurchaseDatePicker, setShowLastPurchaseDatePicker] = useState(false);
  const [lastPurchaseQuantityInput, setLastPurchaseQuantityInput] = useState(''); // Qtde daquela compra
  const [lastPurchaseValueInput, setLastPurchaseValueInput] = useState(''); // Valor TOTAL pago naquela compra
  const [nextPurchaseDate, setNextPurchaseDate] = useState<Date | null>(null);
  const [showNextPurchaseDatePicker, setShowNextPurchaseDatePicker] = useState(false);
  const [nextPurchaseValueInput, setNextPurchaseValueInput] = useState(''); // Valor estimado da próxima
  const [isLoading, setIsLoading] = useState(false); // Estado de carregamento para o botão salvar
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // Mensagem de erro
  // --------------------------------------

  // --- Efeito para Preencher/Resetar Formulário ---
  useEffect(() => {
    // Roda sempre que a visibilidade ou o item para editar mudam
    if (isVisible) {
      if (isEditing && itemToEdit) {
        // Modo Edição: Preenche o formulário com os dados existentes
        console.log("AddInventoryItemModal: Editing item -", itemToEdit.id);
        setName(itemToEdit.name);
        setQuantity(itemToEdit.quantity.toString()); // Converte número para string
        setUnit(itemToEdit.unit);
        setCategory(itemToEdit.category || ''); // Usa '' se for undefined
        // Converte Timestamps (se existirem) para objetos Date
        setLastPurchaseDate(itemToEdit.lastPurchaseDate?.toDate() || null);
        setLastPurchaseQuantityInput(itemToEdit.lastPurchaseQuantity?.toString() || ''); // Converte número para string
        // Formata valor com vírgula decimal para exibição no input
        setLastPurchaseValueInput(itemToEdit.lastPurchaseValue?.toString().replace('.', ',') || '');
        setNextPurchaseDate(itemToEdit.nextPurchaseDate?.toDate() || null);
        setNextPurchaseValueInput(itemToEdit.nextPurchaseValue?.toString().replace('.', ',') || '');
        setErrorMessage(null); // Limpa erros anteriores
      } else {
        // Modo Adicionar: Reseta todos os campos para os padrões
        console.log("AddInventoryItemModal: Opened for adding new item");
        resetForm();
      }
      setIsLoading(false); // Garante que loading não persista entre aberturas
    }
  }, [isVisible, itemToEdit, isEditing]); // Dependências do efeito

  // --- Função Reset ---
  const resetForm = () => {
    setName('');
    setQuantity('1');
    setUnit('un');
    setCategory('');
    setLastPurchaseDate(null);
    setLastPurchaseQuantityInput('');
    setLastPurchaseValueInput('');
    setNextPurchaseDate(null);
    setNextPurchaseValueInput('');
    setErrorMessage(null);
    setShowLastPurchaseDatePicker(false);
    setShowNextPurchaseDatePicker(false);
  };
  // --------------------

  // --- Handlers Date Pickers ---
  const handleLastPurchaseDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowLastPurchaseDatePicker(Platform.OS === 'ios');
    if (selectedDate) setLastPurchaseDate(selectedDate);
    if (Platform.OS === 'android') setShowLastPurchaseDatePicker(false);
  };

  const handleNextPurchaseDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowNextPurchaseDatePicker(Platform.OS === 'ios');
    if (selectedDate) setNextPurchaseDate(selectedDate);
    if (Platform.OS === 'android') setShowNextPurchaseDatePicker(false);
  };
  // -----------------------------

  // --- Handler para Salvar (Adiciona ou Edita) ---
  const handleSaveItem = async () => {
    // Validações essenciais
    if (!currentUser || !groupId) { setErrorMessage("Erro: Usuário ou grupo não identificado."); return; }
    const trimmedName = name.trim();
    if (!trimmedName) { setErrorMessage("Digite o nome do item."); return; }
    const numQuantity = parseInt(quantity, 10);
    if (isNaN(numQuantity) || numQuantity < 0) { setErrorMessage("Digite uma quantidade válida (0 ou mais)."); return; }
    const trimmedUnit = unit.trim();
    if (!trimmedUnit) { setErrorMessage("Digite a unidade de medida."); return; }

    // Validações e Conversões Opcionais Numéricas
    let numLastPurchaseQuantity: number | null = null;
    if (lastPurchaseQuantityInput.trim()) {
        numLastPurchaseQuantity = parseInt(lastPurchaseQuantityInput, 10);
        if (isNaN(numLastPurchaseQuantity) || numLastPurchaseQuantity <= 0) { setErrorMessage("Quantidade da última compra inválida."); return; }
    }
    let numLastPurchaseValue: number | null = null;
    if (lastPurchaseValueInput.trim()) {
        numLastPurchaseValue = parseFloat(lastPurchaseValueInput.replace(',', '.'));
        if (isNaN(numLastPurchaseValue) || numLastPurchaseValue < 0) { setErrorMessage("Valor da última compra inválido."); return; }
    }
     let numNextPurchaseValue: number | null = null;
     if (nextPurchaseValueInput.trim()) {
         numNextPurchaseValue = parseFloat(nextPurchaseValueInput.replace(',', '.'));
         if (isNaN(numNextPurchaseValue) || numNextPurchaseValue < 0) { setErrorMessage("Valor da próxima compra inválido."); return; }
     }

    // Prepara os dados para salvar/atualizar
    // Campos que são atualizados em ambos os casos (add/edit)
    const itemDataPayload = {
        name: trimmedName,
        quantity: numQuantity,
        unit: trimmedUnit,
        category: category.trim() || null, // Salva null se vazio
        lastPurchaseDate: lastPurchaseDate ? Timestamp.fromDate(lastPurchaseDate) : null,
        lastPurchaseQuantity: numLastPurchaseQuantity,
        lastPurchaseValue: numLastPurchaseValue,
        nextPurchaseDate: nextPurchaseDate ? Timestamp.fromDate(nextPurchaseDate) : null,
        nextPurchaseValue: numNextPurchaseValue,
        updatedAt: serverTimestamp(), // Sempre atualiza 'updatedAt'
        lastUpdatedBy: currentUser.uid, // Sempre atualiza quem modificou
        // store não é editável neste modal, mantido o original se editando, ou omitido se criando
        ...(isEditing && itemToEdit?.store && { store: itemToEdit.store }),
    };

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (isEditing && itemToEdit) {
        // --- ATUALIZAR Item Existente ---
        console.log("Updating inventory item:", itemToEdit.id);
        const itemDocRef = doc(db, "groups", groupId, "inventoryItems", itemToEdit.id);
        // O update sobrescreve apenas os campos passados
        await updateDoc(itemDocRef, itemDataPayload);
        console.log("Inventory item updated successfully!");

      } else {
        // --- CRIAR Novo Item ---
        // Adiciona campos que só existem na criação
        const newItemData = {
          ...itemDataPayload, // Inclui campos comuns e opcionais preparados
          addedBy: currentUser.uid,
          addedAt: serverTimestamp(),
          groupId: groupId, // Adiciona groupId se necessário
           // Define store apenas na criação se ele foi preenchido (não temos input para ele aqui)
           // store: storeValue || undefined, // Se tivesse input de store na criação
        };
        console.log("Adding inventory item:", newItemData);
        const collectionPath = collection(db, "groups", groupId, "inventoryItems");
        await addDoc(collectionPath, newItemData);
        console.log("Inventory item added successfully!");
      }
      onClose(); // Fecha o modal no sucesso

    } catch (error: any) {
      console.error("Error saving inventory item:", error);
      setErrorMessage(`Erro ao ${isEditing ? 'atualizar' : 'adicionar'} item.`);
      if (error.code === 'permission-denied') { /* ... tratamento específico ... */ }
    } finally {
      setIsLoading(false); // Desativa loading
    }
  };

  // --- UI do Modal ---
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
                <ScrollView keyboardShouldPersistTaps="handled">
                    {/* Cabeçalho */}
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{isEditing ? 'Editar Item' : 'Adicionar Item'} ao Inventário</Text>
                        <TouchableOpacity onPress={onClose} disabled={isLoading}>
                           <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Campos Principais */}
                    <Text style={styles.label}>Nome do Item*</Text>
                    <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Arroz Integral 1kg" editable={!isLoading}/>

                    <View style={styles.row}>
                        <View style={styles.column}>
                            <Text style={styles.label}>{isEditing ? 'Qtde Atual*' : 'Qtde Inicial*'}</Text>
                            <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" placeholder="0" editable={!isLoading}/>
                        </View>
                        <View style={styles.column}>
                            <Text style={styles.label}>Unidade*</Text>
                            <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholder="un, kg, L, pct" autoCapitalize="none" editable={!isLoading}/>
                        </View>
                    </View>

                    <Text style={styles.label}>Categoria (Opcional)</Text>
                    <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="Ex: Grãos, Limpeza" editable={!isLoading}/>

                    {/* Seção Última Compra (Opcional) */}
                    <Text style={styles.sectionTitle}>Última Compra (Opcional)</Text>
                    <Text style={styles.label}>Data da Compra</Text>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowLastPurchaseDatePicker(true)} disabled={isLoading}>
                        <Text style={styles.dateButtonText}>{lastPurchaseDate ? lastPurchaseDate.toLocaleDateString('pt-BR') : 'Selecionar data'}</Text>
                        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    {showLastPurchaseDatePicker && (
                        <DateTimePicker
                            value={lastPurchaseDate || new Date()}
                            mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={handleLastPurchaseDateChange} maximumDate={new Date()}
                            textColor={colors.textPrimary} // Cor texto iOS
                        />
                    )}
                    {showLastPurchaseDatePicker && Platform.OS === 'ios' && (<TouchableOpacity onPress={() => setShowLastPurchaseDatePicker(false)} style={styles.closeDatePickerButton}><Text style={styles.closeDatePickerText}>Confirmar</Text></TouchableOpacity>)}

                     <View style={styles.row}>
                        <View style={styles.column}>
                            <Text style={styles.label}>Qtde Comprada</Text>
                            <TextInput style={styles.input} value={lastPurchaseQuantityInput} onChangeText={setLastPurchaseQuantityInput} keyboardType="number-pad" placeholder="Ex: 2" editable={!isLoading}/>
                        </View>
                        <View style={styles.column}>
                            <Text style={styles.label}>Valor Total Pago (R$)</Text>
                            <TextInput style={styles.input} value={lastPurchaseValueInput} onChangeText={setLastPurchaseValueInput} keyboardType="numeric" placeholder="Ex: 10,50" editable={!isLoading}/>
                        </View>
                    </View>

                     {/* Seção Próxima Compra (Opcional) */}
                    <Text style={styles.sectionTitle}>Próxima Compra (Opcional)</Text>
                     <Text style={styles.label}>Data Estimada</Text>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowNextPurchaseDatePicker(true)} disabled={isLoading}>
                        <Text style={styles.dateButtonText}>{nextPurchaseDate ? nextPurchaseDate.toLocaleDateString('pt-BR') : 'Selecionar data'}</Text>
                        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    {showNextPurchaseDatePicker && (
                        <DateTimePicker
                            value={nextPurchaseDate || new Date()}
                            mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={handleNextPurchaseDateChange} minimumDate={new Date()} // Só datas futuras
                            textColor={colors.textPrimary}
                        />
                    )}
                     {showNextPurchaseDatePicker && Platform.OS === 'ios' && (<TouchableOpacity onPress={() => setShowNextPurchaseDatePicker(false)} style={styles.closeDatePickerButton}><Text style={styles.closeDatePickerText}>Confirmar</Text></TouchableOpacity>)}

                    <Text style={styles.label}>Valor Estimado (R$)</Text>
                    <TextInput style={styles.input} value={nextPurchaseValueInput} onChangeText={setNextPurchaseValueInput} keyboardType="numeric" placeholder="Ex: 12,00" editable={!isLoading}/>

                    {/* Mensagem de Erro */}
                    {errorMessage && <Text style={styles.errorMessage}>{errorMessage}</Text>}

                    {/* Botão Salvar / Atualizar */}
                    <TouchableOpacity
                        style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
                        onPress={handleSaveItem} // Usa a função renomeada
                        disabled={isLoading}
                    >
                        {isLoading
                           ? <ActivityIndicator color="#FFF" />
                           : <Text style={styles.saveButtonText}>{isEditing ? 'Atualizar Item' : 'Salvar Item'}</Text>
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
    keyboardAvoidingView: { flex: 1 },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    modalContainer: { backgroundColor: colors.bottomSheet, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 30, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
    label: { fontSize: 14, color: colors.textSecondary, marginBottom: 5, marginTop: 10 },
    input: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    column: { width: '48%' },
    dateButton: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    dateButtonText: { fontSize: 16, color: colors.textPrimary },
    closeDatePickerButton: { alignItems: 'flex-end', paddingVertical: 10 },
    closeDatePickerText: { color: colors.primary, fontSize: 16, fontWeight: 'bold' },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginTop: 20, marginBottom: 10, borderTopWidth: 1, borderTopColor: colors.border + '80', paddingTop: 15 },
    errorMessage: { color: colors.error, textAlign: 'center', marginTop: 10, marginBottom: 5, fontSize: 14 },
    saveButton: { backgroundColor: colors.primary, paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginTop: 20 },
    saveButtonDisabled: { backgroundColor: colors.textSecondary, opacity: 0.7 },
    saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});

export default AddInventoryItemModal;