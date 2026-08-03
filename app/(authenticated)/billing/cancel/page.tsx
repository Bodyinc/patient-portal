import { redirect } from "next/navigation";

export default async function BillingCancelPage({
  searchParams,
}: {
  searchParams?: Promise<{
    subscriptionId?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const subscriptionId = params.subscriptionId?.trim();

  if (subscriptionId) {
    redirect(`/billing?cancel=${encodeURIComponent(subscriptionId)}`);
  }

  redirect("/billing");
}
