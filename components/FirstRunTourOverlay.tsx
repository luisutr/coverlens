import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bumpTourStepIfNeeded, useFirstRunTour } from '../contexts/FirstRunTourContext';

export function FirstRunTourOverlay() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { active, step, refresh, skipTour } = useFirstRunTour();

  React.useEffect(() => {
    void (async () => {
      await bumpTourStepIfNeeded(pathname);
      await refresh();
    })();
  }, [pathname, refresh]);

  if (!active) return null;

  const onScannerTab = pathname.includes('escaner');
  const onGameDetail = pathname.includes('/game/');
  const excludedForCatalog =
    pathname.includes('onboarding') ||
    pathname.includes('documentacion') ||
    pathname.includes('modal') ||
    pathname.includes('escaner') ||
    pathname.includes('ajustes') ||
    onGameDetail;
  const onCatalog =
    !excludedForCatalog &&
    (pathname === '' ||
      pathname === '/' ||
      pathname === '/(tabs)' ||
      pathname.endsWith('/index') ||
      (pathname.includes('(tabs)') && !pathname.includes('escaner') && !pathname.includes('ajustes')));

  let title = '';
  let body = '';

  if (step === 0 && !onScannerTab) {
    title = 'Paso 1: Escaner';
    body = 'Pulsa la pestaña «Escaner» abajo. Desde ahí podrás leer un código de barras y añadir el juego al catálogo.';
  } else if (step === 1 && onScannerTab) {
    title = 'Paso 2: Escanea un juego';
    body =
      'Enfoca el código de barras del estuche o disco. Cuando se lea bien, el juego se guardará solo y volverás a la colección.';
  } else if (step === 2 && onCatalog) {
    title = 'Paso 3: Abre la ficha';
    body = 'Toca la tarjeta del juego que acabas de añadir para ver todos los datos y la portada.';
  } else if (step === 3 && onGameDetail) {
    title = 'Paso 4: Portadas';
    body =
      'Pulsa «Actualizar portadas». CoverLens prueba primero GameplayStores y, si activas más fuentes, mejora cobertura para ediciones o carátulas alternativas.';
  } else {
    return null;
  }

  const bottomPad = Math.max(insets.bottom, 12) + 56;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={[styles.dim, { paddingBottom: bottomPad }]} pointerEvents="none" />
      <View style={[styles.card, { marginBottom: bottomPad }]} pointerEvents="auto">
        <View style={styles.cardHeader}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Guía</Text>
          </View>
          <Pressable onPress={() => void skipTour()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Omitir guía">
            <Text style={styles.skip}>Omitir</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {step === 0 ? (
          <View style={styles.hintRow}>
            <Ionicons name="arrow-down" size={22} color="#0b74de" />
            <Text style={styles.hint}>La pestaña está en la barra inferior</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 40, 70, 0.35)',
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#cfe0f5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badge: {
    backgroundColor: 'rgba(11,116,222,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#0b74de',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  skip: {
    color: '#5c6d7e',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#142a40',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: '#2f4457',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  hint: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0b74de',
    flex: 1,
  },
});
