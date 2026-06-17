import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { NextResponse } from "next/server";
import { z } from "zod";

import poemData from "@/data/poems.json";
import type { Poem } from "@/types/poem";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const DATE_PATTERN: RegExp = /^\d{4}-\d{2}-\d{2}$/;
const POEM_ID_PATTERN: RegExp = /^\d{3,}$/;
const POEM_FILE_PATTERN: RegExp = /^(\d{3,})-/;
const POEMS: readonly Poem[] = poemData as unknown as readonly Poem[];

const textListSchema = z.array(
  z.string().trim().min(1, "列表项不能为空"),
);

const adminPoemSchema = z.object({
  id: z.string().trim().regex(POEM_ID_PATTERN, "编号必须至少为三位数字"),
  title: z.string().trim().min(1, "标题不能为空"),
  writtenAt: z.string().trim().regex(DATE_PATTERN, "日期必须使用 YYYY-MM-DD"),
  tags: textListSchema.min(1, "至少需要一个标签"),
  location: z.string().trim().min(1).nullable(),
  collection: z.string().trim().min(1, "诗集不能为空"),
  emotions: textListSchema,
  classicalForms: textListSchema.min(1, "至少需要一种体裁格律"),
  ciTune: z.string().trim().min(1).nullable(),
  quTune: z.string().trim().min(1).nullable(),
  featured: z.boolean(),
  rating: z.number().int().min(1).max(5),
  relatedPoemIds: textListSchema,
  content: z.string().trim().min(1, "正文不能为空"),
});

type AdminPoemInput = z.infer<typeof adminPoemSchema>;

type AdminPoemOptions = Readonly<{
  nextId: string;
  collections: readonly string[];
  classicalForms: readonly string[];
  ciTunes: readonly string[];
  quTunes: readonly string[];
}>;

function getProjectRoot(): string {
  return process.cwd();
}

function getPoemsDirectory(): string {
  return path.join(getProjectRoot(), "content", "poems");
}

function getSortedValues(values: readonly string[]): readonly string[] {
  return [...new Set(values)]
    .filter((value: string): boolean => value.trim().length > 0)
    .sort((left: string, right: string): number =>
      left.localeCompare(right, "zh-CN"),
    );
}

async function getExistingPoemIds(): Promise<readonly string[]> {
  const entries: readonly string[] = await readdir(getPoemsDirectory());
  return entries
    .map((fileName: string): string | null => {
      const match: RegExpMatchArray | null = fileName.match(POEM_FILE_PATTERN);
      return match === null ? null : match[1];
    })
    .filter((id: string | null): id is string => id !== null);
}

function formatPoemId(value: number): string {
  return value.toString().padStart(3, "0");
}

async function getNextPoemId(): Promise<string> {
  const existingIds: readonly string[] = await getExistingPoemIds();
  const maxId: number = existingIds.reduce(
    (currentMax: number, id: string): number =>
      Math.max(currentMax, Number(id)),
    0,
  );
  return formatPoemId(maxId + 1);
}

function createOptions(nextId: string): AdminPoemOptions {
  return {
    nextId,
    collections: getSortedValues(
      POEMS.map((poem: Poem): string => poem.collection),
    ),
    classicalForms: getSortedValues(
      POEMS.flatMap((poem: Poem): readonly string[] =>
        poem.classicalForms,
      ),
    ),
    ciTunes: getSortedValues(
      POEMS.flatMap((poem: Poem): readonly string[] =>
        poem.ciTune === null ? [] : [poem.ciTune],
      ),
    ),
    quTunes: getSortedValues(
      POEMS.flatMap((poem: Poem): readonly string[] =>
        poem.quTune === null ? [] : [poem.quTune],
      ),
    ),
  };
}

function sanitizeFileSegment(value: string): string {
  const normalizedValue: string = value
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .trim();

  if (normalizedValue.length === 0) {
    return "未命名";
  }

  return normalizedValue.slice(0, 48);
}

function escapeYamlText(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function createYamlListBlock(name: string, values: readonly string[]): string {
  if (values.length === 0) {
    return `${name}: []`;
  }

  return [
    `${name}:`,
    ...values
    .map((value: string): string => `  - ${escapeYamlText(value)}`)
  ].join("\n");
}

function createNullableYamlField(name: string, value: string | null): string {
  if (value === null) {
    return `${name}: null`;
  }

  return `${name}: ${escapeYamlText(value)}`;
}

function createMarkdown(input: AdminPoemInput): string {
  return [
    "---",
    `id: ${escapeYamlText(input.id)}`,
    `title: ${escapeYamlText(input.title)}`,
    `writtenAt: ${escapeYamlText(input.writtenAt)}`,
    createYamlListBlock("tags", input.tags),
    createNullableYamlField("location", input.location),
    `collection: ${escapeYamlText(input.collection)}`,
    createYamlListBlock("emotions", input.emotions),
    createYamlListBlock("classicalForms", input.classicalForms),
    createNullableYamlField("ciTune", input.ciTune),
    createNullableYamlField("quTune", input.quTune),
    `featured: ${input.featured ? "true" : "false"}`,
    `rating: ${input.rating}`,
    createYamlListBlock("relatedPoemIds", input.relatedPoemIds),
    "---",
    "",
    input.content.trim(),
    "",
  ].join("\n");
}

function createPoemFilePath(input: AdminPoemInput): string {
  const fileName: string = `${input.id}-${sanitizeFileSegment(input.title)}.md`;
  return path.join(getPoemsDirectory(), fileName);
}

async function assertPoemCanBeCreated(input: AdminPoemInput): Promise<void> {
  const existingIds: readonly string[] = await getExistingPoemIds();
  if (existingIds.includes(input.id)) {
    throw new Error(`编号 ${input.id} 已存在，请换一个编号。`);
  }

  const filePath: string = createPoemFilePath(input);
  if (existsSync(filePath)) {
    throw new Error(`文件已存在：${path.basename(filePath)}`);
  }
}

async function rebuildPoemData(): Promise<void> {
  const command: string = process.platform === "win32" ? "npm.cmd" : "npm";
  try {
    await execFileAsync(command, ["run", "layout:build"], {
      cwd: getProjectRoot(),
      timeout: 180000,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`诗歌已写入，但重建数据失败：${error.message}`);
    }
    throw new Error("诗歌已写入，但重建数据失败：未知错误");
  }
}

function createErrorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ message }, { status });
}

export async function GET(): Promise<NextResponse> {
  const nextId: string = await getNextPoemId();
  return NextResponse.json(createOptions(nextId));
}

export async function POST(request: Request): Promise<NextResponse> {
  const parsedBody: unknown = await request.json();
  const validation = adminPoemSchema.safeParse(parsedBody);

  if (!validation.success) {
    return createErrorResponse(
      validation.error.issues
        .map((issue: z.ZodIssue): string =>
          `${issue.path.join(".")}: ${issue.message}`,
        )
        .join("；"),
      400,
    );
  }

  try {
    await mkdir(getPoemsDirectory(), { recursive: true });
    await assertPoemCanBeCreated(validation.data);
    await writeFile(
      createPoemFilePath(validation.data),
      createMarkdown(validation.data),
      "utf8",
    );
    await rebuildPoemData();
    const nextId: string = await getNextPoemId();
    return NextResponse.json({
      message: `已保存《${validation.data.title}》，并完成星云数据重建。`,
      nextId,
    });
  } catch (error: unknown) {
    const message: string = error instanceof Error
      ? error.message
      : "保存失败：未知错误";
    return createErrorResponse(message, 500);
  }
}
