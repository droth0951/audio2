// URL Helper for generating correct base URLs across environments
// Handles localhost (development) and Railway (production) deployments

function getBaseUrl() {
  // If Railway environment, use Railway URL
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }

  if (process.env.RAILWAY_STATIC_URL) {
    return process.env.RAILWAY_STATIC_URL.startsWith('http')
      ? process.env.RAILWAY_STATIC_URL
      : `https://${process.env.RAILWAY_STATIC_URL}`;
  }

  // Railway fallback
  if (process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_ID) {
    return 'https://amusing-education-production.up.railway.app';
  }

  // Local development fallback
  return 'http://localhost:3001';
}

function generateVideoUrl(jobId) {
  return `${getBaseUrl()}/temp/video_${jobId}.mp4`;
}

function generateDownloadUrl(jobId) {
  return `${getBaseUrl()}/api/download-video/${jobId}`;
}

module.exports = {
  getBaseUrl,
  generateVideoUrl,
  generateDownloadUrl
};