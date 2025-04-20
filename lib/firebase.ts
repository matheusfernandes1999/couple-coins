import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from "firebase/storage"; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 

const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;

if (!apiKey || !authDomain || !projectId || !appId) {
    console.error("Firebase Config Error: Variáveis de ambiente essenciais não encontradas (apiKey, authDomain, projectId, appId). Verifique seu .env e o prefixo EXPO_PUBLIC_");

}

export const firebaseConfig = {
    apiKey: apiKey || "",
    authDomain: authDomain || "",
    projectId: projectId || "",
    storageBucket: storageBucket, 
    messagingSenderId: messagingSenderId,
    appId: appId || "",
};

let app: FirebaseApp;
if (!getApps().length) {
    console.log("Inicializando Firebase App...");
    app = initializeApp(firebaseConfig);
} else {
    console.log("Usando Firebase App existente.");
    app = getApp();
}

let authInstance: Auth;
let dbInstance: Firestore;
let storageInstance: FirebaseStorage;

try {
    const persistence = getReactNativePersistence(AsyncStorage);
    authInstance = initializeAuth(app, { persistence });
    dbInstance = getFirestore(app);
    storageInstance = getStorage(app);
} catch (error) {
    console.error("Erro inicializando serviços Firebase:", error);
    if (getApps().length) {
        authInstance = getAuth(app);
        dbInstance = getFirestore(app);
        storageInstance = getStorage(app);
         console.warn("Tentativa de recuperar instâncias existentes após erro.");
    } else {
        throw new Error(`Falha ao inicializar serviços Firebase: ${error}`);
    }
}

export const firebaseApp = app;
export const auth = authInstance;
export const db = dbInstance;
export const storage = storageInstance;