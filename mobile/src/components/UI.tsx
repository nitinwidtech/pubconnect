import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput,
  ViewStyle, TextStyle,
} from "react-native";
import { colors, radius, spacing, mono } from "../theme";

export function Card({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({
  title, onPress, loading, disabled, testID, style,
}: {
  title: string; onPress: () => void; loading?: boolean; disabled?: boolean;
  testID?: string; style?: ViewStyle;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.primaryBtn, (disabled || loading) && { opacity: 0.6 }, style]}
    >
      {loading ? (
        <ActivityIndicator color="#0D0B0A" />
      ) : (
        <Text style={styles.primaryBtnText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function GhostButton({ title, onPress, testID, style }: { title: string; onPress: () => void; testID?: string; style?: ViewStyle; }) {
  return (
    <TouchableOpacity testID={testID} activeOpacity={0.7} onPress={onPress} style={[styles.ghostBtn, style]}>
      <Text style={styles.ghostBtnText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function Field({
  label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize, testID,
}: any) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || "none"}
        style={styles.input}
      />
    </View>
  );
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + "22" }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function MonoText({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[{ fontFamily: mono, color: colors.text }, style]}>{children}</Text>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.brass} size="large" />
      {label ? <Text style={{ color: colors.textSecondary, marginTop: 12 }}>{label}</Text> : null}
    </View>
  );
}

export function Empty({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={{ color: colors.text, fontWeight: "600" }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.textMuted, marginTop: 4 }}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  primaryBtn: {
    backgroundColor: colors.brass,
    borderRadius: radius.md,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#0D0B0A", fontWeight: "700", fontSize: 16 },
  ghostBtn: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnText: { color: colors.text, fontWeight: "600", fontSize: 15 },
  fieldLabel: { color: colors.textSecondary, fontSize: 13, marginBottom: 6, fontWeight: "500" },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    height: 50,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, alignSelf: "flex-start" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 12 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  empty: { alignItems: "center", paddingVertical: 40 },
});
