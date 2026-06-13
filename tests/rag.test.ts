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

  it("citations include claim coverage notes", () => {
    const citations = demoSnapshot.answer?.citations ?? [];
    expect(citations.some(c => c.coverage === "direct")).toBe(true);
    for (const citation of citations) {
      expect(citation.verificationNote.length).toBeGreaterThan(24);
    }
  });

  it("direct citations map back to retrieved chunks", () => {
    const directCitations = demoSnapshot.answer?.citations.filter(c => c.coverage === "direct") ?? [];
    expect(directCitations.length).toBeGreaterThanOrEqual(2);

    for (const citation of directCitations) {
      const matchingResult = demoSnapshot.searchResults.find(result =>
        result.documentName === citation.documentName &&
        result.score >= citation.score - 0.01 &&
        result.confidence === "high"
      );
      expect(matchingResult).toBeDefined();
    }
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
