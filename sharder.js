// @ts-check
import { Config, cli, command, createLogger } from 'reciple';
import { fileURLToPath } from 'url';
import path from 'path';
import { ClusterManager } from 'discord-hybrid-sharding';
import { ChildProcess } from 'child_process';

const console = await (await createLogger({
        enabled: true,
        debugmode: true,
        coloredMessages: true,
    }))
    .setDebugMode(true)
    .setName('ShardManager')
    .createFileWriteStream({
        file: path.join(cli.cwd, 'sharder-logs/shards.log'),
        renameOldFile: true
    });

if (!import.meta.resolve) throw new Error(`Missing node option "--experimental-import-meta-resolve"`);

// @ts-expect-error We need to modify readonly command options
command.options = command.options.filter(o => !['shardmode', 'version', 'yes'].includes(o.name()));

command.name('').description('The options below are passed to reciple cli shards').parse();

let configPaths = cli.options?.config?.map(c => path.isAbsolute(c) ? path.resolve(c) : path.join(cli.cwd, c));
    configPaths = !configPaths?.length ? [path.join(cli.cwd, 'reciple.yml')] : configPaths;

/**
 * @type {string}
 */
// @ts-ignore
const mainConfigPath = configPaths.shift();

const configParser = await (new Config(mainConfigPath, configPaths)).parseConfig();
const config = configParser.getConfig();

const recipleBin = path.join(path.dirname(fileURLToPath(await import.meta.resolve('reciple'))), 'bin.mjs');
const shards = new ClusterManager(recipleBin, {
    shardArgs: ['--shardmode', ...process.argv.slice(2)],
    token: config.token,
    mode: 'process',
    respawn: true,
});

shards.on('clusterCreate', cluster => {
    console.log(`Creating cluster ${cluster.id}...`);

    if (cluster.thread?.process instanceof ChildProcess) cluster.thread.process.on('exit', c => {
        cluster.kill({ force: true });
    })

    cluster.on('spawn', thread => console.log(`Spawned ${thread instanceof ChildProcess ? ('process ' + thread.pid) : ('worker ' + thread?.threadId)}; clusterId: ${cluster.id};`));
    cluster.on('death', thread => console.log(`Stopped cluster ${thread.id}`));
    cluster.on('message', message => console.log(message.toString().trim()));
    cluster.on('error', error => {
        console.error(`An error occured in cluster ${cluster.id}:`, error);
        cluster.respawn();
    });
});

shards.on('clusterReady', cluster => console.log(`Cluster ${(cluster.id)} is ready!`));
shards.on('debug', message => console.debug(message));

shards.spawn();
