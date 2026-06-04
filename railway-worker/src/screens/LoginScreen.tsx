import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
  ScrollView
} from "react-native";
import { api } from "../api/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors, Spacing, BorderRadius, Shadow } from "../../constants/theme";

export default function LoginScreen({ onLogin }: any) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleLogin = async () => {
    if (!name.trim()) return;

    setLoading(true);
    try {
      const endpoint = isRegistering ? "/register" : "/login";
      const payload = isRegistering ? { name: name.trim(), role: "WORKER" } : { name: name.trim() };

      const res = await api.post(endpoint, payload);

      if (res.data.error) {
        alert(res.data.error);
        setLoading(false);
        return;
      }

      await AsyncStorage.setItem("user", JSON.stringify(res.data));
      onLogin(res.data);
    } catch (err: any) {
      console.log(err);
      const msg = err.response?.data?.error || "Something went wrong. Please try again.";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Text style={styles.logoText}>R</Text>
              </View>
              <Text style={styles.brandTitle}>RailTrack</Text>
              <Text style={styles.brandTagline}>Worker Portal</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.welcomeText}>
                {isRegistering ? "Create Account" : "Welcome Back"}
              </Text>
              <Text style={styles.subtitle}>
                {isRegistering
                  ? "Register as a worker to start inspections"
                  : "Enter your name to access your tasks"}
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  placeholder="e.g. John Doe"
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                  placeholderTextColor={Colors.muted}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[styles.button, !name.trim() && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading || !name.trim()}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <View style={styles.buttonInner}>
                     <Text style={styles.buttonText}>
                       {isRegistering ? "Register Now" : "Access Dashboard"}
                     </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleModeBtn}
                onPress={() => setIsRegistering(!isRegistering)}
              >
                <Text style={styles.toggleModeText}>
                  {isRegistering
                    ? "Already have an account? Sign In"
                    : "Don't have an account? Register"}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.footerVersion}>v1.2.0 • RailTrack Mobile</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.secondary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl * 1.5,
  },
  logoIcon: {
    width: 64,
    height: 64,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadow.medium,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.white,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 14,
    color: Colors.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 28,
    padding: Spacing.xl,
    ...Shadow.medium,
    width: '100%',
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  inputContainer: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: Colors.lightGray,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    ...Shadow.medium,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    backgroundColor: Colors.muted,
    opacity: 0.5,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  toggleModeBtn: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  toggleModeText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  footerVersion: {
    textAlign: 'center',
    color: Colors.muted,
    fontSize: 12,
    marginTop: Spacing.xl,
    fontWeight: '500',
  }
});
