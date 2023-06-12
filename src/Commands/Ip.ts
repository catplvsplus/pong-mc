import { SlashCommandBuilder } from 'reciple';
import { BaseModule } from '../BaseModule.js';
import DatabaseHelpers from '../Utils/DatabaseHelpers.js';
import Utility from '../Utils/Utility.js';

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

                    await interaction.editReply(server.name || Utility.stringifyHost(server));
                })
        ];

        return true;
    }
}

export default new Ip();