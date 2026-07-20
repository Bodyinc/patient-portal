import { requirePatientSession } from "@/lib/auth/require-patient";
import { getMyProfile, healProfileEmail } from "@/lib/actions/profile";
import ProfileEditor from "./_components/ProfileEditor";

export default async function ProfilePage() {
  await requirePatientSession();

  // Undo any auth/profile email drift left by an abandoned email change before rendering.
  await healProfileEmail();

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
