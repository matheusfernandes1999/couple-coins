// app/(tabs)/profile.tsx
import React, { useState, useEffect, useLayoutEffect } from 'react'; // Adicionado useEffect
import {
    View, Text, StyleSheet, TouchableOpacity, Alert,
    ScrollView, FlatList, TextInput, ActivityIndicator, Keyboard
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext'; // Ajuste o caminho
import { useGroup } from '../../context/GroupContext';   // Ajuste o caminho
import { auth, db } from '../../lib/firebase';          // Ajuste o caminho
import { signOut, User } from 'firebase/auth'; // Importar User
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore'; // Importa getDoc

export default function ProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  // Usa o contexto para groupId, groupData e também o auth.currentUser reativo
  const { groupId, groupData, isLoadingGroup } = useGroup();

  // Estados locais
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isUpdatingCategories, setIsUpdatingCategories] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userName, setUserName] = useState<string | null>(null); // <-- NOVO: Estado para nome do usuário
  const [isLoadingName, setIsLoadingName] = useState(true); // <-- NOVO: Loading do nome


  // Configura header (como antes)
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
      title: 'Perfil',
    });
  }, [navigation, router, colors]);

  // --- EFEITO PARA BUSCAR NOME DO USUÁRIO ---
  useEffect(() => {
    const fetchUserName = async (user: User) => {
        setIsLoadingName(true); // Inicia loading
        const userDocRef = doc(db, "users", user.uid);
        try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                // Define o nome do estado com o displayName do documento ou null se não existir
                setUserName(docSnap.data()?.displayName || null);
            } else {
                console.log("Documento do usuário não encontrado ao buscar nome.");
                setUserName(null); // Define como null se doc não existe
            }
        } catch (error) {
            console.error("Erro ao buscar nome do usuário:", error);
            setUserName(null); // Define como null em caso de erro
        } finally {
            setIsLoadingName(false); // Finaliza loading
        }
    };

    // Busca o nome SE houver um usuário logado vindo do contexto
    if (auth.currentUser) {
      fetchUserName(auth.currentUser);
    } else {
        // Se não há usuário (ex: logo após logout), limpa o nome e para o loading
        setUserName(null);
        setIsLoadingName(false);
    }
  }, [auth.currentUser]); // Roda sempre que o usuário do contexto mudar
  // ---------------------------------------



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
  };

  // --- Renderização ---
  const styles = getStyles(colors);

  const renderCategoryItem = ({ item }: { item: string }) => (
      <View style={styles.categoryItem}>
          <Text style={styles.categoryText}>{item}</Text>
          <TouchableOpacity
              onPress={() => handleDeleteCategory(item)}
              disabled={isUpdatingCategories}
              style={styles.deleteButton}
            >
              <Ionicons name="trash-bin-outline" size={20} color={colors.error} />
          </TouchableOpacity>
      </View>
  );

  // Define o que exibir como nome principal (Nome do BD ou Email)
  const displayName = userName || auth.currentUser?.email || 'Usuário';

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>

        {/* --- Seção Minha Conta ATUALIZADA --- */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Minha Conta</Text>
            {/* Exibição do Nome */}
            <View style={styles.infoRow}>
                <Ionicons name="person-circle-outline" size={22} color={colors.textSecondary} style={styles.infoIcon}/>
                {isLoadingName ? (
                    <ActivityIndicator size="small" color={colors.textPrimary}/>
                ) : (
                    <Text style={styles.infoTextName}>{displayName}</Text>
                )}
            </View>
             {/* Exibição do Email */}
            <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.infoIcon}/>
                <Text style={styles.infoText}>{auth.currentUser?.email || 'Carregando...'}</Text>
            </View>
             {/* Exibição do Grupo */}
            {groupData && (
                 <View style={styles.infoRow}>
                    <Ionicons name="people-outline" size={20} color={colors.textSecondary} style={styles.infoIcon}/>
                    <Text style={styles.infoText}>Grupo: {groupData.groupName || 'Grupo Familiar'}</Text>
                </View>
            )}
             {/* Botão Logout */}
             <View style={styles.logoutButtonContainer}>
                <TouchableOpacity
                    style={[styles.logoutButton, isLoggingOut && styles.buttonDisabled]}
                    onPress={handleLogout}
                    disabled={isLoggingOut}
                >
                    {isLoggingOut ? <ActivityIndicator color="#FFF"/> : (
                         <View style={styles.logoutButtonContent}>
                             <Text style={styles.logoutButtonText}>Sair</Text>
                             <Ionicons name="log-out-outline" size={22} color={'white'} />
                         </View>
                    )}
                 </TouchableOpacity>
             </View>
        </View>
        {/* ------------------------------------- */}


        {/* --- Seção Gerenciar Categorias --- */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gerenciar Categorias do Grupo</Text>
            {isLoadingGroup ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }}/>
            ) : (
                <>
                    {/* Lista de Categorias */}
                    {groupData?.categories && groupData.categories.length > 0 ? (
                        <FlatList
                            data={[...groupData.categories].sort((a,b) => a.localeCompare(b))}
                            renderItem={renderCategoryItem}
                            keyExtractor={(item) => item}
                            style={styles.categoryList}
                            scrollEnabled={false}
                        />
                    ) : (
                        <Text style={styles.noCategoriesText}>Nenhuma categoria personalizada.</Text>
                    )}
                    {/* Adicionar Categoria */}
                    <View style={styles.addCategoryContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Nova categoria"
                            value={newCategoryName}
                            onChangeText={setNewCategoryName}
                            editable={!isUpdatingCategories}
                            onSubmitEditing={handleAddCategory}
                            returnKeyType="done"
                        />
                        <TouchableOpacity
                            style={[styles.addButton, (isUpdatingCategories || !newCategoryName.trim()) && styles.buttonDisabled]}
                            onPress={handleAddCategory}
                            disabled={isUpdatingCategories || !newCategoryName.trim()}
                        >
                           {isUpdatingCategories ? <ActivityIndicator color="#FFF" size="small"/> : <Ionicons name="add" size={24} color="#FFF" />}
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </View>
        {/* --------------------------------- */}

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
    flexGrow: 1,
    padding: 20,
  },
  section: {
      marginBottom: 35, // Aumenta espaço entre seções
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 20, // Mais espaço abaixo do título
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10, // Aumenta padding
  },
  infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12, // Mais espaço entre linhas de info
      paddingVertical: 8, // Padding vertical
  },
  infoIcon: {
      marginRight: 15,
      width: 22, // Garante alinhamento dos ícones
      textAlign: 'center',
  },
  infoText: {
      fontSize: 16,
      color: colors.textSecondary, // Mantém cor secundária para email/grupo
      flexShrink: 1, // Permite quebrar linha se nome/email for longo
  },
   infoTextName: { // Estilo específico para o nome
      fontSize: 17, // Um pouco maior
      color: colors.textSecondary, // Cor primária
      fontWeight: '500', // Leve destaque
      flexShrink: 1,
  },
  logoutButtonContainer: {
    marginTop: 25, // Mais espaço acima do botão
    alignItems: 'center',
  },
  logoutButton: {
    backgroundColor: colors.error,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
    flexDirection: 'row', // Para alinhar texto e ícone
    justifyContent: 'center',
  },
   logoutButtonContent: { // View interna para alinhar texto e ícone no botão
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
   },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8, // Espaço entre texto e ícone
  },
  buttonDisabled: {
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
    flex: 1,
    marginRight: 10,
  },
  deleteButton: {
    padding: 5,
  },
  addCategoryContainer: {
    flexDirection: 'row',
    marginTop: 15, // Mais espaço acima do input
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 10,
    height: 46, // Altura fixa
  },
  addButton: {
    backgroundColor: colors.primary,
    padding: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    height: 46, // Mesma altura do input
    width: 46, // Botão quadrado
  },
   noCategoriesText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      fontStyle: 'italic',
      marginVertical: 10,
  }
});