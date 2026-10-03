import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Card, Loading, Badge, SectionTitle, Empty, MonoText } from "../components/UI";
import { colors, spacing, radius, mono } from "../theme";
import { formatPenceToGBP, formatDate, txnMeta } from "../utils/format";

export default function HomeScreen({ navigation }: any) {
  const { customer } = useAuth();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await client.get("/customer/home");
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
      <Text style={styles.hello}>Hi, {customer?.full_name?.split(" ")[0] || "there"}</Text>

      {/* Wallet balance hero */}
      <Card style={styles.hero} testID="home-balance-card">
        <Text style={styles.heroLabel}>AVAILABLE WALLET VALUE</Text>
        <Text style={styles.heroValue} testID="home-balance-value">{formatPenceToGBP(data.balance.total_minor)}</Text>
        <View style={styles.heroRow}>
          <View style={styles.heroPill}><Text style={styles.heroPillText}>Cash {formatPenceToGBP(data.balance.cash_minor)}</Text></View>
          <View style={styles.heroPill}><Text style={styles.heroPillText}>Promo {formatPenceToGBP(data.balance.promo_minor)}</Text></View>
        </View>
        <TouchableOpacity testID="home-pay-cta" style={styles.payBtn} onPress={() => navigation.navigate("Pay")} activeOpacity={0.85}>
          <Ionicons name="qr-code" size={18} color="#0D0B0A" />
          <Text style={styles.payBtnText}>Pay at Pub</Text>
        </TouchableOpacity>
      </Card>

      {/* Offers */}
      <SectionTitle>Current offers</SectionTitle>
      {data.offers.length === 0 ? (
        <Card><Empty title="No active offers" subtitle="Check back soon" /></Card>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
          {data.offers.map((o: any) => (
            <Card key={o.id} style={styles.offerCard} testID={`home-offer-${o.id}`}>
              <Badge label="OFFER" color={colors.brass} />
              <Text style={styles.offerName}>{o.name}</Text>
              <Text style={styles.offerDesc} numberOfLines={2}>{o.description}</Text>
              <Text style={styles.offerBonus}>Deposit {formatPenceToGBP(o.deposit_amount)} → +{formatPenceToGBP(o.bonus_value)}</Text>
            </Card>
          ))}
        </ScrollView>
      )}

      {/* Upcoming events placeholder */}
      <SectionTitle>Upcoming events</SectionTitle>
      <Card style={{ marginBottom: spacing.lg, alignItems: "center", paddingVertical: 28 }} testID="home-events-placeholder">
        <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
        <Text style={{ color: colors.textSecondary, marginTop: 10, fontWeight: "600" }}>Nothing scheduled yet</Text>
        <Text style={{ color: colors.textMuted, marginTop: 4, fontSize: 13 }}>Pub events will appear here soon</Text>
      </Card>

      {/* Recent transactions */}
      <SectionTitle>Recent activity</SectionTitle>
      <Card style={{ padding: 0 }}>
        {data.recent_transactions.length === 0 ? (
          <Empty title="No transactions yet" />
        ) : (
          data.recent_transactions.map((t: any, i: number) => {
            const m = txnMeta(t.transaction_type);
            const eff = t.balance_effect_minor;
            return (
              <View key={t.id} style={[styles.txnRow, i > 0 && styles.txnDivider]} testID={`home-txn-${t.id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "600" }}>{m.label}</Text>
                  <MonoText style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{t.reference_code}</MonoText>
                </View>
                <Text style={[styles.txnAmount, { color: eff >= 0 ? colors.emerald : colors.crimson, fontFamily: mono }]}>
                  {eff >= 0 ? "+" : ""}{formatPenceToGBP(eff)}
                </Text>
              </View>
            );
          })
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hello: { color: colors.textSecondary, fontSize: 16, marginBottom: 14 },
  hero: { marginBottom: spacing.lg, borderColor: colors.brass + "55" },
  heroLabel: { color: colors.textMuted, fontSize: 12, letterSpacing: 1, fontWeight: "600" },
  heroValue: { color: colors.brass, fontSize: 44, fontWeight: "800", fontFamily: mono, marginTop: 6 },
  heroRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  heroPill: { backgroundColor: colors.bg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  heroPillText: { color: colors.textSecondary, fontSize: 13, fontFamily: mono },
  payBtn: { marginTop: 18, backgroundColor: colors.brass, borderRadius: radius.md, height: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  payBtnText: { color: "#0D0B0A", fontWeight: "700", fontSize: 16 },
  offerCard: { width: 220, marginRight: 12 },
  offerName: { color: colors.text, fontWeight: "700", fontSize: 16, marginTop: 10 },
  offerDesc: { color: colors.textSecondary, fontSize: 13, marginTop: 4, minHeight: 34 },
  offerBonus: { color: colors.emerald, fontWeight: "600", marginTop: 8, fontFamily: mono, fontSize: 13 },
  txnRow: { flexDirection: "row", alignItems: "center", padding: 16 },
  txnDivider: { borderTopColor: colors.border, borderTopWidth: 1 },
  txnAmount: { fontWeight: "700", fontSize: 15 },
});
