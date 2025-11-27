// ⚠️ FIREBASE KONFIGURATION
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
let onlineUsers = {};
let editingProductId = null;

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
        .join('_');  // ✅ Unterstriche statt Punkte
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
    const usernameInput = document.getElementById('loginUsername').value.toLowerCase().split(' ').join('_');
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = '';
    
    try {
        // 1. Suche User mit diesem username in der Datenbank
        let foundUserId = null;
        const usersSnapshot = await database.ref('users').once('value');
        
        usersSnapshot.forEach((child) => {
            const user = child.val();
            // Vergleiche den gespeicherten username mit der Eingabe
            if (user.username === usernameInput) {
                foundUserId = child.key;  // Das ist die ID (MaxMueller)
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
            id: foundUserId,  // MaxMueller
            username: user.username,  // max_mueller
            name: user.name,
            role: user.role,
            createdAt: user.createdAt,
            lastLogin: Date.now()  // ✅ Timestamp lokal
        };
        
        setCookie('currentUser', currentUser, 7);
        
        // Update lastLogin in DB (optional)
        await database.ref(`users/${foundUserId}`).update({
            lastLogin: Date.now()
        }).catch(() => {});
        
        loginScreen.style.display = 'none';
        mainApp.style.display = 'flex';
        updateUserInfo();
        loadData();
        updateUIForRole();
        checkDienstplan();
        updateOnlineStatus();
        loadOnlineUsers();
        watchUserRoleChanges();
        initSettings();  // ✅ Einstellungen initialisieren
        
    } catch (error) {
        console.error('Login Fehler:', error);
        errorDiv.textContent = 'Fehler beim Login: ' + error.message;
    }
});

logoutBtn.addEventListener('click', async () => {
    if (currentUser) {
        database.ref(`onlineUsers/${currentUser.id}`).set({ online: false, lastSeen: Date.now() }).catch(() => {});
    }
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
        updateOnlineStatus();
        loadOnlineUsers();
        initSettings();  // ✅ Einstellungen initialisieren
    }
});

// === DIENSTPLAN CHECK ===
function checkDienstplan() {
    const now = new Date();
    const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const today = dayNames[now.getDay()];
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour + minute / 60;  // Aktuelle Uhrzeit als Dezimal
    
    database.ref('dienstplan').once('value', (snapshot) => {
        const dienstplan = snapshot.val();
        const kassaNav = document.getElementById('navKasse');
        let hasActiveShift = false;
        
        if (dienstplan && dienstplan[today]) {
            const dayPlan = dienstplan[today];
            const userSchedule = dayPlan[currentUser.id];
            
            if (userSchedule) {
                const startHour = parseInt(userSchedule.start.split(':')[0]);
                const startMin = parseInt(userSchedule.start.split(':')[1]);
                const startTime = startHour + startMin / 60;
                
                const endHour = parseInt(userSchedule.end.split(':')[0]);
                const endMin = parseInt(userSchedule.end.split(':')[1]);
                const endTime = endHour + endMin / 60;
                
                // ✅ Prüfe ob aktuelle Zeit im Dienst ist
                if (currentTime >= startTime && currentTime < endTime) {
                    kassaNav.style.display = 'flex';
                    hasActiveShift = true;
                } else {
                    kassaNav.style.display = 'none';
                    const minutesUntilShift = Math.round((startTime - currentTime) * 60);
                    alert(`⏰ Du hast momentan keinen Dienst!\nNächster Dienst: ${userSchedule.start} Uhr`);
                }
            } else {
                kassaNav.style.display = 'none';
                alert('⏰ Du hast heute keinen Dienst eingetragen!');
            }
        } else {
            kassaNav.style.display = 'none';
            alert('⏰ Für heute ist kein Dienstplan vorhanden!');
        }
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
    
    const role = currentUser.role;
    
    if (role === 'mitschueler') {
        navProdukte.style.display = 'none';
        navMitarbeiter.style.display = 'none';
        navBenutzerverwaltung.style.display = 'none';
        navDienstplan.style.display = 'flex';  // ✅ Mitschüler sehen Dienstplan
    } else if (role === 'it' || role === 'admin') {
        navProdukte.style.display = 'flex';
        navMitarbeiter.style.display = 'flex';
        navBenutzerverwaltung.style.display = 'flex';
        navDienstplan.style.display = 'flex';
    }

    const dienstplanFormSection = document.getElementById('dienstplanFormSection');
    if (dienstplanFormSection) {
        if (role === 'admin' || role === 'it') {  // ✅ Nur Admin/IT können bearbeiten
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
    });
});

// === PROTOKOLL MIT FILTER ===
function renderSalesLogs() {
    const container = document.getElementById('salesLogs');
    if (!container) return;
    
    const filterType = document.getElementById('filterType')?.value || 'all';
    const filterDate = document.getElementById('filterDate')?.value || '';
    
    let filteredLogs = sales;
    
    // Nach Typ filtern
    if (filterType !== 'all') {
        filteredLogs = filteredLogs.filter(sale => sale.type === filterType);
    }
    
    // Nach Datum filtern
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

// Event Listener für Filter
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
        
        // Update Employee Dropdown - verwende emp.id statt emp.username
        const select = document.getElementById('dienstplanEmployee');
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Mitarbeiter auswählen</option>';
            employees.forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp.id;  // ✅ Verwende emp.id (MaxMueller)
                opt.textContent = emp.name;
                select.appendChild(opt);
            });
            if (currentValue) select.value = currentValue;
        }
        
        renderEmployees();
        renderUsersList();
    });
    
    database.ref('sales').limitToLast(50).on('value', (snapshot) => {
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
    });
}

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

// === BENUTZERVERWALTUNG - NUR ADMIN ODER IT KANN ERSTELLEN ===
document.getElementById('addUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userRole = normalizeRole(currentUser.role);
    
    if (userRole !== 'admin' && userRole !== 'it') {  // ✅ IT eingeschlossen
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
            // Update
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
            // Create
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
                ${userRole === 'admin' || userRole === 'it' ? `  <!-- ✅ IT eingeschlossen -->
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
    if (userRole !== 'admin' && userRole !== 'it') {  // ✅ IT eingeschlossen
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
    if (userRole !== 'admin' && userRole !== 'it') {  // ✅ IT eingeschlossen
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

// === LIVE-UPDATE FÜR ROLLENÄNDERUNGEN ===
function watchUserRoleChanges() {
    if (!currentUser) return;
    
    database.ref(`users/${currentUser.id}`).on('value', (snapshot) => {
        const userData = snapshot.val();
        if (userData) {
            const oldRole = currentUser.role;
            currentUser.role = userData.role;  // ✅ Aktuelle Rolle speichern
            
            // Wenn Rolle geändert wurde
            if (userData.role !== oldRole) {
                setCookie('currentUser', currentUser, 7);
                updateUserInfo();
                updateUIForRole();
                loadData();
                alert(`✅ Deine Rolle wurde aktualisiert: ${formatRole(userData.role)}`);
            }
        }
    });
}

// === DIENSTPLAN ===
document.getElementById('dienstplanForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (normalizeRole(currentUser.role) !== 'admin' && normalizeRole(currentUser.role) !== 'it') {  // ✅ IT eingeschlossen
        alert('Keine Berechtigung!');
        return;
    }
    
    const day = document.getElementById('dienstplanDay').value;
    const employee = document.getElementById('dienstplanEmployee').value;  // ✅ Das ist jetzt die ID (MaxMueller)
    const start = document.getElementById('dienstplanStart').value;
    const end = document.getElementById('dienstplanEnd').value;
    
    if (!day || !employee || !start || !end) {
        alert('Bitte alle Felder ausfüllen!');
        return;
    }
    
    try {
        const planRef = database.ref(`dienstplan/${day}/${employee}`);  // ✅ Verwende employee (ID)
        await planRef.set({
            start: start,
            end: end
        });
        alert('Dienstplan aktualisiert!');
        document.getElementById('dienstplanForm').reset();
        renderDienstplan();
    } catch (error) {
        alert('Fehler: ' + error.message);
    }
});

function renderDienstplan() {
    const list = document.getElementById('dienstplanList');
    if (!list) return;
    
    const userRole = normalizeRole(currentUser.role);
    const isEditMode = userRole === 'admin' || userRole === 'it';  // ✅ Nur Admin/IT können bearbeiten
    
    database.ref('dienstplan').once('value', (snapshot) => {
        const dienstplan = snapshot.val() || {};
        list.innerHTML = '';
        
        if (Object.keys(dienstplan).length === 0) {
            list.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">Kein Dienstplan vorhanden</p>';
            return;
        }
        
        Object.entries(dienstplan).forEach(([day, workers]) => {
            const dayDiv = document.createElement('div');
            dayDiv.style.marginBottom = '20px';
            dayDiv.style.borderLeft = '4px solid var(--accent-blue)';
            dayDiv.style.paddingLeft = '16px';
            dayDiv.innerHTML = `<h4>${day}</h4>`;
            
            // ✅ Zeige nur den eigenen Dienst für Mitschüler
            if (userRole === 'mitschueler') {
                const userSchedule = workers[currentUser.id];
                if (userSchedule) {
                    const workerDiv = document.createElement('div');
                    workerDiv.className = 'dienstplan-item';
                    workerDiv.innerHTML = `
                        <div>${currentUser.name} (Du)</div>
                        <div>${userSchedule.start} - ${userSchedule.end}</div>
                    `;
                    dayDiv.appendChild(workerDiv);
                }
            } else {
                // Admin/IT sehen alle und können bearbeiten
                Object.entries(workers).forEach(([worker, schedule]) => {
                    const workerDiv = document.createElement('div');
                    workerDiv.className = 'dienstplan-item';
                    const deleteBtn = isEditMode ? `<button onclick="deleteDienstplan('${day}', '${worker}')" class="icon-btn delete">🗑️</button>` : '';
                    workerDiv.innerHTML = `
                        <div>${worker}</div>
                        <div>${schedule.start} - ${schedule.end}</div>
                        ${deleteBtn}
                    `;
                    dayDiv.appendChild(workerDiv);
                });
            }
            
            // Nur Einträge hinzufügen wenn es etwas zu zeigen gibt
            if (dayDiv.children.length > 1) {
                list.appendChild(dayDiv);
            }
        });
    });
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

// === SOUND FUNKTION ===
function playSound() {
    const audio = new Audio('sound.mp3');
    audio.volume = 0.3;
    audio.play().catch(err => console.log('Sound konnte nicht abgespielt werden'));
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
    
    cartTotal.textContent = total.toFixed(2) + '€';
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
        
        // Farbe ändern wenn genug bezahlt
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
        
        // UI zurücksetzen
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

// === ONLINE STATUS TRACKING ===
function updateOnlineStatus() {
    if (!currentUser) return;
    
    const userRef = database.ref(`onlineUsers/${currentUser.id}`);
    
    // ✅ Funktion zum Online-Status setzen
    const setOnlineStatus = (isOnline) => {
        const now = Date.now();
        userRef.set({
            name: currentUser.name,
            username: currentUser.username,
            role: currentUser.role,
            lastSeen: now,
            online: isOnline,
            lastSeenFormatted: new Date(now).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        }).catch(() => {});
        
        // Update UI wenn online
        if (isOnline) {
            updateOnlineStatusUI();
        }
    };
    
    // Initial: Setze user als online
    setOnlineStatus(true);
    
    // Update UI alle 10 Sekunden
    const uiUpdateInterval = setInterval(() => {
        if (currentUser) {
            updateOnlineStatusUI();
        } else {
            clearInterval(uiUpdateInterval);
        }
    }, 10000);
    
    // ✅ ZUVERLÄSSIGER: Multiple Events für Offline
    const goOffline = () => {
        setOnlineStatus(false);
        clearInterval(uiUpdateInterval);
    };
    
    // 1. Wenn Tab/Fenster geschlossen wird
    window.addEventListener('beforeunload', goOffline);
    
    // 2. Wenn Seite verlassen wird (zuverlässiger)
    window.addEventListener('pagehide', goOffline);
    
    // 3. Wenn Seite nicht sichtbar ist (Tab im Hintergrund)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            goOffline();
        } else if (currentUser) {
            setOnlineStatus(true);
        }
    });
    
    // 4. Bei Logout
    logoutBtn.addEventListener('click', goOffline);
}

// ✅ NEU: UI für Online-Status aktualisieren
function updateOnlineStatusUI() {
    const indicator = document.getElementById('onlineIndicator');
    const statusText = document.getElementById('onlineText');
    const lastSeenEl = document.getElementById('lastSeen');
    const onlineTodayEl = document.getElementById('onlineToday');
    
    if (indicator && statusText) {
        indicator.style.background = '#10b981';
        statusText.textContent = 'Online';
        statusText.style.color = '#10b981';
    }
    
    // Hole aktuelle Zeit
    const now = new Date();
    const timeString = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const dateString = now.toLocaleDateString('de-DE', { month: '2-digit', day: '2-digit' });
    
    if (lastSeenEl) {
        lastSeenEl.textContent = timeString;
    }
    if (onlineTodayEl) {
        onlineTodayEl.textContent = dateString;
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
    const employeeCount = employees.length;
    
    document.getElementById('statSales').textContent = todaySales.length;
    document.getElementById('statRevenue').textContent = todayRevenue.toFixed(2) + '€';
    document.getElementById('statEmployees').textContent = employeeCount;
}

// === EINSTELLUNGEN ===
function initSettings() {
    // Passwort ändern - BEHOBEN: settingsNewPassword statt newPassword
    document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPassword = document.getElementById('oldPassword').value;
        const newPassword = document.getElementById('settingsNewPassword').value;  // ✅ BEHOBEN
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
    
    // Design-Einstellungen - ERWEITERT
    document.getElementById('designSelect')?.addEventListener('change', (e) => {
        const design = e.target.value;
        localStorage.setItem('design', design);
        
        // Zeige/Verberge Custom Color Section
        const customSection = document.getElementById('customColorsSection');
        if (design === 'custom' && customSection) {
            customSection.style.display = 'grid';
        } else if (customSection) {
            customSection.style.display = 'none';
        }
        
        applyDesign(design);
    });
    
    // Custom Farben Live Preview
    document.getElementById('customBackgroundColor')?.addEventListener('input', () => {
        applyDesign('custom');
    });
    document.getElementById('customTextColor')?.addEventListener('input', () => {
        applyDesign('custom');
    });
    
    // Font-Einstellungen
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
    } else if (design === 'green') {  // ✅ NEU
        root.style.setProperty('--bg-dark', '#051c15');
        root.style.setProperty('--bg-secondary', '#0d3d2c');
        root.style.setProperty('--bg-tertiary', '#1b4d3d');
        root.style.setProperty('--text-primary', '#f0fdf4');
        root.style.setProperty('--text-secondary', '#b0e0d0');
        root.style.setProperty('--accent-green', '#10b981');
    } else if (design === 'purple') {  // ✅ NEU
        root.style.setProperty('--bg-dark', '#2d1b4e');
        root.style.setProperty('--bg-secondary', '#3d2463');
        root.style.setProperty('--bg-tertiary', '#4d2a7a');
        root.style.setProperty('--text-primary', '#faf5ff');
        root.style.setProperty('--text-secondary', '#e9d5ff');
        root.style.setProperty('--accent-blue', '#a855f7');
        root.style.setProperty('--accent-blue-hover', '#9333ea');
    } else if (design === 'orange') {  // ✅ NEU
        root.style.setProperty('--bg-dark', '#431407');
        root.style.setProperty('--bg-secondary', '#5a2e1a');
        root.style.setProperty('--bg-tertiary', '#7c3a1d');
        root.style.setProperty('--text-primary', '#fef3c7');
        root.style.setProperty('--text-secondary', '#fdd699');
        root.style.setProperty('--accent-blue', '#f97316');
        root.style.setProperty('--accent-blue-hover', '#ea580c');
    } else if (design === 'custom') {  // ✅ NEU - Benutzerdefiniert
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

// Beim Laden: Zeige Custom Section wenn gespeichert
window.addEventListener('load', () => {
    const design = localStorage.getItem('design') || 'dark';
    const font = localStorage.getItem('fontSize') || 'normal';
    
    applyDesign(design);
    applyFontSize(font);
    
    if (document.getElementById('designSelect')) {
        document.getElementById('designSelect').value = design;
        
        // Zeige Custom Section wenn nötig
        const customSection = document.getElementById('customColorsSection');
        if (design === 'custom' && customSection) {
            customSection.style.display = 'grid';
        }
    }
    if (document.getElementById('fontSelect')) {
        document.getElementById('fontSelect').value = font;
    }
});

function updateOnlineUsersDisplay() {
    const userRole = normalizeRole(currentUser.role);
    if (userRole !== 'admin' && userRole !== 'it') return;
    
    const container = document.getElementById('onlineUsersContainer');
    if (!container) return;
    
    container.innerHTML = '<h4 style="margin-bottom: 12px;">🟢 Online Mitarbeiter</h4>';
    
    // ✅ BEHOBEN: Zeige alle Online-User mit Status
    if (Object.keys(onlineUsers).length === 0) {
        container.innerHTML += '<p style="color: var(--text-secondary); font-size: 12px;">Niemand online</p>';
        return;
    }
    
    Object.entries(onlineUsers).forEach(([userId, user]) => {
        const isOnline = user.online;
        const onlineStatus = isOnline ? '🟢 Online' : '⚫ Offline';
        const onlineColor = isOnline ? '#10b981' : '#9ca3af';
        const lastSeenTime = user.lastSeenFormatted || new Date(user.lastSeen).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        
        const div = document.createElement('div');
        div.style.cssText = `background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid ${onlineColor};`;
        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <div style="width: 8px; height: 8px; background: ${onlineColor}; border-radius: 50%;"></div>
                <div style="font-weight: 600; margin-bottom: 2px;">${user.name}</div>
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-left: 14px;">
                @${user.username}
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-left: 14px; margin-top: 4px;">
                ${onlineStatus} • ${lastSeenTime}
            </div>
        `;
        container.appendChild(div);
    });
}
