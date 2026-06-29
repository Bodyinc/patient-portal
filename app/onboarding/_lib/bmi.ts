export function calculateBmi(feet: number, inches: number, weightLbs: number): number | null {
  if (feet < 0 || inches < 0 || inches >= 12 || weightLbs <= 0) return null;

  const totalInches = feet * 12 + inches;
  if (totalInches <= 0) return null;

  const bmi = (weightLbs / (totalInches * totalInches)) * 703;
  return Math.round(bmi * 10) / 10;
}

export function getBmiCategory(bmi: number | null): string {
  if (bmi === null) return "";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}
