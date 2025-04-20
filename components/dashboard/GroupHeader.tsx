// components/dashboard/GroupHeader.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Share,
    Alert,
    Keyboard,
    ActivityIndicator,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext'; 
import { useGroup } from '@/context/GroupContext';
import { db } from '@/lib/firebase';        
import { doc, updateDoc } from 'firebase/firestore';  

const GroupHeader: React.FC = () => {
  const { colors } = useTheme();
  const { groupId, groupData, isLoadingGroup, groupError } = useGroup();
  const styles = getStyles(colors);

  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (groupData && !isEditing) {
      setEditingName(groupData.groupName || ''); 
    }
  }, [groupData, isEditing]);

  const handleSave = async () => {
    if (!groupId || !editingName.trim()) {
      Alert.alert("Erro", "Nome inválido ou grupo não identificado.");
      return;
    }
    setIsSaving(true);
    Keyboard.dismiss(); 
    const groupDocRef = doc(db, "groups", groupId);
    try {
      await updateDoc(groupDocRef, { groupName: editingName.trim() });
      setIsEditing(false); 
      // Alert.alert("Sucesso", "Nome atualizado!"); // Opcional: Feedback visual (Toast seria melhor)
    } catch (e: any) {
      console.error("Error updating group name from GroupHeader:", e);
      Alert.alert("Erro", "Falha ao atualizar o nome do grupo: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingName(groupData?.groupName || '');
  };

  const handleShareCode = async () => {
    if (!groupData?.inviteCode) {
        Alert.alert("Info", "Código de convite não disponível.");
        return;
    }
    try {
      await Share.share({
        message: `Entre no nosso grupo familiar (${groupData.groupName || 'Sem nome'}) no App Finanças Casal! Use o código: ${groupData.inviteCode}`,
        title: 'Convite para Grupo Familiar'
      });
    } catch (error: any) {
      Alert.alert("Erro", "Não foi possível compartilhar o código: " + error.message);
    }
  };

  if (isLoadingGroup) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (groupError) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorText}>{groupError}</Text>
      </View>
    );
  }

  if (!groupData) {
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.textSecondary }}>Informações do grupo não disponíveis.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isEditing ? (
        <View style={styles.editGroupNameRow}>
          <TextInput
            style={styles.editGroupNameInput}
            value={editingName}
            onChangeText={setEditingName}
            placeholder="Nome do grupo"
            placeholderTextColor={colors.placeholder}
            autoFocus={true}
            editable={!isSaving}
          />
          <TouchableOpacity onPress={handleSave} style={styles.iconButton} disabled={isSaving}>
            {isSaving ? <ActivityIndicator size="small" color={colors.primary}/> : <Ionicons name="checkmark-circle" size={28} color={colors.success} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCancel} style={styles.iconButton} disabled={isSaving}>
            <Ionicons name="close-circle" size={28} color={colors.error} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.groupNameRow}>
          <Text style={styles.groupName} numberOfLines={1} ellipsizeMode="tail">
            Sua família: {groupData.groupName || "Grupo..."}
          </Text>
          <TouchableOpacity
            onPress={() => { setEditingName(groupData.groupName || ''); setIsEditing(true); }}
            style={styles.iconButton}
          >
            <Ionicons name="pencil-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inviteCodeRow}>
        <Text style={styles.inviteCodeLabel}>Código de convite:</Text>
        <Text style={styles.inviteCodeValue}>{groupData.inviteCode || 'N/A'}</Text>
        {groupData.inviteCode && (
          <TouchableOpacity onPress={handleShareCode} style={[styles.iconButton, styles.shareIcon]}>
            <Ionicons name="share-social-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// --- Estilos ---
const getStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    width: '100%',
    padding: 15,
    marginHorizontal: 15, // Apenas horizontal se não for o primeiro elemento
    marginTop: 15, // Margem superior
    marginBottom: 5, // Margem inferior pequena antes do próximo resumo
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000", // Sombra sutil
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100, // Altura mínima durante loading
  },
  errorContainer: {
    borderColor: colors.error,
    padding: 10,
    alignItems: 'center',
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    fontSize: 14,
  },
  groupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  editGroupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  groupName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 5,
  },
  editGroupNameInput: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: colors.primary,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    fontSize: 18,
    color: colors.textPrimary,
    marginRight: 10,
  },
  iconButton: {
    padding: 5,
    marginLeft: 10,
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  inviteCodeLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 5,
  },
  inviteCodeValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: 'bold',
    flexShrink: 1,
    marginRight: 5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  shareIcon: {
    marginLeft: 'auto',
  },
});

export default GroupHeader;