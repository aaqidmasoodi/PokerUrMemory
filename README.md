# PokerUrMemory

A real-time, mobile-first, online multiplayer poker game based on 5-Card Draw with a memory twist. 

This repository contains both the backend server and the frontend client, beautifully separated to ensure clean architecture and easy development.

## Project Structure

```text
PokerUrMemory/
├── server/                 # The Node.js + Express + Socket.IO Backend
│   ├── server.js           # Main game logic and socket events
│   └── package.json        
├── client/                 # The React + Vite + Tailwind CSS Frontend
│   ├── src/                # UI Components and Game Hooks
│   └── package.json
└── README.md               # This file!
```

---

## 🚀 How to Run the Game Locally

There are two main ways to run the game depending on what you are trying to do:

### Option A: Production Mode (Running the Full Game Together)

If you just want to run the game exactly as it will run in production:

1. **Build the Client:**
   Navigate into the client directory, install dependencies, and build the React app.
   ```bash
   cd client
   npm install
   npm run build
   ```
2. **Start the Server:**
   Navigate into the server directory and start the Node.js backend. The server is configured to automatically serve the built client files.
   ```bash
   cd ../server
   npm install
   npm start
   ```
3. **Play:**
   Open your browser and navigate to `http://localhost:3000`.

### Option B: Development Mode (Hot-Reloading UI)

If you are actively making changes to the React UI and want to see your changes update instantly (Hot Module Replacement):

1. **Start the Server (Backend):**
   Open a terminal, go to the `server` folder, and start the backend.
   ```bash
   cd server
   npm start
   ```
2. **Start the Vite Dev Server (Frontend):**
   Open a *second* terminal, go to the `client` folder, and start Vite.
   ```bash
   cd client
   npm run dev
   ```
3. **Play:**
   Vite will give you a local URL (usually `http://localhost:5173`). Open that URL to play and develop! Note that in dev mode, Socket.IO in the React app will automatically proxy to your local port 3000 server.

---

## 🎨 Note on CSS Warnings in IDE
If your IDE (like VS Code) shows errors or warnings in `client/src/index.css` such as "Unknown at rule `@source`" or "`@theme`", **this is perfectly normal and expected**.

We are using **Tailwind CSS v4**, which introduces these new native CSS `@rules`. The standard VS Code CSS linter doesn't recognize them yet, but the Vite build process handles them perfectly. You can safely ignore these warnings.

To get rid of the red squiggly lines in VS Code, you can update your `.vscode/settings.json` with:
```json
{
  "css.lint.unknownAtRules": "ignore"
}
```

Enjoy playing PokerUrMemory!
