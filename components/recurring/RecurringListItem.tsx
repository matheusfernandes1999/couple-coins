// components/recurring/RecurringListItem.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { RecurringTransaction } from '@/types'; // Ajuste o caminho
import { useTheme } from '@/context/ThemeContext'; // Ajuste o caminho
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';

const formatCurrency = (value: number): string => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (timestamp: Timestamp): string => timestamp.toDate().toLocaleDateString('pt-BR');
const formatFrequency = (item: RecurringTransaction): string => {
    const freqMap = { daily: 'Dia', weekly: 'Semana', monthly: 'Mês', yearly: 'Ano' };
    const s = item.interval > 1 ? 's' : '';
    return `A cada ${item.interval} ${freqMap[item.frequency]}${s}`;
};

interface RecurringListItemProps {
  item: RecurringTransaction;
  onEdit: (item: RecurringTransaction) => void;
  onToggleActive?: (id: string, currentStatus: boolean) => void; // Opcional: se quiser toggle direto
  // onRegisterNow?: (item: RecurringTransaction) => void; // Opcional: para disparo manual
}

const RecurringListItem: React.FC<RecurringListItemProps> = ({ item, onEdit, onToggleActive }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const isIncome = item.type === 'income';
  const amountColor = isIncome ? colors.success : colors.error;
  const iconName = isIncome ? 'arrow-up-circle' : 'arrow-down-circle';

  return (
    <TouchableOpacity style={styles.container} onPress={() => onEdit(item)} activeOpacity={0.7}>
       <View style={styles.iconContainer}>
           <Ionicons name={iconName} size={28} color={amountColor} />
       </View>
       <View style={styles.detailsContainer}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={[styles.amount, { color: amountColor }]}>{formatCurrency(item.amount)}</Text>
            <Text style={styles.infoText}>{item.category} • {formatFrequency(item)}</Text>
            <Text style={styles.infoText}>Próxima: {formatDate(item.nextDueDate)}</Text>
            {item.notes && <Text style={styles.notesText} numberOfLines={1}>Nota: {item.notes}</Text>}
       </View>
       {onToggleActive && ( // Mostra switch se a função for passada
           <View style={styles.switchContainer}>
                <Switch
                    trackColor={{ false: "#767577", true: colors.primary + '80' }}
                    thumbColor={item.isActive ? colors.primary : "#f4f3f4"}
                    ios_backgroundColor="#3e3e3e"
                    onValueChange={() => onToggleActive(item.id, item.isActive)} // Chama handler com ID e status atual
                    value={item.isActive}
                 />
           </View>
        )}

    </TouchableOpacity>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
    container: { flexDirection: 'row', backgroundColor: colors.surface, padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    iconContainer: { marginRight: 12 },
    detailsContainer: { flex: 1 }, // Ocupa espaço
    name: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 3 },
    amount: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
    infoText: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
    notesText: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 3 },
    switchContainer: { marginLeft: 10 }, // Espaço para o switch
});

export default RecurringListItem;