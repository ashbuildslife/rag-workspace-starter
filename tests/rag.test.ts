import { describe, it, expect } from "vitest";
import { demoSnapshot, demoParserResults, demoSearchHistory, demoDocuments } from "@/lib/demo-data";

describe("search results", () => {
  it("has results from multiple methods", () => {
    const methods = new Set(demoSnapshot.searchResults.map(r => r.method));
    expect(methods.size).toBeGreaterThanOrEqual(2);
  });

  it("has at least one high-confidence result", () => {
    expect(demoSnapshot.searchResults.some(r => r.confidence === "high")).toBe(true);
  });

  it("has low-confidence result flagged", () => {
    expect(demoSnapshot.searchResults.some(r => r.confidence === "low")).toBe(true);
  });

  it("answer has citations", () => {
    expect(demoSnapshot.answer?.citations.length).toBeGreaterThanOrEqual(2);
  });
});

describe("parser pipeline", () => {
  it("identifies best parser", () => {
    const best = [...demoParserResults].sort((a, b) => b.quality - a.quality)[0];
    expect(best.quality).toBeGreaterThanOrEqual(80);
  });

  it("baseline parser has lowest quality", () => {
    const baseline = demoParserResults.find(p => p.parser === "pypdf-baseline");
    expect(baseline?.quality).toBeLessThan(50);
  });
});

describe("ingestion", () => {
  it("all documents have parse quality", () => {
    for (const doc of demoDocuments) {
      expect(doc.parseQuality).toBeGreaterThan(0);
    }
  });

  it("search history is ordered", () => {
    const times = demoSearchHistory.map(h => new Date(h.searchedAt).getTime());
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeLessThanOrEqual(times[i-1]);
    }
  });
});
