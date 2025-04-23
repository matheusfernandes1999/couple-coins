// components/recurring/BillListItem.tsx
import React, { useState } from 'react'; // Importa useState
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
// Removido Alert, pois usaremos ConfirmationModal
import { BillReminder } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import ConfirmationModal from '@/components/modal/ConfirmationModal'; // <-- Importa o modal

// Funções auxiliares (mantidas)
const formatCurrency = (value: number | null | undefined): string => {
    if (value !== undefined && value !== null && !isNaN(value)) {
       return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
     return 'R$ --,--';
 };
const formatDate = (timestamp?: Timestamp | null): string => timestamp ? timestamp.toDate().toLocaleDateString('pt-BR') : 'N/A';

interface BillListItemProps {
  item: BillReminder;
  onEdit: (item: BillReminder) => void;
  onMarkPaid: (id: string) => void;
  onDelete: (id: string) => void; // <-- Nova prop para exclusão
}

const BillListItem: React.FC<BillListItemProps> = ({ item, onEdit, onMarkPaid, onDelete }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const isOverdue = !item.isPaid && item.dueDate.toDate() < new Date();

  // --- Estado para o modal de confirmação ---
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  // ---------------------------------------

  // Handler que abre o modal de confirmação
  const handleDeletePress = () => {
    setShowConfirmDeleteModal(true);
  };

  // Handler chamado ao confirmar a exclusão no modal
  const confirmDelete = () => {
      setShowConfirmDeleteModal(false); // Fecha o modal
      onDelete(item.id);                // Chama a função onDelete passada pelo pai
  };


  return (
    <> {/* Fragmento para permitir modal como irmão */}
        <View style={[styles.container, item.isPaid && styles.paidContainer]}>
            {/* Área Clicável Principal (para Editar) */}
            <TouchableOpacity style={styles.detailsTouchable} onPress={() => onEdit(item)} activeOpacity={0.7}>
                <View style={styles.iconContainer}>
                   <Ionicons name={item.isPaid ? "checkmark-circle" : (isOverdue ? "alert-circle" : "calendar-outline")} size={24} color={item.isPaid ? colors.success : (isOverdue ? colors.error : colors.primary)} />
               </View>
               <View style={styles.detailsContainer}>
                    <Text style={[styles.name, item.isPaid && styles.paidText]}>{item.name}</Text>
                    {/* CORREÇÃO: Usar item.amount conforme interface BillReminder */}
                    <Text style={[styles.amount, item.isPaid && styles.paidText]}>{formatCurrency(item.value)}</Text>
                    <Text style={[styles.infoText, item.isPaid && styles.paidText]}>
                        Venc: {formatDate(item.dueDate)}
                        {item.isRecurring && ' (Recorrente)'}
                    </Text>
                    {item.isPaid && item.lastPaidDate && ( <Text style={[styles.paidDateText]}>Pago em: {formatDate(item.lastPaidDate)}</Text> )}
                    {item.notes && <Text style={[styles.notesText, item.isPaid && styles.paidText]} numberOfLines={1}>Nota: {item.notes}</Text>}
               </View>
            </TouchableOpacity>

            {/* Container para botões de ação à direita */}
            <View style={styles.actionsContainer}>
                {/* Botão Pagar (Condicional) */}
                {!item.isPaid && (
                   <TouchableOpacity style={styles.payButton} onPress={() => onMarkPaid(item.id)}>
                        <Ionicons name="checkmark-done-outline" size={22} color={colors.success} />
                        {/* <Text style={styles.payButtonText}>Pagar</Text> */}
                   </TouchableOpacity>
                )}
                 {/* Botão Excluir (Sempre visível?) */}
                <TouchableOpacity style={styles.actionButton} onPress={handleDeletePress}>
                   <Ionicons name="trash-outline" size={20} color={colors.error} />
                </TouchableOpacity>
            </View>
        </View>

         {/* --- Modal de Confirmação Reutilizável --- */}
        <ConfirmationModal
            isVisible={showConfirmDeleteModal}
            onClose={() => setShowConfirmDeleteModal(false)} // Fecha o modal
            onConfirm={confirmDelete} // Chama a função que executa o onDelete da prop
            title="Confirmar Exclusão"
            message={`Tem certeza que deseja excluir a conta/lembrete "${item.name}"?`}
            confirmButtonText="Excluir"
            isDestructive={true} // Botão vermelho
        />
        {/* --------------------------------------- */}
    </>
  );
};

// --- Estilos ATUALIZADOS ---
const getStyles = (colors: any) => StyleSheet.create({
    container: { flexDirection: 'row', backgroundColor: colors.surface, paddingVertical: 10, paddingLeft: 12, paddingRight: 8, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    paidContainer: { backgroundColor: colors.surface + '90', borderColor: colors.border + '50'},
    detailsTouchable: { flexDirection: 'row', flex: 1, alignItems: 'center'},
    iconContainer: { marginRight: 12 },
    detailsContainer: { flex: 1, marginRight: 5 }, // Adiciona pequena margem direita
    name: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 3 },
    amount: { fontSize: 15, fontWeight: '600', marginBottom: 4, color: colors.error },
    infoText: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
    notesText: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 3 },
    paidText: { textDecorationLine: 'line-through', color: colors.textSecondary },
    paidDateText: { fontSize: 11, color: colors.success, fontStyle: 'italic', marginTop: 2 },
    actionsContainer: { // Novo container para botões à direita
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 5, // Espaço entre detalhes e ações
    },
    payButton: { padding: 8, alignItems: 'center', justifyContent: 'center', /* borderWidth: 1, borderColor: colors.success, */ borderRadius: 6 },
    payButtonText: { color: colors.success, fontSize: 10, fontWeight: 'bold', marginTop: 0 }, // Texto menor ou removido
    actionButton: { // Estilo para botão excluir (e outros futuros)
        padding: 8, // Área de toque
        marginLeft: 8, // Espaço entre pagar e excluir
    },
});

export default BillListItem;