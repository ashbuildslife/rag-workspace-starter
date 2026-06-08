import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAG Workspace",
  description: "Hybrid search, multi-parser document ingestion, confidence-gated answers, and citation-linked RAG workspace."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
