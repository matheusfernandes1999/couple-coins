// app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { GroupProvider } from '@/context/GroupContext';
import FlashMessage from "react-native-flash-message";
import * as Notifications from 'expo-notifications'; 
import { initializeNotifications } from '@/utils/NotificationManager'; 

function useProtectedRoutes(user: User | null) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Chama a função de inicialização do manager
    initializeNotifications().then(granted => {
        if (!granted) {
            console.log("Permissão não concedida, algumas funcionalidades podem ser limitadas.");
            // Poderia mostrar um feedback para o usuário aqui se quisesse
        }
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log("Usuário interagiu com a notificação:", response.notification.request.content.title);
      const data = response.notification.request.content.data;
      console.log("Dados da notificação:", data);

      // Exemplo: Navegar para uma tela específica baseada nos dados
       if (data?.type === 'inventoryReminder' && data?.itemId && data?.groupId) {
         console.log(`Navegando para o item de inventário: ${data.itemId} no grupo ${data.groupId}`);
         // Ajuste a rota conforme sua estrutura. Ex: Pode precisar do groupId.
         // Exemplo: router.push(`/inventory/${data.itemId}`); // Se for uma rota simples
         // Exemplo: router.push({ pathname: '/inventory/item', params: { itemId: data.itemId, groupId: data.groupId } });
       } else if (data?.screen) {
           console.log(`Navegando para a tela: ${data.screen}`);
           // CUIDADO: Valide o valor de data.screen por segurança
           // router.push(data.screen as any); // Use 'any' com cautela ou valide a rota
       }
    });

    // Listener: Notificação recebida com app aberto (opcional)
     const notificationListener = Notifications.addNotificationReceivedListener(notification => {
          console.log("Notificação Recebida (Foreground):", notification.request.content.title);
     });

    // Limpa os listeners ao desmontar
    return () => {
      Notifications.removeNotificationSubscription(responseListener);
      Notifications.removeNotificationSubscription(notificationListener);
    };
  }, [router]);

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';

    if (user && inAuthGroup) {
      //console.log(`Redirect Case 1: User logged in, but in auth group. Redirecting to /tabs/home`);
      router.replace('/(tabs)/home');
    }
    else if (!user && !inAuthGroup) {
      //console.log(`Redirect Case 2: User logged out, and not in auth group. Redirecting to /auth`);
      router.replace('/(auth)');
    }
    else {
      //console.log(`Redirect Case 3 or 4: No redirection needed.`);
    }
  }, [user, segments, router]);
}

function AppContent() {
  const { effectiveTheme, colors } = useTheme();
  const [user, setUser] = useState<User | null>(auth.currentUser); 
  const [authInitialized, setAuthInitialized] = useState(false);

   useEffect(() => {
     const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
       console.log('Auth State Changed:', currentUser?.uid || 'No user');
       setUser(currentUser);
       if (!authInitialized) {
          setAuthInitialized(true);
       }
     });
     return () => unsubscribe();
   }, []);

   useProtectedRoutes(user);

  if (!authInitialized) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
      <>
        <StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </>
    );
  }

export default function RootLayout() {
  const { colors } = useTheme();
  
  return (
    <ThemeProvider>
      <GroupProvider>
        <AppContent />
      </GroupProvider>
      <FlashMessage position="top" statusBarHeight={42} textStyle={{fontWeight: 'bold', textAlign: 'center'}} titleStyle={{ fontSize: 16, fontWeight: 'bold', textAlign: 'center'}} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
   loadingContainer: {
     flex: 1,
     justifyContent: 'center',
     alignItems: 'center',
   },
 });