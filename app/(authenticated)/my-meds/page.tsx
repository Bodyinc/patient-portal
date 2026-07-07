"use client";

import { useState } from "react";

import ShopHeader from "../shop/_components/ShopHeader";
import ShopReferralCard from "../shop/_components/ShopReferralCard";

import MyMedsHeader from "./components/MyMedsHeader";

export default function MyMedsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#F8F7FC]">
      {/* Shared Header */}
      <ShopHeader
        fullName="Sarah Johnson"
        patientId="#BI-2048"
        avatarUrl="/patient-image.png" // Replace with actual avatar later
        searchQuery={searchQuery}
        currentCategorySlug={null}
        sortBy="popular"
        searchPending={false}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => console.log("Searching...", searchQuery)}
      />

      {/* Page Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Page Header */}
          <MyMedsHeader />

          {/* Referral Program */}
          <ShopReferralCard referralCode="BODYINC-REF-2024" />
        </div>
      </div>
    </main>
  );
}