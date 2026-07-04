import { Suspense } from "react";
import { CostPage } from "@/features/cost/CostPage";
import { LoadingState } from "@/components/shared/States";

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CostPage />
    </Suspense>
  );
}
