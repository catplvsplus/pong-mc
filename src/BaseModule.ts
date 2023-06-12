import { AnyCommandBuilder, AnyCommandData, ContextMenuCommandExecuteData, MessageCommandExecuteData, RecipleClient, RecipleModule, RecipleModuleScriptUnloadData, SlashCommandExecuteData } from 'reciple';
import { AnyInteractionListener, RecipleInteractionListenerModule } from 'reciple-interaction-events';

export abstract class BaseModule implements RecipleInteractionListenerModule {
    public versions: string  = '^7';
    public commands: (AnyCommandBuilder | AnyCommandData)[] = [];
    public devCommands: (AnyCommandBuilder | AnyCommandData)[] = [];
    public interactionListeners: AnyInteractionListener[] = [];

    public abstract onStart(client: RecipleClient<false>, module: RecipleModule): Promise<boolean>;

    public async onLoad(client: RecipleClient<true>, module: RecipleModule): Promise<void> {}
    public async onUnload(unloadData: RecipleModuleScriptUnloadData): Promise<void> {}

    public async contextMenuCommandPrecondition(executeData: ContextMenuCommandExecuteData): Promise<boolean> {
        return true;
    }

    public async messageCommandPrecondition(executeData: MessageCommandExecuteData<true>): Promise<boolean> {
        return true;
    }

    public async slashCommandPrecondition(executeData: SlashCommandExecuteData): Promise<boolean> {
        return true;
    }
}