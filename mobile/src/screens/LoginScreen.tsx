import React, { useState } from "react";
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/AuthContext";
import { apiError } from "../api/client";
import { Field, PrimaryButton } from "../components/UI";
import { colors, spacing } from "../theme";

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("james.demo@crownanchor.demo");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      await login(identifier.trim(), password);
    } catch (e: any) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.logoWrap}>
          <View style={styles.logo}>
            <Ionicons name="beer" size={30} color="#0D0B0A" />
          </View>
          <Text style={styles.title}>PubConnect</Text>
          <Text style={styles.subtitle}>Your pub wallet, in your pocket</Text>
        </View>

        <Field label="Email or mobile number" value={identifier} onChangeText={setIdentifier} placeholder="you@example.com or 07700…" testID="login-identifier" keyboardType="email-address" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry testID="login-password" />

        {error ? <Text testID="login-error" style={styles.error}>{error}</Text> : null}

        <PrimaryButton title="Sign in" onPress={submit} loading={loading} testID="login-submit" />

        <TouchableOpacity testID="go-register" style={styles.linkRow} onPress={() => navigation.navigate("Register")}>
          <Text style={styles.linkMuted}>New here? </Text>
          <Text style={styles.link}>Create an account</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 90, flexGrow: 1 },
  logoWrap: { alignItems: "center", marginBottom: 36 },
  logo: { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.brass, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { color: colors.text, fontSize: 30, fontWeight: "800" },
  subtitle: { color: colors.textSecondary, marginTop: 6, fontSize: 14 },
  error: { color: colors.crimson, marginBottom: 12, fontSize: 14 },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  linkMuted: { color: colors.textMuted },
  link: { color: colors.brass, fontWeight: "600" },
});
