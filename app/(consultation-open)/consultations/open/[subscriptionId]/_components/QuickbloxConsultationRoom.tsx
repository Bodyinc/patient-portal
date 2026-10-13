"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import {
  Send,
  PhoneIncoming,
  PhoneOff,
  Video,
  Mic,
  MicOff,
  VideoOff,
  ShieldCheck,
  CheckCircle2,
  Clock,
  User,
  Info,
  ChevronRight,
  Loader2,
  FileText,
  AlertCircle,
  X,
  Stethoscope,
  Paperclip,
  Download,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  IntakeAnswerItem,
  PatientConsultationData,
  QuickbloxSdkConfig,
} from "@/lib/consultations/types";
import { recordConsultationFinished } from "@/lib/consultations/actions";
import { getStateName } from "@/lib/profile/us-states";

type QuickbloxConsultationRoomProps = {
  subscriptionId: string;
  sdkConfig: QuickbloxSdkConfig;
  patientData: PatientConsultationData;
  onFinish?: () => void;
};

type ChatAttachmentItem = {
  id?: number | string;
  uid?: string;
  name?: string;
  size?: number;
  type?: string;
  url?: string;
};

type ChatMessageItem = {
  id: string;
  senderId: number;
  body: string;
  dateSent: number;
  isSelf: boolean;
  type?: "message" | "joined";
  attachments?: ChatAttachmentItem[];
};

// Generic QuickBlox typing for browser window
interface QbWebrtcSession {
  ID: string;
  initiatorId: number;
  callType: number;
  state: number;
  getUserMedia: (
    params: {
      audio: boolean;
      video: boolean;
      options?: { muted?: boolean; mirror?: boolean };
      elemId?: string;
    },
    callback: (err: unknown, stream: MediaStream) => void,
  ) => void;
  accept: (extension: Record<string, unknown>) => void;
  reject: (extension: Record<string, unknown>) => void;
  stop: (extension: Record<string, unknown>) => void;
  mute: (type: "audio" | "video") => void;
  unmute: (type: "audio" | "video") => void;
  attachMediaStream: (elemId: string, stream: MediaStream) => void;
}

interface QuickBloxClient {
  init: (
    appId: number,
    authKey: string,
    authSecret: string,
    accountKey: string,
    config?: Record<string, unknown>,
  ) => void;
  createSession: (
    creds: { email?: string; id?: number; login?: string; password?: string },
    callback: (err: unknown, res: { token: string; user_id?: number }) => void,
  ) => void;
  users?: {
    get: (
      paramsOrId: number | { login?: string; full_name?: string; email?: string },
      callback: (
        err: unknown,
        res: {
          user?: {
            id: number;
            full_name?: string;
            email?: string;
            login?: string;
            user_tags?: string;
          };
        },
      ) => void,
    ) => void;
    listUsers?: (
      params: { filter?: Array<{ field: string; param: string; value: unknown }> },
      callback: (
        err: unknown,
        res: {
          items?: Array<{
            user: {
              id: number;
              full_name?: string;
              email?: string;
              login?: string;
              user_tags?: string;
            };
          }>;
        },
      ) => void,
    ) => void;
  };
  content?: {
    createAndUpload: (
      params: {
        file: File;
        name?: string;
        type?: string;
        size?: number;
        public?: boolean;
      },
      callback: (
        err: unknown,
        res: {
          id: number;
          uid: string;
          name: string;
          content_type: string;
          size: number;
        },
      ) => void,
    ) => void;
    privateUrl: (uidOrId: string | number) => string;
    publicUrl: (uid: string) => string;
  };
  chat: {
    isConnected: boolean;
    connect: (
      creds: { userId: number; password?: string },
      callback: (err: unknown) => void,
    ) => void;
    disconnect: () => void;
    send: (
      recipient: string | number,
      msg: {
        type: string;
        body: string;
        extension: { save_to_history: number; dialog_id?: string | null; type?: string };
        markable?: number;
      },
    ) => string;
    sendIsTypingStatus: (recipient: string | number) => void;
    sendIsStopTypingStatus: (recipient: string | number) => void;
    onMessageListener: (
      userId: number,
      msg: {
        _id?: string;
        id?: string;
        body?: string;
        type?: string;
        date_sent?: number;
        extension?: {
          dialog_id?: string;
          type?: string;
          notification_type?: string;
          attachments?: ChatAttachmentItem[];
        };
      },
    ) => void;
    onMessageTypingListener?: (isTyping: boolean, userId: number, dialogId: string) => void;
    onJoinOccupant?: (dialogId: string, userId: number) => void;
    onLeaveOccupant?: (dialogId: string, userId: number) => void;
    muc: {
      join: (jid: string, callback: (res: unknown) => void) => void;
      leave: (jid: string, callback?: () => void) => void;
    };
    dialog: {
      list: (
        params: { _id?: string; limit?: number },
        callback: (
          err: unknown,
          res: {
            items?: Array<{
              _id: string;
              xmpp_room_jid?: string;
              type: number;
              occupants_ids: number[];
            }>;
          },
        ) => void,
      ) => void;
    };
    message: {
      list: (
        params: { chat_dialog_id: string; sort_desc?: string; limit?: number },
        callback: (
          err: unknown,
          res: {
            items?: Array<{
              _id: string;
              sender_id: number;
              message: string;
              date_sent: number;
            }>;
          },
        ) => void,
      ) => void;
    };
  };
  webrtc?: {
    CallType: { VIDEO: number; AUDIO: number };
    onCallListener?: (session: QbWebrtcSession, extension: Record<string, unknown>) => void;
    onRemoteStreamListener?: (
      session: QbWebrtcSession,
      userId: number,
      stream: MediaStream,
    ) => void;
    onAcceptCallListener?: (
      session: QbWebrtcSession,
      userId: number,
      extension: Record<string, unknown>,
    ) => void;
    onRejectCallListener?: (
      session: QbWebrtcSession,
      userId: number,
      extension: Record<string, unknown>,
    ) => void;
    onStopCallListener?: (
      session: QbWebrtcSession,
      userId: number,
      extension: Record<string, unknown>,
    ) => void;
    onSessionCloseListener?: (session: QbWebrtcSession) => void;
    onUserNotAnswerListener?: (session: QbWebrtcSession, userId: number) => void;
  };
}

declare global {
  interface Window {
    QB?: QuickBloxClient;
  }
}

function getDateDividerLabel(timestamp: number): string {
  const msgDate = new Date(timestamp);
  const now = new Date();
  const isToday =
    msgDate.getFullYear() === now.getFullYear() &&
    msgDate.getMonth() === now.getMonth() &&
    msgDate.getDate() === now.getDate();
  if (isToday) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    msgDate.getFullYear() === yesterday.getFullYear() &&
    msgDate.getMonth() === yesterday.getMonth() &&
    msgDate.getDate() === yesterday.getDate();
  if (isYesterday) return "Yesterday";

  return msgDate.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: msgDate.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export default function QuickbloxConsultationRoom({
  subscriptionId,
  sdkConfig,
  patientData,
  onFinish,
}: QuickbloxConsultationRoomProps) {
  const router = useRouter();

  // State
  const [sdkReady, setSdkReady] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [activeDialogJid, setActiveDialogJid] = useState<string | null>(
    sdkConfig.dialogJid || null,
  );
  const [doctorTyping, setDoctorTyping] = useState(false);
  const [typingUserId, setTypingUserId] = useState<number | null>(null);

  // User display names mapping (id -> display name, e.g. Admin, Test Provider, You)
  const [userNames, setUserNames] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {
      142814409: "Admin",
      [sdkConfig.userId]: "You",
    };
    if (sdkConfig.providerId && sdkConfig.providerName) {
      initial[sdkConfig.providerId] = sdkConfig.providerName;
    }
    return initial;
  });
  const userNamesRef = useRef<Record<number, string>>(userNames);
  userNamesRef.current = userNames;
  const resolvingUsersRef = useRef<Set<number>>(new Set());

  // Resolve user display names from QuickBlox SDK
  const resolveUserNames = useCallback(
    (userIds: number[]) => {
      const QB = typeof window !== "undefined" ? window.QB : undefined;
      if (!QB?.users) return;

      const toFetch = userIds.filter((id) => {
        if (!id || id <= 0) return false;
        if (id === sdkConfig.userId) return false;
        if (userNamesRef.current[id]) return false;
        if (resolvingUsersRef.current.has(id)) return false;
        return true;
      });

      if (toFetch.length === 0) return;

      toFetch.forEach((id) => {
        resolvingUsersRef.current.add(id);

        if (id === 142814409) {
          setUserNames((prev) => ({ ...prev, [id]: "Admin" }));
          return;
        }

        try {
          QB.users?.get(
            id,
            (
              err: unknown,
              res: {
                user?: {
                  id: number;
                  full_name?: string;
                  email?: string;
                  login?: string;
                  user_tags?: string;
                };
              },
            ) => {
              if (!err && res?.user) {
                const u = res.user;
                const isAdmin =
                  u.user_tags?.includes("admin") ||
                  u.full_name?.toLowerCase().includes("admin") ||
                  u.email?.toLowerCase().includes("admin") ||
                  u.id === 142814409;
                const name = isAdmin
                  ? "Admin"
                  : u.full_name?.trim() ||
                    u.login?.trim() ||
                    (u.id === sdkConfig.providerId
                      ? sdkConfig.providerName || "Provider"
                      : "Healthcare Provider");
                setUserNames((prev) => ({ ...prev, [u.id]: name }));
              } else {
                resolvingUsersRef.current.delete(id);
              }
            },
          );
        } catch {
          resolvingUsersRef.current.delete(id);
        }
      });
    },
    [sdkConfig.userId, sdkConfig.providerId, sdkConfig.providerName],
  );

  const getSenderDisplayName = useCallback(
    (senderId: number, isSelf: boolean) => {
      if (isSelf || senderId === sdkConfig.userId) return "You";
      if (senderId === 142814409) return "Admin";
      if (userNames[senderId]) return userNames[senderId];
      if (senderId === sdkConfig.providerId) {
        return sdkConfig.providerName || "Provider";
      }
      return "Healthcare Provider";
    },
    [sdkConfig.userId, sdkConfig.providerId, sdkConfig.providerName, userNames],
  );

  const isJoinedMessage = useCallback(
    (item: {
      type?: string;
      notification_type?: string;
      message?: string;
      body?: string;
      extension?: { type?: string; notification_type?: string };
    }) => {
      const t =
        item.type ||
        item.notification_type ||
        item.extension?.type ||
        item.extension?.notification_type;
      if (t === "joined") return true;
      const text = (item.message || item.body || "").trim().toLowerCase();
      return (
        text === "joined" ||
        text.includes("has joined the chat") ||
        text.includes("you have joined the chat") ||
        text.includes("joined this chat") ||
        text.includes("has joined into the chat")
      );
    },
    [],
  );

  // Document attachment state
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // WebRTC Call state
  const [incomingCall, setIncomingCall] = useState<{
    session: QbWebrtcSession;
    isVideo: boolean;
    callerId: number;
  } | null>(null);

  const [activeCall, setActiveCall] = useState<{
    session: QbWebrtcSession;
    isVideo: boolean;
    startTime: number;
  } | null>(null);

  const [callDuration, setCallDuration] = useState("00:00");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);

  // Sidebar state
  const [showDetailsSidebar, setShowDetailsSidebar] = useState(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState<"intake" | "patient">("intake");

  // Refs
  const currentSessionRef = useRef<QbWebrtcSession | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const hasConnectedRef = useRef(false);
  const sdkConfigRef = useRef(sdkConfig);
  sdkConfigRef.current = sdkConfig;
  const resolveUserNamesRef = useRef(resolveUserNames);
  resolveUserNamesRef.current = resolveUserNames;
  const isJoinedMessageRef = useRef(isJoinedMessage);
  isJoinedMessageRef.current = isJoinedMessage;
  const playRingtoneRef = useRef<() => void>(() => {});
  const endCallRef = useRef<() => void>(() => {});

  // Auto scroll messages to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Ringtone playback
  const playRingtone = useCallback(() => {
    try {
      if (!ringtoneAudioRef.current) {
        ringtoneAudioRef.current = new Audio("/phone-ring.wav");
        ringtoneAudioRef.current.loop = true;
      }
      void ringtoneAudioRef.current.play().catch((err) => {
        console.warn("[QuickbloxConsultationRoom] Ringtone autoplay blocked:", err);
      });
    } catch (e) {
      console.warn("[QuickbloxConsultationRoom] Audio error:", e);
    }
  }, []);
  playRingtoneRef.current = playRingtone;

  const stopRingtone = useCallback(() => {
    if (ringtoneAudioRef.current) {
      ringtoneAudioRef.current.pause();
      ringtoneAudioRef.current.currentTime = 0;
    }
  }, []);

  // Timer for active call duration
  useEffect(() => {
    if (!activeCall) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - activeCall.startTime) / 1000);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
      const secs = String(elapsed % 60).padStart(2, "0");
      setCallDuration(`${mins}:${secs}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCall]);

  // Clean up media streams
  const cleanupMediaStreams = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    const localVideo = document.getElementById("localVideoElem") as HTMLVideoElement | null;
    if (localVideo) localVideo.srcObject = null;
    const remoteVideo = document.getElementById("remoteVideoElem") as HTMLVideoElement | null;
    if (remoteVideo) remoteVideo.srcObject = null;
  }, []);

  // End active call
  const endCall = useCallback(() => {
    stopRingtone();
    cleanupMediaStreams();
    if (currentSessionRef.current) {
      try {
        currentSessionRef.current.stop({});
      } catch {
        // ignore
      }
      currentSessionRef.current = null;
    }
    setActiveCall(null);
    setIncomingCall(null);
    setIsMuted(false);
    setIsVideoDisabled(false);
  }, [cleanupMediaStreams, stopRingtone]);
  endCallRef.current = endCall;

  // Reject incoming call
  const declineIncomingCall = useCallback(() => {
    stopRingtone();
    if (incomingCall?.session) {
      try {
        incomingCall.session.reject({});
      } catch {
        // ignore
      }
    }
    currentSessionRef.current = null;
    setIncomingCall(null);
  }, [incomingCall, stopRingtone]);

  // Accept incoming call from doctor
  const acceptIncomingCall = useCallback(() => {
    if (!incomingCall?.session) return;
    stopRingtone();

    const session = incomingCall.session;
    const isVideo = incomingCall.isVideo;
    currentSessionRef.current = session;

    const mediaParams = {
      audio: true,
      video: isVideo,
      options: { muted: false, mirror: true },
      elemId: "localVideoElem",
    };

    session.getUserMedia(mediaParams, (err, stream) => {
      if (err) {
        console.error("[QuickbloxConsultationRoom] getUserMedia error:", err);
        alert("Camera or microphone permission is required to accept this call.");
        declineIncomingCall();
        return;
      }

      localStreamRef.current = stream;
      try {
        session.attachMediaStream("localVideoElem", stream);
      } catch {
        const localVideo = document.getElementById("localVideoElem") as HTMLVideoElement | null;
        if (localVideo) localVideo.srcObject = stream;
      }

      try {
        session.accept({});
      } catch (accErr) {
        console.error("[QuickbloxConsultationRoom] session.accept error:", accErr);
      }

      setActiveCall({
        session,
        isVideo,
        startTime: Date.now(),
      });
      setIncomingCall(null);
    });
  }, [incomingCall, stopRingtone, declineIncomingCall]);

  // Toggle Mute Audio
  const toggleMuteAudio = useCallback(() => {
    if (!activeCall?.session) return;
    if (isMuted) {
      activeCall.session.unmute("audio");
      setIsMuted(false);
    } else {
      activeCall.session.mute("audio");
      setIsMuted(true);
    }
  }, [activeCall, isMuted]);

  // Toggle Video Camera
  const toggleVideo = useCallback(() => {
    if (!activeCall?.session || !activeCall.isVideo) return;
    if (isVideoDisabled) {
      activeCall.session.unmute("video");
      setIsVideoDisabled(false);
    } else {
      activeCall.session.mute("video");
      setIsVideoDisabled(true);
    }
  }, [activeCall, isVideoDisabled]);

  // Setup Chat Listeners and Dialog History once connected
  const setupChatListeners = useCallback((currentUserId: number) => {
    const QB = window.QB;
    if (!QB?.chat) return;

    const config = sdkConfigRef.current;

    // Listen for incoming messages
    QB.chat.onMessageListener = (userId, msg) => {
      console.log("[QuickBlox] onMessageListener:", userId, msg);
      if (userId === currentUserId) return; // ignore our own reflections

      const rawExt = msg.extension as
        | {
            type?: string;
            notification_type?: string;
            attachments?: ChatAttachmentItem[];
          }
        | undefined;

      const isJoined = isJoinedMessageRef.current({
        type: msg.type,
        notification_type: rawExt?.notification_type,
        body: msg.body,
        extension: rawExt,
      });

      const body = msg.body || "";
      const attachments = rawExt?.attachments || [];
      if (!isJoined && !body && attachments.length === 0) return;

      setMessages((prev) => {
        const id = msg._id || msg.id || String(Date.now());
        if (prev.some((m) => m.id === id)) return prev;
        return [
          ...prev,
          {
            id,
            senderId: userId,
            body: isJoined
              ? ""
              : body || (attachments[0]?.name ? `📎 ${attachments[0].name}` : "Attachment"),
            dateSent: msg.date_sent ? msg.date_sent * 1000 : Date.now(),
            isSelf: false,
            type: isJoined ? ("joined" as const) : ("message" as const),
            attachments,
          },
        ];
      });

      resolveUserNamesRef.current([userId]);
    };

    // Listen for occupant join/leave presence
    QB.chat.onJoinOccupant = (_dialogId, userId) => {
      console.log("[QuickBlox] onJoinOccupant:", userId);
      if (!userId) return;
      resolveUserNamesRef.current([userId]);

      setMessages((prev) => {
        const isSelf = userId === currentUserId;
        const recentJoined = prev.some(
          (m) => m.type === "joined" && m.senderId === userId && Date.now() - m.dateSent < 8000,
        );
        if (recentJoined) return prev;
        return [
          ...prev,
          {
            id: `join_${userId}_${Date.now()}`,
            senderId: userId,
            body: "",
            dateSent: Date.now(),
            isSelf,
            type: "joined",
          },
        ];
      });
    };

    // Listen for typing indicator
    if (QB.chat.onMessageTypingListener) {
      QB.chat.onMessageTypingListener = (isTyping, userId) => {
        if (userId !== currentUserId) {
          setDoctorTyping(isTyping);
          setTypingUserId(isTyping ? userId : null);
          if (isTyping) {
            resolveUserNamesRef.current([userId]);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
              setDoctorTyping(false);
              setTypingUserId(null);
            }, 4000);
          }
        }
      };
    }

    // Step 4: Load Dialog details & Join MUC room if group chat
    const targetDialogId = config.dialogId;
    if (targetDialogId) {
      QB.chat.dialog.list({ _id: targetDialogId }, (dErr, dRes) => {
        if (!dErr && dRes?.items?.length) {
          const dialog = dRes.items[0];
          if (dialog.occupants_ids?.length) {
            resolveUserNamesRef.current(dialog.occupants_ids);
          }
          const roomJid = dialog.xmpp_room_jid;
          if (roomJid) {
            setActiveDialogJid(roomJid);
            QB.chat.muc.join(roomJid, () => {
              console.log("[QuickBlox] Joined MUC room:", roomJid);

              // Broadcast joined notification stanza into the room
              try {
                QB.chat.send(roomJid, {
                  type: "groupchat",
                  body: "",
                  extension: {
                    save_to_history: 1,
                    dialog_id: targetDialogId,
                    type: "joined",
                  },
                });
              } catch (jErr) {
                console.warn("[QuickBlox] Send joined stanza notice:", jErr);
              }

              // Ensure local "You have joined the chat" pill is added if not yet present
              setMessages((prev) => {
                if (prev.some((m) => m.type === "joined" && m.isSelf)) return prev;
                return [
                  ...prev,
                  {
                    id: `join_self_${Date.now()}`,
                    senderId: currentUserId,
                    body: "",
                    dateSent: Date.now(),
                    isSelf: true,
                    type: "joined",
                  },
                ];
              });
            });
          }
        }
      });

      // Step 5: Fetch message history
      QB.chat.message.list(
        { chat_dialog_id: targetDialogId, sort_desc: "date_sent", limit: 50 },
        (mErr, mRes) => {
          if (!mErr && mRes?.items?.length) {
            const historical: ChatMessageItem[] = mRes.items
              .map((item) => {
                const rawItem = item as unknown as {
                  _id: string;
                  sender_id: number;
                  message?: string;
                  date_sent: number;
                  type?: string;
                  notification_type?: string;
                  extension?: {
                    type?: string;
                    notification_type?: string;
                    attachments?: ChatAttachmentItem[];
                  };
                  attachments?: ChatAttachmentItem[];
                };
                const isJoined = isJoinedMessageRef.current(rawItem);
                return {
                  id: rawItem._id,
                  senderId: rawItem.sender_id,
                  body: isJoined ? "" : rawItem.message || "",
                  dateSent: rawItem.date_sent * 1000,
                  isSelf: rawItem.sender_id === currentUserId,
                  type: isJoined ? ("joined" as const) : ("message" as const),
                  attachments: rawItem.attachments || rawItem.extension?.attachments || [],
                };
              })
              .reverse();

            setMessages((prev) => {
              const existingIds = new Set(historical.map((m) => m.id));
              const localJoins = prev.filter(
                (m) => m.type === "joined" && m.isSelf && !existingIds.has(m.id),
              );
              if (
                localJoins.length > 0 &&
                !historical.some((m) => m.type === "joined" && m.isSelf)
              ) {
                return [...historical, ...localJoins];
              }
              return historical;
            });

            // Resolve all sender names from historical messages
            const senders = historical.map((m) => m.senderId);
            resolveUserNamesRef.current(senders);
          }
        },
      );
    }
  }, []);

  // Initialize QuickBlox SDK & Connect to Chat
  const initQuickBlox = useCallback(() => {
    const QB = window.QB;
    if (!QB) {
      setConnectionError("QuickBlox SDK failed to load. Please refresh.");
      setConnecting(false);
      return;
    }

    if (hasConnectedRef.current || isConnectingRef.current) {
      return;
    }

    const config = sdkConfigRef.current;
    if (QB.chat?.isConnected) {
      hasConnectedRef.current = true;
      setConnected(true);
      setConnecting(false);
      setConnectionError(null);
      setupChatListeners(Number(config.userId));
      return;
    }

    isConnectingRef.current = true;
    setConnecting(true);
    setConnectionError(null);

    try {
      QB.init(config.appId, config.authKey, config.authSecret, config.accountKey);

      // Setup WebRTC Listeners: Doctor calls Patient
      if (QB.webrtc) {
        QB.webrtc.onCallListener = (session, extension) => {
          console.log("[QuickBlox] onCallListener incoming call:", session, extension);
          currentSessionRef.current = session;
          const isVideo = session.callType === QB.webrtc?.CallType.VIDEO;
          setIncomingCall({
            session,
            isVideo,
            callerId: session.initiatorId,
          });
          playRingtoneRef.current();
        };

        QB.webrtc.onRemoteStreamListener = (session, userId, stream) => {
          console.log("[QuickBlox] onRemoteStreamListener:", userId, stream);
          try {
            session.attachMediaStream("remoteVideoElem", stream);
          } catch {
            const remoteVideo = document.getElementById(
              "remoteVideoElem",
            ) as HTMLVideoElement | null;
            if (remoteVideo) remoteVideo.srcObject = stream;
          }
        };

        QB.webrtc.onStopCallListener = () => {
          console.log("[QuickBlox] onStopCallListener");
          endCallRef.current();
        };

        QB.webrtc.onRejectCallListener = () => {
          console.log("[QuickBlox] onRejectCallListener");
          endCallRef.current();
        };

        QB.webrtc.onSessionCloseListener = () => {
          console.log("[QuickBlox] onSessionCloseListener");
          endCallRef.current();
        };

        QB.webrtc.onUserNotAnswerListener = () => {
          console.log("[QuickBlox] onUserNotAnswerListener");
          endCallRef.current();
        };
      }

      // Step 1: Create Session with Client Email & Plan Password
      QB.createSession({ email: config.email, password: config.password }, (sessErr, sessRes) => {
        if (sessErr) {
          console.error("[QuickBlox] createSession error:", sessErr);
          isConnectingRef.current = false;
          setConnectionError("Could not authenticate consultation session. Please try again.");
          setConnecting(false);
          return;
        }

        console.log("[QuickBlox] createSession success:", sessRes?.token);
        const targetUserId = sessRes?.user_id ? Number(sessRes.user_id) : Number(config.userId);

        // Step 2: Connect to Chat Server
        if (QB.chat?.isConnected) {
          console.log("[QuickBlox] Chat is already connected, skipping chat.connect.");
          hasConnectedRef.current = true;
          isConnectingRef.current = false;
          setConnected(true);
          setConnecting(false);
          setConnectionError(null);
          setupChatListeners(targetUserId);
          return;
        }

        QB.chat.connect({ userId: targetUserId, password: config.password }, (chatErr) => {
          if (chatErr) {
            if (QB.chat?.isConnected) {
              console.log("[QuickBlox] chat reported status notice but isConnected is true.");
            } else {
              console.error("[QuickBlox] chat.connect error:", chatErr);
              isConnectingRef.current = false;
              setConnectionError("Could not establish chat connection. Please try again.");
              setConnecting(false);
              return;
            }
          }

          hasConnectedRef.current = true;
          isConnectingRef.current = false;
          console.log("[QuickBlox] chat.connect success!");
          setConnected(true);
          setConnecting(false);
          setConnectionError(null);

          setupChatListeners(targetUserId);
        });
      });
    } catch (e) {
      console.error("[QuickBlox] init exception:", e);
      isConnectingRef.current = false;
      setConnectionError("Failed to initialize QuickBlox. Please refresh.");
      setConnecting(false);
    }
  }, [setupChatListeners]);

  // Once script is loaded, initialize
  useEffect(() => {
    if (sdkReady) {
      initQuickBlox();
    }
  }, [sdkReady, initQuickBlox]);

  // Fallback check if window.QB was already available
  useEffect(() => {
    if (typeof window !== "undefined" && window.QB && !sdkReady) {
      setSdkReady(true);
    }
  }, [sdkReady]);

  // Send message in chat
  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text || !connected) return;

    const QB = window.QB;
    if (!QB || !QB.chat?.isConnected) return;

    const targetRecipient = activeDialogJid || sdkConfig.providerId || sdkConfig.dialogId;
    if (!targetRecipient) {
      console.warn("[QuickbloxConsultationRoom] No recipient to send message to.");
      return;
    }

    const isGroup = Boolean(activeDialogJid);
    const msgPayload = {
      type: isGroup ? "groupchat" : "chat",
      body: text,
      extension: {
        save_to_history: 1,
        dialog_id: sdkConfig.dialogId,
      },
      markable: 1,
    };

    try {
      const sentId = QB.chat.send(targetRecipient, msgPayload);
      const newMsg: ChatMessageItem = {
        id: sentId || `msg_${Date.now()}`,
        senderId: sdkConfig.userId,
        body: text,
        dateSent: Date.now(),
        isSelf: true,
        type: "message",
      };
      setMessages((prev) => [...prev, newMsg]);
      setInputText("");

      if (targetRecipient) {
        QB.chat.sendIsStopTypingStatus(targetRecipient);
      }
    } catch (sendErr) {
      console.error("[QuickbloxConsultationRoom] Send message error:", sendErr);
    }
  };

  // File attachment handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // Reset input so same file can be selected again

    const QB = window.QB;
    if (!QB || !connected) {
      setUploadError("Chat connection is not ready. Please wait.");
      return;
    }

    setUploadingFile(true);
    setUploadProgress(`Uploading ${file.name}…`);
    setUploadError(null);

    const targetRecipient = activeDialogJid || sdkConfig.providerId || sdkConfig.dialogId;
    if (!targetRecipient) {
      setUploadingFile(false);
      setUploadProgress(null);
      setUploadError("No active chat recipient found.");
      return;
    }

    const isGroup = Boolean(activeDialogJid);

    if (QB.content && typeof QB.content.createAndUpload === "function") {
      QB.content.createAndUpload(
        { file, name: file.name, type: file.type, size: file.size, public: false },
        (err, res) => {
          setUploadingFile(false);
          setUploadProgress(null);

          if (err || !res) {
            console.error("[QuickBlox] File upload error:", err);
            setUploadError("Failed to upload document. Please try again.");
            return;
          }

          const fileUid = res.uid || String(res.id);
          const downloadUrl = QB.content ? QB.content.privateUrl(fileUid) : "";
          const isPhoto = file.type.startsWith("image/");

          const attachmentItem: ChatAttachmentItem = {
            id: res.id,
            uid: res.uid,
            name: file.name,
            size: file.size,
            type: isPhoto ? "photo" : "file",
            url: downloadUrl,
          };

          const msgPayload = {
            type: isGroup ? "groupchat" : "chat",
            body: `📎 ${file.name}`,
            extension: {
              save_to_history: 1,
              dialog_id: sdkConfig.dialogId,
              attachments: [attachmentItem],
            },
            markable: 1,
          };

          try {
            const sentId = QB.chat.send(targetRecipient, msgPayload);
            const newMsg: ChatMessageItem = {
              id: sentId || `msg_${Date.now()}`,
              senderId: sdkConfig.userId,
              body: `📎 ${file.name}`,
              dateSent: Date.now(),
              isSelf: true,
              type: "message",
              attachments: [attachmentItem],
            };
            setMessages((prev) => [...prev, newMsg]);
          } catch (sendErr) {
            console.error("[QuickBlox] Send attachment error:", sendErr);
            setUploadError("Failed to send attachment.");
          }
        },
      );
    } else {
      setUploadingFile(false);
      setUploadProgress(null);
      setUploadError("Document upload service is unavailable.");
    }
  };

  // Typing indicator trigger
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    const QB = window.QB;
    if (QB && connected) {
      const targetRecipient = activeDialogJid || sdkConfig.providerId;
      if (targetRecipient) {
        QB.chat.sendIsTypingStatus(targetRecipient);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRingtone();
      cleanupMediaStreams();
      hasConnectedRef.current = false;
      isConnectingRef.current = false;
      if (typeof window !== "undefined" && window.QB?.chat?.isConnected) {
        try {
          window.QB.chat.disconnect();
        } catch {
          // ignore
        }
      }
    };
  }, [stopRingtone, cleanupMediaStreams]);

  return (
    <div className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-[#F9FBFA] text-[#152A51]">
      {/* Load QuickBlox standalone script from public directory */}
      <Script
        src="/quickblox.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log("[QuickbloxConsultationRoom] /quickblox.min.js loaded successfully");
          setSdkReady(true);
        }}
      />

      {/* Consultation Navigation Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#E8EEED] bg-white px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#152A51] text-white">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight sm:text-base">
                {patientData.medicineName} Consultation
              </h1>
              {connected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live</span>
                </span>
              ) : connecting ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  <span>Connecting</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                  <span>Offline</span>
                </span>
              )}
            </div>
            <p className="text-xs text-[#152A51]/60">
              {sdkConfig.providerName ? `${sdkConfig.providerName} · ` : ""}Consultation Room · Appt
              #{sdkConfig.appointmentId.slice(-6).toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowDetailsSidebar(!showDetailsSidebar)}
            className="h-9 items-center gap-1.5 rounded-full border-[#E8EEED] px-3.5 text-xs font-medium text-[#152A51] hover:bg-[#F3F6F6] inline-flex"
          >
            <Info className="h-3.5 w-3.5 text-[#152A51]/70" />
            <span>{showDetailsSidebar ? "Hide Medical Details" : "View Medical Details"}</span>
          </Button>
        </div>
      </header>

      {/* Main Container: Chat / Video Area (Left) + Patient Details Sidebar (Right) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Chat and In-Call Video Area */}
        <section className="relative flex flex-1 flex-col overflow-hidden bg-[#F9FBFA]">
          {/* Active Call Overlay Video Window */}
          {activeCall ? (
            <div className="relative flex h-[48%] min-h-[260px] w-full shrink-0 flex-col overflow-hidden bg-slate-950 text-white sm:h-[55%]">
              {/* Remote Provider Video Element */}
              <video
                id="remoteVideoElem"
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />

              {/* Local Patient Video (Picture-in-Picture) */}
              {activeCall.isVideo ? (
                <div className="absolute right-4 top-4 z-10 h-28 w-20 overflow-hidden rounded-xl border-2 border-white/30 bg-black shadow-lg sm:h-36 sm:w-28">
                  <video
                    id="localVideoElem"
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                  {isVideoDisabled ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 text-xs text-white/60">
                      Camera Off
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* In-Call Header Overlay */}
              <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-xs backdrop-blur-md">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span>Call Active · {callDuration}</span>
              </div>

              {/* In-Call Floating Control Toolbar */}
              <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/60 p-2 backdrop-blur-md">
                <button
                  type="button"
                  onClick={toggleMuteAudio}
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                    isMuted ? "bg-red-500 text-white" : "bg-white/20 text-white hover:bg-white/30"
                  }`}
                  title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>

                {activeCall.isVideo ? (
                  <button
                    type="button"
                    onClick={toggleVideo}
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                      isVideoDisabled
                        ? "bg-red-500 text-white"
                        : "bg-white/20 text-white hover:bg-white/30"
                    }`}
                    title={isVideoDisabled ? "Turn On Camera" : "Turn Off Camera"}
                  >
                    {isVideoDisabled ? (
                      <VideoOff className="h-5 w-5" />
                    ) : (
                      <Video className="h-5 w-5" />
                    )}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={endCall}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shadow-md transition hover:bg-red-700"
                  title="Hang Up"
                >
                  <PhoneOff className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : null}

          {/* Incoming Call Prompt Modal */}
          {incomingCall ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-white p-6 text-center text-[#152A51] shadow-2xl">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-8 ring-emerald-50">
                  <PhoneIncoming className="h-10 w-10 animate-bounce text-emerald-600" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#152A51]">Incoming Doctor Call</h3>
                <p className="mt-1 text-xs text-[#152A51]/70">
                  Your healthcare provider is calling you for your {patientData.medicineName}{" "}
                  consultation.
                </p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={declineIncomingCall}
                    className="h-11 flex-1 rounded-full bg-red-600 text-sm font-medium hover:bg-red-700"
                  >
                    <PhoneOff className="mr-1.5 h-4 w-4" />
                    <span>Decline</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={acceptIncomingCall}
                    className="h-11 flex-1 rounded-full bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-700 shadow-md animate-pulse"
                  >
                    {incomingCall.isVideo ? (
                      <Video className="mr-1.5 h-4 w-4" />
                    ) : (
                      <Mic className="mr-1.5 h-4 w-4" />
                    )}
                    <span>Answer</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Idle Call Informational Banner (Patient cannot start calls, clinician does) */}
          {!activeCall ? (
            <div className="border-b border-[#E8EEED] bg-white px-4 py-2.5">
              <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 text-xs text-[#152A51]/80">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span>
                    Clinician assigned. If your provider initiates an audio or video call, it will
                    ring automatically here.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetailsSidebar(true)}
                  className="shrink-0 font-medium text-[#152A51] underline md:hidden"
                >
                  Intake Data
                </button>
              </div>
            </div>
          ) : null}

          {/* Connection Error Banner */}
          {connectionError ? (
            <div className="flex items-center justify-between border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{connectionError}</span>
              </div>
              <button
                type="button"
                onClick={initQuickBlox}
                className="font-medium underline hover:no-underline"
              >
                Reconnect
              </button>
            </div>
          ) : null}

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {/* Consultation Intro Card */}
            <div className="mx-auto mb-6 max-w-md rounded-2xl border border-[#E8EEED] bg-white p-4 text-center shadow-xs">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#152A51]/10 text-[#152A51]">
                <ShieldCheck className="h-5 w-5 text-[#152A51]" />
              </div>
              <h2 className="mt-2 text-sm font-semibold text-[#152A51]">
                End-to-End Encrypted Consultation
              </h2>
              <p className="mt-1 text-xs text-[#152A51]/70">
                Welcome, {patientData.fullName}. You can ask questions about your{" "}
                {patientData.medicineName} plan or medication instructions directly in this chat.
              </p>
            </div>

            {/* Message Bubbles */}
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#152A51]/50">
                  No messages yet. Send a greeting to your provider below!
                </div>
              ) : (
                messages.map((msg, index) => {
                  const prevMsg = index > 0 ? messages[index - 1] : null;
                  const showDateDivider =
                    !prevMsg ||
                    new Date(prevMsg.dateSent).toDateString() !==
                      new Date(msg.dateSent).toDateString();
                  const dateLabel = showDateDivider ? getDateDividerLabel(msg.dateSent) : null;

                  const timeStr = new Date(msg.dateSent).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const senderName = getSenderDisplayName(msg.senderId, msg.isSelf);

                  return (
                    <div key={msg.id} className="space-y-2.5">
                      {/* Date Divider Pill (e.g. "Today", "Yesterday") */}
                      {showDateDivider && dateLabel ? (
                        <div className="my-2.5 flex justify-center">
                          <span className="rounded-full bg-[#E5ECF0]/85 px-3.5 py-0.5 text-[11px] font-medium text-[#152A51]/75 shadow-2xs">
                            {dateLabel}
                          </span>
                        </div>
                      ) : null}

                      {/* Joined Chat Center Pill Badge */}
                      {msg.type === "joined" ? (
                        <div className="my-2 flex justify-center">
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E5ECF0] px-4 py-1.5 text-xs font-medium text-[#152A51]/90 shadow-2xs">
                            <span>
                              {msg.isSelf
                                ? "You have joined the chat"
                                : `${senderName} has joined the chat`}
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* Regular Message Bubble */
                        <div
                          className={`flex flex-col ${msg.isSelf ? "items-end" : "items-start"}`}
                        >
                          <div className="flex items-baseline gap-1.5 text-[11px] text-[#152A51]/60">
                            <span className="font-semibold text-[#152A51]/85">{senderName}</span>
                            <span>{timeStr}</span>
                          </div>
                          <div
                            className={`mt-1 max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-xs sm:max-w-md ${
                              msg.isSelf
                                ? "rounded-tr-none bg-[#152A51] text-white"
                                : "rounded-tl-none border border-[#E8EEED] bg-white text-[#152A51]"
                            }`}
                          >
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>

                            {/* Attachments rendering */}
                            {msg.attachments && msg.attachments.length > 0 ? (
                              <div className="mt-2.5 space-y-2">
                                {msg.attachments.map((att, idx) => {
                                  const isPhoto =
                                    att.type === "photo" ||
                                    /\.(png|jpe?g|gif|webp)$/i.test(att.name || "");
                                  return (
                                    <div key={idx} className="overflow-hidden rounded-xl">
                                      {isPhoto && att.url ? (
                                        <a
                                          href={att.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="block transition hover:opacity-90"
                                          title={att.name || "View image"}
                                        >
                                          <img
                                            src={att.url}
                                            alt={att.name || "Attachment"}
                                            className="max-h-56 max-w-full rounded-lg bg-black/10 object-contain"
                                          />
                                        </a>
                                      ) : (
                                        <a
                                          href={att.url || "#"}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          download={att.name || "document"}
                                          className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs transition ${
                                            msg.isSelf
                                              ? "bg-white/15 text-white hover:bg-white/25"
                                              : "border border-[#E8EEED] bg-[#F9FBFA] text-[#152A51] hover:bg-[#F3F6F6]"
                                          }`}
                                        >
                                          <FileText className="h-4 w-4 shrink-0" />
                                          <span className="max-w-[180px] truncate font-medium">
                                            {att.name || "Attached document"}
                                          </span>
                                          {att.size ? (
                                            <span className="text-[10px] opacity-70">
                                              ({(att.size / 1024).toFixed(0)} KB)
                                            </span>
                                          ) : null}
                                          <Download className="ml-auto h-3.5 w-3.5 shrink-0 opacity-80" />
                                        </a>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {doctorTyping ? (
                <div className="flex items-center gap-1.5 text-xs text-[#152A51]/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#152A51]/40 animate-pulse" />
                  <span>
                    {typingUserId
                      ? `${getSenderDisplayName(typingUserId, false)} is typing…`
                      : "Provider is typing…"}
                  </span>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="border-t border-[#E8EEED] bg-white p-3 sm:p-4"
          >
            {/* Upload status indicator */}
            {uploadProgress ? (
              <div className="mx-auto mb-2 flex max-w-4xl items-center gap-2 rounded-xl bg-[#152A51]/5 px-3 py-1.5 text-xs font-medium text-[#152A51]">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#152A51]" />
                <span>{uploadProgress}</span>
              </div>
            ) : null}

            {uploadError ? (
              <div className="mx-auto mb-2 flex max-w-4xl items-center gap-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                <span className="flex-1">{uploadError}</span>
                <button
                  type="button"
                  onClick={() => setUploadError(null)}
                  className="text-red-700 hover:text-red-900"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}

            <div className="mx-auto flex max-w-4xl items-center gap-2">
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx,.txt"
                className="hidden"
              />

              {/* Attach Document Button */}
              <Button
                type="button"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={!connected || uploadingFile}
                className="h-11 w-11 shrink-0 rounded-full text-[#152A51]/70 transition hover:bg-[#152A51]/10 hover:text-[#152A51]"
                title="Attach document or photo"
              >
                {uploadingFile ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[#152A51]" />
                ) : (
                  <Paperclip className="h-5 w-5" />
                )}
              </Button>

              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                disabled={!connected}
                placeholder={
                  connected ? "Type your message or question here…" : "Connecting to secure chat…"
                }
                className="h-11 flex-1 rounded-full border border-[#E8EEED] bg-[#F9FBFA] px-4 text-sm text-[#152A51] outline-none transition placeholder:text-[#152A51]/40 focus:border-[#152A51] focus:bg-white"
              />
              <Button
                type="submit"
                disabled={!connected || !inputText.trim()}
                className="h-11 w-11 shrink-0 rounded-full bg-[#152A51] p-0 text-white transition hover:bg-[#152A51]/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </section>

        {/* Right Column: Patient Data & Intake Details Sidebar */}
        {showDetailsSidebar ? (
          <aside className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-[#E8EEED] bg-white shadow-xl transition md:static md:w-96 md:shadow-none">
            {/* Sidebar Header */}
            <div className="flex h-16 items-center justify-between border-b border-[#E8EEED] px-4 sm:px-6">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#152A51]" />
                <h2 className="text-sm font-semibold text-[#152A51]">Patient & Intake Details</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailsSidebar(false)}
                className="rounded-full p-1 text-[#152A51]/60 hover:bg-[#F3F6F6] hover:text-[#152A51]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sidebar Tab Selector */}
            <div className="flex border-b border-[#E8EEED] bg-[#F9FBFA] px-4 pt-2">
              <button
                type="button"
                onClick={() => setActiveSidebarTab("intake")}
                className={`flex-1 border-b-2 py-2 text-xs font-semibold transition ${
                  activeSidebarTab === "intake"
                    ? "border-[#152A51] text-[#152A51]"
                    : "border-transparent text-[#152A51]/60 hover:text-[#152A51]"
                }`}
              >
                Intake Questionnaire
              </button>
              <button
                type="button"
                onClick={() => setActiveSidebarTab("patient")}
                className={`flex-1 border-b-2 py-2 text-xs font-semibold transition ${
                  activeSidebarTab === "patient"
                    ? "border-[#152A51] text-[#152A51]"
                    : "border-transparent text-[#152A51]/60 hover:text-[#152A51]"
                }`}
              >
                Patient Profile
              </button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {activeSidebarTab === "intake" ? (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-semibold text-emerald-900">
                        Intake Form Completed
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-emerald-800">
                      Your confidential questionnaire has been recorded and submitted for clinician
                      review.
                    </p>
                  </div>

                  {/* Vitals Summary Card */}
                  <div className="rounded-2xl border border-[#E8EEED] bg-[#F9FBFA] p-3.5">
                    <h3 className="text-xs font-semibold text-[#152A51]">Key Metrics</h3>
                    <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-[#E8EEED] bg-white p-2.5">
                        <span className="text-[11px] text-[#152A51]/60">Age / Sex</span>
                        <p className="font-semibold text-[#152A51]">
                          {patientData.age ? `${patientData.age} yrs` : "—"} ·{" "}
                          {patientData.sex ? patientData.sex.toUpperCase() : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#E8EEED] bg-white p-2.5">
                        <span className="text-[11px] text-[#152A51]/60">Treatment</span>
                        <p className="truncate font-semibold text-[#152A51]">
                          {patientData.medicineName}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Structured JotForm Responses */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-[#152A51]">Medical Responses</h3>
                    {patientData.intakeAnswers && patientData.intakeAnswers.length > 0 ? (
                      <div className="space-y-2">
                        {patientData.intakeAnswers.map((item, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-[#E8EEED] bg-white p-3 text-xs shadow-xs"
                          >
                            <span className="font-medium text-[#152A51]/70">{item.label}</span>
                            <p className="mt-1 font-semibold text-[#152A51]">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-[#E8EEED] p-4 text-center text-xs text-[#152A51]/60">
                        Intake questionnaire verified. Detailed line items will synchronize during
                        clinician review.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Patient Info Card */}
                  <div className="rounded-2xl border border-[#E8EEED] bg-[#F9FBFA] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#152A51] text-base font-bold text-white">
                        {patientData.fullName.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#152A51]">{patientData.fullName}</h3>
                        <p className="text-xs text-[#152A51]/60">
                          DOB: {patientData.dob || "—"}{" "}
                          {patientData.age ? `(${patientData.age} years)` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 divide-y divide-[#E8EEED] text-xs">
                      <div className="pt-2">
                        <span className="text-[#152A51]/60">Email</span>
                        <p className="font-medium text-[#152A51]">{patientData.email}</p>
                      </div>
                      <div className="pt-2">
                        <span className="text-[#152A51]/60">Phone</span>
                        <p className="font-medium text-[#152A51]">{patientData.phone || "—"}</p>
                      </div>
                      <div className="pt-2">
                        <span className="text-[#152A51]/60">State / Region</span>
                        <p className="font-medium text-[#152A51]">
                          {patientData.stateCode
                            ? getStateName(patientData.stateCode) &&
                              getStateName(patientData.stateCode) !== patientData.stateCode
                              ? `${getStateName(patientData.stateCode)} (${patientData.stateCode.toUpperCase()})`
                              : patientData.stateCode.toUpperCase()
                            : "—"}
                        </p>
                      </div>
                      <div className="pt-2">
                        <span className="text-[#152A51]/60">Consultation Plan</span>
                        <p className="font-medium text-[#152A51]">{patientData.medicineName}</p>
                      </div>
                      <div className="pt-2">
                        <span className="text-[#152A51]/60">QuickBlox Client ID</span>
                        <p className="font-medium text-[#152A51]">{sdkConfig.userId}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
