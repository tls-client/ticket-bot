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

client.once("ready", () => {
  console.log(`${client.user.tag} 起動完了`);
});

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (message.content !== "!panel") return;

  const embed = new EmbedBuilder()
    .setColor("#2b2d31")
    .setTitle("チケットを開く")
    .setDescription(
      "お問い合わせ内容の件名を選択してください。\n\n" +
      "**ルール**\n" +
      "• 1つの件名につき作成できるチケットは1つまでです\n" +
      "• スタッフへのメンションは控えてください\n" +
      "• 頻繁な催促は回答を遅らせる可能性があります"
    )
    .setImage("https://i.imgur.com/4M34hi2.png");

  const select = new StringSelectMenuBuilder()
    .setCustomId("ticket_create")
    .setPlaceholder("新しいチケットを作成する")
    .addOptions([
      {
        label: "問い合わせ",
        value: "support",
        description: "サポート用チケット"
      },
      {
        label: "報告",
        value: "report",
        description: "報告用チケット"
      }
    ]);

  const row = new ActionRowBuilder().addComponents(select);

  await message.channel.send({
    embeds: [embed],
    components: [row]
  });
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== "ticket_create") return;

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

  const closeBtn = new ButtonBuilder()
    .setCustomId("close_ticket")
    .setLabel("Close Ticket")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(closeBtn);

  await ticket.send({
    content: `<@${interaction.user.id}> <@&${STAFF_ROLE_ID}>`,
    embeds: [
      new EmbedBuilder()
        .setColor("#2b2d31")
        .setTitle("チケット作成完了")
        .setDescription("スタッフの対応をお待ちください。")
    ],
    components: [row]
  });

  await interaction.reply({
    content: `作成完了: ${ticket}`,
    ephemeral: true
  });
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "close_ticket") return;

  await interaction.reply({
    content: "3秒後に削除します",
    ephemeral: true
  });

  setTimeout(() => {
    interaction.channel.delete();
  }, 3000);
});

client.login(TOKEN);
