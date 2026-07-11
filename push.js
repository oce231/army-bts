/* ══════════════════════════════════════════════
   NOTIFICATIONS PUSH — module partagé
   Utilisé par index.html et community.html
══════════════════════════════════════════════ */

// Clé publique VAPID (sans risque à exposer côté client, contrairement à la clé privée)
const VAPID_PUBLIC_KEY = 'BOIChdK1y2eeCTevPgr-fskUm3tyQ8K9TNgieXLp_vnS85321_tMEUSYhqsP0xb8B1RJFD6rh_nrVr6n8RUgvOo';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

async function savePushSubscription(supabaseClient, userId, sub) {
  const json = sub.toJSON();
  await supabaseClient.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth
  }, { onConflict: 'endpoint' });
}

// État actuel des notifications pour CET appareil (pas juste la permission navigateur)
window.getPushStatus = async function() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.getRegistration('sw.js');
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) return 'enabled';
    }
  } catch(e) {}
  return 'disabled';
};

// Active les notifications : demande la permission, s'abonne, sauvegarde en base
window.enablePushNotifications = async function(supabaseClient, userId) {
  if (!pushSupported()) {
    alert('Les notifications ne sont pas prises en charge par ce navigateur.');
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    await savePushSubscription(supabaseClient, userId, sub);
    return true;
  } catch(e) {
    console.error('Erreur activation notifications:', e);
    return false;
  }
};

// Désactive les notifications pour cet appareil (désabonne + supprime en base)
window.disablePushNotifications = async function(supabaseClient) {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('sw.js');
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabaseClient.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
  } catch(e) {
    console.error('Erreur désactivation notifications:', e);
  }
};
