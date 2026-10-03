import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import client from "../api/client";
import { Card, Loading, Empty, Badge } from "../components/UI";
import { colors, spacing, mono } from "../theme";
import { formatPenceToGBP, formatDate } from "../utils/format";

export default function OffersScreen() {
  const [offers, setOffers] = useState<any[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await client.get("/customer/offers");
    setOffers(data);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!offers) return <Loading />;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
      data={offers}
      keyExtractor={(o) => o.id}
      ListEmptyComponent={<Card><Empty title="No active offers" subtitle="Check back soon for deposit bonuses" /></Card>}
      renderItem={({ item }) => (
        <Card style={styles.card} testID={`offer-${item.id}`}>
          <View style={styles.headerRow}>
            <Badge label="DEPOSIT BONUS" color={colors.brass} />
            <Ionicons name="pricetag" size={18} color={colors.brass} />
          </View>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.desc}>{item.description}</Text>
          <View style={styles.dealRow}>
            <View style={styles.dealBox}>
              <Text style={styles.dealLabel}>Deposit</Text>
              <Text style={styles.dealVal}>{formatPenceToGBP(item.deposit_amount)}</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={colors.brass} />
            <View style={[styles.dealBox, { backgroundColor: colors.emeraldDim }]}>
              <Text style={styles.dealLabel}>You get</Text>
              <Text style={[styles.dealVal, { color: colors.emerald }]}>+{formatPenceToGBP(item.bonus_value)}</Text>
            </View>
          </View>
          {item.end_date ? <Text style={styles.ends}>Ends {formatDate(item.end_date)}</Text> : null}
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 12 },
  desc: { color: colors.textSecondary, fontSize: 14, marginTop: 4 },
  dealRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  dealBox: { flex: 1, backgroundColor: colors.bg, borderRadius: 12, padding: 12, alignItems: "center" },
  dealLabel: { color: colors.textMuted, fontSize: 12 },
  dealVal: { color: colors.text, fontSize: 18, fontWeight: "700", fontFamily: mono, marginTop: 4 },
  ends: { color: colors.textMuted, fontSize: 12, marginTop: 12 },
});
