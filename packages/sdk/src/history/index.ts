export type {
  CoverageSnapshot,
  CoverageTrend,
  ExtendedTrendAnalysis,
  WeeklySummary,
} from '../analysis/history';
export {
  computeSnapshot,
  formatDelta,
  generateWeeklySummaries,
  getExtendedTrend,
  getTrend,
  HISTORY_DIR,
  loadSnapshots,
  pruneHistory,
  renderSparkline,
  saveSnapshot,
} from '../analysis/history';
