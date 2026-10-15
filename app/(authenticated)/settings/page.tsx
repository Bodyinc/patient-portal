import { PushSettingsCard } from "../_components/PushNotifications";

export default function SettingsPage() {
  return (
    <main className="min-w-0 flex-1 p-3 sm:p-4">
      <div className="mb-4 px-1">
        <h1 className="text-xl font-medium tracking-[-0.5px] text-[#152A51] sm:text-2xl lg:text-[32px]">
          Settings
        </h1>
      </div>
      <PushSettingsCard />
    </main>
  );
}
