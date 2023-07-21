import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  AttachmentBuilder,
} from "discord.js";

import {
  chtable,
  db,
  messageLogSchema,
  logChnRef,
  channelListener,
} from "./index.js";

function deleteTicket(message) {
  const user = chtable.get("channelId", message.channel.id).id;

  const messages = db
    .table("log" + user, messageLogSchema)
    .filter("Select", {});
  const log = messages
    .map(
      (e) =>
        `[${e.timestamp} - @${e.username}] ${
          e.content == "Not provided" ? "" : e.content
        } ${e.attachments ? "\n> Attachments: \n" + e.attachments : "\n"}`
    )
    .join("");
  db.deleteTable("log" + user);
  chtable.delete("channelId", message.channel.id);

  const x = channelListener.indexOf(channelListener);
  channelListener.splice(x, 1);

  const userData = message.guild.members.cache.get(user) || "Not found";

  const reason = message.content.split("=close ")[1] || "";

  const logEmbed = new EmbedBuilder()
    .setTitle(":white_check_mark: Ticket closed")
    .addFields([
      {
        name: "User",
        value: userData.user.username
          ? `${userData.user.username} (<@${user}>)`
          : "Not found",
      },
      {
        name: "Reason",
        value: `Closed by ${message.author.username} (<@${message.author.id}>)${
          reason.length >= 1 ? ": " + reason : "."
        }`,
      },
    ]).setColor(0xFF4136);

  const textFile = new AttachmentBuilder(Buffer.from(log), {
    name: "transcript.txt",
  });

  message.channel.delete();

  logChnRef.send({ embeds: [logEmbed] });
  logChnRef.send({ files: [textFile] });
}

export default async function closeTicket(message) {
  const closeEmbed = new EmbedBuilder()
    .setTitle(":question: Are you sure you want to close this ticket?")
    .setDescription(
      `Are you sure you want to close this ticket? The user will have to open the ticket again to contact the staff team.`
    )
    .setColor(0xff4136);

  const proceedBtn = new ButtonBuilder()
    .setCustomId("confirmTicketDeletion")
    .setStyle(ButtonStyle.Primary)
    .setLabel("Close");
  const cancelBtn = new ButtonBuilder()
    .setCustomId("cancelTicketDeletion")
    .setStyle(ButtonStyle.Secondary)
    .setLabel("Cancel");

  const row = new ActionRowBuilder().addComponents(proceedBtn, cancelBtn);

  const response = await message.reply({
    embeds: [closeEmbed],
    components: [row],
  });

  const collectorFilter = (i) => i.user.id === message.author.id;

  try {
    const confirmation = await response.awaitMessageComponent({
      filter: collectorFilter,
      time: 15_000,
    });

    switch (confirmation.customId) {
      case "confirmTicketDeletion":
        const deletingEmbed = new EmbedBuilder()
          .setTitle(":exclamation: Deleting ticket.")
          .setDescription("Please wait...")
          .setColor(0xff4136);
        await response.edit({
          embeds: [deletingEmbed],
          components: [],
        });
        deleteTicket(message);
        break;
      case "cancelTicketDeletion":
        await response.delete();
        break;
    }
  } catch (e) {
    console.log(e);
    await response.delete();
  }
}
