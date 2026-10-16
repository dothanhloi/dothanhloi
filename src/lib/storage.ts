import AsyncStorage from '@react-native-async-storage/async-storage';
import Storage from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';

/**
 * Lưu trữ bằng SQLite (expo-sqlite/kv-store): không bị giới hạn 6 MB như AsyncStorage trên Android.
 * Lần đầu chạy sẽ chuyển dữ liệu cũ từ AsyncStorage sang.
 */
export const appStorage: StateStorage = {
  getItem: async (name) => {
    let sqliteError: unknown = null;
    try {
      const v = await Storage.getItemAsync(name);
      if (v != null) return v;
    } catch (e) { sqliteError = e; console.warn('kv getItem', e); }
    // bản cũ (AsyncStorage) hoặc bản dự phòng khi SQLite ghi lỗi
    const old = await AsyncStorage.getItem(name);
    if (old != null) {
      if (!sqliteError) { try { await Storage.setItemAsync(name, old); await AsyncStorage.removeItem(name); } catch {} }
      return old;
    }
    // SQLite lỗi tạm thời và không có bản dự phòng: báo lỗi để zustand KHÔNG ghi đè dữ liệu bằng state rỗng
    if (sqliteError) throw sqliteError;
    return null;
  },
  setItem: async (name, value) => {
    try { await Storage.setItemAsync(name, value); }
    catch (e) {
      console.warn('kv setItem', e);
      // dự phòng: ghi AsyncStorage; chỉ khi ghi được mới bỏ bản SQLite cũ để lần mở sau đọc bản mới nhất
      try { await AsyncStorage.setItem(name, value); await Storage.removeItemAsync(name); }
      catch (e2) { console.warn('fallback setItem', e2); }
    }
  },
  removeItem: async (name) => {
    try { await Storage.removeItemAsync(name); } catch {}
    try { await AsyncStorage.removeItem(name); } catch {}
  },
};
