import { Suspense } from "react";
import { DevicesPage } from "@/features/devices/DevicesPage";
import { LoadingState } from "@/components/shared/States";

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DevicesPage />
    </Suspense>
  );
}
