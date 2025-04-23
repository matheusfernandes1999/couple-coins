// utils/NotificationManager.ts
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants'; // Para verificar se é dispositivo físico

// ID Padrão para o Canal Android (pode ser customizado)
const ANDROID_CHANNEL_ID = 'default-channel'; // Use um nome descritivo

/**
 * Verifica e solicita permissões de notificação ao usuário.
 * @returns {Promise<boolean>} True se a permissão foi concedida, false caso contrário.
 */
export const requestPermissionsAsync = async (): Promise<boolean> => {
  // Notificações podem não funcionar corretamente em emuladores
  if (!Constants.isDevice && Platform.OS !== 'web') {
    console.warn('Notification permissions check skipped: Not running on a physical device.');
    // Em alguns casos, pode querer retornar true para desenvolvimento, mas false é mais seguro
    // return true; // Descomente para permitir testes em emuladores (com ressalvas)
     Alert.alert("Aviso", "Permissões de notificação não podem ser verificadas corretamente em emuladores.");
     return false; // Retorna false se não for dispositivo físico
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log('Solicitando permissão de notificação...');
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permissão de notificação negada.');
      // Opcional: Mostrar alerta persistente ou guiar usuário às configurações
      // Alert.alert('Permissão Necessária', 'Para receber lembretes e alertas importantes, por favor, habilite as notificações nas configurações do seu dispositivo.');
      return false;
    }

    console.log('Permissão de notificação concedida.');
    return true;

  } catch (error) {
      console.error("Erro ao solicitar permissões de notificação:", error);
       Alert.alert("Erro de Permissão", "Não foi possível verificar ou solicitar permissões para notificações.");
      return false;
  }
};

/**
 * Configura o canal de notificação padrão necessário para Android 8+.
 * Deve ser chamado após a permissão ser concedida.
 */
export const setupAndroidChannelAsync = async () => {
  if (Platform.OS === 'android') {
    try {
        await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
            name: 'Notificações Gerais', // Nome visível nas configurações do Android
            importance: Notifications.AndroidImportance.DEFAULT, // Nível de importância
            vibrationPattern: [0, 250, 250, 250], // Padrão de vibração
            lightColor: '#FF231F7C', // Cor da luz (opcional)
        });
        console.log(`Canal de notificação Android "${ANDROID_CHANNEL_ID}" configurado.`);
    } catch (error) {
         console.error("Erro ao configurar canal Android:", error);
         // Não crítico a ponto de parar o app, mas logar é importante
    }
  }
};

/**
 * Configura o handler para notificações recebidas enquanto o app está em primeiro plano.
 */
export const setForegroundNotificationHandler = () => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false, // Ajuste conforme necessário
      }),
    });
    console.log("Handler de notificação em primeiro plano configurado.");
};

/**
 * Função combinada para inicializar notificações: pede permissão e configura canal.
 * @returns {Promise<boolean>} True se inicialização foi bem-sucedida (permissão concedida), false caso contrário.
 */
export const initializeNotifications = async (): Promise<boolean> => {
    console.log("Inicializando configurações de notificação...");
    const granted = await requestPermissionsAsync();
    if (granted) {
        await setupAndroidChannelAsync();
        setForegroundNotificationHandler(); // Configura o handler padrão
        console.log("Configuração de notificações concluída com permissão.");
    } else {
         console.log("Configuração de notificações não concluída (permissão negada).");
    }
    return granted;
};

/**
 * Agenda uma notificação local.
 * @param content O conteúdo da notificação (title, body, data, etc.).
 * @param trigger O gatilho para a notificação (null, {seconds}, {date}, {repeats}, etc.).
 * @returns {Promise<string | null>} O identificador da notificação agendada ou null em caso de erro.
 */
export const scheduleLocalNotification = async (
  content: Notifications.NotificationContentInput,
  trigger: Notifications.NotificationTriggerInput
): Promise<string | null> => {
  try {
    console.log("Agendando notificação local com trigger:", trigger);
    const identifier = await Notifications.scheduleNotificationAsync({ content, trigger });
    console.log('Notificação local agendada com ID:', identifier);
    return identifier;
  } catch (error) {
    console.error("Erro ao agendar notificação local:", error);
    Alert.alert("Erro", "Não foi possível agendar o lembrete.");
    return null;
  }
};

/**
 * Cancela uma notificação agendada específica pelo seu identificador.
 * @param identifier O ID da notificação retornado por scheduleNotificationAsync.
 * @returns {Promise<boolean>} True se cancelada com sucesso, false caso contrário.
 */
export const cancelScheduledNotification = async (identifier: string): Promise<boolean> => {
    try {
        console.log("Cancelando notificação agendada:", identifier);
        await Notifications.cancelScheduledNotificationAsync(identifier);
        console.log("Notificação cancelada.");
        return true;
    } catch (error) {
         console.error("Erro ao cancelar notificação agendada:", identifier, error);
         return false;
    }
};

/**
 * Cancela TODAS as notificações agendadas pelo aplicativo. Use com cuidado.
 * @returns {Promise<boolean>} True se bem-sucedido, false caso contrário.
 */
export const cancelAllScheduledNotifications = async (): Promise<boolean> => {
    try {
        console.warn("Cancelando TODAS as notificações agendadas...");
        await Notifications.cancelAllScheduledNotificationsAsync();
        console.log("Todas as notificações agendadas foram canceladas.");
        return true;
    } catch (error) {
        console.error("Erro ao cancelar todas as notificações:", error);
        return false;
    }
};

/**
 * Obtém todas as notificações que ainda estão agendadas.
 * @returns {Promise<Notifications.NotificationRequest[]>} Um array com as requisições de notificação agendadas.
 */
export const getAllScheduledNotifications = async (): Promise<Notifications.NotificationRequest[]> => {
    try {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        console.log(`Encontradas ${scheduled.length} notificações agendadas.`);
        return scheduled;
    } catch (error) {
         console.error("Erro ao buscar notificações agendadas:", error);
         return [];
    }
};

// --- Funções para Listeners (MELHOR configurar no componente React) ---
// É recomendado configurar os listeners addNotificationReceivedListener e
// addNotificationResponseReceivedListener diretamente no seu componente raiz (ex: _layout.tsx)
// porque eles geralmente precisam interagir com a navegação ou estado global do app.

// Exemplo de como poderia ser (mas não recomendado fazer aqui):
// export const setupResponseListener = (handler: (response: Notifications.NotificationResponse) => void) => {
//   const subscription = Notifications.addNotificationResponseReceivedListener(handler);
//   return subscription;
// };
// export const removeResponseListener = (subscription: Notifications.Subscription) => {
//    Notifications.removeNotificationSubscription(subscription);
// };