// components/inventory/AddInventoryItemModal.tsx
import React, { useState, useEffect } from "react";
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
  Platform,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
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
import { db, auth } from "@/lib/firebase";
import { InventoryItemData } from "@/types";
import { showMessage } from "react-native-flash-message";

interface AddInventoryItemModalProps {
  isVisible: boolean;
  onClose: () => void;
  groupId: string | null;
  itemToEdit?: InventoryItemData | null;
}

const AddInventoryItemModal: React.FC<AddInventoryItemModalProps> = ({
  isVisible,
  onClose,
  groupId,
  itemToEdit,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const currentUser = auth.currentUser;

  const isEditing = !!itemToEdit;

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("un");
  const [category, setCategory] = useState("");
  const [lastPurchaseDate, setLastPurchaseDate] = useState<Date | null>(null);
  const [showLastPurchaseDatePicker, setShowLastPurchaseDatePicker] =
    useState(false);
  const [lastPurchaseQuantityInput, setLastPurchaseQuantityInput] =
    useState("");
  const [lastPurchaseValueInput, setLastPurchaseValueInput] = useState("");
  const [nextPurchaseDate, setNextPurchaseDate] = useState<Date | null>(null);
  const [showNextPurchaseDatePicker, setShowNextPurchaseDatePicker] =
    useState(false);
  const [nextPurchaseValueInput, setNextPurchaseValueInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible) {
      if (isEditing && itemToEdit) {
        console.log("AddInventoryItemModal: Editing item -", itemToEdit.id);
        setName(itemToEdit.name);
        setQuantity(itemToEdit.quantity.toString());
        setUnit(itemToEdit.unit);
        setCategory(itemToEdit.category || "");
        setLastPurchaseDate(itemToEdit.lastPurchaseDate?.toDate() || null);
        setLastPurchaseQuantityInput(
          itemToEdit.lastPurchaseQuantity?.toString() || ""
        );
        setLastPurchaseValueInput(
          itemToEdit.lastPurchaseValue?.toString().replace(".", ",") || ""
        );
        setNextPurchaseDate(itemToEdit.nextPurchaseDate?.toDate() || null);
        setNextPurchaseValueInput(
          itemToEdit.nextPurchaseValue?.toString().replace(".", ",") || ""
        );
        setErrorMessage(null);
      } else {
        resetForm();
      }
      setIsLoading(false);
    }
  }, [isVisible, itemToEdit, isEditing]);

  const resetForm = () => {
    setName("");
    setQuantity("1");
    setUnit("un");
    setCategory("");
    setLastPurchaseDate(null);
    setLastPurchaseQuantityInput("");
    setLastPurchaseValueInput("");
    setNextPurchaseDate(null);
    setNextPurchaseValueInput("");
    setErrorMessage(null);
    setShowLastPurchaseDatePicker(false);
    setShowNextPurchaseDatePicker(false);
  };

  const handleLastPurchaseDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    setShowLastPurchaseDatePicker(Platform.OS === "ios");
    if (selectedDate) setLastPurchaseDate(selectedDate);
    if (Platform.OS === "android") setShowLastPurchaseDatePicker(false);
  };

  const handleNextPurchaseDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    setShowNextPurchaseDatePicker(Platform.OS === "ios");
    if (selectedDate) setNextPurchaseDate(selectedDate);
    if (Platform.OS === "android") setShowNextPurchaseDatePicker(false);
  };

  const handleSaveItem = async () => {
    if (!currentUser || !groupId) {
      setErrorMessage("Erro: Usuário ou grupo não identificado.");
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage("Digite o nome do item.");
      return;
    }
    const numQuantity = parseInt(quantity, 10);
    if (isNaN(numQuantity) || numQuantity < 0) {
      setErrorMessage("Digite uma quantidade válida (0 ou mais).");
      return;
    }
    const trimmedUnit = unit.trim();
    if (!trimmedUnit) {
      setErrorMessage("Digite a unidade de medida.");
      return;
    }

    let numLastPurchaseQuantity: number | null = null;
    if (lastPurchaseQuantityInput.trim()) {
      numLastPurchaseQuantity = parseInt(lastPurchaseQuantityInput, 10);
      if (isNaN(numLastPurchaseQuantity) || numLastPurchaseQuantity <= 0) {
        setErrorMessage("Quantidade da última compra inválida.");
        return;
      }
    }
    let numLastPurchaseValue: number | null = null;
    if (lastPurchaseValueInput.trim()) {
      numLastPurchaseValue = parseFloat(
        lastPurchaseValueInput.replace(",", ".")
      );
      if (isNaN(numLastPurchaseValue) || numLastPurchaseValue < 0) {
        setErrorMessage("Valor da última compra inválido.");
        return;
      }
    }
    let numNextPurchaseValue: number | null = null;
    if (nextPurchaseValueInput.trim()) {
      numNextPurchaseValue = parseFloat(
        nextPurchaseValueInput.replace(",", ".")
      );
      if (isNaN(numNextPurchaseValue) || numNextPurchaseValue < 0) {
        setErrorMessage("Valor da próxima compra inválido.");
        return;
      }
    }

    const itemDataPayload = {
      name: trimmedName,
      quantity: numQuantity,
      unit: trimmedUnit,
      category: category.trim() || null,
      lastPurchaseDate: lastPurchaseDate
        ? Timestamp.fromDate(lastPurchaseDate)
        : null,
      lastPurchaseQuantity: numLastPurchaseQuantity,
      lastPurchaseValue: numLastPurchaseValue,
      nextPurchaseDate: nextPurchaseDate
        ? Timestamp.fromDate(nextPurchaseDate)
        : null,
      nextPurchaseValue: numNextPurchaseValue,
      updatedAt: serverTimestamp(),
      lastUpdatedBy: currentUser.uid,
      ...(isEditing && itemToEdit?.store && { store: itemToEdit.store }),
    };

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (isEditing && itemToEdit) {
        const itemDocRef = doc(
          db,
          "groups",
          groupId,
          "inventoryItems",
          itemToEdit.id
        );
        await updateDoc(itemDocRef, itemDataPayload);
        showMessage({
          message: "Deu certo!",
          description: "Item atualizado no inventário.",
          backgroundColor: colors.success,
          color: colors.textPrimary,
        });
      } else {
        const newItemData = {
          ...itemDataPayload,
          addedBy: currentUser.uid,
          addedAt: serverTimestamp(),
          groupId: groupId,
        };
        const collectionPath = collection(
          db,
          "groups",
          groupId,
          "inventoryItems"
        );
        await addDoc(collectionPath, newItemData);
        showMessage({
          message: "Deu certo!",
          description: "Item adicionado ao inventário.",
          backgroundColor: colors.success,
          color: colors.textPrimary,
        });
      }
      onClose();
    } catch (error: any) {
      console.error("Error saving inventory item:", error);
      setErrorMessage(`Erro ao ${isEditing ? "atualizar" : "adicionar"} item.`);
      if (error.code === "permission-denied")
        Alert.alert(
          "Erro de Permissão",
          "Você não tem permissão para adicionar ou editar itens neste grupo."
        );
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
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEditing ? "Editar Item" : "Adicionar Item"} ao Inventário
                </Text>
                <TouchableOpacity onPress={onClose} disabled={isLoading}>
                  <Ionicons
                    name="close-circle"
                    size={28}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Nome do Item</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ex: Arroz Integral 1kg"
                placeholderTextColor={colors.textSecondary}
                editable={!isLoading}
              />

              <View style={styles.row}>
                <View style={styles.column}>
                  <Text style={styles.label}>
                    {isEditing ? "Qtde Atual" : "Qtde Inicial"}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={quantity}
                    onChangeText={setQuantity}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                    placeholder="0"
                    editable={!isLoading}
                  />
                </View>
                <View style={styles.column}>
                  <Text style={styles.label}>Unidade</Text>
                  <TextInput
                    style={styles.input}
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="un, kg, L, pct"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                </View>
              </View>

              <Text style={styles.label}>Categoria (Opcional)</Text>
              <TextInput
                style={styles.input}
                value={category}
                onChangeText={setCategory}
                placeholder="Ex: Grãos, Limpeza"
                placeholderTextColor={colors.textSecondary}
                editable={!isLoading}
              />

              <Text style={styles.sectionTitle}>Última Compra (Opcional)</Text>
              <Text style={styles.label}>Data da Compra</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowLastPurchaseDatePicker(true)}
                disabled={isLoading}
              >
                <Text style={styles.dateButtonText}>
                  {lastPurchaseDate
                    ? lastPurchaseDate.toLocaleDateString("pt-BR")
                    : "Selecionar data"}
                </Text>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
              {showLastPurchaseDatePicker && (
                <DateTimePicker
                  value={lastPurchaseDate || new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleLastPurchaseDateChange}
                  maximumDate={new Date()}
                  textColor={colors.textPrimary}
                />
              )}
              {showLastPurchaseDatePicker && Platform.OS === "ios" && (
                <TouchableOpacity
                  onPress={() => setShowLastPurchaseDatePicker(false)}
                  style={styles.closeDatePickerButton}
                >
                  <Text style={styles.closeDatePickerText}>Confirmar</Text>
                </TouchableOpacity>
              )}

              <View style={styles.row}>
                <View style={styles.column}>
                  <Text style={styles.label}>Qtde Comprada</Text>
                  <TextInput
                    style={styles.input}
                    value={lastPurchaseQuantityInput}
                    onChangeText={setLastPurchaseQuantityInput}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                    placeholder="Ex: 2"
                    editable={!isLoading}
                  />
                </View>
                <View style={styles.column}>
                  <Text style={styles.label}>Valor Total Pago (R$)</Text>
                  <TextInput
                    style={styles.input}
                    value={lastPurchaseValueInput}
                    placeholderTextColor={colors.textSecondary}
                    onChangeText={setLastPurchaseValueInput}
                    keyboardType="numeric"
                    placeholder="Ex: 10,50"
                    editable={!isLoading}
                  />
                </View>
              </View>

              <Text style={styles.sectionTitle}>Próxima Compra (Opcional)</Text>
              <Text style={styles.label}>Data Estimada</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowNextPurchaseDatePicker(true)}
                disabled={isLoading}
              >
                <Text style={styles.dateButtonText}>
                  {nextPurchaseDate
                    ? nextPurchaseDate.toLocaleDateString("pt-BR")
                    : "Selecionar data"}
                </Text>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
              {showNextPurchaseDatePicker && (
                <DateTimePicker
                  value={nextPurchaseDate || new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleNextPurchaseDateChange}
                  minimumDate={new Date()}
                  textColor={colors.textPrimary}
                />
              )}
              {showNextPurchaseDatePicker && Platform.OS === "ios" && (
                <TouchableOpacity
                  onPress={() => setShowNextPurchaseDatePicker(false)}
                  style={styles.closeDatePickerButton}
                >
                  <Text style={styles.closeDatePickerText}>Confirmar</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.label}>Valor Estimado (R$)</Text>
              <TextInput
                style={styles.input}
                value={nextPurchaseValueInput}
                onChangeText={setNextPurchaseValueInput}
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                placeholder="Ex: 12,00"
                editable={!isLoading}
              />

              {errorMessage && (
                <Text style={styles.errorMessage}>{errorMessage}</Text>
              )}

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  isLoading && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveItem}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {isEditing ? "Atualizar Item" : "Salvar Item"}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const getStyles = (colors: any) =>
  StyleSheet.create({
    keyboardAvoidingView: { flex: 1 },
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    modalContainer: {
      backgroundColor: colors.bottomSheet,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: Platform.OS === "ios" ? 40 : 30,
      maxHeight: "90%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    modalTitle: { fontSize: 20, fontWeight: "bold", color: colors.textPrimary },
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
    row: { flexDirection: "row", justifyContent: "space-between" },
    column: { width: "48%" },
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
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginTop: 20,
      marginBottom: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border + "80",
      paddingTop: 15,
    },
    errorMessage: {
      color: colors.error,
      textAlign: "center",
      marginTop: 10,
      marginBottom: 5,
      fontSize: 14,
    },
    saveButton: {
      backgroundColor: colors.primary,
      paddingVertical: 15,
      borderRadius: 8,
      alignItems: "center",
      marginTop: 20,
    },
    saveButtonDisabled: { backgroundColor: colors.textSecondary, opacity: 0.7 },
    saveButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  });

export default AddInventoryItemModal;
