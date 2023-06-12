import { MessageCommandBuilder, SlashCommandBuilder } from 'reciple';
import { BaseModule } from '../BaseModule.js';
import DatabaseHelpers from '../Utils/DatabaseHelpers.js';
import Utility from '../Utils/Utility.js';
import PingDataManager from '../Utils/PingDataManager.js';

export class Ip extends BaseModule {
    public async onStart(): Promise<boolean> {
        this.commands = [
            new SlashCommandBuilder()
                .setName('ip')
                .setDescription('Get server status')
                .setCooldown(10 * 1000)
                .addStringOption(server => server
                    .setName('server')
                    .setDescription('Get status of a server')
                    .setAutocomplete(true)
                )
                .addBooleanOption(hide => hide
                    .setName('hide')
                    .setDescription('Hide command response')
                )
                .setExecute(async ({ interaction }) => {
                    if (!interaction.inGuild()) return;

                    const serverId = interaction.options.getString('server');
                    const hidden = interaction.options.getBoolean('hide') || true;

                    await interaction.deferReply({ ephemeral: hidden });

                    const guildData = await DatabaseHelpers.fetchGuildData(interaction.guildId);
                    const server = guildData.servers.find(s => s.id === (serverId || guildData.defaultServerId));

                    if (!server) {
                        await interaction.editReply(
                            serverId
                            ? Utility.createErrorMessage('Server not found')
                            : Utility.createErrorMessage('This guild does not have a default server')
                        );

                        return;
                    }

                    const options = await PingDataManager.createPingMessageOptions(server, interaction.user.id);

                    await interaction.editReply(options);
                }),
            new MessageCommandBuilder()
                .setName('ip')
                .setDescription('Get server status')
                .setCooldown(10 * 1000)
                .setExecute(async ({ message }) => {
                    if (!message.inGuild()) return;

                    const reply = await message.reply({
                        content: Utility.createLabel('Pinging...', '⌛'),
                        allowedMentions: { parse: [] }
                    });

                    const guildData = await DatabaseHelpers.fetchGuildData(message.guildId);
                    const server = guildData.servers.find(s => s.id === guildData.defaultServerId);

                    if (!server) {
                        await reply.edit(Utility.createErrorMessage('This guild does not have a default server'));
                        return;
                    }

                    const options = await PingDataManager.createPingMessageOptions(server, message.author.id);
                    await reply.edit(options);
                })
        ];

        return true;
    }
}

export default new Ip();