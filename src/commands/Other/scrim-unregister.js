const { SlashCommandBuilder } = require('discord.js');
const { handleScrimUnregister } = require('../../functions/scrimHandlers.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scrim-unregister')
        .setDescription('Unregister your team from scrim matches'),

    async execute(interaction, client) {
        await handleScrimUnregister(interaction);
    }
}; 