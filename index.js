const express = require("express");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField
} = require("discord.js");

const app = express();
app.get("/", (req, res) => res.send("Bot Online"));
app.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.TOKEN;
const CATEGORY_ID = process.env.CATEGORY_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;

// ユーザーのアクティブチケットを追跡
const activeTickets = new Map();

client.once("ready", () => {
  console.log(`${client.user.tag} 起動完了`);
});

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (message.content !== "!panel") return;

  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("チケットを開く")
    .setDescription(
      "サポートが必要な場合は下からチケットを作成してください。\n\n" +
      "**ルール**\n" +
      "• チケット作成後スタッフ対応までお待ちください\n" +
      "• スタッフへの催促禁止"
    );

  const select = new StringSelectMenuBuilder()
    .setCustomId("ticket_create")
    .setPlaceholder("チケットを作成")
    .addOptions([
      {
        label: "チケット作成",
        value: "ticket",
        description: "サポートチケットを作成"
      }
    ]);

  const row = new ActionRowBuilder().addComponents(select);

  await message.channel.send({
    embeds: [embed],
    components: [row]
  });
});

client.on("interactionCreate", async interaction => {
  // StringSelectMenu handling
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_create") {
    await interaction.deferReply({ ephemeral: true });

    // ユーザーが既にアクティブチケットを持っているかチェック
    if (activeTickets.has(interaction.user.id)) {
      await interaction.editReply({
        content: "既にアクティブなチケットが存在します。1人1チケットまでです。"
      });
      return;
    }

    try {
      const ticket = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: CATEGORY_ID,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages
            ]
          },
          {
            id: STAFF_ROLE_ID,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages
            ]
          }
        ]
      });

      // アクティブチケットとして記録
      activeTickets.set(interaction.user.id, {
        channelId: ticket.id,
        userId: interaction.user.id
      });

      const closeBtn = new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger);

      const closeRow = new ActionRowBuilder().addComponents(closeBtn);

      await ticket.send({
        content: `<@${interaction.user.id}> <@&${STAFF_ROLE_ID}>`,
        embeds: [
          new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("チケット作成完了")
            .setDescription("スタッフの対応をお待ちください。")
        ],
        components: [closeRow]
      });

      await interaction.editReply({
        content: `作成完了: ${ticket}` 
      });

      await interaction.message.edit({
        embeds: interaction.message.embeds,
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("ticket_create")
              .setPlaceholder("チケットを作成")
              .addOptions([
                {
                  label: "チケット作成",
                  value: "ticket",
                  description: "サポートチケットを作成"
                }
              ])
          )
        ]
      });

    } catch (error) {
      console.error(error);

      await interaction.editReply({
        content: `失敗: ${error.message}` 
      });
    }
  }
  
  // Button handling
  if (interaction.isButton() && interaction.customId === "close_ticket") {
    // スタッフ権限チェック
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!member.roles.cache.has(STAFF_ROLE_ID)) {
      await interaction.reply({
        content: "チケットを閉じられるのはスタッフのみです。",
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: "3秒後にチケットを削除します",
      ephemeral: true
    });

    // チケットを閉じる前にactiveTicketsから削除
    for (const [userId, ticketData] of activeTickets.entries()) {
      if (ticketData.channelId === interaction.channel.id) {
        activeTickets.delete(userId);
        break;
      }
    }

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 3000);
  }
});

// チケットチャンネルが削除されたときの処理
client.on("channelDelete", async channel => {
  // 削除されたチャンネルがチケットチャンネルの場合、activeTicketsから削除
  for (const [userId, ticketData] of activeTickets.entries()) {
    if (ticketData.channelId === channel.id) {
      activeTickets.delete(userId);
      break;
    }
  }
});

client.login(TOKEN);
