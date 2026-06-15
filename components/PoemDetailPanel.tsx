"use client";

import { useEffect } from "react";
import type { Poem } from "@/types/poem";

type PoemDetailPanelProps = Readonly<{
  poem: Poem;
  onClose: () => void;
}>;

function getDisplayText(value: string, fallback: string): string {
  const normalizedValue: string = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : fallback;
}

function formatWrittenAt(value: string): string {
  const normalizedValue: string = value.trim();
  if (normalizedValue.length === 0) {
    return "日期未记录";
  }

  const dateParts: readonly string[] = normalizedValue.split("-");
  if (dateParts.length !== 3) {
    return normalizedValue;
  }

  return `${dateParts[0]}年${dateParts[1]}月${dateParts[2]}日`;
}

export function PoemDetailPanel({
  poem,
  onClose,
}: PoemDetailPanelProps): React.ReactElement {
  const title: string = getDisplayText(poem.title, "未命名");
  const content: string = getDisplayText(poem.content, "暂无正文");
  const collection: string = getDisplayText(
    poem.collection,
    "个人诗集",
  );
  const tags: readonly string[] = poem.tags
    .map((tag: string): string => tag.trim())
    .filter((tag: string): boolean => tag.length > 0);

  useEffect((): (() => void) => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return (): void => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <aside
      aria-labelledby="poem-detail-title"
      className="poem-detail"
      role="dialog"
    >
      <header className="poem-detail-header">
        <div>
          <p className="poem-detail-collection">{collection}</p>
          <h2 id="poem-detail-title">{title}</h2>
        </div>
        <button
          aria-label="关闭诗歌详情"
          className="poem-detail-close"
          onClick={onClose}
          type="button"
        >
          关闭
        </button>
      </header>

      <div className="poem-detail-scroll">
        <div className="poem-detail-meta">
          <time dateTime={poem.writtenAt}>
            {formatWrittenAt(poem.writtenAt)}
          </time>
          {poem.location === null ? null : (
            <span>{getDisplayText(poem.location, "地点未记录")}</span>
          )}
        </div>

        <p className="poem-detail-content">{content}</p>

        <section aria-label="诗歌标签" className="poem-detail-tags">
          <h3>标签</h3>
          {tags.length === 0 ? (
            <p className="poem-detail-empty">暂无标签</p>
          ) : (
            <ul>
              {tags.map((tag: string): React.ReactElement => (
                <li key={tag}>#{tag}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className="poem-detail-footer">
        <button onClick={onClose} type="button">
          回到星云
        </button>
        <p>关闭后仍可继续旋转、缩放和选择星体</p>
      </footer>
    </aside>
  );
}
