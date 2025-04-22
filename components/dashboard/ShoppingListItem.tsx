// components/dashboard/ShoppingListItem.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'; // Import Alert
import Checkbox from 'expo-checkbox';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { ShoppingListItemData } from '@/types';
import ConfirmationModal from '@/components/modal/ConfirmationModal';

interface ShoppingListItemProps {
  item: ShoppingListItemData;
  onToggleBought: () => void; 
  onEdit: () => void;         
  onDelete: () => void;       
}

const ShoppingListItem: React.FC<ShoppingListItemProps> = ({
   item,
   onToggleBought,
   onEdit, 
   onDelete
  }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors, item.isBought);

  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const handleDeletePress = () => {
    setShowConfirmDeleteModal(true);
  };

  const confirmDelete = () => {
      setShowConfirmDeleteModal(false); 
      onDelete();                     
  };

  return (
    <View style={styles.container}>
        <Checkbox
            style={styles.checkbox}
            value={item.isBought}
            onValueChange={onToggleBought}
            color={item.isBought ? colors.primary : colors.textSecondary}
        />
        
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

        <View style={styles.actionsContainer}>
            <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
                <Ionicons name="pencil-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeletePress} style={styles.actionButton}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
        </View>

        <ConfirmationModal
            isVisible={showConfirmDeleteModal}
            onClose={() => setShowConfirmDeleteModal(false)} 
            onConfirm={confirmDelete} 
            title="Confirmar Exclusão"
            message={`Tem certeza que deseja excluir o item "${item.name}" da lista?`}
            confirmButtonText="Excluir"
            isDestructive={true} 
        />
    </View>
  );
};

const getStyles = (colors: any, isBought: boolean) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isBought ? colors.background : colors.surface,
    paddingVertical: 10, 
    paddingHorizontal: 10,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isBought ? colors.border : colors.primary,
    opacity: isBought ? 0.6 : 1.0,
  },
  checkbox: {
    marginRight: 12,
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
  },
  detailsContainer: {
      flex: 1, 
      marginRight: 5, 
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
  actionsContainer: { 
      flexDirection: 'row', 
      alignItems: 'center',
  },
  actionButton: {
       padding: 6, 
       marginLeft: 8, 
   },
});

export default ShoppingListItem;