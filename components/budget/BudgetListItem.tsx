// components/budget/BudgetListItem.tsx
import React, { useState } from 'react'; 
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { BudgetData, ProcessedBudgetData } from '@/types';
import * as Progress from 'react-native-progress';
import ConfirmationModal from '@/components/modal/ConfirmationModal';

interface BudgetListItemProps {
  item: ProcessedBudgetData;
  groupId: string | null;
  onEdit: (budget: BudgetData) => void;
  onDelete: (budgetId: string) => void;
}

const BudgetListItem: React.FC<BudgetListItemProps> = ({
    item,
    onEdit,
    onDelete,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);

  const handleDeletePress = () => {
    setShowConfirmDeleteModal(true);
  };

  const confirmDelete = () => {
      setShowConfirmDeleteModal(false); 
      onDelete(item.id);             
  };

  const target = item.targetAmount || 1;
  let current = 0;
  let progress = 0;
  let progressColor = colors.primary;
  let remaining = 0;

  if (item.type === 'monthly') {
      current = item.spentAmount !== undefined ? item.spentAmount : 0;
      remaining = item.targetAmount - current;
      progress = target > 0 ? Math.min(current / target, 1.1) : 0;
      if (progress > 1) progressColor = colors.error;
      else if (progress > 0.85) progressColor = '#FFA500';
      else progressColor = colors.success;
  } 

  return (
    <View style={styles.container}>
        <View style={styles.headerRow}>
            <View style={styles.nameAndCategories}>
                <Text style={styles.nameText} numberOfLines={1}>{item.name}</Text>
                {item.type === 'monthly' && (
                    <Text style={styles.categoriesText} numberOfLines={1}>
                       Categoria: {item.categories?.join(', ') || 'Nenhuma'}
                    </Text>
                )}
            </View>
            <View style={styles.actionButtons}>
                 <TouchableOpacity onPress={() => onEdit(item)} style={styles.iconButton}>
                    <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
                 </TouchableOpacity>
                 <TouchableOpacity onPress={handleDeletePress} style={styles.iconButton}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                 </TouchableOpacity>
            </View>
        </View>

        <Progress.Bar
            progress={Math.min(progress, 1)} width={null} height={10}
            color={progressColor} unfilledColor={colors.border + '40'}
            borderColor={'transparent'} borderRadius={5} style={styles.progressBar}
         />

        <View style={styles.detailsRow}>
            <Text style={styles.detailText}>
                {item.type === 'monthly' ? 'Gasto:' : 'Guardado:'}
                <Text style={{fontWeight: 'bold', color: progressColor}}> {current.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</Text>
            </Text>
            <Text style={styles.detailText}>
                {item.type === 'monthly' ? 'Limite:' : 'Meta:'}
                <Text style={{fontWeight: 'bold'}}> {item.targetAmount.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</Text>
            </Text>
             <Text style={styles.detailText}>
                {remaining >= 0 ? 'Restam:' : 'Excedeu:'}
                <Text style={{fontWeight: 'bold', color: getBalanceColor(remaining)}}> {Math.abs(remaining).toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</Text>
             </Text>
        </View>

        <ConfirmationModal
            isVisible={showConfirmDeleteModal}
            onClose={() => setShowConfirmDeleteModal(false)} 
            onConfirm={confirmDelete}
            title="Confirmar Exclusão"
            message={`Deseja realmente excluir o item "${item.name}"?`}
            confirmButtonText="Excluir"
            isDestructive={true}
        />

    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
    container: { backgroundColor: colors.surface, padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: colors.border },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    nameAndCategories: { flex: 1, marginRight: 10 },
    nameText: { fontSize: 17, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 },
    categoriesText: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', flexWrap: 'wrap' }, 
    targetDateText: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
    actionButtons: { flexDirection: 'row' },
    iconButton: { padding: 4, marginLeft: 12 },
    progressBar: { marginVertical: 12, height: 10 }, 
    detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap' },
    detailText: { fontSize: 13, color: colors.textSecondary, marginBottom: 4, marginRight: 10 },
    addSavingsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border + '80' },
    savingsInput: { flex: 1, height: 40, backgroundColor: colors.background, borderRadius: 6, paddingHorizontal: 10, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, marginRight: 10 },
    savingsButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.success, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
    savingsButtonDisabled: { backgroundColor: colors.textSecondary },
    savingsButtonText: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginLeft: 5 },
});

const getBalanceColor = (balance: number) => balance >= 0 ? 'green' : 'red';

export default BudgetListItem;