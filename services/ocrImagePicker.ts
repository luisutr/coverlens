import { Alert } from 'react-native';

export const OCR_IMAGE_MEDIA_TYPES = ['images' as const];

export function askOcrImageSource(title: string, message: string): Promise<'camera' | 'library' | null> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
      { text: 'Fototeca', onPress: () => resolve('library') },
      { text: 'Cámara', onPress: () => resolve('camera') },
    ]);
  });
}

export async function pickImageForOcr(title: string, message: string): Promise<string | null> {
  const src = await askOcrImageSource(title, message);
  if (!src) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
  const opts = { mediaTypes: OCR_IMAGE_MEDIA_TYPES, quality: 0.55 as const, allowsEditing: false as const };
  if (src === 'camera') {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) {
      Alert.alert('Cámara', 'Activa el permiso de cámara para hacer la foto.');
      return null;
    }
    const r = await ImagePicker.launchCameraAsync(opts);
    return !r.canceled && r.assets[0] ? r.assets[0].uri : null;
  }
  const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!p.granted) {
    Alert.alert('Fototeca', 'Activa el acceso a Fotos para elegir una imagen.');
    return null;
  }
  const r = await ImagePicker.launchImageLibraryAsync(opts);
  return !r.canceled && r.assets[0] ? r.assets[0].uri : null;
}
