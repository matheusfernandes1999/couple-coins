// components/dashboard/TransactionDetailModal.tsx
import React, { useState, useEffect } from 'react'; // Import useState, useEffect
import {
    View, Text, Modal, StyleSheet, TouchableOpacity,
    ScrollView, Alert, ActivityIndicator // Import ActivityIndicator
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Transaction } from '@/types';
import { Timestamp, doc, getDoc } from 'firebase/firestore'; // Import doc, getDoc
import { db } from '../../lib/firebase'; // Import db

// Interface para as props do componente
interface TransactionDetailModalProps {
  isVisible: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transactionId: string) => void;
}

// Funções auxiliares de formatação (como antes)
const formatDate = (timestamp: Timestamp | null | undefined): string => {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    }
    return 'N/A';
};
const formatTime = (timestamp: Timestamp | null | undefined): string => {
     if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleTimeString('pt-BR', {
            hour: '2-digit', minute: '2-digit'
        });
    }
    return '';
};
const formatCurrency = (value: number | null | undefined): string => {
    if (value !== undefined && value !== null) {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    return 'N/A';
};
//---------------------------------------


const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isVisible,
  onClose,
  transaction,
  onEdit,
  onDelete
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  // --- Estado para Nome do Usuário ---
  const [registeredByName, setRegisteredByName] = useState<string | null>(null);
  const [isLoadingName, setIsLoadingName] = useState(false);
  // ----------------------------------

  // --- Efeito para Buscar Nome do Usuário ---
  useEffect(() => {
      const fetchUserName = async () => {
          if (!transaction?.userId) { // Verifica se temos um ID de usuário
              setRegisteredByName("Desconhecido"); // Define como desconhecido se não houver ID
              setIsLoadingName(false);
              return;
          }

          setIsLoadingName(true); // Inicia loading
          setRegisteredByName(null); // Limpa nome anterior
          const userDocRef = doc(db, "users", transaction.userId); // Referência ao documento do usuário

          try {
              const docSnap = await getDoc(userDocRef); // Busca o documento
              if (docSnap.exists()) {
                  // Se encontrar, usa o displayName ou um fallback com ID
                  const name = docSnap.data()?.displayName;
                  setRegisteredByName(name || `Usuário ...${transaction.userId.slice(-5)}`);
              } else {
                  // Se não encontrar o documento
                  console.warn(`Documento do usuário ${transaction.userId} não encontrado.`);
                  setRegisteredByName(`Usuário ...${transaction.userId.slice(-5)} (não encontrado)`);
              }
          } catch (error) {
              console.error("Erro ao buscar nome do usuário para transação:", error);
              setRegisteredByName(`Usuário ...${transaction.userId.slice(-5)} (erro)`); // Fallback em caso de erro
          } finally {
              setIsLoadingName(false); // Finaliza loading
          }
      };

      // Busca o nome apenas quando o modal estiver visível e houver uma transação
      if (isVisible && transaction) {
          fetchUserName();
      } else {
          // Limpa nome e para loading se modal fechar ou não houver transação
          setRegisteredByName(null);
          setIsLoadingName(false);
      }
       // Limpa ao desmontar ou quando item/visibilidade mudar (antes de buscar de novo)
       return () => {
            setRegisteredByName(null);
            setIsLoadingName(false);
       }

  }, [isVisible, transaction]); // Depende da visibilidade e da transação atual
  // ---------------------------------------


  // Não renderiza se não houver transação
  if (!transaction) {
    return null;
  }

  // Handlers para botões (como antes)
  const handleEditPress = () => { onEdit(transaction); };
  const handleDeletePress = () => { /* ... Alert com onDelete(transaction.id) ... */
      Alert.alert( "Confirmar Exclusão", "Tem certeza que deseja excluir esta transação?",
        [ { text: "Cancelar", style: "cancel" },
          { text: "Excluir", style: "destructive", onPress: () => onDelete(transaction.id) } ]
      );
  };

  // Formatação de dados (como antes)
  const valueColor = transaction.type === 'income' ? colors.success : colors.error;
  const valueSign = transaction.type === 'income' ? '+' : '-';
  const formattedDate = formatDate(transaction.date);
  const formattedTime = formatTime(transaction.date);
  const formattedCreatedAt = transaction.createdAt?.toDate().toLocaleString('pt-BR',{/*...*/}) || 'N/A';
  // const registeredBy = `${transaction.userId.slice(-5)}`; // Removido

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <ScrollView>
            {/* Cabeçalho */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalhes da Transação</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Seção de Detalhes */}
            <View style={styles.detailSection}>
                {/* ... Linhas Tipo, Valor, Categoria, Data ... */}
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Tipo:</Text>
                    <Text style={[styles.detailValue, { color: valueColor, fontWeight: 'bold' }]}>{transaction.type === 'income' ? 'Entrada' : 'Saída'}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Valor:</Text>
                    <Text style={[styles.detailValue, { color: valueColor, fontWeight: 'bold' }]}>{valueSign} {formatCurrency(transaction.value)}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Categoria:</Text>
                    <Text style={styles.detailValue}>{transaction.category}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Data:</Text>
                    <Text style={styles.detailValue}>{formattedDate} às {formattedTime}</Text>
                </View>
                {transaction.description && (
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Descrição:</Text>
                        <Text style={[styles.detailValue, styles.descriptionText]}>{transaction.description}</Text>
                    </View>
                )}
                {/* --- Linha Registrado Por ATUALIZADA --- */}
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Registrado por:</Text>
                    {isLoadingName
                        ? <ActivityIndicator size="small" color={colors.textSecondary} style={styles.loadingSpinner}/>
                        : <Text style={styles.detailValue}>{registeredByName || 'Desconhecido'}</Text> // Exibe nome ou fallback
                    }
                </View>
                {/* -------------------------------------- */}
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Registrado em:</Text>
                    <Text style={styles.detailValue}>{formattedCreatedAt}</Text>
                </View>
            </View>

            {/* Botões de Ação */}
            <View style={styles.actionButtons}>
                 <TouchableOpacity style={[styles.buttonOutline, { borderColor: colors.primary }]} onPress={handleEditPress}>
                    <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                    <Text style={[styles.buttonText, { color: colors.primary }]}> Editar</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={[styles.buttonOutline, { borderColor: colors.error }]} onPress={handleDeletePress}>
                     <Ionicons name="trash-outline" size={18} color={colors.error} />
                     <Text style={[styles.buttonText, { color: colors.error }]}> Excluir</Text>
                 </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// --- Estilos ---
const getStyles = (colors: any) => StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  modalContainer: { backgroundColor: colors.bottomSheet, borderRadius: 15, paddingVertical: 20, paddingHorizontal: 25, width: '90%', maxHeight: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  detailSection: { marginBottom: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }, // Alinha itens verticalmente
  detailLabel: { fontSize: 14, color: colors.textSecondary, width: '35%', fontWeight: '500' },
  detailValue: { fontSize: 15, color: colors.textPrimary, flex: 1, textAlign: 'right' },
  descriptionText: { textAlign: 'left' },
  loadingSpinner: { // Estilo para alinhar o spinner à direita como o texto
      alignSelf: 'flex-end',
      flex: 1, // Ocupa espaço para alinhar corretamente
      alignItems: 'flex-end', // Alinha o spinner em si à direita
  },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: colors.border },
  buttonOutline: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1.5, borderRadius: 8 },
  buttonText: { fontSize: 15, fontWeight: 'bold', marginLeft: 6 }
});

export default TransactionDetailModal;