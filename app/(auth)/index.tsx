// app/(auth)/index.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth'; // Importa funções de auth
import { auth } from '@/lib/firebase'; // Importa a instância auth
import { showMessage } from "react-native-flash-message";

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // Para cadastro
  const [isLoading, setIsLoading] = useState(false); // Estado de carregamento
  const [isRegistering, setIsRegistering] = useState(false); // Controla se mostra campo de confirmar senha

  const { colors, effectiveTheme } = useTheme();

  const handleLogin = async () => {
    if (!email || !password) {
      showMessage({
        message: "Preencha todos os campos.",
        backgroundColor: colors.error,
        color: colors.textPrimary,
      });
      return;
    }
    setIsLoading(true);
    try {
      console.log('Tentando login com:', email);
      // O usuário será redirecionado pelo listener onAuthStateChanged no _layout.tsx
      await signInWithEmailAndPassword(auth, email, password);
      console.log('Login bem-sucedido (redirecionamento pelo listener)');
    } catch (error: any) {
      console.error("Erro no login:", error);
      let errorMessage = "Ocorreu um erro ao tentar fazer login.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          errorMessage = "E-mail ou senha inválidos.";
      } else if (error.code === 'auth/invalid-email') {
          errorMessage = "O formato do e-mail é inválido.";
      }
      showMessage({
        message: errorMessage,
        backgroundColor: colors.error,
        color: colors.textPrimary,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      showMessage({
        message: "Preencha todos os campos.",
        backgroundColor: colors.error,
        color: colors.textPrimary,
      });
      return;
    }
    if (password !== confirmPassword) {
      showMessage({
        message: "As senhas não coincidem.",  
        backgroundColor: colors.error,
        color: colors.textPrimary,
      });
      return;
    }
     if (password.length < 6) {
        showMessage({
          message: "A senha deve ter pelo menos 6 caracteres.",
          backgroundColor: colors.error,
          color: colors.textPrimary,
        });
        return;
     }

    setIsLoading(true);
    try {
      console.log('Tentando cadastrar com:', email);
      // O usuário será redirecionado pelo listener onAuthStateChanged no _layout.tsx
      await createUserWithEmailAndPassword(auth, email, password);
      console.log('Cadastro bem-sucedido (redirecionamento pelo listener)');
      showMessage({
        message: "^Conta criada com sucesso!",
        backgroundColor: colors.success,
        color: colors.textPrimary,
      });
    } catch (error: any) {
      console.error("Erro no cadastro:", error);
      let errorMessage = "Ocorreu um erro ao tentar criar a conta.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Este e-mail já está em uso.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "O formato do e-mail é inválido.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "A senha é muito fraca. Use pelo menos 6 caracteres.";
      }
      Alert.alert("Erro de Cadastro", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRegisterMode = () => {
     setIsRegistering(!isRegistering);
  }

  const styles = getStyles(colors, effectiveTheme);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.innerContainer}>
        <Text style={styles.title}>{isRegistering ? 'Crie sua Conta' : 'Bem-vindos!'}</Text>
        <Text style={styles.subtitle}>
           {isRegistering ? 'Preencha os dados para começar' : 'Organizem suas finanças juntos.'}
        </Text>

        {/* Input E-mail */}
        <View style={styles.inputContainer}>
           <Ionicons name="mail-outline" size={20} color={colors.icon} style={styles.inputIcon} />
           <TextInput
              style={styles.input} placeholder="E-mail"
              placeholderTextColor={colors.placeholder} value={email}
              onChangeText={setEmail} keyboardType="email-address"
              autoCapitalize="none" editable={!isLoading} // Desabilita enquanto carrega
            />
        </View>

        {/* Input Senha */}
        <View style={styles.inputContainer}>
           <Ionicons name="lock-closed-outline" size={20} color={colors.icon} style={styles.inputIcon} />
           <TextInput
             style={styles.input} placeholder="Senha"
             placeholderTextColor={colors.placeholder} value={password}
             onChangeText={setPassword} secureTextEntry editable={!isLoading}
            />
        </View>

        {/* Input Confirmar Senha (Apenas no modo Cadastro) */}
        {isRegistering && (
          <View style={styles.inputContainer}>
             <Ionicons name="lock-closed-outline" size={20} color={colors.icon} style={styles.inputIcon} />
             <TextInput
               style={styles.input} placeholder="Confirmar Senha"
               placeholderTextColor={colors.placeholder} value={confirmPassword}
               onChangeText={setConfirmPassword} secureTextEntry editable={!isLoading}
             />
          </View>
        )}

        {/* Botão Principal (Entrar ou Cadastrar) */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={isRegistering ? handleRegister : handleLogin}
          disabled={isLoading} // Desabilita enquanto carrega
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>{isRegistering ? 'Criar Conta' : 'Entrar'}</Text>
          )}
        </TouchableOpacity>

        {/* Botão Secundário (Alternar entre Login/Cadastro) */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={toggleRegisterMode}
          disabled={isLoading}
        >
          <Text style={styles.secondaryButtonText}>
             {isRegistering ? 'Já tem uma conta? Entrar' : 'Não tem uma conta? Cadastre-se'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors'], theme: ReturnType<typeof useTheme>['effectiveTheme']) => StyleSheet.create({
   container: { flex: 1, backgroundColor: colors.background },
   innerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
   title: { fontSize: 28, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 10, textAlign: 'center' },
   subtitle: { fontSize: 16, color: colors.textSecondary, marginBottom: 40, textAlign: 'center' },
   inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, marginBottom: 15, paddingHorizontal: 15, borderWidth: 1, borderColor: colors.border, width: '100%', height: 50 },
   inputIcon: { marginRight: 10 },
   input: { flex: 1, fontSize: 16, color: colors.textPrimary },
   primaryButton: { backgroundColor: colors.primary, paddingVertical: 15, borderRadius: 10, alignItems: 'center', width: '100%', marginTop: 20, minHeight: 50, justifyContent: 'center', opacity: 1 /* Define a opacidade padrão */ },
   primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
   secondaryButton: { marginTop: 25 },
   secondaryButtonText: { color: colors.primary, fontSize: 14 },
});