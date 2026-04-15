import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { CatalogOcrFlowLayer } from '../../components/CatalogOcrFlowLayer';
import { CatalogOcrFlowProvider } from '../../contexts/CatalogOcrFlowContext';
import { theme } from '../../constants/theme';

export default function TabLayout() {
  return (
    <CatalogOcrFlowProvider>
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: theme.colors.textDim,
            headerShown: false,
            tabBarStyle: {
              backgroundColor: theme.colors.background,
              borderTopColor: '#333333',
              height: 60,
              paddingBottom: 8,
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Coleccion',
              tabBarIcon: ({ color }) => <Ionicons name="game-controller" size={24} color={color} />,
            }}
          />
          <Tabs.Screen
            name="escaner"
            options={{
              title: 'Escaner',
              tabBarIcon: ({ color }) => <Ionicons name="barcode-outline" size={24} color={color} />,
            }}
          />
          <Tabs.Screen
            name="ajustes"
            options={{
              title: 'Ajustes',
              tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={24} color={color} />,
            }}
          />
          <Tabs.Screen
            name="explore"
            options={{
              href: null,
            }}
          />
        </Tabs>
        <CatalogOcrFlowLayer />
      </View>
    </CatalogOcrFlowProvider>
  );
}
