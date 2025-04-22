// components/budget/AddBudgetModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, StyleSheet, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView, Platform, Keyboard
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Timestamp, addDoc, collection, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { BudgetData } from '@/types';

// --- Helpers de Data ---
const formatToMonthYearString = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const parseMonthYearString = (monthYear: string | null | undefined): Date => {
    const fallbackDate = new Date(); fallbackDate.setDate(1); fallbackDate.setHours(0,0,0,0);
    if (monthYear && typeof monthYear === 'string' && monthYear.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = monthYear.split('-').map(Number);
        return new Date(year, month - 1, 1, 0, 0, 0, 0);
    }
    return new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), 1, 0, 0, 0, 0);
}
const formatMonthYearDisplay = (date: Date): string => date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric'});
// -----------------------

interface AddBudgetModalProps {
  isVisible: boolean;
  onClose: () => void;
  groupId: string | null;
  existingCategories: string[]; // Categorias disponíveis para seleção
  budgetToEdit?: BudgetData | null;
}

const AddBudgetModal: React.FC<AddBudgetModalProps> = ({
  isVisible, onClose, groupId, existingCategories = [], budgetToEdit
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const currentUser = auth.currentUser;
  const isEditing = !!budgetToEdit;

  // --- Estados ---
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [targetMonthYear, setTargetMonthYear] = useState<Date>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // -------------

  // --- Preencher/Resetar ---
  useEffect(() => {
    if (isVisible) {
      if (isEditing && budgetToEdit && budgetToEdit.type === 'monthly') { // Garante que é mensal ao editar
        setName(budgetToEdit.name);
        setTargetAmount(budgetToEdit.targetAmount.toString().replace('.', ','));
        setSelectedCategories(budgetToEdit.categories || []);
        setTargetMonthYear(parseMonthYearString(budgetToEdit.monthYear));
      } else {
        // Reset para adicionar
        setName('');
        setTargetAmount('');
        setSelectedCategories([]);
        // Começa no mês atual por padrão ao adicionar
        setTargetMonthYear(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
      }
      setErrorMessage(null); setIsLoading(false); setShowMonthPicker(false);
    }
  }, [isVisible, budgetToEdit, isEditing]);

  // --- Handlers ---
  const handleMonthYearChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
     setShowMonthPicker(Platform.OS === 'ios');
     if (selectedDate) {
         setTargetMonthYear(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
     }
     if (Platform.OS === 'android') setShowMonthPicker(false);
  };

  const toggleCategorySelection = (category: string) => {
      setSelectedCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]);
  };

  // --- Salvar ---
  const handleSave = async () => {
    if (!currentUser || !groupId) { /* ... erro ... */ return; }
    const trimmedName = name.trim();
    if (!trimmedName) { setErrorMessage("Digite um nome para o orçamento."); return; }
    const numTargetAmount = parseFloat(targetAmount.replace(',', '.'));
    if (isNaN(numTargetAmount) || numTargetAmount <= 0) { setErrorMessage("Digite um limite de gasto válido."); return; }
    if (selectedCategories.length === 0) { setErrorMessage("Selecione pelo menos uma categoria."); return; }

    const budgetPayload = {
        name: trimmedName,
        targetAmount: numTargetAmount,
        categories: selectedCategories.sort((a,b)=>a.localeCompare(b)), // Salva ordenado
        monthYear: formatToMonthYearString(targetMonthYear),
        type: 'monthly' as 'monthly', // Define o tipo
        updatedAt: serverTimestamp(),
        // createdBy/createdAt são definidos apenas na criação
    };

    setIsLoading(true); setErrorMessage(null);

    try {
      if (isEditing && budgetToEdit) {
        // --- ATUALIZAR ---
        const budgetDocRef = doc(db, "groups", groupId, "budgets", budgetToEdit.id);
        await updateDoc(budgetDocRef, budgetPayload);
      } else {
        // --- CRIAR ---
        const newBudgetData = {
            ...budgetPayload,
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
        };
        const collectionPath = collection(db, "groups", groupId, "budgets");
        await addDoc(collectionPath, newBudgetData);
      }
      onClose(); // Fecha modal
    } catch (error: any) { /* ... tratamento erro ... */ }
    finally { setIsLoading(false); }
  };

  // --- UI ---
  return (
    <Modal visible={isVisible} onRequestClose={onClose} animationType="slide" transparent={true}>
       <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoidingView}>
         <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
            <TouchableOpacity style={styles.modalContainer} activeOpacity={1} onPress={() => Keyboard.dismiss()}>
                <ScrollView keyboardShouldPersistTaps="handled">
                    {/* Cabeçalho */}
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{isEditing ? 'Editar' : 'Novo'} Orçamento Mensal</Text>
                        <TouchableOpacity onPress={onClose} disabled={isLoading}><Ionicons name="close-circle" size={28} color={colors.textSecondary} /></TouchableOpacity>
                    </View>

                    {/* Nome do Orçamento */}
                    <Text style={styles.label}>Nome do Orçamento*</Text>
                    <TextInput placeholderTextColor={colors.textSecondary} style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Essenciais, Comida Fora" editable={!isLoading} />

                     {/* Limite Mensal */}
                     <Text style={styles.label}>Limite Mensal (R$)*</Text>
                    <TextInput placeholderTextColor={colors.textSecondary} style={styles.input} value={targetAmount} onChangeText={setTargetAmount} keyboardType="numeric" placeholder="Ex: 1500,00" editable={!isLoading} />

                    {/* Seleção de Mês/Ano */}
                    <Text style={styles.label}>Mês/Ano do Orçamento*</Text>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowMonthPicker(true)} disabled={isLoading}>
                        <Text style={styles.dateButtonText}>{targetMonthYear.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric'})}</Text>
                        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    {showMonthPicker && (
                        <DateTimePicker
                            value={targetMonthYear} mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'} // Spinner no iOS mostra mês/ano melhor
                            onChange={handleMonthYearChange}
                            // maximumDate={new Date()} // Permite planejar futuro? Se sim, remova maximumDate
                        />
                    )}
                    {showMonthPicker && Platform.OS === 'ios' && (<TouchableOpacity onPress={() => setShowMonthPicker(false)} style={styles.closeDatePickerButton}><Text style={styles.closeDatePickerText}>Confirmar</Text></TouchableOpacity>)}


                    {/* Seleção de Categorias */}
                    <Text style={styles.label}>Categorias Incluídas* (Selecione)</Text>
                     <View style={styles.categorySelectionContainer}>
                        {existingCategories.length === 0 ? (
                            <Text style={styles.noCategoryText}>Adicione categorias no Perfil.</Text>
                        ) : (
                            // Ordena para exibição
                            existingCategories.sort((a,b)=>a.localeCompare(b)).map(cat => {
                                const isSelected = selectedCategories.includes(cat);
                                return (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[styles.chip, isSelected ? styles.chipSelected : styles.chipIdle]}
                                        onPress={() => toggleCategorySelection(cat)}
                                        disabled={isLoading}
                                    >
                                        <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : styles.chipTextIdle]}>{cat}</Text>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>

                    {/* Erro e Botão Salvar */}
                    {errorMessage && <Text style={styles.errorMessage}>{errorMessage}</Text>}
                    <TouchableOpacity style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} onPress={handleSave} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>{isEditing ? 'Atualizar Orçamento' : 'Salvar Orçamento'}</Text>}
                    </TouchableOpacity>
                </ScrollView>
            </TouchableOpacity>
            </TouchableOpacity>
       </KeyboardAvoidingView>
    </Modal>
  );
};

// --- Estilos (Como na versão anterior do AddBudgetModal) ---
const getStyles = (colors: any) => StyleSheet.create({
    keyboardAvoidingView: { flex: 1 },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    modalContainer: { backgroundColor: colors.bottomSheet, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 30, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
    label: { fontSize: 14, color: colors.textSecondary, marginBottom: 5, marginTop: 15 },
    input: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
    // Removido typeSelector
    dateButton: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    dateButtonText: { fontSize: 16, color: colors.textPrimary },
    closeDatePickerButton: { alignItems: 'flex-end', paddingVertical: 10 },
    closeDatePickerText: { color: colors.primary, fontSize: 16, fontWeight: 'bold' },
    categorySelectionContainer: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.surface, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 5, borderWidth: 1, borderColor: colors.border, marginBottom: 15 },
    chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, marginRight: 8, marginBottom: 8, borderWidth: 1 },
    chipIdle: { backgroundColor: colors.background, borderColor: colors.border },
    chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13 },
    chipTextIdle: { color: colors.textSecondary },
    chipTextSelected: { color: '#FFFFFF', fontWeight: 'bold' },
    noCategoryText: { color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center', padding: 10 },
    errorMessage: { color: colors.error, textAlign: 'center', marginTop: 10, marginBottom: 5, fontSize: 14 },
    saveButton: { backgroundColor: colors.primary, paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginTop: 20 },
    saveButtonDisabled: { backgroundColor: colors.textSecondary, opacity: 0.7 },
    saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});

export default AddBudgetModal;