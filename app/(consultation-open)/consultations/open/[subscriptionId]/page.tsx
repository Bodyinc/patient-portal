import { use } from "react";
import OpenConsultationView from "./_components/OpenConsultationView";

export const metadata = {
  title: "Consultation · BodyInc",
  description: "Connect with your healthcare provider.",
};

type OpenConsultationPageProps = {
  params: Promise<{ subscriptionId: string }>;
};

export default function OpenConsultationPage({ params }: OpenConsultationPageProps) {
  const { subscriptionId } = use(params);
  return <OpenConsultationView subscriptionId={subscriptionId} />;
}
