// components/budget/BudgetListItem.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { BudgetData, Transaction } from '@/types';
import { db, auth } from '../../lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore'; // Import increment
import { getMonthYear } from '@/utils/helpers'; // Import helper
import * as Progress from 'react-native-progress'; // Para barra de progresso: npx expo install react-native-progress react-native-svg

interface BudgetListItemProps {
  item: BudgetData;
  groupId: string | null; // Necessário para buscar transações ou atualizar meta
  onEdit: (budget: BudgetData) => void; // Função para editar
  onDelete: (budgetId: string) => void; // Função para deletar
  // onArchive: (budgetId: string, currentStatus: boolean) => void; // Opcional: para arquivar
}

const BudgetListItem: React.FC<BudgetListItemProps> = ({ item, groupId, onEdit, onDelete }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const currentUser = auth.currentUser;

  // Estado para gastos do orçamento mensal
  const [spentAmount, setSpentAmount] = useState<number>(0);
  const [isLoadingSpent, setIsLoadingSpent] = useState<boolean>(false);

  // Estado para adicionar poupança à meta
  const [savingsInput, setSavingsInput] = useState('');
  const [isAddingSavings, setIsAddingSavings] = useState(false);


  // Efeito para buscar gastos do orçamento MENSAL
  useEffect(() => {
    // Só roda para orçamentos mensais e se tivermos os dados necessários
    if (item.type !== 'monthly' || !groupId || !item.category || !item.monthYear) {
      setIsLoadingSpent(false); // Garante que não fica carregando se não for mensal
      return () => {};
    }

    setIsLoadingSpent(true);
    console.log(`BudgetListItem (${item.category}): Setting up transaction listener for month ${item.monthYear}`);

    // Calcula início e fim do mês/ano do orçamento
    const [year, month] = item.monthYear.split('-').map(Number);
    const startDate = Timestamp.fromDate(new Date(year, month - 1, 1)); // Mês é 0-indexado
    const endDate = Timestamp.fromDate(new Date(year, month, 0, 23, 59, 59)); // Último dia do mês

    const transQuery = query(
      collection(db, "groups", groupId, "transactions"),
      where("category", "==", item.category), // Filtra pela categoria do orçamento
      where("type", "==", "expense"), 
    );

    const unsubscribe = onSnapshot(transQuery, (snapshot) => {
      let totalSpent = 0;
      snapshot.forEach(doc => {
        totalSpent += doc.data().value || 0;
      });
      console.log(`BudgetListItem (${item.category}): Total spent updated: ${totalSpent}`);
      setSpentAmount(totalSpent);
      setIsLoadingSpent(false);
    }, (error) => {
      console.error(`Error fetching transactions for budget ${item.category}:`, error);
      setIsLoadingSpent(false);
      // Poderia mostrar um erro na UI do item
    });

    return () => unsubscribe(); // Limpa o listener

  }, [groupId, item.type, item.category, item.monthYear]); // Dependências

  // --- Handlers ---
  const handleDeletePress = () => {
    Alert.alert( "Confirmar Exclusão", `Deseja excluir "${item.name}"?`,
      [ { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => onDelete(item.id) } ]
    );
  };

  const handleAddSavings = async () => {
    if (!groupId || !currentUser || isAddingSavings) return;
    const amountToAdd = parseFloat(savingsInput.replace(',', '.')) || 0;
    if (amountToAdd <= 0) {
        Alert.alert("Erro", "Digite um valor positivo para adicionar à meta.");
        return;
    }

    setIsAddingSavings(true);
    const budgetDocRef = doc(db, "groups", groupId, "budgets", item.id);
    try {
        // Usa increment para adicionar atomicamente ao valor existente
        await updateDoc(budgetDocRef, {
            amountSaved: increment(amountToAdd),
            updatedAt: serverTimestamp()
        });
        console.log(`Added ${amountToAdd} to goal ${item.id}`);
        setSavingsInput(''); // Limpa input
         // O listener no BudgetScreen (se houver) ou re-fetch atualizará a UI
         // ou podemos atualizar localmente: setAmountSaved(prev => (prev || 0) + amountToAdd);
    } catch (error) {
        console.error("Error adding savings:", error);
        Alert.alert("Erro", "Não foi possível adicionar o valor à meta.");
    } finally {
        setIsAddingSavings(false);
    }
  };

  // --- Cálculos de Progresso ---
  const target = item.targetAmount || 0;
  let current = 0;
  let progress = 0;

  if (item.type === 'monthly') {
      current = spentAmount;
      if (target > 0) progress = Math.min(current / target, 1); // Progresso do gasto (não passar de 100%)
  } else { // goal
      current = item.amountSaved || 0;
      if (target > 0) progress = Math.min(current / target, 1); // Progresso do guardado
  }

   // Define a cor da barra de progresso
   let progressColor = colors.primary;
   if (item.type === 'monthly' && progress > 0.85) progressColor = colors.error; // Alerta se > 85% gasto
   else if (item.type === 'goal' && progress >= 1) progressColor = colors.success; // Verde se meta atingida

  // --- Renderização ---
  return (
    <View style={styles.container}>
        {/* Nome e Ações Edit/Delete */}
        <View style={styles.headerRow}>
            <Text style={styles.nameText}>{item.name}</Text>
            <View style={styles.actionButtons}>
                <TouchableOpacity onPress={() => onEdit(item)} style={styles.iconButton}>
                    <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                 <TouchableOpacity onPress={handleDeletePress} style={styles.iconButton}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                 </TouchableOpacity>
                 {/* Opcional: Botão Arquivar */}
            </View>
        </View>

        {/* Barra de Progresso */}
        <Progress.Bar
            progress={progress}
            width={null} // Ocupa largura disponível
            height={8}
            color={progressColor}
            unfilledColor={colors.border + '50'} // Cor de fundo da barra
            borderColor={colors.border}
            borderRadius={4}
            style={styles.progressBar}
         />

        {/* Detalhes Específicos por Tipo */}
        {item.type === 'monthly' ? (
            <View style={styles.detailsRow}>
                 {isLoadingSpent ? <ActivityIndicator size="small" color={colors.textSecondary} /> :
                    <Text style={styles.detailText}>
                        Gasto: <Text style={{fontWeight: 'bold', color: progressColor}}>{current.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</Text>
                    </Text>
                 }
                <Text style={styles.detailText}>
                    Limite: {target.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}
                </Text>
            </View>
        ) : ( // type === 'goal'
            <>
             <View style={styles.detailsRow}>
                 <Text style={styles.detailText}>
                     Guardado: <Text style={{fontWeight: 'bold', color: progressColor}}>{current.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</Text>
                 </Text>
                 <Text style={styles.detailText}>
                     Meta: {target.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}
                 </Text>
             </View>
             {item.targetDate && (
                 <Text style={styles.targetDateText}>Data Alvo: {item.targetDate.toDate().toLocaleDateString('pt-BR')}</Text>
             )}
             {/* Input para Adicionar Poupança */}
              <View style={styles.addSavingsRow}>
                  <TextInput
                      style={styles.savingsInput}
                      placeholder="Valor a guardar"
                      placeholderTextColor={colors.placeholder}
                      keyboardType="numeric"
                      value={savingsInput}
                      onChangeText={setSavingsInput}
                      editable={!isAddingSavings}
                  />
                  <TouchableOpacity
                      style={[styles.savingsButton, isAddingSavings && styles.savingsButtonDisabled]}
                      onPress={handleAddSavings}
                      disabled={isAddingSavings}
                   >
                     {isAddingSavings ? <ActivityIndicator size="small" color="#FFF"/> : <Ionicons name="add-circle" size={20} color="#FFF" />}
                     <Text style={styles.savingsButtonText}>Guardar</Text>
                 </TouchableOpacity>
              </View>
            </>
        )}

    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: colors.border,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    nameText: {
        fontSize: 17,
        fontWeight: 'bold',
        color: colors.textPrimary,
        flex: 1, // Ocupa espaço
        marginRight: 10,
    },
    actionButtons: {
        flexDirection: 'row',
    },
    iconButton: {
        padding: 4,
        marginLeft: 12,
    },
    progressBar: {
        marginVertical: 10, // Espaço acima e abaixo da barra
    },
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    detailText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
     targetDateText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontStyle: 'italic',
        textAlign: 'right',
        marginTop: 4,
    },
    addSavingsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 15,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: colors.border + '80',
    },
    savingsInput: {
        flex: 1,
        height: 38, // Menor altura
        backgroundColor: colors.background, // Fundo diferente
        borderRadius: 6,
        paddingHorizontal: 10,
        fontSize: 14,
        color: colors.textPrimary,
        borderWidth: 1,
        borderColor: colors.border,
        marginRight: 10,
    },
    savingsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.success,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    savingsButtonDisabled: {
        backgroundColor: colors.textSecondary,
    },
    savingsButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 5,
    },
});

export default BudgetListItem;