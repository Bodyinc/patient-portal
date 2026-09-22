import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function Recommend2RedirectPage() {
  redirect("/onboarding/medications");
}
