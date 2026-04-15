import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { useCatalogOcrFlow } from '../contexts/CatalogOcrFlowContext';

export function CatalogOcrFlowLayer() {
  const insets = useSafeAreaInsets();
  const ctx = useCatalogOcrFlow();
  const showChrome = ctx.banner || ctx.singleReview || ctx.batchReview;

  if (!showChrome) return null;

  return (
    <>
      {ctx.banner ? (
        <View
          style={[styles.bannerWrap, { paddingTop: insets.top + 6 }]}
          pointerEvents="box-none"
        >
          <View style={styles.bannerCard} accessibilityRole="alert">
            <ActivityIndicator color={theme.colors.primary} size="small" />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.bannerTitle}>{ctx.banner.message}</Text>
              {ctx.banner.subtitle ? (
                <Text style={styles.bannerSubtitle}>{ctx.banner.subtitle}</Text>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      <Modal
        visible={ctx.singleReview !== null}
        transparent
        animationType="slide"
        onRequestClose={ctx.dismissSingleReview}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Confirmar OCR (lomo)</Text>
            <Text style={styles.modalSubtitle}>
              Corrige si algo no está bien antes de buscar metadatos y portada.
            </Text>

            <Text style={styles.modalLabel}>Título detectado</Text>
            <TextInput
              style={styles.modalInput}
              value={ctx.singleReview?.title ?? ''}
              onChangeText={(v) =>
                ctx.setSingleReview((prev) => (prev ? { ...prev, title: v } : prev))
              }
              placeholderTextColor={theme.colors.textDim}
              placeholder="Título del juego"
            />

            <Text style={styles.modalLabel}>Plataforma detectada</Text>
            <TextInput
              style={styles.modalInput}
              value={ctx.singleReview?.platform ?? ''}
              onChangeText={(v) =>
                ctx.setSingleReview((prev) => (prev ? { ...prev, platform: v } : prev))
              }
              placeholderTextColor={theme.colors.textDim}
              placeholder="Ej: PlayStation 4, Xbox 360..."
            />

            {ctx.singleReview?.rawText ? (
              <>
                <Text style={styles.modalLabel}>Texto crudo del OCR</Text>
                <Text style={styles.modalRaw} numberOfLines={4}>
                  {ctx.singleReview.rawText}
                </Text>
              </>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={ctx.dismissSingleReview}
                disabled={ctx.singleSaving}
                accessibilityRole="button"
                accessibilityLabel="Cancelar OCR"
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, ctx.singleSaving && styles.btnDisabled]}
                onPress={() => void ctx.confirmSingleSave()}
                disabled={ctx.singleSaving}
                accessibilityRole="button"
                accessibilityLabel="Confirmar OCR y buscar"
              >
                <Text style={styles.modalConfirmText}>
                  {ctx.singleSaving ? 'Guardando…' : 'Buscar y guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={ctx.batchReview !== null}
        transparent
        animationType="slide"
        onRequestClose={ctx.dismissBatchReview}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Confirmar lote OCR</Text>
            <Text style={styles.modalSubtitle}>
              Por defecto solo vienen marcados los que tienen título y plataforma. Revisa el resto, corrige y marca los
              que quieras guardar (igual que en manual: se resuelven metadatos y se insertan en la base).
            </Text>
            <View style={styles.batchToolbar}>
              <TouchableOpacity
                style={styles.batchToolbarBtn}
                onPress={() =>
                  ctx.setBatchReview((prev) =>
                    prev ? { ...prev, items: prev.items.map((item) => ({ ...item, selected: true })) } : prev
                  )
                }
              >
                <Text style={styles.batchToolbarBtnText}>Todos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.batchToolbarBtn}
                onPress={() =>
                  ctx.setBatchReview((prev) =>
                    prev
                      ? {
                          ...prev,
                          items: prev.items.map((item) => {
                            const t = item.title.trim();
                            const p = item.platform.trim();
                            return { ...item, selected: t.length >= 2 && p.length >= 1 };
                          }),
                        }
                      : prev
                  )
                }
              >
                <Text style={styles.batchToolbarBtnText}>Solo listos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.batchToolbarBtn}
                onPress={() =>
                  ctx.setBatchReview((prev) =>
                    prev ? { ...prev, items: prev.items.map((item) => ({ ...item, selected: false })) } : prev
                  )
                }
              >
                <Text style={styles.batchToolbarBtnText}>Ninguno</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.batchList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {(ctx.batchReview?.items ?? []).map((item) => (
                <View key={item.id} style={styles.batchRow}>
                  <Pressable
                    onPress={() =>
                      ctx.setBatchReview((prev) =>
                        prev
                          ? {
                              ...prev,
                              items: prev.items.map((p) =>
                                p.id === item.id ? { ...p, selected: !p.selected } : p
                              ),
                            }
                          : prev
                      )
                    }
                    style={styles.batchCheckbox}
                  >
                    <Ionicons
                      name={item.selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={item.selected ? theme.colors.primary : theme.colors.textDim}
                    />
                  </Pressable>
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={styles.batchMetaRow}>
                      <View style={styles.batchConfidenceChip}>
                        <Text style={styles.batchConfidenceText}>Confianza {item.confidence}%</Text>
                      </View>
                    </View>
                    <TextInput
                      style={styles.modalInput}
                      value={item.title}
                      onChangeText={(v) =>
                        ctx.setBatchReview((prev) =>
                          prev
                            ? {
                                ...prev,
                                items: prev.items.map((p) => (p.id === item.id ? { ...p, title: v } : p)),
                              }
                            : prev
                        )
                      }
                      placeholder="Título"
                      placeholderTextColor={theme.colors.textDim}
                    />
                    <TextInput
                      style={styles.modalInput}
                      value={item.platform}
                      onChangeText={(v) =>
                        ctx.setBatchReview((prev) =>
                          prev
                            ? {
                                ...prev,
                                items: prev.items.map((p) => (p.id === item.id ? { ...p, platform: v } : p)),
                              }
                            : prev
                        )
                      }
                      placeholder="Plataforma (opcional)"
                      placeholderTextColor={theme.colors.textDim}
                    />
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={ctx.dismissBatchReview}
                disabled={ctx.batchSaving}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, ctx.batchSaving && styles.btnDisabled]}
                onPress={() => void ctx.confirmBatchSave()}
                disabled={ctx.batchSaving}
                accessibilityRole="button"
                accessibilityLabel="Añadir candidatos seleccionados al catálogo"
              >
                <Text style={styles.modalConfirmText}>
                  {ctx.batchSaving ? 'Guardando…' : 'Añadir seleccionados'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bannerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    elevation: 12,
    paddingHorizontal: 12,
    pointerEvents: 'box-none',
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(18,28,40,0.96)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,127,255,0.35)',
  },
  bannerTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  bannerSubtitle: { color: theme.colors.textDim, fontSize: 12, lineHeight: 17 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: '#222',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  modalSubtitle: { color: theme.colors.textDim, fontSize: 13, marginBottom: 16 },
  modalLabel: { color: theme.colors.textDim, fontSize: 12, fontWeight: '600', marginBottom: 5, marginTop: 10 },
  modalInput: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  modalRaw: { color: '#555', fontSize: 11, fontFamily: 'monospace', marginTop: 4, lineHeight: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
  },
  modalCancelText: { color: theme.colors.textDim, fontWeight: '600' },
  modalConfirmBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  modalConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.55 },
  batchList: { maxHeight: 360 },
  batchToolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  batchToolbarBtn: {
    borderWidth: 1,
    borderColor: '#2d4a66',
    backgroundColor: 'rgba(0,127,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  batchToolbarBtnText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  batchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
    paddingBottom: 10,
  },
  batchMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  batchConfidenceChip: {
    borderWidth: 1,
    borderColor: '#2c3e50',
    backgroundColor: 'rgba(127,196,232,0.08)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  batchConfidenceText: {
    color: '#7fc4e8',
    fontSize: 11,
    fontWeight: '700',
  },
  batchCheckbox: { paddingTop: 8 },
});
