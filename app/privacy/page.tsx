import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  redirect("https://bodyinc.com/privacy-policy");
}
