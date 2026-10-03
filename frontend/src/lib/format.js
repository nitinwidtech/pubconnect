// Money is stored as integer pence. Always display as £X.XX.
export function formatPenceToGBP(pence) {
  const n = Number(pence || 0);
  const neg = n < 0;
  const v = (Math.abs(n) / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${neg ? "-" : ""}£${v}`;
}

// Parse a user string like "12.50" or "12" into integer pence.
export function parseGBPToPence(str) {
  if (str === null || str === undefined || str === "") return 0;
  const clean = String(str).replace(/[£,\s]/g, "");
  const num = parseFloat(clean);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export const TXN_META = {
  CASH_DEPOSIT: { label: "Cash Deposit", tone: "positive" },
  PROMOTIONAL_BONUS: { label: "Promo Bonus", tone: "positive" },
  PURCHASE: { label: "Redemption", tone: "negative" },
  REFUND: { label: "Refund", tone: "positive" },
  REVERSAL: { label: "Reversal", tone: "warning" },
  MANUAL_ADJUSTMENT: { label: "Manual Adjustment", tone: "warning" },
};

export const ROLE_LABEL = {
  OWNER: "Owner",
  MANAGER: "Manager",
  BAR_STAFF: "Bar Staff",
};
