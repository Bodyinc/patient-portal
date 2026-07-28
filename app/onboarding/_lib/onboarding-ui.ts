export function getQuestionnaireGridClass(questionCount: number) {
  if (questionCount <= 1) {
    return "mx-auto grid w-full max-w-xl gap-2";
  }
  if (questionCount === 2) {
    return "grid grid-cols-1 gap-2 sm:grid-cols-2";
  }
  return "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3";
}
