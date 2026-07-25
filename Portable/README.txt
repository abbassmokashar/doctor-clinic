╔══════════════════════════════════════════════════════════════╗
║                   Doctor Clinic Portable                    ║
║              Management System for Clinics                  ║
╚══════════════════════════════════════════════════════════════╝

────────────────────────────────────────────────────────────────
  SYSTEM REQUIREMENTS
────────────────────────────────────────────────────────────────

• Windows 10/11, macOS, or Linux
• Node.js 18 or later (download from https://nodejs.org/)
• 2 GB RAM minimum, 500 MB free disk space
• A web browser (Chrome, Edge, Firefox, or Safari)

────────────────────────────────────────────────────────────────
  HOW TO RUN
────────────────────────────────────────────────────────────────

  Windows (simplest):
    1. Double-click  start.vbs
       - This will install dependencies, set up the database,
         and start the server automatically.
    2. Your browser will open to http://localhost:3000

  Windows (alternative):
    1. Double-click  Start Clinic.bat
    2. Wait for the server to start
    3. Open your browser to http://localhost:3000

  macOS / Linux:
    1. Open Terminal in this folder
    2. Run:  bash start.sh
    3. Open your browser to http://localhost:3000

────────────────────────────────────────────────────────────────
  FIRST-TIME SETUP — LICENSE ACTIVATION
────────────────────────────────────────────────────────────────

  When you open the application for the first time, a license
  activation page will appear.

  1. Copy the "Hardware ID" shown on the page
  2. Send this Hardware ID to your software provider
  3. You will receive a .lic license file in return
  4. Upload the .lic file on the activation page (or drag & drop)
  5. Your application will activate and you can log in

  Note: Without a valid license, the application will not work.
  Contact your provider to obtain a license.

────────────────────────────────────────────────────────────────
  LOGIN CREDENTIALS
────────────────────────────────────────────────────────────────

  Email:              Password:
  ─────────────────────────────────────
  admin@clinic.com    admin123          (Admin — full access)
  superadmin@clinic.com  superadmin123  (Super Admin)
  reception@clinic.com   reception123   (Receptionist)
  sarah.johnson@clinic.com  doctor123   (Doctor)
  michael.chen@clinic.com    doctor123  (Doctor)
  emma.rodriguez@clinic.com  doctor123  (Doctor)
  james.wilson@clinic.com    doctor123  (Doctor)
  olivia.patel@clinic.com    doctor123  (Doctor)

────────────────────────────────────────────────────────────────
  HOW TO STOP
────────────────────────────────────────────────────────────────

  Windows:
    • Double-click  stop.vbs
    - OR -
    • Close the terminal window running the server

  macOS / Linux:
    • Press Ctrl+C in the terminal where the server is running

────────────────────────────────────────────────────────────────
  DEFAULT PORTS
────────────────────────────────────────────────────────────────

  • Application: http://localhost:3000

────────────────────────────────────────────────────────────────
  TROUBLESHOOTING
────────────────────────────────────────────────────────────────

  1. "Node.js is not installed"
     → Download and install Node.js from https://nodejs.org/
     → Restart your computer after installing

  2. "Port 3000 already in use"
     → Another program is using port 3000
     → Close the other program, or restart your computer
     → Try running stop.vbs first

  3. "License activation failed"
     → Make sure your .lic file was generated for THIS computer
     → The Hardware ID on the activation page must match the
       one sent to your provider
     → Check that your system clock is set correctly

  4. Application won't start
     → Make sure Node.js is installed (run: node --version)
     → Delete the  node_modules  folder and the  prisma/dev.db
       file, then try running start.vbs again
     → Check Windows Firewall isn't blocking Node.js

────────────────────────────────────────────────────────────────
  SUPPORT
────────────────────────────────────────────────────────────────

  For technical support or license inquiries, contact your
  software provider.

────────────────────────────────────────────────────────────────
  VERSION
────────────────────────────────────────────────────────────────

  Doctor Clinic Portable v1.0.0
  Built: July 2026
