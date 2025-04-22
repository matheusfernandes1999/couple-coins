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
import { useTheme } from "@/context/ThemeContext"; 
import { Ionicons } from "@expo/vector-icons";
import { InventoryItemData } from "@/types";
import { doc, getDoc, Timestamp } from "firebase/firestore"; 
import { db } from "@/lib/firebase";

interface InventoryItemDetailModalProps {
  isVisible: boolean;
  onClose: () => void;
  item: InventoryItemData | null;
}

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
  const [addedByName, setAddedByName] = useState<string | null>(null);
  const [updatedByName, setUpdatedByName] = useState<string | null>(null);
  const [isLoadingNames, setIsLoadingNames] = useState(false);

  useEffect(() => {
    const fetchUserNames = async () => {
      if (!item) return;

      setIsLoadingNames(true); 
      setAddedByName(null); 
      setUpdatedByName(null);

      const promisesToFetch: Promise<void>[] = [];
      
      if (item.addedBy) {
        promisesToFetch.push(
          getDoc(doc(db, "users", item.addedBy))
            .then((docSnap) => {
              if (docSnap.exists()) {
                setAddedByName(
                  docSnap.data()?.displayName ||
                    `ID: ...${item.addedBy.slice(-5)}`
                );
              } else {
                setAddedByName(
                  `ID: ...${item.addedBy.slice(-5)} (não encontrado)`
                );
              }
            })
            .catch((err) => {
              console.error("Erro buscando nome 'addedBy':", err);
              setAddedByName(`ID: ...${item.addedBy.slice(-5)} (erro)`); 
            })
        );
      } else {
        setAddedByName("Desconhecido");
      }

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
        setUpdatedByName("N/A");
      }

      await Promise.all(promisesToFetch);
      if (item?.lastUpdatedBy && item?.lastUpdatedBy === item?.addedBy) {
        setUpdatedByName(
          (currentAddedName) =>
            currentAddedName ||
            `${item.lastUpdatedBy!.slice(-5)}`
        );
      }

      setIsLoadingNames(false);
    };

    if (isVisible && item) {
      fetchUserNames();
    }

    return () => {
      setAddedByName(null);
      setUpdatedByName(null);
      setIsLoadingNames(false);
    };
  }, [isVisible, item]);

  if (!item) {
    return null; 
  }

  const addedAtFormatted = formatDate(item.addedAt);
  const updatedAtFormatted = formatDate(item.updatedAt); 
  const lastPurchaseDateFormatted = formatDate(item.lastPurchaseDate);
  const nextPurchaseDateFormatted = formatDate(item.nextPurchaseDate);
  const lastPurchaseValueFormatted = formatCurrency(item.lastPurchaseValue);
  const nextPurchaseValueFormatted = formatCurrency(item.nextPurchaseValue);
  const lastPurchaseQuantityFormatted = item.lastPurchaseQuantity !== null ? item.lastPurchaseQuantity : "N/A";

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
      padding: 20, 
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
      marginBottom: 15,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textPrimary,
      flexShrink: 1,
      marginRight: 10,
    },
    detailSection: {
      marginBottom: 15, 
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + "50", 
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600", 
      color: colors.primary, 
      marginBottom: 12,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8, 
      alignItems: "center", 
    },
    detailLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      width: "40%", 
    },
    detailValue: {
      fontSize: 14, 
      color: colors.textPrimary,
      flex: 1,
      textAlign: "right",
      fontWeight: "500", 
    },
    quantityValue: {
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
