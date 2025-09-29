// Job Polling Service for Audio2
// Handles background polling of video job statuses to ensure notifications appear
// even when push notifications are disabled by the user

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_CAPTION_PROXY_BASE || 'https://audio-trimmer-service-production.up.railway.app';

class JobPollingService {
  constructor() {
    this.pollingInterval = null;
    this.isPolling = false;
    this.pollIntervalMs = 30000; // 30 seconds
    this.maxJobAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.onVideoCompleted = null;

    // Listen for app state changes to resume polling when app becomes active
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  // Set callback for when a video is completed
  setVideoCompletedCallback(callback) {
    this.onVideoCompleted = callback;
  }

  // Handle app state changes
  handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'active' && !this.isPolling) {
      console.log('📱 App became active - resuming job polling');
      this.startPolling();
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      console.log('📱 App went to background - pausing job polling');
      this.stopPolling();
    }
  };

  // Start polling for job updates
  async startPolling() {
    if (this.isPolling) {
      console.log('🔄 Job polling already active');
      return;
    }

    console.log('🔄 Starting job polling service...');
    this.isPolling = true;

    // Do initial poll immediately
    await this.pollJobs();

    // Set up interval polling
    this.pollingInterval = setInterval(async () => {
      if (this.isPolling) {
        await this.pollJobs();
      }
    }, this.pollIntervalMs);
  }

  // Stop polling
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    console.log('⏹️ Job polling service stopped');
  }

  // Add a job ID to be tracked
  async addJobToTrack(jobId, podcastName, episodeTitle) {
    try {
      const existingJobs = await this.getTrackedJobs();

      // Check if job is already being tracked
      if (existingJobs.find(job => job.jobId === jobId)) {
        console.log('🔄 Job already being tracked:', jobId);
        return;
      }

      const newJob = {
        jobId,
        podcastName,
        episodeTitle,
        addedAt: Date.now(),
        status: 'processing'
      };

      const updatedJobs = [...existingJobs, newJob];
      await AsyncStorage.setItem('trackedJobs', JSON.stringify(updatedJobs));

      console.log('➕ Added job to tracking:', jobId);

      // Start polling if not already running
      if (!this.isPolling && AppState.currentState === 'active') {
        this.startPolling();
      }
    } catch (error) {
      console.error('❌ Failed to add job to tracking:', error);
    }
  }

  // Get all jobs currently being tracked
  async getTrackedJobs() {
    try {
      const stored = await AsyncStorage.getItem('trackedJobs');
      if (!stored) return [];

      const jobs = JSON.parse(stored);

      // Filter out jobs older than 24 hours
      const cutoffTime = Date.now() - this.maxJobAge;
      const recentJobs = jobs.filter(job => job.addedAt > cutoffTime);

      // Save filtered list back to storage if we removed old jobs
      if (recentJobs.length !== jobs.length) {
        await AsyncStorage.setItem('trackedJobs', JSON.stringify(recentJobs));
        console.log(`🧹 Cleaned up ${jobs.length - recentJobs.length} old tracked jobs`);
      }

      return recentJobs;
    } catch (error) {
      console.error('❌ Failed to get tracked jobs:', error);
      return [];
    }
  }

  // Remove a job from tracking
  async removeJobFromTracking(jobId) {
    try {
      const existingJobs = await this.getTrackedJobs();
      const updatedJobs = existingJobs.filter(job => job.jobId !== jobId);
      await AsyncStorage.setItem('trackedJobs', JSON.stringify(updatedJobs));
      console.log('➖ Removed job from tracking:', jobId);

      // Stop polling if no more jobs to track
      if (updatedJobs.length === 0) {
        this.stopPolling();
      }
    } catch (error) {
      console.error('❌ Failed to remove job from tracking:', error);
    }
  }

  // Poll all tracked jobs for status updates
  async pollJobs() {
    try {
      const trackedJobs = await this.getTrackedJobs();

      if (trackedJobs.length === 0) {
        console.log('🔄 No jobs to poll, stopping polling service');
        this.stopPolling();
        return;
      }

      console.log(`🔄 Polling ${trackedJobs.length} tracked jobs for updates...`);

      // Check each job that's not yet completed
      const incompleteJobs = trackedJobs.filter(job => job.status !== 'completed');

      for (const job of incompleteJobs) {
        await this.checkJobStatus(job);
      }

    } catch (error) {
      console.error('❌ Error during job polling:', error);
    }
  }

  // Check status of a specific job
  async checkJobStatus(job) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/video-status/${job.jobId}`);
      const data = await response.json();

      if (data.status === 'completed' && job.status !== 'completed') {
        console.log('✅ Job completed detected via polling:', job.jobId);

        // Update job status in tracking
        await this.updateJobStatus(job.jobId, 'completed');

        // Notify the app about the completed video
        if (this.onVideoCompleted) {
          this.onVideoCompleted({
            jobId: job.jobId,
            podcastName: job.podcastName,
            episodeTitle: job.episodeTitle,
            source: 'polling' // Indicate this came from polling, not push notification
          });
        }

        // Remove from tracking since it's complete
        await this.removeJobFromTracking(job.jobId);
      } else if (data.status === 'failed') {
        console.log('❌ Job failed detected via polling:', job.jobId);
        await this.removeJobFromTracking(job.jobId);
      }

    } catch (error) {
      console.error(`❌ Failed to check status for job ${job.jobId}:`, error);
    }
  }

  // Update job status in tracking
  async updateJobStatus(jobId, newStatus) {
    try {
      const trackedJobs = await this.getTrackedJobs();
      const updatedJobs = trackedJobs.map(job =>
        job.jobId === jobId ? { ...job, status: newStatus } : job
      );
      await AsyncStorage.setItem('trackedJobs', JSON.stringify(updatedJobs));
    } catch (error) {
      console.error('❌ Failed to update job status:', error);
    }
  }

  // Get service status for debugging
  getStatus() {
    return {
      isPolling: this.isPolling,
      pollIntervalMs: this.pollIntervalMs,
      hasInterval: !!this.pollingInterval,
      appState: AppState.currentState
    };
  }

  // Clean up when service is destroyed
  destroy() {
    this.stopPolling();
    AppState.removeEventListener('change', this.handleAppStateChange);
  }
}

export default new JobPollingService();