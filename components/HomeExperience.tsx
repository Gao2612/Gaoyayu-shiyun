"use client";

import { useState } from "react";
import { GalaxyScene } from "@/components/galaxy/GalaxyScene";
import { PoemDetailPanel } from "@/components/PoemDetailPanel";
import poemData from "@/data/poems.json";
import { PROJECT_PROFILE } from "@/lib/project-profile";
import { useGalaxyStore } from "@/store/galaxy-store";
import type { Poem } from "@/types/poem";

const POEMS: readonly Poem[] = poemData;

export function HomeExperience(): React.ReactElement {
  const [isEntered, setIsEntered] = useState<boolean>(false);
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

  return (
    <main className={shellClassName}>
      <GalaxyScene poems={POEMS} />

      <header className="brand">
        <h1>{PROJECT_PROFILE.name}</h1>
        <p>
          {PROJECT_PROFILE.author} · {POEMS.length} 首示例诗
        </p>
      </header>

      <button
        aria-pressed={isEntered}
        className="enter-button"
        onClick={toggleExperience}
        type="button"
      >
        {isEntered ? "返回引导" : "进入星云"}
      </button>

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
