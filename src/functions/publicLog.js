const config = require('../../config.json');

/**
 * Sends a public log message to the configured channel.
 * @param {Client} client - The Discord client.
 * @param {string} message - The message to send (can include mentions).
 */
async function sendPublicLog(client, message) {
  const channel = await client.channels.fetch(config.publicLogChannelId).catch(() => null);
  if (!channel) return;
  channel.send({ content: message });
}

module.exports = { sendPublicLog }; 