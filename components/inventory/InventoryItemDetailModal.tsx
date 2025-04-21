// components/inventory/InventoryItemDetailModal.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../../context/ThemeContext"; // Ajuste o caminho
import { Ionicons } from "@expo/vector-icons";
import { InventoryItemData } from "@/types"; // Ajuste o caminho
import { doc, getDoc, Timestamp } from "firebase/firestore"; // Para checagem de tipo
import { db } from "@/lib/firebase";

interface InventoryItemDetailModalProps {
  isVisible: boolean;
  onClose: () => void;
  item: InventoryItemData | null;
}

// Função auxiliar para formatar datas ou retornar 'N/A'
const formatDate = (timestamp: Timestamp | null | undefined): string => {
  if (timestamp && typeof timestamp.toDate === "function") {
    return timestamp.toDate().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  return "N/A";
};

// Função auxiliar para formatar valores monetários ou retornar 'N/A'
const formatCurrency = (value: number | null | undefined): string => {
  if (value !== undefined && value !== null) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
  return "N/A";
};

const InventoryItemDetailModal: React.FC<InventoryItemDetailModalProps> = ({
  isVisible,
  onClose,
  item,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  // --- Estados para Nomes Buscados ---
  const [addedByName, setAddedByName] = useState<string | null>(null);
  const [updatedByName, setUpdatedByName] = useState<string | null>(null);
  const [isLoadingNames, setIsLoadingNames] = useState(false);
  // -----------------------------------

  // --- Efeito para Buscar Nomes ---
  useEffect(() => {
    // Função async interna para buscar os nomes
    const fetchUserNames = async () => {
      if (!item) return; // Sai se não há item

      setIsLoadingNames(true); // Inicia loading dos nomes
      setAddedByName(null); // Reseta nomes anteriores
      setUpdatedByName(null);

      const promisesToFetch: Promise<void>[] = []; // Array para promises de busca

      // 1. Busca nome de quem adicionou (addedBy)
      if (item.addedBy) {
        promisesToFetch.push(
          getDoc(doc(db, "users", item.addedBy))
            .then((docSnap) => {
              if (docSnap.exists()) {
                setAddedByName(
                  docSnap.data()?.displayName ||
                    `ID: ...${item.addedBy.slice(-5)}`
                ); // Usa nome ou fallback ID
              } else {
                setAddedByName(
                  `ID: ...${item.addedBy.slice(-5)} (não encontrado)`
                ); // Fallback ID
              }
            })
            .catch((err) => {
              console.error("Erro buscando nome 'addedBy':", err);
              setAddedByName(`ID: ...${item.addedBy.slice(-5)} (erro)`); // Fallback ID com erro
            })
        );
      } else {
        setAddedByName("Desconhecido"); // Se não houver addedBy ID
      }

      // 2. Busca nome de quem atualizou por último (lastUpdatedBy)
      // Só busca se existir E for diferente de quem adicionou (evita busca duplicada)
      if (item.lastUpdatedBy && item.lastUpdatedBy !== item.addedBy) {
        promisesToFetch.push(
          getDoc(doc(db, "users", item.lastUpdatedBy))
            .then((docSnap) => {
              if (docSnap.exists()) {
                setUpdatedByName(
                  docSnap.data()?.displayName ||
                    `ID: ...${item.lastUpdatedBy!.slice(-5)}`
                );
              } else {
                setUpdatedByName(
                  `ID: ...${item.lastUpdatedBy!.slice(-5)} (não encontrado)`
                );
              }
            })
            .catch((err) => {
              console.error("Erro buscando nome 'lastUpdatedBy':", err);
              setUpdatedByName(
                `ID: ...${item.lastUpdatedBy!.slice(-5)} (erro)`
              );
            })
        );
      } else if (item.lastUpdatedBy && item.lastUpdatedBy === item.addedBy) {
        // Se for a mesma pessoa, reutiliza o nome já buscado (ou a buscar)
        // Não precisa de outra promise, mas definimos o estado após a primeira busca terminar
      } else {
        setUpdatedByName("N/A"); // Se não houve atualização ainda
      }

      // Espera todas as buscas terminarem
      await Promise.all(promisesToFetch);

      // Se updatedBy era o mesmo que addedBy, copia o nome após a busca principal
      if (item?.lastUpdatedBy && item?.lastUpdatedBy === item?.addedBy) {
        // Usa uma função no setState para garantir que está usando o valor mais recente de addedByName
        setUpdatedByName(
          (currentAddedName) =>
            currentAddedName ||
            `${item.lastUpdatedBy!.slice(-5)}`
        );
      }

      setIsLoadingNames(false); // Finaliza loading dos nomes
    };

    // Chama a busca apenas se o modal estiver visível e tiver um item
    if (isVisible && item) {
      fetchUserNames();
    }

    // Limpa nomes se modal fechar ou item mudar (antes de buscar novos)
    return () => {
      setAddedByName(null);
      setUpdatedByName(null);
      setIsLoadingNames(false);
    };
  }, [isVisible, item]);

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
  const lastPurchaseQuantityFormatted =
    item.lastPurchaseQuantity !== null ? item.lastPurchaseQuantity : "N/A";

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
              <Text style={styles.modalTitle}>
                {item.name || "Detalhes do Item"}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons
                  name="close-circle"
                  size={28}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Detalhes do Inventário */}
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Informações Atuais</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Quantidade:</Text>
                <Text style={[styles.detailValue, styles.quantityValue]}>
                  {item.quantity} {item.unit}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Categoria:</Text>
                <Text style={styles.detailValue}>
                  {item.category || "Não definida"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Adicionado em:</Text>
                <Text style={styles.detailValue}>{addedAtFormatted}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Adicionado por:</Text>
                <Text style={styles.detailValue}>
                  {isLoadingNames ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.textSecondary}
                    />
                  ) : (
                    <Text style={styles.detailValue}>
                      {addedByName || "Carregando..."}
                    </Text>
                  )}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Última Atualização:</Text>
                <Text style={styles.detailValue}>{updatedAtFormatted}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Atualizado por:</Text>
                <Text style={styles.detailValue}>
                  {
                    isLoadingNames ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.textSecondary}
                      />
                    ) : (
                      <Text style={styles.detailValue}>
                        {updatedByName ||
                          (addedByName === item.lastUpdatedBy
                            ? addedByName
                            : "N/A")}
                      </Text>
                    ) 
                  }
                </Text>
              </View>
            </View>

            {/* Detalhes da Última Compra */}
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Última Compra Registrada</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Data:</Text>
                <Text style={styles.detailValue}>
                  {lastPurchaseDateFormatted}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Quantidade:</Text>
                <Text style={styles.detailValue}>
                  {lastPurchaseQuantityFormatted}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Valor Total Pago:</Text>
                <Text style={styles.detailValue}>
                  {lastPurchaseValueFormatted}
                </Text>
              </View>
            </View>

            {/* Detalhes da Próxima Compra */}
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>
                Planejamento Próxima Compra
              </Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Data Estimada:</Text>
                <Text style={styles.detailValue}>
                  {nextPurchaseDateFormatted}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Valor Estimado:</Text>
                <Text style={styles.detailValue}>
                  {nextPurchaseValueFormatted}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Estilos (similares ao TransactionDetailModal, adaptados)
const getStyles = (colors: any) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.6)",
    },
    modalContainer: {
      backgroundColor: colors.bottomSheet,
      borderRadius: 15,
      padding: 20, // Padding interno
      width: "90%",
      maxHeight: "85%",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 15, // Espaço abaixo do header
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textPrimary,
      flexShrink: 1, // Permite encolher se nome for longo
      marginRight: 10,
    },
    detailSection: {
      marginBottom: 15, // Espaço entre seções
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + "50", // Linha divisória mais sutil
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600", // Semi-bold
      color: colors.primary, // Destaca título da seção
      marginBottom: 12,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8, // Espaço menor entre linhas dentro da seção
      alignItems: "center", // Alinha verticalmente
    },
    detailLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      width: "40%", // Ajusta largura do label
    },
    detailValue: {
      fontSize: 14, // Mesmo tamanho do label
      color: colors.textPrimary,
      flex: 1,
      textAlign: "right",
      fontWeight: "500", // Leve destaque no valor
    },
    quantityValue: {
      // Estilo específico para quantidade
      fontWeight: "bold",
      fontSize: 15,
    },
    actionButtons: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginTop: 20,
      paddingTop: 15,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  });

export default InventoryItemDetailModal;
