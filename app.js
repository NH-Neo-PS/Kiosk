const firebaseConfig = {
    apiKey: "AIzaSyDF2E3Z80yza8pw0YwptnDIZ2Q6CFg0WBg",
    authDomain: "kiosk-c85c3.firebaseapp.com",
    databaseURL: "https://kiosk-c85c3-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "kiosk-c85c3",
    storageBucket: "kiosk-c85c3.firebasestorage.app",
    messagingSenderId: "18714522275",
    appId: "1:18714522275:web:a24b2233661e52c6414516"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let currentUser = null;
let cart = [];
let products = [];
let employees = [];
let sales = [];
let allUsers = [];
let editingUserId = null;
let editingProductId = null;
let currentWeekView = null;

// === COOKIE FUNKTIONEN ===
function setCookie(name, value, days = 7) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${JSON.stringify(value)};${expires};path=/`;
}

function getCookie(name) {
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.indexOf(nameEQ) === 0) {
            return JSON.parse(cookie.substring(nameEQ.length));
        }
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
}

// === DOM ELEMENTE ===
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');

// === HILFSFUNKTION - USERNAME FORMATIEREN ===
function formatUsernameForId(fullName) {
    return fullName
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

function formatUsernameForStorage(fullName) {
    return fullName
        .trim()
        .toLowerCase()
        .split(' ')
        .join('_');
}

function formatNameShort(fullName) {
    const parts = fullName.trim().split(' ');
    if (parts.length === 2) {
        return `${parts[0]} ${parts[1].charAt(0)}.`;
    }
    return fullName;
}

// === LOGIN (MIT FIREBASE AUTH) ===
loginForm.addEventListener('submit', async (e) => {
e.preventDefault();
    // Automatisch alles klein schreiben und Leerzeichen zu Unterstrichen
    const usernameInput = document.getElementById('loginUsername').value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_');  // Leerzeichen zu _
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = '';
    
    // Input-Feld automatisch aktualisieren (visuelles Feedback)
    document.getElementById('loginUsername').value = usernameInput;
    
    try {
        // 1. Suche User mit diesem username in der Datenbank
        let foundUserId = null;
        const usersSnapshot = await database.ref('users').once('value');
        
        usersSnapshot.forEach((child) => {
            const user = child.val();
            if (user.username === usernameInput) {
                foundUserId = child.key;
            }
        });
        
        if (!foundUserId) {
            errorDiv.textContent = 'Benutzer nicht gefunden!';
            return;
        }
        
        // 2. Hole die Benutzerdaten mit der ID
        const userRef = database.ref(`users/${foundUserId}`);
        const snapshot = await userRef.once('value');
        const user = snapshot.val();
        
        if (user.suspended) {
            errorDiv.textContent = 'Dein Account wurde suspendiert!';
            return;
        }
        
        if (user.password !== password) {
            errorDiv.textContent = 'Passwort falsch!';
            return;
        }
        
        // 3. Login erfolgreich - speichere nur lokal
        currentUser = {
            id: foundUserId,
            username: user.username,
            name: user.name,
            role: user.role,
            createdAt: user.createdAt,
            lastLogin: Date.now()
        };
        
        setCookie('currentUser', currentUser, 7);
        
        // Update lastLogin in DB
        await database.ref(`users/${foundUserId}`).update({
            lastLogin: Date.now()
        }).catch(() => {});
        
        loginScreen.style.display = 'none';
        mainApp.style.display = 'flex';
        updateUserInfo();
        loadData();
        updateUIForRole();
        checkDienstplan();
        initSettings();
        setupWeeklyDienstplan();
        
    } catch (error) {
        console.error('Login Fehler:', error);
        errorDiv.textContent = 'Fehler beim Login: ' + error.message;
    }
});

logoutBtn.addEventListener('click', async () => {
    currentUser = null;
    deleteCookie('currentUser');
    loginScreen.style.display = 'flex';
    mainApp.style.display = 'none';
    loginForm.reset();
    document.getElementById('loginError').textContent = '';
});

window.addEventListener('load', () => {
    const savedUser = getCookie('currentUser');
    if (savedUser) {
        currentUser = savedUser;
        loginScreen.style.display = 'none';
        mainApp.style.display = 'flex';
        updateUserInfo();
        loadData();
        updateUIForRole();
        checkDienstplan();
        initSettings();
        setupWeeklyDienstplan();
    }
});

// === DIENSTPLAN CHECK ===
function checkDienstplan() {
    const now = new Date();
    const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const today = dayNames[now.getDay()];
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour + minute / 60;
    
    database.ref('dienstplan').once('value', (snapshot) => {
        const dienstplan = snapshot.val();
        const kassaNav = document.getElementById('navKasse');
        
        console.log("Heute ist:", today); // Debug
        console.log("Dienstplan:", dienstplan); // Debug
        console.log("User ID:", currentUser.id); // Debug
        
        if (dienstplan && dienstplan[today]) {
            const dayPlan = dienstplan[today];
            const userSchedule = dayPlan[currentUser.id];
            
            console.log("User Schedule:", userSchedule); // Debug
            
            if (userSchedule) {
                const startHour = parseInt(userSchedule.start.split(':')[0]);
                const startMin = parseInt(userSchedule.start.split(':')[1]);
                const startTime = startHour + startMin / 60;
                
                const endHour = parseInt(userSchedule.end.split(':')[0]);
                const endMin = parseInt(userSchedule.end.split(':')[1]);
                const endTime = endHour + endMin / 60;
                
                console.log("Aktuelle Zeit:", currentTime); // Debug
                console.log("Dienst von:", startTime, "bis:", endTime); // Debug
                
                // DEBUG: Immer anzeigen für Testzwecke
                console.log("DEBUG: Zeige Kasse für Mitschüler mit Dienst");
                kassaNav.style.display = 'flex';
                
                if (currentTime >= startTime && currentTime < endTime) {
                    console.log("✅ Mitschüler hat aktuell Dienst");
                } else {
                    console.log("⚠️ Mitschüler hat keinen Dienst (außerhalb der Zeit)");
                }
                
            } else {
                console.log("❌ Kein Dienstplan für diesen User gefunden");
                kassaNav.style.display = 'none';
                alert('⏰ Du hast heute keinen Dienst eingetragen!');
            }
        } else {
            console.log("❌ Kein Dienstplan für heute gefunden");
            kassaNav.style.display = 'none';
            alert('⏰ Für heute ist kein Dienstplan vorhanden!');
        }
    }).catch(error => {
        console.error("Fehler beim Laden des Dienstplans:", error);
        // Im Fehlerfall Kasse anzeigen für Debugging
        kassaNav.style.display = 'flex';
    });
}

// === UI FUNKTIONEN ===
function updateUserInfo() {
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = formatRole(currentUser.role);
}

function updateUIForRole() {
    const navProdukte = document.getElementById('navProdukte');
    const navMitarbeiter = document.getElementById('navMitarbeiter');
    const navBenutzerverwaltung = document.getElementById('navBenutzerverwaltung');
    const navDienstplan = document.getElementById('navDienstplan');
    const navDatenbank = document.getElementById('navDatenbank');
    
    const role = normalizeRole(currentUser.role);
    
    // Für Mitschüler: NUR Kasse und Dienstplan (falls vorhanden)
    if (role === 'mitschueler') {
        navProdukte.style.display = 'none';
        navMitarbeiter.style.display = 'none';
        navBenutzerverwaltung.style.display = 'none';
        navDatenbank.style.display = 'none';
        navDienstplan.style.display = 'flex'; // Mitschüler können ihren Dienstplan sehen
    } 
    // Für IT/Admin: Alles
    else if (role === 'it' || role === 'admin') {
        navProdukte.style.display = 'flex';
        navMitarbeiter.style.display = 'flex';
        navBenutzerverwaltung.style.display = 'flex';
        navDienstplan.style.display = 'flex';
        navDatenbank.style.display = 'flex';
    }

    // Dienstplan-Formular nur für Admin/IT
    const dienstplanFormSection = document.getElementById('dienstplanFormSection');
    if (dienstplanFormSection) {
        if (role === 'admin' || role === 'it') {
            dienstplanFormSection.style.display = 'block';
        } else {
            dienstplanFormSection.style.display = 'none';
        }
    }
}

// Navigation zwischen Views
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.getAttribute('data-view');
        
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(view + 'View').classList.add('active');
        
        if (view === 'kasse') renderProducts();
        if (view === 'produkte') renderProductsList();
        if (view === 'mitarbeiter') renderEmployees();
        if (view === 'benutzerverwaltung') renderUsersList();
        if (view === 'dienstplan') renderDienstplan();
        if (view === 'protokoll') renderSalesLogs();
        if (view === 'dashboard') updateDashboard();
        if (view === 'datenbank') renderDatenbankView();
    });
});

// === HILFSFUNKTION FÜR ROLLENFORMATIERUNG ===
function formatRole(role) {
    const roleMap = {
        'mitschueler': 'Mitschüler',
        'it': 'IT',
        'admin': 'Admin'
    };
    return roleMap[role?.toLowerCase()] || role;
}

function normalizeRole(role) {
    return role?.toLowerCase() || '';
}

// === DATEN LADEN ===
function loadData() {
    database.ref('products').on('value', (snapshot) => {
        products = [];
        snapshot.forEach((child) => {
            products.push({
                id: child.key,
                ...child.val()
            });
        });
        renderProducts();
        renderProductsList();
        if (document.getElementById('datenbankView').classList.contains('active')) {
            renderDatenbankView();
        }
    });
    
    database.ref('users').on('value', (snapshot) => {
        allUsers = [];
        employees = [];
        snapshot.forEach((child) => {
            const user = child.val();
            allUsers.push({
                id: child.key,
                ...user
            });
            if (normalizeRole(user.role) !== 'admin' && !user.suspended) {
                employees.push({
                    id: child.key,
                    ...user
                });
            }
        });
        
        // Update Employee Dropdown
        const select = document.getElementById('dienstplanEmployee');
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Mitarbeiter auswählen</option>';
            employees.forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp.id;
                opt.textContent = emp.name;
                select.appendChild(opt);
            });
            if (currentValue) select.value = currentValue;
        }
        
        // Update Weekly Form Dropdown
        const weeklySelect = document.getElementById('weeklyEmployee');
        if (weeklySelect) {
            weeklySelect.innerHTML = '<option value="">Mitarbeiter auswählen</option>';
            employees.forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp.id;
                opt.textContent = emp.name;
                weeklySelect.appendChild(opt);
            });
        }
        
        renderEmployees();
        renderUsersList();
        if (document.getElementById('datenbankView').classList.contains('active')) {
            renderDatenbankView();
        }
    });
    
    database.ref('sales').limitToLast(100).on('value', (snapshot) => {
        sales = [];
        snapshot.forEach((child) => {
            sales.push({
                id: child.key,
                ...child.val()
            });
        });
        sales.reverse();
        renderSalesLogs();
        updateDashboard();
        if (document.getElementById('datenbankView').classList.contains('active')) {
            renderDatenbankView();
        }
    });
}

// === PROTOKOLL MIT FILTER ===
function renderSalesLogs() {
    const container = document.getElementById('salesLogs');
    if (!container) return;
    
    const filterType = document.getElementById('filterType')?.value || 'all';
    const filterDate = document.getElementById('filterDate')?.value || '';
    
    let filteredLogs = sales;
    
    if (filterType !== 'all') {
        filteredLogs = filteredLogs.filter(sale => sale.type === filterType);
    }
    
    if (filterDate) {
        const selectedDate = new Date(filterDate).setHours(0, 0, 0, 0);
        filteredLogs = filteredLogs.filter(sale => {
            const saleDate = new Date(sale.date || sale.timestamp).setHours(0, 0, 0, 0);
            return saleDate === selectedDate;
        });
    }
    
    container.innerHTML = '';
    if (filteredLogs.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">Keine Einträge gefunden</p>';
        return;
    }
    
    filteredLogs.forEach(sale => {
        container.innerHTML += createLogItem(sale);
    });
}

document.getElementById('filterType')?.addEventListener('change', renderSalesLogs);
document.getElementById('filterDate')?.addEventListener('change', renderSalesLogs);

function createLogItem(sale) {
    const date = new Date(sale.date || sale.timestamp);
    const formattedDate = date.toLocaleString('de-DE');
    const total = sale.total || 0;
    const change = sale.change ? `(Wechsel: ${sale.change.toFixed(2)}€)` : '';
    
    return `
        <div class="log-item">
            <div class="log-date">${formattedDate}</div>
            <div>
                <div class="log-type">${sale.type || 'Verkauf'}</div>
                <div style="font-size: 14px; color: #9ca3af;">Mitarbeiter: ${sale.employee || 'Unbekannt'}</div>
            </div>
            <div class="log-amount">${total.toFixed(2)}€ ${change}</div>
        </div>
    `;
}

// === BENUTZERVERWALTUNG ===
document.getElementById('addUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userRole = normalizeRole(currentUser.role);
    
    if (userRole !== 'admin' && userRole !== 'it') {
        alert('Nur Admins können neue Benutzer erstellen!');
        return;
    }
    
    const fullName = document.getElementById('newName').value.trim();
    const password = document.getElementById('newPassword').value;
    const role = normalizeRole(document.getElementById('newUserRole').value);
    
    const userId = formatUsernameForId(fullName);
    const username = formatUsernameForStorage(fullName);
    const nameShort = formatNameShort(fullName);
    
    if (!fullName || !password || !role) {
        alert('Bitte alle Felder ausfüllen!');
        return;
    }
    
    try {
        const userRef = database.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        
        if (snapshot.exists()) {
            alert('Benutzer existiert bereits!');
            return;
        }
        
        if (editingUserId) {
            await userRef.update({
                password: password,
                name: nameShort,
                role: role,
                updatedAt: Date.now(),
                updatedBy: currentUser.id
            });
            alert('Benutzer aktualisiert!');
            editingUserId = null;
            document.querySelector('#addUserForm .btn').textContent = 'Erstellen';
            document.getElementById('newName').disabled = false;
        } else {
            await userRef.set({
                username: username,
                password: password,
                name: nameShort,
                role: role,
                suspended: false,
                createdAt: Date.now(),
                createdBy: currentUser.id
            });
            alert('Benutzer erfolgreich erstellt!');
        }
        
        e.target.reset();
    } catch (error) {
        alert('Fehler: ' + error.message);
    }
});

function renderUsersList() {
    const list = document.getElementById('usersList');
    list.innerHTML = '';
    
    const userRole = normalizeRole(currentUser.role);
    
    allUsers.forEach(user => {
        const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
        const card = document.createElement('div');
        card.className = 'user-item';
        
        const suspendedText = user.suspended ? '⛔ SUSPENDIERT' : '✓ Aktiv';
        const suspendedStyle = user.suspended ? 'color: var(--accent-red);' : 'color: var(--accent-green);';
        
        card.innerHTML = `
            <div class="user-avatar-small">${initials}</div>
            <div class="user-info-item">
                <div class="user-username">${user.name}</div>
                <div class="user-name-small">@${user.username}</div>
                <div class="user-role-badge">${formatRole(user.role)}</div>
            </div>
            <div style="${suspendedStyle}; font-weight: 600;">${suspendedText}</div>
            <div class="user-actions">
                ${userRole === 'admin' || userRole === 'it' ? `
                    <button class="icon-btn edit" onclick="editUser('${user.id}')">✏️</button>
                    <button class="icon-btn delete" onclick="deleteUser('${user.id}')">🗑️</button>
                ` : ''}
            </div>
        `;
        list.appendChild(card);
    });
}

function editUser(userId) {
    const userRole = normalizeRole(currentUser.role);
    if (userRole !== 'admin' && userRole !== 'it') {
        alert('Nur Admins können Benutzer bearbeiten!');
        return;
    }
    
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    editingUserId = userId;
    document.getElementById('newName').value = user.name;
    document.getElementById('newName').disabled = true;
    document.getElementById('newPassword').value = user.password;
    document.getElementById('newUserRole').value = normalizeRole(user.role);
    document.querySelector('#addUserForm .btn').textContent = 'Aktualisieren';
    
    document.getElementById('addUserForm').scrollIntoView({ behavior: 'smooth' });
}

async function deleteUser(userId) {
    const userRole = normalizeRole(currentUser.role);
    if (userRole !== 'admin' && userRole !== 'it') {
        alert('Nur Admins können Benutzer löschen!');
        return;
    }
    
    if (userId === currentUser.id) {
        alert('Du kannst dich selbst nicht löschen!');
        return;
    }
    
    if (confirm('Benutzer wirklich löschen?')) {
        try {
            await database.ref(`users/${userId}`).remove();
            alert('Benutzer gelöscht!');
            editingUserId = null;
            document.querySelector('#addUserForm .btn').textContent = 'Erstellen';
            document.getElementById('newName').disabled = false;
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    }
}

// === WÖCHENTLICHER DIENSTPLAN ===
function setupWeeklyDienstplan() {
    const form = document.getElementById('dienstplanForm');
    if (!form) return;
    
    form.style.display = 'none';
    
    const container = document.createElement('div');
    container.id = 'weeklyDienstplanForm';
    container.innerHTML = `
        <h3>Wöchentlichen Dienstplan erstellen</h3>
        <div class="week-form-grid">
            <div class="day-checkbox-group">
                <input type="checkbox" id="dayMontag" value="Montag">
                <label for="dayMontag">Montag</label>
            </div>
            <div class="day-checkbox-group">
                <input type="checkbox" id="dayDienstag" value="Dienstag">
                <label for="dayDienstag">Dienstag</label>
            </div>
            <div class="day-checkbox-group">
                <input type="checkbox" id="dayMittwoch" value="Mittwoch">
                <label for="dayMittwoch">Mittwoch</label>
            </div>
            <div class="day-checkbox-group">
                <input type="checkbox" id="dayDonnerstag" value="Donnerstag">
                <label for="dayDonnerstag">Donnerstag</label>
            </div>
            <div class="day-checkbox-group">
                <input type="checkbox" id="dayFreitag" value="Freitag">
                <label for="dayFreitag">Freitag</label>
            </div>
            <div class="day-checkbox-group">
                <input type="checkbox" id="daySamstag" value="Samstag">
                <label for="daySamstag">Samstag</label>
            </div>
        </div>
        
        <div style="margin: 20px 0;">
            <label>Mitarbeiter auswählen:</label>
            <select id="weeklyEmployee" style="width: 100%; padding: 12px; margin-top: 8px;">
                <option value="">Mitarbeiter auswählen</option>
            </select>
        </div>
        
        <div style="margin: 20px 0;">
            <label>Zeiten:</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px;">
                <input type="time" id="weeklyStart" value="07:00">
                <input type="time" id="weeklyEnd" value="14:00">
            </div>
        </div>
        
        <div style="margin: 20px 0;">
            <label>Zusätzliche Info (optional):</label>
            <input type="text" id="weeklyInfo" placeholder="z.B. Freitag: Auslieferung" style="width: 100%; padding: 12px; margin-top: 8px;">
        </div>
        
        <div class="quick-schedule-options">
            <button type="button" class="quick-option-btn" onclick="applyStandardWeek()">
                Ganze Woche (Mo-Fr)
            </button>
            <button type="button" class="quick-option-btn" onclick="applyWeekendOnly()">
                Wochenende (Sa)
            </button>
            <button type="button" class="quick-option-btn" onclick="clearAllDays()">
                Alle abwählen
            </button>
        </div>
        
        <button type="button" class="btn btn-primary" onclick="saveWeeklyDienstplan()" style="margin-top: 20px;">
            🗓️ Für gewählte Tage speichern
        </button>
    `;
    
    form.parentNode.appendChild(container);
    
    const select = document.getElementById('weeklyEmployee');
    select.innerHTML = '<option value="">Mitarbeiter auswählen</option>';
    employees.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id;
        opt.textContent = emp.name;
        select.appendChild(opt);
    });
}

function applyStandardWeek() {
    document.getElementById('dayMontag').checked = true;
    document.getElementById('dayDienstag').checked = true;
    document.getElementById('dayMittwoch').checked = true;
    document.getElementById('dayDonnerstag').checked = true;
    document.getElementById('dayFreitag').checked = true;
    document.getElementById('daySamstag').checked = false;
}

function applyWeekendOnly() {
    clearAllDays();
    document.getElementById('daySamstag').checked = true;
}

function clearAllDays() {
    document.getElementById('dayMontag').checked = false;
    document.getElementById('dayDienstag').checked = false;
    document.getElementById('dayMittwoch').checked = false;
    document.getElementById('dayDonnerstag').checked = false;
    document.getElementById('dayFreitag').checked = false;
    document.getElementById('daySamstag').checked = false;
}

async function saveWeeklyDienstplan() {
    const employeeId = document.getElementById('weeklyEmployee').value;
    const startTime = document.getElementById('weeklyStart').value;
    const endTime = document.getElementById('weeklyEnd').value;
    const info = document.getElementById('weeklyInfo').value.trim();
    
    if (!employeeId || !startTime || !endTime) {
        alert('Bitte alle Pflichtfelder ausfüllen!');
        return;
    }
    
    const days = [];
    if (document.getElementById('dayMontag').checked) days.push('Montag');
    if (document.getElementById('dayDienstag').checked) days.push('Dienstag');
    if (document.getElementById('dayMittwoch').checked) days.push('Mittwoch');
    if (document.getElementById('dayDonnerstag').checked) days.push('Donnerstag');
    if (document.getElementById('dayFreitag').checked) days.push('Freitag');
    if (document.getElementById('daySamstag').checked) days.push('Samstag');
    
    if (days.length === 0) {
        alert('Bitte mindestens einen Tag auswählen!');
        return;
    }
    
    try {
        const updates = {};
        const employeeName = employees.find(e => e.id === employeeId)?.name || employeeId;
        
        days.forEach(day => {
            const scheduleData = {
                start: startTime,
                end: endTime,
                assignedBy: currentUser.id,
                assignedAt: Date.now(),
                employeeName: employeeName
            };
            
            if (info) {
                scheduleData.info = info;
            }
            
            updates[`dienstplan/${day}/${employeeId}`] = scheduleData;
        });
        
        await database.ref().update(updates);
        
        let message = `✅ Dienstplan für ${days.length} Tage gespeichert!\n\n`;
        message += `Mitarbeiter: ${employeeName}\n`;
        message += `Zeiten: ${startTime} - ${endTime} Uhr\n`;
        if (info) message += `Info: ${info}\n\n`;
        message += `Tage: ${days.join(', ')}`;
        
        alert(message);
        renderDienstplan();
    } catch (error) {
        alert('Fehler: ' + error.message);
    }
}

// === DIENSTPLAN ANZEIGEN ===
async function renderDienstplan() {
    const list = document.getElementById('dienstplanList');
    if (!list) return;
    
    const userRole = normalizeRole(currentUser.role);
    
    database.ref('dienstplan').once('value', async (snapshot) => {
        const dienstplan = snapshot.val() || {};
        list.innerHTML = '';
        
        if (Object.keys(dienstplan).length === 0) {
            list.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">Kein Dienstplan vorhanden</p>';
            return;
        }
        
        // Aktuelle Woche anzeigen
        const now = new Date();
        const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
        const today = dayNames[now.getDay()];
        
        // Wochentage in richtiger Reihenfolge
        const orderedDays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
        
        // Für Mitschüler: Zeige nur Tage, an denen sie Dienst haben
        if (userRole === 'mitschueler') {
            let hasAnyShift = false;
            
            orderedDays.forEach(day => {
                if (dienstplan[day] && dienstplan[day][currentUser.id]) {
                    hasAnyShift = true;
                    const schedule = dienstplan[day][currentUser.id];
                    const dayDiv = document.createElement('div');
                    dayDiv.className = 'dienstplan-item';
                    dayDiv.style.borderLeft = day === today ? '4px solid var(--accent-green)' : '4px solid var(--accent-blue)';
                    
                    let infoHtml = '';
                    if (schedule.info) {
                        infoHtml = `<div style="color: var(--text-secondary); font-size: 14px; margin-top: 4px;">📝 ${schedule.info}</div>`;
                    }
                    
                    dayDiv.innerHTML = `
                        <div>
                            <div style="font-weight: 700;">${day} ${day === today ? '(Heute)' : ''}</div>
                            <div style="font-size: 18px; font-weight: 600;">${schedule.start} - ${schedule.end}</div>
                            ${infoHtml}
                        </div>
                        <div style="font-size: 14px; color: var(--text-secondary);">
                            Dein Dienst
                        </div>
                    `;
                    list.appendChild(dayDiv);
                }
            });
            
            if (!hasAnyShift) {
                list.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">Du hast keine Dienste in dieser Woche eingetragen</p>';
            }
            
            // Zeige wer noch mit dir Dienst hat
            renderSharedShifts(dienstplan);
            
        } else {
            // Für Admin/IT: Zeige alles
            orderedDays.forEach(day => {
                if (dienstplan[day]) {
                    const dayDiv = document.createElement('div');
                    dayDiv.className = 'dienstplan-day';
                    dayDiv.style.marginBottom = '24px';
                    
                    const header = document.createElement('div');
                    header.className = 'dienstplan-day-header';
                    header.textContent = `${day} ${day === today ? '(Heute)' : ''}`;
                    dayDiv.appendChild(header);
                    
                    const content = document.createElement('div');
                    content.className = 'dienstplan-day-content';
                    
                    Object.entries(dienstplan[day]).forEach(([employeeId, schedule]) => {
                        const employee = allUsers.find(u => u.id === employeeId);
                        if (!employee) return;
                        
                        const entryDiv = document.createElement('div');
                        entryDiv.className = 'dienstplan-entry';
                        
                        let infoHtml = '';
                        if (schedule.info) {
                            infoHtml = `<div style="color: var(--text-secondary); font-size: 12px; margin-top: 2px;">📝 ${schedule.info}</div>`;
                        }
                        
                        entryDiv.innerHTML = `
                            <div>
                                <div class="dienstplan-worker-name">${employee.name}</div>
                                <div class="dienstplan-time">${schedule.start} - ${schedule.end}</div>
                                ${infoHtml}
                            </div>
                            <div>
                                <button class="icon-btn delete" onclick="deleteDienstplan('${day}', '${employeeId}')">🗑️</button>
                            </div>
                        `;
                        content.appendChild(entryDiv);
                    });
                    
                    dayDiv.appendChild(content);
                    list.appendChild(dayDiv);
                }
            });
        }
    });
}

// Zeige wer noch mit dir Dienst hat (für Mitschüler)
function renderSharedShifts(dienstplan) {
    const now = new Date();
    const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const today = dayNames[now.getDay()];
    
    let sharedShifts = [];
    Object.entries(dienstplan).forEach(([day, workers]) => {
        if (workers[currentUser.id]) {
            Object.entries(workers).forEach(([employeeId, schedule]) => {
                if (employeeId !== currentUser.id) {
                    const employee = allUsers.find(u => u.id === employeeId);
                    if (employee) {
                        sharedShifts.push({
                            day: day,
                            employee: employee.name,
                            start: schedule.start,
                            end: schedule.end,
                            isToday: day === today
                        });
                    }
                }
            });
        }
    });
    
    if (sharedShifts.length > 0) {
        const sharedDiv = document.createElement('div');
        sharedDiv.className = 'employee-shift-info';
        sharedDiv.innerHTML = '<h4 style="margin-bottom: 12px;">👥 Kollegen mit denen du Dienst hast:</h4>';
        
        const listDiv = document.createElement('div');
        listDiv.className = 'shift-employee-list';
        
        sharedShifts.forEach(shift => {
            const card = document.createElement('div');
            card.className = 'shift-employee-card';
            card.innerHTML = `
                <div class="shift-employee-avatar">${shift.employee.split(' ').map(n => n[0]).join('').toUpperCase()}</div>
                <div>
                    <div style="font-weight: 600;">${shift.employee}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        ${shift.day} ${shift.isToday ? ' (Heute)' : ''}<br>
                        ${shift.start} - ${shift.end}
                    </div>
                </div>
            `;
            listDiv.appendChild(card);
        });
        
        sharedDiv.appendChild(listDiv);
        document.getElementById('dienstplanList').appendChild(sharedDiv);
    }
}

async function deleteDienstplan(day, employee) {
    if (confirm('Dienstplan-Eintrag löschen?')) {
        try {
            await database.ref(`dienstplan/${day}/${employee}`).remove();
            renderDienstplan();
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    }
}

// === KASSE ===
function renderProducts() {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = '';
    
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-name">${product.name}</div>
            <div class="product-price">${product.price.toFixed(2)}€</div>
            <div class="product-stock ${product.stock < 10 ? 'low' : ''}">
                Lager: ${product.stock}
            </div>
        `;
        card.addEventListener('click', () => {
            addToCart(product);
            playSound();
        });
        grid.appendChild(card);
    });
}

function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        if (existingItem.quantity < product.stock) {
            existingItem.quantity++;
        } else {
            alert('Nicht genug Lagerbestand!');
            return;
        }
    } else {
        if (product.stock > 0) {
            cart.push({ ...product, quantity: 1 });
        } else {
            alert('Produkt nicht auf Lager!');
            return;
        }
    }
    
    renderCart();
}

function renderCart() {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    
    cartItems.innerHTML = '';
    let total = 0;
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div>${item.price.toFixed(2)}€ × ${item.quantity} = ${itemTotal.toFixed(2)}€</div>
            </div>
            <div class="cart-item-controls">
                <button class="qty-btn" onclick="updateCartQuantity('${item.id}', -1)">-</button>
                <span>${item.quantity}</span>
                <button class="qty-btn" onclick="updateCartQuantity('${item.id}', 1)">+</button>
                <button class="remove-btn" onclick="removeFromCart('${item.id}')">🗑️</button>
            </div>
        `;
        cartItems.appendChild(cartItem);
    });
    
    cartTotal.textContent = total.toFixed(2) + '€'; // ✅ € Symbol hinzufügen
}

function updateCartQuantity(productId, change) {
    const item = cart.find(i => i.id === productId);
    const product = products.find(p => p.id === productId);
    
    if (item) {
        const newQuantity = item.quantity + change;
        
        if (newQuantity > 0 && newQuantity <= product.stock) {
            item.quantity = newQuantity;
        } else if (newQuantity <= 0) {
            removeFromCart(productId);
            return;
        } else {
            alert('Nicht genug Lagerbestand!');
            return;
        }
    }
    
    renderCart();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    renderCart();
}

document.getElementById('completeSaleBtn').addEventListener('click', async () => {
    if (cart.length === 0) {
        alert('Warenkorb ist leer!');
        return;
    }
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Zahlungsbereich anzeigen
    document.getElementById('paymentSection').style.display = 'block';
    document.getElementById('completeSaleBtn').style.display = 'none';
    document.getElementById('paymentTotal').textContent = total.toFixed(2) + '€';
    document.getElementById('paymentInput').value = total.toFixed(2);
    document.getElementById('paymentInput').focus();
    
    // Live Wechselgeld berechnung
    document.getElementById('paymentInput').addEventListener('input', (e) => {
        const paid = parseFloat(e.target.value) || 0;
        const change = Math.max(0, paid - total);
        document.getElementById('changeAmount').textContent = change.toFixed(2) + '€';
        
        if (paid >= total) {
            document.getElementById('changeAmount').style.color = 'var(--accent-green)';
        } else {
            document.getElementById('changeAmount').style.color = 'var(--accent-red)';
        }
    });
});

document.getElementById('confirmPaymentBtn')?.addEventListener('click', async () => {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const paid = parseFloat(document.getElementById('paymentInput').value) || 0;
    
    if (isNaN(paid) || paid < total) {
        alert(`Nicht genug! Es fehlen noch ${(total - paid).toFixed(2)}€`);
        return;
    }
    
    const change = (paid - total).toFixed(2);
    
    try {
        const saleRef = database.ref('sales').push();
        await saleRef.set({
            date: new Date().toISOString(),
            timestamp: Date.now(),
            employee: currentUser.name,
            employeeId: currentUser.id,
            items: cart,
            total: total,
            paid: paid,
            change: parseFloat(change),
            type: 'Verkauf'
        });
        
        const updates = {};
        cart.forEach(item => {
            const product = products.find(p => p.id === item.id);
            updates[`products/${item.id}/stock`] = product.stock - item.quantity;
        });
        
        await database.ref().update(updates);
        
        document.getElementById('paymentSection').style.display = 'none';
        document.getElementById('completeSaleBtn').style.display = 'width: 100%';
        document.getElementById('paymentInput').value = '';
        
        alert(`✅ Verkauf erfolgreich!\n\nGesamt: ${total.toFixed(2)}€\nBezahlt: ${paid.toFixed(2)}€\nWechselgeld: ${change}€`);
        cart = [];
        renderCart();
    } catch (error) {
        alert('Fehler beim Speichern: ' + error.message);
    }
});

document.getElementById('cancelPaymentBtn')?.addEventListener('click', () => {
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('completeSaleBtn').style.display = 'width: 100%';
});

// === SOUND FUNKTION ===
function playSound() {
    const audio = new Audio('sound.mp3');
    audio.volume = 0.3;
    audio.play().catch(err => console.log('Sound konnte nicht abgespielt werden'));
}

// === PRODUKTVERWALTUNG ===
document.getElementById('addProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (normalizeRole(currentUser.role) === 'mitschueler') {
        alert('Keine Berechtigung!');
        return;
    }
    
    const productData = {
        name: document.getElementById('productName').value,
        price: parseFloat(document.getElementById('productPrice').value),
        stock: parseInt(document.getElementById('productStock').value),
        category: document.getElementById('productCategory').value
    };
    
    try {
        if (editingProductId) {
            await database.ref('products/' + editingProductId).update(productData);
            alert('Produkt aktualisiert!');
            editingProductId = null;
            document.querySelector('#addProductForm .btn').textContent = 'Hinzufügen';
        } else {
            await database.ref('products').push({
                ...productData,
                createdAt: Date.now(),
                createdBy: currentUser.id
            });
            alert('Produkt hinzugefügt!');
        }
        e.target.reset();
    } catch (error) {
        alert('Fehler: ' + error.message);
    }
});

function renderProductsList() {
    const list = document.getElementById('productsList');
    list.innerHTML = '';
    
    products.forEach(product => {
        const item = document.createElement('div');
        item.className = 'product-item';
        item.innerHTML = `
            <div>${product.name}</div>
            <div>${product.price.toFixed(2)}€</div>
            <div>Lager: ${product.stock}</div>
            <div>${product.category}</div>
            <div class="product-actions">
                <button class="icon-btn edit" onclick="editProduct('${product.id}')">✏️</button>
                <button class="icon-btn delete" onclick="deleteProduct('${product.id}')">🗑️</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function editProduct(productId) {
    if (normalizeRole(currentUser.role) === 'mitschueler') {
        alert('Keine Berechtigung!');
        return;
    }
    
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    editingProductId = productId;
    document.getElementById('productName').value = product.name;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productStock').value = product.stock;
    document.getElementById('productCategory').value = product.category;
    document.querySelector('#addProductForm .btn').textContent = 'Aktualisieren';
    
    document.getElementById('addProductForm').scrollIntoView({ behavior: 'smooth' });
}

async function deleteProduct(productId) {
    if (normalizeRole(currentUser.role) === 'mitschueler') {
        alert('Keine Berechtigung!');
        return;
    }
    
    if (confirm('Produkt wirklich löschen?')) {
        try {
            await database.ref('products/' + productId).remove();
            alert('Produkt gelöscht!');
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    }
}

// === MITARBEITER ===
function renderEmployees() {
    const list = document.getElementById('employeesList');
    list.innerHTML = '';
    
    employees.forEach(employee => {
        const initials = employee.name.split(' ').map(n => n[0]).join('').toUpperCase();
        const card = document.createElement('div');
        card.className = 'employee-card';
        const suspendedText = employee.suspended ? '⛔ SUSPENDIERT' : '✓ Aktiv';
        const suspendedStyle = employee.suspended ? 'color: var(--accent-red); font-weight: 700;' : 'color: var(--accent-green);';
        
        card.innerHTML = `
            <div class="employee-avatar">${initials}</div>
            <div class="employee-info">
                <div class="employee-name">${employee.name}</div>
                <div class="employee-role">${formatRole(employee.role)}</div>
                <div style="color: #9ca3af; font-size: 14px;">@${employee.username}</div>
            </div>
            <div style="${suspendedStyle}">${suspendedText}</div>
        `;
        
        const userRole = normalizeRole(currentUser.role);
        if (userRole === 'admin' || userRole === 'it') {
            const actionBtn = document.createElement('button');
            actionBtn.className = 'icon-btn';
            actionBtn.style.background = employee.suspended ? 'var(--accent-green)' : 'var(--accent-red)';
            actionBtn.textContent = employee.suspended ? '✓' : '🚫';
            actionBtn.onclick = () => toggleEmployeeSuspend(employee.id, !employee.suspended);
            card.appendChild(actionBtn);
        }
        
        list.appendChild(card);
    });
}

async function toggleEmployeeSuspend(userId, suspend) {
    const userRole = normalizeRole(currentUser.role);
    if (userRole !== 'admin' && userRole !== 'it') {
        alert('Keine Berechtigung!');
        return;
    }
    
    const action = suspend ? 'suspendieren' : 'freischalten';
    if (confirm(`Mitarbeiter ${action}?`)) {
        try {
            await database.ref('users/' + userId).update({
                suspended: suspend
            });
            alert(`Mitarbeiter ${action === 'suspendieren' ? 'suspendiert' : 'freigeschalten'}!`);
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    }
}

// === DATENBANK VIEW ===
function renderDatenbankView() {
    const usersBody = document.getElementById('dbUsersBody');
    const productsBody = document.getElementById('dbProductsBody');
    const salesBody = document.getElementById('dbSalesBody');
    
    if (!usersBody || !productsBody || !salesBody) return;
    
    // Benutzer anzeigen
    usersBody.innerHTML = '';
    allUsers.forEach(user => {
        const row = document.createElement('tr');
        const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('de-DE') : '-';
        
        row.innerHTML = `
            <td><code style="font-size: 11px;">${user.id}</code></td>
            <td>${user.name}</td>
            <td>@${user.username}</td>
            <td><span class="user-role-badge">${formatRole(user.role)}</span></td>
            <td>${createdDate}</td>
            <td>${user.suspended ? '⛔ Suspended' : '✅ Aktiv'}</td>
            <td class="db-action-buttons">
                <button class="icon-btn edit" onclick="editUserFromDb('${user.id}')">✏️</button>
                <button class="icon-btn delete" onclick="deleteUser('${user.id}')">🗑️</button>
            </td>
        `;
        usersBody.appendChild(row);
    });
    
    // Produkte anzeigen
    productsBody.innerHTML = '';
    products.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><code style="font-size: 11px;">${product.id}</code></td>
            <td>${product.name}</td>
            <td>${product.price.toFixed(2)}€</td>
            <td>${product.stock}</td>
            <td>${product.category}</td>
            <td class="db-action-buttons">
                <button class="icon-btn edit" onclick="editProduct('${product.id}')">✏️</button>
                <button class="icon-btn delete" onclick="deleteProduct('${product.id}')">🗑️</button>
            </td>
        `;
        productsBody.appendChild(row);
    });
    
    // Verkäufe anzeigen
    salesBody.innerHTML = '';
    sales.slice(0, 50).forEach(sale => {
        const row = document.createElement('tr');
        const itemCount = sale.items ? sale.items.length : 0;
        const date = new Date(sale.date || sale.timestamp);
        const itemsPreview = sale.items ? sale.items.map(item => `${item.name} (${item.quantity}x)`).join(', ') : '-';
        
        row.innerHTML = `
            <td><code style="font-size: 11px;">${sale.id.substring(0, 8)}...</code></td>
            <td>${date.toLocaleDateString('de-DE')}<br><small>${date.toLocaleTimeString('de-DE')}</small></td>
            <td>${sale.employee || 'Unbekannt'}</td>
            <td>${sale.total?.toFixed(2)}€</td>
            <td><small>${itemsPreview.substring(0, 50)}${itemsPreview.length > 50 ? '...' : ''}</small></td>
            <td class="db-action-buttons">
                <button class="icon-btn" onclick="viewSaleDetails('${sale.id}')">👁️</button>
                <button class="icon-btn delete" onclick="deleteSale('${sale.id}')">🗑️</button>
            </td>
        `;
        salesBody.appendChild(row);
    });
}

function editUserFromDb(userId) {
    editUser(userId);
    document.getElementById('benutzerverwaltungView').classList.add('active');
    document.getElementById('datenbankView').classList.remove('active');
    
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector('[data-view="benutzerverwaltung"]').classList.add('active');
}

function viewSaleDetails(saleId) {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;
    
    let details = `📋 Verkaufsdetails\n\n`;
    details += `ID: ${sale.id}\n`;
    details += `Datum: ${new Date(sale.date || sale.timestamp).toLocaleString('de-DE')}\n`;
    details += `Mitarbeiter: ${sale.employee}\n`;
    details += `Gesamt: ${sale.total?.toFixed(2)}€\n`;
    details += `Bezahlt: ${sale.paid?.toFixed(2)}€\n`;
    details += `Wechselgeld: ${sale.change?.toFixed(2)}€\n\n`;
    
    if (sale.items && sale.items.length > 0) {
        details += `Produkte:\n`;
        sale.items.forEach(item => {
            details += `• ${item.name}: ${item.quantity}x ${item.price.toFixed(2)}€ = ${(item.quantity * item.price).toFixed(2)}€\n`;
        });
    }
    
    alert(details);
}

async function deleteSale(saleId) {
    if (!confirm('Verkauf wirklich löschen?')) return;
    
    try {
        await database.ref(`sales/${saleId}`).remove();
        alert('Verkauf gelöscht!');
    } catch (error) {
        alert('Fehler: ' + error.message);
    }
}

// === DASHBOARD ===
function updateDashboard() {
    const today = new Date().setHours(0, 0, 0, 0);
    const todaySales = sales.filter(sale => {
        const saleDate = new Date(sale.date || sale.timestamp).setHours(0, 0, 0, 0);
        return saleDate === today;
    });
    
    const todayRevenue = todaySales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const employeeCount = employees.length;
    
    document.getElementById('statSales').textContent = todaySales.length;
    document.getElementById('statRevenue').textContent = todayRevenue.toFixed(2) + '€';
    document.getElementById('statTotalRevenue').textContent = totalRevenue.toFixed(2) + '€';
    document.getElementById('statEmployees').textContent = employeeCount;
    
    // Letzte Verkäufe
    const recentLogs = document.getElementById('recentLogs');
    if (recentLogs) {
        recentLogs.innerHTML = '';
        sales.slice(0, 10).forEach(sale => {
            recentLogs.innerHTML += createLogItem(sale);
        });
    }
}

// === EINSTELLUNGEN ===
function initSettings() {
    document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPassword = document.getElementById('oldPassword').value;
        const newPassword = document.getElementById('settingsNewPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (newPassword !== confirmPassword) {
            alert('Passwörter stimmen nicht überein!');
            return;
        }
        
        if (newPassword.length < 6) {
            alert('Passwort muss mindestens 6 Zeichen lang sein!');
            return;
        }
        
        try {
            const userSnapshot = await database.ref(`users/${currentUser.id}`).once('value');
            const user = userSnapshot.val();
            
            if (user.password !== oldPassword) {
                alert('Altes Passwort falsch!');
                return;
            }
            
            await database.ref(`users/${currentUser.id}`).update({
                password: newPassword
            });
            
            alert('✅ Passwort erfolgreich geändert!');
            document.getElementById('changePasswordForm').reset();
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    });
    
    document.getElementById('designSelect')?.addEventListener('change', (e) => {
        const design = e.target.value;
        localStorage.setItem('design', design);
        
        const customSection = document.getElementById('customColorsSection');
        if (design === 'custom' && customSection) {
            customSection.style.display = 'grid';
        } else if (customSection) {
            customSection.style.display = 'none';
        }
        
        applyDesign(design);
    });
    
    document.getElementById('customBackgroundColor')?.addEventListener('input', () => {
        applyDesign('custom');
    });
    document.getElementById('customTextColor')?.addEventListener('input', () => {
        applyDesign('custom');
    });
    
    document.getElementById('fontSelect')?.addEventListener('change', (e) => {
        const font = e.target.value;
        localStorage.setItem('fontSize', font);
        applyFontSize(font);
    });
}

function applyDesign(design) {
    const root = document.documentElement;
    
    if (design === 'dark') {
        root.style.setProperty('--bg-dark', '#111827');
        root.style.setProperty('--bg-secondary', '#1f2937');
        root.style.setProperty('--bg-tertiary', '#374151');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', '#9ca3af');
    } else if (design === 'light') {
        root.style.setProperty('--bg-dark', '#f9fafb');
        root.style.setProperty('--bg-secondary', '#f3f4f6');
        root.style.setProperty('--bg-tertiary', '#e5e7eb');
        root.style.setProperty('--text-primary', '#111827');
        root.style.setProperty('--text-secondary', '#6b7280');
    } else if (design === 'blue') {
        root.style.setProperty('--bg-dark', '#0f172a');
        root.style.setProperty('--bg-secondary', '#1e293b');
        root.style.setProperty('--bg-tertiary', '#334155');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', '#cbd5e1');
        root.style.setProperty('--accent-blue', '#0ea5e9');
        root.style.setProperty('--accent-blue-hover', '#0284c7');
    } else if (design === 'green') {
        root.style.setProperty('--bg-dark', '#051c15');
        root.style.setProperty('--bg-secondary', '#0d3d2c');
        root.style.setProperty('--bg-tertiary', '#1b4d3d');
        root.style.setProperty('--text-primary', '#f0fdf4');
        root.style.setProperty('--text-secondary', '#b0e0d0');
        root.style.setProperty('--accent-green', '#10b981');
    } else if (design === 'purple') {
        root.style.setProperty('--bg-dark', '#2d1b4e');
        root.style.setProperty('--bg-secondary', '#3d2463');
        root.style.setProperty('--bg-tertiary', '#4d2a7a');
        root.style.setProperty('--text-primary', '#faf5ff');
        root.style.setProperty('--text-secondary', '#e9d5ff');
        root.style.setProperty('--accent-blue', '#a855f7');
        root.style.setProperty('--accent-blue-hover', '#9333ea');
    } else if (design === 'orange') {
        root.style.setProperty('--bg-dark', '#431407');
        root.style.setProperty('--bg-secondary', '#5a2e1a');
        root.style.setProperty('--bg-tertiary', '#7c3a1d');
        root.style.setProperty('--text-primary', '#fef3c7');
        root.style.setProperty('--text-secondary', '#fdd699');
        root.style.setProperty('--accent-blue', '#f97316');
        root.style.setProperty('--accent-blue-hover', '#ea580c');
    } else if (design === 'custom') {
        const customBg = document.getElementById('customBackgroundColor')?.value || '#111827';
        const customText = document.getElementById('customTextColor')?.value || '#ffffff';
        root.style.setProperty('--bg-dark', customBg);
        root.style.setProperty('--bg-secondary', customBg);
        root.style.setProperty('--text-primary', customText);
    }
}

function applyFontSize(size) {
    const root = document.documentElement;
    
    if (size === 'small') {
        root.style.fontSize = '14px';
    } else if (size === 'normal') {
        root.style.fontSize = '16px';
    } else if (size === 'large') {
        root.style.fontSize = '18px';
    }
}

window.addEventListener('load', () => {
    const design = localStorage.getItem('design') || 'dark';
    const font = localStorage.getItem('fontSize') || 'normal';
    
    applyDesign(design);
    applyFontSize(font);
    
    if (document.getElementById('designSelect')) {
        document.getElementById('designSelect').value = design;
        
        const customSection = document.getElementById('customColorsSection');
        if (design === 'custom' && customSection) {
            customSection.style.display = 'grid';
        }
    }
    if (document.getElementById('fontSelect')) {
        document.getElementById('fontSelect').value = font;
    }
});
