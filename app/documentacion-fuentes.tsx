import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PORTADAS_DOC_FOOTNOTE, PORTADAS_Y_FUENTES_SECTIONS } from '../constants/documentation/portadasYFuentesDoc';
import { theme } from '../constants/theme';

export default function DocumentacionFuentesScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.lead}>
        Referencia para pruebas y mantenimiento: cómo se eligen las portadas y metadatos, qué fuentes están activas
        (CoverLens integrado + terceros opcionales) y dónde tocar si cambia el comportamiento.
      </Text>

      {PORTADAS_Y_FUENTES_SECTIONS.map((sec) => (
        <View key={sec.heading} style={styles.block}>
          <Text style={styles.heading}>{sec.heading}</Text>
          {sec.paragraphs.map((p, i) => (
            <Text key={i} style={styles.paragraph}>
              {p}
            </Text>
          ))}
          {sec.bullets?.map((b, i) => (
            <Text key={i} style={styles.bullet}>
              {'\u2022 '}
              {b}
            </Text>
          ))}
        </View>
      ))}

      <Text style={styles.footnote}>{PORTADAS_DOC_FOOTNOTE}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 48 },
  lead: {
    color: theme.colors.textDim,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  block: { marginBottom: 22 },
  heading: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  paragraph: {
    color: theme.colors.textLight,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  bullet: {
    color: theme.colors.textLight,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
    paddingLeft: 4,
  },
  footnote: {
    color: theme.colors.textDim,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    fontStyle: 'italic',
  },
});
