import { ServerProtocol, Servers } from '@prisma/client';
import { BaseModule } from '../BaseModule.js';
import { BaseMessageOptions, ButtonBuilder, ButtonStyle, Collection, ComponentType, EmbedBuilder, MessageEditOptions, inlineCode } from 'discord.js';
import JavaProtocol from 'minecraft-protocol';
import BedrockProtocol from 'bedrock-protocol';
import Utility from './Utility.js';
import { dirname, join } from 'path';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { InteractionListenerType } from 'reciple-interaction-events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface PingData {
    status: 'Online'|'Offline';
    maxPlayers: number;
    onlinePlayers: number;
    version: string|null;
    latency: number|null;
    motd: string|null;
    favicon: Buffer|null;
    pingedAt: Date;
}

export interface PingOptions {
    protocol: ServerProtocol;
    host: string;
    port?: number;
    timeout?: number;
}

export type JavaPingOptions = Omit<PingOptions, 'protocol'> & { protocol: 'JAVA'; };
export type BedrockPingOptions = Omit<PingOptions, 'protocol' | 'timeout'> & { protocol: 'BEDROCK'; };

export class PingDataManager extends BaseModule {
    readonly cache: Collection<string, PingData> = new Collection();

    public async onStart(): Promise<boolean> {
        this.interactionListeners = [
            {
                type: InteractionListenerType.Button,
                customId: i => i.customId.startsWith('refresh-ping'),
                execute: async interaction => {
                    const [_, serverId, authorId] = interaction.customId.split(' ') as ['refresh-ping', string, string|undefined];

                    if (!interaction.inGuild()) return;
                    if (authorId && authorId !== interaction.user.id) {
                        await interaction.reply({
                            content: Utility.createErrorMessage('You did not execute this command'),
                            ephemeral: true
                        });
                        return;
                    }

                    await interaction.deferUpdate();

                    const message = interaction.message;

                    const editMessage = (options: MessageEditOptions|string) => message.flags.has('Ephemeral')
                        ? interaction.editReply({ ...(typeof options === 'string' ? { content: options } : options), message })
                        : message.edit(options);

                    await editMessage({
                        content: Utility.createLabel('Pinging...', '⌛'),
                        components: []
                    });

                    const server = await Utility.prisma.servers.findFirst({ where: { id: serverId, guildId: interaction.guildId } });

                    if (!server) {
                        await editMessage(Utility.createErrorMessage('Server not found'));
                        return;
                    }

                    const newContent = await this.createPingMessageOptions(server, authorId);

                    newContent.content = ' ';

                    await editMessage(newContent);
                }
            }
        ];

        return true;
    }

    public async ping(options: (JavaPingOptions|BedrockPingOptions) & { useWorkerThread?: boolean; cache?: boolean; }): Promise<PingData> {
        const pingData = await PingDataManager.pingServer(options);

        if (options.cache !== false) {
            this.cache.set(
                Utility.stringifyHost(options),
                pingData.status === 'Online'
                    ? pingData
                    : { ...pingData, ...this.cache.get(Utility.stringifyHost(options)), status: 'Offline' }
            );
        }

        return pingData;
    }

    public async createPingMessageOptions(server: Servers, authorId?: string): Promise<BaseMessageOptions> {
        const pingData = await this.ping({
            host: server.host,
            port: server.port || undefined,
            protocol: server.protocol
        });

        const embed = new EmbedBuilder();

        embed.setAuthor({ name: `Server is ${pingData.status.toLowerCase()}` });
        embed.setFooter({ text: Utility.stringifyHost(server), iconURL: pingData.favicon ? 'attachment://favicon.png' : undefined });
        embed.setColor(pingData.status === 'Online' ? 'Green' : 'DarkerGrey');
        embed.setTitle(Utility.parseServerDisplayName(server));
        embed.setDescription(pingData.motd || null);
        embed.setTimestamp(pingData.pingedAt);

        if (pingData.status === 'Online') {
            embed.addFields({
                name: Utility.createLabel('Players', '👥'),
                value: `**${pingData.onlinePlayers}/${pingData.maxPlayers}**`
            });

            if (pingData.latency) {
                embed.addFields({
                    name: Utility.createLabel('Ping', '🏓'),
                    value: inlineCode(Utility.ms(pingData.latency, true))
                });
            }

            if (pingData.version) {
                embed.addFields({
                    name: Utility.createLabel('Version', '🎮'),
                    value: pingData.version
                });
            }
        }

        if (pingData.favicon) embed.setThumbnail('attachment://favicon.png');

        return {
            embeds: [embed],
            files: pingData.favicon
                ? [
                    { name: 'favicon.png', attachment: Buffer.from(pingData.favicon) }
                ]
                : [],
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        new ButtonBuilder()
                            .setCustomId(`refresh-ping ${server.id} ${authorId}`)
                            .setStyle(ButtonStyle.Secondary)
                            .setLabel('Refresh')
                    ]
                }
            ]
        };
    }

    public static async pingServer(options: (JavaPingOptions|BedrockPingOptions) & { useWorkerThread?: boolean; }): Promise<PingData> {
        if (options.useWorkerThread === false) {
            return options.protocol === 'JAVA' ? await this.pingJavaServer(options) : await this.pingBedrockServer(options);
        }

        return new Promise((res, rej) => {
            const worker = new Worker(join(__dirname, './workers/ping.js'), {
                workerData: options
            });

            worker.on('message', res);
            worker.on('error', rej);
            worker.on('exit', code => {
                if (code !== 0) rej(new Error(`Ping worker exited with an error code: ${code}`));
            });
        });
    }

    public static async pingJavaServer(options: JavaPingOptions): Promise<PingData> {
        const pingData = await JavaProtocol.ping({
            host: options.host,
            port: options.port,
            closeTimeout: options.timeout
        }).catch(() => null);

        let status: PingData = {
            status: 'Offline',
            maxPlayers: 0,
            onlinePlayers: 0,
            version: null,
            latency: null,
            motd: null,
            favicon: null,
            pingedAt: new Date()
        };

        if (!pingData) return status;
        if (typeof (pingData as JavaProtocol.NewPingResult).players === 'undefined') return status;

        const newPingResult = pingData as JavaProtocol.NewPingResult;

        status.status = 'Online';
        status.maxPlayers = newPingResult.players.max;
        status.onlinePlayers = newPingResult.players.online;
        status.latency = newPingResult.latency;
        status.version = newPingResult.version.name;
        status.motd = typeof newPingResult.description === 'string' ? newPingResult.description : (newPingResult.description.text || null);
        status.favicon = newPingResult.favicon ? Utility.parseBase64ImageURL(newPingResult.favicon) : null;

        return status;
    }

    public static async pingBedrockServer(options: BedrockPingOptions): Promise<PingData> {
        const pingData = await BedrockProtocol.ping({
            host: options.host,
            port: options.port || 19132
        }).catch(() => null);

        let status: PingData = {
            status: 'Offline',
            maxPlayers: 0,
            onlinePlayers: 0,
            version: null,
            latency: null,
            motd: null,
            favicon: null,
            pingedAt: new Date()
        };

        if (!pingData) return status;

        status.status = 'Online';
        status.maxPlayers = pingData.playersMax;
        status.onlinePlayers = pingData.playersOnline;
        status.latency = null;
        status.version = pingData.version;
        status.motd = pingData?.motd || null;

        return status;
    }
}

export default new PingDataManager();