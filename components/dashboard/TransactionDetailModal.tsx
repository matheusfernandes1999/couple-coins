// components/dashboard/TransactionDetailModal.tsx
import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext'; // Ajuste o caminho
import { Ionicons } from '@expo/vector-icons';
import { Transaction } from '@/types'; // Ajuste o caminho se necessário

// Interface para as props do componente
interface TransactionDetailModalProps {
  isVisible: boolean;              // Controla a visibilidade do modal
  onClose: () => void;             // Função para fechar o modal
  transaction: Transaction | null; // A transação a ser exibida (ou null)
  onEdit: (transaction: Transaction) => void; // Função chamada ao clicar em Editar
  onDelete: (transactionId: string) => void; // Função chamada ao confirmar Excluir
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isVisible,
  onClose,
  transaction,
  onEdit,
  onDelete
}) => {
  const { colors } = useTheme(); // Hook para acessar as cores do tema
  const styles = getStyles(colors); // Gera os estilos com as cores do tema

  // Se não há transação para exibir, não renderiza nada (ou poderia mostrar um placeholder)
  if (!transaction) {
    return null;
  }

  // --- Handlers para os Botões de Ação ---
  const handleEditPress = () => {
    // Simplesmente chama a função onEdit passada por props,
    // passando a transação atual para que o componente pai (HomeScreen)
    // saiba qual transação abrir no modal de edição.
    onEdit(transaction);
  };

  const handleDeletePress = () => {
    // Mostra um alerta de confirmação antes de executar a exclusão
    Alert.alert(
      "Confirmar Exclusão", // Título do Alerta
      "Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.", // Mensagem
      [
        // Botão 1: Cancelar
        {
          text: "Cancelar",
          style: "cancel" // Estilo padrão para cancelar
        },
        // Botão 2: Excluir (executa a função onDelete)
        {
          text: "Excluir",
          style: "destructive", // Estilo que indica ação destrutiva (vermelho no iOS)
          // Chama a função onDelete passada por props com o ID da transação
          onPress: () => onDelete(transaction.id)
        }
      ]
    );
  };
  // ---------------------------------------

  // --- Formatação de Dados para Exibição ---
  const valueColor = transaction.type === 'income' ? colors.success : colors.error;
  const valueSign = transaction.type === 'income' ? '+' : '-';
  // Formata data e hora usando opções de localização para pt-BR
  const formattedDate = transaction.date.toDate().toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  const formattedTime = transaction.date.toDate().toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit'
  });
  // Formata a data de criação (se existir)
  const formattedCreatedAt = transaction.createdAt?.toDate().toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) || 'Não disponível';
  // Exemplo: Exibe apenas parte do ID do usuário (poderia buscar o nome no futuro)
  const registeredBy = `Usuário ID: ...${transaction.userId.slice(-5)}`;
  // ---------------------------------------

  return (
    <Modal
      animationType="fade" // Animação suave de fade
      transparent={true}     // Fundo da tela visível através do overlay
      visible={isVisible}    // Controlado pelo estado do HomeScreen
      onRequestClose={onClose} // Handler para o botão "Voltar" do Android
    >
      {/* Overlay escurecido */}
      <View style={styles.modalOverlay}>
        {/* Container do conteúdo do modal */}
        <View style={styles.modalContainer}>
          <ScrollView>
            {/* Cabeçalho do Modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalhes da Transação</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Seção de Detalhes */}
            <View style={styles.detailSection}>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Tipo:</Text>
                    <Text style={[styles.detailValue, { color: valueColor, fontWeight: 'bold' }]}>
                        {transaction.type === 'income' ? 'Entrada' : 'Saída'}
                    </Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Valor:</Text>
                    <Text style={[styles.detailValue, { color: valueColor, fontWeight: 'bold' }]}>
                        {valueSign} {transaction.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Categoria:</Text>
                    <Text style={styles.detailValue}>{transaction.category}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Data:</Text>
                    <Text style={styles.detailValue}>{formattedDate} às {formattedTime}</Text>
                </View>
                {/* Mostra descrição apenas se existir */}
                {transaction.description && (
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Descrição:</Text>
                        <Text style={[styles.detailValue, styles.descriptionText]}>{transaction.description}</Text>
                    </View>
                )}
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Registrado por:</Text>
                    <Text style={styles.detailValue}>{registeredBy}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Registrado em:</Text>
                    <Text style={styles.detailValue}>{formattedCreatedAt}</Text>
                </View>
            </View>

            {/* Botões de Ação */}
            <View style={styles.actionButtons}>
                 {/* Botão Editar */}
                 <TouchableOpacity style={[styles.buttonOutline, { borderColor: colors.primary }]} onPress={handleEditPress}>
                    <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                    <Text style={[styles.buttonText, { color: colors.primary }]}> Editar</Text>
                 </TouchableOpacity>
                 {/* Botão Excluir */}
                 <TouchableOpacity style={[styles.buttonOutline, { borderColor: colors.error }]} onPress={handleDeletePress}>
                     <Ionicons name="trash-outline" size={18} color={colors.error} />
                     <Text style={[styles.buttonText, { color: colors.error }]}> Excluir</Text>
                 </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Estilos para o Modal de Detalhes
const getStyles = (colors: any) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Fundo mais escuro
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderRadius: 15,
    paddingVertical: 20, // Padding vertical geral
    paddingHorizontal: 25, // Padding horizontal geral
    width: '90%',
    maxHeight: '80%',
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
    marginBottom: 20, // Aumenta espaço abaixo do header
    paddingBottom: 10, // Padding abaixo da linha
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  detailSection: {
    marginBottom: 20, // Espaço antes dos botões
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12, // Espaçamento entre linhas de detalhe
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary, // Cor secundária para labels
    marginRight: 10,
    width: '35%', // Garante alinhamento
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 15,
    color: colors.textPrimary,
    flex: 1, // Ocupa o resto
    textAlign: 'right',
  },
  descriptionText: { // Estilo específico para descrição longa
      textAlign: 'left', // Alinha à esquerda se quebrar linha
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around', // Espaça os botões igualmente
    marginTop: 15, // Espaço acima dos botões
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  buttonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10, // Aumenta padding vertical
    paddingHorizontal: 20, // Aumenta padding horizontal
    borderWidth: 1.5, // Borda um pouco mais grossa
    borderRadius: 8,
    // borderColor é definido inline agora
  },
  buttonText: {
    fontSize: 15, // Tamanho ligeiramente maior
    fontWeight: 'bold', // Mais destaque
    marginLeft: 6, // Espaço após o ícone
    // color é definido inline
  }
});

export default TransactionDetailModal;