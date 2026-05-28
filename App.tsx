import React from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function App() {
  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>Searlio Next</Text>
        <Text style={styles.subtitle}>Clean agent rebuild</Text>

        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Pending Inbox</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Conversation Agent</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#0b0f14",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    gap: 14,
  },
  title: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 18,
  },
  button: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 16,
    padding: 18,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
});
