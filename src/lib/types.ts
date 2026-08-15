export type ConfidenceLevel = "high" | "medium" | "low";

export interface WorkspaceMember {
  id: string; name: string; role: "owner" | "editor" | "viewer"; initials: string;
}

export interface Workspace {
  id: string; name: string; memberCount: number; documentCount: number; totalChunks: number;
}

export interface Document {
  id: string; workspaceId: string; name: string; type: string; size: string; parser: string;
  parseQuality: number; chunksCreated: number; ingestedAt: string;
  /** ISO timestamp of the source file's last modification — distinct from ingestedAt. When
   *  lastModifiedAt > ingestedAt the source changed after ingestion and embeddings are stale. */
  lastModifiedAt?: string;
  status: "ready" | "parsing" | "error";
}

export interface Chunk {
  id: string; documentId: string; workspaceId: string; text: string; summary: string;
  semanticBoundary: string; position: number; tokenCount: number;
}

export type RetrievalSafetyStatus = "allowed" | "review_required" | "blocked";
export type RetrievalRiskType = "none" | "embedded_instruction" | "egress_request" | "parser_error";
export type RetrievalAuthorizationStatus = "authorized" | "review_required" | "denied";
export type RetrievalAudience = "compliance" | "legal" | "hr" | "security" | "external_vendor";
export type PermissionSnapshotStatus = "current" | "stale";
export type SourceAuthorityLevel = "source_of_record" | "approved_reference" | "unverified";
export type SourceAnswerUse = "direct" | "supporting_only" | "blocked";
export type RetrievalVersionStatus = "current" | "superseded" | "unregistered";
export type RetrievalVersionAnswerUse = "allowed" | "blocked";
export type RetrievalDeduplicationStatus = "canonical" | "suppressed_duplicate";
export type RetrievalDuplicateType = "none" | "byte_exact";
export type RetrievalDeduplicationAnswerUse = "allowed" | "blocked";
export type RetrievalConflictStatus = "clear" | "conflict_detected";
export type RetrievalConflictResolution = "not_needed" | "source_authority";
export type RetrievalConflictAnswerUse = "allowed" | "blocked";
export type RetrievalRelevanceStatus = "relevant" | "off_topic";
export type RetrievalRelevanceAnswerUse = "allowed" | "blocked";

export interface RetrievalConflictReview {
  status: RetrievalConflictStatus;
  topic: string | null;
  conflictsWithChunkIds: string[];
  resolution: RetrievalConflictResolution;
  checkedBeforeModel: boolean;
  answerUse: RetrievalConflictAnswerUse;
  reviewNote: string;
}

export interface RetrievalDeduplicationReview {
  status: RetrievalDeduplicationStatus;
  duplicateType: RetrievalDuplicateType;
  contentFingerprint: string;
  canonicalChunkId: string;
  checkedBeforeModel: boolean;
  answerUse: RetrievalDeduplicationAnswerUse;
  reviewNote: string;
}

export interface RetrievalVersionReview {
  status: RetrievalVersionStatus;
  indexedVersionId: string;
  currentVersionId: string | null;
  supersededBy: string | null;
  checkedBeforeModel: boolean;
  answerUse: RetrievalVersionAnswerUse;
  reviewNote: string;
}

export interface RetrievalSourceAuthorityReview {
  level: SourceAuthorityLevel;
  answerUse: SourceAnswerUse;
  owner: string;
  sourceSystem: string;
  checkedBeforeModel: boolean;
  reviewNote: string;
}

export interface RetrievalAuthorizationReview {
  status: RetrievalAuthorizationStatus;
  allowedAudiences: RetrievalAudience[];
  checkedBeforeModel: boolean;
  permissionSnapshotStatus: PermissionSnapshotStatus;
  sourceAclVersion: string;
  indexedAclVersion: string;
  reviewNote: string;
}

export interface RetrievalSafetyReview {
  status: RetrievalSafetyStatus;
  risk: RetrievalRiskType;
  externalTarget: string | null;
  reviewNote: string;
}

export interface RetrievalRelevanceReview {
  status: RetrievalRelevanceStatus;
  checkedBeforeModel: boolean;
  answerUse: RetrievalRelevanceAnswerUse;
  reviewNote: string;
}

export interface SearchResult {
  chunkId: string; documentName: string; chunkText: string; score: number;
  confidence: ConfidenceLevel; method: "vector" | "bm25" | "hybrid";
  safetyReview: RetrievalSafetyReview;
  relevanceReview: RetrievalRelevanceReview;
  sourceAuthorityReview: RetrievalSourceAuthorityReview;
  versionReview: RetrievalVersionReview;
  deduplicationReview: RetrievalDeduplicationReview;
  conflictReview: RetrievalConflictReview;
  authorizationReview: RetrievalAuthorizationReview;
}

export type ClaimSupportStatus = "supported" | "needs_citation" | "contradicted";
export type ClaimEvidenceForceStatus = "force_calibrated" | "force_gap" | "not_evaluated";
export type ClaimEvidenceForceAxis = "relation" | "modality" | "scope" | "temporal" | "numeric" | null;

export interface ClaimEvidenceForceReview {
  status: ClaimEvidenceForceStatus;
  primaryAxis: ClaimEvidenceForceAxis;
  checkedAgainstCitation: boolean;
  warrantedClaim: string | null;
  reviewNote: string;
}

export interface ClaimAttribution {
  claim: string;
  supportStatus: ClaimSupportStatus;
  citationDocumentName: string | null;
  citationChunkPosition: number | null;
  supportingExcerpt: string | null;
  reviewerAction: string;
  evidenceForceReview: ClaimEvidenceForceReview;
}

export type ReleaseGateStatus = "ready" | "review_required" | "blocked";
export type RequiredReviewerRole = "knowledge_owner" | "compliance_reviewer" | "security_reviewer" | null;

export interface AnswerReleaseGate {
  status: ReleaseGateStatus;
  autoSendAllowed: boolean;
  requiredReviewerRole: RequiredReviewerRole;
  blockers: string[];
}

export type ContextSufficiencyStatus = "sufficient" | "insufficient";
export type ContextResponseMode = "answer" | "selective_abstention";

export interface ContextSufficiencyReview {
  status: ContextSufficiencyStatus;
  checkedBeforeGeneration: boolean;
  responseMode: ContextResponseMode;
  missingEvidence: string[];
  reviewNote: string;
}

export interface GroundingAudit {
  totalClaims: number; citedClaims: number; unsupportedClaimCount: number; forceGapClaimCount: number;
  staleCitationCount: number; reviewRequired: boolean; reviewNote: string;
  contextSufficiencyReview: ContextSufficiencyReview;
  releaseGate: AnswerReleaseGate;
  claimAttributions: ClaimAttribution[];
}

export interface RagAnswer {
  answer: string; citations: Citation[]; confidence: ConfidenceLevel; generatedAt: string;
  groundingAudit: GroundingAudit;
}

export type CitationSourceTextStatus = "verified" | "mismatch_detected" | "unverified";

export interface CitationSourceTextVerification {
  status: CitationSourceTextStatus;
  sourceChunkFullText: string | null;
  excerptFoundInSource: boolean;
  mismatchDetails: string | null;
  reviewedBeforeRelease: boolean;
  reviewerAction: string;
}

export interface Citation {
  sourceChunkId: string; documentName: string; chunkPosition: number; excerpt: string; score: number;
  coverage: "direct" | "supporting";
  verificationNote: string;
  sourceTextVerification: CitationSourceTextVerification;
}

export interface SearchHistoryEntry {
  id: string; query: string; resultCount: number; topScore: number; searchedAt: string;
}

export interface IngestionStatus {
  workspaceId: string; totalDocuments: number; totalChunks: number;
  avgParseQuality: number; lastIngestedAt: string;
  staleThresholdDays: number; staleDocumentCount: number;
  /** Documents whose source was modified after the last ingestion — embeddings are definitely stale. */
  sourceModifiedAfterIngestionCount: number;
}

export interface ParserResult {
  parser: string; quality: number; textSample: string; chunks: number; errors: number;
}

export type GoldenEvalCategory = "single_fact" | "multi_document" | "conflicting_or_stale" | "unsafe_content" | "insufficient_context";
export type GoldenEvalExpectedBehavior = "answer" | "abstain" | "block";
export type GoldenEvalFailureClass = "none" | "retrieval_failure" | "generation_failure";
export type GoldenEvalRunStatus = "passing" | "failing";

export interface GoldenEvalQuestion {
  id: string;
  question: string;
  /** Known-correct answer written by a domain owner — the baseline every run is scored against. */
  groundTruth: string;
  /** Document that must be retrieved for a correct answer. This field is what separates a
   *  retrieval failure (wrong chunk fetched) from a generation failure (right chunk, wrong answer). */
  expectedSourceDocumentName: string;
  category: GoldenEvalCategory;
  expectedBehavior: GoldenEvalExpectedBehavior;
  lastRunStatus: GoldenEvalRunStatus;
  failureClass: GoldenEvalFailureClass;
  lastRunNote: string;
  owner: string;
}

export interface GoldenEvalSuite {
  totalQuestions: number;
  passingCount: number;
  failingCount: number;
  lastRunAt: string;
  /** Corpus-churn percentage that should trigger re-embedding plus a full suite re-run. */
  reembedCorpusChurnThresholdPct: number;
  questions: GoldenEvalQuestion[];
}

export interface RagSnapshot {
  workspace: Workspace;
  members: WorkspaceMember[];
  documents: Document[];
  searchResults: SearchResult[];
  answer: RagAnswer | null;
  searchHistory: SearchHistoryEntry[];
  ingestionStatus: IngestionStatus;
  parserResults: ParserResult[];
  goldenEvalSuite: GoldenEvalSuite;
}
