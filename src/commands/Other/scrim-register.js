const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getEnrolledTeam } = require('../../functions/database.js');
const { showScrimTimeSelection, handleScrimTimeSelection, handleScrimUnregister, showAndUnregisterScrim, handleScrimUnregisterButton, getAvailableLocations, locations, sendToLogChannel, sendToScrimChannel } = require('../../functions/scrimHandlers');
const { getTimeLabel } = require('../../functions/teamHandlers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scrim-register')
        .setDescription('Register your team for a scrim match!')
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Select your preferred scrim time')
                .setRequired(true)
                .addChoices(
                    { name: '1:00 PM IST', value: '13:00' },
                    { name: '2:00 PM IST', value: '14:00' },
                    { name: '3:00 PM IST', value: '15:00' },
                    { name: '4:00 PM IST', value: '16:00' },
                    { name: '5:00 PM IST', value: '17:00' },
                    { name: '6:00 PM IST', value: '18:00' },
                    { name: '7:00 PM IST', value: '19:00' },
                    { name: '8:00 PM IST', value: '20:00' },
                    { name: '9:00 PM IST', value: '21:00' },
                    { name: '10:00 PM IST', value: '22:00' },
                    { name: '11:00 PM IST', value: '23:00' },
                    { name: '12:00 PM IST', value: '24:00' },
                )
        )
        .addStringOption(option =>
            option.setName('location')
                .setDescription('Select your drop location')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const time = interaction.options.getString('time');
        const location = interaction.options.getString('location');
        const userId = interaction.user.id;
        const teamData = await getEnrolledTeam(userId);
        const { findUserScrimRegistration } = require('../../functions/database.js');
        const existingRegistration = await findUserScrimRegistration(userId);
        if (existingRegistration) {
            const regLocation = existingRegistration.registration?.teamData?.location;
            await interaction.editReply({ 
                content: regLocation
                    ? `\u274c You are already registered for a scrim slot with drop location **${regLocation}**. Please unregister first before registering again.`
                    : '\u274c You are already registered for a scrim slot. Please unregister first before registering again.'
            });
            return;
        }
        if (!teamData) {
            await interaction.editReply({ content: '\u274c You need to enroll a team first!' });
            return;
        }
        let available = await getAvailableLocations();
        if (!available.map(l => l.name).includes(location)) {
            await interaction.editReply({ content: `\u274c The location **${location}** is already taken. Please select another location.` });
            return;
        }
        const { getAllScrimSlots } = require('../../functions/database.js');
        const allSlots = await getAllScrimSlots();
        const allRegistrations = Object.values(allSlots).flat();
        if (allRegistrations.some(reg => reg.teamData.location === location)) {
            await interaction.editReply({ content: `❌ The location **${location}** was just taken by another team. Please select another location.` });
            return;
        }
        const teamDataObj = typeof teamData.toObject === 'function' ? teamData.toObject() : teamData;
        const teamDataWithLocation = { ...teamDataObj, location };
        const registrationData = {
            teamData: teamDataWithLocation,
            registrationTime: Date.now(),
            user: {
                id: interaction.user.id,
                username: interaction.user.username,
                displayName: interaction.user.displayName,
                avatarURL: interaction.user.displayAvatarURL()
            }
        };
        const { setScrimRegistration } = require('../../functions/database.js');
        await setScrimRegistration(time, userId, registrationData);
        await sendToScrimChannel(interaction, teamDataWithLocation, getTimeLabel(time), time, teamData.players.length);
        await sendToLogChannel(interaction, teamDataWithLocation, getTimeLabel(time), time, 'SCRIM_REGISTER');
        await interaction.editReply({ content: `\u2705 Registered for scrim at ${getTimeLabel(time)} in location ${location}.` });
    },

    async autocomplete(interaction) {
        console.log('[DEBUG] Autocomplete handler called');
        const focusedValue = interaction.options.getFocused();
        console.log('[DEBUG] Focused value:', focusedValue);
        let available = [];
        try {
            available = await getAvailableLocations();
            console.log('[DEBUG] Available locations:', available.map(l => l.name));
        } catch (err) {
            console.error('[DEBUG] Error in getAvailableLocations:', err);
            await interaction.respond([]);
            return;
        }
        const filtered = available.filter(loc => loc.name.toLowerCase().includes(focusedValue.toLowerCase()));
        console.log('[DEBUG] Filtered locations:', filtered.map(l => l.name));
        await interaction.respond(
            filtered.slice(0, 25).map(loc => ({ name: loc.name, value: loc.name }))
        );
    }
}; 