import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import client, { apiError } from "../api/client";
import { PrimaryButton, Loading } from "../components/UI";
import { colors, spacing, radius, mono } from "../theme";

type TokenState = { token: string; expires_at: string; ttl_minutes: number } | null;

export default function PayScreen() {
  const [token, setToken] = useState<TokenState>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<any>(null);

  const generate = async () => {
    setError("");
    setLoading(true);
    try {
      const { data } = await client.post("/customer/action-tokens", { action_type: "PAY" });
      setToken(data);
      const secs = Math.max(0, Math.floor((new Date(data.expires_at).getTime() - Date.now()) / 1000));
      setSecondsLeft(secs);
    } catch (e: any) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(timer.current); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer.current);
  }, [token]);

  const expired = token && secondsLeft <= 0;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const pct = token ? Math.max(0, secondsLeft / (token.ttl_minutes * 60)) : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pay at Pub</Text>
      <Text style={styles.subtitle}>Show this code to the bar staff to pay from your wallet</Text>

      {!token ? (
        <View style={styles.center}>
          <View style={styles.placeholder}>
            <Ionicons name="qr-code-outline" size={72} color={colors.textMuted} />
          </View>
          <Text style={styles.hint}>Generate a secure one-time code when you're ready to pay.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton title="Generate Pay Code" onPress={generate} loading={loading} testID="pay-generate-btn" style={{ width: "100%", marginTop: 8 }} />
        </View>
      ) : (
        <View style={styles.center}>
          <View style={[styles.qrFrame, expired && { opacity: 0.25 }]} testID="pay-qr">
            <QRCode value={token.token} size={230} color="#0D0B0A" backgroundColor="#FFFFFF" />
          </View>

          {expired ? (
            <View style={styles.expiredBox} testID="pay-expired">
              <Ionicons name="time-outline" size={18} color={colors.crimson} />
              <Text style={styles.expiredText}>This code has expired. Generate a new one.</Text>
            </View>
          ) : (
            <>
              <View style={styles.countdownRow} testID="pay-countdown">
                <Ionicons name="timer-outline" size={18} color={colors.brass} />
                <Text style={styles.countdownText}>
                  Expires in {mins}:{secs.toString().padStart(2, "0")}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
              </View>
              <View style={styles.secureRow}>
                <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
                <Text style={styles.secureText}>Single-use · opaque · no personal data in the code</Text>
              </View>
            </>
          )}

          <PrimaryButton
            title={expired ? "Generate New Code" : "Refresh Code"}
            onPress={generate}
            loading={loading}
            testID="pay-regenerate-btn"
            style={{ width: "100%", marginTop: 24 }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  title: { color: colors.text, fontSize: 26, fontWeight: "800" },
  subtitle: { color: colors.textSecondary, marginTop: 6, marginBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  placeholder: { width: 230, height: 230, borderRadius: radius.lg, borderColor: colors.border, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  hint: { color: colors.textSecondary, textAlign: "center", marginBottom: 20, paddingHorizontal: 20 },
  qrFrame: { backgroundColor: "#FFFFFF", padding: 18, borderRadius: radius.lg },
  countdownRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 22 },
  countdownText: { color: colors.brass, fontSize: 18, fontWeight: "700", fontFamily: mono },
  progressTrack: { width: 230, height: 6, backgroundColor: colors.border, borderRadius: 3, marginTop: 12, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: colors.brass },
  secureRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  secureText: { color: colors.textMuted, fontSize: 12 },
  expiredBox: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, backgroundColor: colors.crimsonDim, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md },
  expiredText: { color: colors.crimson, fontSize: 14, fontWeight: "600" },
  error: { color: colors.crimson, marginBottom: 12 },
});
