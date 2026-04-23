const API_URL = "https://script.google.com/macros/s/AKfycbyAIZ5rUHznpscJuPjEdhqoV1glBVHzSXnbZr-lPE8NBms7yJCk1XQTjWbzPK9Jgpw1/exec";
const PWA_URL = "https://luminapp.today";

const ICONS = {
    palabras: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="15"></line></svg>',
    afirmaciones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>',
    frases: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
    libros: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
    pausa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
    sendas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>',
    extra: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12l4 8-10 10L2 11z"></path><path d="M11 3l-4 8 5 10 5-10-4-8"></path></svg>',
    agenda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
};

let currentWisdom = {};
let activeTab = 'palabras';

document.addEventListener('DOMContentLoaded', async () => {
    injectIcons();

    const data = await chrome.storage.local.get(['userEmail', 'userName', 'lumina_streak', 'cached_notifs', 'cached_wisdom']);
    
    if (data.userEmail) {
        // CARGA INSTANTÁNEA DESDE CACHÉ
        if (data.cached_wisdom) {
            currentWisdom = data.cached_wisdom;
        }
        
        showDashboard(data.userName || "Explorador", data.lumina_streak || 0);
        
        if (data.cached_notifs) renderNotifications(data.cached_notifs);
        
        // REFRESCAR TODO EN SILENCIO
        refreshUserProfile(data.userEmail);
    } else {
        document.getElementById('auth-section').style.display = 'block';
    }

    // EVENTOS
    document.getElementById('btn-login').addEventListener('click', handleLogin);
    document.getElementById('btn-logout').addEventListener('click', () => {
        chrome.storage.local.clear();
        window.location.reload();
    });

    document.querySelectorAll('.tab').forEach(t => {
        t.addEventListener('click', () => switchTab(t.dataset.cat));
    });

    document.getElementById('nav-libros').addEventListener('click', () => openPWA('libros'));
    document.getElementById('nav-sendas').addEventListener('click', () => openPWA('sendas'));
    document.getElementById('nav-pausa').addEventListener('click', () => openPWA('pausa'));
    document.getElementById('nav-extra').addEventListener('click', () => openPWA('expansiones'));
    
    document.getElementById('btn-go-to-pwa').addEventListener('click', () => openPWA(activeTab));
    document.getElementById('btn-notif').addEventListener('click', toggleNotifSection);
    document.getElementById('btn-close-notif').addEventListener('click', toggleNotifSection);
    document.getElementById('btn-view-all-notifs').addEventListener('click', () => openPWA('notifications'));
});

function injectIcons() {
    document.getElementById('icon-libros').innerHTML = ICONS.libros;
    document.getElementById('icon-sendas').innerHTML = ICONS.sendas;
    document.getElementById('icon-pausa').innerHTML = ICONS.pausa;
    document.getElementById('icon-extra').innerHTML = ICONS.extra;
}

function toggleNotifSection() {
    const sec = document.getElementById('notif-section');
    const isHidden = sec.style.display === 'none';
    sec.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
        document.getElementById('notif-badge').style.display = 'none';
        chrome.action.setBadgeText({ text: "" });
    }
}

async function refreshUserProfile(email) {
    try {
        const url = `${API_URL}?action=user_login&mode=refresh&email=${encodeURIComponent(email)}&password=DUMMY`;
        const resp = await fetch(url);
        const res = await resp.json();
        
        if (res.success) {
            let streak = 0;
            let realName = res.name || "Explorador";

            if (res.data) {
                try {
                    const config = JSON.parse(res.data);
                    if (config.lumina_user_name) realName = config.lumina_user_name;
                    streak = config.lumina_streak || 0;
                } catch(e) {}
            }
            
            await chrome.storage.local.set({ 
                userName: realName, 
                lumina_streak: streak,
                userTier: res.tier || 'FREE'
            });
            
            updateGreeting(realName);
            updateStreakUI(streak);
            
            // Refrescar sabiduría y notificaciones en un solo bloque
            fetchAllWisdom();
            fetchNotifications(email, res.tier || 'FREE');
        }
    } catch (e) { console.error("Sync error", e); }
}

async function fetchNotifications(email, tier) {
    try {
        const url = `${API_URL}?action=notifs&email=${encodeURIComponent(email)}&userType=${tier || 'FREE'}&_cb=${Date.now()}`;
        const resp = await fetch(url);
        const notifs = await resp.json();
        let allNotifs = Array.isArray(notifs) ? notifs : [];
        
        try {
            const respGaps = await fetch(`${API_URL}?action=get_calendar_gaps&_cb=${Date.now()}`);
            const gapsRes = await respGaps.json();
            if (gapsRes && gapsRes.success && Array.isArray(gapsRes.gaps)) {
                gapsRes.gaps.forEach(g => {
                    allNotifs.unshift({
                        cat: 'agenda',
                        titulo: 'Agenda Lúmina',
                        mensaje: `Tienes un hueco de ${g.duration} min a las ${new Date(g.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}. ¿Pausamos?`
                    });
                });
            }
        } catch(e) {}

        await chrome.storage.local.set({ cached_notifs: allNotifs });
        renderNotifications(allNotifs);
    } catch (e) { console.warn("Notif fetch error", e); }
}

function renderNotifications(notifs) {
    const list = document.getElementById('notif-list');
    const badge = document.getElementById('notif-badge');
    
    if (!notifs || notifs.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.3; font-size:0.7rem;">No hay novedades hoy.</div>';
        badge.style.display = 'none';
        chrome.action.setBadgeText({ text: "" });
        return;
    }

    list.innerHTML = '';
    notifs.forEach(n => {
        const item = document.createElement('div');
        item.className = 'notif-item';
        let cat = (n.cat || 'info').toLowerCase();
        if (cat.includes('senda')) cat = 'sendas';
        const iconSvg = ICONS[cat] || ICONS.info;

        item.innerHTML = `
            <div class="notif-item-icon">${iconSvg}</div>
            <div style="flex:1">
                <div style="font-weight:700; color:var(--accent); margin-bottom:2px; font-size:0.7rem;">${n.titulo}</div>
                <div style="opacity:0.6; line-height:1.2; font-size:0.65rem;">${n.mensaje}</div>
            </div>
        `;
        
        item.addEventListener('click', () => {
            let finalUrl = PWA_URL;
            if (n.link) {
                if (n.link.startsWith('http')) finalUrl = n.link;
                else if (n.link.startsWith('#')) finalUrl = `${PWA_URL}/${n.link}`;
                else finalUrl = `${PWA_URL}/#${n.link}`;
            } else {
                const catLink = cat === 'agenda' ? 'pausa' : cat;
                finalUrl = `${PWA_URL}/#${catLink}`;
            }
            chrome.tabs.create({ url: finalUrl });
        });
        list.appendChild(item);
    });

    badge.innerText = notifs.length;
    badge.style.display = 'flex';
    chrome.action.setBadgeText({ text: notifs.length.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#B5833A" });
}

function updateGreeting(name) {
    const firstName = (name && name !== "undefined") ? name.split(' ')[0] : 'Explorador';
    document.getElementById('greeting').innerText = `Hola, ${firstName}`;
}

function updateStreakUI(streak) {
    const container = document.getElementById('streak-container');
    const val = document.getElementById('streak-val');
    if (streak > 0) {
        container.style.display = 'flex';
        val.innerText = streak;
    } else {
        container.style.display = 'none';
    }
}

async function fetchAllWisdom() {
    try {
        // USAR EL NUEVO ENDPOINT OPTIMIZADO 'wisdom_pack'
        const resp = await fetch(`${API_URL}?action=wisdom_pack&_cb=${Date.now()}`);
        const pack = await resp.json();
        
        if (pack && pack.palabras) {
            currentWisdom = pack;
            await chrome.storage.local.set({ cached_wisdom: pack });
            renderActiveTab();
        }
    } catch (e) {
        console.warn("Wisdom fetch error", e);
    }
}

function switchTab(cat) {
    activeTab = cat;
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.cat === cat);
    });
    renderActiveTab();
}

function renderActiveTab() {
    const data = currentWisdom[activeTab];
    const title = document.getElementById('wisdom-title');
    const desc = document.getElementById('wisdom-desc');
    if (!data) return;

    if (activeTab === 'palabras') {
        title.innerText = data.palabra || "...";
        desc.innerText = data.definicion || "Sabiduría para hoy.";
    } else if (activeTab === 'afirmaciones') {
        title.innerText = "Afirmación";
        desc.innerHTML = `<i style="font-family:'Playfair Display', serif; font-size:1.1rem;">"${data.afirmacion || '...'}"</i>`;
    } else if (activeTab === 'frases') {
        title.innerText = data.autor || "Autor";
        desc.innerHTML = `<i style="font-family:'Playfair Display', serif; font-size:1.1rem;">"${data.frase || '...'}"</i>`;
    }
}

function showDashboard(name, streak) {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dash-section').style.display = 'block';
    updateGreeting(name);
    updateStreakUI(streak || 0);
    
    // Si tenemos sabiduría en caché, la renderizamos de una vez
    if (currentWisdom.palabras) renderActiveTab();
    else fetchAllWisdom();
}

async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value;
    const errorMsg = document.getElementById('error-msg');
    const btn = document.getElementById('btn-login');

    if (!email || !pass) {
        errorMsg.innerText = "Escribe tu email y clave";
        errorMsg.style.display = 'block';
        return;
    }

    btn.disabled = true;
    btn.innerText = "PROCESANDO...";
    errorMsg.style.display = 'none';

    try {
        const url = `${API_URL}?action=user_login&mode=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("Error de red: " + resp.status);
        const res = await resp.json();

        if (res.success) {
            await chrome.storage.local.set({ userEmail: email, userName: res.name });
            showDashboard(res.name, 0);
            chrome.runtime.sendMessage({ action: 'login_success' });
            refreshUserProfile(email);
        } else {
            errorMsg.innerText = res.error || "Datos incorrectos";
            errorMsg.style.display = 'block';
        }
    } catch (e) { 
        console.error("Login fail:", e);
        errorMsg.innerText = "Error: " + e.message;
        errorMsg.style.display = 'block';
    }
    btn.disabled = false;
    btn.innerText = "ENTRAR";
}

function openPWA(cat) {
    let url = PWA_URL;
    if (cat) {
        if (cat.startsWith('#')) url = `${PWA_URL}/${cat}`;
        else url = `${PWA_URL}/#${cat}`;
    }
    chrome.tabs.create({ url: url });
}
