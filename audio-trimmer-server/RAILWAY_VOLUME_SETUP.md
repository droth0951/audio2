# Railway Volume Setup for Video Persistence

## Problem
Videos stored in `/app/audio-trimmer-server/temp` are lost when Railway restarts containers.

## Solution
Use Railway's free Volume Storage (0.5GB included in free tier) to persist videos across container restarts.

## Setup Instructions

### 1. Create Volume in Railway Dashboard

1. Go to your Railway project: https://railway.app/project/[your-project-id]
2. Select the `audio-trimmer-server` service
3. Click on the **"Settings"** tab
4. Scroll down to **"Volumes"** section
5. Click **"+ New Volume"**
6. Configure the volume:
   - **Mount Path**: `/data/videos`
   - **Size**: 0.5 GB (free tier)
7. Click **"Add"** to create the volume
8. Railway will automatically redeploy your service

### 2. Verify Volume is Mounted

After redeployment, check the logs:
```bash
# Should see: "Volume storage initialized: /data/videos"
```

### 3. Volume Details

**Path**: `/data/videos`
- Videos saved as: `/data/videos/video_{jobId}.mp4`
- Survives container restarts
- Shared across all instances (if scaling)

**Size Limits**:
- Free tier: 0.5GB persistent storage
- Typical video: 12-15MB for 30-second clip
- Capacity: ~30-40 videos before cleanup

**Retention Policy**:
- Videos kept for **7 days** after creation
- Automatic cleanup runs every hour
- FIFO deletion when approaching 450MB (90% of 0.5GB limit)

## Backward Compatibility

The system checks for videos in this order:
1. **Volume storage**: `/data/videos/video_{jobId}.mp4` (new location)
2. **Temp storage**: `/app/audio-trimmer-server/temp/video_{jobId}.mp4` (fallback)

This ensures videos created before volume setup are still accessible.

## Cost

✅ **FREE** - Railway's free tier includes 0.5GB Volume Storage

If you need more storage:
- Additional storage: $0.15/GB/month
- Example: 2GB total = 0.5GB free + 1.5GB paid = $0.225/month

## Monitoring Storage Usage

Check storage usage via API:
```bash
GET /api/cleanup-stats
```

Returns:
```json
{
  "volumeStorage": {
    "path": "/data/videos",
    "exists": true,
    "totalVideos": 15,
    "totalSize": "234.5MB",
    "usagePercent": "46.9%",
    "oldestVideo": "2025-10-21T14:30:00.000Z",
    "newestVideo": "2025-10-28T21:45:00.000Z"
  }
}
```

## Troubleshooting

### Volume not found error
**Symptom**: Logs show "Volume storage not found: /data/videos"

**Solution**:
1. Verify volume is created in Railway dashboard
2. Check mount path is exactly `/data/videos` (case-sensitive)
3. Restart service after creating volume

### Videos still disappearing
**Symptom**: Videos lost despite volume setup

**Solution**:
1. Check logs for "Saved to volume storage" confirmation
2. Verify volume has available space (not at 0.5GB limit)
3. Check 7-day retention hasn't expired videos
4. Use `/api/cleanup-stats` to verify volume health

### Storage full
**Symptom**: "Volume storage full" errors

**Solution**:
1. Run emergency cleanup: `POST /api/emergency-cleanup`
2. Reduce retention to 3-5 days if needed (edit `config/settings.js`)
3. Upgrade volume size in Railway dashboard ($0.15/GB/month)

## Migration Notes

**Existing videos in temp directory**:
- Will remain accessible during transition
- Will be cleaned up by normal 7-day retention policy
- New videos automatically save to volume

**No manual migration needed** - system handles transition automatically.
