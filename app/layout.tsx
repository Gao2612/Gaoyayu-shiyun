import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "梦痕",
  description: "只收录一位作者作品的三维诗歌宇宙",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout(
  props: RootLayoutProps,
): React.ReactElement {
  return (
    <html lang="zh-CN">
      <body>{props.children}</body>
    </html>
  );
}
