// components/budget/BudgetListItem.tsx
import React, { useState } from 'react'; // Removido useEffect
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { BudgetData, ProcessedBudgetData } from '@/types'; // Usa ProcessedBudgetData
import { db, auth } from '../../lib/firebase';
import { doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import * as Progress from 'react-native-progress';

// Props ATUALIZADAS - Recebe item como ProcessedBudgetData
interface BudgetListItemProps {
  item: ProcessedBudgetData; // <-- Recebe item já com spentAmount (se mensal)
  // groupId ainda pode ser útil para onAddSavings
  groupId: string | null;
  onEdit: (budget: BudgetData) => void;
  onDelete: (budgetId: string) => void;
}

const BudgetListItem: React.FC<BudgetListItemProps> = ({
    item,
    groupId, // Mantido para handleAddSavings
    onEdit,
    onDelete,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const handleDeletePress = () => {
    Alert.alert( "Confirmar Exclusão", `Deseja excluir "${item.name}"?`,
      [ { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => onDelete(item.id) } ]
    );
  };

  // --- Cálculos de Progresso (usam item.spentAmount agora) ---
  const target = item.targetAmount || 1;
  let current = 0;
  let progress = 0;
  let progressColor = colors.primary;
  let remaining = 0; // Variável para o restante

  if (item.type === 'monthly') {
      // Usa spentAmount diretamente do item processado
      current = item.spentAmount !== undefined ? item.spentAmount : 0;
      remaining = item.targetAmount - current; // Calcula o restante
      progress = target > 0 ? Math.min(current / target, 1.1) : 0; // Permite passar um pouco visualmente
      if (progress > 1) progressColor = colors.error;
      else if (progress > 0.85) progressColor = '#FFA500';
      else progressColor = colors.success;
  } 

  // --- Renderização ---
  return (
    <View style={styles.container}>
        {/* Header com Nome e Botões Edit/Delete */}
        <View style={styles.headerRow}>
            <View style={styles.nameAndCategories}>
                <Text style={styles.nameText} numberOfLines={1}>{item.name}</Text>
                {/* Mostra categorias apenas para tipo mensal */}
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

        {/* Barra de Progresso */}
        <Progress.Bar
            progress={Math.min(progress, 1)} width={null} height={10}
            color={progressColor} unfilledColor={colors.border + '40'}
            borderColor={'transparent'} borderRadius={5} style={styles.progressBar}
         />

        {/* Detalhes: Gasto/Guardado vs Limite/Meta e Restante */}
        <View style={styles.detailsRow}>
            <Text style={styles.detailText}>
                {item.type === 'monthly' ? 'Gasto:' : 'Guardado:'}
                <Text style={{fontWeight: 'bold', color: progressColor}}> {current.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</Text>
            </Text>
            <Text style={styles.detailText}>
                {item.type === 'monthly' ? 'Limite:' : 'Meta:'}
                <Text style={{fontWeight: 'bold'}}> {item.targetAmount.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</Text>
            </Text>
            {/* Exibe o valor restante */}
             <Text style={styles.detailText}>
                {remaining >= 0 ? 'Restam:' : 'Excedeu:'}
                <Text style={{fontWeight: 'bold', color: getBalanceColor(remaining)}}> {Math.abs(remaining).toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</Text>
             </Text>
        </View>

      
    </View>
  );
};

// Estilos (Atualizados para nova estrutura de detalhes)
const getStyles = (colors: any) => StyleSheet.create({
    container: { backgroundColor: colors.surface, padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: colors.border },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    nameAndCategories: { flex: 1, marginRight: 10 },
    nameText: { fontSize: 17, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 },
    categoriesText: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', flexWrap: 'wrap' }, // Permite quebrar linha
    targetDateText: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
    actionButtons: { flexDirection: 'row' },
    iconButton: { padding: 4, marginLeft: 12 },
    progressBar: { marginVertical: 12, height: 10 }, // Aumenta margem vertical
    detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap' },
    detailText: { fontSize: 13, color: colors.textSecondary, marginBottom: 4, marginRight: 10 }, // Adiciona marginRight
    addSavingsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border + '80' },
    savingsInput: { flex: 1, height: 40, backgroundColor: colors.background, borderRadius: 6, paddingHorizontal: 10, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, marginRight: 10 },
    savingsButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.success, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
    savingsButtonDisabled: { backgroundColor: colors.textSecondary },
    savingsButtonText: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginLeft: 5 },
});
// Função auxiliar para cor do balanço/restante
const getBalanceColor = (balance: number) => balance >= 0 ? 'green' : 'red'; // Precisa de colors

export default BudgetListItem;