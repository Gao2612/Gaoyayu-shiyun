"use client";

import { useMemo, useState } from "react";
import { GalaxyScene } from "@/components/galaxy/GalaxyScene";
import { PoemFilterPanel } from "@/components/PoemFilterPanel";
import { PoemDetailPanel } from "@/components/PoemDetailPanel";
import { PoemSearchPanel } from "@/components/PoemSearchPanel";
import poemData from "@/data/poems.json";
import {
  createPoemFilterOptions,
  EMPTY_POEM_FILTERS,
  filterPoems,
  togglePoemFilterValue,
  type PoemFilterOptions,
  type PoemFilterState,
} from "@/lib/poem-filters";
import { PROJECT_PROFILE } from "@/lib/project-profile";
import { useGalaxyStore } from "@/store/galaxy-store";
import type { Poem } from "@/types/poem";

const POEMS: readonly Poem[] = poemData;

export function HomeExperience(): React.ReactElement {
  const [isEntered, setIsEntered] = useState<boolean>(false);
  const [filters, setFilters] = useState<PoemFilterState>(
    EMPTY_POEM_FILTERS,
  );
  const hoveredPoemId = useGalaxyStore(
    (state) => state.hoveredPoemId,
  );
  const selectedPoemId = useGalaxyStore(
    (state) => state.selectedPoemId,
  );
  const clearSelection = useGalaxyStore(
    (state) => state.clearSelection,
  );
  const activePoemId: string | null =
    selectedPoemId ?? hoveredPoemId;
  const activePoem: Poem | null = POEMS.find(
    (poem: Poem): boolean => poem.id === activePoemId,
  ) ?? null;
  const selectedPoem: Poem | null = POEMS.find(
    (poem: Poem): boolean => poem.id === selectedPoemId,
  ) ?? null;
  const filterOptions: PoemFilterOptions = useMemo(
    (): PoemFilterOptions => createPoemFilterOptions(POEMS),
    [],
  );
  const filteredPoems: readonly Poem[] = useMemo(
    (): readonly Poem[] => filterPoems(POEMS, filters),
    [filters],
  );
  const matchedPoemIds: readonly string[] = useMemo(
    (): readonly string[] =>
      filteredPoems.map((poem: Poem): string => poem.id),
    [filteredPoems],
  );
  const shellClassName: string = [
    "app-shell",
    isEntered ? "is-entered" : "",
    selectedPoem === null ? "" : "has-selection",
  ]
    .filter((className: string): boolean => className.length > 0)
    .join(" ");

  function toggleExperience(): void {
    setIsEntered((currentValue: boolean): boolean => !currentValue);
  }

  function clearFilters(): void {
    setFilters(EMPTY_POEM_FILTERS);
  }

  function toggleCollectionFilter(value: string): void {
    setFilters((currentFilters: PoemFilterState): PoemFilterState => ({
      ...currentFilters,
      collections: togglePoemFilterValue(
        currentFilters.collections,
        value,
      ),
    }));
  }

  function toggleClassicalFormFilter(value: string): void {
    setFilters((currentFilters: PoemFilterState): PoemFilterState => ({
      ...currentFilters,
      classicalForms: togglePoemFilterValue(
        currentFilters.classicalForms,
        value,
      ),
    }));
  }

  function toggleCiTuneFilter(value: string): void {
    setFilters((currentFilters: PoemFilterState): PoemFilterState => ({
      ...currentFilters,
      ciTunes: togglePoemFilterValue(currentFilters.ciTunes, value),
    }));
  }

  function toggleQuTuneFilter(value: string): void {
    setFilters((currentFilters: PoemFilterState): PoemFilterState => ({
      ...currentFilters,
      quTunes: togglePoemFilterValue(currentFilters.quTunes, value),
    }));
  }

  function toggleYearFilter(value: string): void {
    setFilters((currentFilters: PoemFilterState): PoemFilterState => ({
      ...currentFilters,
      years: togglePoemFilterValue(currentFilters.years, value),
    }));
  }

  return (
    <main className={shellClassName}>
      <GalaxyScene matchedPoemIds={matchedPoemIds} poems={POEMS} />

      <header className="brand">
        <h1>{PROJECT_PROFILE.name}</h1>
      </header>

      <button
        aria-pressed={isEntered}
        className="enter-button"
        onClick={toggleExperience}
        type="button"
      >
        {isEntered ? "返回引导" : "进入星云"}
      </button>

      <PoemSearchPanel poems={POEMS} />
      <PoemFilterPanel
        filters={filters}
        matchedCount={filteredPoems.length}
        onClear={clearFilters}
        onToggleCiTune={toggleCiTuneFilter}
        onToggleClassicalForm={toggleClassicalFormFilter}
        onToggleCollection={toggleCollectionFilter}
        onToggleQuTune={toggleQuTuneFilter}
        onToggleYear={toggleYearFilter}
        options={filterOptions}
        totalCount={POEMS.length}
      />

      <p className="interaction-tip">拖动旋转 · 滚轮缩放</p>
      <p className="day-status">
        {activePoem === null
          ? "悬停查看 · 点击聚焦"
          : `${selectedPoemId === activePoem.id ? "已选中" : "悬停"}：`
            + activePoem.title}
      </p>

      {selectedPoem === null ? null : (
        <PoemDetailPanel
          onClose={clearSelection}
          poem={selectedPoem}
        />
      )}
    </main>
  );
}
