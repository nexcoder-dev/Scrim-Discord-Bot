const mongoose = require('mongoose');
const chalk = require('chalk');

const teamSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    teamName: { type: String, required: true },
    teamTag: { type: String, required: true },
    players: [{
        id: { type: String, required: true },
        name: { type: String, required: true }
    }],
    enrollmentTime: { type: Date, default: Date.now },
    lastUpdated: { type: Date, default: Date.now }
});

const scrimSchema = new mongoose.Schema({
    timeSlot: { type: String, required: true },
    userId: { type: String, required: true },
    teamData: { type: Object, required: true },
    registrationTime: { type: Date, default: Date.now },
    user: { type: Object, required: true }
});

scrimSchema.index({ timeSlot: 1, userId: 1 }, { unique: true });

const Team = mongoose.model('Team', teamSchema);
const Scrim = mongoose.model('Scrim', scrimSchema);

const forceResetDatabase = async () => {
    try {
        console.log('🔄 Force resetting database...');
        
        await mongoose.connection.dropCollection('teams');
        console.log('✅ Dropped teams collection');
        
        const Team = mongoose.model('Team', teamSchema);
        console.log('✅ Recreated Team model with new schema');
        
        console.log('🔄 Database reset complete');
    } catch (error) {
        console.error('Error force resetting database:', error);
    }
};

const initializeDatabase = async () => {
    try {
        console.log('✅ Database initialized successfully');
        await initializeScrimSlots();
        await migratePlayerData();
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
};

const initializeScrimSlots = async () => {
    const timeSlots = ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];
    console.log('🕐 Scrim time slots initialized');
};

const migratePlayerData = async () => {
    try {
        console.log('🔄 Starting player data migration...');
        const teams = await Team.find({});
        let migratedCount = 0;
        let errorCount = 0;
        
        console.log(`Found ${teams.length} teams to check for migration`);
        
        for (const team of teams) {
            try {
                let needsUpdate = false;
                const updatedPlayers = [];
                
                console.log(`Checking team ${team.teamName} (${team.userId}) with ${team.players.length} players`);
                
                for (const player of team.players) {
                    if (typeof player === 'string') {
                        updatedPlayers.push({
                            id: player, 
                            name: player 
                        });
                        needsUpdate = true;
                        console.log(`Converting player string: ${player}`);
                    } else if (typeof player === 'object' && player.id && player.name) {
                        updatedPlayers.push(player);
                        console.log(`Player already in new format: ${player.name} (${player.id})`);
                    } else {
                        console.log(`Unknown player format:`, player);
                        updatedPlayers.push(player);
                    }
                }
                
                if (needsUpdate) {
                    console.log(`Updating team ${team.teamName} with ${updatedPlayers.length} players`);
                    await Team.updateOne(
                        { _id: team._id },
                        { $set: { players: updatedPlayers } }
                    );
                    migratedCount++;
                    console.log(`✅ Successfully migrated team ${team.teamName}`);
                } else {
                    console.log(`Team ${team.teamName} already in correct format`);
                }
            } catch (teamError) {
                console.error(`Error migrating team ${team.teamName}:`, teamError);
                errorCount++;
            }
        }
        
        console.log(`🔄 Migration complete: ${migratedCount} teams migrated, ${errorCount} errors`);
        
        if (migratedCount > 0) {
            console.log(`🔄 Migrated ${migratedCount} teams to new player format`);
        }
        
        if (errorCount > 0) {
            console.log(`⚠️ ${errorCount} teams had migration errors`);
        }
    } catch (error) {
        console.error('Error in migratePlayerData:', error);
    }
};

const getEnrolledTeam = async (userId) => {
    try {
        return await Team.findOne({ userId });
    } catch (error) {
        console.error('Error getting enrolled team:', error);
        return null;
    }
};

const setEnrolledTeam = async (userId, teamData) => {
    try {
        return await Team.findOneAndUpdate(
            { userId },
            { ...teamData, userId, lastUpdated: new Date() },
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error('Error setting enrolled team:', error);
        throw error;
    }
};

const deleteEnrolledTeam = async (userId) => {
    try {
        return await Team.findOneAndDelete({ userId });
    } catch (error) {
        console.error('Error deleting enrolled team:', error);
        throw error;
    }
};

const getAllEnrolledTeams = async () => {
    try {
        const teams = await Team.find({});
        return teams.map(team => ({
            userId: team.userId,
            teamName: team.teamName,
            teamTag: team.teamTag,
            players: team.players,
            enrollmentTime: team.enrollmentTime,
            lastUpdated: team.lastUpdated
        }));
    } catch (error) {
        console.error('Error getting all enrolled teams:', error);
        return [];
    }
};

const getScrimRegistration = async (timeSlot, userId) => {
    try {
        return await Scrim.findOne({ timeSlot, userId });
    } catch (error) {
        console.error('Error getting scrim registration:', error);
        return null;
    }
};

const setScrimRegistration = async (timeSlot, userId, registrationData) => {
    try {
        return await Scrim.findOneAndUpdate(
            { timeSlot, userId },
            { ...registrationData, timeSlot, userId },
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error('Error setting scrim registration:', error);
        throw error;
    }
};

const deleteScrimRegistration = async (timeSlot, userId) => {
    try {
        return await Scrim.findOneAndDelete({ timeSlot, userId });
    } catch (error) {
        console.error('Error deleting scrim registration:', error);
        throw error;
    }
};

const getAllScrimRegistrations = async (timeSlot) => {
    try {
        const registrations = await Scrim.find({ timeSlot });
        return registrations.map(reg => ({
            userId: reg.userId,
            teamData: reg.teamData,
            registrationTime: reg.registrationTime,
            user: reg.user
        }));
    } catch (error) {
        console.error('Error getting all scrim registrations:', error);
        return [];
    }
};

const getAllScrimSlots = async () => {
    const timeSlots = ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];
    const allRegistrations = {};
    
    for (const slot of timeSlots) {
        allRegistrations[slot] = await getAllScrimRegistrations(slot);
    }
    
    return allRegistrations;
};

const findUserScrimRegistration = async (userId) => {
    try {
        const timeSlots = ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];
        
        for (const slot of timeSlots) {
            const registration = await getScrimRegistration(slot, userId);
            if (registration) {
                return { timeSlot: slot, registration };
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error finding user scrim registration:', error);
        return null;
    }
};

const findTeamByPlayerId = async (playerId) => {
    try {
        return await Team.findOne({ 'players.id': playerId });
    } catch (error) {
        console.error('Error finding team by player ID:', error);
        return null;
    }
};

module.exports = {
    Team,
    Scrim,
    initializeDatabase,
    initializeScrimSlots,
    forceResetDatabase,
    migratePlayerData,
    getEnrolledTeam,
    setEnrolledTeam,
    deleteEnrolledTeam,
    getAllEnrolledTeams,
    getScrimRegistration,
    setScrimRegistration,
    deleteScrimRegistration,
    getAllScrimRegistrations,
    getAllScrimSlots,
    findUserScrimRegistration,
    findTeamByPlayerId
}; 