import React, { useState } from "react";
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/AuthContext";
import { apiError } from "../api/client";
import { Field, PrimaryButton } from "../components/UI";
import { colors, spacing } from "../theme";

export default function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const [form, setForm] = useState({ full_name: "", email: "", mobile_number: "", password: "" });
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError("");
    if (!form.full_name || !form.password || (!form.email && !form.mobile_number)) {
      setError("Enter your name, a password and an email or mobile number.");
      return;
    }
    setLoading(true);
    try {
      await register({
        full_name: form.full_name.trim(),
        password: form.password,
        email: form.email.trim() || undefined,
        mobile_number: form.mobile_number.trim() || undefined,
        marketing_consent: consent,
      });
    } catch (e: any) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity testID="back-to-login" onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join The Crown &amp; Anchor wallet</Text>

        <Field label="Full name" value={form.full_name} onChangeText={(v: string) => set("full_name", v)} placeholder="Your name" autoCapitalize="words" testID="reg-name" />
        <Field label="Email (optional if mobile given)" value={form.email} onChangeText={(v: string) => set("email", v)} placeholder="you@example.com" keyboardType="email-address" testID="reg-email" />
        <Field label="Mobile number (optional if email given)" value={form.mobile_number} onChangeText={(v: string) => set("mobile_number", v)} placeholder="07700…" keyboardType="phone-pad" testID="reg-mobile" />
        <Field label="Password" value={form.password} onChangeText={(v: string) => set("password", v)} placeholder="Choose a password" secureTextEntry testID="reg-password" />

        <View style={styles.consentRow}>
          <Text style={{ color: colors.textSecondary, flex: 1 }}>Send me offers &amp; news</Text>
          <Switch value={consent} onValueChange={setConsent} trackColor={{ true: colors.brass }} testID="reg-consent" />
        </View>

        {error ? <Text testID="reg-error" style={styles.error}>{error}</Text> : null}

        <PrimaryButton title="Create account" onPress={submit} loading={loading} testID="reg-submit" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 60, flexGrow: 1 },
  back: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  subtitle: { color: colors.textSecondary, marginTop: 6, marginBottom: 24 },
  consentRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  error: { color: colors.crimson, marginBottom: 12 },
});
