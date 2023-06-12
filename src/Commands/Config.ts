import { SlashCommandBuilder } from 'reciple';
import { BaseModule } from '../BaseModule.js';
import { ServerProtocol, Servers } from '@prisma/client';
import { ChatInputCommandInteraction, inlineCode } from 'discord.js';
import Utility from '../Utils/Utility.js';

export class Config extends BaseModule {
    public async onStart(): Promise<boolean> {
        this.commands = [
            new SlashCommandBuilder()
                .setName('config')
                .setDescription('Configure status bot')
                .addSubcommandGroup(servers => servers
                    .setName('servers')
                    .setDescription('Configure servers')
                    .addSubcommand(create => create
                        .setName('create')
                        .setDescription('Create new server')
                        .addStringOption(ip => ip
                            .setName('ip')
                            .setDescription('Server IP (myserver.net:25565)')
                            .setRequired(true)
                        )
                        .addStringOption(protocol => protocol
                            .setName('protocol')
                            .setDescription('Server protocol')
                            .setRequired(true)
                            .addChoices(
                                { name: 'Java', value: ServerProtocol.JAVA },
                                { name: 'Bedrock', value: ServerProtocol.BEDROCK }
                            )
                        )
                        .addStringOption(name => name
                            .setName('name')
                            .setDescription('Server display name')
                        )
                    )
                    .addSubcommand(edit => edit
                        .setName('edit')
                        .setDescription('Edit a server')
                        .addStringOption(server => server
                            .setName('server')
                            .setDescription('Server to edit')
                            .setAutocomplete(true)
                            .setRequired(true)
                        )
                        .addStringOption(ip => ip
                            .setName('ip')
                            .setDescription('Server IP (myserver.net:25565)')
                        )
                        .addStringOption(protocol => protocol
                            .setName('protocol')
                            .setDescription('Server protocol')
                            .addChoices(
                                { name: 'Java', value: ServerProtocol.JAVA },
                                { name: 'Bedrock', value: ServerProtocol.BEDROCK }
                            )
                        )
                        .addStringOption(name => name
                            .setName('name')
                            .setDescription('Server display name')
                        )
                    )
                    .addSubcommand(remove => remove
                        .setName('remove')
                        .setDescription('Remove a server')
                        .addStringOption(server => server
                            .setName('server')
                            .setDescription('Server to remove')
                            .setAutocomplete(true)
                            .setRequired(true)
                        )
                    )
                    .addSubcommand(setDefault => setDefault
                        .setName('set-default')
                        .setDescription('Set default server (Don\'t choose to unset)')
                        .addStringOption(server => server
                            .setName('server')
                            .setDescription('Server to remove')
                            .setAutocomplete(true)
                        )
                    )
                )
                .setExecute(async ({ interaction }) => {
                    const command = interaction.options.getSubcommand(true);
                    const group = interaction.options.getSubcommandGroup(true);

                    if (!interaction.inGuild()) return;

                    if (group === 'servers') {
                        switch (command) {
                            case 'create':
                                return this.handleServerCreateCommand(interaction);
                            case 'edit':
                                return this.handleServerEditCommand(interaction);
                            case 'remove':
                                return this.handleServerDeleteCommand(interaction);
                            case 'set-default':
                                return this.handleServerSetDefault(interaction);
                        }
                    }
                })
        ];

        return true;
    }

    public async handleServerCreateCommand(interaction: ChatInputCommandInteraction<'raw'|'cached'>): Promise<void> {
        const name = interaction.options.getString('name');
        const protocol = interaction.options.getString('protocol', true) as ServerProtocol;
        const ip = interaction.options.getString('ip', true);

        await interaction.deferReply({ ephemeral: true });

        const { host, port } = Utility.parseHost(ip, protocol);
        const exists = !!await Utility.prisma.servers.count({ where: { host, port, guildId: interaction.guildId } });

        if (exists) {
            await interaction.editReply(Utility.createErrorMessage(`${inlineCode(ip)} is already added in this guild`));
            return;
        }

        const server = await Utility.prisma.servers.create({
            data: {
                guildId: interaction.guildId,
                name, host, port, protocol
            }
        });

        await interaction.editReply(Utility.createSuccessMessage(`Added new server **${inlineCode(Utility.parseServerDisplayName(server))}**`));
    }

    public async handleServerEditCommand(interaction: ChatInputCommandInteraction<'raw'|'cached'>): Promise<void> {
        const serverId = interaction.options.getString('server', true);

        let name = interaction.options.getString('name') || undefined;
        let protocol = interaction.options.getString('protocol') as ServerProtocol || undefined;
        let ip = interaction.options.getString('ip') || undefined;

        await interaction.deferReply({ ephemeral: true });

        const server = await Utility.prisma.servers.findFirst({ where: { id: serverId, guildId: interaction.guildId } });

        if (!server) {
            await interaction.editReply(Utility.createErrorMessage(`Server not found`));
            return;
        }

        name = name || server.name || undefined;
        protocol = protocol || server.protocol;
        ip = ip || Utility.stringifyHost(server);

        const { host, port } = Utility.parseHost(ip, protocol);
        const sameNewIp = await Utility.prisma.servers.count({ where: { host, port, id: { not: server.id } } });

        if (!sameNewIp) {
            await interaction.editReply(Utility.createErrorMessage(`**${inlineCode(ip)}** is already added in this guild`));
            return;
        }

        await Utility.prisma.servers.update({
            where: { id: server.id },
            data: { name, host, port, protocol }
        });

        await interaction.editReply(Utility.createSuccessMessage(`Updated server **${inlineCode(Utility.parseServerDisplayName(server))}**`));
    }

    public async handleServerDeleteCommand(interaction: ChatInputCommandInteraction<'raw'|'cached'>): Promise<void> {
        const serverId = interaction.options.getString('server', true);

        await interaction.deferReply({ ephemeral: true });

        const server = await Utility.prisma.servers.findFirst({ where: { id: serverId, guildId: interaction.guildId }, include: { guild: true } });

        if (!server) {
            await interaction.editReply(Utility.createErrorMessage(`Server not found`));
            return;
        }

        await Utility.prisma.servers.delete({ where: { id: server.id } });

        if (server.guild.defaultServerId === server.id) {
            await Utility.prisma.guilds.update({
                where: { id: interaction.guildId },
                data: { defaultServerId: null }
            });
        }

        await interaction.editReply(Utility.createSuccessMessage(`Deleted **${inlineCode(Utility.parseServerDisplayName(server))}**`));
    }

    public async handleServerSetDefault(interaction: ChatInputCommandInteraction<'raw'|'cached'>): Promise<void> {
        const serverId = interaction.options.getString('server');

        await interaction.deferReply({ ephemeral: true });

        let server: Servers|null = null;

        if (serverId) {
            server = await Utility.prisma.servers.findFirst({ where: { id: serverId, guildId: interaction.guildId } });

            if (!server) {
                await interaction.editReply(Utility.createErrorMessage(`Server not found`));
                return;
            }
        }

        await Utility.prisma.guilds.upsert({
            where: { id: interaction.guildId },
            create: { id: interaction.guildId, defaultServerId: serverId },
            update: { defaultServerId: serverId }
        });

        await interaction.editReply(Utility.createSuccessMessage(`Updated default server to **${inlineCode(server ? Utility.parseServerDisplayName(server) : 'none')}**`));
    }
}

export default new Config();