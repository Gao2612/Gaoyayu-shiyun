"use client";

import { create } from "zustand";

type GalaxyState = Readonly<{
  selectedPoemId: string | null;
  selectPoem: (poemId: string) => void;
  clearSelection: () => void;
}>;

export const useGalaxyStore = create<GalaxyState>(
  (set): GalaxyState => ({
    selectedPoemId: null,
    selectPoem: (poemId: string): void => {
      set({ selectedPoemId: poemId });
    },
    clearSelection: (): void => {
      set({ selectedPoemId: null });
    },
  }),
);
