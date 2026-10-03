import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Switch, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import client, { apiError } from "../api/client";
import { Card, Loading, PrimaryButton } from "../components/UI";
import { colors, spacing } from "../theme";

const ITEMS: { key: string; label: string; desc: string; icon: any }[] = [
  { key: "transactional", label: "Transaction alerts", desc: "Deposits, payments and refunds on your wallet", icon: "receipt-outline" },
  { key: "offers", label: "Offers & promotions", desc: "New deposit bonuses and pub promotions", icon: "pricetag-outline" },
  { key: "email", label: "Email", desc: "Receive notifications by email", icon: "mail-outline" },
  { key: "push", label: "Push notifications", desc: "Receive alerts on this device", icon: "phone-portrait-outline" },
];

export default function NotificationPreferencesScreen() {
  const [prefs, setPrefs] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);

  useEffect(() => {
    client.get("/customer/notification-preferences").then((r) => setPrefs(r.data)).catch(() => setPrefs({}));
  }, []);

  const toggle = (k: string) => setPrefs((p: any) => ({ ...p, [k]: !p[k] }));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await client.patch("/customer/notification-preferences", prefs);
      setPrefs(data);
      setSavedOnce(true);
    } catch (e: any) {
      // surface minimal error inline
      setSavedOnce(false);
    } finally {
      setSaving(false);
    }
  };

  if (!prefs) return <Loading />;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.md }}>
      <Text style={styles.intro}>Choose what PubConnect can notify you about. Delivery is set up by the pub; your preferences are saved here.</Text>
      <Card style={{ padding: 0 }}>
        {ITEMS.map((it, i) => (
          <View key={it.key} style={[styles.row, i > 0 && styles.divider]}>
            <Ionicons name={it.icon} size={20} color={colors.brass} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.label}>{it.label}</Text>
              <Text style={styles.desc}>{it.desc}</Text>
            </View>
            <Switch
              testID={`notif-${it.key}`}
              value={!!prefs[it.key]}
              onValueChange={() => toggle(it.key)}
              trackColor={{ true: colors.brass }}
            />
          </View>
        ))}
      </Card>

      {savedOnce ? (
        <View style={styles.saved} testID="notif-saved">
          <Ionicons name="checkmark-circle" size={16} color={colors.emerald} />
          <Text style={{ color: colors.emerald, fontSize: 13 }}>Preferences saved</Text>
        </View>
      ) : null}

      <PrimaryButton title="Save preferences" onPress={save} loading={saving} testID="notif-save-btn" style={{ marginTop: spacing.lg }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "center", padding: 16 },
  divider: { borderTopColor: colors.border, borderTopWidth: 1 },
  label: { color: colors.text, fontWeight: "600", fontSize: 15 },
  desc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  saved: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 16 },
});
