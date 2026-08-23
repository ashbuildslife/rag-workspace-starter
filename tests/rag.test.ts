import { describe, it, expect } from "vitest";
import { demoSnapshot, demoParserResults, demoSearchHistory, demoDocuments, demoGoldenEvalSuite } from "@/lib/demo-data";

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

describe("retrieval safety review", () => {
  it("flags embedded instruction and egress requests before answer use", () => {
    const unsafeResults = demoSnapshot.searchResults.filter(r => r.safetyReview.status !== "allowed");
    expect(unsafeResults.length).toBeGreaterThanOrEqual(2);

    const egressRisk = unsafeResults.find(r => r.safetyReview.risk === "egress_request");
    expect(egressRisk).toBeDefined();
    expect(egressRisk?.safetyReview.status).toBe("blocked");
    expect(egressRisk?.safetyReview.externalTarget).toMatch(/vendor-audit/);
    expect(egressRisk?.safetyReview.reviewNote).toMatch(/external target|block/i);
  });

  it("keeps blocked retrievals out of generated citations", () => {
    const blockedResults = demoSnapshot.searchResults.filter(r => r.safetyReview.status === "blocked");
    const citations = demoSnapshot.answer?.citations ?? [];
    expect(blockedResults.length).toBeGreaterThan(0);

    for (const result of blockedResults) {
      expect(citations.some(citation => citation.documentName === result.documentName)).toBe(false);
    }
  });

  it("uses only safety-cleared retrievals for direct citations", () => {
    const directCitations = demoSnapshot.answer?.citations.filter(c => c.coverage === "direct") ?? [];
    expect(directCitations.length).toBeGreaterThan(0);

    for (const citation of directCitations) {
      const matchingResult = demoSnapshot.searchResults.find(result =>
        result.documentName === citation.documentName && result.score >= citation.score - 0.01
      );
      expect(matchingResult?.safetyReview.status).toBe("allowed");
    }
  });
});

describe("retrieval source authority", () => {
  it("records an owned source-authority decision before model context assembly", () => {
    for (const result of demoSnapshot.searchResults) {
      expect(result.sourceAuthorityReview.checkedBeforeModel).toBe(true);
      expect(result.sourceAuthorityReview.owner).toBeTruthy();
      expect(result.sourceAuthorityReview.sourceSystem).toBeTruthy();
      expect(result.sourceAuthorityReview.reviewNote.length).toBeGreaterThan(32);
    }
  });

  it("allows direct citations only from sources of record", () => {
    const directCitations = demoSnapshot.answer?.citations.filter(citation => citation.coverage === "direct") ?? [];
    expect(directCitations.length).toBeGreaterThan(0);

    for (const citation of directCitations) {
      const matchingResult = demoSnapshot.searchResults.find(result => result.documentName === citation.documentName);
      expect(matchingResult?.sourceAuthorityReview.level).toBe("source_of_record");
      expect(matchingResult?.sourceAuthorityReview.answerUse).toBe("direct");
    }
  });

  it("keeps unverified or authority-blocked sources out of citations", () => {
    const blockedResults = demoSnapshot.searchResults.filter(
      result => result.sourceAuthorityReview.level === "unverified" || result.sourceAuthorityReview.answerUse === "blocked"
    );
    const citations = demoSnapshot.answer?.citations ?? [];
    expect(blockedResults.length).toBeGreaterThan(0);

    for (const result of blockedResults) {
      expect(result.sourceAuthorityReview.answerUse).toBe("blocked");
      expect(citations.some(citation => citation.documentName === result.documentName)).toBe(false);
    }
  });
});

describe("retrieval source versioning", () => {
  it("checks every retrieved source version before model context assembly", () => {
    for (const result of demoSnapshot.searchResults) {
      expect(result.versionReview.checkedBeforeModel).toBe(true);
      expect(result.versionReview.indexedVersionId).toBeTruthy();
      expect(result.versionReview.reviewNote.length).toBeGreaterThan(32);
    }
  });

  it("fails closed for superseded and unregistered source versions", () => {
    const heldResults = demoSnapshot.searchResults.filter(result => result.versionReview.status !== "current");
    expect(heldResults.some(result => result.versionReview.status === "superseded")).toBe(true);
    expect(heldResults.some(result => result.versionReview.status === "unregistered")).toBe(true);

    for (const result of heldResults) {
      expect(result.versionReview.answerUse).toBe("blocked");
      if (result.versionReview.status === "superseded") {
        expect(result.versionReview.currentVersionId).not.toBe(result.versionReview.indexedVersionId);
        expect(result.versionReview.supersededBy).toBeTruthy();
      }
    }
  });

  it("keeps version-blocked retrievals out of generated citations", () => {
    const blockedResults = demoSnapshot.searchResults.filter(result => result.versionReview.answerUse === "blocked");
    const citations = demoSnapshot.answer?.citations ?? [];
    expect(blockedResults.length).toBeGreaterThan(0);

    for (const result of blockedResults) {
      expect(citations.some(citation => citation.documentName === result.documentName)).toBe(false);
    }
  });
});

describe("retrieval source lifecycle", () => {
  it("checks every retrieval for source deletion state before model context assembly", () => {
    for (const result of demoSnapshot.searchResults) {
      expect(result.sourceLifecycleReview.checkedBeforeModel).toBe(true);
      expect(result.sourceLifecycleReview.reviewNote.length).toBeGreaterThan(32);
      if (result.sourceLifecycleReview.status === "active") {
        expect(result.sourceLifecycleReview.tombstoneId).toBeNull();
        expect(result.sourceLifecycleReview.answerUse).toBe("allowed");
      } else {
        expect(result.sourceLifecycleReview.tombstoneId).toMatch(/^tombstone:/);
        expect(result.sourceLifecycleReview.answerUse).toBe("blocked");
      }
    }
  });

  it("blocks tombstoned source artifacts even when other retrieval gates pass", () => {
    const tombstoned = demoSnapshot.searchResults.filter(
      result => result.sourceLifecycleReview.status === "tombstoned"
    );
    expect(tombstoned.length).toBeGreaterThan(0);

    for (const result of tombstoned) {
      expect(result.sourceLifecycleReview.answerUse).toBe("blocked");
      expect(result.safetyReview.status).toBe("allowed");
      expect(result.relevanceReview.status).toBe("relevant");
      expect(result.sourceAuthorityReview.answerUse).toBe("direct");
      expect(result.versionReview.answerUse).toBe("allowed");
      expect(result.deduplicationReview.answerUse).toBe("allowed");
      expect(result.conflictReview.answerUse).toBe("allowed");
      expect(result.authorizationReview.status).toBe("authorized");
    }
  });

  it("keeps tombstoned chunks out of generated citations", () => {
    const tombstonedChunkIds = new Set(
      demoSnapshot.searchResults
        .filter(result => result.sourceLifecycleReview.status === "tombstoned")
        .map(result => result.chunkId)
    );
    expect(tombstonedChunkIds.size).toBeGreaterThan(0);

    for (const citation of demoSnapshot.answer?.citations ?? []) {
      expect(tombstonedChunkIds.has(citation.sourceChunkId)).toBe(false);
    }
  });
});

describe("retrieval deduplication", () => {
  it("fingerprints every retrieval before model context assembly", () => {
    for (const result of demoSnapshot.searchResults) {
      expect(result.deduplicationReview.checkedBeforeModel).toBe(true);
      expect(result.deduplicationReview.contentFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(result.deduplicationReview.canonicalChunkId).toBeTruthy();
      expect(result.deduplicationReview.reviewNote.length).toBeGreaterThan(32);
    }
  });

  it("suppresses byte-exact duplicates in favor of one canonical chunk", () => {
    const suppressed = demoSnapshot.searchResults.filter(
      result => result.deduplicationReview.status === "suppressed_duplicate"
    );
    expect(suppressed.length).toBeGreaterThan(0);

    for (const result of suppressed) {
      const canonical = demoSnapshot.searchResults.find(
        candidate => candidate.chunkId === result.deduplicationReview.canonicalChunkId
      );
      expect(result.deduplicationReview.duplicateType).toBe("byte_exact");
      expect(result.deduplicationReview.answerUse).toBe("blocked");
      expect(canonical?.deduplicationReview.status).toBe("canonical");
      expect(canonical?.deduplicationReview.answerUse).toBe("allowed");
      expect(canonical?.deduplicationReview.contentFingerprint).toBe(result.deduplicationReview.contentFingerprint);
      expect(canonical?.chunkText).toBe(result.chunkText);
    }
  });

  it("keeps duplicate-suppressed chunks out of generated citations", () => {
    const blockedChunkIds = new Set(
      demoSnapshot.searchResults
        .filter(result => result.deduplicationReview.answerUse === "blocked")
        .map(result => result.chunkId)
    );
    const citations = demoSnapshot.answer?.citations ?? [];
    expect(blockedChunkIds.size).toBeGreaterThan(0);

    for (const citation of citations) {
      expect(blockedChunkIds.has(citation.sourceChunkId)).toBe(false);
      const source = demoSnapshot.searchResults.find(result => result.chunkId === citation.sourceChunkId);
      expect(source?.deduplicationReview.answerUse).toBe("allowed");
    }
  });
});

describe("retrieval conflict review", () => {
  it("checks every retrieval for evidence conflicts before model context assembly", () => {
    for (const result of demoSnapshot.searchResults) {
      expect(result.conflictReview.checkedBeforeModel).toBe(true);
      expect(result.conflictReview.reviewNote.length).toBeGreaterThan(32);
    }
  });

  it("records a reciprocal conflict and resolves it by source authority", () => {
    const held = demoSnapshot.searchResults.find(result => result.conflictReview.answerUse === "blocked");
    expect(held).toBeDefined();
    expect(held?.conflictReview.status).toBe("conflict_detected");
    expect(held?.conflictReview.resolution).toBe("source_authority");
    expect(held?.sourceAuthorityReview.level).toBe("approved_reference");

    const preferred = demoSnapshot.searchResults.find(
      result => held?.conflictReview.conflictsWithChunkIds.includes(result.chunkId)
    );
    expect(preferred?.conflictReview.status).toBe("conflict_detected");
    expect(preferred?.conflictReview.conflictsWithChunkIds).toContain(held?.chunkId);
    expect(preferred?.sourceAuthorityReview.level).toBe("source_of_record");
    expect(preferred?.conflictReview.answerUse).toBe("allowed");
  });

  it("keeps lower-authority conflicting evidence out of generated citations", () => {
    const heldChunkIds = new Set(
      demoSnapshot.searchResults
        .filter(result => result.conflictReview.answerUse === "blocked")
        .map(result => result.chunkId)
    );
    expect(heldChunkIds.size).toBeGreaterThan(0);

    for (const citation of demoSnapshot.answer?.citations ?? []) {
      expect(heldChunkIds.has(citation.sourceChunkId)).toBe(false);
      const source = demoSnapshot.searchResults.find(result => result.chunkId === citation.sourceChunkId);
      expect(source?.conflictReview.answerUse).toBe("allowed");
    }
  });
});

describe("retrieval authorization", () => {
  it("records pre-model permission checks for every retrieved chunk", () => {
    for (const result of demoSnapshot.searchResults) {
      expect(result.authorizationReview.checkedBeforeModel).toBe(true);
      expect(result.authorizationReview.reviewNote.length).toBeGreaterThan(32);
    }
  });

  it("keeps denied retrievals out of generated citations", () => {
    const deniedResults = demoSnapshot.searchResults.filter(r => r.authorizationReview.status === "denied");
    const citations = demoSnapshot.answer?.citations ?? [];
    expect(deniedResults.length).toBeGreaterThan(0);

    for (const result of deniedResults) {
      expect(result.authorizationReview.allowedAudiences).toHaveLength(0);
      expect(citations.some(citation => citation.documentName === result.documentName)).toBe(false);
    }
  });

  it("uses only authorized retrievals for direct citations", () => {
    const directCitations = demoSnapshot.answer?.citations.filter(c => c.coverage === "direct") ?? [];
    expect(directCitations.length).toBeGreaterThan(0);

    for (const citation of directCitations) {
      const matchingResult = demoSnapshot.searchResults.find(result =>
        result.documentName === citation.documentName && result.score >= citation.score - 0.01
      );
      expect(matchingResult?.authorizationReview.status).toBe("authorized");
    }
  });

  it("records source and indexed ACL versions for every permission check", () => {
    for (const result of demoSnapshot.searchResults) {
      expect(result.authorizationReview.sourceAclVersion).toBeTruthy();
      expect(result.authorizationReview.indexedAclVersion).toBeTruthy();
    }
  });

  it("fails closed when the indexed permission snapshot is stale", () => {
    const staleResults = demoSnapshot.searchResults.filter(
      result => result.authorizationReview.sourceAclVersion !== result.authorizationReview.indexedAclVersion
    );
    expect(staleResults.length).toBeGreaterThan(0);

    for (const result of staleResults) {
      expect(result.authorizationReview.permissionSnapshotStatus).toBe("stale");
      expect(result.authorizationReview.status).not.toBe("authorized");
      expect(result.authorizationReview.reviewNote).toMatch(/permissions changed|stale ACL/i);
    }
  });

  it("keeps stale permission snapshots out of generated citations", () => {
    const staleResults = demoSnapshot.searchResults.filter(
      result => result.authorizationReview.permissionSnapshotStatus === "stale"
    );
    const citations = demoSnapshot.answer?.citations ?? [];

    for (const result of staleResults) {
      expect(citations.some(citation => citation.documentName === result.documentName)).toBe(false);
    }
  });
});

describe("answer grounding audit", () => {
  it("accounts for cited and unsupported claims", () => {
    const audit = demoSnapshot.answer?.groundingAudit;
    expect(audit).toBeDefined();
    expect(audit!.citedClaims + audit!.unsupportedClaimCount).toBe(audit!.totalClaims);
    expect(audit!.citedClaims).toBe(demoSnapshot.answer?.citations.length);
  });

  it("requires review when an answer includes unsupported claims", () => {
    const audit = demoSnapshot.answer?.groundingAudit;
    expect(audit?.unsupportedClaimCount).toBeGreaterThan(0);
    expect(audit?.reviewRequired).toBe(true);
    expect(audit?.reviewNote).toMatch(/direct citation/i);
  });

  it("pauses answer release when grounding blockers remain", () => {
    const audit = demoSnapshot.answer?.groundingAudit;
    const gate = audit?.releaseGate;

    expect(gate?.status).toBe("review_required");
    expect(gate?.autoSendAllowed).toBe(false);
    expect(gate?.requiredReviewerRole).toBe("compliance_reviewer");
    const budgetHolds = audit!.contextBudgetReview.status === "over_budget" ? 1 : 0;
    expect(gate?.blockers).toHaveLength(audit!.unsupportedClaimCount + audit!.forceGapClaimCount + budgetHolds);
    expect(gate?.blockers.join(" ")).toMatch(/direct citation|Appendix B|budget/i);
  });

  it("keeps the release gate aligned with human-review state", () => {
    const audit = demoSnapshot.answer?.groundingAudit;
    const gate = audit?.releaseGate;

    expect(gate?.autoSendAllowed).toBe(!audit?.reviewRequired);
    expect(gate?.blockers.length).toBeGreaterThanOrEqual(audit!.unsupportedClaimCount);
  });

  it("maps every answer claim to attribution evidence or review action", () => {
    const audit = demoSnapshot.answer?.groundingAudit;
    expect(audit?.claimAttributions).toHaveLength(audit!.totalClaims);

    const supported = audit!.claimAttributions.filter(attribution => attribution.supportStatus === "supported");
    expect(supported).toHaveLength(audit!.citedClaims);

    for (const attribution of supported) {
      const matchingCitation = demoSnapshot.answer?.citations.find(citation =>
        citation.documentName === attribution.citationDocumentName &&
        citation.chunkPosition === attribution.citationChunkPosition
      );
      expect(matchingCitation).toBeDefined();
      expect(attribution.supportingExcerpt).toBeTruthy();
      expect(attribution.reviewerAction.length).toBeGreaterThan(24);
    }
  });

  it("keeps unsupported claims out of citation mappings until review", () => {
    const audit = demoSnapshot.answer?.groundingAudit;
    const needsCitation = audit!.claimAttributions.filter(attribution => attribution.supportStatus === "needs_citation");
    expect(needsCitation).toHaveLength(audit!.unsupportedClaimCount);

    for (const attribution of needsCitation) {
      expect(attribution.citationDocumentName).toBeNull();
      expect(attribution.citationChunkPosition).toBeNull();
      expect(attribution.supportingExcerpt).toBeNull();
      expect(attribution.reviewerAction).toMatch(/citation|retrieve|attach/i);
    }
  });

  it("checks citation force for every claim that has a citation", () => {
    const audit = demoSnapshot.answer?.groundingAudit;

    for (const attribution of audit!.claimAttributions) {
      expect(attribution.evidenceForceReview.reviewNote.length).toBeGreaterThan(32);
      if (attribution.citationDocumentName != null) {
        expect(attribution.evidenceForceReview.checkedAgainstCitation).toBe(true);
        expect(attribution.evidenceForceReview.status).not.toBe("not_evaluated");
      } else {
        expect(attribution.evidenceForceReview.checkedAgainstCitation).toBe(false);
        expect(attribution.evidenceForceReview.status).toBe("not_evaluated");
      }
    }
  });

  it("records a non-vacuous evidence-force gap against a real citation", () => {
    const gap = demoSnapshot.answer?.groundingAudit.claimAttributions.find(
      attribution => attribution.evidenceForceReview.status === "force_gap"
    );

    expect(gap).toBeDefined();
    expect(gap?.citationDocumentName).toBeTruthy();
    expect(gap?.citationChunkPosition).not.toBeNull();
    expect(["relation", "modality", "scope", "temporal", "numeric"]).toContain(gap?.evidenceForceReview.primaryAxis);
    expect(gap?.evidenceForceReview.warrantedClaim).toBeTruthy();
    expect(gap?.evidenceForceReview.warrantedClaim).not.toBe(gap?.claim);
    expect(gap?.evidenceForceReview.reviewNote).toMatch(/overstates|stronger|warrant/i);
  });

  it("keeps citation-force gaps in the release queue", () => {
    const audit = demoSnapshot.answer?.groundingAudit;
    const measuredGaps = audit!.claimAttributions.filter(
      attribution => attribution.evidenceForceReview.status === "force_gap"
    );

    expect(measuredGaps.length).toBeGreaterThan(0);
    expect(audit?.forceGapClaimCount).toBe(measuredGaps.length);
    expect(audit?.releaseGate.autoSendAllowed).toBe(false);
    expect(audit?.releaseGate.blockers.join(" ")).toMatch(/FINRA|rewrite|extension/i);
  });

  it("checks whether retrieved context is sufficient before generation", () => {
    const review = demoSnapshot.answer?.groundingAudit.contextSufficiencyReview;

    expect(review?.checkedBeforeGeneration).toBe(true);
    expect(review?.status).toBe("insufficient");
    expect(review?.missingEvidence).toContain("Current ISO 27001 scope revision 6, Appendix B retention schedule");
    expect(review?.reviewNote).toMatch(/incomplete|withheld/i);
  });

  it("uses selective abstention when only part of the query is supported", () => {
    const answer = demoSnapshot.answer;
    const review = answer?.groundingAudit.contextSufficiencyReview;

    expect(review?.responseMode).toBe("selective_abstention");
    expect(answer?.groundingAudit.releaseGate.autoSendAllowed).toBe(false);
    expect(answer?.answer).toMatch(/ISO-specific guidance is withheld/i);
  });

  it("routes each missing context item into the release queue", () => {
    const audit = demoSnapshot.answer?.groundingAudit;
    const missingEvidence = audit?.contextSufficiencyReview.missingEvidence ?? [];

    expect(missingEvidence.length).toBeGreaterThan(0);
    for (const missing of missingEvidence) {
      const keyTerms = missing.match(/ISO|revision 6|Appendix B/gi) ?? [];
      expect(keyTerms.length).toBeGreaterThan(0);
      expect(audit?.releaseGate.blockers.join(" ")).toMatch(/ISO|revision 6|Appendix B/i);
    }
  });

  it("tracks stale citations separately from changed source documents", () => {
    const citations = demoSnapshot.answer?.citations ?? [];
    const citedDocumentNames = new Set(citations.map(citation => citation.documentName));
    const staleCitedDocuments = demoDocuments.filter(
      document => citedDocumentNames.has(document.name) && document.lastModifiedAt != null && document.lastModifiedAt > document.ingestedAt
    );
    expect(staleCitedDocuments.length).toBe(demoSnapshot.answer?.groundingAudit.staleCitationCount);
  });
});

describe("context budget review", () => {
  const review = demoSnapshot.answer?.groundingAudit.contextBudgetReview;

  const eligibleChunks = demoSnapshot.searchResults.filter(result =>
    result.safetyReview.status === "allowed" &&
    result.relevanceReview.answerUse === "allowed" &&
    result.sourceLifecycleReview.answerUse === "allowed" &&
    result.sourceAuthorityReview.answerUse !== "blocked" &&
    result.versionReview.answerUse === "allowed" &&
    result.deduplicationReview.answerUse === "allowed" &&
    result.conflictReview.answerUse === "allowed" &&
    result.authorizationReview.status === "authorized"
  );

  it("checks the retrieval assembly budget before model context", () => {
    expect(review?.checkedBeforeModel).toBe(true);
    expect(review?.status).toBe("over_budget");
    expect(review?.answerUse).toBe("blocked");
    expect(review?.budgetTokens).toBeGreaterThan(0);
    expect(review!.eligibleTokenCount).toBeGreaterThan(review!.budgetTokens);
  });

  it("accounts for every eligible chunk without silent truncation", () => {
    const accounted = new Set([...(review?.includedChunkIds ?? []), ...(review?.heldOutChunkIds ?? [])]);
    expect(review?.eligibleChunkCount).toBe(eligibleChunks.length);
    expect((review?.includedChunkIds ?? []).length + (review?.heldOutChunkIds ?? []).length).toBe(review?.eligibleChunkCount);
    expect((review?.includedTokenCount ?? 0) + (review?.heldOutTokenCount ?? 0)).toBe(review?.eligibleTokenCount);
    expect(accounted).toEqual(new Set(eligibleChunks.map(result => result.chunkId)));
  });

  it("includes eligible chunks in rank order and holds out only the lowest-ranked", () => {
    const ranked = [...eligibleChunks].sort((a, b) => b.score - a.score);
    const includedCount = (review?.includedChunkIds ?? []).length;

    expect(review?.includedChunkIds).toEqual(ranked.slice(0, includedCount).map(result => result.chunkId));
    expect(review?.heldOutChunkIds).toEqual(ranked.slice(includedCount).map(result => result.chunkId));
  });

  it("holds out a chunk that passes every other pre-model gate", () => {
    expect((review?.heldOutChunkIds ?? []).length).toBeGreaterThan(0);

    for (const chunkId of review?.heldOutChunkIds ?? []) {
      const chunk = demoSnapshot.searchResults.find(result => result.chunkId === chunkId);
      expect(chunk).toBeDefined();
      expect(chunk?.safetyReview.status).toBe("allowed");
      expect(chunk?.relevanceReview.answerUse).toBe("allowed");
      expect(chunk?.sourceAuthorityReview.answerUse).not.toBe("blocked");
      expect(chunk?.versionReview.answerUse).toBe("allowed");
      expect(chunk?.deduplicationReview.answerUse).toBe("allowed");
      expect(chunk?.conflictReview.answerUse).toBe("allowed");
      expect(chunk?.authorizationReview.status).toBe("authorized");
    }
  });

  it("keeps budget-held chunks out of citations and in the release queue", () => {
    const citations = demoSnapshot.answer?.citations ?? [];
    for (const chunkId of review?.heldOutChunkIds ?? []) {
      expect(citations.some(citation => citation.sourceChunkId === chunkId)).toBe(false);
    }
    expect(review?.reviewNote).toMatch(/held out|budget|truncat/i);
    const gate = demoSnapshot.answer?.groundingAudit.releaseGate;
    expect(gate?.autoSendAllowed).toBe(false);
    expect(gate?.blockers.some(blocker => blocker.match(/budget|held out|context/i))).toBe(true);
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

  it("reports stale document count when threshold is set", () => {
    const status = demoSnapshot.ingestionStatus;
    expect(status.staleThresholdDays).toBeGreaterThan(0);
    expect(status.staleDocumentCount).toBeGreaterThanOrEqual(0);
    expect(status.staleDocumentCount).toBeLessThanOrEqual(status.totalDocuments);
  });

  it("stale count is non-zero to surface freshness risk", () => {
    expect(demoSnapshot.ingestionStatus.staleDocumentCount).toBeGreaterThan(0);
  });

  it("tracks documents whose source changed after ingestion", () => {
    const status = demoSnapshot.ingestionStatus;
    expect(status.sourceModifiedAfterIngestionCount).toBeGreaterThanOrEqual(0);
    expect(status.sourceModifiedAfterIngestionCount).toBeLessThanOrEqual(status.totalDocuments);
  });
});

describe("document freshness", () => {
  it("at least one document has source modified after ingestion date", () => {
    const outOfSync = demoDocuments.filter(
      d => d.lastModifiedAt != null && d.lastModifiedAt > d.ingestedAt
    );
    expect(outOfSync.length).toBeGreaterThanOrEqual(1);
  });

  it("documents ingested after source modification stay in sync", () => {
    const inSync = demoDocuments.filter(
      d => d.lastModifiedAt != null && d.lastModifiedAt <= d.ingestedAt
    );
    expect(inSync.length).toBeGreaterThanOrEqual(2);
  });

  it("documents without lastModifiedAt are handled gracefully", () => {
    const noModTime = demoDocuments.filter(d => d.lastModifiedAt == null);
    expect(noModTime.length).toBeGreaterThanOrEqual(1);
    for (const doc of noModTime) {
      expect(doc.ingestedAt).toBeTruthy();
      expect(doc.parseQuality).toBeGreaterThan(0);
    }
  });

  it("source-modified count matches out-of-sync documents", () => {
    const outOfSync = demoDocuments.filter(
      d => d.lastModifiedAt != null && d.lastModifiedAt > d.ingestedAt
    );
    expect(outOfSync.length).toEqual(demoSnapshot.ingestionStatus.sourceModifiedAfterIngestionCount);
  });

  it("out-of-sync document still has parse quality recorded", () => {
    const outOfSync = demoDocuments.find(
      d => d.lastModifiedAt != null && d.lastModifiedAt > d.ingestedAt
    );
    expect(outOfSync).toBeDefined();
    expect(outOfSync!.parseQuality).toBeGreaterThan(0);
    expect(outOfSync!.chunksCreated).toBeGreaterThan(0);
  });
});

describe("golden evaluation set", () => {
  it("keeps suite counts consistent with the question list", () => {
    const suite = demoGoldenEvalSuite;
    expect(suite.questions).toHaveLength(suite.totalQuestions);
    expect(suite.passingCount + suite.failingCount).toBe(suite.totalQuestions);
    expect(suite.questions.filter(q => q.lastRunStatus === "passing")).toHaveLength(suite.passingCount);
    expect(suite.questions.filter(q => q.lastRunStatus === "failing")).toHaveLength(suite.failingCount);
  });

  it("gives every question a ground truth, expected source, and owner", () => {
    for (const question of demoGoldenEvalSuite.questions) {
      expect(question.question.length).toBeGreaterThan(16);
      expect(question.groundTruth.length).toBeGreaterThan(24);
      expect(question.expectedSourceDocumentName.length).toBeGreaterThan(4);
      expect(question.owner).toBeTruthy();
      expect(question.lastRunNote.length).toBeGreaterThan(32);
      if (question.lastRunStatus === "passing") {
        expect(question.failureClass).toBe("none");
      } else {
        expect(question.failureClass).not.toBe("none");
      }
    }
  });

  it("covers the conflicting-or-stale category most golden sets skip", () => {
    const staleConflict = demoGoldenEvalSuite.questions.filter(q => q.category === "conflicting_or_stale");
    expect(staleConflict.length).toBeGreaterThanOrEqual(1);
    for (const question of staleConflict) {
      expect(question.groundTruth).toMatch(/conflict|superseded|stale|held out/i);
    }
  });

  it("distinguishes retrieval failure from generation failure", () => {
    const failing = demoGoldenEvalSuite.questions.filter(q => q.lastRunStatus === "failing");
    expect(failing.length).toBeGreaterThan(0);

    const retrievalFailures = failing.filter(q => q.failureClass === "retrieval_failure");
    expect(retrievalFailures.length).toBeGreaterThan(0);

    for (const question of retrievalFailures) {
      // Retrieval failure means the expected source is not available as a ready, ingested document.
      const expectedDoc = demoDocuments.find(d => d.name === question.expectedSourceDocumentName);
      expect(expectedDoc).toBeUndefined();
      expect(question.expectedBehavior).toBe("abstain");
      expect(question.lastRunNote).toMatch(/retrieval failure/i);
      // The closest indexed document is version-blocked, so the retriever cannot supply the chunk.
      const blockedVersionHold = demoSnapshot.searchResults.find(
        r => r.documentName.startsWith("ISO 27001") && r.versionReview.answerUse === "blocked"
      );
      expect(blockedVersionHold).toBeDefined();
    }
  });

  it("keeps unsafe-content questions gated on blocking behavior", () => {
    const unsafe = demoGoldenEvalSuite.questions.filter(q => q.category === "unsafe_content");
    expect(unsafe.length).toBeGreaterThanOrEqual(1);
    for (const question of unsafe) {
      expect(question.expectedBehavior).toBe("block");
      const blockedChunk = demoSnapshot.searchResults.find(
        r => r.documentName === question.expectedSourceDocumentName && r.safetyReview.status === "blocked"
      );
      expect(blockedChunk).toBeDefined();
    }
  });
});

describe("citation source text verification", () => {
  it("records source-text verification status for every citation", () => {
    const citations = demoSnapshot.answer?.citations ?? [];
    expect(citations.length).toBeGreaterThan(0);
    
    for (const citation of citations) {
      expect(citation.sourceTextVerification).toBeDefined();
      expect(citation.sourceTextVerification.status).toMatch(/verified|mismatch_detected|unverified/);
      expect(citation.sourceTextVerification.reviewedBeforeRelease).toBe(true);
      expect(citation.sourceTextVerification.reviewerAction.length).toBeGreaterThan(16);
    }
  });

  it("detects mismatches between cited excerpt and source chunk", () => {
    const citations = demoSnapshot.answer?.citations ?? [];
    const mismatches = citations.filter(c => c.sourceTextVerification.status === "mismatch_detected");
    
    expect(mismatches.length).toBeGreaterThanOrEqual(1);
    for (const citation of mismatches) {
      expect(citation.sourceTextVerification.excerptFoundInSource).toBe(false);
      expect(citation.sourceTextVerification.mismatchDetails).toBeTruthy();
      expect(citation.sourceTextVerification.mismatchDetails?.length).toBeGreaterThan(24);
    }
  });

  it("allows only verified citations in direct coverage", () => {
    const directCitations = demoSnapshot.answer?.citations.filter(c => c.coverage === "direct") ?? [];
    expect(directCitations.length).toBeGreaterThan(0);
    
    for (const citation of directCitations) {
      expect(citation.sourceTextVerification.status).toBe("verified");
      expect(citation.sourceTextVerification.excerptFoundInSource).toBe(true);
    }
  });

  it("blocks mismatched citations from release", () => {
    const mismatches = demoSnapshot.answer?.citations.filter(
      c => c.sourceTextVerification.status === "mismatch_detected"
    ) ?? [];
    
    expect(mismatches.length).toBeGreaterThanOrEqual(1);
    
    const audit = demoSnapshot.answer?.groundingAudit;
    expect(audit?.releaseGate.status).toBe("review_required");
    expect(audit?.releaseGate.blockers.some(b => b.match(/citation|excerpt|source text|mismatch/i))).toBe(true);
  });
});

describe("jurisdiction-scope retrieval gating", () => {
  it("blocks jurisdiction-mismatched retrievals from answer use", () => {
    const jurisdictionBlocked = demoSnapshot.searchResults.filter(
      r => r.sourceAuthorityReview.answerUse === "blocked" &&
        r.sourceAuthorityReview.reviewNote.match(/jurisdiction/i)
    );
    expect(jurisdictionBlocked.length).toBeGreaterThanOrEqual(1);

    for (const result of jurisdictionBlocked) {
      expect(result.sourceAuthorityReview.level).not.toBe("unverified");
      expect(result.confidence).not.toBe("low");
      expect(result.authorizationReview.status).toBe("authorized");
    }
  });

  it("keeps jurisdiction-blocked retrievals out of generated citations", () => {
    const jurisdictionBlocked = demoSnapshot.searchResults.filter(
      r => r.sourceAuthorityReview.answerUse === "blocked" &&
        r.sourceAuthorityReview.reviewNote.match(/jurisdiction/i)
    );
    const citations = demoSnapshot.answer?.citations ?? [];
    expect(jurisdictionBlocked.length).toBeGreaterThan(0);

    for (const result of jurisdictionBlocked) {
      expect(citations.some(citation => citation.documentName === result.documentName)).toBe(false);
    }
  });

  it("does not conflate jurisdiction blocking with safety or authorization denial", () => {
    const jurisdictionBlocked = demoSnapshot.searchResults.find(
      r => r.sourceAuthorityReview.answerUse === "blocked" &&
        r.sourceAuthorityReview.reviewNote.match(/jurisdiction/i)
    );
    expect(jurisdictionBlocked).toBeDefined();
    expect(jurisdictionBlocked!.safetyReview.status).toBe("allowed");
    expect(jurisdictionBlocked!.authorizationReview.status).toBe("authorized");
    expect(jurisdictionBlocked!.versionReview.answerUse).toBe("allowed");
    expect(jurisdictionBlocked!.deduplicationReview.answerUse).toBe("allowed");
    expect(jurisdictionBlocked!.conflictReview.answerUse).toBe("allowed");
    expect(jurisdictionBlocked!.sourceAuthorityReview.answerUse).toBe("blocked");
  });
});

describe("retrieval relevance review", () => {
  it("checks every retrieval for topical relevance before model context assembly", () => {
    for (const result of demoSnapshot.searchResults) {
      expect(result.relevanceReview.checkedBeforeModel).toBe(true);
      expect(["relevant", "off_topic"]).toContain(result.relevanceReview.status);
      expect(result.relevanceReview.reviewNote.length).toBeGreaterThan(32);
    }
  });

  it("blocks off-topic retrievals even when every other gate passes", () => {
    const offTopic = demoSnapshot.searchResults.filter(
      result => result.relevanceReview.status === "off_topic"
    );
    expect(offTopic.length).toBeGreaterThanOrEqual(1);

    for (const result of offTopic) {
      expect(result.relevanceReview.answerUse).toBe("blocked");
      expect(result.safetyReview.status).toBe("allowed");
      expect(result.authorizationReview.status).toBe("authorized");
      expect(result.versionReview.answerUse).toBe("allowed");
      expect(result.deduplicationReview.answerUse).toBe("allowed");
      expect(result.conflictReview.answerUse).toBe("allowed");
      expect(result.sourceAuthorityReview.answerUse).not.toBe("blocked");
      expect(result.relevanceReview.reviewNote).toMatch(/off-topic|topical|keyword/i);
    }
  });

  it("keeps off-topic retrievals out of generated citations", () => {
    const offTopicDocs = new Set(
      demoSnapshot.searchResults
        .filter(result => result.relevanceReview.status === "off_topic")
        .map(result => result.documentName)
    );
    expect(offTopicDocs.size).toBeGreaterThan(0);

    for (const citation of demoSnapshot.answer?.citations ?? []) {
      expect(offTopicDocs.has(citation.documentName)).toBe(false);
    }
  });
});
