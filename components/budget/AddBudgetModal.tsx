// components/budget/AddBudgetModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView, Platform,
  FlatList, // Adicionado FlatList
  Keyboard // Adicionado Keyboard
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Timestamp, addDoc, collection, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { BudgetData } from '@/types';
import { getMonthYear } from '@/utils/helpers';

interface AddBudgetModalProps {
  isVisible: boolean;
  onClose: () => void;
  groupId: string | null;
  existingCategories: string[]; // Lista de categorias existentes para autocomplete/validação
  budgetToEdit?: BudgetData | null;
}

type BudgetType = 'monthly' | 'goal';

const AddBudgetModal: React.FC<AddBudgetModalProps> = ({
  isVisible, onClose, groupId, existingCategories = [], budgetToEdit // Garante que existingCategories seja um array
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const currentUser = auth.currentUser;
  const isEditing = !!budgetToEdit;

  // --- Estados do Formulário ---
  const [type, setType] = useState<BudgetType>('monthly');
  const [name, setName] = useState(''); // Nome (da Meta ou do Orçamento Mensal)
  const [targetAmount, setTargetAmount] = useState('');
  // Específicos Mensal
  const [category, setCategory] = useState(''); // Categoria para orçamento mensal
  // Específicos Meta
  const [amountSaved, setAmountSaved] = useState('0');
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [showTargetDatePicker, setShowTargetDatePicker] = useState(false);

  // Estados UI e Autocomplete
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]); // <-- Estado para sugestões
  const [showSuggestions, setShowSuggestions] = useState(false);                 // <-- Estado para visibilidade das sugestões
  // -----------------------------

  // --- Preencher/Resetar Formulário ---
  useEffect(() => {
    if (isVisible) {
      if (isEditing && budgetToEdit) {
        // Modo Edição
        setType(budgetToEdit.type);
        setName(budgetToEdit.name);
        setTargetAmount(budgetToEdit.targetAmount.toString().replace('.', ','));
        if (budgetToEdit.type === 'monthly') {
          setCategory(budgetToEdit.category || ''); // Preenche categoria para mensal
        } else { // goal
          setAmountSaved(budgetToEdit.amountSaved?.toString().replace('.', ',') || '0');
          setTargetDate(budgetToEdit.targetDate?.toDate() || null);
        }
      } else {
        // Modo Adicionar: Reset
        setType('monthly');
        setName('');
        setTargetAmount('');
        setCategory(''); // Reseta categoria
        setAmountSaved('0');
        setTargetDate(null);
      }
      // Reseta estados de UI sempre
      setErrorMessage(null);
      setIsLoading(false);
      setShowTargetDatePicker(false);
      setCategorySuggestions([]);
      setShowSuggestions(false);
    }
  }, [isVisible, budgetToEdit, isEditing]);

  // --- Efeito para Filtrar Sugestões de Categoria ---
  useEffect(() => {
    // Só filtra se for orçamento mensal e tiver input
    if (type === 'monthly' && category.trim().length > 0 && existingCategories) {
      const currentInput = category.trim().toLowerCase();
      const filtered = existingCategories
        .filter(cat => cat.toLowerCase().includes(currentInput))
        .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

      setCategorySuggestions(filtered);
      const exactMatch = filtered.some(f => f.toLowerCase() === currentInput);
      setShowSuggestions(filtered.length > 0 && !exactMatch); // Mostra se há sugestões e não é match exato
    } else {
      setCategorySuggestions([]); // Limpa se input vazio ou não é mensal
      setShowSuggestions(false);
    }
  }, [category, existingCategories, type]); // Depende do input, categorias base e TIPO do orçamento

  // --- Handler para Mudança de Data ---
  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => { /* ... como antes ... */ };

  // --- Handler para Selecionar Sugestão de Categoria ---
  const handleSelectSuggestion = (selectedCat: string) => {
      console.log("Category Suggestion selected:", selectedCat);
      setCategory(selectedCat);        // Define input com a sugestão
      setCategorySuggestions([]);     // Limpa sugestões
      setShowSuggestions(false);       // Esconde lista
      Keyboard.dismiss();             // Fecha teclado
  };
  // --------------------------------------

  // --- Handler para Salvar ---
  const handleSave = async () => {
    if (!currentUser || !groupId) { setErrorMessage("Erro: Usuário ou grupo não identificado."); return; }

    const trimmedName = name.trim(); // Nome do orçamento ou meta
    // Nome é obrigatório para ambos os tipos
    if (!trimmedName) {
        setErrorMessage(type === 'monthly' ? "Digite um nome para o orçamento." : "Digite um nome para a meta.");
        return;
    }

    const numTargetAmount = parseFloat(targetAmount.replace(',', '.'));
    if (isNaN(numTargetAmount) || numTargetAmount <= 0) { setErrorMessage("Digite um valor alvo válido."); return; }

    let finalCategoryName: string | null = null; // Categoria a ser salva (apenas para mensal)
    let numAmountSaved = 0; // Apenas para meta

    // Validações e preparações específicas por tipo
    if (type === 'monthly') {
        const categoryToSave = category.trim();
        if (!categoryToSave) { setErrorMessage("Selecione ou digite uma categoria válida."); return; }

        // VALIDAÇÃO ESTRITA: Categoria DEVE existir na lista (case-insensitive)
        const validCategory = existingCategories.find(c => c.toLowerCase() === categoryToSave.toLowerCase());
        if (!validCategory) {
            setErrorMessage(`Categoria "${categoryToSave}" inválida. Selecione uma existente ou adicione-a no Perfil.`);
            return; // Impede salvamento
        }
        finalCategoryName = validCategory; // Usa a grafia correta encontrada

    } else { // goal
        numAmountSaved = parseFloat(amountSaved.replace(',', '.')) || 0;
        if (isNaN(numAmountSaved) || numAmountSaved < 0) { setErrorMessage("Valor guardado inválido."); return; }
    }

    setIsLoading(true);
    setErrorMessage(null);

    // Dados comuns e específicos
    const budgetBaseData = {
        name: trimmedName, // Nome do Orçamento ou Meta
        type: type,
        targetAmount: numTargetAmount,
        updatedAt: serverTimestamp(),
    };

    let specificData = {};
    if (type === 'monthly') {
        specificData = {
            category: finalCategoryName, // Categoria validada
            monthYear: isEditing && budgetToEdit ? budgetToEdit.monthYear : getMonthYear(new Date()), // Mantém mês na edição, senão mês atual
            amountSaved: 0, targetDate: null, // Zera campos de meta
        };
    } else { // goal
        specificData = {
            amountSaved: numAmountSaved,
            targetDate: targetDate ? Timestamp.fromDate(targetDate) : null,
            category: null, monthYear: null, // Zera campos mensais
        };
    }

    try {
      const finalData = { ...budgetBaseData, ...specificData };
      if (isEditing && budgetToEdit) {
        // ATUALIZAR
        console.log("Updating budget/goal:", budgetToEdit.id);
        const budgetDocRef = doc(db, "groups", groupId, "budgets", budgetToEdit.id);
        await updateDoc(budgetDocRef, finalData);
        console.log("Budget/Goal updated successfully!");
      } else {
        // CRIAR
        const newBudgetData = { ...finalData, createdBy: currentUser.uid, createdAt: serverTimestamp() };
        console.log("Adding budget/goal:", newBudgetData);

        const collectionPath = collection(db, "groups", groupId, "budgets");
        await addDoc(collectionPath, newBudgetData);
        console.log("Budget/Goal added successfully!");
      }
      onClose(); // Fecha o modal

    } catch (error: any) {
      console.error("Error saving budget/goal:", error);
      setErrorMessage(`Erro ao ${isEditing ? 'atualizar' : 'salvar'}.`);
    } finally {
      setIsLoading(false);
    }
  };


  // --- UI ---
  return (
    <Modal visible={isVisible} onRequestClose={onClose} animationType="slide" transparent={true}>
       <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoidingView}>
         <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
            <TouchableOpacity style={styles.modalContainer} activeOpacity={1} onPress={() => Keyboard.dismiss()}>
                <ScrollView keyboardShouldPersistTaps="handled">
                    {/* Cabeçalho */}
                    <View style={styles.modalHeader}>/* ... Título e Botão Fechar ... */</View>

                    {/* Seletor de Tipo */}
                    <View style={styles.typeSelector}>
                         <TouchableOpacity /* Botão Mensal */ onPress={() => setType('monthly')} disabled={isLoading || isEditing} style={[styles.typeButton, styles.typeButtonLeft, type === 'monthly' && styles.typeButtonActive]} >
                            <Text style={[styles.typeButtonText, type === 'monthly' && styles.typeButtonTextActive]}>Orçamento Mensal</Text>
                         </TouchableOpacity>
                         <TouchableOpacity /* Botão Meta */ onPress={() => setType('goal')} disabled={isLoading || isEditing} style={[styles.typeButton, styles.typeButtonRight, type === 'goal' && styles.typeButtonActive]} >
                            <Text style={[styles.typeButtonText, type === 'goal' && styles.typeButtonTextActive]}>Meta Poupança</Text>
                         </TouchableOpacity>
                    </View>

                    {/* Nome do Orçamento/Meta */}
                    <Text style={styles.label}>{type === 'monthly' ? 'Nome do Orçamento*' : 'Nome da Meta*'}</Text>
                    <TextInput placeholderTextColor={colors.textSecondary} style={styles.input} value={name} onChangeText={setName} placeholder={type === 'monthly' ? 'Ex: Compras do mês' : 'Ex: Viagem Férias'} editable={!isLoading} />

                    {/* Categoria (APENAS MENSAL) */}
                    {type === 'monthly' && (
                        <>
                          <Text style={styles.label}>Categoria Vinculada*</Text>
                          <TextInput
                              style={styles.input}
                              placeholder="Digite ou selecione a categoria"
                              placeholderTextColor={colors.textSecondary}
                              value={category}
                              onChangeText={setCategory}
                              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                              onFocus={() => setShowSuggestions(categorySuggestions.length > 0 && category.length > 0)}
                              editable={!isLoading}
                           />
                           {/* Lista de Sugestões */}
                           {showSuggestions && categorySuggestions.length > 0 && (
                            <View style={styles.suggestionsContainer}>
                              <FlatList
                                data={categorySuggestions}
                                keyExtractor={(item) => item}
                                renderItem={({ item }) => (
                                  <TouchableOpacity
                                    style={styles.suggestionItem}
                                    onPress={() => handleSelectSuggestion(item)}
                                  >
                                    <Text style={styles.suggestionText}>{item}</Text>
                                  </TouchableOpacity>
                                )}
                                nestedScrollEnabled={true}
                                keyboardShouldPersistTaps="always"
                                scrollEnabled={false}
                                style={{ maxHeight: 150 }}
                              />
                            </View>
                          )}
                        </>
                    )}

                     {/* Valor Alvo */}
                    <Text style={styles.label}>{type === 'monthly' ? 'Limite Mensal (R$)*' : 'Valor Alvo (R$)*'}</Text>
                    <TextInput placeholderTextColor={colors.textSecondary} style={styles.input} value={targetAmount} onChangeText={setTargetAmount} keyboardType="numeric" /*...*/ />

                    {/* Campos Específicos de Metas */}
                    {type === 'goal' && (
                        <>
                            <Text style={styles.label}>Valor Guardado Inicial (R$)</Text>
                            <TextInput placeholderTextColor={colors.textSecondary} style={styles.input} value={amountSaved} onChangeText={setAmountSaved} keyboardType="numeric" editable={!isLoading && !isEditing} />

                            <Text style={styles.label}>Data Alvo (Opcional)</Text>
                            <TouchableOpacity style={styles.dateButton} onPress={() => setShowTargetDatePicker(true)} /*...*/>
                                <Text style={styles.dateButtonText}>{targetDate ? targetDate.toLocaleDateString('pt-BR') : 'Selecionar data'}</Text>
                                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                            </TouchableOpacity>
                            {showTargetDatePicker && ( <DateTimePicker value={targetDate || new Date()} mode="date" display='default' onChange={handleDateChange} minimumDate={new Date()} /> )}
                            {showTargetDatePicker && Platform.OS === 'ios' && (<TouchableOpacity onPress={() => setShowTargetDatePicker(false)} style={styles.closeDatePickerButton}><Text style={styles.closeDatePickerText}>Confirmar</Text></TouchableOpacity>)}
                       </>
                    )}

                    {/* Erro e Botão Salvar */}
                    {errorMessage && <Text style={styles.errorMessage}>{errorMessage}</Text>}
                    <TouchableOpacity style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} onPress={handleSave} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>{isEditing ? 'Atualizar' : 'Salvar'}</Text>}
                    </TouchableOpacity>
                </ScrollView>
                </TouchableOpacity>
            </TouchableOpacity>
       </KeyboardAvoidingView>
    </Modal>
  );
};

// --- Estilos (Adiciona/Ajusta estilos para sugestões) ---
const getStyles = (colors: any) => StyleSheet.create({
    keyboardAvoidingView: { flex: 1 },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    modalContainer: { backgroundColor: colors.bottomSheet, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 30, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
    label: { fontSize: 14, color: colors.textSecondary, marginBottom: 5, marginTop: 15 },
    input: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
    typeSelector: { flexDirection: 'row', marginBottom: 15, marginTop: 5 },
    typeButton: { flex: 1, paddingVertical: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', backgroundColor: colors.surface },
    typeButtonLeft: { borderTopLeftRadius: 8, borderBottomLeftRadius: 8, borderRightWidth: 0.75 },
    typeButtonRight: { borderTopRightRadius: 8, borderBottomRightRadius: 8, borderLeftWidth: 0.75 },
    typeButtonActive: { backgroundColor: colors.primary },
    typeButtonText: { fontSize: 15, fontWeight: '500', color: colors.primary },
    typeButtonTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
    dateButton: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    dateButtonText: { fontSize: 16, color: colors.textPrimary },
    closeDatePickerButton: { alignItems: 'flex-end', paddingVertical: 10 },
    closeDatePickerText: { color: colors.primary, fontSize: 16, fontWeight: 'bold' },
    errorMessage: { color: colors.error, textAlign: 'center', marginTop: 10, marginBottom: 5, fontSize: 14 },
    saveButton: { backgroundColor: colors.primary, paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginTop: 20 },
    saveButtonDisabled: { backgroundColor: colors.textSecondary, opacity: 0.7 },
    saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },    suggestionsContainer: {
    // position: 'absolute', // Pode causar problemas com KAV/ScrollView
    // left: 20, right: 20, top: XXX, // Posição absoluta é frágil
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.surface,
    maxHeight: 150,
    marginTop: -10, // Tenta sobrepor levemente a margem inferior do input
    marginBottom: 10, // Espaço abaixo
    zIndex: 10, // Tenta manter por cima
    elevation: 3,
    },
    suggestionItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    suggestionText: {
        fontSize: 16,
        color: colors.textPrimary,
    },
});

export default AddBudgetModal;