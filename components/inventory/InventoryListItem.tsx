// components/inventory/InventoryListItem.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext'; 
import { InventoryItemData } from '@/types';          
import ConfirmationModal from '../modal/ConfirmationModal';

interface InventoryListItemProps {
  item: InventoryItemData;
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
  onAddToShoppingList: (item: InventoryItemData) => void;
  onPress: () => void;      
  onEdit: () => void;      
  onDelete: () => void;     
}

const InventoryListItem: React.FC<InventoryListItemProps> = ({
  item,
  onUpdateQuantity,
  onAddToShoppingList,
  onPress,
  onEdit,    
  onDelete   
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleIncrease = () => onUpdateQuantity(item.id, item.quantity + 1);
  const handleDecrease = () => { if (item.quantity > 0) onUpdateQuantity(item.id, item.quantity - 1); };
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);

  const handleDeletePress = () => {
    setShowConfirmDeleteModal(true); 
  };

  const confirmDelete = () => {
      setShowConfirmDeleteModal(false);
      onDelete();                     
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <View style={styles.outerContainer}>
      <View style={styles.container}>
          <TouchableOpacity style={styles.detailsClickableArea} activeOpacity={0.7} onPress={toggleExpand}>
              <View style={styles.detailsContainer}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemSubDetails} numberOfLines={1}>
                      {item.category ? `${item.category}` : 'Sem categoria'}
                      {item.lastPurchaseDate ? ` • Últ. Compra: ${item.lastPurchaseDate.toDate().toLocaleDateString('pt-BR')}` : ''}
                  </Text>
              </View>
          </TouchableOpacity>

          <View style={styles.quantityContainer}>
              <TouchableOpacity onPress={handleDecrease} style={styles.quantityButton}>
                  <Ionicons name="remove-circle-outline" size={26} color={colors.error} />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{item.quantity} {item.unit}</Text>
              <TouchableOpacity onPress={handleIncrease} style={styles.quantityButton}>
                  <Ionicons name="add-circle-outline" size={26} color={colors.success} />
              </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.expandButton} onPress={toggleExpand}>
              <Ionicons 
                name={isExpanded ? "chevron-up" : "chevron-down"} 
                size={22} 
                color={colors.textSecondary} 
              />
          </TouchableOpacity>
      </View>

      {isExpanded && (
        <View style={styles.expandedActionsContainer}>
          <TouchableOpacity style={styles.expandedActionButton} onPress={onPress}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.actionButtonText}>Detalhes</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.expandedActionButton} onPress={() => onAddToShoppingList(item)}>
            <Ionicons name="cart-outline" size={20} color={colors.primary} />
            <Text style={styles.actionButtonText}>Add à Lista</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.expandedActionButton} onPress={onEdit}>
            <Ionicons name="pencil-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.actionButtonText}>Editar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.expandedActionButton} onPress={handleDeletePress}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={styles.actionButtonText}>Excluir</Text>
          </TouchableOpacity>
        </View>
      )}

        <ConfirmationModal
            isVisible={showConfirmDeleteModal}
            onClose={() => setShowConfirmDeleteModal(false)} 
            onConfirm={confirmDelete}
            title="Confirmar Exclusão"
            message={`Deseja realmente excluir "${item.name}" do inventário?`}
            confirmButtonText="Excluir"
            isDestructive={true} 
        />

    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
    outerContainer: {
        backgroundColor: colors.surface,
        marginBottom: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    detailsClickableArea: {
        flex: 1,
        marginRight: 8,
    },
    detailsContainer: {
    },
    itemName: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.textPrimary,
        marginBottom: 3,
    },
    itemSubDetails: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    quantityButton: {
        padding: 4,
    },
    quantityText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.textPrimary,
        minWidth: 45,
        textAlign: 'center',
        marginHorizontal: 4,
    },
    expandButton: {
        padding: 8,
        marginLeft: 4,
    },
    expandedActionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surfaceVariant || colors.background,
    },
    expandedActionButton: {
        flexDirection: 'column',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    actionButtonText: {
        fontSize: 12,
        marginTop: 4,
        color: colors.textSecondary,
        textAlign: 'center',
    },
});

export default InventoryListItem;