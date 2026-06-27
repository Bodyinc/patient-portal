export type QuizOutcome = "pass" | "fail";

export function getQuizOutcome(selected: string): QuizOutcome {
  // TODO: replace with your custom fail rule
  void selected;
  return "pass";
}
