const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ChannelType } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Team Management Panel - Manage your team enrollment and registration')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Select the channel to send the panel to')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)),

    async execute(interaction, client) {
        if (!config.bot.admins.includes(interaction.user.id)) {
            await interaction.reply({ 
                content: '❌ You do not have permission to use this command. Only administrators can create team management panels.', 
                ephemeral: true 
            });
            return;
        }

        const selectedChannel = interaction.options.getChannel('channel');
        
        const embed = new EmbedBuilder()
            .setTitle('🏆 Team Management Panel')
            .setDescription('Welcome to the Team Management Portal! Select an option below to manage your team:')
            .addFields(
                { name: '📝 Enroll', value: 'Create a new team registration', inline: true },
                { name: '🔄 Update', value: 'Modify your existing team details', inline: true },
                { name: '🗑️ Delete', value: 'Remove your team from the system', inline: true },
                { name: '📊 Status', value: 'View your current team information', inline: true },
                { name: '📋 List Teams', value: 'View all registered teams', inline: true },
                { name: '❓ Help', value: 'Get assistance with team management', inline: true }
            )
            .setFooter({ 
                text: '⚠️ Important: Alt accounts and fake mentions are prohibited and will result in permanent ban.\n⏱️ Sessions timeout after 10 minutes of inactivity.' 
            })
            .setColor('#7289DA')
            .setThumbnail(interaction.guild.iconURL());

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('team_enrollment_select')
            .setPlaceholder('🎮 Choose your action...')
            .addOptions([
                {
                    label: 'Enroll New Team',
                    description: 'Register a brand new team',
                    value: 'enroll',
                    emoji: '📝'
                },
                {
                    label: 'Update Team',
                    description: 'Modify existing team details',
                    value: 'update',
                    emoji: '🔄'
                },
                {
                    label: 'Delete Team',
                    description: 'Remove team from system',
                    value: 'delete',
                    emoji: '🗑️'
                },
                {
                    label: 'View My Team',
                    description: 'Check current team status',
                    value: 'status',
                    emoji: '📊'
                },
                {
                    label: 'List All Teams',
                    description: 'Browse registered teams',
                    value: 'list',
                    emoji: '📋'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        await selectedChannel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ Panel has been sent to ${selectedChannel}!`, ephemeral: true });
    }
}; 