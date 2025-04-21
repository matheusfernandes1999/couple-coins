// app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Platform } from 'react-native';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: React.ComponentProps<typeof Ionicons>['name'] = 'alert-circle';
          if (route.name === 'home') {
            iconName = focused ? 'pie-chart' : 'pie-chart-outline';
          } else if (route.name === 'shopping') {
            iconName = focused ? 'list-circle' : 'list-circle-outline';
          } else if (route.name === 'inventory') {
            iconName = focused ? 'file-tray-full' : 'file-tray-full-outline';
          } else if (route.name === 'budget') {
            iconName = focused ? 'wallet' : 'wallet-outline';
          } else if (route.name === 'profile') {
            iconName = focused ? 'person-circle' : 'person-circle-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          paddingBottom: Platform.OS === 'ios' ? 20 : 5,
          height: Platform.OS === 'ios' ? 80 : 60,
        },
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tabs.Screen name="home" options={{ title: 'Resumo', headerTitleAlign: 'center' }} />
      <Tabs.Screen name="shopping" options={{ title: 'Listas', headerTitleAlign: 'center' }} />
      <Tabs.Screen name="inventory" options={{ title: 'Inventário', headerTitleAlign: 'center' }} />
      <Tabs.Screen name="budget" options={{ title: 'Orçamento', headerTitleAlign: 'center' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', headerTitleAlign: 'center' }} />
    </Tabs>
  );
}