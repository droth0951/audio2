// Database service for persistent job storage
// Replaces in-memory job storage to survive container restarts

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class JobDatabase {
  constructor() {
    this.pool = null;
    this.isRailway = !!process.env.DATABASE_URL;
    this.initializeDatabase();
  }

  async initializeDatabase() {
    if (!this.isRailway) {
      logger.debug('Database disabled - using memory storage for local development');
      return;
    }

    try {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection and run schema
      await this.pool.query('SELECT NOW()');
      await this.ensureSchema();

      logger.success('📊 Job database initialized', {
        environment: this.isRailway ? 'Railway' : 'Local',
        ssl: !!process.env.NODE_ENV
      });

    } catch (error) {
      logger.error('Failed to initialize job database', {
        error: error.message,
        code: error.code
      });
      // Fallback to memory storage
      this.pool = null;
    }
  }

  async ensureSchema() {
    if (!this.pool) return;

    try {
      const schemaPath = path.join(__dirname, '../database/jobs-schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await this.pool.query(schema);
      logger.debug('Database schema ensured');
    } catch (error) {
      logger.error('Failed to ensure database schema', { error: error.message });
      throw error;
    }
  }

  // Create new job
  async createJob(jobData) {
    if (!this.pool) return null;

    try {
      const query = `
        INSERT INTO jobs (
          job_id, status, request_data, estimated_cost, estimated_time, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
      `;

      const values = [
        jobData.jobId,
        jobData.status || 'queued',
        JSON.stringify(jobData.request),
        jobData.estimatedCost,
        jobData.estimatedTime
      ];

      const result = await this.pool.query(query, values);
      logger.debug('Job created in database', { jobId: jobData.jobId });
      return result.rows[0];

    } catch (error) {
      logger.error('Failed to create job in database', {
        jobId: jobData.jobId,
        error: error.message
      });
      return null;
    }
  }

  // Update job status
  async updateJobStatus(jobId, status, additionalData = {}) {
    if (!this.pool) return null;

    try {
      const setClause = ['status = $2', 'updated_at = NOW()'];
      const values = [jobId, status];
      let valueIndex = 3;

      // Add timestamp fields based on status
      if (status === 'processing' && !additionalData.skipStartedAt) {
        setClause.push(`started_at = NOW()`);
      } else if (status === 'completed') {
        setClause.push(`completed_at = NOW()`);
      } else if (status === 'failed') {
        setClause.push(`failed_at = NOW()`);
      }

      // Add optional fields
      if (additionalData.errorMessage) {
        setClause.push(`error_message = $${valueIndex++}`);
        values.push(additionalData.errorMessage);
      }

      if (additionalData.resultData) {
        setClause.push(`result_data = $${valueIndex++}`);
        values.push(JSON.stringify(additionalData.resultData));
      }

      if (additionalData.processingTime) {
        setClause.push(`processing_time = $${valueIndex++}`);
        values.push(additionalData.processingTime);
      }

      if (additionalData.retries !== undefined) {
        setClause.push(`retries = $${valueIndex++}`);
        values.push(additionalData.retries);
      }

      const query = `
        UPDATE jobs
        SET ${setClause.join(', ')}
        WHERE job_id = $1
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      return result.rows[0];

    } catch (error) {
      logger.error('Failed to update job status', {
        jobId,
        status,
        error: error.message
      });
      return null;
    }
  }

  // Get job by ID
  async getJob(jobId) {
    if (!this.pool) return null;

    try {
      const query = 'SELECT * FROM jobs WHERE job_id = $1';
      const result = await this.pool.query(query, [jobId]);

      if (result.rows.length === 0) {
        return null;
      }

      const job = result.rows[0];
      // Parse JSON fields
      job.request_data = JSON.parse(job.request_data);
      if (job.result_data) {
        job.result_data = JSON.parse(job.result_data);
      }

      return job;

    } catch (error) {
      logger.error('Failed to get job from database', {
        jobId,
        error: error.message
      });
      return null;
    }
  }

  // Get jobs by status
  async getJobsByStatus(status, limit = 50) {
    if (!this.pool) return [];

    try {
      const query = `
        SELECT * FROM jobs
        WHERE status = $1
        ORDER BY created_at ASC
        LIMIT $2
      `;

      const result = await this.pool.query(query, [status, limit]);

      return result.rows.map(job => {
        job.request_data = JSON.parse(job.request_data);
        if (job.result_data) {
          job.result_data = JSON.parse(job.result_data);
        }
        return job;
      });

    } catch (error) {
      logger.error('Failed to get jobs by status', {
        status,
        error: error.message
      });
      return [];
    }
  }

  // Get queue position for a job
  async getQueuePosition(jobId) {
    if (!this.pool) return 0;

    try {
      const query = `
        SELECT COUNT(*) as position
        FROM jobs
        WHERE status = 'queued'
        AND created_at < (SELECT created_at FROM jobs WHERE job_id = $1)
      `;

      const result = await this.pool.query(query, [jobId]);
      return parseInt(result.rows[0].position) || 0;

    } catch (error) {
      logger.error('Failed to get queue position', {
        jobId,
        error: error.message
      });
      return 0;
    }
  }

  // Clean up old jobs (older than retentionHours)
  async cleanupOldJobs(retentionHours = 24) {
    if (!this.pool) return 0;

    try {
      const query = `
        DELETE FROM jobs
        WHERE created_at < NOW() - INTERVAL '${retentionHours} hours'
        AND status IN ('completed', 'failed')
      `;

      const result = await this.pool.query(query);
      const deletedCount = result.rowCount;

      if (deletedCount > 0) {
        logger.debug('Cleaned up old jobs from database', {
          deletedCount,
          retentionHours
        });
      }

      return deletedCount;

    } catch (error) {
      logger.error('Failed to cleanup old jobs', {
        error: error.message
      });
      return 0;
    }
  }

  // Check if database is available
  isAvailable() {
    return !!this.pool;
  }

  // Get connection for transactions
  async getClient() {
    if (!this.pool) return null;
    return await this.pool.connect();
  }
}

module.exports = new JobDatabase();