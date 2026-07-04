"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ReusableDialog } from "./ReusableDialog";

export function ConfirmDialog({
  trigger,
  title,
  description,
  actionLabel = "Confirm",
  danger,
  onConfirm
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <ReusableDialog trigger={trigger} title={title} description={description}>
      <div className="flex justify-end gap-2">
        <Button
          variant={danger ? "destructive" : "default"}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onConfirm().finally(() => setBusy(false));
          }}
        >
          {busy ? "Working" : actionLabel}
        </Button>
      </div>
    </ReusableDialog>
  );
}
