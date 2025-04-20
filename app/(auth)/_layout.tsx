// app/(auth)/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  // Pode configurar opções específicas para as telas de autenticação aqui
  return <Stack screenOptions={{ headerShown: false }} />;
}