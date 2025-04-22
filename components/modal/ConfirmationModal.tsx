// components/common/ConfirmationModal.tsx
import React from 'react';
import {
    View, Text, Modal, StyleSheet, TouchableOpacity,
    TouchableWithoutFeedback, Platform // Importa TouchableWithoutFeedback
} from 'react-native';
import { useTheme } from '../../context/ThemeContext'; // Ajuste o caminho
import { Ionicons } from '@expo/vector-icons';

interface ConfirmationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: () => void; // Função a ser executada ao confirmar
  title: string;
  message: string;
  confirmButtonText?: string; // Texto customizável (default: Confirmar)
  cancelButtonText?: string;  // Texto customizável (default: Cancelar)
  confirmButtonColor?: string; // Cor customizável para texto do botão de confirmação
  isDestructive?: boolean; // Indica se a ação é destrutiva (usa cor de erro)
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isVisible,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText = "Confirmar",
  cancelButtonText = "Cancelar",
  confirmButtonColor, // Cor específica passada
  isDestructive = false, // Default não é destrutivo
}) => {
  const { colors } = useTheme(); // Pega cores do tema
  const styles = getStyles(colors); // Gera estilos

  // Define a cor do botão de confirmação (vermelho se destrutivo, primária senão, ou customizada)
  const finalConfirmColor = confirmButtonColor
    ? confirmButtonColor
    : isDestructive
    ? colors.error
    : colors.primary;

  const handleConfirm = () => {
    onConfirm(); // Executa a ação passada
    // onClose(); // O componente pai pode decidir fechar ou não após confirmar
    // É melhor que o onConfirm feche se necessário
  };

  return (
    <Modal
      animationType="slide" // Animação de baixo para cima
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose} // Fecha com botão voltar (Android)
    >
      {/* Overlay para fechar ao tocar fora */}
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose} // Fecha ao tocar no overlay
      >
        {/* Container que evita fechar ao tocar DENTRO do conteúdo */}
        <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
                {/* Título */}
                <Text style={styles.titleText}>{title}</Text>
                {/* Mensagem */}
                <Text style={styles.messageText}>{message}</Text>

                {/* Botões */}
                <View style={styles.buttonContainer}>
                    {/* Botão Cancelar */}
                    <TouchableOpacity
                        style={[styles.button, styles.cancelButton]}
                        onPress={onClose}
                    >
                        <Text style={[styles.buttonText, styles.cancelButtonText]}>{cancelButtonText}</Text>
                    </TouchableOpacity>
                    {/* Botão Confirmar */}
                    <TouchableOpacity
                        style={[styles.button, styles.confirmButton, isDestructive && { backgroundColor: finalConfirmColor }]}
                        onPress={handleConfirm}
                    >
                        <Text style={[styles.buttonText, styles.confirmButtonText, !isDestructive && { color: finalConfirmColor } ]}>
                            {confirmButtonText}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
};

// Estilos para o modal bottom sheet
const getStyles = (colors: any) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end', // Alinha na base
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: colors.bottomSheet, // Cor de fundo do tema
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 25,
    paddingTop: 25,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30, // Padding inferior maior
    // Não define altura fixa, deixa o conteúdo determinar
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  titleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 15,
  },
  messageText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 25, // Mais espaço antes dos botões
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Ou 'space-around'
  },
  button: {
    flex: 1, // Ocupa espaço dividido
    paddingVertical: 14, // Botões maiores
    borderRadius: 10, // Mais arredondado
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5, // Espaço entre botões
    borderWidth: 1, // Adiciona borda sutil
  },
  cancelButton: {
    backgroundColor: colors.surface, // Fundo sutil
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.textSecondary, // Texto secundário
  },
  confirmButton: {
     backgroundColor: colors.surface, // Fundo padrão (muda se destrutivo)
     borderColor: colors.border,
  },
  confirmButtonText: {
      // Cor definida inline baseada em props
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold', // Negrito nos botões
  },
});

export default ConfirmationModal;