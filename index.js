import { Client, GatewayIntentBits, Partials } from "discord.js";
import { GreatDB, Schema, DataType } from "great.db";
import "dotenv/config";

import ticketCreationWorker from "./ticketCreationWorker.js";
import sendMessage from "./ticketHandler.js";
import closeTicket from "./ticketClose.js";

// BOT INIT

export const bot = new Client({
  intents: [
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel] /* INTENTS WEREN'T ENOUGH? FUCKING HELL.*/,
});

// DB INIT

// JS cannot handle discord ids because they are out of the safe integer range.

export const db = new GreatDB.Database({
  type: GreatDB.Type.File,
  filename: "./db",
});

const channelInfoSchema = Schema.Create({
  id: DataType.String,
  username: DataType.String,
  channelId: DataType.String,
});

export const messageLogSchema = Schema.Create({
  id: DataType.String,
  authorId: DataType.String,
  timestamp: DataType.Number,
  content: DataType.String,
  username: DataType.String,
  attachments: DataType.String,
  botMessageId: DataType.String
});

export let guildRef,
  categoryRef,
  logChnRef,
  channelListener = [];
export const chtable = db.table("modmail", channelInfoSchema);

channelListener = chtable.filter("Select", {}).map(n => n.channelId);

console.log("Starting up with the following listeners: " + JSON.stringify(channelListener));

bot.on("ready", () => {
  console.log(`Bot ready as ${bot.user.username}`);
  guildRef = bot.guilds.cache.get(process.env.guildId);
  categoryRef = bot.channels.cache.get(process.env.categoryId);
  logChnRef = bot.channels.cache.get(process.env.logChannelId);
});

bot.on("messageUpdate", async (oldmsg, newmsg) => {
  if (oldmsg.author.bot) return;
  if (oldmsg.content == newmsg.content) return;

  if (!chtable.has("id", oldmsg.author.id)) return;

  if (db.table("log"+oldmsg.author.id, messageLogSchema).has("id", oldmsg.id)) {
    sendMessage(newmsg, oldmsg.channel.type == 0 ? "channel" : "dm", true);
  }
})

bot.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.type == 1) {
    if (chtable.has("id", message.author.id)) {
      sendMessage(message, "dm");
    } else {
      ticketCreationWorker(message);
    } 
  } else if (message.channel.type == 0 && channelListener.includes(message.channel.id)) {
    if (chtable.has("channelId", message.channel.id)) {
        if (message.content.startsWith("=close")) return closeTicket(message);
        sendMessage(message, "channel");
    }
  }
});

bot.login(process.env.botToken);
