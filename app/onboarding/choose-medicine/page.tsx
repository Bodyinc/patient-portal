import { redirect } from "next/navigation";

export default function ChooseMedicineRedirectPage() {
  redirect("/onboarding/medications");
}
