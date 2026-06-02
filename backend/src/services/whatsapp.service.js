/**
 * WhatsApp Messaging Service
 *
 * Supports two modes:
 *  - "console" (default): logs messages to console for testing
 *  - "live": sends real WhatsApp messages via Meta Cloud API
 *
 * Switch modes by setting WHATSAPP_MODE=live in .env.
 * You'll also need WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN for live mode.
 */

const https = require('https');

const MODE_CONSOLE = 'console';
const MODE_LIVE = 'live';

const MODE = (process.env.WHATSAPP_MODE || MODE_CONSOLE).toLowerCase();
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v23.0';

function getBaseUrl() {
  return `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
}

/**
 * Format a phone number to E.164 format for WhatsApp.
 * Patients may store numbers in various formats, so we strip non-digits
 * and prepend the country code if needed.
 *
 * For demo purposes, we assume the numbers are already in a reasonable format.
 * In production, you'd want to normalize based on the clinic's country.
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;
  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, '');
  // If it starts with 0 (e.g., 05xx xxx xxx), assume it needs a country code
  // For demo, we'll just return the digits as-is and let the API handle formatting
  return digits;
}

/**
 * Send a message via the Meta Cloud API.
 * @param {string} to - Recipient phone number in E.164 format
 * @param {string} body - Message text content
 * @returns {Promise<Object>} Result object
 */
function sendViaApi(to, body) {
  return new Promise((resolve, reject) => {
    const url = getBaseUrl();
    const parsedUrl = new URL(url);
    const data = JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body },
    });

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => (responseData += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, data: parsed, statusCode: res.statusCode });
          } else {
            resolve({ success: false, data: parsed, statusCode: res.statusCode });
          }
        } catch (e) {
          resolve({ success: false, error: e.message, raw: responseData, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    req.write(data);
    req.end();
  });
}

/**
 * Log a message to the console with a formatted prefix.
 * @param {string} to - Recipient phone number
 * @param {string} body - Message text content
 */
function logToConsole(to, body) {
  console.log('─'.repeat(60));
  console.log(`📱 [WHATSAPP DEMO] To: ${to}`);
  console.log('─'.repeat(60));
  console.log(body);
  console.log('─'.repeat(60));
  console.log(`(Messages are logged to console. Set WHATSAPP_MODE=live to send real messages.)`);
  console.log('─'.repeat(60));
  console.log('');
}

/**
 * Send a WhatsApp message.
 *
 * In console mode, the message is logged to the console.
 * In live mode, the message is sent via the Meta Cloud API.
 *
 * @param {string} to - Recipient phone number
 * @param {string} body - Message text
 * @returns {Promise<Object>} Result object with { success, data/error }
 */
async function sendMessage(to, body) {
  const formattedNumber = formatPhoneNumber(to);

  if (!formattedNumber) {
    console.warn(`[WHATSAPP] Cannot send message: invalid phone number "${to}"`);
    return { success: false, error: 'Invalid phone number' };
  }

  if (MODE === MODE_LIVE) {
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
      console.error('[WHATSAPP] Live mode requires WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN env vars');
      return { success: false, error: 'Missing WhatsApp configuration' };
    }
    console.log(`[WHATSAPP] Sending live message to ${formattedNumber}...`);
    const result = await sendViaApi(formattedNumber, body);
    if (result.success) {
      console.log(`[WHATSAPP] Message sent successfully to ${formattedNumber}`);
    } else {
      console.error(`[WHATSAPP] Failed to send message to ${formattedNumber}:`, result.error || JSON.stringify(result.data));
    }
    return result;
  }

  // Console mode (default)
  logToConsole(formattedNumber, body);
  return { success: true, mode: 'console', to: formattedNumber };
}

/**
 * Get the current mode: 'console' or 'live'
 */
function getMode() {
  return MODE;
}

module.exports = {
  sendMessage,
  getMode,
  MODE_CONSOLE,
  MODE_LIVE,
};
