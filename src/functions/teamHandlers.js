const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { 
    getEnrolledTeam, 
    setEnrolledTeam, 
    deleteEnrolledTeam, 
    getAllEnrolledTeams,
    getScrimRegistration,
    setScrimRegistration,
    deleteScrimRegistration,
    getAllScrimRegistrations,
    findUserScrimRegistration
} = require('./database.js');
const { sendPublicLog } = require('./publicLog');

const ENROLLMENT_TIME_LIMIT = 10 * 60 * 1000;
const activeEnrollments = new Map();

const teamLeadershipTransfers = new Map();
const transferTimestamps = new Map();
const memberDepartures = new Map();

const getTimeLabel = (timeValue) => {
    const timeLabels = getTimeLabels();
    return timeLabels[timeValue] || timeValue;
};

const getTimeLabels = () => {
    return {
        '18:00': '6:00 PM IST',
        '19:00': '7:00 PM IST',
        '20:00': '8:00 PM IST',
        '21:00': '9:00 PM IST',
        '22:00': '10:00 PM IST',
        '23:00': '11:00 PM IST'
    };
};

const cleanupInvalidTeamMembers = async (interaction, teamData) => {
    if (!teamData || !teamData.players || teamData.players.length === 0) {
        return teamData;
    }

    const guild = interaction.guild;
    const validPlayers = [];
    const removedPlayers = [];

    for (const player of teamData.players) {
        let playerId = null;
        
        if (typeof player === 'object' && player.id) {
            playerId = player.id;
        } else if (typeof player === 'string') {
            playerId = player;
        }

        if (playerId) {
            try {
                const member = await guild.members.fetch(playerId);
                if (member) {
                    validPlayers.push(player);
                } else {
                    removedPlayers.push(player);
                }
            } catch (error) {
                removedPlayers.push(player);
            }
        }
    }

    if (removedPlayers.length > 0) {
        const updatedTeamData = {
            ...teamData,
            players: validPlayers,
            lastUpdated: new Date()
        };

        await setEnrolledTeam(teamData.userId, updatedTeamData);

        const removedNames = removedPlayers.map(player => {
            if (typeof player === 'object' && player.name) {
                return `${player.name} (${player.id})`;
            }
            return player;
        }).join(', ');

        await sendPublicLog(interaction.client, `🧹 Cleaned up team **${teamData.teamName}**: Removed ${removedPlayers.length} invalid member(s): ${removedNames}. Team Leader: <@${teamData.userId}>`);
        
        return updatedTeamData;
    }

    return teamData;
};

const startEnrollmentProcess = async (interaction, isUpdate = false) => {
    const userId = interaction.user.id;
    const guild = interaction.guild;

    if (activeEnrollments.has(userId)) {
        await interaction.reply({ 
            content: '⚠️ You already have an active enrollment process. Please wait for it to complete or time out (10 minutes).', 
            ephemeral: true 
        });
        return;
    }

    if (isUpdate) {
        const teamData = await getEnrolledTeam(userId);
        if (!teamData) {
            await interaction.reply({ 
                content: '❌ You don\'t have a team to update. Please enroll first.', 
                ephemeral: true 
            });
            return;
        }

        const missingMembers = [];

        for (const player of teamData.players) {
            let playerId = null;
            
            if (typeof player === 'object' && player.id) {
                playerId = player.id;
            } else if (typeof player === 'string') {
                playerId = player;
            }

            if (playerId) {
                try {
                    await guild.members.fetch(playerId);
                } catch (error) {
                    const playerName = typeof player === 'object' && player.name ? player.name : playerId;
                    missingMembers.push(playerName);
                }
            }
        }

        if (missingMembers.length > 0) {
            await deleteEnrolledTeam(userId);
            
            const missingList = missingMembers.join(', ');
            await sendPublicLog(interaction.client, `🗑️ Team **${teamData.teamName}** (Tag: ${teamData.teamTag}) was automatically deleted because team member(s) left the server: ${missingList}. Team Leader: <@${userId}>`);
            
            await interaction.reply({ 
                content: `❌ Your team has been automatically deleted because the following member(s) left the server: ${missingList}. Please enroll a new team.`, 
                ephemeral: true 
            });
            return;
        }
    }

    try {
        const channelName = isUpdate ? `update-${interaction.user.username}` : `enrollment-${interaction.user.username}`;
        const enrollmentChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: userId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                },
            ],
        });

        const existingTeamData = isUpdate ? await getEnrolledTeam(userId) : {};
        const enrollmentData = {
            channelId: enrollmentChannel.id,
            userId: userId,
            startTime: Date.now(),
            step: 'team_name',
            teamData: isUpdate ? { ...existingTeamData } : {},
            isUpdate: isUpdate,
            client: guild.client,
            guild: guild
        };
        
        activeEnrollments.set(userId, enrollmentData);

        const welcomeEmbed = new EmbedBuilder()
            .setTitle(isUpdate ? '🔄 Team Update Process Started!' : '🎮 Team Enrollment Process Started!')
            .setDescription(`Welcome ${interaction.user}! You have **10 minutes** to complete your ${isUpdate ? 'team update' : 'team enrollment'}.\n\n**Step 1/3: Team Information**\nPlease click the button below to ${isUpdate ? 'update' : 'enter'} your team name and tag.`)
            .setColor('#00D4AA')
            .addFields(
                { name: '⏱️ Time Limit', value: '10 minutes', inline: true },
                { name: '📋 Current Step', value: '1/3: Team Info', inline: true },
                { name: '🎯 Action', value: isUpdate ? 'Update Details' : 'New Registration', inline: true }
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: `Session ID: ${Date.now()}` });

        if (isUpdate && existingTeamData.teamName) {
            welcomeEmbed.addFields(
                { name: '📊 Current Team Name', value: existingTeamData.teamName, inline: true },
                { name: '🏷️ Current Team Tag', value: existingTeamData.teamTag, inline: true },
                { name: '👥 Current Players', value: `${existingTeamData.players.length} members`, inline: true }
            );
        }

        const teamInfoButton = new ButtonBuilder()
            .setCustomId('team_info_modal')
            .setLabel(isUpdate ? 'Update Team Info' : 'Enter Team Info')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝');

        const transferLeadershipButton = new ButtonBuilder()
            .setCustomId('transfer_leadership')
            .setLabel('Transfer Leadership')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👑');

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_enrollment')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌');

        let buttonRow;
        if (isUpdate) {
            buttonRow = new ActionRowBuilder().addComponents(teamInfoButton, transferLeadershipButton, cancelButton);
        } else {
            buttonRow = new ActionRowBuilder().addComponents(teamInfoButton, cancelButton);
        }

        await enrollmentChannel.send({
            content: `${interaction.user}`,
            embeds: [welcomeEmbed], 
            components: [buttonRow]
        });

        setTimeout(async () => {
            if (activeEnrollments.has(userId)) {
                await cleanupEnrollment(userId, true); 
            }
        }, ENROLLMENT_TIME_LIMIT);

        await sendPublicLog(guild.client, `📝 <@${userId}> started team enrollment.`);

        await interaction.reply({ 
            content: `✅ ${isUpdate ? 'Team update' : 'Enrollment'} process started! Check ${enrollmentChannel} to continue.`, 
            ephemeral: true 
        });

    } catch (error) {
        console.error('Error creating enrollment channel:', error);
        await interaction.reply({ 
            content: '❌ Failed to start enrollment process. Please try again later.', 
            ephemeral: true 
        });
    }
};

const showTeamInfoModal = async (interaction) => {
    const userId = interaction.user.id;
    const enrollment = activeEnrollments.get(userId);

    if (!enrollment) {
        await interaction.reply({ content: '❌ No active enrollment session found.', ephemeral: true });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId('team_info_submit')
        .setTitle(enrollment.isUpdate ? 'Update Team Information' : 'Team Information');

    const teamNameInput = new TextInputBuilder()
        .setCustomId('team_name')
        .setLabel('Team Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter your team name')
        .setRequired(true)
        .setMaxLength(50);

    const teamTagInput = new TextInputBuilder()
        .setCustomId('team_tag')
        .setLabel('Team Tag')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter your team tag (e.g., [TAG])')
        .setRequired(true)
        .setMaxLength(10);

    if (enrollment.isUpdate && enrollment.teamData.teamName) {
        teamNameInput.setValue(enrollment.teamData.teamName);
        teamTagInput.setValue(enrollment.teamData.teamTag);
    }

    const firstActionRow = new ActionRowBuilder().addComponents(teamNameInput);
    const secondActionRow = new ActionRowBuilder().addComponents(teamTagInput);

    modal.addComponents(firstActionRow, secondActionRow);

    await interaction.showModal(modal);
};

const showAddPlayersModal = async (interaction) => {
    const userId = interaction.user.id;
    const enrollment = activeEnrollments.get(userId);

    if (!enrollment) {
        await interaction.reply({ content: '❌ No active enrollment session found.', ephemeral: true });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId('players_submit')
        .setTitle('Add Team Players');

    const playersInput = new TextInputBuilder()
        .setCustomId('players_list')
        .setLabel('Player List (Discord ID - Player Name)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('123456789012345678 - Player Name\n987654321098765432 - Another Player\n...')
        .setRequired(true)
        .setMaxLength(2000);

    if (enrollment.isUpdate && enrollment.teamData.players && enrollment.teamData.players.length > 0) {
        const playerLines = enrollment.teamData.players.map(player => {
            if (typeof player === 'object' && player.id && player.name) {
                return `${player.id} - ${player.name}`;
            } else if (typeof player === 'string') {
                return `${player} - ${player}`;
            }
            return player; 
        });
        playersInput.setValue(playerLines.join('\n'));
    }

    const actionRow = new ActionRowBuilder().addComponents(playersInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
};

const handleTeamInfoSubmit = async (interaction) => {
    const userId = interaction.user.id;
    const enrollment = activeEnrollments.get(userId);

    if (!enrollment) {
        await interaction.reply({ content: '❌ No active enrollment session found.', ephemeral: true });
        return;
    }

    const teamName = interaction.fields.getTextInputValue('team_name').trim();
    const teamTag = interaction.fields.getTextInputValue('team_tag').trim();

    if (teamName.length < 2) {
        await interaction.reply({ content: '❌ Team name must be at least 2 characters long.', ephemeral: true });
        return;
    }

    if (teamTag.length < 2) {
        await interaction.reply({ content: '❌ Team tag must be at least 2 characters long.', ephemeral: true });
        return;
    }

    if (!enrollment.isUpdate) {
        const allTeams = await getAllEnrolledTeams();
        const duplicateName = allTeams.find(team => 
            team.teamName.toLowerCase() === teamName.toLowerCase() && team.userId !== userId
        );
        
        if (duplicateName) {
            await interaction.reply({ 
                content: '❌ A team with this name already exists. Please choose a different name.', 
                ephemeral: true 
            });
            return;
        }
    }

    enrollment.teamData.teamName = teamName;
    enrollment.teamData.teamTag = teamTag;
    enrollment.step = 'players';

    await sendPublicLog(interaction.client, `📝 <@${userId}> submitted team info for enrollment. Team Name: ${teamName}, Tag: ${teamTag}`);

    const playersEmbed = new EmbedBuilder()
        .setTitle('📋 Step 2/3: Team Players')
        .setDescription(`Great! Now let's add your team players.\n\n**Team Info Saved:**\n🏷️ **Name:** ${teamName}\n🔖 **Tag:** ${teamTag}`)
        .addFields(
            { name: '📝 Instructions', value: 'Click the button below to add your team players. Use format: "Discord ID - Player Name" (one per line).', inline: false },
            { name: '⚠️ Important', value: 'All Discord IDs must be valid 17-19 digit numbers. Player names must be 1-32 characters.', inline: false }
        )
        .setColor('#FFA500')
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();

    const addPlayersButton = new ButtonBuilder()
        .setCustomId('add_players_modal')
        .setLabel('Add Players')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('👥');

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_player_step')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌');

    const buttonRow = new ActionRowBuilder().addComponents(addPlayersButton, cancelButton);

    await interaction.reply({
        embeds: [playersEmbed], 
        components: [buttonRow]
    });
};

const handlePlayersSubmit = async (interaction) => {
    const userId = interaction.user.id;
    const enrollment = activeEnrollments.get(userId);

    if (!enrollment) {
        await interaction.reply({ content: '❌ No active enrollment session found.', ephemeral: true });
        return;
    }

    const playersText = interaction.fields.getTextInputValue('players_list').trim();
    const playerLines = playersText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    if (playerLines.length < 1) {
        await interaction.reply({ content: '❌ You must add at least 1 player.', ephemeral: true });
        return;
    }

    if (playerLines.length > 50) {
        await interaction.reply({ content: '❌ Maximum 50 players allowed per team.', ephemeral: true });
        return;
    }

    const validPlayers = [];
    const invalidPlayers = [];

    for (const playerLine of playerLines) {
        const match = playerLine.match(/^(\d{17,19})\s*-\s*(.+)$/);
        
        if (match) {
            const discordId = match[1];
            const playerName = match[2].trim();
            
            if (/^\d{17,19}$/.test(discordId) && playerName.length >= 1 && playerName.length <= 32) {
                validPlayers.push({
                    id: discordId,
                    name: playerName
                });
            } else {
                invalidPlayers.push(playerLine);
            }
        } else {
            invalidPlayers.push(playerLine);
        }
    }

    if (invalidPlayers.length > 0) {
        await interaction.reply({ 
            content: `❌ Some players have invalid formats. Use "Discord ID - Player Name" format:\n${invalidPlayers.slice(0, 5).map(p => `• ${p}`).join('\n')}${invalidPlayers.length > 5 ? `\n... and ${invalidPlayers.length - 5} more` : ''}`, 
            ephemeral: true 
        });
        return;
    }

    enrollment.teamData.players = validPlayers;
    enrollment.step = 'confirmation';

    const confirmEmbed = new EmbedBuilder()
        .setTitle('✅ Step 3/3: Final Confirmation')
        .setDescription(`Please review your team information and confirm ${enrollment.isUpdate ? 'the update' : 'enrollment'}:`)
        .addFields(
            { name: '🏷️ Team Name', value: enrollment.teamData.teamName, inline: true },
            { name: '👤 Team Leader', value: `${interaction.user}`, inline: true },
            { name: '🔖 Team Tag', value: enrollment.teamData.teamTag, inline: true },
            { name: '👥 Players Count', value: `${validPlayers.length} players`, inline: true },
            { name: '📝 Player List', value: validPlayers.slice(0, 15).map((p, i) => `${i + 1}. <@${p.id}> - ${p.name}`).join('\n') + (validPlayers.length > 15 ? `\n... and ${validPlayers.length - 15} more` : ''), inline: false }
        )
        .setColor('#00FF00')
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();

    const finishButton = new ButtonBuilder()
        .setCustomId('finish_enrollment')
        .setLabel(enrollment.isUpdate ? 'Update Team' : 'Complete Enrollment')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_enrollment')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌');

    const buttonRow = new ActionRowBuilder().addComponents(finishButton, cancelButton);

    await interaction.reply({
        embeds: [confirmEmbed], 
        components: [buttonRow]
    });
};

const finishEnrollment = async (interaction) => {
    const userId = interaction.user.id;
    const enrollment = activeEnrollments.get(userId);

    if (!enrollment) {
        await interaction.reply({ content: '❌ No active enrollment session found.', ephemeral: true });
        return;
    }

    try {
        const teamData = {
            ...enrollment.teamData,
            enrollmentTime: enrollment.isUpdate ? enrollment.teamData.enrollmentTime : Date.now(),
            lastUpdated: Date.now(),
            userId: userId
        };

        await setEnrolledTeam(userId, teamData);

        const successEmbed = new EmbedBuilder()
            .setTitle(enrollment.isUpdate ? '✅ Team Updated Successfully!' : '🎉 Team Enrollment Complete!')
            .setDescription(`Your team has been ${enrollment.isUpdate ? 'updated' : 'enrolled'} successfully!`)
                    .addFields(
            { name: '🏷️ Team Name', value: teamData.teamName, inline: true },
            { name: '👤 Team Leader', value: `${interaction.user}`, inline: true },
            { name: '🔖 Team Tag', value: teamData.teamTag, inline: true },
            { name: '👥 Players', value: `${teamData.players.length} members`, inline: true },
                { name: '📅 Action Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                { name: '🎮 Next Steps', value: 'You can now register for scrims using `/scrim-register`', inline: false }
            )
            .setColor('#00FF00')
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp();

        await interaction.reply({ embeds: [successEmbed] });

        await sendPublicLog(interaction.client, `✅ <@${userId}> enrolled team **${teamData.teamName}** (Tag: ${teamData.teamTag}).`);

        setTimeout(async () => {
            await cleanupEnrollment(userId);
        }, 5000); 

    } catch (error) {
        console.error('Error finishing enrollment:', error);
        await interaction.reply({ 
            content: '❌ An error occurred while saving your team data. Please try again.', 
            ephemeral: true 
        });
    }
};

const handleCancelEnrollment = async (interaction) => {
    const userId = interaction.user.id;
    
    const cancelEmbed = new EmbedBuilder()
        .setTitle('❌ Enrollment Cancelled')
        .setDescription('Your enrollment process has been cancelled. The private channel will be deleted shortly.')
        .setColor('#FF6B6B')
        .setTimestamp();

    await interaction.reply({ embeds: [cancelEmbed] });

    await sendPublicLog(interaction.client, `❌ <@${userId}> cancelled their team enrollment.`);
    
    setTimeout(async () => {
        await cleanupEnrollment(userId);
    }, 3000);
};

const cleanupEnrollment = async (userId, isTimeout = false) => {
    const enrollment = activeEnrollments.get(userId);
    if (enrollment) {
        try {
            const client = enrollment.guild?.client || enrollment.client;
            if (client && enrollment.channelId) {
                let channel = client.channels.cache.get(enrollment.channelId);
                if (!channel) {
                    try {
                        channel = await client.channels.fetch(enrollment.channelId);
                        console.log(`[DEBUG] Fetched channel from API: ${enrollment.channelId}`);
                    } catch (fetchErr) {
                        console.error(`[DEBUG] Could not fetch channel from API: ${enrollment.channelId}`, fetchErr);
                    }
                }
                if (channel) {
                    await channel.delete();
                    console.log(`[DEBUG] Deleted channel: ${enrollment.channelId}`);
                } else {
                    console.error(`[DEBUG] Channel not found: ${enrollment.channelId}`);
                }
            } else {
                console.error('[DEBUG] Client or channelId missing in enrollment:', enrollment);
            }
        } catch (error) {
            console.error('Error deleting enrollment channel:', error);
        }
        activeEnrollments.delete(userId);
        console.log(`Cleaned up enrollment session for user ${userId}`);
        if (isTimeout) {
            await sendPublicLog(
                enrollment.guild?.client || enrollment.client,
                `⏰ <@${userId}> enrollment timed out. Channel deleted after 10 minutes.`
            );
        }
    }
};

const handleTeamUpdate = async (interaction) => {
    const userId = interaction.user.id;
    const teamData = await getEnrolledTeam(userId);
    
    if (!teamData) {
        await interaction.reply({ 
            content: '❌ You don\'t have a team to update. Please enroll first using the "Enroll" option.', 
            ephemeral: true 
        });
        return;
    }
    
    await startEnrollmentProcess(interaction, true);

    await sendPublicLog(interaction.client, `🔄 <@${userId}> updated team **${teamData.teamName}** (Tag: ${teamData.teamTag}).`);
};

const handleTeamDelete = async (interaction) => {
    const userId = interaction.user.id;
    const teamData = await getEnrolledTeam(userId);
    
    if (!teamData) {
        await interaction.reply({ 
            content: '❌ You don\'t have a team to delete.', 
            ephemeral: true 
        });
        return;
    }
    
    const confirmEmbed = new EmbedBuilder()
        .setTitle('⚠️ Confirm Team Deletion')
        .setDescription(`Are you sure you want to delete your team **<@${userId}>**?\n\n**This action cannot be undone!**`)
        .addFields(
            { name: 'Team Name', value: teamData.teamName, inline: true },
            { name: 'Team Leader', value: `${interaction.user}`, inline: true },
            { name: 'Team Tag', value: teamData.teamTag, inline: true },
            { name: 'Players', value: `${teamData.players.length} members`, inline: true }
        )
        .setColor('#FF0000');
    
    const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_delete_team')
        .setLabel('Yes, Delete Team')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');
        
    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_delete_team')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌');
    
    const row = new ActionRowBuilder().addComponents(cancelButton, confirmButton);
    await interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true });
};

const confirmTeamDeletion = async (interaction) => {
    const userId = interaction.user.id;
    
    try {
        const teamData = await getEnrolledTeam(userId);
        
        if (!teamData) {
            await interaction.reply({ content: '❌ Team not found.', ephemeral: true });
            return;
        }

        const currentRegistration = await findUserScrimRegistration(userId);
        if (currentRegistration) {
            await deleteScrimRegistration(currentRegistration.timeSlot, userId);
        }

        await deleteEnrolledTeam(userId);

        const deleteEmbed = new EmbedBuilder()
            .setTitle('✅ Team Deleted Successfully')
            .setDescription(`Team **<@${userId}>** has been permanently deleted from the system.`)
            .addFields(
                { name: '🏷️ Deleted Team', value: `${teamData.teamName} [${teamData.teamTag}]`, inline: true },
                { name: '👤 Team Leader', value: `${interaction.user}`, inline: true },
                { name: '👥 Had Players', value: `${teamData.players.length} members`, inline: true },
                { name: '📅 Deleted At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setColor('#FF0000')
            .setTimestamp();

        await interaction.reply({ embeds: [deleteEmbed], ephemeral: true });

        await sendPublicLog(interaction.client, `🗑️ <@${userId}> deleted team **${teamData.teamName}** (Tag: ${teamData.teamTag}).`);

    } catch (error) {
        console.error('Error deleting team:', error);
        await interaction.reply({ 
            content: '❌ An error occurred while deleting your team. Please try again.', 
            ephemeral: true 
        });
    }
};

const showTeamStatus = async (interaction) => {
    const userId = interaction.user.id;
    let teamData = await getEnrolledTeam(userId);
    
    if (!teamData) {
        await interaction.reply({ 
            content: '❌ You don\'t have a team enrolled. Use the "Enroll" option to create one.', 
            ephemeral: true 
        });
        return;
    }

    teamData = await cleanupInvalidTeamMembers(interaction, teamData);
    
    const currentRegistration = await findUserScrimRegistration(userId);
    const scrimStatus = currentRegistration 
        ? `Registered for ${getTimeLabel(currentRegistration.timeSlot)}`
        : 'Not registered for any scrims';
    
    const playerList = teamData.players.map((player, index) => {
        if (typeof player === 'object' && player.id && player.name) {
            return `${index + 1}. <@${player.id}> - ${player.name}`;
        } else if (typeof player === 'string') {
            return `${index + 1}. ${player}`;
        } else {
            return `${index + 1}. Unknown Player`;
        }
    });
    
    const statusEmbed = new EmbedBuilder()
        .setTitle('📊 Your Team Status')
        .setDescription('Current information about your enrolled team')
        .addFields(
            { name: '🏷️ Team Name', value: teamData.teamName, inline: true },
            { name: '👤 Team Leader', value: `${interaction.user}`, inline: true },
            { name: '🔖 Team Tag', value: teamData.teamTag, inline: true },
            { name: '👥 Players Count', value: `${teamData.players.length}`, inline: true },
            { name: '📅 Enrolled Since', value: `<t:${Math.floor(teamData.enrollmentTime / 1000)}:R>`, inline: true },
            { name: '🎮 Scrim Status', value: scrimStatus, inline: true },
            { name: '👤 Team Leader', value: `${interaction.user}`, inline: true },
            { name: '📝 Player List', value: playerList.slice(0, 20).join('\n') + (teamData.players.length > 20 ? `\n... and ${teamData.players.length - 20} more` : ''), inline: false }
        )
        .setColor('#00D4AA')
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();
        
    await interaction.reply({ embeds: [statusEmbed], ephemeral: true });
};

const showAllTeams = async (interaction) => {
    const allTeams = await getAllEnrolledTeams();
    
    if (allTeams.length === 0) {
        await interaction.reply({ 
            content: '📭 No teams have been enrolled yet.', 
            ephemeral: true 
        });
        return;
    }
    
    const teams = allTeams.map((team, index) => {
        return `${index + 1}. **<@${team.userId}>** [${team.teamTag}] - ${team.players.length} players`;
    });
    
    const chunks = [];
    for (let i = 0; i < teams.length; i += 10) {
        chunks.push(teams.slice(i, i + 10));
    }
    
    const listEmbed = new EmbedBuilder()
        .setTitle('📋 All Registered Teams')
        .setDescription(`Total: ${allTeams.length} teams`)
        .addFields(
            chunks.map((chunk, index) => ({
                name: `Teams ${index * 10 + 1}-${Math.min((index + 1) * 10, teams.length)}`,
                value: chunk.join('\n'),
                inline: false
            }))
        )
        .setColor('#7289DA')
        .setTimestamp()
        .setFooter({ text: 'Use /team-enrollment to manage your team' });
        
    await interaction.reply({ embeds: [listEmbed], ephemeral: true });
};

const transferTeamLeadership = async (oldLeaderId, newLeaderId, teamData) => {
    try {
        const updatedTeamData = {
            ...teamData,
            userId: newLeaderId,
            lastUpdated: new Date()
        };

        await deleteEnrolledTeam(oldLeaderId);
        await setEnrolledTeam(newLeaderId, updatedTeamData);

        teamLeadershipTransfers.set(oldLeaderId, newLeaderId);
        transferTimestamps.set(oldLeaderId, Date.now());

        await sendPublicLog(teamData.guild?.client, `👑 Team **${teamData.teamName}** leadership transferred from <@${oldLeaderId}> to <@${newLeaderId}>.`);

        return true;
    } catch (error) {
        console.error('Error transferring team leadership:', error);
        return false;
    }
};

const trackMemberDeparture = (teamId, memberId) => {
    if (!memberDepartures.has(teamId)) {
        memberDepartures.set(teamId, []);
    }
    memberDepartures.get(teamId).push({
        memberId: memberId,
        timestamp: Date.now()
    });
};

const isTransferValid = (oldLeaderId, teamId) => {
    const transferTime = transferTimestamps.get(oldLeaderId);
    const departures = memberDepartures.get(teamId);
    
    if (!transferTime || !departures || departures.length === 0) {
        return true; 
    }
    
    const departureBeforeTransfer = departures.some(departure => 
        departure.timestamp < transferTime
    );
    
    return !departureBeforeTransfer;
};

const hasTransferredLeadership = (userId) => {
    return teamLeadershipTransfers.has(userId);
};

const getNewLeaderId = (oldLeaderId) => {
    return teamLeadershipTransfers.get(oldLeaderId);
};

const showLeadershipTransferModal = async (interaction) => {
    const userId = interaction.user.id;
    const enrollment = activeEnrollments.get(userId);

    if (!enrollment || !enrollment.isUpdate) {
        await interaction.reply({ content: '❌ Leadership transfer is only available during team updates.', ephemeral: true });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId('leadership_transfer_submit')
        .setTitle('Transfer Team Leadership');

    const newLeaderInput = new TextInputBuilder()
        .setCustomId('new_leader_id')
        .setLabel('New Leader Discord ID')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter the Discord ID of the new team leader')
        .setRequired(true)
        .setMaxLength(20);

    const actionRow = new ActionRowBuilder().addComponents(newLeaderInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
};

const handleLeadershipTransferSubmit = async (interaction) => {
    const userId = interaction.user.id;
    const enrollment = activeEnrollments.get(userId);

    if (!enrollment || !enrollment.isUpdate) {
        await interaction.reply({ content: '❌ Leadership transfer is only available during team updates.', ephemeral: true });
        return;
    }

    const newLeaderId = interaction.fields.getTextInputValue('new_leader_id').trim();

    if (!/^\d{17,19}$/.test(newLeaderId)) {
        await interaction.reply({ content: '❌ Invalid Discord ID format. Please enter a valid 17-19 digit Discord ID.', ephemeral: true });
        return;
    }

    const isInTeam = enrollment.teamData.players.some(player => {
        if (typeof player === 'object' && player.id) {
            return player.id === newLeaderId;
        } else if (typeof player === 'string') {
            return player === newLeaderId;
        }
        return false;
    });

    if (!isInTeam) {
        await interaction.reply({ content: '❌ The new leader must be a current member of your team.', ephemeral: true });
        return;
    }

    try {
        const guild = interaction.guild;
        await guild.members.fetch(newLeaderId);
    } catch (error) {
        await interaction.reply({ content: '❌ The new leader is not in this server.', ephemeral: true });
        return;
    }

    const success = await transferTeamLeadership(userId, newLeaderId, enrollment.teamData);
    
    if (success) {
        const successEmbed = new EmbedBuilder()
            .setTitle('👑 Leadership Transferred Successfully!')
            .setDescription(`Team leadership has been transferred to <@${newLeaderId}>.`)
            .addFields(
                { name: '🏷️ Team Name', value: enrollment.teamData.teamName, inline: true },
                { name: '👤 Old Team Leader', value: `${interaction.user}`, inline: true },
                { name: '🔖 Team Tag', value: enrollment.teamData.teamTag, inline: true },
                { name: '👑 New Leader', value: `<@${newLeaderId}>`, inline: true }
            )
            .setColor('#00FF00')
            .setTimestamp();

        await interaction.reply({ embeds: [successEmbed] });

        setTimeout(async () => {
            await cleanupEnrollment(userId);
        }, 5000);
    } else {
        await interaction.reply({ content: '❌ Failed to transfer leadership. Please try again.', ephemeral: true });
    }
};

module.exports = {
    activeEnrollments,
    ENROLLMENT_TIME_LIMIT,
    getTimeLabel,
    getTimeLabels,
    cleanupInvalidTeamMembers,
    transferTeamLeadership,
    hasTransferredLeadership,
    getNewLeaderId,
    trackMemberDeparture,
    isTransferValid,
    showLeadershipTransferModal,
    handleLeadershipTransferSubmit,
    startEnrollmentProcess,
    showTeamInfoModal,
    showAddPlayersModal,
    handleTeamInfoSubmit,
    handlePlayersSubmit,
    finishEnrollment,
    handleCancelEnrollment,
    cleanupEnrollment,
    handleTeamUpdate,
    handleTeamDelete,
    showTeamStatus,
    showAllTeams,
    confirmTeamDeletion
}; 