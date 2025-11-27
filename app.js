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

// === LOGIN ===
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = '';
    
    try {
        const usersSnapshot = await database.ref('users').once('value');
        let foundUser = null;
        
        usersSnapshot.forEach((child) => {
            const user = child.val();
            if (user.username === username && user.password === password) {
                foundUser = {
                    id: child.key,
                    username: user.username,
                    name: user.name,
                    role: user.role,
                    createdAt: user.createdAt
                };
            }
        });
        
        if (foundUser) {
            setCookie('currentUser', foundUser, 7);
            currentUser = foundUser;
            loginScreen.style.display = 'none';
            mainApp.style.display = 'flex';
            updateUserInfo();
            loadData();
            updateUIForRole();
            checkDienstplan();
        } else {
            errorDiv.textContent = 'Benutzername oder Passwort falsch!';
        }
    } catch (error) {
        errorDiv.textContent = 'Fehler beim Login: ' + error.message;
    }
});

logoutBtn.addEventListener('click', () => {
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
    }
});

// === DIENSTPLAN CHECK ===
function checkDienstplan() {
    const now = new Date();
    const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const today = dayNames[now.getDay()];
    const hour = now.getHours();
    
    database.ref('dienstplan').once('value', (snapshot) => {
        const dienstplan = snapshot.val();
        if (dienstplan && dienstplan[today]) {
            const dayPlan = dienstplan[today];
            const userSchedule = dayPlan[currentUser.username];
            
            if (userSchedule) {
                const startHour = parseInt(userSchedule.start.split(':')[0]);
                const endHour = parseInt(userSchedule.end.split(':')[0]);
                
                if (hour < startHour || hour >= endHour) {
                    document.getElementById('navKasse').style.display = 'none';
                    alert(`⏰ Du kannst nur von ${userSchedule.start} - ${userSchedule.end} Uhr die Kasse bedienen!`);
                } else {
                    document.getElementById('navKasse').style.display = 'flex';
                }
            }
        }
    });
}

// === UI FUNKTIONEN ===

function updateUserInfo() {
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.role;
}

function updateUIForRole() {
    const navProdukte = document.getElementById('navProdukte');
    const navMitarbeiter = document.getElementById('navMitarbeiter');
    const navBenutzerverwaltung = document.getElementById('navBenutzerverwaltung');
    const navDienstplan = document.getElementById('navDienstplan');
    
    if (currentUser.role === 'mitschueler') {
        navProdukte.style.display = 'none';
        navMitarbeiter.style.display = 'none';
        navBenutzerverwaltung.style.display = 'none';
        navDienstplan.style.display = 'none';
    } else if (currentUser.role === 'it') {
        navProdukte.style.display = 'flex';
        navMitarbeiter.style.display = 'flex';
        navBenutzerverwaltung.style.display = 'flex';
        navDienstplan.style.display = 'flex';
    } else if (currentUser.role === 'admin') {
        navProdukte.style.display = 'flex';
        navMitarbeiter.style.display = 'flex';
        navBenutzerverwaltung.style.display = 'flex';
        navDienstplan.style.display = 'flex';
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
            if (user.role !== 'admin') {
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
                opt.value = emp.username;
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

// === BENUTZERVERWALTUNG ===
document.getElementById('addUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log(currentUser.role)
    if (currentUser.role !== 'admin' && currentUser.role !== 'it') {
        alert('Keine Berechtigung!');
        return;
    }
    
    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;
    const name = document.getElementById('newName').value;
    const role = document.getElementById('newUserRole').value;
    
    try {
        const usersSnapshot = await database.ref('users').once('value');
        let exists = false;
        
        usersSnapshot.forEach((child) => {
            if (child.val().username === username && child.key !== editingUserId) {
                exists = true;
            }
        });
        
        if (exists) {
            alert('Benutzername existiert bereits!');
            return;
        }
        
        if (editingUserId) {
            await database.ref('users/' + editingUserId).update({
                username: username,
                password: password,
                name: name,
                role: role
            });
            alert('Benutzer aktualisiert!');
            editingUserId = null;
            document.querySelector('#addUserForm .btn').textContent = 'Erstellen';
        } else {
            await database.ref('users').push({
                username: username,
                password: password,
                name: name,
                role: role,
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
    
    allUsers.forEach(user => {
        const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
        const card = document.createElement('div');
        card.className = 'user-item';
        card.innerHTML = `
            <div class="user-avatar-small">${initials}</div>
            <div class="user-info-item">
                <div class="user-username">${user.username}</div>
                <div class="user-name-small">${user.name}</div>
                <div class="user-role-badge">${user.role}</div>
            </div>
            <div class="user-actions">
                <button class="icon-btn edit" onclick="editUser('${user.id}')">✏️</button>
                <button class="icon-btn delete" onclick="deleteUser('${user.id}')">🗑️</button>
            </div>
        `;
        list.appendChild(card);
    });
}

function editUser(userId) {
    if (currentUser.role !== 'admin' && currentUser.role !== 'it') {
        alert('Keine Berechtigung!');
        return;
    }
    
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    editingUserId = userId;
    document.getElementById('newUsername').value = user.username;
    document.getElementById('newPassword').value = user.password;
    document.getElementById('newName').value = user.name;
    document.getElementById('newUserRole').value = user.role;
    document.querySelector('#addUserForm .btn').textContent = 'Aktualisieren';
    
    document.getElementById('addUserForm').scrollIntoView({ behavior: 'smooth' });
}

async function deleteUser(userId) {
    if (currentUser.role !== 'admin' && currentUser.role !== 'it') {
        alert('Keine Berechtigung!');
        return;
    }
    
    if (userId === currentUser.id) {
        alert('Du kannst dich selbst nicht löschen!');
        return;
    }
    
    if (confirm('Benutzer wirklich löschen?')) {
        try {
            await database.ref('users/' + userId).remove();
            alert('Benutzer gelöscht!');
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    }
}

// === DIENSTPLAN ===
document.getElementById('dienstplanForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (currentUser.role !== 'admin') {
        alert('Keine Berechtigung!');
        return;
    }
    
    const day = document.getElementById('dienstplanDay').value;
    const employee = document.getElementById('dienstplanEmployee').value;
    const start = document.getElementById('dienstplanStart').value;
    const end = document.getElementById('dienstplanEnd').value;
    
    try {
        const planRef = database.ref(`dienstplan/${day}/${employee}`);
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
    
    database.ref('dienstplan').once('value', (snapshot) => {
        const dienstplan = snapshot.val() || {};
        list.innerHTML = '';
        
        Object.entries(dienstplan).forEach(([day, workers]) => {
            const dayDiv = document.createElement('div');
            dayDiv.style.marginBottom = '20px';
            dayDiv.style.borderLeft = '4px solid var(--accent-blue)';
            dayDiv.style.paddingLeft = '16px';
            dayDiv.innerHTML = `<h4>${day}</h4>`;
            
            Object.entries(workers).forEach(([worker, schedule]) => {
                const workerDiv = document.createElement('div');
                workerDiv.className = 'dienstplan-item';
                workerDiv.innerHTML = `
                    <div>${worker}</div>
                    <div>${schedule.start} - ${schedule.end}</div>
                    <button onclick="deleteDienstplan('${day}', '${worker}')" class="icon-btn delete">🗑️</button>
                `;
                dayDiv.appendChild(workerDiv);
            });
            
            list.appendChild(dayDiv);
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
    
    if (currentUser.role === 'mitschueler') {
        alert('Keine Berechtigung!');
        return;
    }
    
    const product = {
        name: document.getElementById('productName').value,
        price: parseFloat(document.getElementById('productPrice').value),
        stock: parseInt(document.getElementById('productStock').value),
        category: document.getElementById('productCategory').value,
        createdAt: Date.now(),
        createdBy: currentUser.id
    };
    
    try {
        await database.ref('products').push(product);
        e.target.reset();
        alert('Produkt hinzugefügt!');
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
                <button class="icon-btn delete" onclick="deleteProduct('${product.id}')">🗑️</button>
            </div>
        `;
        list.appendChild(item);
    });
}

async function deleteProduct(productId) {
    if (currentUser.role === 'mitschueler') {
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
        card.innerHTML = `
            <div class="employee-avatar">${initials}</div>
            <div class="employee-info">
                <div class="employee-name">${employee.name}</div>
                <div class="employee-role">${employee.role}</div>
                <div style="color: #9ca3af; font-size: 14px;">@${employee.username}</div>
            </div>
        `;
        list.appendChild(card);
    });
}

// === VERKAUFSPROTOKOLLE ===

function renderSalesLogs() {
    const container = document.getElementById('salesLogs');
    const recentLogs = document.getElementById('recentLogs');
    
    if (container) {
        container.innerHTML = '';
        sales.forEach(sale => {
            container.innerHTML += createLogItem(sale);
        });
    }
    
    if (recentLogs) {
        recentLogs.innerHTML = '';
        sales.slice(0, 10).reverse().forEach(sale => {
            recentLogs.innerHTML += createLogItem(sale);
        });
    }
}

function createLogItem(sale) {
    const date = new Date(sale.date || sale.timestamp);
    const formattedDate = date.toLocaleString('de-DE');
    const change = sale.change ? `(Wechsel: ${sale.change.toFixed(2)}€)` : '';
    
    return `
        <div class="log-item">
            <div class="log-date">${formattedDate}</div>
            <div>
                <div class="log-type">${sale.type || 'Verkauf'}</div>
                <div style="font-size: 14px; color: #9ca3af;">Mitarbeiter: ${sale.employee}</div>
            </div>
            <div class="log-amount">${sale.total.toFixed(2)}€ ${change}</div>
        </div>
    `;
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

// === GLOBAL FUNCTIONS ===
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.deleteProduct = deleteProduct;
window.deleteUser = deleteUser;
window.editUser = editUser;
window.deleteDienstplan = deleteDienstplan;
