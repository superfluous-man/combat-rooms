import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";

type Room = { id: string; name: string; created_at: string };

export default async function HomePage() {
  const { data, error } = await supabaseServer
    .from("rooms")
    .select("id,name,created_at")
    .order("created_at", { ascending: true });

  const rooms = (data ?? []) as Room[];

  return (
    <div className="min-h-dvh bg-zinc-50">
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <header className="mb-5">
          <div className="text-xs text-zinc-500">Прототип</div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Анонимные комнаты Битвы
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Выберите уровень и пишите без регистрации.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
            Не удалось загрузить комнаты. Проверьте настройки Supabase.
            <div className="mt-2 text-xs text-zinc-500">
              {error.message}
            </div>
          </div>
        ) : rooms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
            Комнат пока нет. Создайте одну в таблице <span className="font-medium">rooms</span>.
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((r) => (
              <Link
                key={r.id}
                href={`/room/${r.id}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-zinc-300 active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center">
                    💬
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-zinc-900 truncate">
                      {r.name}
                    </div>
                    <div className="text-xs text-zinc-500 truncate">
                      Нажмите, чтобы открыть
                    </div>
                  </div>
                  <div className="text-xs text-zinc-400">→</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}