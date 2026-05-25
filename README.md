# Secure Login System 🔒

A modern, secure authentication web application built with **Firebase** and hosted on **GitHub Pages**. Features enterprise-grade security practices including encrypted password storage, input validation, session management, and comprehensive activity logging.

---

## 🌟 Features

### Core Security
| Feature | Implementation |
|---|---|
| **Password Hashing** | Firebase Auth uses **scrypt** (comparable to bcrypt/Argon2) — passwords are never stored in plain text |
| **Input Validation** | Client-side regex validation + sanitization for all user inputs |
| **SQL Injection Protection** | Pattern detection + Firestore NoSQL (inherently resistant to SQL injection) |
| **XSS Protection** | HTML entity encoding + Content Security Policy headers |
| **Session Management** | JWT-based tokens with configurable persistence (local/session) |
| **Brute Force Protection** | Client-side rate limiting + Firebase's built-in account lockout |

### User Features
- ✅ User registration with email verification
- ✅ Secure login with "Remember Me" option
- ✅ Password reset via email
- ✅ Real-time password strength meter
- ✅ Protected dashboard with profile information
- ✅ Complete login history with timestamps & device info
- ✅ Change password functionality
- ✅ Security score tracking

### UI/UX
- 🎨 Premium dark-mode design with glassmorphism
- ✨ Animated gradient background with particle effects
- 📱 Fully responsive (mobile, tablet, desktop)
- 🔔 Toast notification system
- ⏳ Loading states with spinners
- 🔑 Password visibility toggles

---

## 📁 Project Structure

```
Secure Login System/
├── index.html                  # Landing page with feature showcase
├── login.html                  # User login page
├── register.html               # User registration page
├── dashboard.html              # Protected user dashboard
├── forgot-password.html        # Password reset page
├── css/
│   └── style.css               # Complete design system (1200+ lines)
├── js/
│   ├── firebase-config.js      # Firebase initialization & config
│   ├── auth.js                 # Authentication logic (register/login/logout)
│   ├── validation.js           # Input validation & sanitization
│   ├── dashboard.js            # Dashboard logic & data display
│   └── ui.js                   # UI utilities (toasts, particles, etc.)
├── firestore.rules             # Firestore security rules
├── .gitignore                  # Git ignore file
└── README.md                   # This file
```

---

## 🚀 Setup Instructions

### Prerequisites
- A [Firebase](https://firebase.google.com/) account (free tier is sufficient)
- A [GitHub](https://github.com/) account

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** → Enter a project name → Click **Continue**
3. Optionally enable Google Analytics → Click **Create project**

### Step 2: Enable Authentication

1. In Firebase Console, go to **Build → Authentication**
2. Click **"Get started"**
3. Under **Sign-in method**, enable **Email/Password**

### Step 3: Create Firestore Database

1. Go to **Build → Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (we'll add security rules later)
4. Select a region → Click **Enable**

### Step 4: Get Firebase Config

1. Go to **Project Settings** (gear icon) → **General**
2. Scroll to **"Your apps"** → Click the web icon (`</>`)
3. Register your app with a nickname
4. Copy the `firebaseConfig` object

### Step 5: Update Configuration

Open `js/firebase-config.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

### Step 6: Deploy Firestore Security Rules

1. Go to **Firestore Database → Rules**
2. Replace the default rules with the contents of `firestore.rules`
3. Click **Publish**

### Step 7: Deploy to GitHub Pages

1. Create a new GitHub repository
2. Push all project files to the repository
3. Go to **Settings → Pages**
4. Under **Source**, select **main branch** → Click **Save**
5. Your site will be live at `https://yourusername.github.io/repository-name/`

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  GitHub Pages                    │
│              (Static File Hosting)               │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  HTML     │ │  CSS     │ │  JavaScript      │ │
│  │  Pages    │ │  Styles  │ │  (Firebase SDK)  │ │
│  └──────────┘ └──────────┘ └────────┬─────────┘ │
└─────────────────────────────────────┼───────────┘
                                      │
                        HTTPS API Calls│
                                      ▼
┌─────────────────────────────────────────────────┐
│                 Firebase (Google Cloud)           │
│                                                  │
│  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  Firebase Auth    │  │  Cloud Firestore     │  │
│  │  ─ Password hash │  │  ─ User profiles     │  │
│  │  ─ JWT tokens    │  │  ─ Login history     │  │
│  │  ─ Email verify  │  │  ─ Security rules    │  │
│  └──────────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## 🔐 Security Practices

1. **Password Hashing**: Firebase uses scrypt (a memory-hard, CPU-intensive algorithm) to hash passwords server-side. Raw passwords are never stored or transmitted after initial authentication.

2. **Input Validation**: All inputs are validated client-side using regex patterns before being sent to Firebase. This includes:
   - Email format validation (RFC 5322)
   - Password strength requirements (8+ chars, uppercase, lowercase, number, special char)
   - Name format validation
   - SQL injection pattern detection
   - XSS HTML entity encoding

3. **Session Management**: Firebase Auth uses JWT tokens for session management. Sessions can be configured as:
   - `LOCAL`: Persists across browser closes (Remember Me)
   - `SESSION`: Cleared when the tab is closed
   - `NONE`: No persistence

4. **Rate Limiting**: Client-side rate limiting prevents brute force attacks:
   - Login: 5 attempts per minute
   - Registration: 5 attempts per 5 minutes
   - Password reset: 3 attempts per 5 minutes

5. **Firestore Security Rules**: Database access is restricted so users can only read/write their own data.

---

## 🛠️ Technologies Used

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Backend**: Firebase Authentication, Cloud Firestore
- **Hosting**: GitHub Pages
- **Design**: Custom CSS with glassmorphism, CSS animations, canvas particles
- **Typography**: Inter (Google Fonts)

---

## 📜 License

This project is part of an internship portfolio. Feel free to use it as reference for learning purposes.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
