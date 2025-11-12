class BackoffCalculator {
  /**
   * Calculate exponential backoff delay
   * @param {number} attempts - Number of failed attempts
   * @param {number} base - Base for exponential calculation (default: 2)
   * @returns {number} Delay in seconds
   */
  static calculate(attempts, base = 2) {
    return Math.pow(base, attempts);
  }

  /**
   * Get the next retry timestamp
   * @param {number} attempts - Number of failed attempts
   * @param {number} base - Base for exponential calculation
   * @returns {string} ISO timestamp for next retry
   */
  static getNextRetryTime(attempts, base = 2) {
    const delaySeconds = this.calculate(attempts, base);
    const nextRetry = new Date();
    nextRetry.setSeconds(nextRetry.getSeconds() + delaySeconds);
    return nextRetry.toISOString();
  }

  /**
   * Format delay for human reading
   * @param {number} seconds - Delay in seconds
   * @returns {string} Formatted string
   */
  static formatDelay(seconds) {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
}

module.exports = BackoffCalculator;
