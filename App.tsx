import React from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://searlio.com";

const STORAGE_KEY = "searlio_settings";

const DEFAULT_SETTINGS = {
  accountMode: "inbox",
  autoSend: false,
  highPriorityOnly: true,
  skipSignal: false,
  skipTelegram: false,
  toneStyle: "casual",
  replyLength: "short",
  emojiUse: "minimal",
  personalSignature: "",
  preferredChannel: "sms",
  reviewBeforeSend: true,
  leadPhoneNumbers: "",
};

const initialConversations = {
  "1": {
    id: "1",
    sender: "John - Website Lead",
    sourceApp: "website",
    status: "new",
    messages: [
      {
        id: "m1",
        role: "user",
        text: "Hi, I need a quote for landscaping work.",
        status: "inbound",
        createdAt: new Date().toISOString(),
      },
    ],
  },
  "2": {
    id: "2",
    sender: "Sarah",
    sourceApp: "sms",
    status: "new",
    messages: [
      {
        id: "m2",
        role: "user",
        text: "Can you call me back later today?",
        status: "inbound",
        createdAt: new Date().toISOString(),
      },
    ],
  },
};

// ==============================
// DATA + HYDRATION
// ==============================

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

// Normalize the backend notification data
const normalizeBackendNotification = (n: BackendNotification) => {
  const title =
    n.title ||
    n.extra_data?.raw_title ||
    n.sender ||
    "Unknown";
  const message = n.content || n.extra_data?.raw_content || "";

  return {
    id: n.id,
    sender:
      n.extra_data?.phone?.includes("+")
        ? n.extra_data.phone
        : title,
    displayName: title,
    preview: message || "No message content",
    channel: n.category || "notification",
    status: n.status || "pending",
    extraData: n.extra_data || {},
    phone: n.extra_data?.phone || n.sender || "",
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
    sourceApp: n.app_name || n.app_package || "Unknown app", // Added this line
  };
};

// ==============================
// AI GENERATION
// ==============================

// Function to format message time
const formatMessageTime = (value) => {
  if (!value) return "";

  const normalizedValue =
    typeof value === "string" &&
    value.includes("T") &&
    !value.endsWith("Z")
      ? `${value}Z`
      : value;

  const date = new Date(normalizedValue);

  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  });
};

// ==============================
// SEND FLOW
// ==============================

// Function to check if there are unread inbound messages
const hasUnreadInbound = (messages) => {
  return messages.some(
    (msg) =>
      msg.role !== "assistant" &&
      msg.status !== "read"
  );
};

// Function to check if a message is an operator event
const isOperatorEvent = (message) => {
  return (
    message.role === "assistant" &&
    message.status === "sent"
  );
};

const getAppLabel = (sourceApp = "") => {
  const app = sourceApp.toLowerCase();
  if (app.includes("googlevoice")) return "Google Voice";
  
  if (
    app.includes("textfree") ||
    app.includes("pinger.textfree")
  )
    return "TextFree";
  
  if (
    app.includes("textnow") ||
    app.includes("enflick")
  )
    return "TextNow";
  
  if (app.includes("org.thoughtcrime.securesms")) return "Signal";
  if (app.includes("telegram")) return "Telegram";
  if (app.includes("whatsapp")) return "WhatsApp";
  if (app.includes("facebook.orca")) return "Messenger";
  if (app.includes("android.apps.messaging")) return "Messages";
  if (app.includes("google.android.gm")) return "Gmail";
  if (app.includes("gmail")) return "Gmail";
  if (app.includes("com.google.android.gm")) return "Gmail";
  if (app.includes("com.snapchat.android")) return "SnapChat";
  if (app.includes("com.zangi.messenger")) return "Zangi";
  if (app.includes("com.instagram.android")) return "Instagram";
  if (app.includes("com.Slack")) return "Slack";
  if (app.includes("com.discord")) return "Discord";
  if (app.includes("com.microsoft.office.outlook")) return "Outlook";
  if (app.includes("com.pinger.textfree")) return "TextFree";
  if (app.includes("com.google.android.apps.googlevoice")) return "Google Voice";
  if (app.includes("com.enflick.android.TextNow")) return "TextNow";
};



const getChannelIcon = (app: string = "") => {
  const value = app.toLowerCase();

  if (value.includes("org.thoughtcrime.securesms")) return "🟦";
  if (value.includes("telegram")) return "✈️";
  if (value.includes("whatsapp")) return "🟢";
  if (value.includes("googlevoice")) return "📞";
  if (value.includes("gmail")) return "📧";
  if (value.includes("textnow")) return "💬";
  if (value.includes("textfree")) return "💬";
  if (value.includes("messenger")) return "💙";

  return "📱";
};


const formatSenderLabel = (sender = "") => {
  const digits = sender.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return sender;
};

export default function App() {
  const [conversations, setConversations] = React.useState(initialConversations);
  const [selectedId, setSelectedId] = React.useState("1");
  const [draft, setDraft] = React.useState("");
  const [filter, setFilter] = React.useState("All");
  const [backendOnline, setBackendOnline] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settings, setSettings] = React.useState(DEFAULT_SETTINGS);
  
  const scrollRef = React.useRef<ScrollView>(null);
  
  // ==============================
  // CONVERSATION STATE
  // ==============================


  const clearDraft = () => {
    setDraft("");
  
    setConversations((prev) => {
      const existing = prev[selectedConversation.id];
      if (!existing) return prev;
  
      return {
        ...prev,
        [selectedConversation.id]: {
          ...existing,
          messages: existing.messages.filter(
            (msg) => msg.status !== "draft"
          ),
        },
      };
    });
  };
  
  const selectedConversation =
    conversations[selectedId] ||
    Object.values(conversations)[0];

  if (!selectedConversation) {
    return null;
  }

  // Function to filter conversations based on the selected filter
  const filterConversations = () => {
    return Object.values(conversations)
      .filter((conversation) => {
        const status = getConversationStatus(
          conversation.messages
        );

        const appLabel = getAppLabel(conversation.sourceApp);
        
        if (
          settings.skipSignal &&
          appLabel === "Signal"
        ) {
          return false;
        }
        
        if (
          settings.skipTelegram &&
          appLabel === "Telegram"
        ) {
          return false;
        }
  
        if (settings.highPriorityOnly) {
          const hasPriority =
            conversation.priority === "high" ||
            conversation.messages.some(
              (m) =>
                (m.text || "")
                  .toLowerCase()
                  .includes("urgent")
            );
  
          if (!hasPriority) return false;
        }
  
        return (
          filter === "All" ||
          status === filter.toLowerCase()
        );
      })
      .sort((a, b) => {
        const aHasDraft = a.messages.some(
          (m) => m.status === "draft"
        );
  
        const bHasDraft = b.messages.some(
          (m) => m.status === "draft"
        );
  
        if (aHasDraft && !bHasDraft) return -1;
        if (bHasDraft && !aHasDraft) return 1;
  
        const aHasInbound = a.messages.some(
          (m) =>
            m.role !== "assistant" &&
            m.status === "inbound"
        );
  
        const bHasInbound = b.messages.some(
          (m) =>
            m.role !== "assistant" &&
            m.status === "inbound"
        );
  
        if (aHasInbound && !bHasInbound) return -1;
        if (bHasInbound && !aHasInbound) return 1;
  
        const aLatest = Math.max(
          ...a.messages.map((m) =>
            new Date(m.createdAt || 0).getTime()
          )
        );
  
        const bLatest = Math.max(
          ...b.messages.map((m) =>
            new Date(m.createdAt || 0).getTime()
          )
        );
  
        return bLatest - aLatest;
      });
  };
  // ======================
  // ACTIONS
  // ======================

  const handleGenerateAI = async () => {
    if (!selectedConversation?.id) return;

    try {
      const res = await fetch(
        `${BACKEND_URL}/api/llm/generate-reply/${selectedConversation.notificationId || selectedConversation.id}`,
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

      if (!settings.reviewBeforeSend) {
        setTimeout(() => {
          handleSend();
        }, 300);
      }

      setConversations((prev) => {
        const existingMessages =
          prev[selectedId].messages

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
          [selectedId]: {
            ...prev[selectedId],
            messages: updatedMessages,
          },
        };
      });
    } catch (err) {
      console.log("AI generation failed:", err);
    }
  };

  const handleSend = async () => {
    if (!selectedConversation?.id) return;

    const textToSend =
      draft.trim() ||
      selectedConversation.messages.find(
        (msg) => msg.status === "draft"
      )?.text ||
      "";

    if (!textToSend.trim()) return;

    try {
      const createRes = await fetch(
        `${BACKEND_URL}/api/notifications/${selectedConversation.notificationId || selectedConversation.id}/reply`,
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
        throw new Error(`Reply create failed: ${createRes.status}`);
      }

      const createdReply = await createRes.json();
      const phone =
        selectedConversation?.extraData?.phone ||
        selectedConversation?.phone ||
        selectedConversation?.sender;

      const isPhone =
        typeof phone === "string" &&
        phone.includes("+");

      console.log("SEND ROUTE CHECK:", {
        sender: selectedConversation?.sender,
        phone,
        isPhone,
        extraData: selectedConversation?.extraData,
        selectedConversation,
      });
      
      if (isPhone) {
        const sendRes = await fetch(`${BACKEND_URL}/api/send/sms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: phone,
            body: textToSend.trim(),
          }),
        });
      
        const sendData = await sendRes.json();
        console.log("SMS SEND RESULT:", sendData);
        
        if (!sendRes.ok || sendData?.ok === false) {
          throw new Error(
            `SMS send failed: ${sendRes.status} ${JSON.stringify(sendData)}`
          );
        }
      }
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
                    createdAt: new Date().toISOString(),
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
    }
  };

  // ======================
  // METRICS CALCULATION
  // ======================

  const getMetrics = () => {
    const totalPending = Object.values(conversations).filter(c => getConversationStatus(c.messages) === "waiting").length;
    const totalSent = Object.values(conversations).filter(c => getConversationStatus(c.messages) === "responded").length;
    const totalFailed = Object.values(conversations).filter(c => getConversationStatus(c.messages) === "failed").length;

    return { totalPending, totalSent, totalFailed };
  };

  const { totalPending, totalSent, totalFailed } = getMetrics();

  // ======================
  // EFFECTS
  // ======================

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

  React.useEffect(() => {
    if (!selectedConversation) {
      setDraft("");
      return;
    }
  
    const existingDraft = selectedConversation.messages.find(
      (msg) => msg.status === "draft"
    );
  
    setDraft(existingDraft?.text || "");
  }, [selectedId]);

  React.useEffect(() => {
    const ids = Object.keys(conversations);

    if (ids.length === 0) return;

    if (!conversations[selectedId]) {
      setSelectedId(ids[0]);
    }
  }, [conversations, selectedId]);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
  
      if (saved) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...JSON.parse(saved),
        });
      }
    } catch (err) {
      console.log("Settings load failed:", err);
    }
  }, []);

  // ======================
  // HYDRATION
  // ======================

  const hydrateNotifications = async () => {
      const res = await fetch(`${BACKEND_URL}/api/notifications`);
      const repliesRes = await fetch(`${BACKEND_URL}/api/replies`);
      const repliesData = await repliesRes.json();
      

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
        .filter((item) => item.app_package !== "org.telegram.messenger")
        
        .map(normalizeBackendNotification);
  
      if (hydratedArray.length > 0) {
        const hydratedObject = hydratedArray.reduce(
          (acc, conversation) => {
            const existing = conversations[conversation.id];
            
            const threadKey = `${conversation.sourceApp}-${conversation.sender}`;
            const existingThread = acc[threadKey];
            console.log(
              "HYDRATE:",
              conversation.sender,
              conversation.displayName,
              conversation.phone
            );
            const replyMessages = repliesData
              .filter((r) => r.notification_id === conversation.id)
              .map((r) => ({
                id: `reply-${r.id}`,
                role: "assistant",
                text: r.content,
                status: "sent",
                createdAt:
                  r.delivered_at ||
                  r.created_at ||
                  new Date().toISOString(),
              }));
            
            if (!existingThread) {
              acc[threadKey] = {
                ...conversation,
                id: threadKey,
                notificationId: conversation.id,
                messages: [
                  ...conversation.messages,
                  ...replyMessages,
                  
                ],
              };
            } else {
              acc[threadKey] = {
                ...existingThread,
                notificationId: existingThread.notificationId || conversation.id,
                createdAt:
                  new Date(conversation.createdAt).getTime() >
                  new Date(existingThread.createdAt).getTime()
                    ? conversation.createdAt
                    : existingThread.createdAt,
                messages: [
                  ...existingThread.messages.filter(
                    (m) => m.status === "draft" || m.status === "sent"
                  ),
                  ...conversation.messages,
                  ...replyMessages,
                ].filter(
                  (msg, index, self) =>
                    index === self.findIndex((m) => m.id === msg.id)
                ),
              };
            }
  
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

  const updateSetting = (key, value) => {
    const updated = {
      ...settings,
      [key]: value,
    };
  
    setSettings(updated);
  
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updated)
      );
    } catch (err) {
      console.log("Settings save failed:", err);
    }
  };

 

  // ======================
  // SIMULATION
  // ======================

  const simulateNotification = async () => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/simulate/notification?category=text`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      if (!res.ok) {
        throw new Error(`Simulation failed: ${res.status}`);
      }

      await refreshFromBackend();
    } catch (err) {
      console.log("Error simulating notification:", err);
    }
  };

  // ==============================
  // LEFT PANEL
  // ==============================
  
  
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
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setSettingsOpen(true)}
          >
            <Text style={styles.settingsButtonText}>⚙️</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.demoStrip}>
          <View>
            <Text style={styles.demoStripTitle}>
              Live lead response workspace
            </Text>

            <Text style={styles.demoStripText}>
              Simulate a new lead, generate an AI draft, edit it, and send from one console.
            </Text>
          </View>
        </View>

        {settingsOpen && (
          <View style={styles.settingsPanel}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>
                Operator Settings
              </Text>
        
              <TouchableOpacity
                onPress={() => setSettingsOpen(false)}
              >
                <Text style={styles.settingsClose}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>
        
            <Text style={styles.settingsSection}>
              Mode
            </Text>
        
            <View style={styles.settingsRow}>
              <TouchableOpacity
                style={[
                  styles.settingsChip,
                  settings.accountMode === "leads" &&
                    styles.settingsChipActive,
                ]}
                onPress={() =>
                  updateSetting("accountMode", "leads")
                }
              >
                <Text style={styles.settingsChipText}>
                  Leads
                </Text>
              </TouchableOpacity>
        
              <TouchableOpacity
                style={[
                  styles.settingsChip,
                  settings.accountMode === "inbox" &&
                    styles.settingsChipActive,
                ]}
                onPress={() =>
                  updateSetting("accountMode", "inbox")
                }
              >
                <Text style={styles.settingsChipText}>
                  Inbox
                </Text>
              </TouchableOpacity>
            </View>
          
          <Text style={styles.settingsSection}>
            Tone
          </Text>
          
          <View style={styles.settingsRow}>
            {["casual", "direct", "friendly", "professional"].map((tone) => (
              <TouchableOpacity
                key={tone}
                style={[
                  styles.settingsChip,
                  settings.toneStyle === tone &&
                    styles.settingsChipActive,
                ]}
                onPress={() => updateSetting("toneStyle", tone)}
              >
                <Text style={styles.settingsChipText}>
                  {tone}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* New Reply Length Section */}
          <Text style={styles.settingsSection}>
            Reply Length
          </Text>
          
          <View style={styles.settingsRow}>
            {["short", "medium", "long"].map((length) => (
              <TouchableOpacity
                key={length}
                style={[
                  styles.settingsChip,
                  settings.replyLength === length &&
                    styles.settingsChipActive,
                ]}
                onPress={() =>
                  updateSetting("replyLength", length)
                }
              >
                <Text style={styles.settingsChipText}>
                  {length}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.settingsSection}>
            Auto Send
          </Text>
          
          <View style={styles.settingsRow}>
            <TouchableOpacity
              style={[
                styles.settingsChip,
                settings.autoSend &&
                  styles.settingsChipActive,
              ]}
              onPress={() =>
                updateSetting("autoSend", !settings.autoSend)
              }
            >
              <Text style={styles.settingsChipText}>
                {settings.autoSend ? "enabled" : "disabled"}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.settingsSection}>
            Skip Signal
          </Text>
          
          <View style={styles.settingsRow}>
            <TouchableOpacity
              style={[
                styles.settingsChip,
                settings.skipSignal &&
                  styles.settingsChipActive,
              ]}
              onPress={() =>
                updateSetting("skipSignal", !settings.skipSignal)
              }
            >
              <Text style={styles.settingsChipText}>
                {settings.skipSignal ? "enabled" : "disabled"}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.settingsSection}>
            Skip Telegram
          </Text>
          
          <View style={styles.settingsRow}>
            <TouchableOpacity
              style={[
                styles.settingsChip,
                settings.skipTelegram &&
                  styles.settingsChipActive,
              ]}
              onPress={() =>
                updateSetting("skipTelegram", !settings.skipTelegram)
              }
            >
              <Text style={styles.settingsChipText}>
                {settings.skipTelegram ? "enabled" : "disabled"}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.settingsSection}>
            High Priority Only
          </Text>
          
          <View style={styles.settingsRow}>
            <TouchableOpacity
              style={[
                styles.settingsChip,
                settings.highPriorityOnly &&
                  styles.settingsChipActive,
              ]}
              onPress={() =>
                updateSetting("highPriorityOnly", !settings.highPriorityOnly)
              }
            >
              <Text style={styles.settingsChipText}>
                {settings.highPriorityOnly ? "enabled" : "disabled"}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.settingsSection}>
            Review Before Send
          </Text>
          
          <View style={styles.settingsRow}>
            <TouchableOpacity
              style={[
                styles.settingsChip,
                settings.reviewBeforeSend &&
                  styles.settingsChipActive,
              ]}
              onPress={() =>
                updateSetting("reviewBeforeSend", !settings.reviewBeforeSend)
              }
            >
              <Text style={styles.settingsChipText}>
                {settings.reviewBeforeSend ? "enabled" : "disabled"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        )}

        {/* Developer Only Button */}
        <TouchableOpacity style={styles.devButton} onPress={simulateNotification}>
          <Text style={styles.buttonText}>Simulate New Lead</Text>
        </TouchableOpacity>

        {/* Main Content Layout */}
        <View style={styles.mainLayout}>
          {/* LEFT Panel */}
          <ScrollView style={styles.leftPanel}>
          <View style={styles.leftPanel}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>
                  Searlio Operator
                </Text>
              
                <Text style={styles.subtitle}>
                  AI-assisted lead response console
                </Text>
                <Text style={styles.liveQueueText}>
                  {filterConversations().length} active conversations
                </Text>
              
                <Text style={styles.backendBadge}>
                  {backendOnline
                    ? "Live backend connected"
                    : "Demo mode"}
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
              {filterConversations().length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>
                    No active conversations
                  </Text>
              
                  <Text style={styles.emptyStateText}>
                    New leads and notifications will appear here.
                  </Text>
                </View>
              ) : (
                filterConversations()
                  .sort((a, b) => {
                    // Keep selected conversation pinned
                    if (a.id === selectedId) return -1;
                    if (b.id === selectedId) return 1;
                
                    // Otherwise newest activity first
                    const aLatest = [...a.messages]
                      .sort(
                        (x, y) =>
                          new Date(y.createdAt || 0).getTime() -
                          new Date(x.createdAt || 0).getTime()
                      )[0]?.createdAt;
                
                    const bLatest = [...b.messages]
                      .sort(
                        (x, y) =>
                          new Date(y.createdAt || 0).getTime() -
                          new Date(x.createdAt || 0).getTime()
                      )[0]?.createdAt;
                
                    return (
                      new Date(bLatest || 0).getTime() -
                      new Date(aLatest || 0).getTime()
                    );
                  })
                  .map((conversation) => {
                  const conversationStatus = getConversationStatus(conversation.messages);
                  return (
                    <TouchableOpacity
                      key={conversation.id}
                      style={[
                        styles.notificationCard,
                      
                        conversation.status === "new" &&
                          styles.newCard,

                        hasUnreadInbound(conversation.messages) &&
                          styles.unreadCard,
                      
                        conversation.status === "waiting" &&
                          styles.waitingCard,
                      
                        conversation.status === "responded" &&
                          styles.respondedCard,
                      
                        selectedId === conversation.id &&
                          styles.activeCard,
                      ]}
                      onPress={() => setSelectedId(conversation.id)} 
                    >
                      <View style={styles.cardTopRow}>
                        <View style={styles.cardTitleBlock}>
                          <Text style={styles.sender}>
                            {getChannelIcon(conversation.sourceApp)}{" "}
                            {formatSenderLabel(conversation.sender)}
                          </Text>
                      
                          <View style={styles.metaRow}>
                            <Text
                              style={[
                                styles.sourceAppText,
                                getAppLabel(conversation.sourceApp) === "Signal" && styles.signalText,
                                getAppLabel(conversation.sourceApp) === "Gmail" && styles.gmailText,
                                getAppLabel(conversation.sourceApp) === "Google Voice" && styles.voiceText,
                                getAppLabel(conversation.sourceApp) === "TextFree" && styles.textfreeText,
                              ]}
                            >
                              {getAppLabel(conversation.sourceApp)}
                            </Text>
                      
                            <Text style={styles.metaDivider}>•</Text>
                      
                            <Text style={styles.cardTime}>
                              {formatMessageTime(
                                [...conversation.messages]
                                  .sort(
                                    (a, b) =>
                                      new Date(b.createdAt || 0).getTime() -
                                      new Date(a.createdAt || 0).getTime()
                                  )[0]?.createdAt
                              )}
                            </Text>
                          </View>
                        </View>
                      
                        <View
                          style={[
                            styles.badge,
                            conversationStatus === "urgent" && styles.badgeUrgent,
                            conversationStatus === "waiting" && styles.badgeWaiting,
                            conversationStatus === "responded" && styles.badgeResponded,
                            conversationStatus === "failed" && styles.badgeFailed,
                          ]}
                        >
                          <Text style={styles.badgeText}>
                            {conversationStatus.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      
                      {conversationStatus !== "responded" && (
                        <Text
                          style={[
                            styles.content,
                            hasUnreadInbound(conversation.messages) && styles.unreadContent,
                          ]}
                          numberOfLines={2}
                        >
                          {
                            [...conversation.messages]
                              .filter((m) => m.status !== "draft")
                              .sort(
                                (a, b) =>
                                  new Date(b.createdAt || 0).getTime() -
                                  new Date(a.createdAt || 0).getTime()
                              )[0]?.text || "No messages yet"
                          }
                        </Text>
                      )}
                    </TouchableOpacity>
                  );                
                })
              )}
            </View>
          </View>
          </ScrollView>

 
  
          
          {/* RIGHT Panel */}
          <View style={styles.rightPanel}>
            {selectedConversation ? (
              <>
                <View style={styles.agentCard}>
                  <Text style={styles.agentTitle}>{selectedConversation.sender}</Text>
                  <ScrollView
                    ref={scrollRef}
                    style={styles.messagesContainer}
                    onContentSizeChange={() =>
                      scrollRef.current?.scrollToEnd({ animated: true })
                    }
                  >
                    {[...selectedConversation.messages]
                      .sort((a, b) => {
                        // Drafts always last
                        if (a.status === "draft") return 1;
                        if (b.status === "draft") return -1;

                        // Sent assistant messages near bottom
                        if (a.status === "sent" && b.role !== "assistant") return 1;
                        if (b.status === "sent" && a.role !== "assistant") return -1;

                        return new Date(a.createdAt || 0).getTime() -
                          new Date(b.createdAt || 0).getTime();
                      })
                                          .map((message) => {
                      if (message.status === "draft") {
                        return null;
                      }

                      

                      return (
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
                            {message.createdAt ? (
                              <Text style={styles.messageTime}>
                                {formatMessageTime(message.createdAt)}
                              </Text>
                            ) : null}
                            {message.role === "assistant" && message.status && (
                              <Text style={styles.statusText}>
                                {message.status.toUpperCase()}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                </ScrollView>

  

                {/* Composer Area */}
                <View style={styles.composer}>
                  {draft.trim() ? (
                    <View style={styles.activeDraftPreview}>
                      <Text style={styles.activeDraftLabel}>
                        ACTIVE DRAFT
                      </Text>
                      <Text style={styles.activeDraftText}>
                        {draft}
                      </Text>
                      <Text style={styles.draftHelper}>
                        AI-generated draft • editable before send
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      placeholder="Edit active draft..."
                      value={draft}
                                            
                        onChangeText={(text) => {
                          setDraft(text);
                        
                          setConversations((prev) => {
                            if (!selectedId || !prev[selectedId]) return prev;
                        
                            const existingMessages =
                              prev[selectedId].messages || [];
                        
                            const hasDraft = existingMessages.some(
                              (m) => m.status === "draft"
                            );
                        
                            const messages = hasDraft
                              ? existingMessages.map((m) =>
                                  m.status === "draft"
                                    ? { ...m, text }
                                    : m
                                )
                              : [
                                  ...existingMessages,
                                  {
                                    id: `draft-${Date.now()}`,
                                    role: "assistant",
                                    text,
                                    status: "draft",
                                    createdAt: new Date().toISOString(),
                                  },
                                ];
                        
                            return {
                              ...prev,
                              [selectedId]: {
                                ...prev[selectedId],
                                messages,
                              },
                            };
                          });
                        }}
                        
                    />
                  </View>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.aiButton}
                      onPress={handleGenerateAI}
                    >
                      <Text style={styles.buttonText}>
                        Generate AI Reply
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={clearDraft}
                    >
                      <Text style={styles.buttonText}>Clear</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
                      <Text style={styles.buttonText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              </>
            ) : (
              <View style={styles.emptyConversation}>
                <Text style={styles.emptyConversationTitle}>
                  No conversation selected
                </Text>
                <Text style={styles.emptyConversationText}>
                  Select a lead or notification to begin.
                </Text>
              </View>
            )}
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
    flex: 1,
    paddingRight: 14,
  },

  notificationCard: {
    backgroundColor: "#0F172A",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1E293B",
    gap: 10,
    marginBottom: 12,
    borderLeftWidth: 5,
  
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
     elevation: 3,
  },
  activeCard: {
    borderColor: "#22C55E",
    borderWidth: 2,
    backgroundColor: "#111C2E",
  },
  
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  
  sender: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "900",
    flex: 1,
    paddingRight: 10,
    letterSpacing: 0.2,
  },
  
  content: {
    color: "#CBD5E1",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 2,
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
    alignSelf: "flex-end",
    backgroundColor: "#052E16",
    borderWidth: 1,
    borderColor: "#22C55E",
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    maxWidth: "82%",
  },
  assistantBubbleDraft: {
    alignSelf: "flex-end",
    backgroundColor: "#172554",
    borderWidth: 1,
    borderColor: "#3B82F6",
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    maxWidth: "82%",
  },
  incomingBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    maxWidth: "82%",
  },
  
  messageText: {
    color: "#F8FAFC",
    fontSize: 15,
    lineHeight: 22,
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
  devButton: {
    backgroundColor: "#FFB300", // Yellow color for visibility
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  messageTime: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 6,
    opacity: 0.8,
  },
  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#052e16",
    shadowColor: "#22C55E",
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 6,
  },
  activeDraftPreview: {
    backgroundColor: "#172554",
    borderWidth: 1,
    borderColor: "#3B82F6",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  
  activeDraftLabel: {
    color: "#93C5FD",
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 6,
    letterSpacing: 1,
  },
  
  activeDraftText: {
    color: "#EFF6FF",
    fontSize: 14,
    lineHeight: 20,
  },
  clearButton: {
    backgroundColor: "#334155",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  operatorEvent: {
    alignItems: "center",
    marginVertical: 10,
  },
  
  operatorEventText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  cardTime: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: "center",
  },
  
  emptyStateTitle: {
    color: "#E2E8F0",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  
  emptyStateText: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
    maxWidth: 220,
    lineHeight: 20,
  },
  emptyConversation: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  
  emptyConversationTitle: {
    color: "#E2E8F0",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  
  emptyConversationText: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  demoStrip: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  
  demoStripTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  
  demoStripText: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 20,
  },
  draftHelper: {
    color: "#93C5FD",
    fontSize: 11,
    marginTop: 10,
    opacity: 0.8,
  },
  liveQueueText: {
    color: "#22C55E",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  sourceAppText: {
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  signalText: {
    color: "#22C55E",
  },
  
  gmailText: {
    color: "#60A5FA",
  },
  
  voiceText: {
    color: "#A78BFA",
  },
  
  textfreeText: {
    color: "#F59E0B",
  },
  newCard: {
    borderLeftColor: "#22C55E",
  },
  
  waitingCard: {
    borderLeftColor: "#F59E0B",
  },
  
  respondedCard: {
    borderLeftColor: "#3B82F6",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  
  cardTitleBlock: {
    flex: 1,
  },
  
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  
  metaDivider: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "900",
  },
  
  unreadContent: {
    color: "#F8FAFC",
    fontWeight: "800",
  },

  unreadCard: {
    borderColor: "#60A5FA",
    borderWidth: 2,
    shadowColor: "#60A5FA",
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  settingsButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  
  settingsButtonText: {
    fontSize: 18,
  },
  settingsPanel: {
    position: "absolute",
    top: 90,
    right: 20,
    width: 420,
    backgroundColor: "#0F172A",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1E293B",
    zIndex: 999,
  },
  
  settingsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  
  settingsTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  
  settingsClose: {
    color: "#94A3B8",
    fontSize: 20,
  },
  
  settingsSection: {
    color: "#94A3B8",
    fontSize: 13,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  
  settingsRow: {
    flexDirection: "row",
    gap: 10,
  },
  
  settingsChip: {
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  
  settingsChipActive: {
    borderColor: "#22C55E",
    backgroundColor: "#052E16",
  },
  
  settingsChipText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
 

