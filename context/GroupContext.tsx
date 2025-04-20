// context/GroupContext.tsx
import React, {
    createContext,
    useState,
    useEffect,
    useContext,
    ReactNode,
    useCallback,
    useMemo
  } from 'react';
  import { User, onAuthStateChanged } from 'firebase/auth';
  import { doc, getDoc, onSnapshot, DocumentData } from 'firebase/firestore';
  import { auth, db } from '../lib/firebase'; // Ajuste o caminho
  import { GroupData } from '@/types'; // Ajuste o caminho
  
  interface GroupContextProps {
    groupId: string | null;
    groupData: GroupData | null;
    isLoadingGroup: boolean; // Loading específico do contexto do grupo
    groupError: string | null;
    fetchUserGroupId: () => void; // Função para re-buscar ID se necessário
  }
  
  const GroupContext = createContext<GroupContextProps>({
    groupId: null,
    groupData: null,
    isLoadingGroup: true,
    groupError: null,
    fetchUserGroupId: () => {},
  });
  
  // Hook customizado
  export const useGroup = () => useContext(GroupContext);
  
  interface GroupProviderProps {
    children: ReactNode;
  }
  
  export const GroupProvider: React.FC<GroupProviderProps> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser); // Pega o usuário inicial
    const [groupId, setGroupId] = useState<string | null>(null);
    const [groupData, setGroupData] = useState<GroupData | null>(null);
    const [isLoadingGroup, setIsLoadingGroup] = useState(true); // Inicia carregando
    const [groupError, setGroupError] = useState<string | null>(null);
  
    // 1. Observa mudanças no estado de autenticação
    useEffect(() => {
      const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        console.log('GroupContext: Auth state changed, user:', user?.uid);
        setCurrentUser(user);
        if (!user) {
          // Limpa tudo se deslogar
          setGroupId(null);
          setGroupData(null);
          setIsLoadingGroup(false); // Não está carregando grupo se não há user
          setGroupError(null);
        } else {
           setIsLoadingGroup(true); // Começa a carregar dados do grupo para o novo usuário
        }
      });
      return () => unsubscribeAuth(); // Limpa listener de auth
    }, []);
  
    // 2. Busca o GroupID do usuário logado (quando currentUser muda)
    const fetchUserGroupId = useCallback(async () => {
      if (!currentUser) {
        setGroupId(null);
        setIsLoadingGroup(false);
        setGroupError(null);
        return;
      }
  
      console.log('GroupContext: Fetching groupId for user:', currentUser.uid);
      setIsLoadingGroup(true); // Inicia carregamento
      setGroupError(null);
      const userDocRef = doc(db, "users", currentUser.uid);
  
      try {
        const docSnap = await getDoc(userDocRef);
        const fetchedGroupId = docSnap.exists() ? docSnap.data()?.groupId : null;
        console.log('GroupContext: Fetched groupId:', fetchedGroupId);
        setGroupId(fetchedGroupId || null);
         if (!fetchedGroupId) {
              setIsLoadingGroup(false); // Termina loading se usuário não tem grupo
              setGroupData(null); // Garante que não há dados de grupo antigos
          }
      } catch (error: any) {
        console.error("GroupContext: Error fetching user groupId:", error);
        setGroupError("Erro ao buscar dados do usuário.");
        setGroupId(null);
        setGroupData(null);
        setIsLoadingGroup(false);
      }
      setIsLoadingGroup(false);
      // Não define isLoading=false aqui, pois o listener do grupo fará isso se houver groupId
    }, [currentUser]); // Depende do usuário atual
  
    // Executa o fetch do GroupID quando o usuário mudar
    useEffect(() => {
        fetchUserGroupId();
    }, [fetchUserGroupId]); // Executa quando a função (e currentUser) mudam
  
  
    // 3. Escuta os dados do grupo (QUANDO groupId for definido)
    useEffect(() => {
      // Só executa se tivermos um groupId válido
      if (!groupId) {
         // Se groupId se tornou null (ex: saiu do grupo), garante que isLoading pare
         // (caso o listener não tenha sido ativado antes de ficar null)
          if (!isLoadingGroup && groupData) { // Apenas para limpar se já tinha dados
              setGroupData(null);
          }
         return;
      }
  
      console.log('GroupContext: Setting up group listener for:', groupId);
      // Mantém loading true até o listener retornar dados ou erro
      setIsLoadingGroup(true);
      setGroupError(null);
      const groupDocRef = doc(db, "groups", groupId);
  
      const unsubscribeGroup = onSnapshot(groupDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as GroupData;
          console.log('GroupContext: Group data received:', data.groupName);
          setGroupData(data);
        } else {
          console.warn("GroupContext: Group document not found!", groupId);
          setGroupError("Grupo não encontrado.");
          setGroupData(null);
          setGroupId(null); // Desvincula usuário se grupo não existe
        }
        setIsLoadingGroup(false); // Termina loading após sucesso ou erro "não existe"
      }, (error) => {
        console.error("GroupContext: Error listening to group document:", error);
        setGroupError("Erro ao carregar dados do grupo.");
        setGroupData(null);
        setIsLoadingGroup(false); // Termina loading no erro do listener
      });
  
      // Limpa o listener
      return () => {
          console.log('GroupContext: Cleaning up group listener for:', groupId);
          unsubscribeGroup();
      };
    }, [groupId]); // Depende apenas do groupId
  
    // O valor fornecido pelo contexto
    const contextValue = useMemo(() => ({
        groupId,
        groupData,
        isLoadingGroup,
        groupError,
        fetchUserGroupId // Expõe a função para re-fetch manual se necessário
    }), [groupId, groupData, isLoadingGroup, groupError, fetchUserGroupId]);
  
  
    return (
      <GroupContext.Provider value={contextValue}>
        {children}
      </GroupContext.Provider>
    );
  };