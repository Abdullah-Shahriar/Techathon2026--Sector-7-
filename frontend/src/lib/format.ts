export function formatNumber(value: number | null | undefined, digits = 2): string {
  return Number(value ?? 0).toLocaleString("en", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 2 ? 0 : Math.min(digits, 2)
  });
}

export function formatWatts(value: number | null | undefined): string {
  return `${formatNumber(value, 0)} W`;
}

export function formatKwh(value: number | null | undefined): string {
  return `${formatNumber(value, 6)} kWh`;
}

export function formatBdt(value: number | null | undefined): string {
  return `BDT ${formatNumber(value, 2)}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatDuration(seconds: number | null | undefined): string {
  const total = Math.max(0, Number(seconds ?? 0));
  if (total < 60) {
    return `${total}s`;
  }
  const minutes = Math.floor(total / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function titleFromId(value: string): string {
  return value
    .replace(/^room-node-/, "")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
