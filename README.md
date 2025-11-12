# QueueCTL - Background Job Queue System

A production-grade CLI-based background job queue system with worker processes, automatic retries using exponential backoff, and Dead Letter Queue (DLQ) for failed jobs.

## Features

- **Job Queue Management** - Enqueue and manage background jobs
- **Multiple Workers** - Support for parallel job processing
- **Automatic Retries** - Exponential backoff retry mechanism
- **Dead Letter Queue** - Persistent storage for permanently failed jobs
- **Persistent Storage** - SQLite database survives restarts
- **Graceful Shutdown** - Workers finish current jobs before exiting
- **Configuration Management** - Configurable retry count and backoff settings
- **Clean CLI Interface** - Intuitive commands with helpful output

## Quick Start

### Prerequisites

- Node.js >= 14.0.0
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/jainish1709/QueueCTL.git
cd queuectl

# Install dependencies
npm install

# Install globally (optional)
npm link
```

### Basic Usage

```bash
# Enqueue a job
queuectl enqueue '{"id":"job1","command":"echo Hello World","max_retries":3}'

# Start workers
queuectl worker start --count 3

# Check status
queuectl status

# List jobs
queuectl list

# View Dead Letter Queue
queuectl dlq list
```

## CLI Commands Reference

### Job Management

#### Enqueue a Job

```bash
queuectl enqueue '{"id":"unique-id","command":"echo Hello","max_retries":3}'
```

**Job JSON Format:**

```json
{
  "id": "unique-job-id", // Optional: Auto-generated if not provided
  "command": "echo 'Hello World'", // Required: Shell command to execute
  "max_retries": 3 // Optional: Default is 3
}
```

**Examples:**

```bash
# Simple echo command
queuectl enqueue '{"command":"echo Testing Queue"}'

# Command with sleep
queuectl enqueue '{"id":"sleep-job","command":"sleep 5 && echo Done"}'

# Custom retry count
queuectl enqueue '{"command":"curl https://api.example.com","max_retries":5}'
```

### Worker Management

#### Start Workers

```bash
queuectl worker start --count <number>
```

**Options:**

- `--count, -c`: Number of workers (1-10, default: 1)

**Examples:**

```bash
# Start single worker
queuectl worker start

# Start 3 workers
queuectl worker start --count 3
```

#### Stop Workers

```bash
queuectl worker stop
```

Gracefully stops all running workers after they complete their current jobs.

### Status & Monitoring

#### View Queue Status

```bash
queuectl status
```

**Output includes:**

- Job counts by state (pending, processing, completed, failed, dead)
- Current configuration settings
- Active worker count

#### List Jobs

```bash
queuectl list [--state <state>]
```

**Options:**

- `--state, -s`: Filter by state (pending, processing, completed, failed, dead)

**Examples:**

```bash
# List all jobs
queuectl list

# List only pending jobs
queuectl list --state pending

# List completed jobs
queuectl list --state completed
```

### Dead Letter Queue (DLQ)

#### List DLQ Jobs

```bash
queuectl dlq list
```

Shows all jobs that have permanently failed after exhausting retries.

#### Retry Job from DLQ

```bash
queuectl dlq retry <job-id>
```

Moves a job from DLQ back to the pending queue for reprocessing.

**Example:**

```bash
queuectl dlq retry job-1699123456789-abc123
```

### Configuration Management

#### Set Configuration

```bash
queuectl config set <key> <value>
```

**Available Keys:**

- `max-retries`: Maximum retry attempts (default: 3)
- `backoff-base`: Base for exponential backoff calculation (default: 2)

**Examples:**

```bash
# Set max retries to 5
queuectl config set max-retries 5

# Set backoff base to 3
queuectl config set backoff-base 3
```

#### Get Configuration

```bash
queuectl config get [key]
```

**Examples:**

```bash
# Get all configuration
queuectl config get

# Get specific config value
queuectl config get max-retries
```

## Architecture Overview

### Components

```
┌─────────────┐
│     CLI     │
└──────┬──────┘
       │
┌──────▼──────┐
│    Queue    │ ◄──► SQLite Database
└──────┬──────┘
       │
┌──────▼──────┐
│   Workers   │
│  (Pool)     │
└─────────────┘
```

### Job Lifecycle

```
pending → processing → completed
   ↓           ↓
   └─────→ failed ────→ (retry with backoff)
              ↓
         dead (DLQ)
```

**States:**

1. **pending**: Job waiting to be processed
2. **processing**: Currently being executed by a worker
3. **completed**: Successfully executed
4. **failed**: Failed but will retry
5. **dead**: Permanently failed, moved to DLQ

### Data Persistence

- **Storage**: SQLite database (`data/jobs.db`)
- **Schema**: Jobs table with all metadata + Config table
- **Locking**: Database-level locking prevents duplicate processing
- **Indexes**: Optimized queries for state and retry time

### Worker Architecture

- **Polling**: Workers poll for jobs every 1 second
- **Concurrency**: Multiple workers process jobs in parallel
- **Locking**: Job-level locks prevent race conditions
- **Graceful Shutdown**: Workers complete current job before exiting

### Retry Mechanism

**Exponential Backoff Formula:**

```
delay = base ^ attempts (in seconds)
```

**Example with base=2:**

- Attempt 1: 2^0 = 1 second
- Attempt 2: 2^1 = 2 seconds
- Attempt 3: 2^2 = 4 seconds
- Attempt 4: 2^3 = 8 seconds

After `max_retries` attempts, the job moves to DLQ.

## Testing

### Run Test Suite

### **Batch File Test Script**

```cmd
npm run test:cmd
```

Or directly:

```cmd
tests\test-scenarios.bat
```

This runs a comprehensive test script that validates:

1. Job enqueueing
2. Multiple job types (success, failure, invalid)
3. Worker processing
4. Retry mechanism
5. DLQ functionality
6. Configuration management
7. Data persistence

### Manual Testing Scenarios

#### Scenario 1: Basic Job Completion

```bash
# Enqueue a simple job
queuectl enqueue '{"id":"test-1","command":"echo Success"}'

# Start worker
queuectl worker start

# Check status (should show completed)
queuectl status
```

#### Scenario 2: Failed Job with Retry

```bash
# Enqueue a failing job
queuectl enqueue '{"id":"test-2","command":"exit 1","max_retries":2}'

# Start worker and watch logs
queuectl worker start

# After retries exhausted, check DLQ
queuectl dlq list
```

#### Scenario 3: Multiple Workers

```bash
# Enqueue multiple jobs
for i in {1..5}; do
  queuectl enqueue "{\"id\":\"job-$i\",\"command\":\"sleep 3 && echo Job $i\"}"
done

# Start 3 workers
queuectl worker start --count 3

# Watch status
watch -n 1 queuectl status
```

#### Scenario 4: Data Persistence

```bash
# Enqueue jobs
queuectl enqueue '{"id":"persist-1","command":"echo Test"}'

# Check status
queuectl status

# Exit and restart
# Jobs should still be there
queuectl list
```

## 🔧 Configuration

### Default Settings

- **Max Retries**: 3
- **Backoff Base**: 2
- **Poll Interval**: 1 second
- **Job Timeout**: 5 minutes
- **Worker Limit**: 1-10

## Project Structure

```
queuectl/
├── src/
│   ├── cli/
│   │   ├── index.js          # CLI entry point
│   │   └── commands.js       # Command implementations
│   ├── core/
│   │   ├── queue.js          # Queue management
│   │   ├── worker.js         # Worker implementation
│   │   └── job.js            # Job model
│   ├── storage/
│   │   └── database.js       # SQLite database layer
│   └── utils/
│       ├── logger.js         # Logging utility
│       └── backoff.js        # Backoff calculator
├── tests/
│   └── test-scenarios.sh     # Test suite
├── data/
│   └── jobs.db              # SQLite database (generated)
├── package.json
└── README.md
```
