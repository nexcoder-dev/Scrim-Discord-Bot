const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getAllScrimSlots } = require('../../functions/database.js');

function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = (ms / 1000) % 60;
    return `${hours} hours, ${minutes} minutes and ${seconds.toFixed(2)} seconds`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slotlist')
        .setDescription('Show the ZX Scrims Slotlist.'),
    async execute(interaction) {
        const allSlots = await getAllScrimSlots();
        const teams = [];
        for (const slot in allSlots) {
            for (const reg of allSlots[slot]) {
                if (reg.teamData && reg.teamData.teamName) {
                    teams.push({ name: reg.teamData.teamName, registrationTime: new Date(reg.registrationTime).getTime() });
                }
            }
        }
        let slotlistText = '';
        teams.forEach((team, i) => {
            slotlistText += `\nSlot ${String(i + 1).padStart(2, '0')}  ->  ${team.name}`;
        });
        if (slotlistText === '') slotlistText = '\nNo registrations yet.';
        let regDuration = '';
        if (teams.length > 0) {
            const times = teams.map(t => t.registrationTime);
            const min = Math.min(...times);
            const max = Math.max(...times);
            regDuration = formatDuration(max - min);
        }
        const embed = new EmbedBuilder()
            .setTitle('ZX Scrims Slotlist')
            .setDescription('```' + slotlistText.trim() + '```')
            .setColor('#0099ff');
        if (teams.length > 0) {
            embed.setFooter({ text: `Registration took: ${regDuration}` });
        } else {
            embed.setFooter({ text: 'No registrations yet.' });
        }
        await interaction.reply({ embeds: [embed], ephemeral: false });
    },
}; 