import { chtable, db, messageLogSchema, bot } from "./index.js";
import { EmbedBuilder } from "discord.js";

export default async function sendMessage(message, type, isEdit) {
  const channel =
    type == "dm"
      ? bot.channels.cache.get(chtable.get("id", message.author.id).channelId)
      : bot.users.cache.get(chtable.get("channelId", message.channel.id).id);

  const messageEmbed = new EmbedBuilder()
    .setTitle("Message Received")
    .setAuthor({
      name: message.author.username,
      iconURL: message.author.displayAvatarURL(),
    })
    .setColor(0x2ecc40);

  if (message.content) messageEmbed.setDescription(message.content);

  const messageAttachments = Array.from(message.attachments.values());
  if (messageAttachments.length >= 2) {
    messageEmbed.addFields({
      name: "Attachments",
      value:
        messageAttachments.length >= 1
          ? messageAttachments
              .map((e, i) => `[Attachment ${i + 1}](${e.proxyURL})`)
              .join("\n")
          : "None",
    });
  }

  if (messageAttachments.length == 1) {
    messageEmbed.setImage(messageAttachments[0].proxyURL);
  }

  const logdb = db.table("log" + message.author.id, messageLogSchema);

  let embedId;

  if (isEdit) {
    const og = logdb.get("id", message.id);

    if (og.botMessageId) {
      const ogMessage =
        type == "dm"
          ? channel.messages.cache.get(og.botMessageId)
          : channel.dmChannel.messages.cache.get(og.botMessageId);
      ogMessage.edit({ embeds: [messageEmbed] });
    } else {
      const ogEmbed = new EmbedBuilder()
        .setTitle("The main message has been edited")
        .setDescription(message.content)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL(),
        })
        .setColor(0x2ecc40);

      channel.send({ embeds: [ogEmbed] });
    }
  } else {
    message.react("✅");
    embedId = await channel.send({ embeds: [messageEmbed] });
  }

  logdb.set({
    id: message.id,
    authorId: message.author.id,
    timestamp: isEdit
      ? logdb.get("id", message.id).timestamp
      : new Date().getTime(),
    content: message.content || "Not provided",
    username: message.author.username,
    attachments:
      messageAttachments.length >= 1
        ? messageAttachments.map((e, i) => `${i + 1}. ${e.proxyURL}`).join("\n")
        : undefined,
    botMessageId: logdb.has("id", message.id)
      ? logdb.get("id", message.id).botMessageId
      : embedId.id,
  });
}
