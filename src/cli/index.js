#!/usr/bin/env node

const { Command } = require('commander');
const {
  enqueueCommand,
  startWorkersCommand,
  stopWorkersCommand,
  statusCommand,
  listJobsCommand,
  listDLQCommand,
  retryDLQCommand,
  setConfigCommand,
  getConfigCommand
} = require('./commands');

const program = new Command();

program
  .name('queuectl')
  .description('CLI-based background job queue system')
  .version('1.0.0');

// Enqueue command
program
  .command('enqueue <job-json>')
  .description('Add a new job to the queue')
  .action((jobJson) => {
    enqueueCommand(jobJson);
  });

// Worker commands
const workerCmd = program.command('worker').description('Worker management commands');

workerCmd
  .command('start')
  .description('Start worker processes')
  .option('-c, --count <number>', 'Number of workers to start', '1')
  .action((options) => {
    startWorkersCommand(options);
  });

workerCmd
  .command('stop')
  .description('Stop running workers gracefully')
  .action(() => {
    stopWorkersCommand();
  });

// Status command
program
  .command('status')
  .description('Show queue status and statistics')
  .action(() => {
    statusCommand();
  });

// List command
program
  .command('list')
  .description('List jobs')
  .option('-s, --state <state>', 'Filter by state (pending, processing, completed, failed, dead)')
  .action((options) => {
    listJobsCommand(options);
  });

// DLQ commands
const dlqCmd = program.command('dlq').description('Dead Letter Queue management');

dlqCmd
  .command('list')
  .description('List jobs in the Dead Letter Queue')
  .action(() => {
    listDLQCommand();
  });

dlqCmd
  .command('retry <job-id>')
  .description('Retry a job from the Dead Letter Queue')
  .action((jobId) => {
    retryDLQCommand(jobId);
  });

// Config commands
const configCmd = program.command('config').description('Configuration management');

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value (max-retries, backoff-base)')
  .action((key, value) => {
    setConfigCommand(key, value);
  });

configCmd
  .command('get [key]')
  .description('Get configuration value(s)')
  .action((key) => {
    getConfigCommand(key);
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
