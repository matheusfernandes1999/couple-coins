// components/dashboard/AddShoppingListModal.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, StyleSheet, TextInput,
  TouchableOpacity, Platform, // Adicionado Platform
  KeyboardAvoidingView, ScrollView, Keyboard, // Adicionado KAV, ScrollView, Keyboard
  ActivityIndicator
} from 'react-native';
import { useTheme } from '../../context/ThemeContext'; // Ajuste o caminho
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase'; 
import { showMessage } from 'react-native-flash-message';

interface AddShoppingListModalProps {
  isVisible: boolean;
  onClose: () => void;
  groupId: string | null; // Modificado para permitir null para segurança
}

const AddShoppingListModal: React.FC<AddShoppingListModalProps> = ({ isVisible, onClose, groupId }) => {
  const { colors } = useTheme();
  // Usa a função getStyles atualizada para o estilo bottom sheet
  const styles = getBottomSheetStyles(colors);
  const [listName, setListName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handler para adicionar lista
  const handleAddList = async () => {
    const trimmedName = listName.trim();
    if (!trimmedName) {
      setErrorMessage("Digite um nome para a lista.");
      return;
    }
    if (!groupId) { // Verifica se groupId existe
      setErrorMessage("ID do grupo não encontrado. Não é possível criar a lista.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const newListData = {
        name: trimmedName,
        archived: false, // Listas começam desrarquivadas
        createdAt: serverTimestamp(),
      };
      console.log("Adding new shopping list:", newListData);
      // Cria na subcoleção 'shoppingLists' do grupo especificado
      const collectionPath = collection(db, "groups", groupId, "shoppingLists");
      await addDoc(collectionPath, newListData);
      showMessage({
        message: "Deu certo!",
        description: "Item adicionado com sucesso!",
        backgroundColor: colors.success,
        color: colors.textPrimary,
    });

      setListName(''); // Limpa input
      onClose(); // Fecha o modal

    } catch (error: any) {
      console.error("Error adding shopping list:", error);
      setErrorMessage("Erro ao salvar a lista. Tente novamente.");
       if (error.code === 'permission-denied') {
           setErrorMessage("Permissão negada para criar lista.");
       }
    } finally {
      setIsLoading(false);
    }
  };

  // Reseta o estado ao fechar/abrir
  useEffect(() => {
      if(!isVisible) {
          setListName('');
          setErrorMessage(null);
          setIsLoading(false);
      }
  }, [isVisible]);

  return (
     <Modal
      animationType="slide" // Animação de baixo para cima
      transparent={true}    // Fundo transparente
      visible={isVisible}
      onRequestClose={onClose} // Fecha com botão voltar (Android)
    >
      <KeyboardAvoidingView
         behavior={Platform.OS === "ios" ? "padding" : "height"}
         style={styles.keyboardAvoidingView} // Ocupa tela inteira
      >
         {/* Overlay que fecha ao clicar */}
         <TouchableOpacity
             style={styles.modalOverlay}
             activeOpacity={1}
             onPress={onClose}
         >
             {/* Container principal do modal (evita fechar ao clicar dentro) */}
            <TouchableOpacity style={styles.modalContainer} activeOpacity={1} onPress={() => Keyboard.dismiss()}>
                {/* Permite scroll se conteúdo for maior */}
                <ScrollView keyboardShouldPersistTaps="handled">
                     {/* Cabeçalho */}
                     <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Nova Lista de Compras</Text>
                        <TouchableOpacity onPress={onClose} disabled={isLoading}>
                            <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
                        </TouchableOpacity>
                     </View>

                     {/* Input Nome */}
                     <Text style={styles.label}>Nome da Lista</Text>
                     <TextInput
                         style={styles.input}
                         placeholder="Ex: Mercado Mensal, Farmácia"
                         placeholderTextColor={colors.placeholder}
                         value={listName}
                         onChangeText={setListName}
                         editable={!isLoading}
                         autoFocus={true} // Foca automaticamente ao abrir
                         onSubmitEditing={handleAddList} // Permite criar com "Enter"
                         returnKeyType="done"
                     />

                      {/* Mensagem de Erro */}
                      {errorMessage && <Text style={styles.errorMessage}>{errorMessage}</Text>}

                     {/* Botão Criar */}
                     <TouchableOpacity
                         style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
                         onPress={handleAddList}
                         disabled={isLoading || !listName.trim()} // Desabilita se carregando ou vazio
                     >
                         {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Criar Lista</Text>}
                     </TouchableOpacity>
                </ScrollView>
            </TouchableOpacity>
            </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// --- ESTILOS ATUALIZADOS para Bottom Sheet ---
const getBottomSheetStyles = (colors: any) => StyleSheet.create({
    keyboardAvoidingView: {
        flex: 1, // Ocupa toda a tela
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end', // <-- Alinha o conteúdo na base
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // Fundo escurecido
    },
    modalContainer: {
        backgroundColor: colors.bottomSheet, // Cor de fundo do tema
        borderTopLeftRadius: 20, // <-- Apenas bordas superiores arredondadas
        borderTopRightRadius: 20,
        padding: 25, // Espaçamento interno
        paddingBottom: Platform.OS === 'ios' ? 40 : 30, // Padding inferior maior (safe area)
        width: '100%', // <-- Ocupa toda a largura
        maxHeight: '70%', // <-- Altura máxima (ajuste conforme necessário)
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 }, // Sombra para cima
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 10, // Sombra Android
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 25,
    },
    modalTitle: {
        fontSize: 18, // Um pouco menor
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    label: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 8, // Mais espaço abaixo do label
        marginTop: 10,
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 14, // Mais padding vertical
        fontSize: 16,
        color: colors.textPrimary,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 15, // Mais espaço abaixo do input
    },
    errorMessage: {
        color: colors.error,
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 10, // Mais espaço abaixo do erro
        fontSize: 14,
    },
    saveButton: {
        backgroundColor: colors.primary,
        paddingVertical: 15, // Botão ligeiramente maior
        borderRadius: 10, // Mais arredondado
        alignItems: 'center',
        marginTop: 20,
    },
    saveButtonDisabled: {
        backgroundColor: colors.textSecondary, // Cor diferente quando desabilitado
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default AddShoppingListModal;