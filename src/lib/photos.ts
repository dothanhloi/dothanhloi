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
  const name = `${uid()}.jpg`;
  const dest = new File(photosDir(), name);
  await new File(out.uri).copy(dest);
  return name; // chỉ lưu tên file: thư mục app đổi sau mỗi lần cập nhật (iOS)
}

/** Tìm file ảnh trên máy từ tên file (mới) hoặc đường dẫn tuyệt đối (bản cũ) */
export function photoFile(p: Photo): File | null {
  if (!p.localUri) return null;
  try {
    const name = p.localUri.includes('/') ? p.localUri.split('/').pop() || '' : p.localUri;
    if (name) { const f = new File(photosDir(), name); if (f.exists) return f; }
    if (p.localUri.startsWith('file:')) { const f = new File(p.localUri); if (f.exists) return f; }
  } catch {}
  return null;
}
export function photoUri(p: Photo): string | null {
  const f = photoFile(p);
  return f ? f.uri : null;
}

export async function takePhoto(truckId: string, kind: Photo['kind'], fromLibrary = false): Promise<Photo | null> {
  if (!fromLibrary) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Chưa cấp quyền máy ảnh');
  } // thư viện ảnh: bộ chọn hệ thống không cần quyền
  const res = fromLibrary
    ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsMultipleSelection: false })
    : await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
  if (res.canceled || !res.assets?.[0]) return null;
  const localUri = await storeImage(res.assets[0].uri);
  return useStore.getState().addPhoto({ truckId, kind, localUri });
}

export function photoExists(p: Photo): boolean {
  return photoFile(p) != null;
}

export async function photoBase64(p: Photo): Promise<string | null> {
  try { const f = photoFile(p); return f ? await f.base64() : null; } catch { return null; }
}

export function deletePhotoFile(p: Photo) {
  try { const f = photoFile(p); if (f) f.delete(); } catch {}
}

export const PHOTO_KINDS: { v: Photo['kind']; label: string }[] = [
  { v: 'sample', label: 'Mẫu hàng' }, { v: 'ticket', label: 'Phiếu cân giấy' }, { v: 'truck', label: 'Xe hàng' }, { v: 'other', label: 'Khác' },
];
