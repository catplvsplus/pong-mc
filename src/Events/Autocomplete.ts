import { InteractionListenerType } from 'reciple-interaction-events';
import { BaseModule } from '../BaseModule.js';
import Utility from '../Utils/Utility.js';

export class Autocomplete extends BaseModule {
    public async onStart(): Promise<boolean> {
        this.interactionListeners = [
            {
                type: InteractionListenerType.Autocomplete,
                commandName: 'ip',
                execute: async interaction => {
                    if (!interaction.inCachedGuild()) return;

                    const query = interaction.options.getFocused();
                    const servers: { id: string; host: string; port: number|null; name: string|null; }[] = await Utility.prisma.servers.findMany({
                        where: {
                            OR: [
                                {
                                    host: {
                                        contains: query,
                                        mode: 'insensitive'
                                    },
                                    guildId: interaction.guildId
                                },
                                {
                                    name: {
                                        contains: query,
                                        mode: 'insensitive'
                                    },
                                    guildId: interaction.guildId
                                }
                            ]
                        },
                        select: { id: true, host: true, port: true, name: true },
                        take: 10
                    }).catch(() => []);

                    await interaction.respond(
                        servers
                            .map(s => ({
                                name: `${s.name ? ('(' + s.name + ') ') : ''}${Utility.stringifyHost(s)}`,
                                value: s.id
                            }))
                    );
                }
            }
        ];

        return true;
    }
}

export default new Autocomplete();