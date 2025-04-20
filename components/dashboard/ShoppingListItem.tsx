// components/dashboard/ShoppingListItem.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'; // Import Alert
import Checkbox from 'expo-checkbox';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { ShoppingListItemData } from '@/types';

interface ShoppingListItemProps {
  item: ShoppingListItemData;
  onToggleBought: () => void; // Mantém como antes (passa item no pai)
  onEdit: () => void;         // <-- Nova Prop para Editar
  onDelete: () => void;       // <-- Nova Prop para Excluir
}

const ShoppingListItem: React.FC<ShoppingListItemProps> = ({
   item,
   onToggleBought,
   onEdit, // Recebe handler
   onDelete // Recebe handler
  }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors, item.isBought);

  // Confirmação antes de deletar
  const handleDeletePress = () => {
      Alert.alert(
          "Confirmar Exclusão",
          `Tem certeza que deseja excluir o item "${item.name}"?`,
          [
              { text: "Cancelar", style: "cancel" },
              { text: "Excluir", style: "destructive", onPress: onDelete } // Chama onDelete passado por prop
          ]
      );
  };


  return (
    <View style={styles.container}>
        {/* Checkbox */}
        <Checkbox
            style={styles.checkbox}
            value={item.isBought}
            onValueChange={onToggleBought}
            color={item.isBought ? colors.primary : colors.textSecondary}
        />
        {/* Detalhes (clicáveis para marcar/desmarcar também) */}
        <TouchableOpacity style={styles.detailsContainer} onPress={onToggleBought} activeOpacity={0.7}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.itemDetails} numberOfLines={1}>
                {item.quantity} {item.unit}
                {item.store ? ` - ${item.store}` : ''}
                {item.estimatedValue ? ` (Est. ${item.estimatedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})` : ''}
            </Text>
            {item.isBought && item.boughtAt && (
                <Text style={styles.boughtDetails}>
                    Comprado em: {item.boughtAt.toDate().toLocaleDateString('pt-BR')}
                </Text>
            )}
        </TouchableOpacity>

        {/* Botões de Ação (Editar e Excluir) */}
        <View style={styles.actionsContainer}>
            {/* Botão Editar */}
            <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
                <Ionicons name="pencil-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
             {/* Botão Excluir */}
            <TouchableOpacity onPress={handleDeletePress} style={styles.actionButton}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
        </View>
    </View>
  );
};

const getStyles = (colors: any, isBought: boolean) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isBought ? colors.background : colors.surface,
    paddingVertical: 10, // Reduzido padding vertical
    paddingHorizontal: 10,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isBought ? colors.border : colors.primary,
    opacity: isBought ? 0.6 : 1.0,
  },
  checkbox: {
    marginRight: 12, // Espaço antes do texto
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
  },
  detailsContainer: {
      flex: 1, // Ocupa o espaço disponível entre checkbox e ações
      marginRight: 5, // Espaço antes dos botões de ação
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    textDecorationLine: isBought ? 'line-through' : 'none',
    marginBottom: 2,
  },
  itemDetails: {
    fontSize: 13,
    color: colors.textSecondary,
    textDecorationLine: isBought ? 'line-through' : 'none',
  },
  boughtDetails: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 3,
  },
  actionsContainer: { // Container para os botões de ação
      flexDirection: 'row', // Alinha botões horizontalmente
      alignItems: 'center',
  },
  actionButton: {
       padding: 6, // Área de toque um pouco maior
       marginLeft: 8, // Espaçamento entre os botões de ação
   },
});

export default ShoppingListItem;