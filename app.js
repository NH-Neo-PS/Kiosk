// ⚠️ FIREBASE KONFIGURATION - ERSETZE MIT DEINEN EIGENEN WERTEN!
const firebaseConfig = {
    apiKey: "AIzaSyDF2E3Z80yza8pw0YwptnDIZ2Q6CFg0WBg",
    authDomain: "kiosk-c85c3.firebaseapp.com",
    databaseURL: "https://kiosk-c85c3-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "kiosk-c85c3",
    storageBucket: "kiosk-c85c3.firebasestorage.app",
    messagingSenderId: "18714522275",
    appId: "1:18714522275:web:a24b2233661e52c6414516"
};

// Firebase initialisieren
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Globale Variablen
let currentUser = null;
let cart = [];
let products = [];
let employees = [];
let sales = [];
let allUsers = [];

// === DOM ELEMENTE ===
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');

// === AUTHENTIFIZIERUNG (mit Cloud Function) ===

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = '';
    
    try {
        // Rufe Cloud Function auf
        const response = await fetch(
            `https://europe-west1-kiosk-c85c3.cloudfunctions.net/verifyLogin`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            }
        );
        
        const data = await response.json();
        
        if (data.success) {
            // Passwort korrekt - lade Benutzerdaten
            currentUser = data.user;
            loginScreen.style.display = 'none';
            mainApp.style.display = 'flex';
            updateUserInfo();
            loadData();
            updateUIForRole();
        } else {
            errorDiv.textContent = data.message || 'Benutzername oder Passwort falsch!';
        }
    } catch (error) {
        errorDiv.textContent = 'Fehler beim Login: ' + error.message;
        console.error('Login Error:', error);
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    currentUser = null;
    loginScreen.style.display = 'flex';
    mainApp.style.display = 'none';
    loginForm.reset();
    document.getElementById('loginError').textContent = '';
});

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
    
    if (currentUser.role === 'mitschueler') {
        navProdukte.style.display = 'none';
        navMitarbeiter.style.display = 'none';
        navBenutzerverwaltung.style.display = 'none';
    } else if (currentUser.role === 'it') {
        navProdukte.style.display = 'flex';
        navMitarbeiter.style.display = 'flex';
        navBenutzerverwaltung.style.display = 'none';
    } else if (currentUser.role === 'admin') {
        navProdukte.style.display = 'flex';
        navMitarbeiter.style.display = 'flex';
        navBenutzerverwaltung.style.display = 'flex';
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
        if (view === 'protokoll') renderSalesLogs();
        if (view === 'dashboard') updateDashboard();
    });
});

// === DATEN LADEN ===

function loadData() {
    // Produkte laden
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
    
    // Benutzer laden
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
        renderEmployees();
        renderUsersList();
    });
    
    // Verkäufe laden
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

// === BENUTZERVERWALTUNG (nur Admin) ===

document.getElementById('addUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (currentUser.role !== 'admin') {
        alert('Keine Berechtigung!');
        return;
    }
    
    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;
    const name = document.getElementById('newName').value;
    const role = document.getElementById('newUserRole').value;
    
    try {
        // Rufe Cloud Function auf
        const response = await fetch(
            `https://europe-west1-kiosk-c85c3.cloudfunctions.net/createUser`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adminId: currentUser.id,
                    username: username,
                    password: password,
                    name: name,
                    role: role
                })
            }
        );
        
        const data = await response.json();
        
        if (data.success) {
            e.target.reset();
            alert('Benutzer erfolgreich erstellt!');
        } else {
            alert('Fehler: ' + data.message);
        }
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
                <button class="icon-btn delete" onclick="deleteUser('${user.id}')">🗑️</button>
            </div>
        `;
        list.appendChild(card);
    });
}

async function deleteUser(userId) {
    if (currentUser.role !== 'admin') {
        alert('Keine Berechtigung!');
        return;
    }
    
    if (userId === currentUser.id) {
        alert('Du kannst dich selbst nicht löschen!');
        return;
    }
    
    if (confirm('Benutzer wirklich löschen?')) {
        try {
            const response = await fetch(
                `https://europe-west1-kiosk-c85c3.cloudfunctions.net/deleteUser`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        adminId: currentUser.id,
                        userId: userId
                    })
                }
            );
            
            const data = await response.json();
            
            if (data.success) {
                alert('Benutzer gelöscht!');
            } else {
                alert('Fehler: ' + data.message);
            }
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
                Lager: ${product.stock} Stück
            </div>
        `;
        card.addEventListener('click', () => addToCart(product));
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

// Verkauf abschließen
document.getElementById('completeSaleBtn').addEventListener('click', async () => {
    if (cart.length === 0) {
        alert('Warenkorb ist leer!');
        return;
    }
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    try {
        // Verkauf speichern
        const saleRef = database.ref('sales').push();
        await saleRef.set({
            date: new Date().toISOString(),
            timestamp: Date.now(),
            employee: currentUser.name,
            employeeId: currentUser.id,
            items: cart,
            total: total,
            type: 'Verkauf'
        });
        
        // Lagerbestand aktualisieren
        const updates = {};
        cart.forEach(item => {
            const product = products.find(p => p.id === item.id);
            updates[`products/${item.id}/stock`] = product.stock - item.quantity;
        });
        
        await database.ref().update(updates);
        
        alert(`Verkauf erfolgreich! Gesamt: ${total.toFixed(2)}€`);
        cart = [];
        renderCart();
        
    } catch (error) {
        alert('Fehler beim Speichern: ' + error.message);
    }
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
        sales.slice(0, 5).forEach(sale => {
            recentLogs.innerHTML += createLogItem(sale);
        });
    }
}

function createLogItem(sale) {
    const date = new Date(sale.date || sale.timestamp);
    const formattedDate = date.toLocaleString('de-DE');
    const isNegative = sale.total < 0;
    
    return `
        <div class="log-item">
            <div class="log-date">${formattedDate}</div>
            <div>
                <div class="log-type">${sale.type || 'Verkauf'}</div>
                <div style="font-size: 14px; color: #9ca3af;">Mitarbeiter: ${sale.employee}</div>
            </div>
            <div class="log-amount ${isNegative ? 'negative' : ''}">
                ${sale.total.toFixed(2)}€
            </div>al || 0), 0);
        </div>
    `;
}   document.getElementById('statSales').textContent = todaySales.length;
    document.getElementById('statRevenue').textContent = todayRevenue.toFixed(2) + '€';
// === DASHBOARD ===ue').textContent = totalRevenue.toFixed(2) + '€';

function updateDashboard() {
    const today = new Date().setHours(0, 0, 0, 0);k) ===
    const todaySales = sales.filter(sale => {ateCartQuantity;














window.deleteUser = deleteUser;window.deleteProduct = deleteProduct;window.removeFromCart = removeFromCart;window.updateCartQuantity = updateCartQuantity;// === GLOBALE FUNKTIONEN (für onclick) ===}    document.getElementById('statTotalRevenue').textContent = totalRevenue.toFixed(2) + '€';    document.getElementById('statRevenue').textContent = todayRevenue.toFixed(2) + '€';    document.getElementById('statSales').textContent = todaySales.length;        });        return saleDate === today;        const saleDate = new Date(sale.date || sale.timestamp).setHours(0, 0, 0, 0);window.removeFromCart = removeFromCart;
window.deleteProduct = deleteProduct;
window.deleteUser = deleteUser;