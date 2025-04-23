// app/(tabs)/profile.tsx
import React, { useState, useEffect, useLayoutEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useGroup } from "@/context/GroupContext";
import ConfirmationModal from "@/components/modal/ConfirmationModal";
import { auth, db } from "@/lib/firebase";
import { signOut, User } from "firebase/auth";
import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
} from "firebase/firestore";
import { showMessage } from "react-native-flash-message";
import GroupMembersList from "@/components/profile/GroupMemberList";

export default function ProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { groupId, groupData, isLoadingGroup } = useGroup();

  const [newCategoryName, setNewCategoryName] = useState("");
  const [isUpdatingCategories, setIsUpdatingCategories] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoadingName, setIsLoadingName] = useState(true);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showConfirmDeleteCategoryModal, setShowConfirmDeleteCategoryModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
 
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => router.push("/screens/settings")}
          style={{ marginRight: 15 }}
        >
          <Ionicons name="settings-outline" size={24} color={"#fff"} />
        </TouchableOpacity>
      ),
      headerStyle: { backgroundColor: colors.primary },
      headerTintColor: "#fff",
      headerTitleStyle: { fontWeight: "bold" },
      title: "Perfil",
    });
  }, [navigation, router, colors]);

  useEffect(() => {
    const fetchUserName = async (user: User) => {
      setIsLoadingName(true);
      const userDocRef = doc(db, "users", user.uid);
      try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          setUserName(docSnap.data()?.displayName || null);
        } else {
          console.log("Documento do usuário não encontrado ao buscar nome.");
          setUserName(null);
        }
      } catch (error) {
        console.error("Erro ao buscar nome do usuário:", error);
        setUserName(null);
      } finally {
        setIsLoadingName(false);
      }
    };

    if (auth.currentUser) {
      fetchUserName(auth.currentUser);
    } else {
      setUserName(null);
      setIsLoadingName(false);
    }
  }, [auth.currentUser]);

  const handleAddCategory = async () => {
    const trimmedCategory = newCategoryName.trim();
    if (!groupId) {
      showMessage({
        message: "Ops!",
        description: "Grupo não carregado.",
        backgroundColor: colors.error,
        color: colors.textPrimary,
      });
      return;
    }
    if (!trimmedCategory) {
      showMessage({
        message: "Ops!",
        description: "Digite um nome para a categoria.",
        backgroundColor: colors.error,
        color: colors.textPrimary,
      });
      return;
    }

    const currentCategories = groupData?.categories || [];
    if (
      currentCategories.some(
        (cat: string) => cat.toLowerCase() === trimmedCategory.toLowerCase()
      )
    ) {
      showMessage({
        message: "Ops!",
        description: `A categoria "${trimmedCategory}" já existe.`,
        backgroundColor: colors.error,
        color: colors.textPrimary,
      });
      setNewCategoryName("");
      return;
    }

    setIsUpdatingCategories(true);
    Keyboard.dismiss();
    const groupDocRef = doc(db, "groups", groupId);
    try {
      await updateDoc(groupDocRef, {
        categories: arrayUnion(trimmedCategory),
      });
      console.log(`Category "${trimmedCategory}" added.`);
      setNewCategoryName("");
    } catch (error) {
      console.error("Error adding category:", error);
      showMessage({
        message: "Ops!",
        description: "Não foi possível adicionar a categoria.",
        backgroundColor: colors.error,
        color: colors.textPrimary,
      });
    } finally {
      setIsUpdatingCategories(false);
    }
  };

  const handleDeleteCategory = (categoryName: string) => {
    if (!groupId) return;
    setCategoryToDelete(categoryName);       
    setShowConfirmDeleteCategoryModal(true); 
  };

  const confirmDeleteCategory = async () => {
    if (!groupId || !categoryToDelete) return;

    setIsUpdatingCategories(true); 
    setShowConfirmDeleteCategoryModal(false);

    const groupDocRef = doc(db, "groups", groupId);
    try {
        await updateDoc(groupDocRef, {
            categories: arrayRemove(categoryToDelete)
        });
        console.log(`Category "${categoryToDelete}" removed.`);
        // O listener no GroupContext atualizará o groupData e a UI
        // Alert.alert("Sucesso", "Categoria removida."); // Opcional: Feedback com Toast seria melhor
    } catch (error) {
        console.error("Error removing category:", error);
    } finally {
        setIsUpdatingCategories(false);
        setCategoryToDelete(null); 
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      console.log("User signed out successfully.");
    } catch (error) {
      console.error("Error signing out:", error);
      showMessage({
        message: "Ops!",
        description: "Não foi possível sair.",
        backgroundColor: colors.error,
        color: colors.textPrimary,
      });
      setIsLoggingOut(false);
    }
  };

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

  const displayName = userName || auth.currentUser?.email || "Usuário";
  const sortedCategories = useMemo(() => {
    return [...(groupData?.categories || [])].sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" })
    );
  }, [groupData?.categories]);

  const categoriesToShow = showAllCategories
    ? sortedCategories
    : sortedCategories.slice(0, 2);

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.container}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Minha Conta</Text>
        <View style={styles.infoRow}>
          <Ionicons
            name="person-circle-outline"
            size={22}
            color={colors.textSecondary}
            style={styles.infoIcon}
          />
          {isLoadingName ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <Text style={styles.infoTextName}>{displayName}</Text>
          )}
        </View>
        <View style={styles.infoRow}>
          <Ionicons
            name="mail-outline"
            size={20}
            color={colors.textSecondary}
            style={styles.infoIcon}
          />
          <Text style={styles.infoText}>
            {auth.currentUser?.email || "Carregando..."}
          </Text>
        </View>
        {groupData && (
          <View style={styles.infoRow}>
            <Ionicons
              name="people-outline"
              size={20}
              color={colors.textSecondary}
              style={styles.infoIcon}
            />
            <Text style={styles.infoText}>
              Grupo: {groupData.groupName || "Grupo Familiar"}
            </Text>
          </View>
        )}
        <View style={styles.logoutButtonContainer}>
          <TouchableOpacity
            style={[styles.logoutButton, isLoggingOut && styles.buttonDisabled]}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <View style={styles.logoutButtonContent}>
                <Text style={styles.logoutButtonText}>Sair</Text>
                <Ionicons name="log-out-outline" size={22} color={"white"} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {isLoadingGroup ? (
        <ActivityIndicator color={colors.primary} />
      ) : !groupId ? (
          <Text style={styles.infoText}>Crie ou entre em um grupo para ver os membros.</Text>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Seu grupo</Text>
          <GroupMembersList />
        </>
      )}

      <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gerenciar Categorias</Text>
            {isLoadingGroup ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }}/>
            ) : !groupId ? (
                 <Text style={styles.noCategoriesText}>Entre ou crie um grupo para gerenciar categorias.</Text>
            ) : (
                <>
                    <View style={styles.categoryListContainer}>
                        {sortedCategories.length > 0 ? (
                            <ScrollView
                                nestedScrollEnabled={true}
                                fadingEdgeLength={20}
                            >
                                {sortedCategories.map((categoryName) => (
                                    <View key={categoryName} style={styles.categoryItem}>
                                        <Text style={styles.categoryText}>{categoryName}</Text>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteCategory(categoryName)}
                                            disabled={isUpdatingCategories}
                                            style={styles.deleteButton}
                                        >
                                            <Ionicons name="trash-bin-outline" size={20} color={colors.error} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        ) : (
                            <Text style={styles.noCategoriesText}>Nenhuma categoria personalizada.</Text>
                        )}
                    </View>
                    
                    <View style={styles.addCategoryContainer}>
                         <TextInput
                            style={styles.input}
                            placeholder="Nova categoria"
                            placeholderTextColor={colors.placeholder}
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

          <ConfirmationModal
            isVisible={showConfirmDeleteCategoryModal}
            onClose={() => { setShowConfirmDeleteCategoryModal(false); setCategoryToDelete(null); }}
            onConfirm={confirmDeleteCategory} 
            title="Confirmar Exclusão"
            message={`Tem certeza que deseja excluir a categoria "${categoryToDelete || ''}"? Transações ou orçamentos existentes com esta categoria não serão alterados.`}
            confirmButtonText="Excluir"
            isDestructive={true} 
          />

    </ScrollView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flexGrow: 1,
      padding: 20,
    },
    section: {
      marginBottom: 35,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 10,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
      paddingVertical: 8,
    },
    infoIcon: {
      marginRight: 15,
      width: 22,
      textAlign: "center",
    },
    infoText: {
      fontSize: 16,
      color: colors.textSecondary,
      flexShrink: 1,
    },
    infoTextName: {
      fontSize: 17,
      color: colors.textSecondary,
      fontWeight: "500",
      flexShrink: 1,
    },
    logoutButtonContainer: {
      marginTop: 25,
      alignItems: "center",
    },
    logoutButton: {
      backgroundColor: colors.error,
      paddingVertical: 12,
      paddingHorizontal: 30,
      borderRadius: 8,
      minWidth: 150,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
    },
    logoutButtonContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    logoutButtonText: {
      color: "white",
      fontSize: 16,
      fontWeight: "bold",
      marginRight: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    categoryListContainer: { 
      maxHeight: 190,
      marginBottom: 15,
      borderRadius: 8,
    },
    categoryItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
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
      flexDirection: "row",
      marginBottom: 15,
      alignItems: "center",
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
      height: 46,
    },
    addButton: {
      backgroundColor: colors.primary,
      padding: 10,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      height: 46,
      width: 46,
    },
    noCategoriesText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      fontStyle: "italic",
      marginVertical: 10,
    },
    toggleButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      marginTop: 5,
    },
    toggleButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "500",
      marginRight: 4,
    },
  });
