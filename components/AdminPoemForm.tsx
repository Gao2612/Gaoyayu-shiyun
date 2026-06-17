"use client";

import { useEffect, useMemo, useState } from "react";

type AdminPoemOptions = Readonly<{
  nextId: string;
  collections: readonly string[];
  classicalForms: readonly string[];
  ciTunes: readonly string[];
  quTunes: readonly string[];
}>;

type AdminPoemPayload = Readonly<{
  id: string;
  title: string;
  writtenAt: string;
  tags: readonly string[];
  location: string | null;
  collection: string;
  emotions: readonly string[];
  classicalForms: readonly string[];
  ciTune: string | null;
  quTune: string | null;
  featured: boolean;
  rating: number;
  relatedPoemIds: readonly string[];
  content: string;
}>;

type SubmitState = Readonly<{
  status: "idle" | "loading" | "success" | "error";
  message: string;
}>;

const EMPTY_OPTIONS: AdminPoemOptions = {
  nextId: "031",
  collections: [],
  classicalForms: [],
  ciTunes: [],
  quTunes: [],
};

function splitList(value: string): readonly string[] {
  return value
    .split(/[,，、\n]/)
    .map((item: string): string => item.trim())
    .filter((item: string): boolean => item.length > 0);
}

function getTodayText(): string {
  return new Date().toISOString().slice(0, 10);
}

function createPayload(
  id: string,
  title: string,
  writtenAt: string,
  tagsText: string,
  location: string,
  collection: string,
  emotionsText: string,
  classicalFormsText: string,
  ciTune: string,
  quTune: string,
  featured: boolean,
  rating: number,
  relatedPoemIdsText: string,
  content: string,
): AdminPoemPayload {
  return {
    id: id.trim(),
    title: title.trim(),
    writtenAt: writtenAt.trim(),
    tags: splitList(tagsText),
    location: location.trim().length === 0 ? null : location.trim(),
    collection: collection.trim(),
    emotions: splitList(emotionsText),
    classicalForms: splitList(classicalFormsText),
    ciTune: ciTune.trim().length === 0 ? null : ciTune.trim(),
    quTune: quTune.trim().length === 0 ? null : quTune.trim(),
    featured,
    rating,
    relatedPoemIds: splitList(relatedPoemIdsText),
    content: content.trim(),
  };
}

export function AdminPoemForm(): React.ReactElement {
  const [options, setOptions] = useState<AdminPoemOptions>(EMPTY_OPTIONS);
  const [id, setId] = useState<string>(EMPTY_OPTIONS.nextId);
  const [title, setTitle] = useState<string>("");
  const [writtenAt, setWrittenAt] = useState<string>(getTodayText());
  const [tagsText, setTagsText] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [collection, setCollection] = useState<string>("梦痕");
  const [emotionsText, setEmotionsText] = useState<string>("");
  const [classicalFormsText, setClassicalFormsText] = useState<string>("七言, 绝句");
  const [ciTune, setCiTune] = useState<string>("");
  const [quTune, setQuTune] = useState<string>("");
  const [featured, setFeatured] = useState<boolean>(false);
  const [rating, setRating] = useState<number>(4);
  const [relatedPoemIdsText, setRelatedPoemIdsText] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
    message: "录入后会自动重建诗歌数据、语义向量和三维布局。",
  });
  const isSubmitting: boolean = submitState.status === "loading";
  const previewPayload: AdminPoemPayload = useMemo(
    (): AdminPoemPayload => createPayload(
      id,
      title,
      writtenAt,
      tagsText,
      location,
      collection,
      emotionsText,
      classicalFormsText,
      ciTune,
      quTune,
      featured,
      rating,
      relatedPoemIdsText,
      content,
    ),
    [
      id,
      title,
      writtenAt,
      tagsText,
      location,
      collection,
      emotionsText,
      classicalFormsText,
      ciTune,
      quTune,
      featured,
      rating,
      relatedPoemIdsText,
      content,
    ],
  );

  useEffect((): (() => void) => {
    let isMounted: boolean = true;

    async function loadOptions(): Promise<void> {
      const response: Response = await fetch("/api/admin/poems", {
        method: "GET",
      });
      if (!response.ok) {
        return;
      }

      const data: AdminPoemOptions = await response.json();
      if (!isMounted) {
        return;
      }

      setOptions(data);
      setId(data.nextId);
      if (data.collections.length > 0) {
        setCollection(data.collections[0]);
      }
    }

    void loadOptions();

    return (): void => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setSubmitState({
      status: "loading",
      message: "正在保存诗歌，并重建语义星云数据...",
    });

    const response: Response = await fetch("/api/admin/poems", {
      body: JSON.stringify(previewPayload),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const result: { message?: string; nextId?: string } = await response.json();

    if (!response.ok) {
      setSubmitState({
        status: "error",
        message: result.message ?? "保存失败，请检查字段。",
      });
      return;
    }

    setSubmitState({
      status: "success",
      message: result.message ?? "保存成功，前台刷新后即可看到新诗。",
    });
    if (typeof result.nextId === "string") {
      setId(result.nextId);
    }
    setTitle("");
    setTagsText("");
    setLocation("");
    setEmotionsText("");
    setClassicalFormsText("七言, 绝句");
    setCiTune("");
    setQuTune("");
    setFeatured(false);
    setRating(4);
    setRelatedPoemIdsText("");
    setContent("");
  }

  return (
    <div className="admin-shell">
      <header className="admin-hero">
        <p>本地管理后台</p>
        <h1>录入诗词</h1>
        <span>
          提交后会写入 Markdown 文件，并自动更新搜索、筛选、语义向量和星云坐标。
        </span>
      </header>

      <form className="admin-form" onSubmit={handleSubmit}>
        <section className="admin-card">
          <h2>基础信息</h2>
          <div className="admin-grid">
            <label>
              编号
              <input
                onChange={(event): void => {
                  setId(event.target.value);
                }}
                required
                value={id}
              />
            </label>
            <label>
              标题
              <input
                onChange={(event): void => {
                  setTitle(event.target.value);
                }}
                placeholder="例如：临江仙·春夜"
                required
                value={title}
              />
            </label>
            <label>
              创作日期
              <input
                onChange={(event): void => {
                  setWrittenAt(event.target.value);
                }}
                required
                type="date"
                value={writtenAt}
              />
            </label>
            <label>
              诗集
              <input
                list="collection-options"
                onChange={(event): void => {
                  setCollection(event.target.value);
                }}
                required
                value={collection}
              />
              <datalist id="collection-options">
                {options.collections.map((value: string): React.ReactElement => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </label>
            <label>
              地点
              <input
                onChange={(event): void => {
                  setLocation(event.target.value);
                }}
                placeholder="可留空"
                value={location}
              />
            </label>
            <label>
              推荐权重
              <select
                onChange={(event): void => {
                  setRating(Number(event.target.value));
                }}
                value={rating}
              >
                {[1, 2, 3, 4, 5].map((value: number): React.ReactElement => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="admin-card">
          <h2>分类和检索</h2>
          <div className="admin-grid">
            <label>
              标签
              <input
                onChange={(event): void => {
                  setTagsText(event.target.value);
                }}
                placeholder="清晨, 城市"
                required
                value={tagsText}
              />
            </label>
            <label>
              情绪
              <input
                onChange={(event): void => {
                  setEmotionsText(event.target.value);
                }}
                placeholder="清寒, 怀远"
                value={emotionsText}
              />
            </label>
            <label>
              体裁格律
              <input
                list="form-options"
                onChange={(event): void => {
                  setClassicalFormsText(event.target.value);
                }}
                placeholder="七言, 律诗"
                required
                value={classicalFormsText}
              />
              <datalist id="form-options">
                {options.classicalForms.map((value: string): React.ReactElement => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </label>
            <label>
              词牌名
              <input
                list="ci-tune-options"
                onChange={(event): void => {
                  setCiTune(event.target.value);
                }}
                placeholder="不是词可留空"
                value={ciTune}
              />
              <datalist id="ci-tune-options">
                {options.ciTunes.map((value: string): React.ReactElement => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </label>
            <label>
              曲牌名
              <input
                list="qu-tune-options"
                onChange={(event): void => {
                  setQuTune(event.target.value);
                }}
                placeholder="不是曲可留空"
                value={quTune}
              />
              <datalist id="qu-tune-options">
                {options.quTunes.map((value: string): React.ReactElement => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </label>
            <label>
              相关诗编号
              <input
                onChange={(event): void => {
                  setRelatedPoemIdsText(event.target.value);
                }}
                placeholder="001, 008，可留空"
                value={relatedPoemIdsText}
              />
            </label>
          </div>
          <label className="admin-check">
            <input
              checked={featured}
              onChange={(event): void => {
                setFeatured(event.target.checked);
              }}
              type="checkbox"
            />
            设为重点诗作
          </label>
        </section>

        <section className="admin-card">
          <h2>正文</h2>
          <textarea
            onChange={(event): void => {
              setContent(event.target.value);
            }}
            placeholder={"逐行录入诗词正文\n例如：\n一灯照水客船孤，\n半枕潮声入梦初。"}
            required
            rows={12}
            value={content}
          />
        </section>

        <section className="admin-preview">
          <h2>提交预览</h2>
          <pre>{JSON.stringify(previewPayload, null, 2)}</pre>
        </section>

        <footer className="admin-actions">
          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? "正在保存..." : "保存并重建星云"}
          </button>
          <p className={`admin-message admin-message-${submitState.status}`}>
            {submitState.message}
          </p>
        </footer>
      </form>
    </div>
  );
}
