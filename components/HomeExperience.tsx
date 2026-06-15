"use client";

import { useState } from "react";
import { GalaxyScene } from "@/components/galaxy/GalaxyScene";
import poemData from "@/data/poems.json";
import { PROJECT_PROFILE } from "@/lib/project-profile";
import type { Poem } from "@/types/poem";

const POEMS: readonly Poem[] = poemData;

export function HomeExperience(): React.ReactElement {
  const [isEntered, setIsEntered] = useState<boolean>(false);

  function toggleExperience(): void {
    setIsEntered((currentValue: boolean): boolean => !currentValue);
  }

  return (
    <main className={`app-shell${isEntered ? " is-entered" : ""}`}>
      <GalaxyScene isEntered={isEntered} poems={POEMS} />

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
        {isEntered
          ? `${POEMS.length} 颗诗星 · 1 次实例绘制`
          : "今日完成：三维诗歌星空"}
      </p>
    </main>
  );
}
