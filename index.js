import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ChannelType,
} from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = 'YOUR_CLIENT_ID'; // ganti dengan Client ID bot kamu
const ROLE_ID = process.env.ROLE_ID;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const verifyDB = 'verify.json';
if (!fs.existsSync(verifyDB)) fs.writeFileSync(verifyDB, '{}');

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

const commands = [
  new SlashCommandBuilder()
    .setName('get_code')
    .setDescription('Send a verification code to your email')
    .addStringOption(opt =>
      opt.setName('email')
        .setDescription('Enter your email')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('activation_code')
    .setDescription('Verify your code')
    .addStringOption(opt =>
      opt.setName('code')
        .setDescription('Enter the code you received')
        .setRequired(true)
    ),
];

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log('📡 Slash commands registered');
  } catch (err) {
    console.error(err);
  }
})();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  if (interaction.commandName === 'get_code') {
    const email = interaction.options.getString('email');
    const code = uuidv4().split('-')[0].toUpperCase();

    const db = JSON.parse(fs.readFileSync(verifyDB));
    db[userId] = { code, email };
    fs.writeFileSync(verifyDB, JSON.stringify(db, null, 2));

    const mailOptions = {
      from: `"Verification Bot" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Verification Code',
      html: `
        <div style="font-family: Arial; text-align: center;">
          <h2>🎉 Welcome to the Discord Server!</h2>
          <p>Your verification code is:</p>
          <h1 style="color: #4A90E2;">${code}</h1>
          <p>Please return to Discord and use <code>/activation_code</code> to complete your verification.</p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      await interaction.reply({ content: `✅ Verification code sent to **${email}**!`, ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: `❌ Failed to send email.`, ephemeral: true });
    }
  }

  if (interaction.commandName === 'activation_code') {
    const code = interaction.options.getString('code').toUpperCase();
    const db = JSON.parse(fs.readFileSync(verifyDB));
    const entry = db[userId];

    if (!entry) {
      await interaction.reply({ content: `❌ You haven't requested a code.`, ephemeral: true });
      return;
    }

    if (entry.code !== code) {
      await interaction.reply({ content: `❌ Invalid verification code.`, ephemeral: true });
      return;
    }

    const member = await interaction.guild.members.fetch(userId);
    await member.roles.add(ROLE_ID);
    delete db[userId];
    fs.writeFileSync(verifyDB, JSON.stringify(db, null, 2));
    await interaction.reply({ content: `✅ You're now verified! Role assigned.`, ephemeral: true });
  }
});

client.login(TOKEN);
