import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import { InsaneOwnzClient } from "./InsaneOwnzClient";

export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | any;
  execute: (
    interaction: ChatInputCommandInteraction,
    client: InsaneOwnzClient
  ) => Promise<unknown>;
}
