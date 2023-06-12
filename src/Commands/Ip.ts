import { SlashCommandBuilder } from 'reciple';
import { BaseModule } from '../BaseModule.js';

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
                .setExecute(async ({ interaction }) => {
                    
                })
        ];

        return true;
    }
}