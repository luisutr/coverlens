import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  USER_GUIDE_LEAD,
  USER_GUIDE_SECTIONS,
} from '../constants/documentation/userGuideDoc';
import { theme } from '../constants/theme';

export default function DocumentacionUsuarioScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.lead}>{USER_GUIDE_LEAD}</Text>

      {USER_GUIDE_SECTIONS.map((sec) => (
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
});
