// Comprehensive cost tracking and analytics for Railway deployment

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const logger = require('./logger');
const config = require('../config/settings');

class CostAnalytics {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.costsFilePath = path.join(this.dataDir, 'cost-history.json');
    this.dailyCosts = new Map();
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    this.usePg = !!process.env.DATABASE_URL;
    
    // Initialize PostgreSQL connection if available
    if (this.usePg) {
      this.pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      logger.success('📊 Using PostgreSQL for persistent cost analytics');
      this.initializeDatabase();
    } else if (this.isRailway) {
      logger.warn('⚠️  Running on Railway - cost data will not persist across deployments');
      logger.warn('⚠️  Consider upgrading to Railway PostgreSQL for persistent analytics');
    }
    
    this.loadCostHistory();
  }

  // Initialize PostgreSQL database tables
  async initializeDatabase() {
    if (!this.usePg) return;
    
    try {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS cost_analytics (
          date TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_cost_analytics_date ON cost_analytics(date);
        CREATE INDEX IF NOT EXISTS idx_cost_analytics_created_at ON cost_analytics(created_at);
      `;
      
      await this.pool.query(createTableQuery);
      logger.success('📊 Cost analytics database tables initialized');
      
    } catch (error) {
      logger.error('Failed to initialize cost analytics database', { error: error.message });
      // Fallback to file storage if PostgreSQL fails
      this.usePg = false;
      logger.warn('🔄 Falling back to file storage for cost analytics');
    }
  }

  // Load historical cost data from PostgreSQL or file
  async loadCostHistory() {
    if (this.usePg) {
      return this.loadCostHistoryFromPg();
    } else {
      return this.loadCostHistoryFromFile();
    }
  }

  // Load historical cost data from PostgreSQL
  async loadCostHistoryFromPg() {
    try {
      const result = await this.pool.query('SELECT date, data FROM cost_analytics ORDER BY date');
      
      // Convert to Map for easier manipulation
      for (const row of result.rows) {
        this.dailyCosts.set(row.date, row.data);
      }
      
      logger.debug('Cost history loaded from PostgreSQL', { 
        daysTracked: this.dailyCosts.size,
        totalSpent: `$${this.getTotalSpent().toFixed(4)}`
      });
      
    } catch (error) {
      logger.error('Failed to load cost history from PostgreSQL', { error: error.message });
      // Fallback to file storage
      this.usePg = false;
      return this.loadCostHistoryFromFile();
    }
  }

  // Load historical cost data from file
  async loadCostHistoryFromFile() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      
      try {
        const data = await fs.readFile(this.costsFilePath, 'utf8');
        const costs = JSON.parse(data);
        
        // Convert to Map for easier manipulation
        for (const [date, dayData] of Object.entries(costs)) {
          this.dailyCosts.set(date, dayData);
        }
        
        logger.debug('Cost history loaded from file', { 
          daysTracked: this.dailyCosts.size,
          totalSpent: `$${this.getTotalSpent().toFixed(4)}`
        });
        
      } catch (error) {
        // File doesn't exist yet, that's ok
        logger.debug('No existing cost history - starting fresh');
      }
    } catch (error) {
      logger.error('Failed to load cost history from file', { error: error.message });
    }
  }

  // Save cost data to persistent storage
  async saveCostHistory() {
    if (this.usePg) {
      return this.saveCostHistoryToPg();
    } else {
      return this.saveCostHistoryToFile();
    }
  }

  // Save cost data to PostgreSQL
  async saveCostHistoryToPg() {
    try {
      // Save all daily cost data to PostgreSQL
      const queries = [];
      for (const [date, dayData] of this.dailyCosts) {
        queries.push(
          this.pool.query(
            'INSERT INTO cost_analytics (date, data, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (date) DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP',
            [date, dayData]
          )
        );
      }
      
      await Promise.all(queries);
      logger.debug('Cost history saved to PostgreSQL', { 
        daysTracked: this.dailyCosts.size 
      });
    } catch (error) {
      logger.error('Failed to save cost history to PostgreSQL', { error: error.message });
      // Fallback to file storage
      this.usePg = false;
      return this.saveCostHistoryToFile();
    }
  }

  // Save cost data to file
  async saveCostHistoryToFile() {
    try {
      const data = Object.fromEntries(this.dailyCosts);
      await fs.writeFile(this.costsFilePath, JSON.stringify(data, null, 2));
      logger.debug('Cost history saved to file', { 
        daysTracked: this.dailyCosts.size 
      });
    } catch (error) {
      logger.error('Failed to save cost history to file', { error: error.message });
    }
  }

  // REVIEW-COST: Track detailed job cost breakdown
  async trackJobCost(jobId, costBreakdown) {
    const date = this.getStartOfDay();
    const currentDayData = this.dailyCosts.get(date) || {
      date,
      totalCost: 0,
      jobCount: 0,
      jobs: [],
      breakdown: {
        audioDownload: 0,
        frameGeneration: 0,
        videoComposition: 0,
        storage: 0,
        processing: 0
      }
    };
    
    const jobCost = {
      jobId,
      timestamp: new Date().toISOString(),
      costs: costBreakdown,
      total: Object.entries(costBreakdown)
        .filter(([key]) => key !== 'processingTimeMs')
        .reduce((sum, [, cost]) => sum + cost, 0),
      processingTime: costBreakdown.processingTimeMs || 0
    };

    // Update daily totals
    currentDayData.totalCost += jobCost.total;
    currentDayData.jobCount += 1;
    currentDayData.jobs.push(jobCost);
    
    // Update breakdown totals
    for (const [category, cost] of Object.entries(costBreakdown)) {
      if (currentDayData.breakdown.hasOwnProperty(category)) {
        currentDayData.breakdown[category] += cost;
      }
    }
    
    this.dailyCosts.set(date, currentDayData);
    
    // Save to persistent storage
    await this.saveCostHistory();
    
    logger.cost(`Job cost tracked and saved`, {
      jobId,
      jobCost: `$${jobCost.total.toFixed(4)}`,
      dailyTotal: `$${currentDayData.totalCost.toFixed(4)}`,
      dailyJobs: currentDayData.jobCount
    });

    return jobCost;
  }

  // Get comprehensive cost analytics
  getCostAnalytics() {
    const today = this.getStartOfDay();
    const todayData = this.dailyCosts.get(today) || {
      date: today,
      totalCost: 0,
      jobCount: 0,
      jobs: [],
      breakdown: {}
    };
    
    // Calculate time-based analytics
    const last7Days = this.getLast7DaysData();
    const last30Days = this.getLast30DaysData();
    
    const totalJobs = Array.from(this.dailyCosts.values())
      .reduce((sum, day) => sum + (day.jobCount || 0), 0);
    const totalSpent = this.getTotalSpent();
    
    const avgCostPerJob = totalJobs > 0 ? totalSpent / totalJobs : 0;
    const avgJobsPerDay = totalJobs / Math.max(this.dailyCosts.size, 1);
    const avgSpendPerDay = totalSpent / Math.max(this.dailyCosts.size, 1);

    return {
      // Today's metrics
      today: {
        date: today,
        spent: todayData.totalCost,
        jobs: todayData.jobCount,
        avgCostPerJob: todayData.jobCount > 0 ? todayData.totalCost / todayData.jobCount : 0,
        limit: config.costs.DAILY_SPENDING_CAP,
        remaining: Math.max(0, config.costs.DAILY_SPENDING_CAP - todayData.totalCost),
        percentUsed: (todayData.totalCost / config.costs.DAILY_SPENDING_CAP) * 100,
        breakdown: todayData.breakdown
      },
      
      // Overall averages
      averages: {
        costPerJob: avgCostPerJob,
        jobsPerDay: avgJobsPerDay,
        spendPerDay: avgSpendPerDay,
        processingTimeMs: this.getAverageProcessingTime()
      },
      
      // Time-based trends
      trends: {
        last7Days,
        last30Days,
        weekOverWeek: this.calculateWeekOverWeekChange(),
        costTrend: this.analyzeCostTrend()
      },
      
      // All-time totals
      totals: {
        allTimeSpent: totalSpent,
        allTimeJobs: totalJobs,
        daysTracked: this.dailyCosts.size,
        firstJobDate: this.getFirstJobDate(),
        mostExpensiveJob: this.getMostExpensiveJob()
      },
      
      // Budget analysis
      budget: {
        dailyLimit: config.costs.DAILY_SPENDING_CAP,
        monthlyProjection: avgSpendPerDay * 30,
        onTrackForBudget: avgSpendPerDay <= config.costs.DAILY_SPENDING_CAP,
        daysUntilCapReached: this.getDaysUntilCapReached(avgSpendPerDay),
        recommendedJobLimit: Math.floor(config.costs.DAILY_SPENDING_CAP / Math.max(avgCostPerJob, 0.001))
      },
      
      // Performance metrics
      performance: {
        successRate: this.calculateSuccessRate(),
        avgProcessingTime: this.getAverageProcessingTime(),
        costEfficiencyScore: this.calculateCostEfficiencyScore()
      }
    };
  }

  // Get last 7 days of cost data
  getLast7DaysData() {
    const days = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = date.toISOString().split('T')[0] + 'T04:00:00.000Z';
      const dayData = this.dailyCosts.get(dateStr) || { totalCost: 0, jobCount: 0 };
      
      days.push({
        date: dateStr,
        cost: dayData.totalCost,
        jobs: dayData.jobCount,
        avgCostPerJob: dayData.jobCount > 0 ? dayData.totalCost / dayData.jobCount : 0
      });
    }
    
    return days;
  }

  // Get last 30 days of cost data
  getLast30DaysData() {
    const days = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = date.toISOString().split('T')[0] + 'T04:00:00.000Z';
      const dayData = this.dailyCosts.get(dateStr) || { totalCost: 0, jobCount: 0 };
      
      days.push({
        date: dateStr,
        cost: dayData.totalCost,
        jobs: dayData.jobCount
      });
    }
    
    return days;
  }

  // Calculate week-over-week change
  calculateWeekOverWeekChange() {
    const last7Days = this.getLast7DaysData();
    const thisWeek = last7Days.slice(-7).reduce((sum, day) => sum + day.cost, 0);
    const lastWeek = last7Days.slice(0, 7).reduce((sum, day) => sum + day.cost, 0);
    
    if (lastWeek === 0) return { change: 0, direction: 'none' };
    
    const changePercent = ((thisWeek - lastWeek) / lastWeek) * 100;
    return {
      change: Math.abs(changePercent),
      direction: changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable',
      thisWeek: thisWeek,
      lastWeek: lastWeek
    };
  }

  // Analyze cost trends
  analyzeCostTrend() {
    const last7Days = this.getLast7DaysData();
    if (last7Days.length < 3) return 'insufficient_data';
    
    const recentAvg = last7Days.slice(-3).reduce((sum, day) => sum + day.cost, 0) / 3;
    const earlierAvg = last7Days.slice(0, 3).reduce((sum, day) => sum + day.cost, 0) / 3;
    
    if (recentAvg > earlierAvg * 1.2) return 'increasing';
    if (recentAvg < earlierAvg * 0.8) return 'decreasing';
    return 'stable';
  }

  // Get total spent across all time
  getTotalSpent() {
    return Array.from(this.dailyCosts.values())
      .reduce((total, day) => total + (day.totalCost || 0), 0);
  }

  // Get average processing time
  getAverageProcessingTime() {
    let totalTime = 0;
    let jobCount = 0;
    
    for (const dayData of this.dailyCosts.values()) {
      if (dayData.jobs) {
        for (const job of dayData.jobs) {
          if (job.processingTime) {
            totalTime += job.processingTime;
            jobCount++;
          }
        }
      }
    }
    
    return jobCount > 0 ? Math.round(totalTime / jobCount) : 0;
  }

  // Calculate success rate (requires integration with job status)
  calculateSuccessRate() {
    // This would need integration with job queue to track failed jobs
    // For now, return jobs that have cost data (successful jobs)
    return 95; // Placeholder - actual implementation would track failures
  }

  // Calculate cost efficiency score
  calculateCostEfficiencyScore() {
    const targetCostPerJob = 0.01; // $0.01 target
    const totalJobs = Array.from(this.dailyCosts.values())
      .reduce((sum, day) => sum + (day.jobCount || 0), 0);
    const totalSpent = this.getTotalSpent();
    const avgCostPerJob = totalJobs > 0 ? totalSpent / totalJobs : 0;
    
    if (avgCostPerJob === 0) return 100;
    
    const efficiency = (targetCostPerJob / avgCostPerJob) * 100;
    return Math.min(100, Math.max(0, efficiency));
  }

  // Get most expensive job
  getMostExpensiveJob() {
    let mostExpensive = null;
    let maxCost = 0;
    
    for (const dayData of this.dailyCosts.values()) {
      if (dayData.jobs) {
        for (const job of dayData.jobs) {
          if (job.total > maxCost) {
            maxCost = job.total;
            mostExpensive = {
              jobId: job.jobId,
              cost: job.total,
              date: dayData.date,
              timestamp: job.timestamp
            };
          }
        }
      }
    }
    
    return mostExpensive;
  }

  // Get first job date
  getFirstJobDate() {
    const dates = Array.from(this.dailyCosts.keys()).sort();
    return dates.length > 0 ? dates[0] : null;
  }

  // Calculate days until daily cap would be reached
  getDaysUntilCapReached(avgSpendPerDay) {
    if (avgSpendPerDay === 0) return Infinity;
    const remaining = config.costs.DAILY_SPENDING_CAP - (this.dailyCosts.get(this.getStartOfDay())?.totalCost || 0);
    return Math.floor(remaining / avgSpendPerDay);
  }

  // Helper: Get start of day timestamp
  getStartOfDay() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }

  // Generate cost alerts for monitoring
  generateCostAlerts() {
    const analytics = this.getCostAnalytics();
    const alerts = [];
    
    // High daily usage alert
    if (analytics.today.percentUsed > 80) {
      alerts.push({
        type: 'high_daily_usage',
        severity: analytics.today.percentUsed > 95 ? 'critical' : 'warning',
        message: `Daily budget ${analytics.today.percentUsed.toFixed(1)}% used`,
        recommendation: 'Monitor remaining jobs carefully'
      });
    }
    
    // Cost per job above target
    if (analytics.averages.costPerJob > 0.01) {
      alerts.push({
        type: 'high_cost_per_job',
        severity: analytics.averages.costPerJob > 0.02 ? 'critical' : 'warning',
        message: `Average cost per job ($${analytics.averages.costPerJob.toFixed(4)}) above $0.01 target`,
        recommendation: 'Review processing efficiency and optimize expensive operations'
      });
    }
    
    // Budget trend alert
    if (analytics.trends.costTrend === 'increasing') {
      alerts.push({
        type: 'increasing_costs',
        severity: 'info',
        message: 'Cost trend is increasing over recent days',
        recommendation: 'Monitor usage patterns and consider optimizations'
      });
    }
    
    // Low efficiency alert
    if (analytics.performance.costEfficiencyScore < 70) {
      alerts.push({
        type: 'low_efficiency',
        severity: 'warning',
        message: `Cost efficiency score: ${analytics.performance.costEfficiencyScore.toFixed(1)}%`,
        recommendation: 'Review processing pipeline for optimization opportunities'
      });
    }
    
    return alerts;
  }
}

module.exports = new CostAnalytics();