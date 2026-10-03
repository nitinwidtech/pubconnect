import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import client, { apiError } from "../api/client";
import { PrimaryButton, GhostButton, Card, Badge } from "../components/UI";
import { colors, spacing, radius, mono } from "../theme";
import { formatPenceToGBP, formatDate, txnMeta } from "../utils/format";

type TokenState = { token: string; expires_at: string; ttl_minutes: number } | null;
type Phase = "idle" | "active" | "expired" | "used";

export default function PayScreen() {
  const [token, setToken] = useState<TokenState>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ balance: any; lastTxn: any } | null>(null);
  const countdownRef = useRef<any>(null);
  const pollRef = useRef<any>(null);

  const clearTimers = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const generate = async () => {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const { data } = await client.post("/customer/action-tokens", { action_type: "PAY" });
      setToken(data);
      setPhase("active");
      const secs = Math.max(0, Math.floor((new Date(data.expires_at).getTime() - Date.now()) / 1000));
      setSecondsLeft(secs);
    } catch (e: any) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  // Load server-authoritative result (balance + latest transaction) once the code is used.
  const loadResult = async () => {
    try {
      const [w, txns] = await Promise.all([
        client.get("/customer/wallet"),
        client.get("/customer/transactions"),
      ]);
      setResult({ balance: w.data.balance, lastTxn: (txns.data || [])[0] || null });
    } catch {
      setResult({ balance: null, lastTxn: null });
    }
  };

  useEffect(() => {
    if (!token || phase !== "active") return;
    clearTimers();

    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(countdownRef.current);
          setPhase((p) => (p === "active" ? "expired" : p));
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    // Poll the backend for single-use consumption (staff resolved the QR).
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await client.post("/customer/action-tokens/status", { token: token.token });
        if (data.status === "used") {
          clearTimers();
          setPhase("used");
          loadResult();
        } else if (data.status === "expired") {
          clearTimers();
          setPhase("expired");
        }
      } catch {
        /* keep polling */
      }
    }, 3000);

    return clearTimers;
  }, [token, phase]);

  const reset = () => {
    clearTimers();
    setToken(null);
    setPhase("idle");
    setResult(null);
    setError("");
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const pct = token ? Math.max(0, secondsLeft / (token.ttl_minutes * 60)) : 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Pay at Pub</Text>
      <Text style={styles.subtitle}>Show this code to the bar staff to pay from your wallet</Text>

      {phase === "idle" && (
        <View style={styles.center}>
          <View style={styles.placeholder}>
            <Ionicons name="qr-code-outline" size={72} color={colors.textMuted} />
          </View>
          <Text style={styles.hint}>Generate a secure one-time code when you're ready to pay.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton title="Generate Pay Code" onPress={generate} loading={loading} testID="pay-generate-btn" style={{ width: "100%", marginTop: 8 }} />
        </View>
      )}

      {phase === "active" && token && (
        <View style={styles.center}>
          <View style={styles.qrFrame} testID="pay-qr">
            <QRCode value={token.token} size={230} color="#0D0B0A" backgroundColor="#FFFFFF" />
          </View>
          <View style={styles.countdownRow} testID="pay-countdown">
            <Ionicons name="timer-outline" size={18} color={colors.brass} />
            <Text style={styles.countdownText}>Expires in {mins}:{secs.toString().padStart(2, "0")}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
          </View>
          <View style={styles.secureRow}>
            <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
            <Text style={styles.secureText}>Single-use · opaque · no personal data in the code</Text>
          </View>
          <Text style={styles.waiting}>Waiting for the bar to scan…</Text>
          <GhostButton title="Cancel" onPress={reset} testID="pay-cancel-btn" style={{ width: "100%", marginTop: 18 }} />
        </View>
      )}

      {phase === "expired" && (
        <View style={styles.center}>
          <View style={[styles.qrFrame, { opacity: 0.2 }]}>
            {token ? <QRCode value={token.token} size={230} color="#0D0B0A" backgroundColor="#FFFFFF" /> : null}
          </View>
          <View style={styles.expiredBox} testID="pay-expired">
            <Ionicons name="time-outline" size={18} color={colors.crimson} />
            <Text style={styles.expiredText}>This code has expired. Generate a new one.</Text>
          </View>
          <PrimaryButton title="Generate New Code" onPress={generate} loading={loading} testID="pay-regenerate-btn" style={{ width: "100%", marginTop: 20 }} />
        </View>
      )}

      {phase === "used" && (
        <View style={styles.center}>
          <View style={styles.successCircle} testID="pay-used">
            <Ionicons name="checkmark-circle" size={72} color={colors.emerald} />
          </View>
          <Text style={styles.usedTitle}>Code used</Text>
          <Text style={styles.usedSub}>This one-time code has been redeemed by the bar and cannot be used again.</Text>

          {result && result.balance ? (
            <Card style={styles.resultCard} testID="pay-result-card">
              {result.lastTxn ? (
                <View style={styles.resultRow}>
                  <Badge label={txnMeta(result.lastTxn.transaction_type).label} color={txnMeta(result.lastTxn.transaction_type).color} />
                  <Text style={[styles.resultAmount, { color: result.lastTxn.balance_effect_minor >= 0 ? colors.emerald : colors.crimson }]}>
                    {result.lastTxn.balance_effect_minor >= 0 ? "+" : ""}{formatPenceToGBP(result.lastTxn.balance_effect_minor)}
                  </Text>
                </View>
              ) : null}
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Updated wallet balance</Text>
                <Text style={styles.balanceVal} testID="pay-result-balance">{formatPenceToGBP(result.balance.total_minor)}</Text>
              </View>
              <Text style={styles.authNote}>Balance confirmed by the pub's ledger</Text>
            </Card>
          ) : (
            <Card style={styles.resultCard}>
              <Text style={{ color: colors.textSecondary, textAlign: "center" }}>Fetching your updated balance…</Text>
            </Card>
          )}

          <GhostButton title="Refresh balance" onPress={loadResult} testID="pay-refresh-btn" style={{ width: "100%", marginTop: 8 }} />
          <PrimaryButton title="Done" onPress={reset} testID="pay-done-btn" style={{ width: "100%", marginTop: 10 }} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: 40, flexGrow: 1 },
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
  waiting: { color: colors.textSecondary, marginTop: 16, fontSize: 13 },
  expiredBox: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, backgroundColor: colors.crimsonDim, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md },
  expiredText: { color: colors.crimson, fontSize: 14, fontWeight: "600" },
  error: { color: colors.crimson, marginBottom: 12 },
  successCircle: { marginBottom: 12 },
  usedTitle: { color: colors.text, fontSize: 24, fontWeight: "800" },
  usedSub: { color: colors.textSecondary, textAlign: "center", marginTop: 8, paddingHorizontal: 16 },
  resultCard: { width: "100%", marginTop: 20 },
  resultRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  resultAmount: { fontSize: 18, fontWeight: "700", fontFamily: mono },
  balanceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 14 },
  balanceLabel: { color: colors.textSecondary },
  balanceVal: { color: colors.brass, fontSize: 20, fontWeight: "800", fontFamily: mono },
  authNote: { color: colors.textMuted, fontSize: 12, marginTop: 10, textAlign: "center" },
});
