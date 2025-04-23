// components/dashboard/AddTransactionModal.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  FlatList,
  Keyboard,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  Timestamp,
  addDoc,
  collection,
  serverTimestamp,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { Transaction } from "@/types";
import { showMessage } from "react-native-flash-message";

interface AddTransactionModalProps {
  isVisible: boolean;
  onClose: () => void;
  groupId: string | null;
  existingCategories: string[];
  transactionToEdit?: Transaction | null;
}

type TransactionType = "income" | "expense";

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isVisible,
  onClose,
  groupId,
  existingCategories,
  transactionToEdit,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const currentUser = auth.currentUser;

  const isEditing = !!transactionToEdit;

  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (isVisible) {
      if (isEditing && transactionToEdit) {
        setAmount(transactionToEdit.value.toString().replace(".", ","));
        setType(transactionToEdit.type);
        setCategory(transactionToEdit.category);
        setDate(transactionToEdit.date.toDate());
        setDescription(transactionToEdit.description || "");
      } else {
        setAmount("");
        setType("expense");
        setCategory("");
        setDate(new Date());
        setDescription("");
      }
      setErrorMessage(null);
      setIsLoading(false);
      setCategorySuggestions([]);
      setShowSuggestions(false);
      setShowDatePicker(false);
    }
  }, [isVisible, transactionToEdit, isEditing]);

  useEffect(() => {
    const currentInput = category.trim().toLowerCase();
    if (
      currentInput.length > 0 &&
      existingCategories &&
      existingCategories.length > 0
    ) {
      const filtered = existingCategories
        .filter((cat) => cat.toLowerCase().includes(currentInput))
        .sort((a, b) =>
          a.localeCompare(b, "pt-BR", { sensitivity: "base" })
        );

      setCategorySuggestions(filtered);
      const exactMatch = filtered.some(
        (f) => f.toLowerCase() === currentInput
      );
      setShowSuggestions(filtered.length > 0 && !exactMatch);
    } else {
      setCategorySuggestions([]);
      setShowSuggestions(false);
    }
  }, [category, existingCategories]);

  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    const currentDate = selectedDate || date;
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    setDate(currentDate);
  };

  const handleSelectSuggestion = (selectedCat: string) => {
    setCategory(selectedCat);
    setCategorySuggestions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const handleSaveTransaction = async () => {
    if (!currentUser || !groupId) {
      setErrorMessage("Erro: Usuário ou grupo não identificado.");
      return;
    }
    const numericAmountString = amount.replace(",", ".");
    const numericAmount = parseFloat(numericAmountString);
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage("Digite um valor válido maior que zero.");
      return;
    }
    const categoryToSave = category.trim();
    if (!categoryToSave) {
      setErrorMessage("Selecione ou digite uma categoria.");
      return;
    }

    const isValidCategory = existingCategories.some(
      (c) => c.toLowerCase() === categoryToSave.toLowerCase()
    );
    if (!isValidCategory) {
      setErrorMessage(
        `Categoria "${categoryToSave}" inválida. Selecione uma existente ou adicione-a na tela de Perfil.`
      );
      return;
    }
    const finalCategoryName =
      existingCategories.find(
        (c) => c.toLowerCase() === categoryToSave.toLowerCase()
      ) || categoryToSave;

    const transactionCommonData = {
      value: numericAmount,
      type: type,
      category: finalCategoryName,
      description: description.trim(),
      date: Timestamp.fromDate(date),
    };

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (isEditing && transactionToEdit) {
        const transDocRef = doc(
          db,
          "groups",
          groupId,
          "transactions",
          transactionToEdit.id
        );
        const updateData = {
          ...transactionCommonData,
          updatedAt: serverTimestamp(),
          lastEditedBy: currentUser.uid,
        };
        await updateDoc(transDocRef, updateData);
        showMessage({
          message: "Deu certo!",
          description: "Transação atualizada com sucesso!",
          backgroundColor: colors.success,
          color: colors.textPrimary,
        });
      } else {
        const newTransactionData = {
          ...transactionCommonData,
          userId: currentUser.uid,
          createdAt: serverTimestamp(),
        };
        const collectionPath = collection(
          db,
          "groups",
          groupId,
          "transactions"
        );
        await addDoc(collectionPath, newTransactionData);
        showMessage({
          message: "Deu certo!",
          description: "Transação adicionada com sucesso!",
          backgroundColor: colors.success,
          color: colors.textPrimary,
        });
      }
      onClose();
    } catch (error: any) {
      console.error("Error saving transaction:", error);
      setErrorMessage(
        `Erro ao ${isEditing ? "atualizar" : "salvar"} transação.`
      );
      if (error.code === "permission-denied") {
        setErrorMessage(
          `Permissão negada para ${
            isEditing ? "atualizar" : "salvar"
          } a transação.`
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent
      visible={isVisible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingView}
          >
            <TouchableWithoutFeedback
              onPress={() => Keyboard.dismiss()}
              accessible={false}
            >
              <View style={styles.modalContainer}>
                <ScrollView keyboardShouldPersistTaps="always">
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                      {isEditing ? "Editar Transação" : "Nova Transação"}
                    </Text>
                    <TouchableOpacity
                      onPress={onClose}
                      disabled={isLoading}
                    >
                      <Ionicons
                        name="close-circle"
                        size={28}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Bloco de seleção de tipo */}
                  <View style={styles.typeSelector}>
                    <TouchableOpacity
                      style={[styles.typeButton, styles.typeButtonLeft, type === "expense" && styles.typeButtonActive]}
                      onPress={() => setType("expense")}
                      disabled={isLoading}
                    >
                      <Text
                        style={[styles.typeButtonText, type === "expense" && styles.typeButtonTextActive]}
                      >
                        Saída
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.typeButton, styles.typeButtonRight, type === "income" && styles.typeButtonActive]}
                      onPress={() => setType("income")}
                      disabled={isLoading}
                    >
                      <Text
                        style={[styles.typeButtonText, type === "income" && styles.typeButtonTextActive]}
                      >
                        Entrada
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Valor */}
                  <Text style={styles.label}>Valor (R$)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0,00"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                    editable={!isLoading}
                  />

                  {/* Categoria */}
                  <Text style={styles.label}>Categoria</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Digite ou selecione uma categoria"
                    placeholderTextColor={colors.placeholder}
                    value={category}
                    onChangeText={setCategory}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onFocus={() => setShowSuggestions(categorySuggestions.length > 0 && category.length > 0)}
                    editable={!isLoading}
                  />
                  {showSuggestions && (
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
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="always"
                        scrollEnabled={false}
                        style={{ maxHeight: 150 }}
                      />
                    </View>
                  )}

                  {/* Data */}
                  <Text style={styles.label}>Data</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowDatePicker(true)}
                    disabled={isLoading}
                  >
                    <Text style={styles.dateButtonText}>{date.toLocaleDateString("pt-BR")}</Text>
                    <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={date}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={handleDateChange}
                      maximumDate={new Date()}
                      textColor={colors.textPrimary}
                    />
                  )}
                  {showDatePicker && Platform.OS === "ios" && (
                    <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.closeDatePickerButton}>
                      <Text style={styles.closeDatePickerText}>Confirmar Data</Text>
                    </TouchableOpacity>
                  )}

                  {/* Descrição */}
                  <Text style={styles.label}>Descrição (Opcional)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Detalhes adicionais..."
                    placeholderTextColor={colors.placeholder}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    editable={!isLoading}
                  />

                  {/* Mensagem de erro */}
                  {errorMessage && <Text style={styles.errorMessage}>{errorMessage}</Text>}

                  {/* Botão Salvar */}
                  <TouchableOpacity
                    style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
                    onPress={handleSaveTransaction}
                    disabled={isLoading}
                  >
                    {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>{isEditing ? "Atualizar Transação" : "Salvar Transação"}</Text>}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const getStyles = (colors: any) =>
  StyleSheet.create({
    keyboardAvoidingView: { flex: 1 },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modalContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.bottomSheet,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    label: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 5,
      marginTop: 15,
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
      marginBottom: 5,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: "top",
      marginBottom: 10,
    },
    typeSelector: { flexDirection: "row", marginVertical: 10 },
    typeButton: {
      flex: 1,
      paddingVertical: 12,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: "center",
      backgroundColor: colors.surface,
    },
    typeButtonLeft: {
      borderTopLeftRadius: 8,
      borderBottomLeftRadius: 8,
      borderRightWidth: 0.75,
    },
    typeButtonRight: {
      borderTopRightRadius: 8,
      borderBottomRightRadius: 8,
      borderLeftWidth: 0.75,
    },
    typeButtonActive: { backgroundColor: colors.primary },
    typeButtonText: {
      fontSize: 15,
      fontWeight: "500",
      color: colors.primary,
    },
    typeButtonTextActive: { color: "#FFFFFF", fontWeight: "bold" },
    dateButton: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    dateButtonText: { fontSize: 16, color: colors.textPrimary },
    closeDatePickerButton: { alignItems: "flex-end", paddingVertical: 10 },
    closeDatePickerText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: "bold",
    },
    suggestionsContainer: {
      maxHeight: 150,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      zIndex: 10,
      elevation: 3,
      marginTop: -5,
      marginBottom: 10,
    },
    suggestionItem: {
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    suggestionText: {
      fontSize: 16,
      color: colors.textPrimary,
    },
    errorMessage: {
      color: colors.error,
      textAlign: "center",
      marginVertical: 10,
      fontSize: 14,
    },
    saveButton: {
      backgroundColor: colors.primary,
      paddingVertical: 15,
      borderRadius: 8,
      alignItems: "center",
      marginTop: 20,
    },
    saveButtonDisabled: {
      backgroundColor: colors.textSecondary,
      opacity: 0.7,
    },
    saveButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "bold",
    },  });

export default AddTransactionModal;
