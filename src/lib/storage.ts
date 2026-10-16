import AsyncStorage from '@react-native-async-storage/async-storage';
import Storage from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';

/**
 * Lưu trữ bằng SQLite (expo-sqlite/kv-store): không bị giới hạn 6 MB như AsyncStorage trên Android.
 * Lần đầu chạy sẽ chuyển dữ liệu cũ từ AsyncStorage sang.
 */
export const appStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const v = await Storage.getItemAsync(name);
      if (v != null) return v;
    } catch (e) { console.warn('kv getItem', e); }
    // di chuyển từ AsyncStorage (bản cũ)
    try {
      const old = await AsyncStorage.getItem(name);
      if (old != null) {
        try { await Storage.setItemAsync(name, old); await AsyncStorage.removeItem(name); } catch {}
        return old;
      }
    } catch {}
    return null;
  },
  setItem: async (name, value) => {
    try { await Storage.setItemAsync(name, value); }
    catch (e) {
      console.warn('kv setItem', e);
      // dự phòng
      try { await AsyncStorage.setItem(name, value); } catch {}
    }
  },
  removeItem: async (name) => {
    try { await Storage.removeItemAsync(name); } catch {}
    try { await AsyncStorage.removeItem(name); } catch {}
  },
};
