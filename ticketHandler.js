import { chtable, db, messageLogSchema, bot, findById } from "./index.js";
import { EmbedBuilder } from "discord.js";

const imageExtensions = ["png", "jpeg", "jpg"];

export default async function sendMessage(message, type, isEdit) {
  const channel =
    type == "dm"
      ? bot.channels.cache.get(chtable.get("id", message.author.id).channelId)
      : await findById(chtable.get("channelId", message.channel.id).id);

  const messageEmbed = new EmbedBuilder()
    .setTitle("Message Received")
    .setAuthor({
      name: message.author.username,
      iconURL: message.author.displayAvatarURL(),
    })
    .setColor(0x2ecc40);

  if (message.content) messageEmbed.setDescription(message.content);

  const messageAttachments = Array.from(message.attachments.values());

  if (
    messageAttachments.length >= 2 ||
    (messageAttachments[0] && !imageExtensions.includes(messageAttachments[0].url.split(".").pop()))) {
    messageEmbed.addFields({
      name: "Attachments",
      value: messageAttachments
        .map((e, i) => `[Attachment ${i + 1}](${e.url})`)
        .join("\n"),
    });
  }
  

  if (messageAttachments.length == 1) {
    messageEmbed.setImage(messageAttachments[0].url);
  }

  const userDb =
    type == "dm"
      ? message.author.id
      : chtable.get("channelId", message.channel.id).id;

  const logdb = db.table("log" + userDb, messageLogSchema);

  let embedId;

  if (isEdit) {
    const og = logdb.get("id", message.id);

    if (!og) return;

    if (og.botMessageId) {
      const ogMessage =
        type == "dm"
          ? channel.messages.cache.get(og.botMessageId)
          : channel.dmChannel.messages.cache.get(og.botMessageId);
      embedId = ogMessage.edit({ embeds: [messageEmbed] }); // my dumbass somehow missed this in production. CON-FUCKING-GRATULATIONS
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
    try {
      embedId = await channel.send({ embeds: [messageEmbed] });
      message.react("✅");
    } catch (err) {
      message.channel.send(
        ":x: The user can no longer be messaged, ask them to come back or enable their DMs. If you are unable to do that please close this ticket using `=close`."
      );
      embedId = "abort";
    }
  }


  if (embedId == "abort") return;

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
