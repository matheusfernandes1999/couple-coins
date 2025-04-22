// components/dashboard/NoGroupView.tsx
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface NoGroupViewProps {
  newGroupName: string;
  inviteCode: string;
  isCreating: boolean;
  isJoining: boolean;
  onNewGroupNameChange: (text: string) => void;
  onInviteCodeChange: (text: string) => void;
  onCreateGroup: () => void;
  onJoinGroup: () => void;
}

const NoGroupView: React.FC<NoGroupViewProps> = ({
  newGroupName, inviteCode, isCreating, isJoining,
  onNewGroupNameChange, onInviteCodeChange, onCreateGroup, onJoinGroup
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <ScrollView contentContainerStyle={[styles.container, styles.centered]}>
      <Ionicons name="people-outline" size={60} color={colors.textSecondary} style={styles.noGroupIcon} />
      <Text style={styles.noGroupTitle}>Bem-vindo(a)!</Text>
      <Text style={styles.noGroupText}>
        Crie ou entre em um grupo familiar para gerenciar as finanças.
      </Text>

      <TextInput
        style={[styles.newGroupNameInput]}
        placeholder="Nome do Novo Grupo"
        placeholderTextColor={colors.placeholder}
        value={newGroupName}
        onChangeText={onNewGroupNameChange}
        editable={!isCreating && !isJoining}
      />

      <TouchableOpacity
        style={[styles.button, styles.createButton]}
        onPress={onCreateGroup}
        disabled={isCreating || isJoining || !newGroupName.trim()}
      >
        {isCreating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Criar Grupo</Text>}
      </TouchableOpacity>

      <Text style={styles.joinLabel}>Já tem um convite?</Text>
      <View style={styles.joinContainer}>
        <TextInput
          style={styles.input}
          placeholder="Código do Convite"
          placeholderTextColor={colors.placeholder}
          value={inviteCode}
          onChangeText={onInviteCodeChange}
          autoCapitalize="characters"
          editable={!isJoining && !isCreating}
        />
        <TouchableOpacity
          style={[styles.button, styles.joinButton]}
          onPress={onJoinGroup}
          disabled={isJoining || isCreating || !inviteCode.trim()}
        >
          {isJoining ? <ActivityIndicator color="#FFF" /> : <Ionicons name="arrow-forward" size={20} color="#FFF" />}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
   container: { flexGrow: 1, backgroundColor: colors.background },
   centered: { justifyContent: 'center', alignItems: 'center', padding: 20 },
   noGroupContainer: { paddingHorizontal: 30 },
   noGroupIcon: { marginBottom: 20 },
   noGroupTitle: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 10, textAlign: 'center' },
   noGroupText: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: 30, lineHeight: 22 },
   button: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 48, width: '100%', flexDirection: 'row' },
   newGroupNameInput: {
       backgroundColor: colors.surface,
       borderRadius: 8,
       paddingHorizontal: 15,
       fontSize: 16,
       color: colors.textPrimary,
       height: 48,
       borderWidth: 1,
       borderColor: colors.border,
       width: '100%',
       marginBottom: 15,
   },
   createButton: { backgroundColor: colors.primary, marginBottom: 25 },
   buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
   joinLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 10, marginTop: 10 },
   joinContainer: { flexDirection: 'row', alignItems: 'center', width: '100%' },
   input: { flex: 1, backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 15, fontSize: 16, color: colors.textPrimary, height: 48, borderWidth: 1, borderColor: colors.border, marginRight: 10 },
   joinButton: { backgroundColor: colors.success, paddingHorizontal: 15, width: 'auto' }
});

export default NoGroupView;