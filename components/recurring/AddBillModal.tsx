// components/recurring/AddBillModal.tsx
import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
    Platform, ActivityIndicator, Switch, Keyboard,
    KeyboardAvoidingView, Modal, FlatList // Adicionado FlatList para sugestões
} from 'react-native';
import { useTheme } from '@/context/ThemeContext'; // Ajuste o caminho
import { Ionicons } from '@expo/vector-icons';
import { Timestamp, addDoc, updateDoc, doc, collection, serverTimestamp, deleteField } from 'firebase/firestore'; // Importa deleteField
import { db, auth } from '@/lib/firebase'; // Ajuste o caminho
import { BillReminder, RecurrenceFrequency } from '@/types'; // Ajuste o caminho
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { showMessage } from 'react-native-flash-message';

interface AddBillModalProps {
  isVisible: boolean;
  onClose: () => void;
  groupId: string; // Assumindo que sempre terá um groupId aqui
  existingCategories: string[]; // Categorias existentes para seleção/validação
  billToEdit?: BillReminder | null;
}

// Opções de Frequência para botões
const frequencyOptions: { label: string; value: RecurrenceFrequency }[] = [
    { label: "Diária", value: "daily" }, { label: "Semanal", value: "weekly" },
    { label: "Mensal", value: "monthly" }, { label: "Anual", value: "yearly" },
];

// Helper para calcular próxima data (pode mover para utils)
const calculateNextDueDate = (currentDue: Date, frequency: RecurrenceFrequency, interval: number): Date => {
     const nextDate = new Date(currentDue);
     switch (frequency) {
         case 'daily': nextDate.setDate(nextDate.getDate() + interval); break;
         case 'weekly': nextDate.setDate(nextDate.getDate() + 7 * interval); break;
         case 'monthly': nextDate.setMonth(nextDate.getMonth() + interval); break;
         case 'yearly': nextDate.setFullYear(nextDate.getFullYear() + interval); break;
     }
     nextDate.setHours(0,0,0,0); // Normaliza hora
     return nextDate;
 };


const AddBillModal: React.FC<AddBillModalProps> = ({
  isVisible, onClose, groupId, existingCategories = [], billToEdit
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const currentUser = auth.currentUser;
  const isEditing = !!billToEdit;

  // --- Estados ---
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [category, setCategory] = useState(''); // <-- Categoria da despesa associada
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [interval, setInterval] = useState('1');
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [notificationDays, setNotificationDays] = useState('3');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Autocomplete Categoria
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // ----------------

  // --- Efeito Preencher/Resetar ---
  useEffect(() => {
      if(isVisible){
          if(isEditing && billToEdit){
              setName(billToEdit.name);
              // CORREÇÃO: Usar value aqui, não value (conforme interface BillReminder)
              setValue(billToEdit.value.toString().replace('.',','));
              setCategory(billToEdit.category); // <-- Preenche categoria
              setDueDate(billToEdit.dueDate.toDate());
              setNotes(billToEdit.notes || '');
              setIsRecurring(billToEdit.isRecurring);
              setFrequency(billToEdit.frequency || 'monthly');
              setInterval((billToEdit.interval || 1).toString());
              setEndDate(billToEdit.endDate?.toDate() || null);
              setNotificationDays((billToEdit.notificationDaysBefore === undefined || billToEdit.notificationDaysBefore === null) ? '3' : billToEdit.notificationDaysBefore.toString());
          } else {
              resetForm(); // Reset
          }
          setIsLoading(false); setErrorMessage(null); setShowDatePicker(false); setShowEndDatePicker(false);
          setCategorySuggestions([]); setShowSuggestions(false); // Reseta autocomplete
      }
  }, [isVisible, isEditing, billToEdit]);

  // --- Função Reset ---
  const resetForm = () => {
      setName(''); setValue(''); setCategory(''); setDueDate(new Date()); setNotes('');
      setIsRecurring(false); setFrequency('monthly'); setInterval('1');
      setEndDate(null); setNotificationDays('3'); setErrorMessage(null);
  };

  // --- Handlers Date Pickers ---
    const handleDueDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if(selectedDate) setDueDate(selectedDate);
        if (Platform.OS === 'android') setShowDatePicker(false);
    };
    const handleEndDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
         setShowEndDatePicker(Platform.OS === 'ios');
         if (selectedDate) {
             if (selectedDate < dueDate) { 
                showMessage({
                    message: "Data Inválida",
                    description: "Final < Vencimento.",
                    backgroundColor: colors.error,
                    color: colors.textPrimary,
                });
                return; }
             setEndDate(selectedDate);
         } else { setEndDate(null); } // Permite limpar? (Pode causar problemas se null for selecionado acidentalmente)
          if (Platform.OS === 'android') setShowEndDatePicker(false);
    };

  // --- Handlers Autocomplete Categoria ---
  const handleCategoryChange = (text: string) => {
      setCategory(text);
      if (text.length > 0 && existingCategories) {
          const filtered = existingCategories.filter(cat => cat.toLowerCase().includes(text.toLowerCase())).sort();
          setCategorySuggestions(filtered);
          setShowSuggestions(filtered.length > 0 && !filtered.some(f => f.toLowerCase() === text.trim().toLowerCase()));
      } else { setCategorySuggestions([]); setShowSuggestions(false); }
  };
  const selectCategorySuggestion = (suggestion: string) => { setCategory(suggestion); setCategorySuggestions([]); setShowSuggestions(false); Keyboard.dismiss(); };
  // ------------------------------------

  // --- Handler Save ---
  const handleSave = async () => {
     if (!currentUser) { setErrorMessage("Usuário não autenticado."); return; }
     const numericValue = parseFloat(value.replace(',', '.'));
     const numericInterval = parseInt(interval, 10);
     const numericNotifyDays = parseInt(notificationDays, 10);
     const categoryToSave = category.trim();

     // Validações
      if (!name.trim()) { setErrorMessage("Digite nome/descrição."); return; }
      if (isNaN(numericValue) || numericValue <= 0) { setErrorMessage("Valor inválido."); return; }
      // Validação Categoria OBRIGATÓRIA
      if (!categoryToSave) { setErrorMessage("Selecione uma categoria."); return; }
      const isValidCategory = existingCategories.some(c => c.toLowerCase() === categoryToSave.toLowerCase());
      if (!isValidCategory) { setErrorMessage(`Categoria "${categoryToSave}" inválida. Crie-a no Perfil.`); return; }
      const finalCategoryName = existingCategories.find(c => c.toLowerCase() === categoryToSave.toLowerCase()) || categoryToSave;
      // Validações Recorrência
      if (isRecurring && (isNaN(numericInterval) || numericInterval <= 0)) { setErrorMessage("Intervalo inválido."); return; }
      if (isNaN(numericNotifyDays) || numericNotifyDays < 0) { setErrorMessage("Dias p/ notificação inválido."); return; }
      if (isRecurring && endDate && endDate < dueDate) { setErrorMessage("Data final < Vencimento."); return; }

     setIsLoading(true); setErrorMessage(null);

     // Monta payload base
     const dataPayload: any = {
         name: name.trim(),
         value: numericValue,
         category: finalCategoryName, // Salva categoria validada
         dueDate: Timestamp.fromDate(dueDate),
         notes: notes.trim() || null, // Salva null se vazio
         isRecurring,
         notificationDaysBefore: numericNotifyDays,
         // userId adicionado na criação
     };

     // Adiciona campos recorrentes APENAS se isRecurring for true
     if (isRecurring) {
         dataPayload.frequency = frequency;
         dataPayload.interval = numericInterval;
         dataPayload.endDate = endDate ? Timestamp.fromDate(endDate) : null; // Salva null se não definido
     }

     try {
         if (isEditing && billToEdit) {
             // ATUALIZAR
             const docRef = doc(db, "groups", groupId, "bills", billToEdit.id);
             dataPayload.updatedAt = serverTimestamp();
             // Remove campos que não devem ser alterados na edição
             delete dataPayload.userId; delete dataPayload.createdAt; delete dataPayload.isPaid; delete dataPayload.lastPaidDate;
             // Se deixou de ser recorrente, remove campos específicos
             if (!isRecurring && billToEdit.isRecurring) {
                  dataPayload.frequency = deleteField(); dataPayload.interval = deleteField(); dataPayload.endDate = deleteField();
             }
             await updateDoc(docRef, dataPayload);
             showMessage({
                message: "Deu certo!",
                description: "Conta atualizada.",
                backgroundColor: colors.success,
                color: colors.textPrimary,
            });
         } else {
             // CRIAR
             const collectionRef = collection(db, "groups", groupId, "bills");
             dataPayload.userId = currentUser.uid;
             dataPayload.createdAt = serverTimestamp();
             dataPayload.isPaid = false; // Começa como não paga
             // Garante que campos recorrentes não existam se não for recorrente
             if (!isRecurring) { delete dataPayload.frequency; delete dataPayload.interval; delete dataPayload.endDate; }
             await addDoc(collectionRef, dataPayload);
             showMessage({
                message: "Deu certo!",
                description: "Nova conta/lembrete criado.",
                backgroundColor: colors.success,
                color: colors.textPrimary,
            });
         }
         onClose();
     } catch (error: any) {
         console.error("Error saving bill:", error);
         setErrorMessage(`Erro ao ${isEditing ? 'atualizar' : 'salvar'} conta.`);
         if(error.code === 'permission-denied'){ setErrorMessage(`Permissão negada para ${isEditing ? 'atualizar' : 'salvar'} conta.`); }
     } finally { setIsLoading(false); }
  };


  return (
       <Modal visible={isVisible} animationType="slide" transparent={true} onRequestClose={onClose}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoidingView}>
               <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
                   <TouchableOpacity style={styles.modalContainer} activeOpacity={1} onPress={Keyboard.dismiss}>
                       <ScrollView keyboardShouldPersistTaps="handled">
                           {/* Header */}
                           <View style={styles.modalHeader}>
                               <Text style={styles.modalTitle}>{isEditing ? 'Editar' : 'Nova'} Conta/Lembrete</Text>
                               <TouchableOpacity onPress={onClose} disabled={isLoading}><Ionicons name="close-circle" size={28} color={colors.textSecondary} /></TouchableOpacity>
                           </View>

                           {/* Nome */}
                           <Text style={styles.label}>Nome/Descrição*</Text>
                           <TextInput placeholderTextColor={colors.textSecondary} style={styles.input} value={name} onChangeText={setName} editable={!isLoading} placeholder="Ex: Aluguel, Fatura Cartão"/>

                           {/* Valor */}
                           <Text style={styles.label}>Valor Estimado (R$)*</Text>
                           <TextInput placeholderTextColor={colors.textSecondary} style={styles.input} value={value} onChangeText={setValue} keyboardType="numeric" editable={!isLoading} placeholder="150,00"/>

                           {/* Categoria */}
                            <Text style={styles.label}>Categoria da Despesa*</Text>
                            <TextInput
                                style={styles.input} placeholder="Selecione ou digite categoria existente"
                                placeholderTextColor={colors.textSecondary} value={category}
                                onChangeText={handleCategoryChange} // Usa handler com autocomplete
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                onFocus={() => setShowSuggestions(categorySuggestions.length > 0 && category.length > 0)}
                                editable={!isLoading}
                            />
                            {showSuggestions && categorySuggestions.length > 0 && (
                                <View style={styles.suggestionsContainer}>
                                    <FlatList
                                        data={categorySuggestions} keyExtractor={(item) => item}
                                        renderItem={({ item, index }) => (
                                            <TouchableOpacity style={[styles.suggestionItem, index === categorySuggestions.length - 1 && styles.suggestionItem_last]} onPress={() => selectCategorySuggestion(item)}>
                                                <Text style={styles.suggestionText}>{item}</Text>
                                            </TouchableOpacity>
                                        )}
                                        nestedScrollEnabled={true} keyboardShouldPersistTaps="always" scrollEnabled={false} style={{maxHeight: 150}}
                                    />
                                </View>
                            )}

                           {/* Data de Vencimento */}
                           <Text style={styles.label}>Data de Vencimento*</Text>
                           <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)} disabled={isLoading}>
                                <Text style={styles.dateButtonText}>{dueDate.toLocaleDateString('pt-BR')}</Text>
                                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                           </TouchableOpacity>
                           {showDatePicker && ( <DateTimePicker value={dueDate} mode="date" display='default' onChange={handleDueDateChange} /> )}
                           {showDatePicker && Platform.OS === 'ios' && (<TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.closeDatePickerButton}><Text style={styles.closeDatePickerText}>Confirmar</Text></TouchableOpacity>)}

                           {/* Dias para Notificar */}
                           <Text style={styles.label}>Notificar Antes (dias)</Text>
                           <TextInput placeholderTextColor={colors.textSecondary} style={styles.input} value={notificationDays} onChangeText={setNotificationDays} keyboardType="number-pad" maxLength={2} editable={!isLoading} placeholder="Ex: 3"/>

                           {/* É Recorrente? */}
                           <View style={styles.switchContainer}>
                                <Text style={styles.labelSwitch}>É Recorrente?</Text>
                                <Switch trackColor={{ false: "#767577", true: colors.primary + '80' }} thumbColor={isRecurring ? colors.primary : "#f4f3f4"} onValueChange={setIsRecurring} value={isRecurring} disabled={isLoading}/>
                           </View>

                           {/* Campos de Recorrência */}
                           {isRecurring && (
                               <>
                                   <Text style={styles.label}>Frequência*</Text>
                                   <View style={styles.frequencySelector}>
                                       {frequencyOptions.map(option => (
                                           <TouchableOpacity key={option.value} style={[ styles.frequencyButton, frequency === option.value && styles.frequencyButtonActive ]} onPress={() => setFrequency(option.value)} disabled={isLoading} >
                                               <Text style={[ styles.frequencyButtonText, frequency === option.value && styles.frequencyButtonTextActive ]}>{option.label}</Text>
                                           </TouchableOpacity>
                                       ))}
                                   </View>
                                   <Text style={styles.label}>A cada*</Text>
                                   <View style={styles.intervalContainer}>
                                      <TextInput placeholderTextColor={colors.textSecondary} style={[styles.input, styles.intervalInput]} value={interval} onChangeText={setInterval} keyboardType="number-pad" maxLength={2} editable={!isLoading}/>
                                      <Text style={styles.intervalLabel}>
                                          {frequency === 'daily' ? (parseInt(interval,10) > 1 ? 'dias' : 'dia') :
                                           frequency === 'weekly' ? (parseInt(interval,10) > 1 ? 'semanas' : 'semana') :
                                           frequency === 'monthly' ? (parseInt(interval,10) > 1 ? 'meses' : 'mês') :
                                           (parseInt(interval,10) > 1 ? 'anos' : 'ano')}
                                       </Text>
                                   </View>
                                   <Text style={styles.label}>Repetir até (Opcional)</Text>
                                   <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndDatePicker(true)} disabled={isLoading}>
                                       <Text style={styles.dateButtonText}>{endDate ? endDate.toLocaleDateString('pt-BR') : 'Sem data final'}</Text>
                                       <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                                   </TouchableOpacity>
                                   {showEndDatePicker && ( <DateTimePicker value={endDate || dueDate} mode="date" display='default' onChange={handleEndDateChange} minimumDate={dueDate} /> )} {/* Usa dueDate como mínimo */}
                                   {showEndDatePicker && Platform.OS === 'ios' && (<TouchableOpacity onPress={() => setShowEndDatePicker(false)} style={styles.closeDatePickerButton}><Text style={styles.closeDatePickerText}>Confirmar</Text></TouchableOpacity>)}
                               </>
                           )}

                           {/* Notas */}
                           <Text style={styles.label}>Notas (Opcional)</Text>
                           <TextInput placeholderTextColor={colors.textSecondary} style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes} multiline editable={!isLoading} placeholder="Link, detalhes do pagamento..."/>

                           {/* Erro e Botão Salvar */}
                           {errorMessage && <Text style={styles.errorMessage}>{errorMessage}</Text>}
                           <TouchableOpacity style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} onPress={handleSave} disabled={isLoading}>
                              {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>{isEditing ? 'Atualizar Conta' : 'Salvar Conta'}</Text>}
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
     modalContainer: { backgroundColor: colors.bottomSheet, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 30, maxHeight: '90%' },
     modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
     modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
     label: { fontSize: 14, color: colors.textSecondary, marginBottom: 5, marginTop: 15 },
     input: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, marginBottom: 5 },
     suggestionsContainer: { maxHeight: 150, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, zIndex: 10, elevation: 3, marginTop: -5, marginBottom: 10 },
     suggestionItem: { paddingVertical: 10, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: colors.border },
     suggestionItem_last: { borderBottomWidth: 0 },
     suggestionText: { fontSize: 16, color: colors.textPrimary },
     textArea: { minHeight: 80, textAlignVertical: 'top', marginBottom: 10 },
     dateButton: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
     dateButtonText: { fontSize: 16, color: colors.textPrimary },
     closeDatePickerButton: { alignItems: 'flex-end', paddingVertical: 10 },
     closeDatePickerText: { color: colors.primary, fontSize: 16, fontWeight: 'bold' },
     switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border+'50', marginBottom: 10 },
     labelSwitch: { fontSize: 16, color: colors.textPrimary, flex: 1 },
     frequencySelector: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
     frequencyButton: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, marginHorizontal: 2, alignItems: 'center', flexGrow: 1, flexBasis: 0 },
     frequencyButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
     frequencyButtonText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' },
     frequencyButtonTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
     intervalContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
     intervalInput: { flex: 1, marginRight: 10, textAlign: 'center', paddingVertical: 10, backgroundColor: colors.surface, borderRadius: 8, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, height: 46 }, // Estilo Input
     intervalLabel: { fontSize: 16, color: colors.textSecondary },
     errorMessage: { color: colors.error, textAlign: 'center', marginVertical: 10, fontSize: 14 },
     saveButton: { backgroundColor: colors.primary, paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginTop: 25 },
     saveButtonDisabled: { backgroundColor: colors.textSecondary, opacity: 0.7 },
     saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});

export default AddBillModal;