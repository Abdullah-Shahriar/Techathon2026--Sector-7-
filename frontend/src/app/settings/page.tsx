import { Suspense } from "react";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { LoadingState } from "@/components/shared/States";

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SettingsPage />
    </Suspense>
  );
}
