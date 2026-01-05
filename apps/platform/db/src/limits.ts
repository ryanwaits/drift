export const PLAN_LIMITS = {
  free: {
    aiCallsPerMonth: 0,
    privateRepos: 0,
    analysesPerDay: 100,
    members: 1,
    historyDays: 0,
  },
  team: {
    aiCallsPerMonth: 5_000,
    privateRepos: Infinity,
    analysesPerDay: 1_000,
    members: Infinity,
    historyDays: 30,
  },
  pro: {
    aiCallsPerMonth: 25_000,
    privateRepos: Infinity,
    analysesPerDay: 10_000,
    members: Infinity,
    historyDays: 90,
  },
  enterprise: {
    aiCallsPerMonth: Infinity,
    privateRepos: Infinity,
    analysesPerDay: Infinity,
    members: Infinity,
    historyDays: 365,
  },
  hero: {
    aiCallsPerMonth: 25_000,
    privateRepos: Infinity,
    analysesPerDay: 10_000,
    members: Infinity,
    historyDays: 90,
  },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan: Plan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export function canUseAI(plan: Plan): boolean {
  return getPlanLimits(plan).aiCallsPerMonth > 0;
}

export function canAccessPrivateRepos(plan: Plan): boolean {
  return getPlanLimits(plan).privateRepos > 0;
}
