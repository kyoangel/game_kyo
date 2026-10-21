/**
 * Parental gate for the StoreKit tip jar (App Store kids-audience requirement).
 * A multiplication question an adult answers instantly but a 6-10 year old
 * can't easily do. The pure logic is exported for unit tests; installParentalGate
 * wires the #parental-gate overlay and exposes window.askParentalGate, which the
 * inline tip-jar script in index.html calls (it is a classic script and cannot import).
 */
export interface GateQuestion {
  a: number;
  b: number;
  answer: number;
  prompt: string;
}

/** Both operands are drawn from 6-9. */
export function createGateQuestion(rng: () => number = Math.random): GateQuestion {
  const a = 6 + Math.floor(rng() * 4);
  const b = 6 + Math.floor(rng() * 4);
  return { a, b, answer: a * b, prompt: `請家長作答：${a} × ${b} = ?` };
}

export function checkGateAnswer(question: GateQuestion, input: string): boolean {
  const text = input.trim();
  return /^\d+$/.test(text) && Number(text) === question.answer;
}

/** After a wrong answer the gate stays shut this long. Cancel does not count. */
export const GATE_COOLDOWN_MS = 30000;

export interface GateCooldown {
  recordWrong(): void;
  /** Whole seconds left (rounded up); 0 when the gate may open. */
  remainingSeconds(): number;
}

export function createGateCooldown(now: () => number = Date.now): GateCooldown {
  let until = 0;
  return {
    recordWrong() {
      until = now() + GATE_COOLDOWN_MS;
    },
    remainingSeconds() {
      return Math.max(0, Math.ceil((until - now()) / 1000));
    },
  };
}

export function installParentalGate(): void {
  const gateEl = document.getElementById("parental-gate");
  const questionEl = document.getElementById("parental-gate-question");
  const inputEl = document.getElementById("parental-gate-input") as HTMLInputElement | null;
  const okEl = document.getElementById("parental-gate-ok");
  const cancelEl = document.getElementById("parental-gate-cancel");
  if (!gateEl || !questionEl || !inputEl || !okEl || !cancelEl) return;

  const cooldown = createGateCooldown();
  let question: GateQuestion | null = null;
  let onResult: ((passed: boolean | null) => void) | null = null;

  // passed: true = correct, false = wrong, null = cancelled
  function close(passed: boolean | null): void {
    gateEl!.setAttribute("hidden", "");
    const cb = onResult;
    onResult = null;
    question = null; // a second click on 確認 must not fire the callback again
    if (passed === false) cooldown.recordWrong();
    if (cb) cb(passed);
  }

  okEl.addEventListener("click", () => {
    if (question) close(checkGateAnswer(question, inputEl.value));
  });
  cancelEl.addEventListener("click", () => close(null));
  inputEl.addEventListener("keydown", (e) => {
    e.stopPropagation(); // keep typing digits from reaching the game's key handlers
    if (e.key === "Enter") okEl.click();
  });

  // Returns the cooldown seconds left; when > 0 the gate is not opened and cb is never called.
  (window as unknown as { askParentalGate: (cb: (passed: boolean | null) => void) => number }).askParentalGate = (cb) => {
    const wait = cooldown.remainingSeconds();
    if (wait > 0) return wait;
    question = createGateQuestion();
    questionEl.textContent = question.prompt;
    inputEl.value = "";
    onResult = cb;
    gateEl.removeAttribute("hidden");
    inputEl.focus();
    return 0;
  };
}
