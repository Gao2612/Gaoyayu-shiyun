"use client";

import { create } from "zustand";

type GalaxyState = Readonly<{
  hoveredPoemId: string | null;
  selectedPoemId: string | null;
  hoverPoem: (poemId: string | null) => void;
  selectPoem: (poemId: string) => void;
  clearSelection: () => void;
}>;

export const useGalaxyStore = create<GalaxyState>(
  (set): GalaxyState => ({
    hoveredPoemId: null,
    selectedPoemId: null,
    hoverPoem: (poemId: string | null): void => {
      set({ hoveredPoemId: poemId });
    },
    selectPoem: (poemId: string): void => {
      set({ selectedPoemId: poemId });
    },
    clearSelection: (): void => {
      set({
        hoveredPoemId: null,
        selectedPoemId: null,
      });
    },
  }),
);
