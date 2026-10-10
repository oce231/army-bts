// Edge Function "send-push" — envoie les notifications push (site fermé inclus)
// Déclenchée par un trigger SQL (voir supabase/setup-push.sql) à chaque nouveau
// message privé ou message de salon contenant une mention.
//
// Secrets requis (supabase secrets set ...) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...), WEBHOOK_SECRET
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const ROOMS: Record<string, string> = {
  general: "Général", theories: "Théories & Lore", study: "Entraide & Études",
  creative: "Créations", music: "Découvertes musicales", wellbeing: "Bien-être",
};

async function sendTo(userIds: string[], payload: Record<string, unknown>) {
  if (!userIds.length) return 0;
  const { data: subs } = await sb.from("push_subscriptions").select("endpoint,p256dh,auth").in("user_id", userIds);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
      sent++;
    } catch (e) {
      // 404/410 = abonnement expiré : on le supprime
      if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      else console.error("push error", e?.statusCode, e?.body);
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) return new Response("forbidden", { status: 403 });
  const { table, record } = await req.json();
  if (!record) return new Response("ok");

  if (table === "direct_messages") {
    const { data: p } = await sb.from("profiles").select("pseudo").eq("id", record.sender_id).maybeSingle();
    const n = await sendTo([record.receiver_id], {
      title: "💬 " + (p?.pseudo ?? "Message privé"),
      body: String(record.content ?? "").slice(0, 120),
      url: "community.html",
    });
    return new Response(JSON.stringify({ sent: n }));
  }

  if (table === "lounge_messages") {
    const content: string = record.content ?? "";
    const room = ROOMS[record.room] ?? record.room;
    const mentions = [...content.matchAll(/@([a-zA-Z0-9_À-ÿ]{1,20})/g)].map((m) => m[1].toLowerCase());
    if (!mentions.length) return new Response("no mention");
    let targets: string[] = [];
    if (mentions.includes("everyone")) {
      const { data } = await sb.from("push_subscriptions").select("user_id");
      targets = [...new Set((data ?? []).map((r) => r.user_id))];
    } else {
      const { data } = await sb.from("profiles").select("id,pseudo");
      targets = (data ?? []).filter((r) => mentions.includes(String(r.pseudo).toLowerCase())).map((r) => r.id);
    }
    // pas de notification pour l'auteur du message
    const { data: author } = await sb.from("profiles").select("id").eq("pseudo", record.pseudo).maybeSingle();
    targets = targets.filter((id) => id !== author?.id);
    const n = await sendTo(targets, {
      title: (mentions.includes("everyone") ? "📢 @everyone — #" : "🔔 Mention — #") + room,
      body: record.pseudo + " : " + content.slice(0, 100),
      url: "community.html",
    });
    return new Response(JSON.stringify({ sent: n }));
  }
  return new Response("ignored");
});
