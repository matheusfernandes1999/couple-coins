// components/dashboard/AddTransactionModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, StyleSheet, TextInput, TouchableOpacity,
  Platform, ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView,
  FlatList, // Para lista de sugestões
  Keyboard // Para fechar teclado
} from 'react-native';
import { useTheme } from '../../context/ThemeContext'; // Ajuste o caminho
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Timestamp, addDoc, collection, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase'; // Ajuste o caminho
import { Transaction } from '@/types';         // Ajuste o caminho

// Interface das Props - Removido onCategoryAdd
interface AddTransactionModalProps {
  isVisible: boolean;
  onClose: () => void;
  groupId: string | null;
  existingCategories: string[];          // Lista de categorias válidas do grupo
  transactionToEdit?: Transaction | null; // Transação para editar (opcional)
}

// Tipo para o seletor Entrada/Saída
type TransactionType = 'income' | 'expense';

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isVisible,
  onClose,
  groupId,
  existingCategories, // Recebe as categorias existentes
  transactionToEdit // Recebe a transação para editar (ou null/undefined)
}) => {
  const { colors } = useTheme(); // Hook para cores do tema
  const styles = getStyles(colors); // Gera estilos
  const currentUser = auth.currentUser; // Usuário logado

  // Flag para saber se está editando ou criando
  const isEditing = !!transactionToEdit;

  // --- Estados do Formulário ---
  const [amount, setAmount] = useState('');                        // Valor (string para input)
  const [type, setType] = useState<TransactionType>('expense');    // Tipo (income/expense)
  const [category, setCategory] = useState('');                    // Categoria selecionada/digitada
  const [date, setDate] = useState(new Date());                    // Data da transação
  const [description, setDescription] = useState('');              // Descrição opcional
  const [showDatePicker, setShowDatePicker] = useState(false);     // Controle do DatePicker
  const [isLoading, setIsLoading] = useState(false);               // Loading do botão salvar
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // Mensagem de erro

  // --- Estados para Autocomplete de Categoria ---
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]); // Sugestões filtradas
  const [showSuggestions, setShowSuggestions] = useState(false);                 // Visibilidade das sugestões
  // ---------------------------------------------

  // --- Efeito para Preencher (se editando) ou Resetar Formulário ---
  useEffect(() => {
    if (isVisible) { // Roda quando o modal se torna visível
      if (isEditing && transactionToEdit) {
        // Modo Edição: Preenche com dados da transação existente
        console.log("AddTransactionModal: Editing transaction -", transactionToEdit.id);
        setAmount(transactionToEdit.value.toString().replace('.', ',')); // Formata para input com vírgula
        setType(transactionToEdit.type);
        setCategory(transactionToEdit.category); // Define a categoria atual
        setDate(transactionToEdit.date.toDate()); // Converte Timestamp para Date
        setDescription(transactionToEdit.description || '');
      } else {
        // Modo Adicionar: Reseta todos os campos
        console.log("AddTransactionModal: Opened for adding new transaction");
        setAmount('');
        setType('expense');
        setCategory('');
        setDate(new Date());
        setDescription('');
      }
      // Reseta estados de UI sempre que abre
      setErrorMessage(null);
      setIsLoading(false);
      setCategorySuggestions([]);
      setShowSuggestions(false);
      setShowDatePicker(false);
    }
  }, [isVisible, transactionToEdit, isEditing]); // Dependências: visibilidade e item a editar

  // --- Efeito para Filtrar Sugestões de Categoria ---
  useEffect(() => {
    const currentInput = category.trim().toLowerCase(); // Input atual em minúsculas

    // Só filtra se o input não estiver vazio e tivermos categorias existentes
    if (currentInput.length > 0 && existingCategories && existingCategories.length > 0) {
      const filtered = existingCategories
        // Filtra categorias que INCLUEM o texto digitado (case-insensitive)
        .filter(cat => cat.toLowerCase().includes(currentInput))
        // Ordena alfabeticamente
        .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

      setCategorySuggestions(filtered); // Atualiza as sugestões

      // Mostra sugestões se:
      // 1. Houver sugestões filtradas
      // 2. O texto digitado NÃO for exatamente igual (ignorando caso) a uma das sugestões
      //    (Evita mostrar a lista se o usuário já selecionou/digitou um nome completo)
      const exactMatch = filtered.some(f => f.toLowerCase() === currentInput);
      setShowSuggestions(filtered.length > 0 && !exactMatch);

    } else {
      // Limpa e esconde sugestões se input vazio ou sem categorias base
      setCategorySuggestions([]);
      setShowSuggestions(false);
    }
  }, [category, existingCategories]); // Roda quando o input ou as categorias base mudam

  // --- Handler para Mudança de Data ---
  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    // Fecha o DatePicker no Android imediatamente, no iOS só se confirmar (ou se usar display inline)
    if (Platform.OS === 'android') {
        setShowDatePicker(false);
    }
    setDate(currentDate);
  };

  // --- Handler para Selecionar Sugestão de Categoria ---
  const handleSelectSuggestion = (selectedCat: string) => {
    console.log("Suggestion selected:", selectedCat);
    setCategory(selectedCat);        // Define o input com a categoria clicada
    setCategorySuggestions([]);     // Limpa o array de sugestões
    setShowSuggestions(false);       // Esconde a lista de sugestões
    Keyboard.dismiss();             // Fecha o teclado
  };

  // --- Handler para Salvar (Cria OU Atualiza Transação) ---
  const handleSaveTransaction = async () => {
    // 1. Validações Essenciais
    if (!currentUser || !groupId) { setErrorMessage("Erro: Usuário ou grupo não identificado."); return; }
    const numericAmountString = amount.replace(',', '.');
    const numericAmount = parseFloat(numericAmountString);
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) { setErrorMessage("Digite um valor válido maior que zero."); return; }
    const categoryToSave = category.trim();
    if (!categoryToSave) { setErrorMessage("Selecione ou digite uma categoria."); return; }

    // 2. Validação Estrita da Categoria (Deve existir na lista passada)
    const isValidCategory = existingCategories.some(
        c => c.toLowerCase() === categoryToSave.toLowerCase()
    );
    if (!isValidCategory) {
        setErrorMessage(`Categoria "${categoryToSave}" inválida. Selecione uma existente ou adicione-a na tela de Perfil.`);
        return; // Impede o salvamento
    }
    // Pega a grafia correta da categoria existente para salvar
    const finalCategoryName = existingCategories.find(c => c.toLowerCase() === categoryToSave.toLowerCase()) || categoryToSave;

    // 3. Prepara Dados Comuns (para Add e Update)
    const transactionCommonData = {
      value: numericAmount,
      type: type,
      category: finalCategoryName, // Usa o nome com a grafia correta
      description: description.trim(),
      date: Timestamp.fromDate(date), // Converte objeto Date para Timestamp do Firestore
      // userId NÃO deve ser atualizado na edição
    };

    // 4. Inicia Processo de Salvar/Atualizar
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (isEditing && transactionToEdit) {
        // --- ATUALIZAR Transação Existente ---
        console.log("Updating transaction:", transactionToEdit.id);
        // Cria referência ao documento existente
        const transDocRef = doc(db, "groups", groupId, "transactions", transactionToEdit.id);
        // Prepara dados para atualização (não inclui createdAt, userId original)
        const updateData = {
            ...transactionCommonData,
            updatedAt: serverTimestamp(), // Adiciona timestamp de atualização
            lastEditedBy: currentUser.uid, // Quem editou por último (opcional)
        };
        await updateDoc(transDocRef, updateData); // Executa a atualização
        console.log("Transaction updated successfully!");

      } else {
        // --- CRIAR Nova Transação ---
        // Adiciona campos específicos da criação
        const newTransactionData = {
          ...transactionCommonData,
          userId: currentUser.uid, // ID do usuário que criou
          createdAt: serverTimestamp(), // Timestamp de criação
          // groupId não precisa se for subcoleção
        };
        console.log("Adding transaction:", newTransactionData);
        // Define o caminho da coleção (subcoleção de transactions dentro do grupo)
        const collectionPath = collection(db, "groups", groupId, "transactions");
        await addDoc(collectionPath, newTransactionData); // Adiciona o novo documento
        console.log("Transaction added successfully!");
      }
      onClose(); // Fecha o modal em caso de sucesso

    } catch (error: any) {
      console.error("Error saving transaction:", error);
      setErrorMessage(`Erro ao ${isEditing ? 'atualizar' : 'salvar'} transação.`);
      if (error.code === 'permission-denied') {
        setErrorMessage(`Permissão negada para ${isEditing ? 'atualizar' : 'salvar'} a transação.`);
      }
    } finally {
      setIsLoading(false); // Desativa loading independentemente do resultado
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
        {/* Permite fechar o modal tocando no overlay (opcional) */}
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
          {/* Evita que o toque no container feche o modal */}
          <TouchableOpacity style={styles.modalContainer} activeOpacity={1} onPress={() => Keyboard.dismiss()}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {/* Cabeçalho */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{isEditing ? 'Editar Transação' : 'Nova Transação'}</Text>
                <TouchableOpacity onPress={onClose} disabled={isLoading}>
                  <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Seletor de Tipo */}
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[styles.typeButton, styles.typeButtonLeft, type === 'expense' && styles.typeButtonActive]}
                  onPress={() => setType('expense')} disabled={isLoading}
                >
                  <Text style={[styles.typeButtonText, type === 'expense' && styles.typeButtonTextActive]}> Saída </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, styles.typeButtonRight, type === 'income' && styles.typeButtonActive]}
                  onPress={() => setType('income')} disabled={isLoading}
                >
                  <Text style={[styles.typeButtonText, type === 'income' && styles.typeButtonTextActive]}> Entrada </Text>
                </TouchableOpacity>
              </View>

              {/* Valor */}
              <Text style={styles.label}>Valor (R$)*</Text>
              <TextInput
                style={styles.input} placeholder="0,00" placeholderTextColor={colors.placeholder}
                keyboardType="numeric" value={amount} onChangeText={setAmount} editable={!isLoading}
              />

              {/* Categoria com Autocomplete */}
              <Text style={styles.label}>Categoria*</Text>
              <TextInput
                style={styles.input} placeholder="Digite ou selecione uma categoria"
                placeholderTextColor={colors.placeholder} value={category}
                onChangeText={setCategory} // Atualiza state e dispara filtro de sugestões
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} // Delay para permitir clique na sugestão
                onFocus={() => setShowSuggestions(categorySuggestions.length > 0 && category.length > 0)} // Mostra se já tem sugestões ao focar
                editable={!isLoading}
              />
          
              {showSuggestions && categorySuggestions.length > 0 && (
                        <View style={styles.suggestionsContainer}>
                            <FlatList
                                data={categorySuggestions}
                                keyExtractor={(item) => item}
                                renderItem={({ item }) => (
                                  <TouchableOpacity
                                    style={styles.suggestionItem}
                                    onPress={() => handleSelectSuggestion(item)} // Define categoria ao clicar
                                  >
                                    <Text style={styles.suggestionText}>{item}</Text>
                                  </TouchableOpacity>
                                )}                                nestedScrollEnabled={true}
                                keyboardShouldPersistTaps="always"
                                scrollEnabled={false} // <-- DESABILITA O SCROLL DA FLATLIST
                                style={{ maxHeight: 150 }} // Mantém maxHeight
                            />
                        </View>
                    )}
              {/* ---------------------------------- */}

              {/* Data */}
              <Text style={styles.label}>Data*</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)} disabled={isLoading}>
                <Text style={styles.dateButtonText}>{date.toLocaleDateString('pt-BR')}</Text>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={date} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange} maximumDate={new Date()} textColor={colors.textPrimary}
                />
              )}
              {showDatePicker && Platform.OS === 'ios' && (
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.closeDatePickerButton}>
                      <Text style={styles.closeDatePickerText}>Confirmar Data</Text>
                  </TouchableOpacity>
              )}

              {/* Descrição (Opcional) */}
              <Text style={styles.label}>Descrição (Opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]} placeholder="Detalhes adicionais..."
                placeholderTextColor={colors.placeholder} value={description}
                onChangeText={setDescription} multiline={true} editable={!isLoading}
              />

              {/* Mensagem de Erro */}
              {errorMessage && ( <Text style={styles.errorMessage}>{errorMessage}</Text> )}

              {/* Botão Salvar / Atualizar */}
              <TouchableOpacity
                style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
                onPress={handleSaveTransaction}
                disabled={isLoading}
              >
                {isLoading
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.saveButtonText}>{isEditing ? 'Atualizar Transação' : 'Salvar Transação'}</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
          </TouchableOpacity>

      </KeyboardAvoidingView>
    </Modal>
  );
};

// --- Estilos ---
const getStyles = (colors: any) => StyleSheet.create({
    keyboardAvoidingView: { flex: 1 },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    modalContainer: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 30, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
    label: { fontSize: 14, color: colors.textSecondary, marginBottom: 5, marginTop: 15 },
    input: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, marginBottom: 5 }, // Reduzido marginBottom
    textArea: { minHeight: 80, textAlignVertical: 'top', marginBottom: 10 },
    typeSelector: { flexDirection: 'row', marginBottom: 15, marginTop: 5 },
    typeButton: { flex: 1, paddingVertical: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', backgroundColor: colors.surface },
    typeButtonLeft: { borderTopLeftRadius: 8, borderBottomLeftRadius: 8, borderRightWidth: 0.75 },
    typeButtonRight: { borderTopRightRadius: 8, borderBottomRightRadius: 8, borderLeftWidth: 0.75 },
    typeButtonActive: { backgroundColor: colors.primary },
    typeButtonText: { fontSize: 15, fontWeight: '500', color: colors.primary }, // Ajustado tamanho/peso
    typeButtonTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
    dateButton: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    dateButtonText: { fontSize: 16, color: colors.textPrimary },
    closeDatePickerButton: { alignItems: 'flex-end', paddingVertical: 10 },
    closeDatePickerText: { color: colors.primary, fontSize: 16, fontWeight: 'bold' },
    suggestionsContainer: { // Estilo para o container das sugestões
        // Position absolute pode ser complicado com KAV, alternativa é renderizar abaixo
        // position: 'absolute',
        // left: 20,
        // right: 20,
        // top: 310, // MUITO DEPENDENTE DO LAYOUT - AJUSTE COM CUIDADO OU CALCULE DINAMICAMENTE
        maxHeight: 150,
        backgroundColor: colors.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        zIndex: 10,
        elevation: 3, // Sombra Android
        marginTop: -5, // Sobrepõe um pouco a margem inferior do input
        marginBottom: 10, // Espaço abaixo das sugestões
    },
    suggestionItem: {
        paddingVertical: 10, // Menor padding
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
     suggestionItem_last: { // Remove borda do último item
        borderBottomWidth: 0,
    },
    suggestionText: {
        fontSize: 16,
        color: colors.textPrimary,
    },
    errorMessage: { color: colors.error, textAlign: 'center', marginTop: 10, marginBottom: 5, fontSize: 14 },
    saveButton: { backgroundColor: colors.primary, paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginTop: 20 },
    saveButtonDisabled: { backgroundColor: colors.textSecondary, opacity: 0.7 },
    saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});

export default AddTransactionModal;