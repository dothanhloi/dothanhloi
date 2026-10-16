import { Directory, File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { uid } from './format';
import { useStore } from './store';
import type { Photo } from './types';

function photosDir(): Directory {
  const d = new Directory(Paths.document, 'photos');
  try { if (!d.exists) d.create(); } catch {}
  return d;
}

/** Nén ảnh (tối đa 1280px, JPEG 70%) và lưu vào thư mục app */
async function storeImage(uri: string): Promise<string> {
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1280 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
  const dest = new File(photosDir(), `${uid()}.jpg`);
  await new File(out.uri).copy(dest);
  return dest.uri;
}

export async function takePhoto(truckId: string, kind: Photo['kind'], fromLibrary = false): Promise<Photo | null> {
  if (fromLibrary) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error('Chưa cấp quyền thư viện ảnh');
  } else {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Chưa cấp quyền máy ảnh');
  }
  const res = fromLibrary
    ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsMultipleSelection: false })
    : await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
  if (res.canceled || !res.assets?.[0]) return null;
  const localUri = await storeImage(res.assets[0].uri);
  return useStore.getState().addPhoto({ truckId, kind, localUri });
}

export function photoExists(p: Photo): boolean {
  try { return !!p.localUri && new File(p.localUri).exists; } catch { return false; }
}

export async function photoBase64(p: Photo): Promise<string | null> {
  try { if (!p.localUri) return null; return await new File(p.localUri).base64(); } catch { return null; }
}

export function deletePhotoFile(p: Photo) {
  try { if (p.localUri) { const f = new File(p.localUri); if (f.exists) f.delete(); } } catch {}
}

export const PHOTO_KINDS: { v: Photo['kind']; label: string }[] = [
  { v: 'sample', label: 'Mẫu hàng' }, { v: 'ticket', label: 'Phiếu cân giấy' }, { v: 'truck', label: 'Xe hàng' }, { v: 'other', label: 'Khác' },
];
