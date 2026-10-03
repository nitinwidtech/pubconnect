import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import client from "../api/client";
import { Loading, Empty, MonoText, Badge } from "../components/UI";
import { colors, spacing, mono } from "../theme";
import { formatPenceToGBP, formatDate, txnMeta } from "../utils/format";

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "CASH_DEPOSIT", label: "Deposits" },
  { key: "PURCHASE", label: "Purchases" },
  { key: "PROMOTIONAL_BONUS", label: "Bonus" },
  { key: "REFUND", label: "Refunds" },
  { key: "REVERSAL", label: "Reversals" },
];

export default function TransactionsScreen({ navigation }: any) {
  const [txns, setTxns] = useState<any[] | null>(null);
  const [filter, setFilter] = useState("ALL");

  const load = useCallback(async (type: string) => {
    const params: any = {};
    if (type !== "ALL") params.type = type;
    const { data } = await client.get("/customer/transactions", { params });
    setTxns(data);
  }, []);

  useFocusEffect(useCallback(() => { load(filter); }, [load, filter]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8 }}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            testID={`txn-filter-${f.key}`}
            onPress={() => setFilter(f.key)}
            style={[styles.chip, filter === f.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {!txns ? (
        <Loading />
      ) : txns.length === 0 ? (
        <Empty title="No transactions" subtitle="Nothing to show for this filter" />
      ) : (
        <FlatList
          data={txns}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item }) => {
            const m = txnMeta(item.transaction_type);
            const eff = item.balance_effect_minor;
            return (
              <TouchableOpacity
                testID={`txn-row-${item.id}`}
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => navigation.navigate("TransactionDetail", { id: item.id })}
              >
                <View style={{ flex: 1 }}>
                  <Badge label={m.label} color={m.color} />
                  <MonoText style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>{item.reference_code}</MonoText>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{formatDate(item.created_at)}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.amount, { color: eff >= 0 ? colors.emerald : colors.crimson }]}>
                    {eff >= 0 ? "+" : ""}{formatPenceToGBP(eff)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginTop: 6 }} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { maxHeight: 56, paddingVertical: 10, flexGrow: 0 },
  chip: { borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, height: 36, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.brassMuted, borderColor: colors.brass },
  chipText: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: colors.brass },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  amount: { fontWeight: "700", fontSize: 16, fontFamily: mono },
});
