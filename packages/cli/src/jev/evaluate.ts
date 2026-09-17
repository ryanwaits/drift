/**
 * CLI-only Jev (TypeSafe System One) evaluate seam.
 *
 * Injected in tests. Live client is opt-in (`drift docs propose`) and
 * fail-loud without TYPESAFE_API_KEY. Never imported from scan.
 */

export const JEV_MODEL = 'jev-latest';
export const DEFAULT_CONFIDENCE = 0.7;
export const MAX_JEV_QUESTIONS = 50;

export type ChoiceQuestion = {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string | null>;
};

export type ScoreQuestion = {
  type: 'score';
  instructions: string;
  criteria: string[];
};

export type NoulQuestion = {
  type: 'noul';
  instructions: string;
  criteria?: { true?: string; false?: string };
};

export type EvaluateQuestion = ChoiceQuestion | ScoreQuestion | NoulQuestion;

export type EvaluateAnswer = {
  type?: 'choice' | 'score' | 'noul';
  choice?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
  score?: number;
  noul?: number;
};

export type EvaluateResult = {
  answers: Record<string, EvaluateAnswer>;
};

export type EvaluateRequest = {
  state: unknown;
  questions: Record<string, EvaluateQuestion>;
};

export type EvaluateFn = (request: EvaluateRequest) => Promise<EvaluateResult>;

export function choiceConfidence(answer: EvaluateAnswer | undefined, choice: string): number {
  if (!answer) return 0;
  if (typeof answer.confidence === 'number') return answer.confidence;
  const p = answer.probabilities?.[choice];
  return typeof p === 'number' ? p : 0;
}

/** Live TypeSafe client. Throws if TYPESAFE_API_KEY is missing. */
export async function loadEvaluate(): Promise<EvaluateFn> {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'drift docs propose requires TYPESAFE_API_KEY (TypeSafe System One). Opt-in; never used by scan.',
    );
  }
  const { TypeSafeClient } = await import('@typesafe-ai/sdk');
  const client = new TypeSafeClient({ apiKey });
  return async (request) => {
    const result = await client.systemOne({
      state: JSON.parse(JSON.stringify(request.state)) as never,
      questions: request.questions as never,
    });
    return { answers: result.answers as EvaluateResult['answers'] };
  };
}

/** One batched call, chunked if questions exceed MAX_JEV_QUESTIONS. */
export async function evaluateBatched(
  evaluate: EvaluateFn,
  state: unknown,
  questions: Record<string, EvaluateQuestion>,
  chunkSize = MAX_JEV_QUESTIONS,
): Promise<EvaluateResult> {
  const ids = Object.keys(questions);
  if (ids.length === 0) return { answers: {} };

  const answers: Record<string, EvaluateAnswer> = {};
  for (let i = 0; i < ids.length; i += chunkSize) {
    const slice = Object.fromEntries(ids.slice(i, i + chunkSize).map((id) => [id, questions[id]]));
    const result = await evaluate({ state: JSON.parse(JSON.stringify(state)), questions: slice });
    Object.assign(answers, result.answers);
  }
  return { answers };
}
