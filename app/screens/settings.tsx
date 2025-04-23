// app/settings.tsx
import React, { useState, useEffect, useLayoutEffect } from 'react'; // Adicionado useState, useEffect
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    TextInput, ActivityIndicator, Keyboard // Adicionado TextInput, ActivityIndicator, Alert, Keyboard
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '@/lib/firebase'; // Importar db e auth
import { doc, getDoc, setDoc } from 'firebase/firestore'; // Importar getDoc, setDoc, updateDoc
import { showMessage } from 'react-native-flash-message';
import GroupHeader from '@/components/dashboard/GroupHeader';

// Define o tipo para as opções de tema, incluindo ícone
type ThemeOption = {
    label: string;
    value: 'light' | 'dark' | 'system';
    icon: React.ComponentProps<typeof Ionicons>['name'];
};

export default function SettingsScreen() {
    const { themeMode, setThemeMode, colors } = useTheme();
    const navigation = useNavigation();

    // --- Estados Locais ---
    const [nameInput, setNameInput] = useState(''); // Input para o nome
    const [isLoadingName, setIsLoadingName] = useState(false); // Loading ao buscar nome inicial
    const [isSavingName, setIsSavingName] = useState(false); // Loading ao salvar nome
    // ---------------------

    // --- Busca Nome Atual ao Carregar ---
    useEffect(() => {
        const fetchUserName = async () => {
            if (auth.currentUser) {
                setIsLoadingName(true);
                const userDocRef = doc(db, "users", auth.currentUser.uid);
                try {
                    const docSnap = await getDoc(userDocRef);
                    if (docSnap.exists()) {
                        setNameInput(docSnap.data()?.displayName || ''); // Preenche com nome existente ou vazio
                    } else {
                        console.log("Documento do usuário não encontrado para preencher nome.");
                    }
                } catch (error) {
                    console.error("Erro ao buscar nome do usuário:", error);
                    // Não mostra alerta aqui, apenas não preenche
                } finally {
                    setIsLoadingName(false);
                }
            }
        };

        fetchUserName();
    }, [auth.currentUser]);
    
    useLayoutEffect(() => {
        navigation.setOptions({
            title: 'Configurações', // Título mais genérico agora
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { color: colors.textPrimary },
            headerShown: true // Garante que está visível
        });
    }, [navigation, colors]);

    const themeOptions: ThemeOption[] = [
        { label: 'Claro', value: 'light', icon: 'sunny-outline' },
        { label: 'Escuro', value: 'dark', icon: 'moon-outline' },
        { label: 'Padrão do Sistema', value: 'system', icon: 'settings-outline' },
    ];

    // --- Handler para Salvar Nome ---
    const handleSaveName = async () => {
        if (!auth.currentUser) {
            showMessage({
                message: "Ops!",
                description: "Você não está autenticado.",
                backgroundColor: colors.error,
                color: colors.textPrimary,
            });
            return;
        }
        const trimmedName = nameInput.trim();
        if (!trimmedName) {
            showMessage({
                message: "Ops!",
                description: "Por favor, digite um nome.",
                backgroundColor: colors.warning,
                color: colors.textPrimary,
            });
            return;
        }

        setIsSavingName(true);
        Keyboard.dismiss();
        const userDocRef = doc(db, "users", auth.currentUser.uid);

        try {
            // Usa setDoc com merge: true para criar o campo se não existir, ou atualizar se existir
            await setDoc(userDocRef, { displayName: trimmedName }, { merge: true });
            showMessage({
                message: "Oba!",
                description: "Seu nome foi atualizado!",
                backgroundColor: colors.success,
                color: colors.textPrimary,
            });
        } catch (error: any) {
            console.error("Erro ao salvar nome:", error);
            showMessage({
                message: "Ops!",
                description: "Não foi possível salvar seu nome: " + error.message,
                backgroundColor: colors.error,
                color: colors.textPrimary,
            });
        } finally {
            setIsSavingName(false);
        }
    };
    // -----------------------------


    // --- Estilos Dinâmicos ---
    const styles = getStyles(colors); // Gera estilos com as cores do tema
    // -------------------------


    return (
        <View style={styles.container}>
          <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">

              <Text style={styles.sectionTitle}>Seu Perfil</Text>
                 {isLoadingName ? (
                    <ActivityIndicator color={colors.primary} style={styles.loadingName}/>
                 ) : (
                    <>
                        <Text style={styles.label}>Nome Exibido</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Como você quer ser chamado(a)?"
                            placeholderTextColor={colors.placeholder}
                            value={nameInput}
                            onChangeText={setNameInput}
                            editable={!isSavingName} // Desabilita enquanto salva
                            textContentType="name" // Ajuda o teclado/autofill
                        />
                        <TouchableOpacity
                            style={[styles.saveButton, (isSavingName || !nameInput.trim()) && styles.saveButtonDisabled]}
                            onPress={handleSaveName}
                            disabled={isSavingName || !nameInput.trim()} // Desabilita se salvando ou vazio
                        >
                            {isSavingName
                                ? <ActivityIndicator color="#FFF" size="small"/>
                                : <Text style={styles.saveButtonText}>Salvar Nome</Text>
                            }
                        </TouchableOpacity>
                    </>
                 )}
                 
                <View style={{ marginVertical: 20 }}>
                    <GroupHeader />
                </View> 

                <Text style={styles.sectionTitle}>Aparência</Text>
                {themeOptions.map((option) => (
                    <TouchableOpacity
                        key={option.value}
                        style={[
                            styles.optionButton,
                            themeMode === option.value && styles.optionButtonSelected
                        ]}
                        onPress={() => setThemeMode(option.value)} // Define tema via contexto
                        activeOpacity={0.7}
                    >
                        <Ionicons name={option.icon} size={22} color={colors.textSecondary} style={styles.optionIcon} />
                        <Text style={styles.optionLabel}>{option.label}</Text>
                        {themeMode === option.value && (
                            <Ionicons name="checkmark-circle" size={24} color={colors.primary} style={styles.checkmarkIcon} />
                        )}
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

// --- Estilos ---
const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollView: {
        paddingVertical: 15, // Espaço no topo e embaixo do scroll
        paddingHorizontal: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 15,
        marginTop: 15, // Espaço acima de cada título de seção
        paddingBottom: 5,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    // Estilos Opções de Tema (como antes)
    optionButton: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
        paddingVertical: 15, paddingHorizontal: 20, borderRadius: 10,
        marginBottom: 10, borderWidth: 1, borderColor: colors.border // Adiciona borda padrão
    },
    optionButtonSelected: { borderColor: colors.primary, borderWidth: 2 },
    optionIcon: { marginRight: 15 },
    optionLabel: { fontSize: 16, color: colors.textPrimary, flex: 1 },
    checkmarkIcon: { marginLeft: 10 }, // Adiciona margem esquerda
    // Estilos Seção Perfil
    loadingName: {
        marginVertical: 20,
    },
     label: { // Reutilizado para Nome Exibido
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 5,
        // marginTop: 10, // Removido, sectionTitle já tem margem
    },
    input: { // Reutilizado para Nome Exibido
        backgroundColor: colors.surface,
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 16,
        color: colors.textPrimary,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 15, // Espaço antes do botão salvar
    },
     saveButton: {
        backgroundColor: colors.primary,
        paddingVertical: 12, // Um pouco menor
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 0, // Sem margem extra acima
     },
     saveButtonDisabled: {
         backgroundColor: colors.textSecondary,
         opacity: 0.7,
     },
     saveButtonText: {
         color: '#FFFFFF',
         fontSize: 16,
         fontWeight: 'bold',
     },
});