"use client";

import type {
  PoemFilterOptions,
  PoemFilterState,
} from "@/lib/poem-filters";

type PoemFilterPanelProps = Readonly<{
  filters: PoemFilterState;
  matchedCount: number;
  options: PoemFilterOptions;
  totalCount: number;
  onClear: () => void;
  onToggleCiTune: (value: string) => void;
  onToggleCollection: (value: string) => void;
  onToggleClassicalForm: (value: string) => void;
  onToggleQuTune: (value: string) => void;
  onToggleYear: (value: string) => void;
}>;

type FilterGroupProps = Readonly<{
  label: string;
  name: string;
  options: readonly string[];
  selectedValues: readonly string[];
  onToggle: (value: string) => void;
}>;

function isSelected(
  selectedValues: readonly string[],
  value: string,
): boolean {
  return selectedValues.includes(value);
}

function FilterGroup(props: FilterGroupProps): React.ReactElement {
  return (
    <fieldset className="poem-filter-group">
      <legend>{props.label}</legend>
      <div className="poem-filter-options">
        {props.options.map((option: string): React.ReactElement => (
          <label key={option} className="poem-filter-option">
            <input
              checked={isSelected(props.selectedValues, option)}
              name={props.name}
              onChange={(): void => {
                props.onToggle(option);
              }}
              type="checkbox"
              value={option}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PoemFilterPanel(
  props: PoemFilterPanelProps,
): React.ReactElement {
  const hasMatchedAll: boolean = props.matchedCount === props.totalCount;

  return (
    <aside aria-label="诗云筛选" className="poem-filter-panel">
      <div className="poem-filter-header">
        <div>
          <p>筛选星体</p>
          <strong>
            {props.matchedCount} / {props.totalCount}
          </strong>
        </div>
        <button
          disabled={hasMatchedAll}
          onClick={props.onClear}
          type="button"
        >
          清除全部
        </button>
      </div>

      <FilterGroup
        label="诗集"
        name="collection"
        onToggle={props.onToggleCollection}
        options={props.options.collections}
        selectedValues={props.filters.collections}
      />
      <FilterGroup
        label="体裁格律"
        name="classical-form"
        onToggle={props.onToggleClassicalForm}
        options={props.options.classicalForms}
        selectedValues={props.filters.classicalForms}
      />
      <FilterGroup
        label="词牌名"
        name="ci-tune"
        onToggle={props.onToggleCiTune}
        options={props.options.ciTunes}
        selectedValues={props.filters.ciTunes}
      />
      <FilterGroup
        label="曲牌名"
        name="qu-tune"
        onToggle={props.onToggleQuTune}
        options={props.options.quTunes}
        selectedValues={props.filters.quTunes}
      />
      <FilterGroup
        label="年份"
        name="year"
        onToggle={props.onToggleYear}
        options={props.options.years}
        selectedValues={props.filters.years}
      />
    </aside>
  );
}
