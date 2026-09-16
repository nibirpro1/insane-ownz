import "dotenv/config";
import { REST, Routes } from "discord.js";
import fs from "fs";
import path from "path";

const commands: any[] = [];
const commandsPath = path.join(__dirname, "commands");
const categories = fs.readdirSync(commandsPath);

for (const category of categories) {
  const categoryPath = path.join(commandsPath, category);
  const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith(".ts"));

  for (const file of files) {
    const command = require(path.join(categoryPath, file)).default;
    if (command?.data?.toJSON) {
      commands.push(command.data.toJSON());
    }
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    console.log(`Deploying ${commands.length} slash commands...`);
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!),
      { body: commands }
    );
    console.log("Successfully deployed commands to Insane Ownz.");
  } catch (err) {
    console.error(err);
  }
})();
