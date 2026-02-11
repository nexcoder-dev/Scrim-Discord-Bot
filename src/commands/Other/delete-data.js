const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { Team, Scrim } = require('../../functions/database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-data')
        .setDescription('Delete team or scrim slotlist data (Admin only).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('team')
                .setDescription('Delete all team data')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('scrim')
                .setDescription('Delete all scrim slotlist data')
        ),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'team') {
            await Team.deleteMany({});
            const embed = new EmbedBuilder()
                .setTitle('Team Data Deleted')
                .setDescription('All team data has been deleted.')
                .setColor('#ff0000')
                .setTimestamp();
            await interaction.reply({ embeds: [embed], ephemeral: false });
        } else if (sub === 'scrim') {
            await Scrim.deleteMany({});
            const embed = new EmbedBuilder()
                .setTitle('Slotlist Data Deleted')
                .setDescription('All scrim slotlist data has been deleted.')
                .setColor('#ff0000')
                .setTimestamp();
            await interaction.reply({ embeds: [embed], ephemeral: false });
        } else {
            await interaction.reply({ content: 'Invalid subcommand.', ephemeral: true });
        }
    },
};