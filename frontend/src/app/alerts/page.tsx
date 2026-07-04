import { Suspense } from "react";
import { AlertsPage } from "@/features/alerts/AlertsPage";
import { LoadingState } from "@/components/shared/States";

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AlertsPage />
    </Suspense>
  );
}
