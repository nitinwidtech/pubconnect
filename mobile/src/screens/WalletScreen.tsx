import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import client from "../api/client";
import { Card, Loading, SectionTitle, Empty, MonoText } from "../components/UI";
import { colors, spacing, mono } from "../theme";
import { formatPenceToGBP, formatDate } from "../utils/format";

const SECTIONS: { key: string; title: string; positive: boolean }[] = [
  { key: "cash_deposits", title: "Cash deposited", positive: true },
  { key: "promotional_bonuses", title: "Promotional bonus", positive: true },
  { key: "purchases", title: "Purchases", positive: false },
  { key: "refunds", title: "Refunds", positive: true },
  { key: "reversals", title: "Reversals", positive: false },
  { key: "manual_adjustments", title: "Adjustments", positive: true },
];

export default function WalletScreen() {
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await client.get("/customer/wallet");
    setData(data);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  if (!data) return <Loading />;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brass} />}
    >
      <Card style={styles.balanceCard} testID="wallet-balance-card">
        <Text style={styles.label}>AVAILABLE BALANCE</Text>
        <Text style={styles.total} testID="wallet-total">{formatPenceToGBP(data.balance.total_minor)}</Text>
        <View style={styles.splitRow}>
          <View style={styles.splitCol}>
            <Text style={styles.splitLabel}>Cash</Text>
            <MonoText style={styles.splitVal}>{formatPenceToGBP(data.balance.cash_minor)}</MonoText>
          </View>
          <View style={styles.splitDivider} />
          <View style={styles.splitCol}>
            <Text style={styles.splitLabel}>Promo</Text>
            <MonoText style={[styles.splitVal, { color: colors.brass }]}>{formatPenceToGBP(data.balance.promo_minor)}</MonoText>
          </View>
        </View>
      </Card>

      {SECTIONS.map((s) => {
        const items = data[s.key] || [];
        if (items.length === 0) return null;
        return (
          <View key={s.key} style={{ marginTop: spacing.lg }}>
            <SectionTitle>{s.title}</SectionTitle>
            <Card style={{ padding: 0 }}>
              {items.map((t: any, i: number) => (
                <View key={t.id} style={[styles.row, i > 0 && styles.divider]} testID={`wallet-txn-${t.id}`}>
                  <View style={{ flex: 1 }}>
                    <MonoText style={{ color: colors.textSecondary, fontSize: 12 }}>{t.reference_code}</MonoText>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{formatDate(t.created_at)}</Text>
                  </View>
                  <Text style={[styles.amount, { color: t.balance_effect_minor >= 0 ? colors.emerald : colors.crimson }]}>
                    {t.balance_effect_minor >= 0 ? "+" : ""}{formatPenceToGBP(t.balance_effect_minor)}
                  </Text>
                </View>
              ))}
            </Card>
          </View>
        );
      })}

      {SECTIONS.every((s) => (data[s.key] || []).length === 0) && (
        <Card style={{ marginTop: spacing.lg }}><Empty title="No wallet activity yet" subtitle="Top up at the bar to get started" /></Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  balanceCard: { borderColor: colors.brass + "55", alignItems: "center", paddingVertical: 24 },
  label: { color: colors.textMuted, fontSize: 12, letterSpacing: 1, fontWeight: "600" },
  total: { color: colors.brass, fontSize: 46, fontWeight: "800", fontFamily: mono, marginTop: 6 },
  splitRow: { flexDirection: "row", marginTop: 18, width: "100%" },
  splitCol: { flex: 1, alignItems: "center" },
  splitDivider: { width: 1, backgroundColor: colors.border },
  splitLabel: { color: colors.textMuted, fontSize: 13 },
  splitVal: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", padding: 16 },
  divider: { borderTopColor: colors.border, borderTopWidth: 1 },
  amount: { fontWeight: "700", fontSize: 15, fontFamily: mono },
});
