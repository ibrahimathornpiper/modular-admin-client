# Client API Proxy (Admin Panel)

This is the lightweight, SQLite-backed proxy application meant to be deployed on your users' servers.
It acts as a secure middleman between the client's local applications and the central License Management Server.

## Key Features
- **Strict Prefixing:** All routes, APIs, and UIs live under `/admin`. The root domain (`/`) remains completely free for your clients to host their own primary websites.
- **SQLite Storage:** Uses `sqlite3` to locally store admin credentials and panel configurations without relying on environment variables.
- **Premium UI:** Glassmorphism, modern Tailwind CSS, and dynamic styling allowing you to inject primary HEX colors on the fly.
- **Local Authentication:** Admin accounts are securely hashed with `bcryptjs`.

## Deployment Instructions

### Requirements
- Node.js (v18+)
- Phusion Passenger (if using cPanel/Plesk) or PM2 (if using a VPS).

### 1. Uploading Files
Upload the entire `client-proxy` folder to your server.
**Do not** upload the `node_modules` folder or `data` folder if you want a clean installation.

### 2. Install Dependencies
Connect via SSH to your server, navigate to the folder, and run:
```bash
npm install --production
```

### 3. Running the App (PM2)
If you are deploying on a plain VPS using PM2:
```bash
pm2 start src/index.js --name "client-proxy"
```
Ensure your reverse proxy (e.g., Nginx) forwards requests for `/admin` to `http://127.0.0.1:3000`.

### 4. Running the App (Passenger / cPanel)
If using Phusion Passenger, simply set the Application URL to `/admin`.
Passenger will automatically use `package.json`'s `main` file (`index.js`) and assign the `PORT` dynamically.

## Installation & Setup
1. Visit the panel in your browser (e.g., `https://client.example.com/admin`).
2. You will be automatically redirected to `/admin/install`.
3. Complete the 3-Step Wizard:
   - **Step 1:** Enter your new local Admin Email and Password.
   - **Step 2:** Upload a Logo, enter a Panel Name, and pick a Primary HEX color.
   - **Step 3:** Paste the JWT License Key provided by the central system.
4. After submission, log in using your newly created credentials.
5. You can always update these settings later from the internal `/admin/settings` page!
