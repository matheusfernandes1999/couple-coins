// app/shopping/archived.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Stack, useNavigation } from 'expo-router'; // Importa Stack
import { useTheme } from '../../context/ThemeContext';
import { useGroup } from '../../context/GroupContext';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, orderBy, where, doc, updateDoc } from 'firebase/firestore';
import { ShoppingList } from '@/types';

export default function ArchivedShoppingListsScreen() {
  const { colors } = useTheme();
  const { groupId, isLoadingGroup } = useGroup();
  const navigation = useNavigation();

  const [archivedLists, setArchivedLists] = useState<ShoppingList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Define o título da tela
  useEffect(() => {
      navigation.setOptions({ title: 'Listas Arquivadas' });
  }, [navigation]);

  // --- Listener para Listas Arquivadas ---
  useEffect(() => {
    if (!groupId) {
      setArchivedLists([]);
      setIsLoading(false);
      return () => {};
    }

    if (!isLoadingGroup) setIsLoading(true);

    console.log("ArchivedScreen: Setting up ARCHIVED lists listener for group:", groupId);
    const listsQuery = query(
      collection(db, "groups", groupId, "shoppingLists"),
      where("archived", "==", true),
    );

    const unsubscribe = onSnapshot(listsQuery, (querySnapshot) => {
      const fetchedLists: ShoppingList[] = [];
      querySnapshot.forEach((doc) => {
        fetchedLists.push({ id: doc.id, ...doc.data() } as ShoppingList);
      });
      console.log(`ArchivedScreen: Fetched ${fetchedLists.length} archived lists.`);
      setArchivedLists(fetchedLists);
      setIsLoading(false);
    }, (error) => {
      console.error("ArchivedScreen: Error listening to archived lists:", error);
      Alert.alert("Erro", "Não foi possível carregar as listas arquivadas.");
      setIsLoading(false);
    });

    return () => {
        console.log("ArchivedScreen: Cleaning up listener for group:", groupId);
        unsubscribe();
    }
  }, [groupId, isLoadingGroup]);

   // --- Handler para Desarquivar ---
   const handleUnarchive = async (listId: string) => {
      if (!groupId) return;
      const listDocRef = doc(db, "groups", groupId, "shoppingLists", listId);
      try {
          await updateDoc(listDocRef, { archived: false }); // Define archived como false
          console.log(`List ${listId} unarchived`);
          // A lista sumirá daqui automaticamente devido ao filtro 'where'
          Alert.alert("Sucesso", "Lista desarquivada!"); // Feedback
      } catch (error) {
          console.error("Error unarchiving list:", error);
          Alert.alert("Erro", "Não foi possível desarquivar a lista.");
      }
   };

  // --- Render Item da Lista Arquivada ---
  const renderArchivedItem = ({ item }: { item: ShoppingList }) => (
      <View style={styles.listItem}>
          <View style={styles.listItemContent}>
             <Ionicons name="archive" size={28} color={colors.textSecondary} style={styles.listIcon} />
             <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
          </View>
           {/* Botão Desarquivar */}
           <TouchableOpacity onPress={() => handleUnarchive(item.id)} style={styles.actionButton}>
               <Ionicons name="arrow-undo-outline" size={24} color={colors.success} />
               <Text style={styles.actionButtonText}> Desarquivar</Text>
           </TouchableOpacity>
      </View>
  );

  // --- Renderização Principal ---
  const styles = getStyles(colors);

  // Usa loading do grupo OU loading específico das listas
  if (isLoadingGroup || isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!groupId) {
    return (
         <View style={[styles.container, styles.centered]}>
              <Ionicons name="alert-circle-outline" size={60} color={colors.textSecondary} style={styles.icon} />
              <Text style={styles.title}>Sem Grupo</Text>
              <Text style={styles.subtitle}>Você precisa estar em um grupo para usar a lista de compras.</Text>
         </View>
    );
}

  return (
    <View style={styles.container}>
       {/* Adiciona Stack.Screen aqui para configurar o header desta rota específica */}
        <Stack.Screen options={{ headerShown: true, title: 'Listas Arquivadas' }} />

        {archivedLists.length === 0 ? (
            <View style={styles.centered}>
                <Ionicons name="archive-outline" size={60} color={colors.textSecondary} style={styles.icon}/>
                <Text style={styles.title}>Nenhuma Lista Arquivada</Text>
                <Text style={styles.subtitle}>Listas que você arquivar aparecerão aqui.</Text>
            </View>
        ) : (
            <FlatList
                data={archivedLists}
                renderItem={renderArchivedItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
            />
        )}
    </View>
  );
}

// --- Estilos (similares aos da tela principal, adaptados) ---
const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  listContent: { padding: 15 },
  icon: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: 'center' },
  listItem: { backgroundColor: colors.surface, padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, opacity: 0.7 }, // Opacidade para arquivadas
  listItemContent: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  listIcon: { marginRight: 12 },
  listName: { fontSize: 17, color: colors.textSecondary, flexShrink: 1, textDecorationLine: 'line-through' }, // Riscado
  actionButton: { padding: 5, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4 },
  actionButtonText: { color: colors.success, fontSize: 14, fontWeight: '500' },
});