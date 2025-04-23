// components/recurring/AddRecurringModal.tsx
import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    StyleSheet, Platform, ActivityIndicator, Switch, Alert,
    Keyboard, KeyboardAvoidingView, Modal
} from 'react-native';
import { useTheme } from '@/context/ThemeContext'; // Ajuste o caminho
import { Ionicons } from '@expo/vector-icons';
import { Timestamp, addDoc, updateDoc, doc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase'; // Ajuste o caminho
import { RecurringTransaction, RecurrenceFrequency } from '@/types'; // Ajuste o caminho
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
// REMOVIDO: import { Picker } from '@react-native-picker/picker';

// Helper para calcular próxima data
const calculateNextDueDate = (currentDue: Date, frequency: RecurrenceFrequency, interval: number): Date => {
    const nextDate = new Date(currentDue);
    switch (frequency) {
        case 'daily': nextDate.setDate(nextDate.getDate() + interval); break;
        case 'weekly': nextDate.setDate(nextDate.getDate() + 7 * interval); break;
        case 'monthly': nextDate.setMonth(nextDate.getMonth() + interval); break;
        case 'yearly': nextDate.setFullYear(nextDate.getFullYear() + interval); break;
    }
    // Define a hora para início do dia para evitar problemas de fuso horário na comparação
    nextDate.setHours(0, 0, 0, 0);
    return nextDate;
};

interface AddRecurringModalProps {
  isVisible: boolean;
  onClose: () => void;
  groupId: string;
  existingCategories: string[];
  recurringItemToEdit?: RecurringTransaction | null;
}

// Opções de Frequência para o novo seletor
const frequencyOptions: { label: string; value: RecurrenceFrequency }[] = [
    { label: "Dia", value: "daily" },
    { label: "Semana", value: "weekly" },
    { label: "Mês", value: "monthly" },
    { label: "Ano", value: "yearly" },
];

const AddRecurringModal: React.FC<AddRecurringModalProps> = ({
  isVisible, onClose, groupId, existingCategories, recurringItemToEdit
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const currentUser = auth.currentUser;
  const isEditing = !!recurringItemToEdit;

  // --- Estados ---
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly'); // Estado para frequência
  const [interval, setInterval] = useState('1');
  const [startDate, setStartDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // ... (estados para sugestão de categoria, se implementado) ...
  const numericInterval = parseInt(interval, 10);
  // --- Efeito para Preencher/Resetar ---
  useEffect(() => {
    if (isVisible) {
      if (isEditing && recurringItemToEdit) { /* ... como antes ... */ }
      else { /* ... reset como antes ... */ }
      setIsLoading(false); setErrorMessage(null);
    }
  }, [isVisible, isEditing, recurringItemToEdit]);

  // --- Handlers ---
  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    const currentDate = selectedDate || startDate;
    setShowStartDatePicker(Platform.OS === 'ios');
    setStartDate(currentDate);
     if (Platform.OS === 'android') setShowStartDatePicker(false);
  };

  const handleSave = async () => {
    if (!currentUser) { setErrorMessage("Usuário não autenticado."); return; }
    const numericAmount = parseFloat(amount.replace(',', '.'));
    const numericInterval = parseInt(interval, 10);
    const categoryToSave = category.trim();
    // Validações
     if (!name.trim()) { setErrorMessage("Digite um nome."); return; }
     if (isNaN(numericAmount) || numericAmount <= 0) { setErrorMessage("Valor inválido."); return; }
     if (isNaN(numericInterval) || numericInterval <= 0) { setErrorMessage("Intervalo inválido (mínimo 1)."); return; }
     if (!categoryToSave) { setErrorMessage("Selecione uma categoria válida."); return; }
     // Validação estrita da categoria (se implementada)
     const isValidCategory = existingCategories.some(c => c.toLowerCase() === categoryToSave.toLowerCase());
     if (!isValidCategory) { setErrorMessage(`Categoria "${categoryToSave}" inválida.`); return; }
     const finalCategoryName = existingCategories.find(c => c.toLowerCase() === categoryToSave.toLowerCase()) || categoryToSave;


    setIsLoading(true); setErrorMessage(null);

    // Calcula próxima data
    const nextDueDate = calculateNextDueDate(startDate, frequency, numericInterval);

    // Prepara dados (usando finalCategoryName)
    const data: Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt'> = {
      name: name.trim(), amount: numericAmount, type, category: finalCategoryName,
      frequency, interval: numericInterval, startDate: Timestamp.fromDate(startDate),
      nextDueDate: Timestamp.fromDate(nextDueDate), notes: notes.trim(), isActive,
      userId: currentUser.uid,
    };

    try {
      if (isEditing && recurringItemToEdit) { // Atualiza
        const docRef = doc(db, "groups", groupId, "recurringTransactions", recurringItemToEdit.id);
        // Simplificação: Sempre recalcula nextDueDate a partir do startDate salvo/editado.
        // Lógica mais complexa seria necessária se quisesse manter a sequência original.
        await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
        Alert.alert("Sucesso", "Recorrência atualizada.");
      } else { // Adiciona Novo
        const collectionRef = collection(db, "groups", groupId, "recurringTransactions");
        await addDoc(collectionRef, { ...data, createdAt: serverTimestamp() });
        Alert.alert("Sucesso", "Nova recorrência criada.");
      }
      onClose();
    } catch (error) { /* ... tratamento erro ... */ }
    finally { setIsLoading(false); }
  };

  // --- UI ---
  return (
     <Modal visible={isVisible} /*...*/ animationType="slide" transparent={true} onRequestClose={onClose}>
         <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoidingView}>
              <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
                  <TouchableOpacity style={styles.modalContainer} activeOpacity={1} onPress={Keyboard.dismiss}>
                      <ScrollView keyboardShouldPersistTaps="handled">
                          {/* Header */}
                          <View style={styles.modalHeader}>
                               <Text style={styles.modalTitle}>{isEditing ? 'Editar' : 'Nova'} Recorrência</Text>
                               <TouchableOpacity onPress={onClose} disabled={isLoading}><Ionicons name="close-circle" size={28} color={colors.textSecondary} /></TouchableOpacity>
                          </View>

                          {/* Nome */}
                          <Text style={styles.label}>Nome*</Text>
                          <TextInput style={styles.input} value={name} onChangeText={setName} editable={!isLoading} placeholder="Ex: Aluguel, Salário" />

                          {/* Valor */}
                          <Text style={styles.label}>Valor (R$)*</Text>
                          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" editable={!isLoading} placeholder="1500,00" />

                          {/* Tipo (Entrada/Saída) */}
                          <Text style={styles.label}>Tipo*</Text>
                          <View style={styles.typeSelector}>
                               <TouchableOpacity style={[styles.typeButton, styles.typeButtonLeft, type === 'expense' && styles.typeButtonActive]} onPress={() => setType('expense')} disabled={isLoading} ><Text style={[styles.typeButtonText, type === 'expense' && styles.typeButtonTextActive]}> Saída </Text></TouchableOpacity>
                               <TouchableOpacity style={[styles.typeButton, styles.typeButtonRight, type === 'income' && styles.typeButtonActive]} onPress={() => setType('income')} disabled={isLoading} ><Text style={[styles.typeButtonText, type === 'income' && styles.typeButtonTextActive]}> Entrada </Text></TouchableOpacity>
                          </View>

                          {/* Categoria */}
                          <Text style={styles.label}>Categoria*</Text>
                           {/* TODO: Implementar Autocomplete aqui se desejar */}
                          <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="Selecione/digite categoria existente" editable={!isLoading}/>

                          {/* --- Seletor de Frequência com Botões --- */}
                          <Text style={styles.label}>Frequência*</Text>
                          <View style={styles.frequencySelector}>
                              {frequencyOptions.map(option => (
                                  <TouchableOpacity
                                      key={option.value}
                                      style={[
                                          styles.frequencyButton,
                                          frequency === option.value && styles.frequencyButtonActive
                                      ]}
                                      onPress={() => setFrequency(option.value)}
                                      disabled={isLoading}
                                  >
                                      <Text style={[
                                          styles.frequencyButtonText,
                                          frequency === option.value && styles.frequencyButtonTextActive
                                      ]}>
                                          {option.label}
                                      </Text>
                                  </TouchableOpacity>
                              ))}
                          </View>
                          {/* ------------------------------------- */}


                          {/* Intervalo */}
                          <Text style={styles.label}>A cada*</Text>
                          <View style={styles.intervalContainer}>
                              <TextInput style={[styles.input, styles.intervalInput]} value={interval} onChangeText={setInterval} keyboardType="number-pad" maxLength={2} editable={!isLoading} />
                              {/* Ajusta o plural da label dinamicamente */}
                              <Text style={styles.intervalLabel}>
                                  {frequency === 'daily' ? (numericInterval > 1 ? 'dias' : 'dia') :
                                   frequency === 'weekly' ? (numericInterval > 1 ? 'semanas' : 'semana') :
                                   frequency === 'monthly' ? (numericInterval > 1 ? 'meses' : 'mês') :
                                   (numericInterval > 1 ? 'anos' : 'ano')}
                               </Text>
                          </View>

                          {/* Data de Início */}
                          <Text style={styles.label}>Data de Início / Primeira Ocorrência*</Text>
                          <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartDatePicker(true)} disabled={isLoading}>
                              <Text style={styles.dateButtonText}>{startDate.toLocaleDateString('pt-BR')}</Text>
                              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                          </TouchableOpacity>
                          {showStartDatePicker && ( <DateTimePicker value={startDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={handleDateChange} /* maximumDate={new Date()} // Permite data passada? */ /> )}
                          {showStartDatePicker && Platform.OS === 'ios' && (<TouchableOpacity onPress={() => setShowStartDatePicker(false)} style={styles.closeDatePickerButton}><Text style={styles.closeDatePickerText}>Confirmar</Text></TouchableOpacity>)}

                          {/* Notas */}
                          <Text style={styles.label}>Notas (Opcional)</Text>
                          <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes} multiline editable={!isLoading} placeholder="Detalhes adicionais"/>

                          {/* Ativo/Inativo */}
                           <View style={styles.switchContainer}>
                                <Text style={styles.labelSwitch}>Recorrência Ativa</Text>
                                <Switch trackColor={{ false: "#767577", true: colors.primary + '80' }} thumbColor={isActive ? colors.primary : "#f4f3f4"} ios_backgroundColor="#3e3e3e" onValueChange={setIsActive} value={isActive} disabled={isLoading} />
                           </View>

                          {/* Erro e Botão Salvar */}
                          {errorMessage && <Text style={styles.errorMessage}>{errorMessage}</Text>}
                          <TouchableOpacity style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} onPress={handleSave} disabled={isLoading}>
                             {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>{isEditing ? "Atualizar Recorrência" : "Salvar Recorrência"}</Text>}
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
     input: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
     textArea: { minHeight: 80, textAlignVertical: 'top' },
     typeSelector: { flexDirection: 'row', marginVertical: 10 },
     typeButton: { flex: 1, paddingVertical: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', backgroundColor: colors.surface },
     typeButtonLeft: { borderTopLeftRadius: 8, borderBottomLeftRadius: 8, borderRightWidth: 0.75 },
     typeButtonRight: { borderTopRightRadius: 8, borderBottomRightRadius: 8, borderLeftWidth: 0.75 },
     typeButtonActive: { backgroundColor: colors.primary },
     typeButtonText: { fontSize: 15, fontWeight: '500', color: colors.primary },
     typeButtonTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
     // --- Estilos para Seletor de Frequência ---
     frequencySelector: {
         flexDirection: 'row',
         justifyContent: 'space-between', // Espaça uniformemente
         marginBottom: 10,
     },
     frequencyButton: {
         paddingVertical: 10,
         paddingHorizontal: 12, // Ajuste conforme necessário
         borderRadius: 20, // Mais arredondado
         borderWidth: 1.5,
         borderColor: colors.border,
         backgroundColor: colors.surface,
         marginHorizontal: 2, // Pequeno espaço entre botões
         alignItems: 'center',
         flexGrow: 1, // Tenta ocupar espaço igualitário
         flexBasis: 0, // Base flex para ajudar na distribuição
     },
     frequencyButtonActive: {
         backgroundColor: colors.primary,
         borderColor: colors.primary,
     },
     frequencyButtonText: {
         fontSize: 13, // Texto ligeiramente menor
         fontWeight: '500',
         color: colors.textSecondary,
     },
     frequencyButtonTextActive: {
         color: '#FFFFFF',
         fontWeight: 'bold',
     },
     // -------------------------------------
     intervalContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
     intervalInput: { flex: 1, marginRight: 10, textAlign: 'center', paddingVertical: 10 }, // Ajustado padding
     intervalLabel: { fontSize: 16, color: colors.textSecondary },
     dateButton: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
     dateButtonText: { fontSize: 16, color: colors.textPrimary },
     closeDatePickerButton: { alignItems: 'flex-end', paddingVertical: 10 },
     closeDatePickerText: { color: colors.primary, fontSize: 16, fontWeight: 'bold' },
     switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border+'50', borderBottomWidth: 1, borderBottomColor: colors.border+'50'}, // Adiciona bordas
     labelSwitch: { fontSize: 16, color: colors.textPrimary, flex: 1 },
     errorMessage: { color: colors.error, textAlign: 'center', marginVertical: 10, fontSize: 14 },
     saveButton: { backgroundColor: colors.primary, paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginTop: 25 }, // Mais margem
     saveButtonDisabled: { backgroundColor: colors.textSecondary, opacity: 0.7 },
     saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});

export default AddRecurringModal;