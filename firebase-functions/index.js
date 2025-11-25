const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.database();

// Login Verification Function
exports.verifyLogin = functions.https.onRequest(async (req, res) => {
    // CORS aktivieren
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).send();
        return;
    }
    
    const { username, password } = req.body;
    
    if (!username || !password) {
        res.status(400).json({
            success: false,
            message: 'Benutzername und Passwort erforderlich'
        });
        return;
    }
    
    try {
        // Suche Benutzer in Datenbank
        const usersRef = db.ref('users');
        const snapshot = await usersRef.once('value');
        let foundUser = null;
        
        snapshot.forEach((child) => {
            const user = child.val();
            // Vergleiche Passwort
            if (user.username === username && user.password === password) {
                foundUser = {
                    id: child.key,
                    username: user.username,
                    name: user.name,
                    role: user.role,
                    createdAt: user.createdAt
                    // Passwort NICHT zurückgeben!
                };
            }
        });
        
        if (foundUser) {
            res.status(200).json({
                success: true,
                message: 'Login erfolgreich',
                user: foundUser
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'Benutzername oder Passwort falsch'
            });
        }
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({
            success: false,
            message: 'Serverfehler beim Login'
        });
    }
});

// Neuen Benutzer erstellen (nur für Admin)
exports.createUser = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).send();
        return;
    }
    
    const { adminId, username, password, name, role } = req.body;
    
    try {
        // Prüfe ob Admin existiert und Admin-Rolle hat
        const adminSnapshot = await db.ref(`users/${adminId}`).once('value');
        const admin = adminSnapshot.val();
        
        if (!admin || admin.role !== 'admin') {
            res.status(403).json({
                success: false,
                message: 'Keine Berechtigung'
            });
            return;
        }
        
        // Prüfe ob Benutzername schon existiert
        const usersSnapshot = await db.ref('users').once('value');
        let exists = false;
        
        usersSnapshot.forEach((child) => {
            if (child.val().username === username) {
                exists = true;
            }
        });
        
        if (exists) {
            res.status(400).json({
                success: false,
                message: 'Benutzername existiert bereits'
            });
            return;
        }
        
        // Erstelle neuen Benutzer
        const newUserRef = db.ref('users').push();
        await newUserRef.set({
            username: username,
            password: password,
            name: name,
            role: role,
            createdAt: Date.now(),
            createdBy: adminId
        });
        
        res.status(200).json({
            success: true,
            message: 'Benutzer erfolgreich erstellt',
            userId: newUserRef.key
        });
    } catch (error) {
        console.error('Create User Error:', error);
        res.status(500).json({
            success: false,
            message: 'Serverfehler'
        });
    }
});

// Benutzer löschen (nur für Admin)
exports.deleteUser = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).send();
        return;
    }
    
    const { adminId, userId } = req.body;
    
    try {
        // Prüfe ob Admin existiert
        const adminSnapshot = await db.ref(`users/${adminId}`).once('value');
        const admin = adminSnapshot.val();
        
        if (!admin || admin.role !== 'admin') {
            res.status(403).json({
                success: false,
                message: 'Keine Berechtigung'
            });
            return;
        }
        
        // Prüfe ob Admin sich selbst löschen will
        if (adminId === userId) {
            res.status(400).json({
                success: false,
                message: 'Du kannst dich selbst nicht löschen'
            });
            return;
        }
        
        // Lösche Benutzer
        await db.ref(`users/${userId}`).remove();
        
        res.status(200).json({
            success: true,
            message: 'Benutzer gelöscht'
        });
    } catch (error) {
        console.error('Delete User Error:', error);
        res.status(500).json({
            success: false,
            message: 'Serverfehler'
        });
    }
});
