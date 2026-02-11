const { SlashCommandBuilder } = require('discord.js');
const { showScrimStatus } = require('../../functions/scrimHandlers.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scrim-status')
        .setDescription('View current scrim registration status'),

    async execute(interaction, client) {
        await showScrimStatus(interaction);
    }
}; 