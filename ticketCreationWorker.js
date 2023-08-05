import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ChannelType,
} from "discord.js";

import {
  guildRef,
  categoryRef,
  categoryRefBackup,
  chtable,
  channelListener,
  messageLogSchema,
  db,
  logChnRef,
} from "./index.js";

async function createNewTicket(message) {

  const whichCategory = Array.from(categoryRef.children.cache.values()).length >= 50 ? categoryRefBackup : categoryRef;

  const ticketChannel = await guildRef.channels.create({
    name: `ticket-${message.author.username}`,
    type: ChannelType.GuildText,
    parent: whichCategory,
    reason: `ModMail Ticket Opened by ${message.author.username}`,
    topic: `ID: ${message.author.id}, Time Created: ${new Date().toString()}`,
  });

  if (chtable.has("id", message.author.id)) return ticketChannel.delete(); // LMAO

  chtable.set({
    id: message.author.id,
    username: message.author.username,
    channelId: ticketChannel.id,
  });

  const messageAttachments = Array.from(message.attachments.values());
  channelListener.push(ticketChannel.id);

  const initEmbed = new EmbedBuilder()
    .setTitle(`New ticket from ${message.author.username}`)
    .setDescription(
      `Received a new ticket from \`${message.author.username}\`, please respond. You can close this ticket using \`=close\`.`
    )
    .addFields([
      {
        name: "User",
        value: `${message.author.username} (<@${message.author.id}>)`,
      },
      { name: "Content", value: message.content || "Not provided" },
      {
        name: "Attachments",
        value:
          messageAttachments.length >= 1
            ? messageAttachments
                .map((e, i) => `[Attachment ${i + 1}](${e.proxyURL})`)
                .join("\n")
            : "None",
      },
    ])
    .setColor(0x0074d9);

  if (messageAttachments.length == 1) {
    initEmbed.setImage(messageAttachments[0].proxyURL);
  }

  ticketChannel.send({ embeds: [initEmbed] });

  db.table("log" + message.author.id, messageLogSchema).set({
    id: message.id,
    authorId: message.author.id,
    timestamp: new Date().getTime(),
    content: message.content || "Not provided",
    username: message.author.username,
    attachments:
      messageAttachments.length >= 1
        ? messageAttachments.map((e, i) => `${i + 1}. ${e.proxyURL}`).join("\n")
        : undefined,
  });

  const logEmbed = new EmbedBuilder()
    .setTitle(":exclamation: New ticket created")
    .setDescription(
      `A new ticket has been created by ${message.author.username} (<@${message.author.id}>) in <#${ticketChannel.id}>.`
    )
    .setColor(0x2ecc40);

  logChnRef.send({ embeds: [logEmbed] });
}

export default async function ticketCreationWorker(message) {
  const newcomerEmbed = new EmbedBuilder()
    .setTitle(`> Hi there, ${message.author.username}!`)
    .setDescription(
      `As soon as you click the **Proceed** button the message you sent will be sent straight to the Server Staff Team. Are you sure you want to send the message above to the staff team?`
    )
    .setColor(0x0074d9);

  const proceedBtn = new ButtonBuilder()
    .setCustomId("confirmTicketCreation")
    .setStyle(ButtonStyle.Success)
    .setLabel("⏩ Proceed");
  const cancelBtn = new ButtonBuilder()
    .setCustomId("cancelTicketCreation")
    .setStyle(ButtonStyle.Danger)
    .setLabel("❌ Cancel");

  const row = new ActionRowBuilder().addComponents(proceedBtn, cancelBtn);

  const response = await message.reply({
    embeds: [newcomerEmbed],
    components: [row],
  });

  const collectorFilter = (i) => i.user.id === message.author.id;

  try {
    const confirmation = await response.awaitMessageComponent({
      filter: collectorFilter,
      time: 15_000,
    });

    switch (confirmation.customId) {
      case "confirmTicketCreation":
        const sentEmbed = new EmbedBuilder()
          .setTitle("> :white_check_mark: Message sent")
          .setDescription(
            "Your message has been successfully sent to the staff team, expect to hear from us soon."
          )
          .setColor(0x2ecc40);
        await response.edit({
          embeds: [sentEmbed],
          components: [],
        });
        message.react("✅");
        createNewTicket(message);
        break;
      case "cancelTicketCreation":
        const cancelEmbed = new EmbedBuilder()
          .setTitle("> :x: Ticket creation cancelled")
          .setDescription("Cancelled by user.")
          .setColor(0xff4136);
        await response.edit({
          embeds: [cancelEmbed],
          components: [],
        });
        break;
    }
  } catch (e) {
    console.log(e);
    const cancelEmbed = new EmbedBuilder()
      .setTitle("> :x: Ticket creation cancelled")
      .setDescription("Confirmation timed out.")
      .setColor(0xff4136);
    await response.edit({
      embeds: [cancelEmbed],
      components: [],
    });
  }
}
