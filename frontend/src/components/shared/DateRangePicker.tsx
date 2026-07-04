import type { UsageFilters } from "@/features/api/types";
import { TextInputField } from "./FormField";

export function DateRangePicker({ filters, onChange }: { filters: UsageFilters; onChange: (filters: UsageFilters) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextInputField label="Start" type="datetime-local" value={filters.start} onChange={(event) => onChange({ ...filters, start: event.target.value })} />
      <TextInputField label="End" type="datetime-local" value={filters.end} onChange={(event) => onChange({ ...filters, end: event.target.value })} />
    </div>
  );
}
