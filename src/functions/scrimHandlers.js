const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { 
    getEnrolledTeam, 
    getScrimRegistration,
    setScrimRegistration,
    deleteScrimRegistration,
    getAllScrimRegistrations,
    findUserScrimRegistration,
    getAllScrimSlots
} = require('./database.js');
const { getTimeLabel, getTimeLabels } = require('./teamHandlers.js');
const config = require('../../config.json');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

const locations = [
    { name: 'JHARNA', x: 396, y: 122 },
    { name: 'COMPOUND', x: 462, y: 236 },
    { name: 'VYAPAAR CENTER', x: 627, y: 245 },
    { name: 'JATAYU BAZAAR', x: 856, y: 281 },
    { name: 'GUFA', x: 296, y: 292 },
    { name: 'NIUAAS', x: 182, y: 287 },
    { name: 'URJA VALLEY', x: 155, y: 498 },
    { name: 'QUARRY', x: 286, y: 469 },
    { name: 'KOLAR', x: 129, y: 649 },
    { name: 'STORAGE', x: 137, y: 744 },
    { name: 'DATA FARM', x: 186, y: 895 },
    { name: 'GURUKUL', x: 325, y: 836 },
    { name: 'VIKRAM LABS', x: 442, y: 940 },
    { name: 'PRIME SETU', x: 467, y: 794 },
    { name: 'GHERA', x: 340, y: 657 },
    { name: 'REFINERY', x: 726, y: 457 },
    { name: 'SHRINE', x: 434, y: 453 },
    { name: 'NAKA', x: 426, y: 588 },
    { name: 'SARISKA', x: 497, y: 652 },
    { name: 'TRIKON', x: 649, y: 967 },
    { name: 'LOK TERMINAL', x: 617, y: 867 },
    { name: 'MOTHER TREE', x: 771, y: 861 },
    { name: 'OBRA NAGAR', x: 805, y: 704 },
    { name: 'CHAR MARG', x: 754, y: 637 },
    { name: 'VIHAR COMPLEX', x: 659, y: 610 },
    { name: 'HAVELI', x: 806, y: 378 },
    { name: 'AIRAVAT FOUNDRY', x: 941, y: 605 }
];

const getAvailableLocations = async () => {
    const allRegs = await getAllScrimRegistrations();
    const taken = new Set(allRegs.map(reg => reg.location));
    return locations.filter(loc => !taken.has(loc.name));
};

async function drawTeamOnMap(teamName, locationName) {
    const mapPath = path.join(__dirname, '../assets/WhatsApp_Image_2025-07-02_at_14.44.26_37582c76.jpg');
    const mapImg = await loadImage(mapPath);
    const canvas = createCanvas(mapImg.width, mapImg.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(mapImg, 0, 0);
    const loc = locations.find(l => l.name === locationName);
    if (!loc) throw new Error('Location not found');
    ctx.save();
    ctx.beginPath();
    ctx.arc(loc.x, loc.y, 18, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#222';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeText(teamName, loc.x, loc.y + 20);
    ctx.fillText(teamName, loc.x, loc.y + 20);
    ctx.restore();
    return canvas.toBuffer();
}

async function drawAllTeamsOnMap(registrations) {
    console.log('[DEBUG] Drawing all teams on map. Registrations:', registrations.map(r => ({ team: r.teamData.teamName, location: r.teamData.location })));
    const mapPath = path.join(__dirname, '../assets/WhatsApp_Image_2025-07-02_at_14.44.26_37582c76.jpg');
    const mapImg = await loadImage(mapPath);
    const canvas = createCanvas(mapImg.width, mapImg.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(mapImg, 0, 0);
    for (const reg of registrations) {
        const locName = reg.teamData.location;
        const teamName = reg.teamData.teamName;
        if (!locName) continue;
        const loc = locations.find(l => l.name === locName);
        if (!loc) {
            console.log(`[DEBUG] Location not found for: ${locName}`);
            continue;
        }
        console.log(`[DEBUG] Drawing team: ${teamName} at (${loc.x}, ${loc.y}) for location ${locName}`);
        ctx.save();
        ctx.beginPath();
        ctx.arc(loc.x, loc.y, 18, 0, 2 * Math.PI);
        ctx.fillStyle = '#FF0000'; 
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#222';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeText(teamName, loc.x, loc.y - 20);
        ctx.fillText(teamName, loc.x, loc.y - 20);
        ctx.restore();
    }
    return canvas.toBuffer();
}

const handleScrimTimeSelection = async (interaction) => {
    const userId = interaction.user.id;
    const selectedTime = interaction.values[0];
    const teamData = await getEnrolledTeam(userId);

    if (!teamData) {
        await interaction.reply({ content: '❌ Team data not found. Please enroll your team first.', ephemeral: true });
        return;
    }

    const currentRegistration = await findUserScrimRegistration(userId);
    if (currentRegistration) {
        await deleteScrimRegistration(currentRegistration.timeSlot, userId);
    }

    const registrationData = {
        teamData,
        registrationTime: Date.now(),
        user: {
            id: interaction.user.id,
            username: interaction.user.username,
            displayName: interaction.user.displayName,
            avatarURL: interaction.user.displayAvatarURL()
        }
    };
    
    await setScrimRegistration(selectedTime, userId, registrationData);

    const selectedTimeLabel = getTimeLabel(selectedTime);
    const allRegistrations = await getAllScrimRegistrations(selectedTime);
    const registeredTeams = allRegistrations.length;

    const scrimEmbed = new EmbedBuilder()
        .setTitle('✅ Scrim Registration Successful!')
        .setDescription(`Your team has been registered for scrim matches!`)
        .addFields(
            { name: '🏷️ Team Name', value: teamData.teamName, inline: true },
            { name: '🔖 Team Tag', value: teamData.teamTag, inline: true },
            { name: '⏰ Scrim Time', value: selectedTimeLabel, inline: true },
            { name: '📊 Slot Status', value: `${registeredTeams} teams registered`, inline: true },
            { name: '📅 Registration Time', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
            { name: '🎯 Next Steps', value: 'Wait for match announcements in scrim channel', inline: true },
            { name: '👥 Your Team', value: teamData.players.slice(0, 10).map((p, i) => {
                if (typeof p === 'object' && p.id && p.name) {
                    return `${i + 1}. <@${p.id}> - ${p.name}`;
                } else if (typeof p === 'string') {
                    return `${i + 1}. ${p}`;
                } else {
                    return `${i + 1}. Unknown Player`;
                }
            }).join('\n') + (teamData.players.length > 10 ? `\n... and ${teamData.players.length - 10} more` : ''), inline: false }
        )
        .setColor('#00FF00')
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();

    await interaction.reply({ embeds: [scrimEmbed], ephemeral: true });

    await sendToScrimChannel(interaction, teamData, selectedTimeLabel, selectedTime, registeredTeams);
    await sendToLogChannel(interaction, teamData, selectedTimeLabel, selectedTime, 'SCRIM_REGISTER');
};

const handleScrimLocationSelection = async (interaction) => {
    const userId = interaction.user.id;
    const selectedLocation = interaction.values[0];
    await interaction.reply({ content: `📍 Location selected: **${selectedLocation}**. Now select your scrim time.`, ephemeral: true });
};

const sendToScrimChannel = async (interaction, teamData, timeLabel, timeValue, teamCount) => {
    const scrimChannelId = config.logging.SCRIM_CHANNEL_ID;
    const scrimChannel = interaction.guild?.channels.cache.get(scrimChannelId);
    let mapAttachment = null;
    if (teamData.location) {
        try {
            const allSlots = await getAllScrimSlots();
            const allRegistrations = Object.values(allSlots).flat();
            const mapBuffer = await drawAllTeamsOnMap(allRegistrations);
            mapAttachment = { files: [{ attachment: mapBuffer, name: 'scrim_map_marked.png' }] };
        } catch (err) {
            console.error('Error drawing teams on map:', err);
        }
    }
    if (scrimChannel) {
        const publicScrimEmbed = new EmbedBuilder()
            .setTitle('🚀 New Scrim Registration!')
            .setDescription(`Team **${teamData.teamName}** is ready for battle!`)
            .addFields(
                { name: '🏷️ Team', value: `${teamData.teamName} [${teamData.teamTag}]`, inline: true },
                { name: '⏰ Time Slot', value: timeLabel, inline: true },
                { name: '📊 Slot Status', value: `${teamCount} teams registered`, inline: true },
                { name: '👤 Team Leader', value: `${interaction.user}`, inline: true },
                { name: '👥 Team Size', value: `${teamData.players.length} players`, inline: true },
                { name: '📅 Registered', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: '📍 Location', value: teamData.location || 'N/A', inline: true }
            )
            .setColor('#FFD700')
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: `Registration ID: ${interaction.user.id}-${timeValue}` });
        if (mapAttachment) {
            await scrimChannel.send({ embeds: [publicScrimEmbed], ...mapAttachment });
        } else {
            await scrimChannel.send({ embeds: [publicScrimEmbed] });
        }
    }
};

const sendToLogChannel = async (interaction, teamData, timeLabel, timeValue, action) => {
    const logChannelId = config.logging.LOG_CHANNEL_ID;
    const logChannel = interaction.guild?.channels.cache.get(logChannelId);
    
    if (logChannel) {
        const logEmbed = new EmbedBuilder()
            .setTitle(`📋 ${action} Log`)
            .setDescription('Detailed registration information')
            .addFields(
                { name: '👤 User', value: `${interaction.user} (${interaction.user.id})`, inline: false },
                { name: '🏷️ Team Details', value: `${teamData.teamName} [${teamData.teamTag}]`, inline: true },
                { name: '⏰ Selected Time', value: `${timeLabel} (${timeValue})`, inline: true },
                { name: '👥 Players Count', value: `${teamData.players.length}`, inline: true },
                { name: '📅 Action Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                { name: '🔢 Session ID', value: `${Date.now()}`, inline: true },
                { name: '📊 Enrollment Date', value: `<t:${Math.floor(teamData.enrollmentTime / 1000)}:F>`, inline: true },
                { name: '📝 Player List', value: teamData.players.slice(0, 15).map((p, i) => {
                    if (typeof p === 'object' && p.id && p.name) {
                        return `${i + 1}. <@${p.id}> - ${p.name}`;
                    } else if (typeof p === 'string') {
                        return `${i + 1}. ${p}`;
                    } else {
                        return `${i + 1}. Unknown Player`;
                    }
                }).join('\n') + (teamData.players.length > 15 ? `\n... and ${teamData.players.length - 15} more players` : ''), inline: false }
            )
            .setColor('#4A90E2')
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: `Log ID: ${action}-${Date.now()}` });

        await logChannel.send({ embeds: [logEmbed] });
    }
};

const showScrimStatus = async (interaction) => {
    const allRegistrations = [];
    const timeLabels = getTimeLabels();
    const timeSlots = ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];
    
    for (const timeSlot of timeSlots) {
        const registrations = await getAllScrimRegistrations(timeSlot);
        
        if (registrations.length > 0) {
            const teamList = registrations.map((reg, index) => 
                `${index + 1}. **${reg.teamData.teamName}** [${reg.teamData.teamTag}] - ${reg.teamData.players.length} players`
            ).join('\n');
            
            allRegistrations.push({
                name: `⏰ ${timeLabels[timeSlot]} (${registrations.length} teams)`,
                value: teamList || 'No teams registered',
                inline: false
            });
        }
    }

    const statusEmbed = new EmbedBuilder()
        .setTitle('📊 Current Scrim Status')
        .setDescription('Overview of all scrim registrations')
        .addFields(allRegistrations.length > 0 ? allRegistrations : [{ name: '📭 No Registrations', value: 'No teams have registered for scrims yet.', inline: false }])
        .setColor('#17A2B8')
        .setTimestamp()
        .setFooter({ text: 'Updates in real-time' });

    await interaction.reply({ embeds: [statusEmbed], ephemeral: true });
};

const handleScrimUnregister = async (interaction) => {
    const userId = interaction.user.id;
    
    const currentRegistration = await findUserScrimRegistration(userId);
    
    if (!currentRegistration) {
        await interaction.reply({ 
            content: '❌ You are not currently registered for any scrim time slot.', 
            ephemeral: true 
        });
        return;
    }
    
    await deleteScrimRegistration(currentRegistration.timeSlot, userId);
    
    const unregisterEmbed = new EmbedBuilder()
        .setTitle('✅ Scrim Unregistration Successful')
        .setDescription(`You have been removed from the ${getTimeLabel(currentRegistration.timeSlot)} scrim slot.`)
        .addFields(
            { name: '⏰ Previous Slot', value: getTimeLabel(currentRegistration.timeSlot), inline: true },
            { name: '📅 Unregistered At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setColor('#FF6B6B')
        .setTimestamp();
        
    await interaction.reply({ embeds: [unregisterEmbed], ephemeral: true });
    
    const teamData = await getEnrolledTeam(userId);
    if (teamData) {
        await sendToLogChannel(interaction, teamData, getTimeLabel(currentRegistration.timeSlot), currentRegistration.timeSlot, 'SCRIM_UNREGISTER');
    }
};

const showAndUnregisterScrim = async (interaction) => {
    const userId = interaction.user.id;
    const currentRegistration = await findUserScrimRegistration(userId);

    if (!currentRegistration) {
        await interaction.reply({
            content: '❌ You are not currently registered for any scrim time slot.',
            ephemeral: true
        });
        return;
    }

    const teamData = currentRegistration.teamData;
    const timeLabel = getTimeLabel(currentRegistration.timeSlot);
    const embed = new EmbedBuilder()
        .setTitle('📋 Your Scrim Registration')
        .setDescription('You are currently registered for a scrim. You can unregister below if you wish.')
        .addFields(
            { name: '⏰ Slot', value: timeLabel, inline: true },
            { name: '🏷️ Team', value: `${teamData.teamName} [${teamData.teamTag}]`, inline: true },
            { name: '👤 Team Leader', value: `<@${userId}>`, inline: true },
            { name: '👥 Players', value: `${teamData.players.length} members`, inline: true },
            { name: '📝 Player List', value: teamData.players.slice(0, 10).map((p, i) => {
                if (typeof p === 'object' && p.id && p.name) {
                    return `${i + 1}. <@${p.id}> - ${p.name}`;
                } else if (typeof p === 'string') {
                    return `${i + 1}. ${p}`;
                } else {
                    return `${i + 1}. Unknown Player`;
                }
            }).join('\n') + (teamData.players.length > 10 ? `\n... and ${teamData.players.length - 10} more` : ''), inline: false }
        )
        .setColor('#FFA500')
        .setTimestamp();

    const unregisterButton = new ButtonBuilder()
        .setCustomId('scrim_unregister_now')
        .setLabel('Unregister')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🚫');

    const row = new ActionRowBuilder().addComponents(unregisterButton);

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
};

const handleScrimUnregisterButton = async (interaction) => {
    const userId = interaction.user.id;
    const currentRegistration = await findUserScrimRegistration(userId);
    if (!currentRegistration) {
        await interaction.reply({
            content: '❌ You are not currently registered for any scrim time slot.',
            ephemeral: true
        });
        return;
    }
    await deleteScrimRegistration(currentRegistration.timeSlot, userId);
    const unregisterEmbed = new EmbedBuilder()
        .setTitle('✅ Scrim Unregistration Successful')
        .setDescription(`You have been removed from the ${getTimeLabel(currentRegistration.timeSlot)} scrim slot.`)
        .addFields(
            { name: '⏰ Previous Slot', value: getTimeLabel(currentRegistration.timeSlot), inline: true },
            { name: '📅 Unregistered At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setColor('#FF6B6B')
        .setTimestamp();
    await interaction.update({ embeds: [unregisterEmbed], components: [], ephemeral: true });
    const teamData = await getEnrolledTeam(userId);
    if (teamData) {
        await sendToLogChannel(interaction, teamData, getTimeLabel(currentRegistration.timeSlot), currentRegistration.timeSlot, 'SCRIM_UNREGISTER');
    }
};

module.exports = {
    handleScrimTimeSelection,
    handleScrimLocationSelection,
    sendToScrimChannel,
    sendToLogChannel,
    showScrimStatus,
    handleScrimUnregister,
    showAndUnregisterScrim,
    handleScrimUnregisterButton,
    getAvailableLocations,
    locations,
    drawAllTeamsOnMap,
    drawTeamOnMap
}; 