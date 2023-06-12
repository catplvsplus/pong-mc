import { Guilds, Servers } from '@prisma/client';
import { BaseModule } from '../BaseModule.js';
import Utility from './Utility.js';

export class DatabaseHelpers extends BaseModule {
    public async onStart(): Promise<boolean> {
        return true;
    }

    public async fetchGuildData(id: string, createIfNotExists?: true): Promise<(Guilds & { servers: Servers[]; })>;
    public async fetchGuildData(id: string, createIfNotExists?: false): Promise<(Guilds & { servers: Servers[]; })|null>;
    public async fetchGuildData(id: string, createIfNotExists: boolean = true): Promise<(Guilds & { servers: Servers[]; })|null> {
        const guildData = await Utility.prisma.guilds.findFirst({
            where: { id },
            include: { servers: true }
        });

        if (guildData || !guildData && createIfNotExists === false) return guildData;

        return Utility.prisma.guilds.create({
            data: { id },
            include: { servers: true }
        });
    }

    public async fetchGuildServerData(id: string): Promise<Servers|null> {
        return Utility.prisma.servers.findFirst({ where: { id } });
    }
}

export default new DatabaseHelpers();