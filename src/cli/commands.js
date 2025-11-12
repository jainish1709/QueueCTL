const Queue = require('../core/queue');
const { WorkerPool } = require('../core/worker');
const Logger = require('../utils/logger');
const Table = require('cli-table3');
const chalk = require('chalk');

let workerPool = null;

/**
 * Enqueue command
 */
function enqueueCommand(jobJson) {
  try {
    const queue = new Queue();
    const job = queue.enqueue(jobJson);
    
    console.log('\nJob Details:');
    console.log(JSON.stringify(job.toJSON(), null, 2));
    
    queue.close();
  } catch (error) {
    Logger.error(error.message);
    process.exit(1);
  }
}

/**
 * Start workers command
 */
function startWorkersCommand(options) {
  const count = parseInt(options.count || 1);
  
  if (count < 1 || count > 10) {
    Logger.error('Worker count must be between 1 and 10');
    process.exit(1);
  }

  workerPool = new WorkerPool();
  workerPool.start(count);

  // Keep the process running
  process.stdin.resume();
}

/**
 * Stop workers command
 */
async function stopWorkersCommand() {
  if (!workerPool || !workerPool.isRunning) {
    Logger.warn('No workers are currently running');
    return;
  }

  await workerPool.stop();
  process.exit(0);
}

/**
 * Status command
 */
function statusCommand() {
  const queue = new Queue();
  const stats = queue.getStats();
  const config = queue.getAllConfig();

  console.log('\n' + chalk.bold('=== Queue Status ===\n'));

  // Job statistics table
  const statsTable = new Table({
    head: [chalk.cyan('State'), chalk.cyan('Count')],
    style: { head: [], border: [] }
  });

  statsTable.push(
    ['Pending', stats.pending],
    ['Processing', stats.processing],
    ['Completed', chalk.green(stats.completed)],
    ['Failed', chalk.yellow(stats.failed)],
    ['Dead (DLQ)', chalk.red(stats.dead)],
    [chalk.bold('Total'), chalk.bold(stats.total)]
  );

  console.log(statsTable.toString());

  // Configuration table
  console.log('\n' + chalk.bold('Configuration:'));
  const configTable = new Table({
    head: [chalk.cyan('Key'), chalk.cyan('Value')],
    style: { head: [], border: [] }
  });

  config.forEach(item => {
    configTable.push([item.key, item.value]);
  });

  console.log(configTable.toString());

  // Worker info
  console.log('\n' + chalk.bold('Workers:'));
  if (workerPool && workerPool.isRunning) {
    console.log(chalk.green(`✓ ${workerPool.getActiveCount()} worker(s) active`));
  } else {
    console.log(chalk.gray('No workers running'));
  }

  console.log();
  queue.close();
}

/**
 * List jobs command
 */
function listJobsCommand(options) {
  const queue = new Queue();
  let jobs;

  if (options.state) {
    jobs = queue.getJobsByState(options.state);
  } else {
    jobs = queue.getAllJobs();
  }

  if (jobs.length === 0) {
    Logger.info('No jobs found');
    queue.close();
    return;
  }

  console.log(`\nFound ${jobs.length} job(s):\n`);

  const table = new Table({
    head: [
      chalk.cyan('ID'),
      chalk.cyan('Command'),
      chalk.cyan('State'),
      chalk.cyan('Attempts'),
      chalk.cyan('Created At')
    ],
    colWidths: [25, 30, 12, 10, 22],
    style: { head: [], border: [] },
    wordWrap: true
  });

  jobs.forEach(job => {
    const stateColor = {
      'pending': chalk.blue,
      'processing': chalk.yellow,
      'completed': chalk.green,
      'failed': chalk.red,
      'dead': chalk.red.bold
    }[job.state] || chalk.white;

    table.push([
      job.id,
      job.command.length > 28 ? job.command.substring(0, 25) + '...' : job.command,
      stateColor(job.state),
      `${job.attempts}/${job.max_retries}`,
      new Date(job.created_at).toLocaleString()
    ]);
  });

  console.log(table.toString());
  console.log();
  queue.close();
}

/**
 * List DLQ jobs command
 */
function listDLQCommand() {
  const queue = new Queue();
  const jobs = queue.getJobsByState('dead');

  if (jobs.length === 0) {
    Logger.info('Dead Letter Queue is empty');
    queue.close();
    return;
  }

  console.log(`\n${chalk.red.bold('Dead Letter Queue')} - ${jobs.length} job(s):\n`);

  const table = new Table({
    head: [
      chalk.cyan('ID'),
      chalk.cyan('Command'),
      chalk.cyan('Attempts'),
      chalk.cyan('Error'),
      chalk.cyan('Failed At')
    ],
    colWidths: [25, 25, 10, 30, 22],
    style: { head: [], border: [] },
    wordWrap: true
  });

  jobs.forEach(job => {
    table.push([
      job.id,
      job.command.length > 23 ? job.command.substring(0, 20) + '...' : job.command,
      job.attempts,
      job.error ? (job.error.length > 28 ? job.error.substring(0, 25) + '...' : job.error) : 'N/A',
      job.completed_at ? new Date(job.completed_at).toLocaleString() : 'N/A'
    ]);
  });

  console.log(table.toString());
  console.log();
  queue.close();
}

/**
 * Retry DLQ job command
 */
function retryDLQCommand(jobId) {
  const queue = new Queue();
  
  try {
    queue.retryFromDLQ(jobId);
  } catch (error) {
    Logger.error(error.message);
    queue.close();
    process.exit(1);
  }

  queue.close();
}

/**
 * Set config command
 */
function setConfigCommand(key, value) {
  const validKeys = ['max-retries', 'backoff-base'];
  
  if (!validKeys.includes(key)) {
    Logger.error(`Invalid config key. Valid keys: ${validKeys.join(', ')}`);
    process.exit(1);
  }

  const numValue = parseInt(value);
  if (isNaN(numValue) || numValue < 1) {
    Logger.error('Config value must be a positive number');
    process.exit(1);
  }

  const queue = new Queue();
  queue.setConfig(key, numValue);
  queue.close();
}

/**
 * Get config command
 */
function getConfigCommand(key) {
  const queue = new Queue();
  
  if (key) {
    const value = queue.getConfig(key);
    if (value) {
      console.log(`${key} = ${value}`);
    } else {
      Logger.warn(`Config key '${key}' not found`);
    }
  } else {
    const config = queue.getAllConfig();
    console.log('\nConfiguration:');
    config.forEach(item => {
      console.log(`  ${item.key} = ${item.value}`);
    });
    console.log();
  }
  
  queue.close();
}

module.exports = {
  enqueueCommand,
  startWorkersCommand,
  stopWorkersCommand,
  statusCommand,
  listJobsCommand,
  listDLQCommand,
  retryDLQCommand,
  setConfigCommand,
  getConfigCommand
};
