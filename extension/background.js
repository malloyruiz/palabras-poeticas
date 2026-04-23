const API_URL = "https://script.google.com/macros/s/AKfycbyAIZ5rUHznpscJuPjEdhqoV1glBVHzSXnbZr-lPE8NBms7yJCk1XQTjWbzPK9Jgpw1/exec";
const PWA_URL = "https://luminapp.today";

// --- SINCRONIZACIÓN ---
async function syncWithLumina() {
    const data = await chrome.storage.local.get(['userEmail', 'userTier']);
    if (!data.userEmail) return;

    try {
        // 1. Refrescar Perfil y Configuración
        const resp = await fetch(`${API_URL}?action=user_login&mode=refresh&email=${encodeURIComponent(data.userEmail)}&password=DUMMY`); 
        const res = await resp.json();
        
        if (res.success) {
            let streak = 0;
            let realName = res.name || "Explorador";
            let config = {};

            if (res.data) {
                try {
                    config = JSON.parse(res.data);
                    if (config.lumina_user_name) realName = config.lumina_user_name;
                    streak = config.lumina_streak || 0;
                } catch(e) {}
            }
            
            await chrome.storage.local.set({ 
                userName: realName, 
                lumina_streak: streak,
                userTier: res.tier || 'FREE',
                lumina_config: config
            });

            // 2. Precargar Notificaciones
            await fetchAndStoreNotifications(data.userEmail, res.tier || 'FREE');
        }
    } catch (e) {
        console.error("Error sincronizando en background:", e);
    }
}

async function fetchAndStoreNotifications(email, tier) {
    try {
        const url = `${API_URL}?action=notifs&email=${encodeURIComponent(email)}&userType=${tier}&_cb=${Date.now()}`;
        const resp = await fetch(url);
        const notifs = await resp.json();
        let allNotifs = Array.isArray(notifs) ? notifs : [];
        
        // Gaps
        try {
            const respGaps = await fetch(`${API_URL}?action=get_calendar_gaps&_cb=${Date.now()}`);
            const gapsRes = await respGaps.json();
            if (gapsRes && gapsRes.success && Array.isArray(gapsRes.gaps)) {
                gapsRes.gaps.forEach(g => {
                    allNotifs.unshift({
                        cat: 'agenda',
                        titulo: 'Agenda Lúmina',
                        mensaje: `Hueco de ${g.duration} min a las ${new Date(g.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.`
                    });
                });
            }
        } catch(e) {}

        // Guardar en local para carga instantánea
        await chrome.storage.local.set({ cached_notifs: allNotifs, last_notif_sync: Date.now() });
        
        // Actualizar Badge
        if (allNotifs.length > 0) {
            chrome.action.setBadgeText({ text: allNotifs.length.toString() });
            chrome.action.setBadgeBackgroundColor({ color: "#B5833A" });
        } else {
            chrome.action.setBadgeText({ text: "" });
        }
    } catch(e) { console.error("Error precargando notifs:", e); }
}

// --- ALARMAS ---
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'sync_notifs') {
        syncWithLumina();
    }
});

// --- EVENTOS DE CICLO DE VIDA ---
chrome.runtime.onInstalled.addListener(() => {
    // Sincro cada 15 min para notificaciones frescas
    chrome.alarms.create('sync_notifs', { periodInMinutes: 15 });
    syncWithLumina();
});

// Escuchar mensajes (ej: login exitoso)
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'login_success' || message.action === 'refresh_data') {
        syncWithLumina();
    }
    return true;
});
