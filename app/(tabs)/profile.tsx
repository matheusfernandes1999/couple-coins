// app/(tabs)/profile.tsx
import React, { useState, useLayoutEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Button, TouchableOpacity, Alert,
    ScrollView, FlatList, TextInput, ActivityIndicator, Keyboard
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext'; // Ajuste o caminho
import { useGroup } from '../../context/GroupContext';   // Ajuste o caminho
import { auth, db } from '../../lib/firebase';          // Ajuste o caminho
import { signOut } from 'firebase/auth';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'; // Importa funções de array

export default function ProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { groupId, groupData, isLoadingGroup } = useGroup(); // Pega dados do grupo

  // Estado local para nova categoria e loading/saving
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isUpdatingCategories, setIsUpdatingCategories] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);


  // Configura botão de Settings no header (como antes)
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => router.push('/screens/settings')} style={{ marginRight: 15 }}>
          <Ionicons name="settings-outline" size={24} color={'#fff'} />
        </TouchableOpacity>
      ),
      headerStyle: { backgroundColor: colors.primary },
      headerTintColor: '#fff',
      headerTitleStyle: { fontWeight: 'bold' },
      title: 'Perfil e Grupo', // Atualiza título
    });
  }, [navigation, router, colors]);


  // --- Handlers para Categorias ---

  // Adiciona nova categoria
  const handleAddCategory = async () => {
    const trimmedCategory = newCategoryName.trim();
    // Validação básica
    if (!groupId) { Alert.alert("Erro", "Grupo não carregado."); return; }
    if (!trimmedCategory) { Alert.alert("Erro", "Digite um nome para a categoria."); return; }

    const currentCategories = groupData?.categories || [];
    // Verifica duplicatas (ignorando maiúsculas/minúsculas)
    if (currentCategories.some((cat: string) => cat.toLowerCase() === trimmedCategory.toLowerCase())) {
        Alert.alert("Erro", `A categoria "${trimmedCategory}" já existe.`);
        setNewCategoryName(''); // Limpa input mesmo se duplicado
        return;
    }

    setIsUpdatingCategories(true);
    Keyboard.dismiss();
    const groupDocRef = doc(db, "groups", groupId);
    try {
        // Usa arrayUnion para adicionar o item ao array 'categories'
        await updateDoc(groupDocRef, {
            categories: arrayUnion(trimmedCategory)
        });
        console.log(`Category "${trimmedCategory}" added.`);
        setNewCategoryName(''); // Limpa input no sucesso
        // O listener no GroupContext atualizará o groupData e a UI
    } catch (error) {
        console.error("Error adding category:", error);
        Alert.alert("Erro", "Não foi possível adicionar a categoria.");
    } finally {
        setIsUpdatingCategories(false);
    }
  };

  // Deleta uma categoria existente
  const handleDeleteCategory = (categoryToDelete: string) => {
    if (!groupId) return;

    // Confirmação
    Alert.alert(
      "Confirmar Exclusão",
      `Tem certeza que deseja excluir a categoria "${categoryToDelete}"? Transações ou orçamentos existentes com esta categoria não serão alterados.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            setIsUpdatingCategories(true);
            const groupDocRef = doc(db, "groups", groupId);
            try {
                // Usa arrayRemove para remover o item do array 'categories'
                await updateDoc(groupDocRef, {
                    categories: arrayRemove(categoryToDelete)
                });
                console.log(`Category "${categoryToDelete}" removed.`);
                // O listener no GroupContext atualizará o groupData e a UI
            } catch (error) {
                console.error("Error removing category:", error);
                Alert.alert("Erro", "Não foi possível remover a categoria.");
            } finally {
                setIsUpdatingCategories(false);
            }
          },
        },
      ]
    );
  };
  // -----------------------------


  // --- Handler Logout ---
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      // Não precisa de redirect aqui, o listener de auth no GroupContext/RootLayout cuida disso
      console.log('User signed out successfully.');
    } catch (error) {
      console.error("Error signing out:", error);
      Alert.alert("Erro", "Não foi possível sair.");
      setIsLoggingOut(false); // Só reseta se der erro
    }
     // Não precisa de finally aqui, o componente será desmontado
  };
  // --------------------

  // --- Renderização ---
  const styles = getStyles(colors);

  const renderCategoryItem = ({ item }: { item: string }) => (
      <View style={styles.categoryItem}>
          <Text style={styles.categoryText}>{item}</Text>
          <TouchableOpacity
              onPress={() => handleDeleteCategory(item)}
              disabled={isUpdatingCategories} // Desabilita enquanto outra operação ocorre
              style={styles.deleteButton}
            >
              <Ionicons name="trash-bin-outline" size={20} color={colors.error} />
          </TouchableOpacity>
      </View>
  );

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
        {/* Seção Informações (Pode adicionar mais infos do usuário/grupo) */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Minha Conta</Text>
            <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.infoIcon}/>
                <Text style={styles.infoText}>{auth.currentUser?.email || 'Carregando...'}</Text>
            </View>
            {/* Poderia mostrar nome do grupo aqui também */}
            {groupData && (
                 <View style={styles.infoRow}>
                    <Ionicons name="people-outline" size={20} color={colors.textSecondary} style={styles.infoIcon}/>
                    <Text style={styles.infoText}>{groupData.groupName || 'Grupo Familiar'}</Text>
                </View>
            )}
             <View style={styles.logoutButtonContainer}>
                <TouchableOpacity
                    style={[styles.logoutButton, isLoggingOut && styles.buttonDisabled]}
                    onPress={handleLogout}
                    disabled={isLoggingOut}
                >
                    {isLoggingOut ? <ActivityIndicator color="#FFF"/> : <Text style={styles.logoutButtonText}>Sair (Logout)</Text>}
                 </TouchableOpacity>
             </View>
        </View>


        {/* Seção Gerenciar Categorias */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gerenciar Categorias do Grupo</Text>

            {isLoadingGroup ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }}/>
            ) : (
                <>
                    {/* Lista de Categorias Existentes */}
                    {groupData?.categories && groupData.categories.length > 0 ? (
                        <FlatList
                            data={[...groupData.categories].sort((a,b) => a.localeCompare(b))} // Ordena alfabeticamente para exibição
                            renderItem={renderCategoryItem}
                            keyExtractor={(item) => item}
                            style={styles.categoryList}
                            scrollEnabled={false} // Desabilita scroll da FlatList interna
                        />
                    ) : (
                        <Text style={styles.noCategoriesText}>Nenhuma categoria personalizada adicionada.</Text>
                    )}

                    {/* Input para Adicionar Nova Categoria */}
                    <View style={styles.addCategoryContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Nome da nova categoria"
                            placeholderTextColor={colors.placeholder}
                            value={newCategoryName}
                            onChangeText={setNewCategoryName}
                            editable={!isUpdatingCategories}
                            onSubmitEditing={handleAddCategory} // Permite adicionar com "Enter"
                            returnKeyType="done"
                        />
                        <TouchableOpacity
                            style={[styles.addButton, (isUpdatingCategories || !newCategoryName.trim()) && styles.buttonDisabled]}
                            onPress={handleAddCategory}
                            disabled={isUpdatingCategories || !newCategoryName.trim()}
                        >
                           {isUpdatingCategories && !isLoggingOut ? <ActivityIndicator color="#FFF" size="small"/> : <Ionicons name="add" size={24} color="#FFF" />}
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </View>

        {/* Adicionar mais seções se necessário */}

    </ScrollView>
  );
}

// --- Estilos ---
const getStyles = (colors: any) => StyleSheet.create({
  scrollView: {
      flex: 1,
      backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1, // Permite scroll se conteúdo exceder
    padding: 20,
  },
  section: {
      marginBottom: 30, // Espaço entre seções
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      paddingVertical: 5,
  },
  infoIcon: {
      marginRight: 15,
  },
  infoText: {
      fontSize: 16,
      color: colors.textSecondary,
  },
  logoutButtonContainer: {
    marginTop: 20,
    alignItems: 'center', // Centraliza botão
  },
  logoutButton: {
    backgroundColor: colors.error,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    minWidth: 150, // Largura mínima
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: { // Estilo genérico para botões desabilitados
      opacity: 0.6,
  },
  categoryList: {
      marginBottom: 15,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryText: {
    fontSize: 16,
    color: colors.textPrimary,
    flex: 1, // Ocupa espaço para empurrar o botão
    marginRight: 10,
  },
  deleteButton: {
    padding: 5, // Área de toque
  },
  addCategoryContainer: {
    flexDirection: 'row',
    marginTop: 10,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10, // Um pouco menos padding
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 10, // Espaço antes do botão add
  },
  addButton: {
    backgroundColor: colors.primary,
    padding: 10, // Padding quadrado
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44, // Altura mínima para toque
    minWidth: 44,
  },
   noCategoriesText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      fontStyle: 'italic',
      marginVertical: 10,
  }
});