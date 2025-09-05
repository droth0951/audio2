# Audio2 Deployment Checklist

## 🚨 CRITICAL: Always Verify Server Changes Are Deployed

**This checklist prevents the recurring audio/caption sync bug where server changes don't take effect.**

---

## ✅ Pre-Deployment Checklist

### 1. **Server Code Changes**
- [ ] Changes made to `audio-trimmer-server/api/transcribe.js`
- [ ] Changes made to `audio-trimmer-server/server.js`
- [ ] Changes made to any server-side files

### 2. **Deploy to Railway**
**⚠️ CRITICAL: RAILWAY ONLY DEPLOYS FROM `main` BRANCH ⚠️**
- [ ] **FIRST**: Ensure changes are in `main` branch (not feature branch)
- [ ] If working on feature branch: `git checkout main && git merge feature-branch`
- [ ] Push changes to main branch: `git push origin main`
- [ ] Wait for Railway deployment to complete (2-3 minutes)
- [ ] Check Railway dashboard for deployment status

---

## ✅ Post-Deployment Verification

### 3. **Test Server Response**
```bash
# Check if server is responding
curl -s https://audio-trimmer-server-production.up.railway.app/health

# Should return: {"status":"ok","timestamp":"..."}
```

### 4. **Verify AssemblyAI Parameters**
**CRITICAL**: Check the logs for this line:
```
LOG  🎬 Assembly response: {
  "speaker_labels": true,  ← MUST BE TRUE
  "audio_start_from": 200482,
  "audio_end_at": 215482,
  ...
}
```

**If you see `"speaker_labels": false`, the deployment failed!**

### 5. **Test Audio/Caption Sync**
- [ ] Create a new clip with captions enabled
- [ ] **VERIFY**: Audio content matches caption text
- [ ] **VERIFY**: No word overlap in captions
- [ ] **VERIFY**: Speaker labels appear (if enabled)

---

## 🐛 Common Issues & Solutions

### **Issue**: `"speaker_labels": false` in logs
**Cause**: Server changes not deployed (likely wrong branch)
**Solution**: 
1. **CHECK**: Are you working on feature branch? Railway won't see it!
2. Merge to main: `git checkout main && git merge feature-branch && git push origin main`
3. Wait 2-3 minutes for Railway deployment
4. If still failing, force redeploy from Railway dashboard

### **Issue**: Audio doesn't match captions
**Cause**: Wrong transcript segment or timing offset
**Solution**:
1. Check if AssemblyAI transcribed correct audio segment
2. Verify `audio_start_from` and `audio_end_at` values
3. Check for unit conversion issues (ms vs seconds)

### **Issue**: Word overlap in captions
**Cause**: Word selection logic problem
**Solution**:
1. Check `SimpleCaptionOverlay` component logic
2. Verify word timing calculations
3. Test with different audio segments

---

## 📋 Debug Commands

### Check Server Status
```bash
# Test server health
curl -s https://audio-trimmer-server-production.up.railway.app/health

# Check server logs (if accessible)
railway logs
```

### Check Client Logs
Look for these key log lines:
```
LOG  🎬 Assembly response: { "speaker_labels": true, ... }
LOG  🎬 SpeakerCaption debug: { hasSegments: true, ... }
LOG  🎬 Current speaker segment: { speaker: "DANIEL", text: "..." }
```

---

## 🎯 Success Criteria

**✅ Deployment Successful When:**
- Server responds to health check
- AssemblyAI response shows `"speaker_labels": true`
- Audio content matches caption text
- No word overlap in captions
- Speaker labels appear (if enabled)

**❌ Deployment Failed When:**
- Server doesn't respond
- AssemblyAI response shows `"speaker_labels": false`
- Audio doesn't match captions
- Word overlap occurs

---

## 🚀 OTA Update & App Store Release Checklist

### **Before Building for App Store**
1. **Set consistent versioning in app.json:**
```json
{
  "version": "1.4.0",
  "runtimeVersion": "1.4.0",
  "ios": {
    "buildNumber": "1.4.0"
  }
}
```

2. **Verify EAS Updates configuration exists:**
```json
{
  "updates": {
    "url": "https://u.expo.dev/5ec96b76-832e-4468-8e21-d5f0c3d3d3a36b"
  }
}
```

3. **Test the update mechanism locally:**
```bash
# Deploy a test update
eas update --branch production --message "Test update"

# Verify it appears in the dashboard
eas update:list --branch production --limit 1
```

### **Critical Rules Going Forward**
- **Never change runtimeVersion without a new build.** Once your App Store app has runtimeVersion "1.4.0", all OTA updates must use "1.4.0" until you submit a new App Store version.

- **For JavaScript-only changes after App Store release:**
```bash
eas update --branch production --message "Bug fix description"
```

- **For native changes (new packages, permissions):**
  - Increment both version and runtimeVersion together
  - Create new build and submit to App Store

### **Verification Steps Before App Store Submission**
- [ ] Create the production build
- [ ] Deploy a test OTA update
- [ ] Install the build on a device
- [ ] Confirm the OTA update downloads and applies
- [ ] Only then submit to App Store

**Key Insight**: runtimeVersion acts as a compatibility lock. Apps can only receive updates with matching runtimeVersion. Keep them synchronized and document this in your release process.

---

## 📌 REMINDER

**ALWAYS run this checklist after making server changes. This prevents the recurring audio/caption sync bug that we've encountered multiple times.**

**ALWAYS run the OTA Update checklist before App Store submissions to ensure OTA updates work correctly.**

*Last updated: [Current Date]*
