import { RESTPostAPIChatInputApplicationCommandsJSONBody, RESTPostAPIContextMenuApplicationCommandsJSONBody } from 'discord.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { RecipleClient, cli, yaml } from 'reciple';
import { BaseModule } from '../BaseModule.js';
import { dirname, join } from 'path';
import { inspect } from 'util';
import { isJSONEncodable } from 'fallout-utility';

export type RESTPostAPICommand = RESTPostAPIChatInputApplicationCommandsJSONBody|RESTPostAPIContextMenuApplicationCommandsJSONBody;

export class AntiCommandRegisterSpam extends BaseModule {
    public cachePath: string = join(cli.cwd, 'node_modules/.cache/registeredCommands.txt');
    public client!: RecipleClient;

    public async onStart(client: RecipleClient): Promise<boolean> {
        this.client = client;

        return true;
    }

    public async onLoad(client: RecipleClient<true>): Promise<void> {
        const commands = [...client.commands.contextMenuCommands.toJSON(), ...client.commands.slashCommands.toJSON(), ...client.commands.additionalApplicationCommands].map(c => isJSONEncodable<RESTPostAPICommand>(c) ? c.toJSON() : c as RESTPostAPICommand);
        if (client.config.applicationCommandRegister?.enabled === false) return;

        const isEqualToCache = this.isEqualToCache(commands);

        if (isEqualToCache) {
            client.logger?.warn(`Skipping command register!`);

            client.config.applicationCommandRegister = {
                ...client.config.applicationCommandRegister,
                enabled: false
            };
        }

        this.updateLastRegisteredCommandsId(this.createCommandsId(commands));
    }

    public isEqualToCache(commands: RESTPostAPICommand[]): boolean {
        const id = this.createCommandsId(commands);
        const cachedId = this.fetchLastRegisteredCommandsId();
        if (cachedId === undefined) return false;

        return cachedId === id;
    }

    public createCommandsId(commands: RESTPostAPICommand[]): string {
        const config = [
            {
                additionalApplicationCommands: this.client.config.commands?.additionalApplicationCommands,
                contextMenuCommands: this.client.config.commands?.contextMenuCommand,
                slashCommands: this.client.config.commands?.slashCommand
            },
            this.client.config.applicationCommandRegister
        ];

        return Buffer.from(yaml.stringify({
            commands: inspect(commands, { depth: 5 }),
            config
        })).toString('base64url');
    }

    public updateLastRegisteredCommandsId(id: string): void {
        mkdirSync(dirname(this.cachePath), { recursive: true });
        writeFileSync(this.cachePath, id, 'utf-8');
    }

    public fetchLastRegisteredCommandsId(): string|undefined {
        if (!existsSync(this.cachePath)) return;
        return readFileSync(this.cachePath, 'utf-8');
    }
}

export default new AntiCommandRegisterSpam();