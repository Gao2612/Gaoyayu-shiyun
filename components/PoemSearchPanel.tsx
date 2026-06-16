"use client";

import Fuse from "fuse.js";
import type { FuseResult, FuseResultMatch } from "fuse.js";
import { useMemo, useState } from "react";

import { useGalaxyStore } from "@/store/galaxy-store";
import type { Poem } from "@/types/poem";

type PoemSearchPanelProps = Readonly<{
  poems: readonly Poem[];
}>;

type SearchablePoem = Readonly<{
  id: string;
  title: string;
  content: string;
  tags: readonly string[];
  writtenAt: string;
}>;

const MAX_RESULT_COUNT: number = 6;
const SNIPPET_RADIUS: number = 18;

function createSearchablePoem(poem: Poem): SearchablePoem {
  return {
    id: poem.id,
    title: poem.title,
    content: poem.content,
    tags: poem.tags,
    writtenAt: poem.writtenAt,
  };
}

function createFuseIndex(poems: readonly Poem[]): Fuse<SearchablePoem> {
  const searchablePoems: readonly SearchablePoem[] = poems.map(
    createSearchablePoem,
  );

  return new Fuse(searchablePoems, {
    includeMatches: true,
    ignoreLocation: true,
    keys: [
      { name: "title", weight: 0.4 },
      { name: "tags", weight: 0.34 },
      { name: "content", weight: 0.26 },
    ],
    minMatchCharLength: 1,
    threshold: 0.35,
  });
}

function normalizeQuery(value: string): string {
  return value.trim();
}

function getMatchedValue(
  match: FuseResultMatch,
): string | null {
  const value: unknown = match.value;
  return typeof value === "string" ? value : null;
}

function createSnippetFromMatch(match: FuseResultMatch): string | null {
  const value: string | null = getMatchedValue(match);
  const firstRange: readonly [number, number] | undefined =
    match.indices[0];
  if (value === null || firstRange === undefined) {
    return null;
  }

  const startIndex: number = Math.max(0, firstRange[0] - SNIPPET_RADIUS);
  const endIndex: number = Math.min(
    value.length,
    firstRange[1] + SNIPPET_RADIUS + 1,
  );
  const prefix: string = startIndex > 0 ? "..." : "";
  const suffix: string = endIndex < value.length ? "..." : "";
  return `${prefix}${value.slice(startIndex, endIndex)}${suffix}`;
}

function getResultSnippet(result: FuseResult<SearchablePoem>): string {
  const matches: readonly FuseResultMatch[] = result.matches ?? [];
  const contentMatch: FuseResultMatch | undefined = matches.find(
    (match: FuseResultMatch): boolean => match.key === "content",
  );
  const tagMatch: FuseResultMatch | undefined = matches.find(
    (match: FuseResultMatch): boolean => match.key === "tags",
  );
  const titleMatch: FuseResultMatch | undefined = matches.find(
    (match: FuseResultMatch): boolean => match.key === "title",
  );
  const snippet: string | null = [
    contentMatch,
    tagMatch,
    titleMatch,
  ].reduce(
    (
      currentSnippet: string | null,
      match: FuseResultMatch | undefined,
    ): string | null => currentSnippet ?? (
      match === undefined ? null : createSnippetFromMatch(match)
    ),
    null,
  );

  return snippet ?? result.item.content.slice(0, 36);
}

function formatWrittenAt(value: string): string {
  const parts: readonly string[] = value.split("-");
  if (parts.length !== 3) {
    return value;
  }
  return `${parts[0]}年${parts[1]}月${parts[2]}日`;
}

export function PoemSearchPanel(
  props: PoemSearchPanelProps,
): React.ReactElement {
  const [query, setQuery] = useState<string>("");
  const selectPoem = useGalaxyStore((state) => state.selectPoem);
  const fuseIndex: Fuse<SearchablePoem> = useMemo(
    (): Fuse<SearchablePoem> => createFuseIndex(props.poems),
    [props.poems],
  );
  const normalizedQuery: string = normalizeQuery(query);
  const results: readonly FuseResult<SearchablePoem>[] = useMemo(
    (): readonly FuseResult<SearchablePoem>[] => {
      if (normalizedQuery.length === 0) {
        return [];
      }
      return fuseIndex.search(normalizedQuery, {
        limit: MAX_RESULT_COUNT,
      });
    },
    [fuseIndex, normalizedQuery],
  );
  const hasQuery: boolean = normalizedQuery.length > 0;
  const hasResults: boolean = results.length > 0;

  function handleQueryChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ): void {
    setQuery(event.target.value);
  }

  function handleResultClick(poemId: string): void {
    selectPoem(poemId);
  }

  return (
    <section aria-label="诗歌全文搜索" className="poem-search">
      <label className="poem-search-label" htmlFor="poem-search-input">
        搜索诗歌
      </label>
      <input
        autoComplete="off"
        className="poem-search-input"
        id="poem-search-input"
        onChange={handleQueryChange}
        placeholder="输入标题、正文或标签"
        type="search"
        value={query}
      />

      {hasQuery ? (
        <div className="poem-search-results" role="status">
          {hasResults ? (
            <ul>
              {results.map(
                (
                  result: FuseResult<SearchablePoem>,
                ): React.ReactElement => (
                  <li key={result.item.id}>
                    <button
                      onClick={(): void => {
                        handleResultClick(result.item.id);
                      }}
                      type="button"
                    >
                      <span className="poem-search-result-title">
                        {result.item.title}
                      </span>
                      <span className="poem-search-result-meta">
                        {formatWrittenAt(result.item.writtenAt)}
                      </span>
                      <span className="poem-search-result-snippet">
                        {getResultSnippet(result)}
                      </span>
                    </button>
                  </li>
                ),
              )}
            </ul>
          ) : (
            <p className="poem-search-empty">
              没有找到匹配的诗歌，请换一个关键词。
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
