"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createIdentity, type Identity } from "@/lib/identity";

type Room = { id: string; name: string };
type Message = {
  id: string;
  room_id: string;
  session_id: string;
  nickname: string;
  color: string;
  content: string;
  reply_to_message_id: string | null;
  created_at: string;
};

type ReactionRow = {
  message_id: string;
  emoji: string;
};

const REACTIONS = ["🔥", "😭", "👀", "💀", "🧠", "❤️"];

export default function RoomClient({ roomId }: { roomId: string }) {
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    setIdentity(createIdentity());
  }, []);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [input, setInput] = useState("");
  const [reactionCounts, setReactionCounts] = useState<Record<string, Record<string, number>>>({});
  const lastSentAtRef = useRef<number>(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: roomData } = await supabase
        .from("rooms")
        .select("id,name")
        .eq("id", roomId)
        .single();

      setRoom(roomData ?? null);

      const { data: msgData } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(200);

      setMessages((msgData as Message[]) ?? []);

      const { data: reactData } = await supabase
        .from("reactions")
        .select("message_id,emoji")
        .in("message_id", ((msgData as Message[]) ?? []).map(m => m.id));

      const counts: Record<string, Record<string, number>> = {};
      (reactData as ReactionRow[] | null)?.forEach(r => {
        counts[r.message_id] ??= {};
        counts[r.message_id][r.emoji] = (counts[r.message_id][r.emoji] ?? 0) + 1;
      });
      setReactionCounts(counts);
    };

    load();
  }, [roomId]);

  useEffect(() => {
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages(prev => [...prev, m]);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reactions" },
        (payload) => {
          const r = payload.new as { message_id: string; emoji: string };
          setReactionCounts(prev => {
            const next = { ...prev };
            next[r.message_id] = { ...(next[r.message_id] ?? {}) };
            next[r.message_id][r.emoji] = (next[r.message_id][r.emoji] ?? 0) + 1;
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const replyPreview = replyTo ? messages.find(m => m.id === replyTo.id) : null;

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed) return;

    if (!identity) return;

    // simple client rate limit: 1 message / 2 seconds
    const now = Date.now();
    if (now - lastSentAtRef.current < 2000) return;
    lastSentAtRef.current = now;

    if (trimmed.length > 500) return;

    setInput("");

    const { data, error } = await supabase.from("messages").insert({
      room_id: roomId,
      session_id: identity.sessionId,
      nickname: identity.nickname,
      color: identity.color,
      content: trimmed,
      reply_to_message_id: replyTo?.id ?? null,
    });

    if (error) {
      console.error("INSERT messages failed:", error);
    }
    setReplyTo(null);
  }

  async function react(messageId: string, emoji: string) {
    if (!identity) return;

    // unique constraint prevents spam by same session for same emoji
    const { error } = await supabase.from("reactions").insert({
      message_id: messageId,
      emoji,
      session_id: identity.sessionId,
    });

    if (error) console.error("INSERT reactions failed:", error);
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur px-4 py-3">
        <div className="text-sm opacity-70">Анон комната ФБ</div>
        <div className="font-semibold">{room?.name ?? "Загрузка..."}</div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m) => {
          const reply = m.reply_to_message_id ? messages.find(x => x.id === m.reply_to_message_id) : null;
          const counts = reactionCounts[m.id] ?? {};

          return (
            <div key={m.id} className="rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                <span className="font-medium">{m.nickname}</span>
                <span className="ml-auto text-xs opacity-60">{new Date(m.created_at).toLocaleTimeString()}</span>
              </div>

              {reply && (
                <div className="mt-2 rounded-lg bg-black/5 p-2 text-sm">
                  <div className="text-xs opacity-60">Ответ на {reply.nickname}</div>
                  <div className="line-clamp-2">{reply.content}</div>
                </div>
              )}

              <div className="mt-2 whitespace-pre-wrap">{m.content}</div>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  className="text-xs rounded-lg border px-2 py-1 opacity-80"
                  onClick={() => setReplyTo(m)}
                >
                  Ответить
                </button>

                {REACTIONS.map((e) => (
                  <button
                    key={e}
                    className="text-xs rounded-lg border px-2 py-1"
                    onClick={() => react(m.id, e)}
                  >
                    {e} {counts[e] ? <span className="opacity-70">{counts[e]}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      <footer className="sticky bottom-0 border-t bg-white px-4 py-3">
        {replyPreview && (
          <div className="mb-2 rounded-xl bg-black/5 p-2 text-sm flex items-start gap-2">
            <div className="flex-1">
              <div className="text-xs opacity-60">Ответ на {replyPreview.nickname}</div>
              <div className="line-clamp-2">{replyPreview.content}</div>
            </div>
            <button className="text-xs opacity-70" onClick={() => setReplyTo(null)}>✕</button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border px-3 py-2"
            placeholder="Напишите сообщение..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button className="rounded-xl border px-4 py-2" onClick={sendMessage}>
            Отправить
          </button>
        </div>

        <div className="mt-2 text-xs opacity-60">
          {identity ? (
            <>
              Вы — <span className="font-medium">{identity.nickname}</span>{" "}
              (обновите страницу — будет новое)
            </>
          ) : (
            "Загрузка…"
          )}
        </div>
      </footer>
    </div>
  );
}