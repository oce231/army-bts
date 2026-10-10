# Notifications push (site fermé) — mise en place via la CLI Supabase

Le navigateur s'abonne déjà (push.js → table `push_subscriptions`), mais personne n'ENVOIE
les notifications. Cette fonction les envoie. On la déploie avec la **CLI** (pas l'éditeur du
dashboard, qui bug sur ton compte).

1. Installer la CLI : https://supabase.com/docs/guides/cli  puis `supabase login`
2. Dans le dossier du repo : `supabase link --project-ref zbpowcgzdjyndcwmogqk`
3. Secrets (la clé PRIVÉE VAPID est celle qui va avec la clé publique de push.js) :
   ```
   supabase secrets set VAPID_PUBLIC_KEY="BOIChdK1y2eeCTevPgr-fskUm3tyQ8K9TNgieXLp_vnS85321_tMEUSYhqsP0xb8B1RJFD6rh_nrVr6n8RUgvOo" \
     VAPID_PRIVATE_KEY="<ta clé privée>" VAPID_SUBJECT="mailto:ton@email" WEBHOOK_SECRET="<un mot de passe long>"
   ```
   Si tu n'as plus la clé privée : `npx web-push generate-vapid-keys`, puis remplace `VAPID_PUBLIC_KEY`
   dans `push.js` (tout le monde devra réactiver ses notifications).
4. Déployer : `supabase functions deploy send-push --no-verify-jwt`
5. SQL Editor : coller `supabase/setup-push.sql` (en remplaçant MON_SECRET) et exécuter.
6. Tester : compte A écrit à compte B (B a activé 🔔 Notifs, site fermé).
