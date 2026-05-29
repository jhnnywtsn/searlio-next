import React from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View, TextInput, ScrollView } from "react-native";

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://searlio.com";

const initialConversations = {
  "1": {
    id: "1",
    sender: "John - Website Lead",
    messages: [
      { id: "m1", role: "incoming", text: "Hi, I need a quote for a kitchen remodel.", status: "inbound" },
      { id: "m2", role: "assistant", text: "Absolutely — what size kitchen are you working with?", status: "draft" },
    ],
    status: "new",
  },
  "2": {
    id: "2",
    sender: "Sarah",
    messages: [],
    status: "new",
  },
};

// Function to calculate conversation status
const getConversationStatus = (messages) => {
  const hasInbound = messages.some(msg => msg.status === "inbound");
  const hasDraft = messages.some(msg => msg.status === "draft");
  const hasApproved = messages.some(msg => msg.status === "approved");
  const hasSent = messages.some(msg => msg.status === "sent");
  const hasFailed = messages.some(msg => msg.status === "failed");
  
  if (hasFailed) return 'failed';
  if (hasSent) return 'responded';
  if (hasDraft || hasApproved) return 'waiting';
  if (hasInbound) return 'new';

  return 'new';
};

type BackendNotification = {
  id: string;
  app_name?: string;
  app_package?: string;
  title?: string;
  sender?: string;
  content?: string;
  category?: string;
  status?: string;
  created_at?: string;
  extra_data?: Record<string, any>;
};

const normalizeBackendNotification = (n: BackendNotification) => {
  const title = n.sender || n.title || n.app_name || "Unknown";
  const message = n.content || n.extra_data?.raw_content || "";

  return {
    id: n.id,
    sender: title,
    preview: message || "No message content",
    channel: n.category || "notification",
    status: n.status || "pending",
    priority: n.category === "lead" || title.toLowerCase().includes("lead") ? "high" : "normal",
    createdAt: n.created_at || new Date().toISOString(),
    messages: [
      {
        id: `${n.id}-incoming`,
        role: "customer",
        text: message || "No message content",
        createdAt: n.created_at || new Date().toISOString(),
      },
    ],
    draft: "",
  };
};

export default function App() {
  const [conversations, setConversations] = React.useState(initialConversations);
  const [selectedId, setSelectedId] = React.useState("1");
  const [draft, setDraft] = React.useState("");
  const [filter, setFilter] = React.useState("All");
  const [backendOnline, setBackendOnline] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [sendError, setSendError] = React.useState("");

  const selectedConversation =
    conversations[selectedId] ||
    Object.values(conversations)[0];

  if (!selectedConversation) {
    return null;
  }

  // Function to filter conversations based on the selected filter
  const filterConversations = () => {
    return Object.values(conversations).filter(conversation => {
      const status = getConversationStatus(conversation.messages);
      return filter === "All" || status === filter.toLowerCase();
    });
  };

  const handleGenerateAI = async () => {
    if (!selectedConversation?.id || isGenerating) return;
    setIsGenerating(true);
  
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/llm/generate-reply/${selectedConversation.id}`,
        {
          method: "POST",
        }
      );
  
      if (!res.ok) {
        throw new Error(`Generate failed: ${res.status}`);
      }
  
      const data = await res.json();
  
      const aiText =
        data.content ||
        data.reply ||
        data.generated_reply ||
        data.text ||
        "Unable to generate reply.";
  
      setDraft(aiText);
  
      setConversations((prev) => {
        const existingMessages =
          prev[selectedConversation.id].messages;
  
        const hasDraft = existingMessages.some(
          (msg) => msg.status === "draft"
        );
  
        const updatedMessages = hasDraft
          ? existingMessages.map((msg) =>
              msg.status === "draft"
                ? {
                    ...msg,
                    text: aiText,
                    status: "draft",
                  }
                : msg
            )
          : [
              ...existingMessages,
              {
                id: `draft-${Date.now()}`,
                role: "assistant",
                text: aiText,
                status: "draft",
              },
            ];
  
        return {
          ...prev,
          [selectedConversation.id]: {
            ...prev[selectedConversation.id],
            messages: updatedMessages,
          },
        };
      });
    } catch (err) {
      console.log("AI generation failed:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!selectedConversation?.id) return;

    if (isSending) return;
    
    setIsSending(true);
    setSendError("");
  
    const textToSend =
      draft.trim() ||
      selectedConversation.messages.find(
        (msg) => msg.status === "draft"
      )?.text ||
      "";
  
    if (!textToSend.trim()) return;
  
    try {
      const createRes = await fetch(
        `${BACKEND_URL}/api/notifications/${selectedConversation.id}/reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: textToSend.trim(),
          }),
        }
      );
  
      if (!createRes.ok) {
        throw new Error(
          `Reply create failed: ${createRes.status}`
        );
      }
  
      const createdReply = await createRes.json();
  
      if (createdReply?.id) {
        await fetch(
          `${BACKEND_URL}/api/replies/${createdReply.id}/delivered`,
          {
            method: "PATCH",
          }
        );
      }
  
      setConversations((prev) => {
        const updatedMessages =
          prev[selectedConversation.id].messages.map(
            (msg) =>
              msg.status === "draft"
                ? {
                    ...msg,
                    text: textToSend.trim(),
                    status: "sent",
                  }
                : msg
          );
  
        return {
          ...prev,
          [selectedConversation.id]: {
            ...prev[selectedConversation.id],
            messages: updatedMessages,
          },
        };
      });
  
      setDraft("");
    } catch (err) {
      console.log("Send failed:", err);
      setSendError("Send failed. Check backend route or reply payload.");
    } finally {
      setIsSending(false);
    }
  };

  // Metrics Calculation
  const getMetrics = () => {
    const totalPending = Object.values(conversations).filter(c => getConversationStatus(c.messages) === "waiting").length;
    const totalSent = Object.values(conversations).filter(c => getConversationStatus(c.messages) === "responded").length;
    const totalFailed = Object.values(conversations).filter(c => getConversationStatus(c.messages) === "failed").length;

    return { totalPending, totalSent, totalFailed };
  };

  const { totalPending, totalSent, totalFailed } = getMetrics();

  React.useEffect(() => {
    const initialHydration = async () => {
      try {
        await hydrateNotifications();
      } catch (err) {
        console.log("Backend hydration skipped:", err);
        setBackendOnline(false);
      }
    };
  
    initialHydration();
  }, []);

  React.useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await hydrateNotifications();
      } catch (err) {
        console.log("Polling failed:", err);
      }
    }, 10000);
  
    return () => clearInterval(interval);
  }, [conversations]);
  
  const hydrateNotifications = async () => {
    const res = await fetch(`${BACKEND_URL}/api/notifications`);
  
    if (!res.ok) {
      throw new Error(`Backend returned ${res.status}`);
    }
  
    const data = await res.json();
  
    const hydratedArray = data
      .sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      )
      .filter((item) => item && item.id)
      .filter((item) => item.content || item.extra_data?.raw_content)
      .filter(
        (item) =>
          item.app_package !== "org.telegram.messenger"
      )
      .map(normalizeBackendNotification);
  
    if (hydratedArray.length > 0) {
      const hydratedObject = hydratedArray.reduce(
        (acc, conversation) => {
          const existing = conversations[conversation.id];
  
          acc[conversation.id] = existing
            ? {
                ...conversation,
                messages:
                  existing.messages.length >
                  conversation.messages.length
                    ? existing.messages
                    : conversation.messages,
              }
            : conversation;
  
          return acc;
        },
        {}
      );
  
      setConversations(hydratedObject);
  
      setSelectedId((prev) =>
        hydratedObject[prev]
          ? prev
          : hydratedArray[0].id
      );
  
      setBackendOnline(true);
    }
  };
  
 const refreshFromBackend = async () => {
   try {
     await hydrateNotifications();
   } catch (err) {
     console.log("Manual refresh failed:", err);
     setBackendOnline(false);
   }
 };
 
  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.container}>
        {/* Compact Command Bar for Filters */}
        <View style={styles.commandBar}>
          {["All", "Urgent", "Waiting", "Responded", "Failed"].map((status) => {
            const count =
              status === "All"
                ? ""
                : status === "Waiting"
                ? totalPending
                : status === "Responded"
                ? totalSent
                : status === "Failed"
                ? totalFailed
                : 0;
          
            return (
              <TouchableOpacity
                key={status}
                onPress={() => setFilter(status)}
                style={[styles.commandChip, filter === status && styles.activeChip]}
              >
                <Text style={styles.filterText}>
                  {status === "All" ? "All" : `${status} (${count})`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Thin Inline Metrics Row */}
        <View style={styles.metricsRow}>
          <Text style={styles.metricText}>Pending: {totalPending}</Text>
          <Text style={styles.metricText}>Sent: {totalSent}</Text>
          <Text style={styles.metricText}>Failed: {totalFailed}</Text>
        </View>

        {/* Main Content Layout */}
        <View style={styles.mainLayout}>
          {/* LEFT Panel */}
          <View style={styles.leftPanel}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>Searlio Next</Text>
            
                <Text style={styles.backendBadge}>
                  {backendOnline ? "Backend connected" : "Demo data"}
                </Text>
              </View>
            
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={refreshFromBackend}
              >
                <Text style={styles.refreshText}>Refresh</Text>
              </TouchableOpacity>
            </View>
              
            <Text style={styles.sectionTitle}>Pending Inbox</Text>
            <View style={styles.inboxContainer}>
              {filterConversations().map((conversation) => {
                const conversationStatus = getConversationStatus(conversation.messages);
                return (
                  <TouchableOpacity
                    key={conversation.id}
                    style={[
                      styles.notificationCard,
                      conversation.id === selectedId && styles.activeCard,
                    ]}
                    onPress={() => setSelectedId(conversation.id)} 
                  >
                    <View style={styles.row}>
                      <Text style={styles.sender}>{conversation.sender}</Text>
                      <View style={[
                        styles.badge,
                        conversationStatus === "urgent" && styles.badgeUrgent,
                        conversationStatus === "waiting" && styles.badgeWaiting,
                        conversationStatus === "responded" && styles.badgeResponded,
                        conversationStatus === "failed" && styles.badgeFailed
                      ]}>
                        <Text style={styles.badgeText}>
                          {conversationStatus.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.content}>{conversation.messages[0]?.text || 'No messages yet'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* RIGHT Panel */}
          <View style={styles.rightPanel}>
            <View style={styles.agentCard}>
              <Text style={styles.agentTitle}>{selectedConversation.sender}</Text>
              <ScrollView style={styles.messagesContainer}>
                {selectedConversation.messages.map((message) => (
                  <View key={message.id}>
                    <View
                      style={[
                        styles.messageBubble,
                        message.role === "assistant"
                          ? message.status === "sent"
                            ? styles.assistantBubbleSent
                            : styles.assistantBubbleDraft
                          : styles.incomingBubble,
                      ]}
                    >
                      <Text style={styles.messageText}>
                        {message.text}
                      </Text>
                      {message.role === "assistant" && message.status && (
                        <Text style={styles.statusText}>
                          {message.status.toUpperCase()}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>

              {/* Composer Area */}
              <View style={styles.composer}>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="Type your message..."
                    value={draft}
                    onChangeText={setDraft}
                  />
                </View>
                {sendError ? (
                  <Text style={styles.errorText}>{sendError}</Text>
                ) : null}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.aiButton, isGenerating && styles.disabledButton]}
                    onPress={handleGenerateAI}
                    disabled={isGenerating}
                  >
                    <Text style={styles.buttonText}>
                      {isGenerating ? "Generating..." : "Generate AI"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sendButton, isSending && styles.disabledButton]}
                    onPress={handleSend}
                    disabled={isSending}
                  >
                    <Text style={styles.buttonText}>
                      {isSending ? "Sending..." : "Send"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
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
    flex: 1,
    width: "100%",
  },

  commandBar: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  commandChip: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  activeChip: {
    backgroundColor: "#22c55e",
    borderColor: "#22c55e",
  },
  filterText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },

  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  metricText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "700",
  },

  mainLayout: {
    flexDirection: "row",
    gap: 28,
    flex: 1,
  },
  leftPanel: {
    flex: 0.9,
    maxWidth: 620,
  },
  rightPanel: {
    flex: 1.1,
    minWidth: 520,
  },

  title: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 26,
  },
  sectionTitle: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 12,
  },
  inboxContainer: {
    gap: 14,
  },

  notificationCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 12,
  },
  activeCard: {
    borderColor: "#22c55e",
    borderWidth: 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sender: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
    flex: 1,
    paddingRight: 12,
  },
  content: {
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 22,
  },

  badge: {
    backgroundColor: "#334155",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeUrgent: {
    backgroundColor: "#ef4444",
  },
  badgeWaiting: {
    backgroundColor: "#fbbf24",
  },
  badgeResponded: {
    backgroundColor: "#22c55e",
  },
  badgeFailed: {
    backgroundColor: "#450a0a",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },

  agentCard: {
    flex: 1,
    backgroundColor: "#1F1F28",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 20,
  },
  agentTitle: {
    color: "#E5E7EB",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
  },
  messagesContainer: {
    flex: 1,
    marginBottom: 12,
  },

  messageBubble: {
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    maxWidth: "82%",
  },
  assistantBubbleSent: {
    backgroundColor: "#22c55e",
    alignSelf: "flex-end",
  },
  assistantBubbleDraft: {
    backgroundColor: "#6b21a8",
    alignSelf: "flex-end",
  },
  incomingBubble: {
    backgroundColor: "#2B2B2E",
    alignSelf: "flex-start",
  },
  messageText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 21,
  },
  statusText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 5,
  },

  composer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  inputRow: {
    marginBottom: 10,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0b1120",
    color: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  aiButton: {
    backgroundColor: "#064e3b",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  sendButton: {
    backgroundColor: "#22c55e",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "900",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  
  backendBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
  },
  
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
  },
  
  refreshText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.55,
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
});
 

