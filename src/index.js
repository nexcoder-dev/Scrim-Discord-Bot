const { Client, GatewayIntentBits, Partials } = require(`discord.js`);
const client = new Client({ intents: ['GuildMessages', 'MessageContent', 'DirectMessages', 'GuildMembers', 'Guilds'], }); 
const chalk = require('chalk');
const config = require('../config.json');
const fs = require('fs');
const { eventsHandler } = require('./functions/handlers/handelEvents');
const { handleCommands } = require('./functions/handlers/handleCommands');
const path = require('path');
const { checkMissingIntents } = require('./functions/handlers/requiredIntents');
const { antiCrash } = require('./functions/handlers/antiCrash');
const mongoose = require('mongoose');
require('dotenv').config();

const { handleSelectMenu, handleButton, handleModal } = require('./functions/interactionHandlers.js');
const { initializeDatabase } = require('./functions/database.js');

antiCrash();
require('./functions/handlers/watchFolders');
const adminFolderPath = path.join(__dirname, '../admin');
const dashboardFilePath = path.join(adminFolderPath, 'dashboard.js');

const eventsPath = './events';
const commandsPath = path.join(__dirname, 'commands');

const errorsDir = path.join(__dirname, '../../../errors');

const connectToMongoDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || config.database?.mongodbUrl;
        if (!mongoURI) {
            console.error(chalk.red.bold('ERROR: ') + 'MongoDB URI not found. Please add MONGODB_URI to your .env file or mongodbUrl to config.json');
            process.exit(1);
        }
        
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log(chalk.green.bold('SUCCESS: ') + 'Connected to MongoDB successfully!');
    } catch (error) {
        console.error(chalk.red.bold('ERROR: ') + 'Failed to connect to MongoDB:', error);
        process.exit(1);
    }
};

function ensureErrorDirectoryExists() {
    if (!fs.existsSync(errorsDir)) {
        fs.mkdirSync(errorsDir);
    }
}

function logErrorToFile(error) {
    ensureErrorDirectoryExists();

    const errorMessage = `${error.name}: ${error.message}\n${error.stack}`;

    const fileName = `${new Date().toISOString().replace(/:/g, '-')}.txt`;
    const filePath = path.join(errorsDir, fileName);

    fs.writeFileSync(filePath, errorMessage, 'utf8');
}

(async () => {
    try {
        await connectToMongoDB();
        
        await client.login(config.bot.token);
        console.log(chalk.green.bold('SUCCESS: ') + 'Bot logged in successfully!');
        
        if (fs.existsSync(adminFolderPath) && fs.existsSync(dashboardFilePath)) {
            require(dashboardFilePath);
            console.log(chalk.green(chalk.green.bold('SUCCESS: Admin dashboard loaded successfully!.')));
        }
        
        require('./functions/handlers/functionHandler');

        await handleCommands(client, commandsPath);
        
        await eventsHandler(client, path.join(__dirname, eventsPath));
        checkMissingIntents(client);
    } catch (error) {
        if (error.message === "An invalid token was provided.") {
            console.error(chalk.red.bold('ERROR: ') + 'The token provided for the Discord bot is invalid. Please check your configuration.');
            logErrorToFile(error)
        } else {
            console.error(chalk.red.bold('ERROR: ') + 'Failed to log in:', error);
            logErrorToFile(error)
        }
    }
})();

module.exports = client;

client.once('ready', async () => {
    console.log(`Bot is ready! Logged in as ${client.user.tag}`);
    await initializeDatabase();
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand()) {
        return;
    } else if (interaction.isStringSelectMenu()) {
        await handleSelectMenu(interaction);
    } else if (interaction.isButton()) {
        await handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
        await handleModal(interaction);
    }
}); 



client.on('interactionCreate', async interaction => {
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
  
      try {
        await command.autocomplete(interaction);
      } catch (err) {
      }
    }
});