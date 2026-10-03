import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import client, { apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Card, Field, PrimaryButton, GhostButton, MonoText } from "../components/UI";
import { colors, spacing } from "../theme";

export default function ProfileScreen({ navigation }: any) {
  const { customer, pub, logout, setCustomer } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: customer?.full_name || "",
    email: customer?.email || "",
  });
  const [consent, setConsent] = useState(!!customer?.marketing_consent);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = { full_name: form.full_name, marketing_consent: consent };
      if (form.email) payload.email = form.email.trim();
      const { data } = await client.patch("/customer/profile", payload);
      setCustomer(data);
      setEditing(false);
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (e: any) {
      Alert.alert("Could not save", apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => logout() },
    ]);
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
      <Card style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(customer?.full_name || "?").charAt(0)}</Text>
        </View>
        <Text style={styles.name}>{customer?.full_name}</Text>
        <MonoText style={{ color: colors.textMuted, marginTop: 4 }}>{customer?.customer_code}</MonoText>
        <Text style={styles.pub}>{pub?.name}</Text>
      </Card>

      {!editing ? (
        <Card style={{ marginTop: spacing.md }}>
          <InfoRow icon="call-outline" label="Mobile" value={customer?.mobile_number || "—"} />
          <InfoRow icon="mail-outline" label="Email" value={customer?.email || "—"} />
          <InfoRow icon="megaphone-outline" label="Marketing" value={customer?.marketing_consent ? "Opted in" : "Opted out"} />
          <GhostButton title="Edit profile" testID="profile-edit-btn" onPress={() => setEditing(true)} style={{ marginTop: 14 }} />
        </Card>
      ) : (
        <Card style={{ marginTop: spacing.md }}>
          <Field label="Full name" value={form.full_name} onChangeText={(v: string) => set("full_name", v)} autoCapitalize="words" testID="profile-name" />
          <Field label="Email" value={form.email} onChangeText={(v: string) => set("email", v)} keyboardType="email-address" testID="profile-email" />
          <View style={styles.consentRow}>
            <Text style={{ color: colors.textSecondary, flex: 1 }}>Marketing consent</Text>
            <Switch value={consent} onValueChange={setConsent} trackColor={{ true: colors.brass }} testID="profile-consent" />
          </View>
          <PrimaryButton title="Save changes" onPress={save} loading={saving} testID="profile-save-btn" style={{ marginTop: 8 }} />
          <GhostButton title="Cancel" onPress={() => setEditing(false)} style={{ marginTop: 10 }} />
        </Card>
      )}

      <TouchableOpacity
        testID="profile-notifications-link"
        style={styles.linkCard}
        onPress={() => navigation.navigate("NotificationPreferences")}
        activeOpacity={0.7}
      >
        <Ionicons name="notifications-outline" size={20} color={colors.brass} />
        <Text style={styles.linkText}>Notification preferences</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <GhostButton title="Sign out" testID="profile-logout-btn" onPress={confirmLogout} style={{ marginTop: spacing.lg }} />
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingVertical: 24 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.mahogany, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.text, fontSize: 30, fontWeight: "800" },
  name: { color: colors.text, fontSize: 22, fontWeight: "700", marginTop: 12 },
  pub: { color: colors.brass, marginTop: 8, fontWeight: "600" },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  infoLabel: { color: colors.textSecondary, marginLeft: 12, flex: 1 },
  infoValue: { color: colors.text, fontWeight: "600" },
  consentRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  linkCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 16, marginTop: spacing.md },
  linkText: { color: colors.text, fontWeight: "600", flex: 1 },
});
