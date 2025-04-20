// components/budget/AddBudgetModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView, Platform
} from 'react-native';
import { useTheme } from '../../context/ThemeContext'; // Ajuste o caminho
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Timestamp, addDoc, collection, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase'; // Ajuste o caminho
import { BudgetData } from '@/types'; // Ajuste o caminho
import { getMonthYear } from '@/utils/helpers'; // Importa helper de data

interface AddBudgetModalProps {
  isVisible: boolean;
  onClose: () => void;
  groupId: string | null;
  existingCategories: string[]; // Para sugestão/validação de categoria mensal
  budgetToEdit?: BudgetData | null; // Para edição
}

type BudgetType = 'monthly' | 'goal';

const AddBudgetModal: React.FC<AddBudgetModalProps> = ({
  isVisible, onClose, groupId, existingCategories, budgetToEdit
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const currentUser = auth.currentUser;
  const isEditing = !!budgetToEdit;

  // --- Estados do Formulário ---
  const [type, setType] = useState<BudgetType>('monthly'); // Default mensal
  const [name, setName] = useState(''); // Nome da meta ou Categoria para mensal
  const [targetAmount, setTargetAmount] = useState('');
  // Específicos Mensal
  const [category, setCategory] = useState(''); // Usado apenas se type='monthly'
  // Específicos Meta
  const [amountSaved, setAmountSaved] = useState('0'); // Valor inicial guardado
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [showTargetDatePicker, setShowTargetDatePicker] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // -----------------------------

  // --- Preencher/Resetar Formulário ---
  useEffect(() => {
    if (isVisible) {
      if (isEditing && budgetToEdit) {
        setType(budgetToEdit.type);
        setName(budgetToEdit.name); // Nome da meta ou categoria
        setTargetAmount(budgetToEdit.targetAmount.toString().replace('.', ','));
        // Campos específicos
        if (budgetToEdit.type === 'monthly') {
          setCategory(budgetToEdit.category || ''); // Usa nome se categoria não existir? Ou nome? Ajustar conforme necessário
        } else { // goal
          setAmountSaved(budgetToEdit.amountSaved?.toString().replace('.', ',') || '0');
          setTargetDate(budgetToEdit.targetDate?.toDate() || null);
        }
      } else {
        // Reset para adicionar
        setType('monthly');
        setName('');
        setTargetAmount('');
        setCategory('');
        setAmountSaved('0');
        setTargetDate(null);
      }
      setErrorMessage(null);
      setIsLoading(false);
      setShowTargetDatePicker(false);
    }
  }, [isVisible, budgetToEdit, isEditing]);

  // --- Handlers ---
  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowTargetDatePicker(Platform.OS === 'ios');
    if (selectedDate) setTargetDate(selectedDate);
    if (Platform.OS === 'android') setShowTargetDatePicker(false);
  };

  const handleSave = async () => {
    if (!currentUser || !groupId) { /* ... erro ... */ return; }

    const trimmedNameOrCategory = name.trim(); // Nome da Meta ou Categoria Mensal
    if (!trimmedNameOrCategory) { setErrorMessage("Digite um nome ou categoria."); return; }

    const numTargetAmount = parseFloat(targetAmount.replace(',', '.'));
    if (isNaN(numTargetAmount) || numTargetAmount <= 0) { setErrorMessage("Digite um valor alvo válido."); return; }

    let numAmountSaved = 0;
    if (type === 'goal') {
        numAmountSaved = parseFloat(amountSaved.replace(',', '.')) || 0;
        if (isNaN(numAmountSaved) || numAmountSaved < 0) { setErrorMessage("Valor guardado inválido."); return; }
    }

    setIsLoading(true);
    setErrorMessage(null);

    // Define qual categoria usar para tipo mensal
    const monthlyCategory = (type === 'monthly') ? trimmedNameOrCategory : null;

    // Dados comuns
    const budgetBaseData = {
        name: trimmedNameOrCategory, // Usado como nome da meta ou nome/categoria do orçamento mensal
        type: type,
        targetAmount: numTargetAmount,
        updatedAt: serverTimestamp(),
    };

    // Dados específicos por tipo
    let specificData = {};
    if (type === 'monthly') {
        specificData = {
            category: monthlyCategory, // Salva o nome como categoria
            monthYear: getMonthYear(new Date()), // Mês/Ano atual
             // Zera campos de meta se mudar tipo para mensal
             amountSaved: 0,
             targetDate: null,
        };
    } else { // goal
        specificData = {
            amountSaved: numAmountSaved,
            targetDate: targetDate ? Timestamp.fromDate(targetDate) : null,
             // Zera campos mensais se mudar tipo para meta
             category: null,
             monthYear: null,
        };
    }

    try {
      if (isEditing && budgetToEdit) {
        // --- ATUALIZAR ---
        console.log("Updating budget/goal:", budgetToEdit.id);
        const budgetDocRef = doc(db, "groups", groupId, "budgets", budgetToEdit.id);
        await updateDoc(budgetDocRef, {
            ...budgetBaseData,
            ...specificData
            // Não atualiza createdBy, createdAt
        });
        console.log("Budget/Goal updated successfully!");
      } else {
        // --- CRIAR ---
        const newBudgetData = {
            ...budgetBaseData,
            ...specificData,
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
        };
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
         <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                <ScrollView keyboardShouldPersistTaps="handled">
                    {/* Cabeçalho */}
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{isEditing ? 'Editar' : 'Novo'} Orçamento/Meta</Text>
                        <TouchableOpacity onPress={onClose} disabled={isLoading}><Ionicons name="close-circle" size={28} color={colors.textSecondary} /></TouchableOpacity>
                    </View>

                    {/* Seletor de Tipo */}
                    <View style={styles.typeSelector}>
                         <TouchableOpacity
                            style={[styles.typeButton, styles.typeButtonLeft, type === 'monthly' && styles.typeButtonActive]}
                            onPress={() => setType('monthly')} disabled={isLoading || isEditing} // Não permite mudar tipo na edição por simplicidade
                            >
                             <Text style={[styles.typeButtonText, type === 'monthly' && styles.typeButtonTextActive]}>Orçamento Mensal</Text>
                         </TouchableOpacity>
                         <TouchableOpacity
                            style={[styles.typeButton, styles.typeButtonRight, type === 'goal' && styles.typeButtonActive]}
                             onPress={() => setType('goal')} disabled={isLoading || isEditing}
                            >
                              <Text style={[styles.typeButtonText, type === 'goal' && styles.typeButtonTextActive]}>Meta Poupança</Text>
                         </TouchableOpacity>
                    </View>

                    {/* Nome / Categoria */}
                    <Text style={styles.label}>{type === 'monthly' ? 'Categoria do Orçamento*' : 'Nome da Meta*'}</Text>
                    <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={type === 'monthly' ? 'Ex: Alimentação, Lazer' : 'Ex: Viagem Férias'} editable={!isLoading} />
                    {/* TODO: Sugerir categorias existentes se type='monthly' */}

                     {/* Valor Alvo */}
                     <Text style={styles.label}>{type === 'monthly' ? 'Limite Mensal (R$)*' : 'Valor Alvo (R$)*'}</Text>
                    <TextInput style={styles.input} value={targetAmount} onChangeText={setTargetAmount} keyboardType="numeric" placeholder="Ex: 500,00" editable={!isLoading} />

                    {/* Campos Específicos de Metas */}
                    {type === 'goal' && (
                        <>
                            <Text style={styles.label}>Valor Guardado Inicial (R$)</Text>
                             <TextInput style={styles.input} value={amountSaved} onChangeText={setAmountSaved} keyboardType="numeric" placeholder="0,00" editable={!isLoading && !isEditing} // Não edita valor guardado aqui
                             />

                             <Text style={styles.label}>Data Alvo (Opcional)</Text>
                             <TouchableOpacity style={styles.dateButton} onPress={() => setShowTargetDatePicker(true)} disabled={isLoading}>
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
            </View>
         </View>
       </KeyboardAvoidingView>
    </Modal>
  );
};

// Estilos (similares a outros modais, ajustar conforme necessidade)
const getStyles = (colors: any) => StyleSheet.create({
    keyboardAvoidingView: { flex: 1 },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    modalContainer: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 30, maxHeight: '90%' },
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
    saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});

export default AddBudgetModal;