"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createIdentity, type Identity } from "@/lib/identity";
import { linkifyText } from "@/lib/linkify";

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
    <div className="min-h-dvh flex flex-col bg-zinc-50 antialiased">
      <div className="mx-auto w-full max-w-2xl flex flex-col min-h-dvh">
        <div className="min-h-dvh flex flex-col">
          <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-zinc-900 text-white flex items-center justify-center text-sm">
                ⚔️
              </div>
              <div className="min-w-0">
                <a className="text-xs text-zinc-500" href="/">Анонимный ФБ чат</a>
                <div className="font-semibold truncate text-zinc-900">
                  <span className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-2.5 py-1 text-indigo-700 ring-1 ring-indigo-200">
                    {room?.name ?? "Загрузка…"}
                  </span>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
                Пока тихо. Напишите первой.
              </div>
            )}
            {messages.map((m) => {
              const reply = m.reply_to_message_id ? messages.find(x => x.id === m.reply_to_message_id) : null;
              const counts = reactionCounts[m.id] ?? {};

              return (
                <div key={m.id} className="rounded-2xl bg-white border border-zinc-200 p-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                    <span className="font-medium text-zinc-900">{m.nickname}</span>
                    <span className="ml-auto text-xs text-zinc-400" suppressHydrationWarning>
                      {new Date(m.created_at).toLocaleTimeString()}
                    </span>
                  </div>

                  {reply && (
                    <div className="mt-2 rounded-xl bg-zinc-50 border border-zinc-200 p-2 text-sm">
                      <div className="text-xs text-zinc-500">Ответ на {reply.nickname}</div>
                      <div className="line-clamp-2 text-zinc-700">{reply.content}</div>
                    </div>
                  )}

                  <div className="mt-2 whitespace-pre-wrap text-zinc-900 leading-relaxed">
                    {linkifyText(m.content)}
                  </div>

                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <button
                      className="text-xs rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-zinc-700 active:scale-[0.99]"
                      onClick={() => setReplyTo(m)}
                    >
                      Ответить
                    </button>

                    {REACTIONS.map((e) => (
                      <button
                        key={e}
                        className="text-xs rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-zinc-700 active:scale-[0.99]"
                        onClick={() => react(m.id, e)}
                      >
                        {e}
                        {counts[e] ? <span className="ml-1 text-zinc-500">{counts[e]}</span> : null}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </main>

          <footer className="sticky bottom-0 border-t bg-white/90 backdrop-blur px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            <details className="mb-3 rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-900">Полезные ссылки ЗФБ-26</span>
                <span className="text-zinc-500">⌄</span>
              </summary>

              <div className="px-4 pb-4 pt-1 text-sm">
                <div className="flex flex-col gap-2">
                  <a
                    href="PUT_RULES_LINK_HERE"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 hover:bg-zinc-100"
                  >
                    📌 Правила
                  </a>

                  <a
                    href="https://images2.imgbox.com/e1/dd/r0roXB0T_o.png"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 hover:bg-zinc-100"
                  >
                    🗓️ Расписание
                  </a>

                  <a
                    href="https://fkomb.cyou/wtf2026/catalog.php"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 hover:bg-zinc-100"
                  >
                    🧾 Каталог работ по командам
                  </a>

                  <a
                    href="https://discord.com/invite/yW8YFCd"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 hover:bg-zinc-100"
                  >
                    💬 Дискорд
                  </a>
                </div>
              </div>
            </details>
            {replyPreview && (
              <div className="mb-2 rounded-2xl bg-zinc-50 border border-zinc-200 p-2 text-sm flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-zinc-500">Ответ на {replyPreview.nickname}</div>
                  <div className="line-clamp-2 text-zinc-700">{replyPreview.content}</div>
                </div>
                <button className="text-xs text-zinc-500 px-2" onClick={() => setReplyTo(null)}>✕</button>
              </div>
            )}

            <div className="flex gap-2 items-end">
              <input
                className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
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
              <button className="rounded-2xl bg-zinc-900 text-white px-4 py-3 font-medium active:scale-[0.99]" onClick={sendMessage}>
                Отправить
              </button>
            </div>

            <div className="mt-2 text-xs text-zinc-500">
              {identity ? (
                <>Вы — <span className="font-medium text-zinc-700">{identity.nickname}</span>{" "}
                  (обновите страницу — будет новое имя)
                </>
              ) : (
                "Загрузка…"
              )}
            </div>
          </footer>
        </div>
      </div>
    </div>

  );
}