/**
 * WhatsApp Messaging Service
 *
 * Uses whatsapp-web.js (free, QR-code-based) to send WhatsApp messages.
 *
 * Two modes:
 *  - "web" (default): connects via WhatsApp Web, scan QR code once, session saved via LocalAuth
 *  - "console": logs messages to console for testing
 *
 * Switch modes by setting WHATSAPP_MODE=console in .env to disable real messaging.
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Mode Configuration ───────────────────────────────────────────────────────

const MODE_CONSOLE = 'console';
const MODE_WEB = 'web';

const MODE = (process.env.WHATSAPP_MODE || MODE_WEB).toLowerCase();

// ─── Client State ─────────────────────────────────────────────────────────────

let client = null;
let isReady = false;
let isInitialized = false;
let isManualReset = false;
let qrDisplayed = false;
let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

// State exposed via API
let latestQrDataUrl = null;
let connectedDeviceName = null;
let connectedPhoneNumber = null;
let connectionStatus = 'disconnected'; // 'connecting' | 'qr-ready' | 'connected' | 'disconnected' | 'auth_failure'

/**
 * Initialize the WhatsApp Web client.
 * Uses LocalAuth to persist the session so you only need to scan QR once.
 */
function initializeClient() {
  if (isInitialized) return;
  if (initAttempts >= MAX_INIT_ATTEMPTS) {
    console.error('[WHATSAPP] Max initialization attempts reached. Please restart the server.');
    return;
  }
  isManualReset = false;
  isInitialized = true;
  initAttempts++;

  if (MODE !== MODE_WEB) {
    console.log(`[WHATSAPP] Mode set to "${MODE}". WhatsApp client not initialized.`);
    return;
  }

  console.log('');
  console.log('━'.repeat(60));
  console.log('📱 [WHATSAPP] Initializing WhatsApp Web client...');
  console.log('   Using whatsapp-web.js (free, QR code authentication)');
  console.log('   Session saved via LocalAuth — scan QR once, stays logged in.');
  console.log('   Set WHATSAPP_MODE=console to disable real messaging.');
  console.log('━'.repeat(60));
  console.log('');

  // Use a session directory outside OneDrive to avoid file lock issues
  const sessionDir = process.env.WHATSAPP_SESSION_DIR || path.join(os.homedir(), '.whatsapp-session');
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  console.log(`[WHATSAPP] Session directory: ${sessionDir}`);

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionDir }),
    puppeteer: {
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--disable-extensions',
        '--disable-gpu',
        '--disable-sync',
      ],
    },
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1042150245-alpha.html',
    },
  });

  // ── QR Code Event ──────────────────────────────────────────────────────────
  client.on('qr', async (qr) => {
    // Generate data URL for the API
    try {
      latestQrDataUrl = await QRCode.toDataURL(qr);
    } catch (err) {
      console.error('[WHATSAPP] Failed to generate QR data URL:', err.message);
    }

    connectionStatus = 'qr-ready';
    connectedDeviceName = null;
    connectedPhoneNumber = null;

    if (!qrDisplayed) {
      qrDisplayed = true;
      console.log('');
      console.log('╔' + '═'.repeat(58) + '╗');
      console.log('║        📱  SCAN THE QR CODE WITH YOUR WHATSAPP APP         ║');
      console.log('╠' + '═'.repeat(58) + '╣');
      console.log('║  Open WhatsApp on your phone →                              ║');
      console.log('║  Menu (3 dots) or Settings → Linked Devices →               ║');
      console.log('║  Link a Device → Scan this QR code                          ║');
      console.log('╚' + '═'.repeat(58) + '╝');
      console.log('');
      qrcode.generate(qr, { small: true });
      console.log('');
    } else {
      console.log('[WHATSAPP] QR code refreshed. Scan the new code above.');
      qrcode.generate(qr, { small: true });
    }
  });

  // ── Ready Event ─────────────────────────────────────────────────────────────
  client.on('ready', async () => {
    isReady = true;
    connectionStatus = 'connected';
    connectedDeviceName = client.info?.pushname || 'WhatsApp User';
    connectedPhoneNumber = client.info?.wid?.user || null;
    latestQrDataUrl = null;

    const userInfo = client.info?.pushname || client.info?.wid?.user || 'Unknown';
    console.log('');
    console.log('━'.repeat(60));
    console.log(`✅ [WHATSAPP] Connected! ✅`);
    console.log(`   Name:    ${userInfo}`);
    console.log(`   Number:  ${client.info?.wid?.user || 'Unknown'}`);
    console.log('   Status:  Ready to send messages');
    console.log('━'.repeat(60));
    console.log('');

    // Pre-load contacts to populate LID mappings in the store.
    // WhatsApp's transition from JID (phone@c.us) to LID means we need
    // to sync contacts first so sendMessage can resolve the correct identifier.
    try {
      console.log('[WHATSAPP] Pre-loading contacts to sync LID mappings...');
      const contacts = await client.getContacts();
      console.log(`[WHATSAPP] ✓ Loaded ${contacts.length} contacts (LID mappings synced)`);
    } catch (err) {
      console.warn('[WHATSAPP] Could not pre-load contacts (will retry on send):', err.message);
    }
  });

  // ── Disconnected Event ──────────────────────────────────────────────────────
  client.on('disconnected', (reason) => {
    isReady = false;
    connectionStatus = 'disconnected';
    connectedDeviceName = null;
    connectedPhoneNumber = null;
    latestQrDataUrl = null;

    // If this disconnect was triggered by a manual reset, skip auto-reconnect —
    // resetConnection() already handles the reinitialization
    if (isManualReset) {
      console.log('[WHATSAPP] Manual reset in progress — skipping auto-reconnect.');
      return;
    }

    console.warn('');
    console.warn(`⚠️ [WHATSAPP] Disconnected: ${reason}`);
    console.warn('   Reconnecting in 10 seconds...');
    console.warn('');
    setTimeout(() => {
      isInitialized = false;
      qrDisplayed = false;
      client = null;
      initializeClient();
    }, 10000);
  });

  // ── Auth Failure Event ──────────────────────────────────────────────────────
  client.on('auth_failure', (msg) => {
    isReady = false;
    connectionStatus = 'auth_failure';
    connectedDeviceName = null;
    connectedPhoneNumber = null;
    latestQrDataUrl = null;
    console.error('');
    console.error('❌ [WHATSAPP] Authentication failed.');
    console.error(`   Reason: ${msg}`);
    console.error('   To re-authenticate:');
    console.error('   1. Stop the server');
    console.error('   2. Delete the ".wwebjs_auth" folder in the backend directory');
    console.error('   3. Restart the server to see the QR code again');
    console.error('');
  });

  client.initialize();
}

// Initialize the client when this module loads
initializeClient();

// ─── Phone Number Formatting ──────────────────────────────────────────────────

const DEFAULT_COUNTRY_CODE = process.env.WHATSAPP_COUNTRY_CODE || '212';

/**
 * Format a phone number to E.164 format (no +, no spaces, no leading zeros).
 * Handles:
 *  - "06XXXXXXXX" (local format) → "2126XXXXXXXX"
 *  - "+2126XXXXXXXX" → "2126XXXXXXXX"
 *  - "2126XXXXXXXX" → "2126XXXXXXXX"
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  // Already has country code
  if (digits.startsWith(DEFAULT_COUNTRY_CODE) && digits.length > 7) {
    return digits;
  }
  // Local number starting with 0 (e.g., 06XXXXXXXX)
  if (digits.startsWith('0')) {
    return DEFAULT_COUNTRY_CODE + digits.substring(1);
  }
  // Any other number with 10-15 digits, prepend country code
  if (digits.length >= 10 && digits.length <= 15) {
    return DEFAULT_COUNTRY_CODE + digits;
  }
  // Fallback
  return digits;
}

// ─── Console Mode ─────────────────────────────────────────────────────────────

function logToConsole(to, body) {
  console.log('─'.repeat(60));
  console.log(`📱 [WHATSAPP DEMO] To: ${to}`);
  console.log('─'.repeat(60));
  console.log(body);
  console.log('─'.repeat(60));
  console.log(`(Set WHATSAPP_MODE=web and scan QR code to send real messages.)`);
  console.log('─'.repeat(60));
  console.log('');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a WhatsApp message.
 *
 * In web mode, sends via whatsapp-web.js (requires QR scan on first run).
 * In console mode, logs to the terminal (for testing).
 *
 * @param {string} to - Recipient phone number (any common format)
 * @param {string} body - Message text content
 * @returns {Promise<{success: boolean, error?: string, mode?: string, to?: string}>}
 */
async function sendMessage(to, body) {
  const formattedNumber = formatPhoneNumber(to);
  if (!formattedNumber) {
    console.warn(`[WHATSAPP] Cannot send message: invalid phone number "${to}"`);
    return { success: false, error: 'Invalid phone number' };
  }

  if (MODE === MODE_WEB) {
    // Check if client is ready
    if (!client) {
      return { success: false, error: 'WhatsApp client not initialized. Restart the server.' };
    }
    if (!isReady) {
      return {
        success: false,
        error: 'WhatsApp client not ready yet. Scan the QR code displayed in the server console.',
      };
    }

    try {
      return await attemptSend(formattedNumber, body);
    } catch (error) {
      console.error(`[WHATSAPP] ✗ Failed to send message to ${formattedNumber}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Console mode (default when WHATSAPP_MODE=console)
  logToConsole(formattedNumber, body);
  return { success: true, mode: 'console', to: formattedNumber };
}

/**
 * Attempt to send a message, with LID-safe WID resolution.
 *
 * WhatsApp's transition from JID (phone@c.us) to LID (Linked ID) means
 * that sending to "phone@c.us" can fail because the library's internal
 * getChat() can't resolve the JID to a LID.
 *
 * The fix: use client.getNumberId() first — it queries WhatsApp Web's
 * QueryExist endpoint which properly resolves phone numbers to their
 * current WID (whether @c.us or @lid). Then send to the resolved WID.
 */
async function attemptSend(formattedNumber, body) {
  console.log(`[WHATSAPP] Sending message to ${formattedNumber}...`);

  // Resolve the phone number to its current WhatsApp WID
  // getNumberId() uses QueryExist internally, which properly handles LID resolution
  let resolvedWid = null;
  try {
    resolvedWid = await client.getNumberId(formattedNumber);
  } catch (resolveErr) {
    console.warn(`[WHATSAPP] getNumberId() failed for ${formattedNumber}: ${resolveErr.message}`);
  }

  if (resolvedWid && resolvedWid._serialized) {
    console.log(`[WHATSAPP] Resolved ${formattedNumber} → ${resolvedWid._serialized}`);
  }

  // Use resolved WID if available, otherwise fall back to JID format
  const chatId = resolvedWid?._serialized || `${formattedNumber}@c.us`;

  try {
    const result = await client.sendMessage(chatId, body);
    console.log(`[WHATSAPP] ✓ Message sent successfully to ${formattedNumber}`);
    return { success: true, messageId: result?.id?._serialized || 'sent' };
  } catch (error) {
    // If the error is LID-related, try one more time with a fresh contact sync
    const isLidError =
      error.message?.includes('No LID for user') ||
      error.message?.includes('Lid is missing') ||
      error.message?.includes('asUserWidOrThrow') ||
      error.message?.includes('toUserLidOrThrow');

    if (isLidError) {
      console.warn(`[WHATSAPP] LID error for ${formattedNumber}. Syncing contacts and retrying...`);
      try {
        await client.getContacts();
        console.log('[WHATSAPP] Contacts synced, resolving number again...');
        // Try resolving the number again after sync
        const retryWid = await client.getNumberId(formattedNumber);
        const retryChatId = retryWid?._serialized || `${formattedNumber}@c.us`;
        if (retryWid) {
          console.log(`[WHATSAPP] After sync, resolved ${formattedNumber} → ${retryChatId}`);
        }          const result = await client.sendMessage(retryChatId, body);
          console.log(`[WHATSAPP] ✓ Message sent successfully to ${formattedNumber} (after LID resolution)`);
          return { success: true, messageId: result?.id?._serialized || 'sent' };
        } catch (retryError) {
        console.error(`[WHATSAPP] ✗ Retry also failed for ${formattedNumber}: ${retryError.message}`);
        throw retryError;
      }
    }

    // Not a LID error, throw as-is
    throw error;
  }
}

/**
 * Get the current status of the WhatsApp service.
 * @returns {string} Human-readable status description
 */
function getMode() {
  if (MODE === MODE_CONSOLE) return 'console';
  if (isReady) return 'whatsapp-web (connected)';
  if (client) return 'whatsapp-web (awaiting QR scan)';
  return 'whatsapp-web (initializing)';
}

/**
 * Check if the WhatsApp client is ready to send messages.
 * @returns {boolean}
 */
function isClientReady() {
  return MODE === MODE_WEB && client !== null && isReady;
}

/**
 * Get the full connection details for the frontend.
 * @returns {{ status: string, qrDataUrl: string|null, deviceName: string|null, phoneNumber: string|null, mode: string }}
 */
function getConnectionDetails() {
  let status;
  if (MODE !== MODE_WEB) {
    status = 'console_mode';
  } else if (isReady) {
    status = 'connected';
  } else if (connectionStatus === 'auth_failure') {
    status = 'auth_failure';
  } else if (connectionStatus === 'qr-ready' || latestQrDataUrl) {
    status = 'qr_ready';
  } else if (isInitialized) {
    status = 'connecting';
  } else {
    status = 'disconnected';
  }

  return {
    status,
    mode: MODE,
    qrDataUrl: latestQrDataUrl,
    deviceName: connectedDeviceName,
    phoneNumber: connectedPhoneNumber,
    isConnected: isReady,
  };
}

/**
 * Reset the WhatsApp client connection (destroy + reinitialize).
 * This forces a fresh QR code scan.
 */
async function resetConnection() {
  // Signal that this is a manual reset so the disconnected event handler
  // does not attempt its own auto-reconnect
  isManualReset = true;

  if (client) {
    try {
      // client.destroy() closes the Puppeteer browser — this is async.
      // We MUST await it so Chrome finishes flushing session data to disk
      // before we delete the auth directory. Otherwise Chrome could recreate
      // the session files after we've deleted them.
      await Promise.race([
        client.destroy(),
        new Promise(resolve => setTimeout(resolve, 10000)), // safety timeout
      ]);
    } catch (e) {
      console.warn('[WHATSAPP] Error destroying client:', e.message);
    }
  }

  // Extra wait to ensure Chrome has fully flushed any pending writes
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Clear the LocalAuth session data so the next initialization generates a fresh QR code
  const sessionDir = process.env.WHATSAPP_SESSION_DIR || path.join(os.homedir(), '.whatsapp-session');
  if (fs.existsSync(sessionDir)) {
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log('[WHATSAPP] ✓ LocalAuth session data cleared.');
    } catch (e) {
      console.warn('[WHATSAPP] Error clearing LocalAuth session:', e.message);
    }
  }

  // Also clean up old OneDrive-locked .wwebjs_auth if it exists
  const oldAuthDir = path.join(__dirname, '../../.wwebjs_auth');
  if (fs.existsSync(oldAuthDir)) {
    try {
      fs.rmSync(oldAuthDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore - OneDrive may have it locked
    }
  }

  client = null;
  isReady = false;
  isInitialized = false;
  qrDisplayed = false;
  initAttempts = 0;
  latestQrDataUrl = null;
  connectedDeviceName = null;
  connectedPhoneNumber = null;
  connectionStatus = 'disconnected';

  // Reinitialize the client — with the auth data gone, it will generate a new QR code
  setTimeout(() => {
    initializeClient();
  }, 1000);
}

/**
 * Send a media file via WhatsApp.
 *
 * @param {string} to - Recipient phone number (any common format)
 * @param {Buffer} fileBuffer - File content as a Buffer
 * @param {string} filename - Display filename (e.g. "invoice-123.pdf")
 * @param {string} mimeType - MIME type (e.g. "application/pdf")
 * @param {string} [caption] - Optional text caption
 * @returns {Promise<{success: boolean, error?: string, mode?: string}>}
 */
async function sendMedia(to, fileBuffer, filename, mimeType, caption) {
  const formattedNumber = formatPhoneNumber(to);
  if (!formattedNumber) {
    return { success: false, error: 'Invalid phone number' };
  }

  if (MODE === MODE_WEB) {
    if (!client) return { success: false, error: 'WhatsApp client not initialized.' };
    if (!isReady) return { success: false, error: 'WhatsApp client not ready yet. Scan QR code.' };

    try {
      const base64Data = fileBuffer.toString('base64');
      const media = new MessageMedia(mimeType, base64Data, filename);

      // Resolve number to WID (same LID-safe approach as sendMessage)
      let resolvedWid = null;
      try {
        resolvedWid = await client.getNumberId(formattedNumber);
      } catch (e) {
        // ignore
      }
      const chatId = resolvedWid?._serialized || `${formattedNumber}@c.us`;

      const sendOptions = {};
      if (caption) sendOptions.caption = caption;

      const result = await client.sendMessage(chatId, media, sendOptions);
      console.log(`[WHATSAPP] ✓ Media sent successfully to ${formattedNumber} (${filename})`);
      return { success: true, messageId: result?.id?._serialized || 'sent' };
    } catch (error) {
      console.error(`[WHATSAPP] ✗ Failed to send media to ${formattedNumber}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Console mode
  console.log('─'.repeat(60));
  console.log(`📱 [WHATSAPP DEMO] To: ${formattedNumber}`);
  console.log(`📎 File: ${filename} (${mimeType}, ${(fileBuffer.length / 1024).toFixed(1)} KB)`);
  if (caption) console.log(`📝 Caption: ${caption}`);
  console.log('─'.repeat(60));
  console.log(`(Set WHATSAPP_MODE=web and scan QR code to send real messages.)`);
  console.log('─'.repeat(60));
  return { success: true, mode: 'console', to: formattedNumber };
}

module.exports = {
  sendMessage,
  sendMedia,
  getMode,
  isClientReady,
  getConnectionDetails,
  resetConnection,
  MODE_CONSOLE,
  MODE_WEB,
};
