import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { AccountLedgerStore } from "../account/store";

type TriviaQuestion = { id: string; q: string; options: string[]; answer: number; note: string; category: string; difficulty: "easy" | "medium" | "hard" };
type TriviaSession = {
  id: string;
  userId: string;
  challengeId: string;
  buildId: string;
  createdAt: number;
  expiresAt: number;
  expectedSequence: number;
  correctCount: number;
  answered: Set<string>;
  elapsedMs: number[];
};

const COOKIE_NAME = "lottomind_session";
const APPROVED_BUILD = "lottomind-refined-trivia-2026-08-09";
const FORBIDDEN_FIELDS = new Set(["reward", "rewardAmount", "credits", "creditAmount", "userId", "accountId", "walletId"]);
const QUESTIONS: TriviaQuestion[] = [
  { id: "oracle-first-move", q: "What is the safest first move before saving a Dream Oracle pick?", options: ["Run the interpretation", "Clear the vault", "Mute every tab", "Treat it as a guaranteed result"], answer: 0, note: "Dream picks work best after the Oracle reads the symbols and creates the set.", category: "lottomind-universe", difficulty: "easy" },
  { id: "signal-radar-lane", q: "Which LottoMind lane compares hot, cold, and balance signals?", options: ["Signal Radar", "Merch Store", "Privacy Policy", "Music Store"], answer: 0, note: "Signal Radar is the quick scan lane for number movement.", category: "lottery-knowledge", difficulty: "easy" },
  { id: "history-vault", q: "Where should saved numbers and dream readings live?", options: ["History Vault", "Search bar", "Mode switch", "Arcade player"], answer: 0, note: "History Vault keeps saved sets and readings together.", category: "lottomind-universe", difficulty: "medium" },
  { id: "abundance-radio", q: "What does Abundance Radio connect back into?", options: ["Reset tones", "State taxes", "A scratch-off camera", "Ticket redemption"], answer: 0, note: "Radio sessions can load frequency lanes into the Reset player.", category: "music-pop-culture", difficulty: "medium" },
  { id: "random-outcomes", q: "Which reminder matters before every play session?", options: ["Lottery outcomes are random", "More taps guarantee wins", "Only one number can repeat", "A streak predicts the next draw"], answer: 0, note: "LottoMind is for entertainment and education. Lottery outcomes are random.", category: "lottery-knowledge", difficulty: "hard" },
];

function sessionToken(request: Request): string {
  const cookies = Object.fromEntries(String(request.headers.cookie || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf("=");
    return separator < 0 ? [part, ""] : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
  }));
  return cookies[COOKIE_NAME] || "";
}

function cleanText(value: unknown, max = 128): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function hasForbiddenField(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && Object.keys(value as Record<string, unknown>).some((key) => FORBIDDEN_FIELDS.has(key)));
}

function apiError(response: Response, status: number, code: string, message: string): Response {
  return response.status(status).json({ error: { code, message } });
}

function publicQuestions(): Array<Omit<TriviaQuestion, "answer">> {
  return QUESTIONS.map(({ answer: _answer, ...question }) => question);
}

export function createTriviaRewardsRouter(store: AccountLedgerStore): Router {
  const router = Router();
  const sessions = new Map<string, TriviaSession>();

  router.post("/trivia/sessions", async (request, response) => {
    try {
      const token = sessionToken(request);
      const snapshot = await store.snapshot(token);
      if (!snapshot.authenticated || !snapshot.user) return apiError(response, 401, "AUTH_REQUIRED", "Sign in to start a verified Trivia Vault reward session.");
      if (hasForbiddenField(request.body)) return apiError(response, 400, "CLIENT_REWARD_NOT_ALLOWED", "Client-supplied identity or reward values are not allowed.");
      const buildId = cleanText(request.body?.buildId, 80);
      const mode = cleanText(request.body?.mode, 40);
      if (buildId !== APPROVED_BUILD || mode !== "daily") return apiError(response, 403, "BUILD_NOT_APPROVED", "This trivia build is not approved for wallet rewards.");
      for (const [id, session] of sessions) if (session.expiresAt <= Date.now()) sessions.delete(id);
      const challengeId = `trivia:daily:${new Date().toISOString().slice(0, 10)}`;
      const session: TriviaSession = {
        id: randomUUID(), userId: snapshot.user.id, challengeId, buildId,
        createdAt: Date.now(), expiresAt: Date.now() + 30 * 60 * 1000,
        expectedSequence: 0, correctCount: 0, answered: new Set(), elapsedMs: [],
      };
      sessions.set(session.id, session);
      response.status(201).json({ sessionId: session.id, challengeId, eligible: true, expiresAt: new Date(session.expiresAt).toISOString(), questions: publicQuestions() });
    } catch {
      apiError(response, 500, "TRIVIA_SERVICE_ERROR", "The trivia reward service is temporarily unavailable.");
    }
  });

  router.post("/trivia/sessions/:sessionId/answer", async (request, response) => {
    try {
      const snapshot = await store.snapshot(sessionToken(request));
      const session = sessions.get(cleanText(request.params.sessionId, 100));
      if (!snapshot.authenticated || !snapshot.user) return apiError(response, 401, "AUTH_REQUIRED", "Sign in to submit a verified trivia answer.");
      if (!session) return apiError(response, 404, "SESSION_NOT_FOUND", "Trivia reward session not found.");
      if (session.userId !== snapshot.user.id) return apiError(response, 403, "SESSION_NOT_OWNED", "Trivia reward session does not belong to this account.");
      if (session.expiresAt <= Date.now()) return apiError(response, 410, "SESSION_EXPIRED", "Trivia reward session expired.");
      if (hasForbiddenField(request.body)) return apiError(response, 400, "CLIENT_REWARD_NOT_ALLOWED", "Client-supplied reward values are not allowed.");
      const sequence = Number(request.body?.sequence);
      const selectedIndex = Number(request.body?.selectedIndex);
      const elapsedMs = Number(request.body?.elapsedMs);
      const questionId = cleanText(request.body?.questionId, 80);
      const question = QUESTIONS[session.expectedSequence];
      if (!question || sequence !== session.expectedSequence || questionId !== question.id || !Number.isInteger(selectedIndex) || selectedIndex < -1 || selectedIndex >= question.options.length || !Number.isInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > 60000 || session.answered.has(questionId)) {
        return apiError(response, 422, "INVALID_STATE_TRANSITION", "Trivia answer order or content could not be verified.");
      }
      const correct = selectedIndex === question.answer;
      session.answered.add(questionId);
      session.elapsedMs.push(elapsedMs);
      session.expectedSequence += 1;
      if (correct) session.correctCount += 1;
      response.json({ accepted: true, correct, correctIndex: question.answer, note: question.note, nextSequence: session.expectedSequence, remaining: QUESTIONS.length - session.expectedSequence });
    } catch {
      apiError(response, 500, "TRIVIA_SERVICE_ERROR", "The trivia answer could not be verified.");
    }
  });

  router.post("/trivia/sessions/:sessionId/claim", async (request, response) => {
    try {
      const token = sessionToken(request);
      const snapshot = await store.snapshot(token);
      const session = sessions.get(cleanText(request.params.sessionId, 100));
      if (!snapshot.authenticated || !snapshot.user) return apiError(response, 401, "AUTH_REQUIRED", "Sign in to claim verified trivia credits.");
      if (!session) return apiError(response, 404, "SESSION_NOT_FOUND", "Trivia reward session not found.");
      if (session.userId !== snapshot.user.id) return apiError(response, 403, "SESSION_NOT_OWNED", "Trivia reward session does not belong to this account.");
      if (session.expiresAt <= Date.now()) return apiError(response, 410, "SESSION_EXPIRED", "Trivia reward session expired.");
      if (session.expectedSequence !== QUESTIONS.length) return apiError(response, 422, "INVALID_STATE_TRANSITION", "Complete every trivia question before claiming a reward.");
      if (hasForbiddenField(request.body)) return apiError(response, 400, "CLIENT_REWARD_NOT_ALLOWED", "Client-supplied reward values are not allowed.");
      const granted = await store.grantTriviaReward(token, {
        challengeId: session.challengeId,
        sessionId: session.id,
        correctCount: session.correctCount,
        questionCount: QUESTIONS.length,
        idempotencyKey: cleanText(request.body?.idempotencyKey, 128),
      });
      response.json({
        status: "rewarded",
        reward: { amount: granted.amount, bucket: "promotional", challengeId: session.challengeId },
        wallet: { promotionalBalance: granted.balance, monthlyBalance: 0, purchasedBalance: 0, totalBalance: granted.balance, version: 1 },
        transactionId: granted.transactionId,
        duplicate: granted.duplicate,
      });
    } catch (error) {
      const typed = error as Error & { code?: string; status?: number };
      apiError(response, typed.status || 500, typed.code || "TRIVIA_SERVICE_ERROR", typed.status && typed.status < 500 ? typed.message : "The trivia reward could not be claimed.");
    }
  });

  return router;
}
