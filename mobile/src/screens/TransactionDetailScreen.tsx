import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import client from "../api/client";
import { Card, Loading, Badge, MonoText } from "../components/UI";
import { colors, spacing, mono } from "../theme";
import { formatPenceToGBP, formatDate, txnMeta } from "../utils/format";

function Row({ label, value, mono: isMono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, isMono && { fontFamily: mono }]}>{value}</Text>
    </View>
  );
}

export default function TransactionDetailScreen({ route }: any) {
  const { id } = route.params;
  const [t, setT] = useState<any>(null);

  useEffect(() => {
    client.get(`/customer/transactions/${id}`).then((r) => setT(r.data)).catch(() => setT(false));
  }, [id]);

  if (t === null) return <Loading />;
  if (t === false) return <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.textSecondary }}>Transaction not found</Text></View>;

  const m = txnMeta(t.transaction_type);
  const eff = t.balance_effect_minor;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.md }}>
      <Card style={styles.hero} testID="txn-detail-hero">
        <View style={styles.iconWrap}>
          <Ionicons name={eff >= 0 ? "arrow-down" : "arrow-up"} size={26} color={eff >= 0 ? colors.emerald : colors.crimson} />
        </View>
        <Badge label={m.label} color={m.color} />
        <Text style={[styles.amount, { color: eff >= 0 ? colors.emerald : colors.crimson }]}>
          {eff >= 0 ? "+" : ""}{formatPenceToGBP(eff)}
        </Text>
        <Text style={styles.sub}>{formatDate(t.created_at)}</Text>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Row label="Reference" value={t.reference_code} mono />
        <Row label="Type" value={m.label} />
        <Row label="Amount" value={formatPenceToGBP(t.amount_minor)} mono />
        <Row label="Balance effect" value={`${eff >= 0 ? "+" : ""}${formatPenceToGBP(eff)}`} mono />
        <Row label="Currency" value={t.currency || "GBP"} />
        {t.reason ? <Row label="Reason" value={t.reason} /> : null}
      </Card>

      {t.related_transaction ? (
        <Card style={{ marginTop: spacing.md }} testID="txn-detail-related">
          <Text style={styles.linkTitle}>Linked to</Text>
          <View style={styles.linkRow}>
            <MonoText style={{ color: colors.textSecondary }}>{t.related_transaction.reference_code}</MonoText>
            <Badge label={txnMeta(t.related_transaction.transaction_type).label} color={txnMeta(t.related_transaction.transaction_type).color} />
          </View>
        </Card>
      ) : null}

      <View style={styles.confirm} testID="txn-detail-confirmation">
        <Ionicons name="shield-checkmark" size={16} color={colors.emerald} />
        <Text style={styles.confirmText}>Confirmed &amp; recorded on the pub's append-only ledger</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingVertical: 24 },
  iconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  amount: { fontSize: 36, fontWeight: "800", fontFamily: mono, marginTop: 12 },
  sub: { color: colors.textMuted, marginTop: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { color: colors.textSecondary },
  rowValue: { color: colors.text, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  linkTitle: { color: colors.textMuted, fontSize: 12, marginBottom: 8 },
  linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  confirm: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", marginTop: spacing.lg },
  confirmText: { color: colors.textMuted, fontSize: 13 },
});
