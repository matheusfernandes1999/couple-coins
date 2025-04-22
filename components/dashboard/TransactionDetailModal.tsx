// components/dashboard/TransactionDetailModal.tsx
import React, { useState, useEffect } from 'react'; 
import {
    View, Text, Modal, StyleSheet, TouchableOpacity,
    ScrollView, ActivityIndicator 
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Transaction } from '@/types';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase'; 
import ConfirmationModal from '@/components/modal/ConfirmationModal';

interface TransactionDetailModalProps {
  isVisible: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transactionId: string) => void;
}

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

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isVisible,
  onClose,
  transaction,
  onEdit,
  onDelete
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [registeredByName, setRegisteredByName] = useState<string | null>(null);
  const [isLoadingName, setIsLoadingName] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
      const fetchUserName = async () => {
          if (!transaction?.userId) {
              setRegisteredByName("Desconhecido");
              setIsLoadingName(false);
              return;
          }

          setIsLoadingName(true); 
          setRegisteredByName(null);

          const userDocRef = doc(db, "users", transaction.userId); 
          try {
              const docSnap = await getDoc(userDocRef); 
              if (docSnap.exists()) {
                  const name = docSnap.data()?.displayName;
                  setRegisteredByName(name || `Usuário ...${transaction.userId.slice(-5)}`);
              } else {
                  setRegisteredByName(`Usuário ...${transaction.userId.slice(-5)} (não encontrado)`);
              }
          } catch (error) {
              console.error("Erro ao buscar nome do usuário para transação:", error);
              setRegisteredByName(`Usuário ...${transaction.userId.slice(-5)} (erro)`); 
          } finally {
              setIsLoadingName(false); 
          }
      };

      if (isVisible && transaction) {
          fetchUserName();
      } else {
          setRegisteredByName(null);
          setIsLoadingName(false);
      }
       return () => {
            setRegisteredByName(null);
            setIsLoadingName(false);
       }

  }, [isVisible, transaction]);
  
  if (!transaction) {
    return null;
  }

  const handleEditPress = () => onEdit(transaction);
  const handleDeletePress = () => {
      setShowConfirmDelete(true); 
  };

  const confirmDelete = () => {
      setShowConfirmDelete(false);
      onDelete(transaction.id); 
      onClose();
  };

  const valueColor = transaction.type === 'income' ? colors.success : colors.error;
  const valueSign = transaction.type === 'income' ? '+' : '-';
  const formattedDate = formatDate(transaction.date);
  const formattedTime = formatTime(transaction.date);
  const formattedCreatedAt = transaction.createdAt?.toDate().toLocaleString('pt-BR',{/*...*/}) || 'N/A';

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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalhes da Transação</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.detailSection}>
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
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Registrado por:</Text>
                    {isLoadingName
                        ? <ActivityIndicator size="small" color={colors.textSecondary} style={styles.loadingSpinner}/>
                        : <Text style={styles.detailValue}>{registeredByName || 'Desconhecido'}</Text>
                    }
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Registrado em:</Text>
                    <Text style={styles.detailValue}>{formattedCreatedAt}</Text>
                </View>
            </View>

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
      
        <ConfirmationModal
            isVisible={showConfirmDelete}
            onClose={() => setShowConfirmDelete(false)} 
            onConfirm={confirmDelete} 
            title="Confirmar Exclusão"
            message={`Tem certeza que deseja excluir esta transação?\n(${transaction.category}: ${formatCurrency(transaction.value)})\nEsta ação não pode ser desfeita.`}
            confirmButtonText="Excluir"
            isDestructive={true}
        />

    </Modal>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  modalContainer: { backgroundColor: colors.bottomSheet, borderRadius: 15, paddingVertical: 20, paddingHorizontal: 25, width: '90%', maxHeight: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  detailSection: { marginBottom: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' },
  detailLabel: { fontSize: 14, color: colors.textSecondary, width: '35%', fontWeight: '500' },
  detailValue: { fontSize: 15, color: colors.textPrimary, flex: 1, textAlign: 'right' },
  descriptionText: { textAlign: 'left' },
  loadingSpinner: { 
      alignSelf: 'flex-end',
      flex: 1, 
      alignItems: 'flex-end',
  },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: colors.border },
  buttonOutline: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1.5, borderRadius: 8 },
  buttonText: { fontSize: 15, fontWeight: 'bold', marginLeft: 6 }
});

export default TransactionDetailModal;