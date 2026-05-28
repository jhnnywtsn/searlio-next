import React from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View, TextInput, ScrollView } from "react-native";

const inboxItems = [
  {
    id: "1",
    sender: "John - Website Lead",
    content: "Need quote for kitchen remodel",
    priority: "high",
  },
  {
    id: "2",
    sender: "Sarah",
    content: "Can you call me back?",
    priority: "normal",
  },
];

const initialConversations = {
  "1": {
    id: "1",
    sender: "John - Website Lead",
    messages: [
      { id: "m1", role: "incoming", text: "Hi, I need a quote for a kitchen remodel." },
      { id: "m2", role: "assistant", text: "Absolutely — what size kitchen are you working with?" }
    ]
  },
  "2": {
    id: "2",
    sender: "Sarah",
    messages: [
      { id: "m1", role: "incoming", text: "Can you call me back?" }
    ]
  }
};

export default function App() {
  const [conversations, setConversations] = React.useState(initialConversations); // State for conversations
  const [selectedId, setSelectedId] = React.useState("1"); // State for selected conversation
  const [draft, setDraft] = React.useState(""); // State for the draft message

  const selectedConversation = conversations[selectedId]; // Deriving the active conversation

  const handleGenerateAI = () => {
    const newMessage = {
      id: `m${selectedConversation.messages.length + 1}`,
      role: "assistant",
      text: "Thanks for reaching out — I can help with that. What’s the best number to reach you?"
    };

    setConversations((prev) => ({
      ...prev,
      [selectedId]: {
        ...prev[selectedId],
        messages: [...prev[selectedId].messages, newMessage],
      },
    }));
  };

  const handleSend = () => {
    if (draft.trim() === "") return;

    const newMessage = {
      id: `m${selectedConversation.messages.length + 1}`,
      role: "assistant",
      text: draft.trim(),
    };

    setConversations((prev) => ({
      ...prev,
      [selectedId]: {
        ...prev[selectedId],
        messages: [...prev[selectedId].messages, newMessage],
      },
    }));

    setDraft(""); // Clear the draft after sending
  };

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.container}>
        {/* LEFT: Pending Inbox */}
        <View style={styles.card}>
          <Text style={styles.title}>Searlio Next</Text>
          <Text style={styles.sectionTitle}>Pending Inbox</Text>
          
          {inboxItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.notificationCard}
              onPress={() => setSelectedId(item.id)} 
            >
              <View style={styles.row}>
                <Text style={styles.sender}>{item.sender}</Text>
                <View style={[
                  styles.badge,
                  item.priority === "high" && styles.badgeHigh,
                ]}>
                  <Text style={styles.badgeText}>
                    {item.priority.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.content}>{item.content}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* RIGHT: Conversation Agent Panel */}
        <View style={styles.agentPanel}>
          <Text style={styles.agentTitle}>
            {selectedConversation.sender}
          </Text>
          <ScrollView style={styles.messagesContainer}>
            {selectedConversation.messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  message.role === "assistant"
                    ? styles.assistantBubble
                    : styles.incomingBubble,
                ]}
              >
                <Text style={styles.messageText}>
                  {message.text}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Composer Area */}
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              placeholder="Type your message..."
              value={draft}
              onChangeText={setDraft}
            />
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.aiButton} onPress={handleGenerateAI}>
                <Text style={styles.buttonText}>Generate AI</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
                <Text style={styles.buttonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#0b0f14",
    padding: 20,
  },
  container: {
    flexDirection: 'row',
    width: '100%',
    flex: 1,
    justifyContent: 'space-between',
  },
  card: {
    width: "50%",
    maxWidth: 520,
    gap: 14,
    marginRight: 16,
  },
  title: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "900",
    textAlign: "center",
  },
  sectionTitle: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 8,
  },
  
  notificationCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 12,
  },
  
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  
  sender: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    flex: 1,
    paddingRight: 12,
  },
  
  content: {
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 22,
  },
  
  badge: {
    backgroundColor: "#1e293b",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  
  badgeHigh: {
    backgroundColor: "#7f1d1d",
  },
  
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },
  
  // Agent Panel Styles
  agentPanel: {
    width: "50%",
    maxWidth: 600,
    padding: 10,
    backgroundColor: "#1F1F28",
    borderRadius: 12,
  },
  
  agentTitle: {
    color: "#E5E7EB",
    fontSize: 20,
    fontWeight: "700",
  },

  messagesContainer: {
    maxHeight: 400, // Set height to enable scrolling
    marginBottom: 10,
  },

  messageBubble: {
    marginTop: 5,
    padding: 10,
    borderRadius: 10,
  },

  assistantBubble: {
    backgroundColor: "#3A3A3E",
    alignSelf: "flex-end",
  },

  incomingBubble: {
    backgroundColor: "#2B2B2E",
    alignSelf: "flex-start",
  },

  messageText: {
    color: "#fff",
  },

  composer: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },

  input: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0b1120",
    color: "#fff",
    borderRadius: 12,
    paddingHorizontal: 10,
    marginBottom: 10,
  },

  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  aiButton: {
    backgroundColor: "#10B98120",
    padding: 10,
    borderRadius: 10,
  },

  sendButton: {
    backgroundColor: "#22c55e",
    padding: 10,
    borderRadius: 10,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});


