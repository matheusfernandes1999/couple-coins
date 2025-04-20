// components/inventory/InventoryItemDetailModal.tsx
import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext'; // Ajuste o caminho
import { Ionicons } from '@expo/vector-icons';
import { InventoryItemData } from '@/types'; // Ajuste o caminho
import { Timestamp } from 'firebase/firestore'; // Para checagem de tipo

interface InventoryItemDetailModalProps {
  isVisible: boolean;
  onClose: () => void;
  item: InventoryItemData | null;
}

// Função auxiliar para formatar datas ou retornar 'N/A'
const formatDate = (timestamp: Timestamp | null | undefined): string => {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    }
    return 'N/A';
};

// Função auxiliar para formatar valores monetários ou retornar 'N/A'
const formatCurrency = (value: number | null | undefined): string => {
    if (value !== undefined && value !== null) {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    return 'N/A';
};

const InventoryItemDetailModal: React.FC<InventoryItemDetailModalProps> = ({ isVisible, onClose, item }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  if (!item) {
    return null; // Não renderiza se nenhum item for passado
  }

  // Formata dados para exibição
  const addedAtFormatted = formatDate(item.addedAt);
  const updatedAtFormatted = formatDate(item.updatedAt); // Usa a função auxiliar
  const lastPurchaseDateFormatted = formatDate(item.lastPurchaseDate);
  const nextPurchaseDateFormatted = formatDate(item.nextPurchaseDate);
  const lastPurchaseValueFormatted = formatCurrency(item.lastPurchaseValue);
  const nextPurchaseValueFormatted = formatCurrency(item.nextPurchaseValue);
  const lastPurchaseQuantityFormatted = item.lastPurchaseQuantity !== null ? item.lastPurchaseQuantity : 'N/A';
  const addedByFormatted = `...${item.addedBy.slice(-5)}`; // Exemplo: mostra fim do ID
  const lastUpdatedByFormatted = item.lastUpdatedBy ? `...${item.lastUpdatedBy.slice(-5)}` : 'N/A';


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
              <Text style={styles.modalTitle}>{item.name || "Detalhes do Item"}</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Detalhes do Inventário */}
            <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Informações Atuais</Text>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Quantidade:</Text>
                    <Text style={[styles.detailValue, styles.quantityValue]}>{item.quantity} {item.unit}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Categoria:</Text>
                    <Text style={styles.detailValue}>{item.category || 'Não definida'}</Text>
                </View>
                 <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Adicionado em:</Text>
                    <Text style={styles.detailValue}>{addedAtFormatted}</Text>
                </View>
                 <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Adicionado por:</Text>
                    <Text style={styles.detailValue}>{addedByFormatted}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Última Atualização:</Text>
                    <Text style={styles.detailValue}>{updatedAtFormatted}</Text>
                </View>
                 <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Atualizado por:</Text>
                    <Text style={styles.detailValue}>{lastUpdatedByFormatted}</Text>
                </View>
            </View>

             {/* Detalhes da Última Compra */}
             <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Última Compra Registrada</Text>
                 <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Data:</Text>
                    <Text style={styles.detailValue}>{lastPurchaseDateFormatted}</Text>
                </View>
                 <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Quantidade:</Text>
                    <Text style={styles.detailValue}>{lastPurchaseQuantityFormatted}</Text>
                </View>
                 <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Valor Total Pago:</Text>
                    <Text style={styles.detailValue}>{lastPurchaseValueFormatted}</Text>
                </View>
             </View>

            {/* Detalhes da Próxima Compra */}
             <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Planejamento Próxima Compra</Text>
                 <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Data Estimada:</Text>
                    <Text style={styles.detailValue}>{nextPurchaseDateFormatted}</Text>
                </View>
                 <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Valor Estimado:</Text>
                    <Text style={styles.detailValue}>{nextPurchaseValueFormatted}</Text>
                </View>
             </View>

            {/* Botões de Ação Futuros (Exemplo) */}
            {/*
            <View style={styles.actionButtons}>
                 <TouchableOpacity style={styles.buttonOutline} onPress={() => Alert.alert("Editar Item", "Implementar edição do inventário")}>
                    <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                    <Text style={[styles.buttonText, {color: colors.primary}]}> Editar Item</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.buttonOutline} onPress={() => Alert.alert("Excluir Item", "Implementar exclusão do inventário")}>
                     <Ionicons name="trash-outline" size={18} color={colors.error} />
                     <Text style={[styles.buttonText, {color: colors.error}]}> Excluir Item</Text>
                 </TouchableOpacity>
            </View>
            */}

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Estilos (similares ao TransactionDetailModal, adaptados)
const getStyles = (colors: any) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderRadius: 15,
    padding: 20, // Padding interno
    width: '90%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15, // Espaço abaixo do header
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flexShrink: 1, // Permite encolher se nome for longo
    marginRight: 10,
  },
  detailSection: {
      marginBottom: 15, // Espaço entre seções
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '50', // Linha divisória mais sutil
  },
  sectionTitle: {
      fontSize: 16,
      fontWeight: '600', // Semi-bold
      color: colors.primary, // Destaca título da seção
      marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8, // Espaço menor entre linhas dentro da seção
    alignItems: 'center', // Alinha verticalmente
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    width: '40%', // Ajusta largura do label
  },
  detailValue: {
    fontSize: 14, // Mesmo tamanho do label
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'right',
    fontWeight: '500', // Leve destaque no valor
  },
  quantityValue: { // Estilo específico para quantidade
      fontWeight: 'bold',
      fontSize: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  buttonOutline: { /* ... estilos como antes ... */ },
  buttonText: { /* ... estilos como antes ... */ }
});

export default InventoryItemDetailModal;