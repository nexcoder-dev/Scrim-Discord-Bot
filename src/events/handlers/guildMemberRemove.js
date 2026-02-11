const { Events } = require('discord.js');
const { findTeamByPlayerId, deleteEnrolledTeam } = require('../../functions/database');
const { sendPublicLog } = require('../../functions/publicLog');
const { activeEnrollments, hasTransferredLeadership, getNewLeaderId, trackMemberDeparture, isTransferValid } = require('../../functions/teamHandlers');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        try {
            const team = await findTeamByPlayerId(member.id);
            if (!team) return;

            const hasActiveEnrollment = activeEnrollments.has(team.userId);
            if (hasActiveEnrollment) {
                trackMemberDeparture(team.userId, member.id);
            }

            const transferredLeadership = hasTransferredLeadership(member.id);
            
            if (hasActiveEnrollment || transferredLeadership) {
                if (transferredLeadership) {
                    const isValidTransfer = isTransferValid(member.id, team.userId);
                    if (isValidTransfer) {
                        const newLeaderId = getNewLeaderId(member.id);
                        console.log(`Team ${team.teamName} leadership transferred to ${newLeaderId} - skipping deletion for old leader ${member.id}`);
                        return;
                    } else {
                        await deleteEnrolledTeam(team.userId);
                        const logMsg = `🗑️ Team **${team.teamName}** (Tag: ${team.teamTag}) was deleted because member(s) left before leadership transfer. Team Leader: <@${team.userId}>`;
                        await sendPublicLog(member.client, logMsg);
                        console.log(`Team deleted: ${team.teamName} - transfer invalid due to prior member departure`);
                        return;
                    }
                } else {
                    console.log(`Team ${team.teamName} has active enrollment - skipping deletion for member ${member.id}`);
                    return;
                }
            }

            await deleteEnrolledTeam(team.userId);
            const logMsg = `🗑️ Team **${team.teamName}** (Tag: ${team.teamTag}) was automatically deleted because <@${member.id}> left the server. Team Leader: <@${team.userId}>`;
            await sendPublicLog(member.client, logMsg);
            console.log(`Team deleted: ${team.teamName} - Member ${member.id} left server`);
        } catch (error) {
            console.error('Error handling guild member removal:', error);
            try {
                await sendPublicLog(member.client, `⚠️ Error occurred while processing team data for <@${member.id}> who left the server.`);
            } catch (logError) {
                console.error('Error sending public log:', logError);
            }
        }
    },
}; 