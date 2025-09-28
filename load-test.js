#!/usr/bin/env node

// Load test script for video processing
// Tests concurrent requests to see how Railway handles load

const RAILWAY_URL = 'https://amusing-education-production.up.railway.app';
const TEST_AUDIO_URL = 'https://dts.podtrac.com/redirect.mp3/chrt.fm/track/8DB4DB/pdst.fm/e/nyt.simplecastaudio.com/03d8b493-87fc-4bd1-931f-8a8e9b945d8a/episodes/54e76a2c-40dc-4511-8a8e-c3871a63b511/audio/128/default.mp3';

const testPayload = {
  audioUrl: TEST_AUDIO_URL,
  clipStart: 30000,  // 30 seconds in
  clipEnd: 60000,    // 60 seconds in (30s clip)
  podcast: {
    podcastName: 'Load Test Podcast',
    title: 'Load Test Episode'
  },
  userEmail: 'test@example.com',
  captionsEnabled: true,
  deviceToken: 'test_device_token_load_test'
};

async function sendRequest(requestNumber) {
  const startTime = Date.now();

  try {
    console.log(`🚀 Request ${requestNumber}: Starting...`);

    const response = await fetch(`${RAILWAY_URL}/api/create-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...testPayload,
        userEmail: `test${requestNumber}@example.com` // Unique email per request
      })
    });

    const responseTime = Date.now() - startTime;
    const result = await response.json();

    if (response.ok) {
      console.log(`✅ Request ${requestNumber}: SUCCESS (${responseTime}ms) - Job ID: ${result.jobId}`);
      return { success: true, responseTime, jobId: result.jobId, requestNumber };
    } else {
      console.log(`❌ Request ${requestNumber}: FAILED (${responseTime}ms) - ${result.error || response.statusText}`);
      return { success: false, responseTime, error: result.error, requestNumber };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.log(`💥 Request ${requestNumber}: ERROR (${responseTime}ms) - ${error.message}`);
    return { success: false, responseTime, error: error.message, requestNumber };
  }
}

async function runLoadTest() {
  console.log('🏁 Starting Railway Load Test');
  console.log(`🎯 Target: ${RAILWAY_URL}`);
  console.log(`📊 Configuration: MAX_CONCURRENT=3, MAX_QUEUE=10`);
  console.log('=' * 60);

  // Test scenarios
  const scenarios = [
    { name: 'Scenario 1: Within limits (5 requests)', count: 5 },
    { name: 'Scenario 2: At capacity (13 requests)', count: 13 },
    { name: 'Scenario 3: Over capacity (20 requests)', count: 20 }
  ];

  for (const scenario of scenarios) {
    console.log(`\n🎪 ${scenario.name}`);
    console.log('-'.repeat(50));

    const requests = [];
    const startTime = Date.now();

    // Send all requests simultaneously
    for (let i = 1; i <= scenario.count; i++) {
      requests.push(sendRequest(i));
    }

    // Wait for all to complete
    const results = await Promise.all(requests);
    const totalTime = Date.now() - startTime;

    // Analyze results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

    console.log(`\n📈 Results:`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Successful: ${successful.length}/${scenario.count}`);
    console.log(`   Failed: ${failed.length}/${scenario.count}`);
    console.log(`   Avg response time: ${Math.round(avgResponseTime)}ms`);

    if (failed.length > 0) {
      console.log(`\n❌ Failure reasons:`);
      const errorCounts = {};
      failed.forEach(f => {
        const error = f.error || 'Unknown error';
        errorCounts[error] = (errorCounts[error] || 0) + 1;
      });
      Object.entries(errorCounts).forEach(([error, count]) => {
        console.log(`   "${error}": ${count} times`);
      });
    }

    // Wait before next scenario
    if (scenario !== scenarios[scenarios.length - 1]) {
      console.log(`\n⏳ Waiting 30 seconds before next scenario...`);
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }

  console.log('\n🏆 Load test complete!');
  console.log('💡 Recommendations:');
  console.log('   - Successful requests should be ≤ 13 (3 concurrent + 10 queued)');
  console.log('   - Failed requests should show "Queue full" or "Server busy" errors');
  console.log('   - Response times should be reasonable for successful requests');
}

// Run the test
runLoadTest().catch(console.error);