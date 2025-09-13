// Cost analytics dashboard endpoint

const costAnalytics = require('../services/cost-analytics');
const logger = require('../services/logger');

module.exports = async (req, res) => {
  try {
    logger.info('Cost analytics dashboard requested', { ip: req.ip });
    
    // Get comprehensive cost analytics
    const analytics = costAnalytics.getCostAnalytics();
    
    // Generate cost alerts
    const alerts = costAnalytics.generateCostAlerts();
    
    // Format response for dashboard consumption
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      analytics: {
        // Today's snapshot
        today: {
          date: analytics.today.date,
          spent: `$${analytics.today.spent.toFixed(4)}`,
          jobs: analytics.today.jobs,
          avgCostPerJob: `$${analytics.today.avgCostPerJob.toFixed(4)}`,
          budget: {
            limit: `$${analytics.today.limit.toFixed(2)}`,
            remaining: `$${analytics.today.remaining.toFixed(4)}`,
            percentUsed: `${analytics.today.percentUsed.toFixed(1)}%`
          },
          breakdown: analytics.today.breakdown ? Object.fromEntries(
            Object.entries(analytics.today.breakdown).map(([key, value]) => [
              key, 
              `$${(value || 0).toFixed(4)}`
            ])
          ) : {}
        },
        
        // Averages and trends
        performance: {
          avgCostPerJob: `$${(analytics.averages.costPerJob || 0).toFixed(4)}`,
          avgJobsPerDay: (analytics.averages.jobsPerDay || 0).toFixed(1),
          avgSpendPerDay: `$${(analytics.averages.spendPerDay || 0).toFixed(4)}`,
          avgProcessingTime: `${Math.round((analytics.averages.processingTimeMs || 0) / 1000)}s`,
          successRate: `${analytics.performance.successRate || 0}%`,
          costEfficiencyScore: `${(analytics.performance.costEfficiencyScore || 100).toFixed(1)}%`
        },
        
        // Budget analysis
        budget: {
          dailyLimit: `$${(analytics.budget.dailyLimit || 5).toFixed(2)}`,
          monthlyProjection: `$${(analytics.budget.monthlyProjection || 0).toFixed(2)}`,
          onTrackForBudget: analytics.budget.onTrackForBudget || true,
          recommendedJobLimit: analytics.budget.recommendedJobLimit || 0,
          daysUntilCapReached: analytics.budget.daysUntilCapReached === Infinity ? 'Never' : `${analytics.budget.daysUntilCapReached || 0} days`
        },
        
        // Historical totals
        totals: {
          allTimeSpent: `$${(analytics.totals.allTimeSpent || 0).toFixed(4)}`,
          allTimeJobs: analytics.totals.allTimeJobs || 0,
          daysTracked: analytics.totals.daysTracked || 0,
          firstJobDate: analytics.totals.firstJobDate || null,
          mostExpensive: analytics.totals.mostExpensiveJob ? {
            jobId: analytics.totals.mostExpensiveJob.jobId,
            cost: `$${analytics.totals.mostExpensiveJob.cost.toFixed(4)}`,
            date: analytics.totals.mostExpensiveJob.date
          } : null
        },
        
        // Trends data (ready for charts)
        charts: {
          last7Days: analytics.trends.last7Days.map(day => ({
            date: day.date.split('T')[0],
            cost: parseFloat(day.cost.toFixed(4)),
            jobs: day.jobs,
            avgCostPerJob: parseFloat(day.avgCostPerJob.toFixed(4))
          })),
          last30Days: analytics.trends.last30Days.map(day => ({
            date: day.date.split('T')[0],
            cost: parseFloat(day.cost.toFixed(4)),
            jobs: day.jobs
          })),
          weekOverWeek: {
            changePercent: analytics.trends.weekOverWeek.change.toFixed(1),
            direction: analytics.trends.weekOverWeek.direction,
            thisWeek: `$${analytics.trends.weekOverWeek.thisWeek.toFixed(4)}`,
            lastWeek: `$${analytics.trends.weekOverWeek.lastWeek.toFixed(4)}`
          },
          costTrend: analytics.trends.costTrend
        }
      },
      
      // Cost alerts for monitoring
      alerts: alerts.map(alert => ({
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        recommendation: alert.recommendation,
        timestamp: new Date().toISOString()
      })),
      
      // System status
      system: {
        storagePersistent: costAnalytics.usePg,
        railwayEnvironment: costAnalytics.isRailway,
        storageType: costAnalytics.usePg ? 'PostgreSQL' : 'Local Files',
        dataIntegrity: costAnalytics.usePg || !costAnalytics.isRailway ? 'Persistent' : 'Ephemeral (⚠️  Will reset on deployment)'
      }
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Cost analytics dashboard failed', { 
      error: error.message,
      ip: req.ip 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate cost analytics',
      message: error.message
    });
  }
};