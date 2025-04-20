// components/dashboard/AddShoppingListModal.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Platform
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface AddShoppingListModalProps {
  isVisible: boolean;
  onClose: () => void;
  groupId: string; // Precisa do groupId para saber onde criar a lista
}

const AddShoppingListModal: React.FC<AddShoppingListModalProps> = ({ isVisible, onClose, groupId }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [listName, setListName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddList = async () => {
    if (!listName.trim()) {
      setErrorMessage("Digite um nome para a lista.");
      return;
    }
    if (!groupId) {
        setErrorMessage("ID do grupo não encontrado.");
        return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const newListData = {
        name: listName.trim(),
        archived: false, // Novas listas começam desrarquivadas
        createdAt: serverTimestamp(),
      };
      console.log("Adding new shopping list:", newListData);
      // Cria na subcoleção shoppingLists do grupo
      const collectionPath = collection(db, "groups", groupId, "shoppingLists");
      await addDoc(collectionPath, newListData);
      console.log("Shopping list added successfully!");
      setListName(''); // Limpa o input
      onClose(); // Fecha o modal
    } catch (error: any) {
      console.error("Error adding shopping list:", error);
      setErrorMessage("Erro ao salvar a lista.");
    } finally {
      setIsLoading(false);
    }
  };

  // Reseta ao fechar/abrir
  useEffect(() => {
      if(!isVisible) {
          setListName('');
          setErrorMessage(null);
          setIsLoading(false);
      }
  }, [isVisible]);

  return (
     <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
         <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                 {/* Cabeçalho */}
                 <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Nova Lista de Compras</Text>
                    <TouchableOpacity onPress={onClose} disabled={isLoading}>
                        <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
                    </TouchableOpacity>
                 </View>

                 {/* Input Nome */}
                 <Text style={styles.label}>Nome da Lista*</Text>
                 <TextInput
                     style={styles.input}
                     placeholder="Ex: Mercado Mensal, Farmácia"
                     placeholderTextColor={colors.placeholder}
                     value={listName}
                     onChangeText={setListName}
                     editable={!isLoading}
                 />

                  {/* Mensagem de Erro */}
                  {errorMessage && <Text style={styles.errorMessage}>{errorMessage}</Text>}

                 {/* Botão Salvar */}
                 <TouchableOpacity
                     style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
                     onPress={handleAddList}
                     disabled={isLoading}
                 >
                     {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Criar Lista</Text>}
                 </TouchableOpacity>
            </View>
         </View>
    </Modal>
  );
};

// Estilos (Similares aos outros modais)
const getStyles = (colors: any) => StyleSheet.create({
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)'},
    modalContainer: { backgroundColor: colors.background, borderRadius: 15, padding: 25, width: '90%', maxHeight: '80%'},
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
    label: { fontSize: 14, color: colors.textSecondary, marginBottom: 5, marginTop: 10 },
    input: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
    errorMessage: { color: colors.error, textAlign: 'center', marginTop: 10, marginBottom: 5 },
    saveButton: { backgroundColor: colors.primary, paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginTop: 20 },
    saveButtonDisabled: { backgroundColor: colors.textSecondary },
    saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});

export default AddShoppingListModal;