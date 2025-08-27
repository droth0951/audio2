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
- [ ] Push changes to main branch
- [ ] Wait for Railway deployment to complete
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
**Cause**: Server changes not deployed
**Solution**: 
1. Check Railway deployment status
2. Force redeploy from Railway dashboard
3. Wait 2-3 minutes for deployment to complete

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

## 📌 REMINDER

**ALWAYS run this checklist after making server changes. This prevents the recurring audio/caption sync bug that we've encountered multiple times.**

*Last updated: [Current Date]*
