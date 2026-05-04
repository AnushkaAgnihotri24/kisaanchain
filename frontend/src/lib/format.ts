import { format } from "date-fns";

export function formatDate(value?: string | number | Date | null) {
  if (!value) {
    return "Not recorded";
  }

  try {
    return format(new Date(value), "dd MMM yyyy");
  } catch {
    return "Invalid date";
  }
}

export function shortAddress(value?: string | null) {
  if (!value) {
    return "Not linked";
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function roleLabel(value: string) {
  return value === "BUYER" ? "Retailer" : toTitleCase(value);
}
