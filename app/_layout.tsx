// app/_layout.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react'; // Import useRef, useCallback
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet, Text, Platform, AppState, Alert } from 'react-native'; // Import Platform, AppState, Text, Alert
import { ThemeProvider, useTheme } from '../context/ThemeContext'; // Ajuste o caminho
import { GroupProvider, useGroup } from '../context/GroupContext';   // Importa GroupProvider e useGroup (ajuste o caminho)
import { onAuthStateChanged, User } from 'firebase/auth'; // Necessário para tipo User
import { auth, db } from '../lib/firebase'; // Ajuste o caminho
import FlashMessage, { showMessage } from "react-native-flash-message"; // Para mensagens
// --- Importações para Notificações ---
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants'; // Para projectId
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { BillReminder } from '@/types'; // Ajuste o caminho
import { Ionicons } from '@expo/vector-icons';
// Removido: initializeNotifications - Lógica integrada aqui ou chamar funções específicas

// --- Configuração do Handler de Notificação ---
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true, // Ou false se não quiser badge
    }),
});
// ------------------------------------------

// --- Função para Registrar Push Token e Permissões ---
// (Pode mover para utils/NotificationManager.ts)
async function registerForPushNotificationsAsync(): Promise<boolean> {
  let token;
  try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Permissão de notificação não concedida!');
        // showMessage para aviso não intrusivo
         showMessage({ message: "Lembretes Desativados", description: "Permita notificações para receber lembretes de contas.", type: "warning", duration: 4000 });
        return false; // Permissão não concedida
      }
      // --- Opcional: Obter Expo Push Token ---
       // token = (await Notifications.getExpoPushTokenAsync({
       //     projectId: Constants.expoConfig?.extra?.eas?.projectId,
       // })).data;
       // console.log("Expo Push Token:", token);
       // ------------------------------------

       // --- Configuração Canais Android ---
       if (Platform.OS === 'android') {
           // Canal para Contas
           await Notifications.setNotificationChannelAsync('bill-reminders', {
             name: 'Lembretes de Contas',
             importance: Notifications.AndroidImportance.MAX, // Alta prioridade
             vibrationPattern: [0, 300, 200, 300], // Padrão vibração
             lightColor: '#3498DB', // Cor luz
             sound: 'default',
           });
           console.log("[Notifications] Channel 'bill-reminders' ensured.");
           // Adicione outros canais se necessário (ex: 'inventory-reminders')
       }
       return true; // Permissão concedida

  } catch (error) {
       console.error("Erro ao registrar para notificações:", error);
        Alert.alert("Erro de Notificação", "Não foi possível configurar os lembretes.");
       return false;
  }
}
// ----------------------------------------------------

// --- Função para Agendar Notificações de Contas ---
// (Pode mover para utils/NotificationManager.ts e importar)
const scheduleBillNotifications = async (groupId: string) => {
    if (!groupId) return; // Sai se não tem grupo
    console.log(`[Notifications] Scheduling bill reminders for group ${groupId}...`);

    // 1. Busca Contas Pendentes Futuras
    const now = new Date();
    const startTimestamp = Timestamp.fromDate(now); // A partir de agora
    let billsToSchedule: BillReminder[] = [];

    try {
        const billsQuery = query(
            collection(db, "groups", groupId, "bills"),
            where("isPaid", "==", false),        // Apenas não pagas
            where("dueDate", ">=", startTimestamp) // Apenas com vencimento futuro
        );
        const snapshot = await getDocs(billsQuery);
        snapshot.forEach(doc => {
             const data = doc.data();
             // Validação mais robusta
             if(data.name && typeof data.amount === 'number' && data.dueDate instanceof Timestamp && data.notificationDaysBefore !== undefined && data.notificationDaysBefore >= 0) {
                  billsToSchedule.push({ id: doc.id, ...data } as BillReminder);
             } else { console.warn(`[Notifications] Bill ${doc.id} skipped due to invalid data for scheduling.`); }
        });
        console.log(`[Notifications] Found ${billsToSchedule.length} pending future bills.`);

    } catch (error) { console.error("[Notifications] Error fetching bills:", error); return; }

    // 2. Cancela Agendamentos ANTERIORES deste tipo e grupo
    try {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        let cancelledCount = 0;
        const cancelPromises: Promise<void>[] = [];
        for (const notification of scheduled) {
            // Identificador deve ser único e previsível para permitir cancelamento
            // Usar padrão: `bill-reminder-${groupId}-${billId}`
            if (notification.identifier?.startsWith(`bill-reminder-${groupId}-`)) {
                cancelPromises.push(Notifications.cancelScheduledNotificationAsync(notification.identifier));
                cancelledCount++;
            }
        }
        await Promise.all(cancelPromises); // Cancela em paralelo
        if(cancelledCount > 0) console.log(`[Notifications] Cancelled ${cancelledCount} old bill reminders.`);
    } catch (error) { console.error("[Notifications] Error cancelling old notifications:", error); }

    // 3. Agenda Novas Notificações
    let scheduledCount = 0;
    const schedulePromises: Promise<string | null>[] = []; // Guarda IDs das notificações agendadas

    for (const bill of billsToSchedule) {
        try {
            const dueDate = bill.dueDate.toDate();
            const notifyDaysBefore = bill.notificationDaysBefore ?? 0; // Default 0 dias antes

            const notificationDate = new Date(dueDate);
            notificationDate.setDate(dueDate.getDate() - notifyDaysBefore);
            notificationDate.setHours(9, 0, 0, 0); // Agenda para 9:00 AM do dia calculado

            // Só agenda se a data calculada for no futuro
            if (notificationDate > now) {
                const identifier = `bill-reminder-${groupId}-${bill.id}`; // Identificador único

                const schedulingOptions = {
                    identifier: identifier,
                    content: {
                        title: '⏰ Lembrete de Conta!',
                        body: `"${bill.name}" vence em ${dueDate.toLocaleDateString('pt-BR')} (${(bill.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`,
                        data: { screen: 'recurring', billId: bill.id, groupId: groupId },
                        sound: true,
                        priority: Notifications.AndroidNotificationPriority.HIGH, // Para Android
                    },
                    trigger: {
                        date: notificationDate, // Gatilho por data/hora
                        channelId: 'bill-reminders', // Canal Android
                    },
                };

                 console.log(`[Notifications] Scheduling: ID=${identifier} for ${notificationDate.toLocaleString('pt-BR')}`);
                 // Adiciona a promise de agendamento
                schedulePromises.push(Notifications.scheduleNotificationAsync(schedulingOptions));
                scheduledCount++;
            } else {
                 // console.log(`[Notifications] Notification date for bill ${bill.id} is in the past, skipping.`);
            }
        } catch (scheduleError) {
            console.error(`[Notifications] Error preparing schedule for bill ${bill.id}:`, scheduleError);
        }
    } // Fim do loop for

    try {
       await Promise.all(schedulePromises); // Espera todos os agendamentos terminarem
       console.log(`[Notifications] Successfully scheduled ${scheduledCount} new bill reminders.`);
    } catch (err) {
        console.error("[Notifications] Error during batch scheduling:", err)
    }
};
// ---------------------------------------------


// --- Hook de Rotas Protegidas ATUALIZADO ---
function useProtectedRoutes() {
  const segments = useSegments();
  const router = useRouter();
  // Obtém usuário e loading do CONTEXTO (fonte única da verdade)
  const { isLoadingGroup, groupId } = useGroup();

  // --- Efeito para Notificações e Permissões ---
   useEffect(() => {
        console.log("[Notifications] Setting up permission request and listeners in useProtectedRoutes...");
        // Pede permissão (a função interna evita pedir múltiplas vezes)
        registerForPushNotificationsAsync().then(granted => {
            if (!granted) {
                console.warn("Permissão de notificação não concedida pelo usuário.");
                // Pode mostrar um aviso não bloqueante se desejar
                // showMessage({ message: "Ative notificações para receber lembretes!", type: "warning"});
            }
        });

        // Listener para RESPOSTA (clique) na notificação
        const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
            console.log("[Notifications] Response received:", response.notification.request.content.data);
            const data = response.notification.request.content.data;
            // Exemplo de navegação (PRECISA AJUSTAR ROTA E LÓGICA)
            if (data?.screen === 'recurring' && data?.groupId && data?.billId) {
                console.log(`Attempting navigation to ${data.screen} for bill ${data.billId}`);
                // Tenta navegar (pode precisar ajustar rota ou usar deeplink)
                 router.push('/screens/recurring'); // Exemplo simples, idealmente navegaria para o item
                 Alert.alert("Lembrete Clicado", `Abrir detalhes da conta "${response.notification.request.content.body?.split('"')[1] || 'Conta'}"? (Implementar navegação específica)`);
            }
        });

        // Listener para notificação recebida com app em PRIMEIRO PLANO (opcional)
        const receivedSub = Notifications.addNotificationReceivedListener(notification => {
            console.log("[Notifications] Received (foreground):", notification.request.content.title);
             // Pode exibir uma mensagem in-app usando FlashMessage
             // showMessage({ message: notification.request.content.title || "Notificação", description: notification.request.content.body || "", type: "info" });
        });

        // Limpa listeners ao desmontar o hook/componente
        return () => {
            console.log("[Notifications] Removing listeners.");
            Notifications.removeNotificationSubscription(responseSub);
            Notifications.removeNotificationSubscription(receivedSub);
        };
   }, [router]); // Depende do router para navegação

   // --- Efeito para Redirecionamento de Rota ---
   useEffect(() => {
    // Espera o contexto do grupo (que inclui auth state) carregar
    if (isLoadingGroup) {
        console.log("useProtectedRoutes: Waiting for group context...");
        return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const currentPath = segments.join('/') || '/';
    const isLoggedIn = !!auth.currentUser; // Usa usuário do contexto

    console.log(`useProtectedRoutes Check: UserLoggedIn=${isLoggedIn}, Path='${currentPath}', InAuthGroup=${inAuthGroup}`);

    // Caso 1: Logado, mas na tela de Auth -> Vai pro App
    if (isLoggedIn && inAuthGroup) {
      console.log(`Redirect Case 1: Logged in, in auth group -> /tabs/home`);
      router.replace('/(tabs)/home');
    }
    // Caso 2: Deslogado, mas fora da tela de Auth -> Vai pro Login
    else if (!isLoggedIn && !inAuthGroup) {
       // Verifica se não está já em alguma rota pública ou na raiz ''
       // (Adapte essa lógica se tiver mais rotas públicas)
       const isPublicRoute = currentPath === '/'; // Exemplo, permita apenas a raiz
       if (!isPublicRoute) {
            console.log(`Redirect Case 2: Logged out, trying protected route '${currentPath}' -> /auth`);
            router.replace('/(auth)');
       }
    }
    // Outros casos: Logado e fora do Auth OU Deslogado e no Auth -> OK
    else { console.log(`Redirect Case 3 or 4: No redirection needed.`); }

  }, [auth.currentUser, isLoadingGroup, segments, router]); // Depende do usuário reativo, loading e rota

  // --- Efeito para AppState (Agenda/Reagenda Notificações) ---
  useEffect(() => {
        console.log("[AppState] Setting up listener...");
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                console.log('[AppState] App came to foreground!');
                // Reagenda notificações QUANDO volta ao foreground e TEM groupId
                if (groupId) {
                     console.log("[AppState] Scheduling notifications on foreground...");
                     scheduleBillNotifications(groupId).catch(console.error);
                 } else {
                     console.log("[AppState] No groupId to schedule notifications on foreground.");
                 }
            }
        });
        return () => { console.log("[AppState] Listener removed."); subscription.remove(); };
    }, [groupId]); // Depende do groupId para poder agendar ao voltar

    // --- Efeito para Agendamento Inicial/Troca de Grupo ---
    useEffect(() => {
        // Agenda notificações assim que o groupId estiver disponível E o loading terminar
        if (groupId && !isLoadingGroup) {
             console.log(`[Notifications] GroupId available: ${groupId}. Scheduling initial notifications...`);
             scheduleBillNotifications(groupId).catch(console.error);
         } else if (!groupId && !isLoadingGroup){
             // Se usuário está carregado mas NÃO tem grupo (ou deslogou), cancela notificações
             console.log("[Notifications] GroupId is null/undefined after load. Cancelling all scheduled notifications.");
             Notifications.cancelAllScheduledNotificationsAsync() // Cancela TUDO do app
                 .then(() => console.log("[Notifications] All scheduled notifications cancelled due to no groupId."))
                 .catch(e => console.error("[Notifications] Error cancelling all notifications:", e));
         }
    }, [groupId, isLoadingGroup]); // Roda quando groupId ou loading mudam
   // ----------------------------------------------------

}
// --------------------


// --- Componente AppContent ---
// Simplificado: Apenas usa o loading do contexto
function AppContent() {
  const { effectiveTheme, colors } = useTheme();
  const { isLoadingGroup, groupError } = useGroup(); // Usa hook do grupo

  useProtectedRoutes(); // Chama o hook que agora usa contexto

  // Loading inicial baseado APENAS no contexto
  if (isLoadingGroup) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Tratamento de erro do contexto
  if (groupError) {
      return (
          <View style={[styles.container, styles.centered]}>
              <Stack.Screen options={{headerShown: false}}/> {/* Esconde header na tela de erro */}
              <Ionicons name="cloud-offline-outline" size={60} color={colors.error} style={{marginBottom: 15}} />
              <Text style={[styles.errorText, { color: colors.error }]}>Erro ao Carregar Dados</Text>
              <Text style={[styles.errorSubText, { color: colors.textSecondary }]}>{groupError}</Text>
              <Text style={[styles.errorSubText, { color: colors.textSecondary, marginTop: 10 }]}>Verifique sua conexão e tente reiniciar o app.</Text>
          </View>
      );
  }

  // Renderiza a Stack principal
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


// --- Componente Raiz Principal (sem mudanças) ---
export default function RootLayout() {
    // Font Loading (se existir)
    // const [fontsLoaded, fontError] = useFonts({ /* ... */ });
    // useEffect(() => { if (fontsLoaded || fontError) { SplashScreen.hideAsync(); } }, [fontsLoaded, fontError]);
    // if (!fontsLoaded && !fontError) { return null; }

    return (
        <ThemeProvider>
            <GroupProvider>
                 {/* <GestureHandlerRootView style={{ flex: 1 }}> */}
                 {/* <BottomSheetModalProvider> */}
                     <AppContent />
                     <FlashMessage position="top" statusBarHeight={42} /* ... Estilos FlashMessage ... */ />
                 {/* </BottomSheetModalProvider> */}
                 {/* </GestureHandlerRootView> */}
            </GroupProvider>
        </ThemeProvider>
    );
}

// --- Estilos ---
const styles = StyleSheet.create({
   container: { flex: 1, }, // Para tela de erro
   loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
   centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
   errorText: { textAlign: 'center', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
   errorSubText: { textAlign: 'center', fontSize: 14 },
});



/*
// app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { GroupProvider } from '@/context/GroupContext';
import FlashMessage, { showMessage } from "react-native-flash-message";

import * as Notifications from 'expo-notifications'; 
import { initializeNotifications } from '@/utils/NotificationManager'; 


function useProtectedRoutes(user: User | null) {
  const segments = useSegments();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    // Chama a função de inicialização do manager
    initializeNotifications().then(granted => {
        if (!granted) {
            console.log("Permissão não concedida, algumas funcionalidades podem ser limitadas.");
            showMessage({
                message: "Permissão de Notificações não concedida",
                description: "Algumas funcionalidades podem ser limitadas.",
                type: "warning",
                duration: 3000,
                backgroundColor: colors.warning, // Cor de fundo amarela
                color: colors.textPrimary, // Cor do texto preta
                icon: "auto",
            });
        }
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log("Usuário interagiu com a notificação:", response.notification.request.content.title);
      const data = response.notification.request.content.data;
      console.log("Dados da notificação:", data);

      // Exemplo: Navegar para uma tela específica baseada nos dados
       if (data?.type === 'inventoryReminder' && data?.itemId && data?.groupId) {
         console.log(`Navegando para o item de inventário: ${data.itemId} no grupo ${data.groupId}`);
         router.push(`/inventory`); // Se for uma rota simples
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

 */