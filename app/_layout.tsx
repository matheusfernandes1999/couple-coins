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

function useProtectedRoutes(user: User | null) {
  const segments = useSegments();
  const router = useRouter();

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