// components/profile/GroupMembersList.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext'; // Ajuste o caminho
import { useGroup } from '../../context/GroupContext';   // Ajuste o caminho
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../lib/firebase';              // Ajuste o caminho
import { doc, getDoc } from 'firebase/firestore';     // Importa getDoc

// Interface para os detalhes de um membro a serem exibidos
interface MemberDetails {
  id: string; // User ID
  name: string; // Nome exibido (displayName ou fallback)
  // email?: string; // Opcional: pode adicionar email se quiser
}

const GroupMembersList: React.FC = () => {
  const { colors } = useTheme();
  const { groupData, isLoadingGroup } = useGroup(); // Pega dados do grupo e loading
  const styles = getStyles(colors);

  // Estado para guardar os detalhes buscados dos membros
  const [membersDetails, setMembersDetails] = useState<MemberDetails[]>([]);
  // Estado para loading específico da busca de detalhes dos membros
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Memoiza a lista de IDs de membros para evitar re-buscas desnecessárias
  const memberIds = useMemo(() => groupData?.members || [], [groupData?.members]);

  // Efeito para buscar detalhes dos membros quando a lista de IDs mudar
  useEffect(() => {
    // Função async para buscar os nomes
    const fetchMemberDetails = async () => {
      // Só busca se houver IDs e o grupo principal não estiver carregando
      if (memberIds.length === 0 || isLoadingGroup) {
        setMembersDetails([]); // Limpa se não há membros
        setIsLoadingMembers(false);
        return;
      }

      console.log("GroupMembersList: Fetching details for members:", memberIds);
      setIsLoadingMembers(true); // Inicia loading dos detalhes
      setMembersDetails([]); // Limpa detalhes antigos antes de buscar

      try {
        // Cria um array de Promises, uma para cada busca de documento de usuário
        const fetchPromises = memberIds.map(async (userId) => {
          const userDocRef = doc(db, "users", userId);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const userData = docSnap.data();
            return {
              id: userId,
              // Usa displayName, senão email, senão um fallback com ID
              name: userData?.displayName || userData?.email || `Usuário ...${userId.slice(-5)}`,
            };
          } else {
            // Retorna um fallback se o documento do usuário não for encontrado
            return { id: userId, name: `Usuário ...${userId.slice(-5)} (Não encontrado)` };
          }
        });

        // Espera todas as buscas terminarem
        const results = await Promise.all(fetchPromises);
        // Ordena os resultados alfabeticamente pelo nome
        results.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
        setMembersDetails(results); // Atualiza o estado com os detalhes buscados e ordenados

      } catch (error) {
        console.error("Error fetching member details:", error);
        // Poderia definir um estado de erro aqui
        setMembersDetails([]); // Limpa em caso de erro
      } finally {
        setIsLoadingMembers(false); // Finaliza o loading dos detalhes
      }
    };

    fetchMemberDetails(); // Chama a função de busca

  }, [memberIds, isLoadingGroup]); // Depende da lista memoizada de IDs e do loading do grupo

  // Renderiza cada item da lista de membros
  const renderMemberItem = ({ item }: { item: MemberDetails }) => (
    <View style={styles.memberItem}>
      <Ionicons name="person-circle-outline" size={22} color={colors.textSecondary} style={styles.memberIcon} />
      <Text style={styles.memberName}>{item.name}</Text>
    </View>
  );

  // --- Renderização Principal do Componente ---

  // Mostra loading se o grupo ou os detalhes dos membros estiverem carregando
  if (isLoadingGroup || isLoadingMembers) {
    return <ActivityIndicator color={colors.primary} style={{ marginVertical: 15 }} />;
  }

  // Mostra mensagem se não houver membros no grupo
  if (membersDetails.length === 0) {
    return <Text style={styles.noMembersText}>Nenhum membro encontrado neste grupo.</Text>;
  }

  // Renderiza a lista de membros
  return (
    <FlatList
      data={membersDetails}
      renderItem={renderMemberItem}
      keyExtractor={(item) => item.id}
      style={styles.listContainer}
      scrollEnabled={false} // Desabilita scroll interno se já estiver dentro de um ScrollView pai
    />
  );
};

// --- Estilos ---
const getStyles = (colors: any) => StyleSheet.create({
  listContainer: {
    marginBottom: 15,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface, // Fundo do item
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberIcon: {
    marginRight: 12,
  },
  memberName: {
    fontSize: 16,
    color: colors.textPrimary,
    flex: 1, // Ocupa espaço disponível
  },
  noMembersText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 10,
  },
});

export default GroupMembersList;