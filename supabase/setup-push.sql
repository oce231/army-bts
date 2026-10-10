-- À exécuter UNE FOIS dans Supabase → SQL Editor (remplace MON_SECRET par le même
-- secret que WEBHOOK_SECRET dans les secrets de l'Edge Function).
-- Projet : zbpowcgzdjyndcwmogqk

create or replace trigger push_on_direct_message
after insert on public.direct_messages
for each row execute function supabase_functions.http_request(
  'https://zbpowcgzdjyndcwmogqk.supabase.co/functions/v1/send-push',
  'POST',
  '{"Content-Type":"application/json","x-webhook-secret":"MON_SECRET"}',
  '{}',
  '5000'
);

create or replace trigger push_on_lounge_message
after insert on public.lounge_messages
for each row
when (new.content ~* '@')
execute function supabase_functions.http_request(
  'https://zbpowcgzdjyndcwmogqk.supabase.co/functions/v1/send-push',
  'POST',
  '{"Content-Type":"application/json","x-webhook-secret":"MON_SECRET"}',
  '{}',
  '5000'
);
