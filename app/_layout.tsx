import { Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { FirstRunTourOverlay } from '../components/FirstRunTourOverlay';
import { FirstRunTourProvider } from '../contexts/FirstRunTourContext';
import { PORTADAS_DOC_TITLE } from '../constants/documentation/portadasYFuentesDoc';
import { USER_GUIDE_TITLE } from '../constants/documentation/userGuideDoc';
import { theme } from '../constants/theme';

export default function RootLayout() {
  return (
    <FirstRunTourProvider>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="game/[id]" />
          <Stack.Screen
            name="documentacion-usuario"
            options={{
              headerShown: true,
              title: USER_GUIDE_TITLE,
              headerStyle: { backgroundColor: theme.colors.background },
              headerTintColor: theme.colors.primary,
              headerTitleStyle: { color: theme.colors.textLight, fontSize: 15 },
            }}
          />
          <Stack.Screen
            name="documentacion-fuentes"
            options={{
              headerShown: true,
              title: PORTADAS_DOC_TITLE,
              headerStyle: { backgroundColor: theme.colors.background },
              headerTintColor: theme.colors.primary,
              headerTitleStyle: { color: theme.colors.textLight, fontSize: 15 },
            }}
          />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
        <FirstRunTourOverlay />
      </View>
    </FirstRunTourProvider>
  );
}