import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  AttachmentBuilder,
} from "discord.js";

import {
  bot,
  chtable,
  db,
  messageLogSchema,
  logChnRef,
  channelListener,
  findById,
  refreshListener
} from "./index.js";

async function deleteTicket(message) {
  const user = chtable.get("channelId", message.channel.id).id;

  const messages = db
    .table("log" + user, messageLogSchema)
    .filter("Select", {});
  const log = messages
    .map(
      (e) =>
        `[${new Date(e.timestamp).toString()} - @${e.username}] ${
          e.content == "Not provided" ? "" : e.content
        } ${
          e.attachments ? "\n> Attachments: \n" + e.attachments + "\n" : "\n"
        }`
    )
    .join("");
  db.deleteTable("log" + user);
  chtable.delete("channelId", message.channel.id);

  refreshListener();

  const userData = (await findById(user, message)) || "Not found";

  const reason = message.content.split("=close ")[1] || "";

  const logEmbed = new EmbedBuilder()
    .setTitle(":white_check_mark: Ticket closed")
    .addFields([
      {
        name: "User",
        value: userData.username
          ? `${userData.username} (<@${user}>)`
          : `${message.channel.name.split("-")[1]} (<@${user}>)`,
      },
      {
        name: "Reason",
        value: `Closed by ${message.author.username} (<@${message.author.id}>)${
          reason.length >= 1 ? ": " + reason : "."
        }`,
      },
    ])
    .setColor(0xff4136);

  const textFile = new AttachmentBuilder(Buffer.from(log), {
    name: "transcript.txt",
  });

  message.channel.delete();

  logChnRef.send({ embeds: [logEmbed] });
  logChnRef.send({ files: [textFile] });

  const closureInfo = new EmbedBuilder()
    .setTitle(":white_check_mark: The ticket has been closed")
    .setDescription(
      "Thank you for reporting an issue and don't hesitate to contact us in the future by writing another message." +
        (reason.length >= 1 ? `\nReason: ${reason}` : "")
    )
    .setColor(0xff4136);

  if (userData != "Not found") {
    userData.dmChannel.send({ embeds: [closureInfo] });
  }
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
    try {
      await response.delete();
    } catch (e) {}
  }
}
