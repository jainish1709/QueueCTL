const chalk = require('chalk');

class Logger {
  static info(message) {
    console.log(chalk.blue('ℹ'), message);
  }

  static success(message) {
    console.log(chalk.green('✓'), message);
  }

  static error(message) {
    console.error(chalk.red('✗'), message);
  }

  static warn(message) {
    console.warn(chalk.yellow('⚠'), message);
  }

  static debug(message) {
    if (process.env.DEBUG) {
      console.log(chalk.gray('🔍'), message);
    }
  }

  static worker(workerId, message) {
    console.log(chalk.cyan(`[Worker ${workerId}]`), message);
  }
}

module.exports = Logger;
