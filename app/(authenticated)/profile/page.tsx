import { requirePatientSession } from "@/lib/auth/require-patient";
import { getMyProfile } from "@/lib/actions/profile";
import ProfileEditor from "./_components/ProfileEditor";

export default async function ProfilePage() {
  await requirePatientSession();

  const profileResult = await getMyProfile();
  if (!profileResult.ok) {
    return (
      <main className="min-w-0 flex-1 bg-[#FAF8FF] p-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {profileResult.message}
        </div>
      </main>
    );
  }

  return <ProfileEditor initialProfile={profileResult.data} />;
}
