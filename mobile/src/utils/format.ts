import { colors } from "../theme";

// Money is pence (GBP), computed by the backend. The app never does wallet math.
export function formatPenceToGBP(pence: number): string {
  const n = Number(pence || 0);
  const neg = n < 0;
  const v = (Math.abs(n) / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${neg ? "-" : ""}£${v}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Meta = { label: string; tone: "positive" | "negative" | "warning"; color: string };

export const TXN_META: Record<string, Meta> = {
  CASH_DEPOSIT: { label: "Cash Deposit", tone: "positive", color: colors.emerald },
  PROMOTIONAL_BONUS: { label: "Promo Bonus", tone: "positive", color: colors.emerald },
  PURCHASE: { label: "Purchase", tone: "negative", color: colors.crimson },
  REFUND: { label: "Refund", tone: "positive", color: colors.emerald },
  REVERSAL: { label: "Reversal", tone: "warning", color: colors.amber },
  MANUAL_ADJUSTMENT: { label: "Adjustment", tone: "warning", color: colors.amber },
};

export function txnMeta(type: string): Meta {
  return TXN_META[type] || { label: type, tone: "warning", color: colors.textSecondary };
}
