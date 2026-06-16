import type { Poem } from "@/types/poem";

export type PoemFilterState = Readonly<{
  collections: readonly string[];
  classicalForms: readonly string[];
  ciTunes: readonly string[];
  quTunes: readonly string[];
  years: readonly string[];
}>;

export type PoemFilterOptions = Readonly<{
  collections: readonly string[];
  classicalForms: readonly string[];
  ciTunes: readonly string[];
  quTunes: readonly string[];
  years: readonly string[];
}>;

export const EMPTY_POEM_FILTERS: PoemFilterState = {
  collections: [],
  classicalForms: [],
  ciTunes: [],
  quTunes: [],
  years: [],
};

function getPoemYear(poem: Poem): string {
  return poem.writtenAt.slice(0, 4);
}

function getSortedValues(values: readonly string[]): readonly string[] {
  return [...new Set(values)]
    .filter((value: string): boolean => value.trim().length > 0)
    .sort((firstValue: string, secondValue: string): number =>
      firstValue.localeCompare(secondValue, "zh-CN"),
    );
}

function hasSelectedValue(
  selectedValues: readonly string[],
  value: string,
): boolean {
  return selectedValues.length === 0 || selectedValues.includes(value);
}

function hasSelectedIntersection(
  selectedValues: readonly string[],
  values: readonly string[],
): boolean {
  return selectedValues.length === 0
    || values.some((value: string): boolean => selectedValues.includes(value));
}

export function createPoemFilterOptions(
  poems: readonly Poem[],
): PoemFilterOptions {
  return {
    collections: getSortedValues(
      poems.map((poem: Poem): string => poem.collection),
    ),
    classicalForms: getSortedValues(
      poems.flatMap((poem: Poem): readonly string[] =>
        poem.classicalForms,
      ),
    ),
    ciTunes: getSortedValues(
      poems.flatMap((poem: Poem): readonly string[] =>
        poem.ciTune === null ? [] : [poem.ciTune],
      ),
    ),
    quTunes: getSortedValues(
      poems.flatMap((poem: Poem): readonly string[] =>
        poem.quTune === null ? [] : [poem.quTune],
      ),
    ),
    years: getSortedValues(
      poems.map((poem: Poem): string => getPoemYear(poem)),
    ),
  };
}

export function hasActivePoemFilters(
  filters: PoemFilterState,
): boolean {
  return filters.collections.length > 0
    || filters.classicalForms.length > 0
    || filters.ciTunes.length > 0
    || filters.quTunes.length > 0
    || filters.years.length > 0;
}

export function poemMatchesFilters(
  poem: Poem,
  filters: PoemFilterState,
): boolean {
  return hasSelectedValue(filters.collections, poem.collection)
    && hasSelectedIntersection(filters.classicalForms, poem.classicalForms)
    && hasSelectedValue(filters.ciTunes, poem.ciTune ?? "")
    && hasSelectedValue(filters.quTunes, poem.quTune ?? "")
    && hasSelectedValue(filters.years, getPoemYear(poem));
}

export function filterPoems(
  poems: readonly Poem[],
  filters: PoemFilterState,
): readonly Poem[] {
  return poems.filter((poem: Poem): boolean =>
    poemMatchesFilters(poem, filters),
  );
}

export function togglePoemFilterValue(
  values: readonly string[],
  value: string,
): readonly string[] {
  if (values.includes(value)) {
    return values.filter(
      (selectedValue: string): boolean => selectedValue !== value,
    );
  }
  return [...values, value];
}
