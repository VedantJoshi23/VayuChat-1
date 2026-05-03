import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DatasetFormat = 'csv' | 'json' | 'pkl';

export interface DatasetEntry {
  name: string;        // User-assigned key, e.g. "data", "ncap_data"
  path: string;        // On-device file path
  format: DatasetFormat;
  size: number;
  columns: string[];   // Populated after first load
  rowCount: number;    // Populated after first load
  loadedAt: string | null;
}

interface DatasetStore {
  datasets: DatasetEntry[];
  addDataset: (entry: Omit<DatasetEntry, 'columns' | 'rowCount' | 'loadedAt'>) => void;
  updateDatasetMeta: (name: string, meta: Pick<DatasetEntry, 'columns' | 'rowCount' | 'loadedAt'>) => void;
  removeDataset: (name: string) => void;
  clearAll: () => void;
}

export const useDatasetStore = create<DatasetStore>()(
  persist(
    (set) => ({
      datasets: [],

      addDataset: (entry) =>
        set((state) => {
          const existing = state.datasets.findIndex((d) => d.name === entry.name);
          const full: DatasetEntry = { ...entry, columns: [], rowCount: 0, loadedAt: null };
          if (existing >= 0) {
            const updated = [...state.datasets];
            updated[existing] = { ...updated[existing], path: entry.path, format: entry.format, size: entry.size };
            return { datasets: updated };
          }
          return { datasets: [...state.datasets, full] };
        }),

      updateDatasetMeta: (name, meta) =>
        set((state) => ({
          datasets: state.datasets.map((d) => (d.name === name ? { ...d, ...meta } : d)),
        })),

      removeDataset: (name) =>
        set((state) => ({ datasets: state.datasets.filter((d) => d.name !== name) })),

      clearAll: () => set({ datasets: [] }),
    }),
    {
      name: 'vayurn.datasets',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ datasets: s.datasets }),
    }
  )
);
