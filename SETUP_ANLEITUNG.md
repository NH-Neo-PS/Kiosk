# 🏪 Schulkiosk Management System - Setup Anleitung

## 📋 Was du bekommst:
- ✅ Vollständiges Kassensystem
- ✅ Produktverwaltung
- ✅ Mitarbeiterverwaltung mit Rollen (Admin, IT, Mitschüler)
- ✅ Verkaufsprotokolle
- ✅ Echtzeit-Synchronisation
- ✅ Sichere Datenbank mit Zugriffsschutz

---

## 🚀 SCHRITT 1: Firebase Projekt erstellen

### 1.1 Firebase Console öffnen
1. Gehe zu: https://console.firebase.google.com/
2. Klicke auf **"Projekt hinzufügen"**
3. Gib deinem Projekt einen Namen: z.B. "schulkiosk"
4. Deaktiviere Google Analytics (nicht nötig)
5. Klicke auf **"Projekt erstellen"**

### 1.2 Web-App registrieren
1. Im Firebase Dashboard: Klicke auf das **Web-Icon** `</>`
2. Gib einen App-Namen ein: z.B. "Kiosk Web App"
3. **WICHTIG:** Aktiviere **"Firebase Hosting einrichten"** NICHT (noch nicht)
4. Klicke auf **"App registrieren"**
5. **KOPIERE** die Firebase Config - sieht so aus:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "schulkiosk-xxxx.firebaseapp.com",
  databaseURL: "https://schulkiosk-xxxx-default-rtdb.firebaseio.com",
  projectId: "schulkiosk-xxxx",
  storageBucket: "schulkiosk-xxxx.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:xxxxxxxxxxxxx"
};
```

---

## 🔥 SCHRITT 2: Realtime Database aktivieren

### 2.1 Database erstellen
1. Im linken Menü: Klicke auf **"Build"** → **"Realtime Database"**
2. Klicke auf **"Datenbank erstellen"**
3. Wähle einen Standort: **"europe-west1"** (Europa)
4. Wähle **"Im Testmodus starten"** (ändern wir später)
5. Klicke auf **"Aktivieren"**

### 2.2 Sicherheitsregeln setzen
1. Gehe zu Tab **"Regeln"**
2. **LÖSCHE** alles was dort steht
3. **KOPIERE** den Inhalt aus `firebase-rules.json` und füge ihn ein
4. Klicke auf **"Veröffentlichen"**

✅ **Jetzt sind deine Daten geschützt!**

---

## 🔐 SCHRITT 3: Authentication aktivieren

### 3.1 E-Mail/Passwort Login aktivieren
1. Im linken Menü: **"Build"** → **"Authentication"**
2. Klicke auf **"Erste Schritte"**
3. Klicke bei **"E-Mail/Passwort"** auf das Stift-Symbol
4. Aktiviere **"E-Mail/Passwort"** (erster Toggle)
5. Klicke auf **"Speichern"**

---

## 💻 SCHRITT 4: Code einrichten

### 4.1 Dateien erstellen
Erstelle diese 4 Dateien in einem Ordner:

```
schulkiosk/
├── index.html
├── style.css
├── app.js
└── SETUP_ANLEITUNG.md (diese Datei)
```

### 4.2 Firebase Config einfügen
1. Öffne **app.js**
2. Finde diese Zeilen ganz oben:

```javascript
const firebaseConfig = {
    apiKey: "DEIN_API_KEY",
    authDomain: "DEIN_PROJECT.firebaseapp.com",
    ...
};
```

3. **ERSETZE** diese mit deiner eigenen Config aus Schritt 1.2

---

## 🌐 SCHRITT 5: Website starten

### Option A: Lokal testen (einfach)
1. Öffne `index.html` direkt in Chrome/Firefox
2. **PROBLEM:** Firebase Auth funktioniert nur mit HTTPS!

### Option B: Mit Live Server (empfohlen für Tests)
1. Installiere VS Code Extension: **"Live Server"**
2. Rechtsklick auf `index.html` → **"Open with Live Server"**
3. Browser öffnet sich automatisch

### Option C: Firebase Hosting (beste Lösung)

#### 5.1 Firebase CLI installieren
```bash
npm install -g firebase-tools
```

#### 5.2 In Firebase einloggen
```bash
firebase login
```

#### 5.3 Projekt initialisieren
```bash
cd /pfad/zu/deinem/schulkiosk-ordner
firebase init hosting
```

- Wähle dein Projekt aus
- Public directory: **einfach Enter drücken** (bleibt "public")
- Single-page app: **Nein** (N)
- GitHub deploys: **Nein** (N)

#### 5.4 Dateien vorbereiten
```bash
# Erstelle public Ordner falls nicht vorhanden
mkdir public

# Kopiere alle Dateien nach public/
cp index.html style.css app.js public/
```

#### 5.5 Deployen
```bash
firebase deploy
```

✅ **Deine App ist jetzt online!**
Firebase gibt dir eine URL wie: `https://schulkiosk-xxxx.web.app`

---

## 👥 SCHRITT 6: Ersten Admin erstellen

### 6.1 Registrieren
1. Öffne deine Website
2. Klicke auf **"Registrieren"**
3. Fülle das Formular aus:
   - Name: Dein Name
   - E-Mail: deine@email.de
   - Passwort: (sicheres Passwort!)
   - Rolle: **Admin**
4. Klicke **"Registrieren"**

### 6.2 Admin-Rolle bestätigen
1. Gehe zur Firebase Console → Realtime Database
2. Du siehst jetzt unter `users/` deinen Benutzer
3. Prüfe ob `role: "admin"` steht

✅ **Du bist jetzt Admin!**

---

## 🎮 SCHRITT 7: System nutzen

### 7.1 Erste Produkte hinzufügen
1. Melde dich an
2. Gehe zu **"Produkte"**
3. Füge Produkte hinzu:
   - Brötchen, 1.50€, 50 Stück, Essen
   - Cola, 2.00€, 30 Stück, Getränke
   - Schokoriegel, 1.20€, 40 Stück, Süßigkeiten

### 7.2 Weitere Mitarbeiter anlegen
1. Andere Benutzer können sich registrieren
2. Als Admin kannst du in Firebase ihre Rollen ändern:
   - `admin` - Volle Rechte
   - `it` - Kann Produkte verwalten
   - `mitschueler` - Kann nur Kasse bedienen

### 7.3 Verkäufe machen
1. Gehe zu **"Kasse"**
2. Klicke auf Produkte
3. Sie landen im Warenkorb
4. Klicke **"Verkauf abschließen"**
5. Lagerbestand wird automatisch aktualisiert!

---

## 🔒 Sicherheits-Features

### ✅ Was ist geschützt:
- ❌ Mitschüler können KEINE Produkte ändern
- ❌ Mitschüler können KEINE anderen Benutzer sehen
- ❌ Niemand kann mehr als 1000 Stück auf einmal verkaufen
- ❌ Preise können nicht negativ sein
- ❌ Man kann sich nicht selbst zum Admin machen
- ✅ Nur eingeloggte Benutzer haben Zugriff
- ✅ Jeder Verkauf wird mit Namen protokolliert
- ✅ Timestamps verhindern gefälschte Daten

### 🛡️ Zusätzliche Sicherheit (optional):
In Firebase Console → Authentication → Settings:
- Aktiviere **"E-Mail-Bestätigung"**
- Setze **"Passwort-Policy"** (min. 8 Zeichen)

---

## 🐛 Probleme lösen

### Problem: "Firebase is not defined"
**Lösung:** Prüfe ob die Firebase SDK Scripte in `index.html` geladen werden

### Problem: "Permission denied"
**Lösung:** 
1. Prüfe ob du eingeloggt bist
2. Prüfe deine Rolle in Firebase Database
3. Prüfe ob die Firebase Rules richtig gesetzt sind

### Problem: "Auth domain not whitelisted"
**Lösung:** 
1. Firebase Console → Authentication → Settings
2. Unter "Authorized domains" deine Domain hinzufügen

### Problem: Seite lädt nicht
**Lösung:**
1. Prüfe Browser Console (F12) auf Fehler
2. Prüfe ob Firebase Config korrekt ist
3. Prüfe ob alle Dateien im richtigen Ordner sind

---

## 📱 Features & Bedienung

### Dashboard
- Übersicht über Verkäufe heute
- Gesamtumsatz
- Letzte Aktivitäten

### Kasse
- Produkte anklicken zum Hinzufügen
- Menge im Warenkorb ändern
- Verkauf abschließen
- Automatische Lagerbestand-Aktualisierung

### Produkte (nur Admin/IT)
- Neue Produkte hinzufügen
- Produkte löschen
- Lagerbestand sehen

### Mitarbeiter (nur Admin/IT)
- Alle Mitarbeiter sehen
- Rollen und E-Mails anzeigen

### Protokoll
- Alle Verkäufe
- Datum, Mitarbeiter, Betrag
- Nach neuestem sortiert

---

## 🎨 Anpassungen

### Farben ändern
In `style.css` unter `:root` die Farben ändern:

```css
:root {
    --accent-blue: #3b82f6;  /* Hauptfarbe */
    --accent-green: #10b981; /* Erfolgsfarbe */
    --accent-red: #ef4444;   /* Fehlerfarbe */
}
```

### Logo hinzufügen
In `index.html` das 🏪 Emoji ersetzen mit:
```html
<img src="logo.png" alt="Logo" style="width: 40px;">
```

### Schulname änzufügen
In `index.html` und `sidebar-header` ändern:
```html
<h1>🏪 [Deine Schule] Kiosk</h1>
```

---

## 🆘 Support & Hilfe

### Häufige Fragen:
1. **Kann ich Excel statt Firebase nutzen?**
   - Nein, Excel hat keine API für Web-Apps
   - Firebase ist kostenlos und besser geeignet

2. **Wie viele Benutzer kann ich haben?**
   - Firebase Free: 100 gleichzeitige Verbindungen
   - Ausreichend für eine Schule!

3. **Wie viele Daten kann ich speichern?**
   - Firebase Free: 1 GB Datenbank
   - Das reicht für Jahre an Verkäufen!

4. **Kann ich Backups machen?**
   - Ja! In Firebase Console → Realtime Database → Export

5. **Wie mache ich Updates?**
   - Dateien ändern
   - `firebase deploy` erneut ausführen

---

## ✅ Checkliste Installation

- [ ] Firebase Projekt erstellt
- [ ] Realtime Database aktiviert
- [ ] Sicherheitsregeln gesetzt
- [ ] Authentication aktiviert
- [ ] Firebase Config in app.js eingetragen
- [ ] Website deployed
- [ ] Admin-Account erstellt
- [ ] Erste Produkte hinzugefügt
- [ ] Test-Verkauf gemacht

---

## 🎉 Fertig!

Dein Schulkiosk Management System läuft jetzt!

**Viel Erfolg mit eurem Kiosk! 🚀**

---

## 📞 Weitere Hilfe

Bei Problemen:
1. Browser Console checken (F12)
2. Firebase Console → Database → Logs
3. Google: "Firebase [dein Problem]"

**Tipp:** Mache regelmäßig Backups in Firebase Console!