import { Label } from "@/components/ui/label";
import { Input, type InputProps } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export function TextInputField({ label, ...props }: InputProps & { label: string }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input {...props} />
    </div>
  );
}

export function NumberInputField({ label, ...props }: InputProps & { label: string }) {
  return <TextInputField label={label} type="number" {...props} />;
}

export function TimeInputField({ label, ...props }: InputProps & { label: string }) {
  return <TextInputField label={label} type="time" {...props} />;
}

export function SelectField({
  label,
  value,
  onValueChange,
  options
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
