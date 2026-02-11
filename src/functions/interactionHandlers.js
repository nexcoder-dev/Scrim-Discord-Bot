const { 
    startEnrollmentProcess,
    showTeamInfoModal,
    showAddPlayersModal,
    handleTeamInfoSubmit,
    handlePlayersSubmit,
    finishEnrollment,
    handleCancelEnrollment,
    handleTeamUpdate,
    handleTeamDelete,
    showTeamStatus,
    showAllTeams,
    confirmTeamDeletion
} = require('./teamHandlers.js');

const { handleScrimTimeSelection } = require('./scrimHandlers.js');

const handleSelectMenu = async (interaction) => {
    if (interaction.customId === 'team_enrollment_select') {
        const selection = interaction.values[0];
        
        switch(selection) {
            case 'enroll':
                await startEnrollmentProcess(interaction);
                break;
            case 'update':
                await handleTeamUpdate(interaction);
                break;
            case 'delete':
                await handleTeamDelete(interaction);
                break;
            case 'status':
                await showTeamStatus(interaction);
                break;
            case 'list':
                await showAllTeams(interaction);
                break;
        }
    } else if (interaction.customId === 'scrim_time_select') {
        await handleScrimTimeSelection(interaction);
    }
};

const handleButton = async (interaction) => {
    const userId = interaction.user.id;
    const customId = interaction.customId;

    if (customId === 'team_info_modal') {
        await showTeamInfoModal(interaction);
    }
    else if (customId === 'cancel_enrollment') {
        await handleCancelEnrollment(interaction);
    }
    else if (customId === 'confirm_delete_team') {
        await confirmTeamDeletion(interaction);
    }
    else if (customId === 'cancel_delete_team') {
        await interaction.reply({ content: '❌ Team deletion cancelled.', ephemeral: true });
    }
    else if (customId === 'add_players_modal') {
        await showAddPlayersModal(interaction);
    }
    else if (customId === 'finish_enrollment') {
        await finishEnrollment(interaction);
    }
    else if (customId === 'cancel_player_step') {
        await handleCancelEnrollment(interaction);
    }
};

const handleModal = async (interaction) => {
    const userId = interaction.user.id;
    const customId = interaction.customId;

    if (customId === 'team_info_submit') {
        await handleTeamInfoSubmit(interaction);
    } else if (customId === 'players_submit') {
        await handlePlayersSubmit(interaction);
    }
};

module.exports = {
    handleSelectMenu,
    handleButton,
    handleModal
}; 