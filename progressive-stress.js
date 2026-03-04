const fs = require('fs');

async function startProgressiveStressTest() {
    const fileContent = fs.readFileSync('RegisteredTestUsers.txt', 'utf-8');

    // Parse out the JSON blocks
    const users = [];
    const regex = /{\s*"username":\s*"([^"]+)",\s*"password":\s*"([^"]+)"\s*}/g;
    let match;
    while ((match = regex.exec(fileContent)) !== null) {
        users.push({ username: match[1], password: match[2] });
    }

    console.log(`Loaded ${users.length} users for stress testing.`);

    const URL = 'https://backend.v1.nutritiffin.com';

    let totalRequests = 0;
    let successRequests = 0;
    let failedRequests = 0;

    // Track metrics for the CURRENT phase
    let phaseTotalReqs = 0;
    let phaseFailedReqs = 0;
    let phaseSuccessReqs = 0;

    let currentConcurrency = 5;
    const CONCURRENCY_STEP = 5;
    const PHASE_DURATION_MS = 10000; // 10 seconds per phase

    let isRunning = true;
    let activeWorkers = 0;

    // Helper method to login
    const doLoginAndFetch = async (user) => {
        try {
            totalRequests++;
            phaseTotalReqs++;

            const loginRes = await fetch(`${URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });

            if (!loginRes.ok) {
                failedRequests++;
                phaseFailedReqs++;
                return;
            }

            const loginData = await loginRes.json();
            const token = loginData.access_token || loginData.token;

            if (token) {
                successRequests++;
                phaseSuccessReqs++;

                totalRequests++;
                phaseTotalReqs++;
                const profileRes = await fetch(`${URL}/users/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (profileRes.ok) {
                    successRequests++;
                    phaseSuccessReqs++;
                } else {
                    failedRequests++;
                    phaseFailedReqs++;
                }
            } else {
                failedRequests++;
                phaseFailedReqs++;
            }
        } catch (err) {
            failedRequests++;
            phaseFailedReqs++;
        }
    };

    const runWorker = async () => {
        activeWorkers++;
        while (isRunning) {
            const randomUser = users[Math.floor(Math.random() * users.length)];
            await doLoginAndFetch(randomUser);
            // Wait slightly
            await new Promise(r => setTimeout(r, 10));
        }
        activeWorkers--;
    };

    // Start initial workers
    for (let i = 0; i < currentConcurrency; i++) {
        runWorker();
    }

    console.log(`\n--- Starting progressive stress test at concurrency: ${currentConcurrency} ---`);

    // Main evaluation loop
    const evaluationInterval = setInterval(() => {
        console.log(`\n[Phase Result] Concurrency: ${currentConcurrency} | Reqs: ${phaseTotalReqs} | Success: ${phaseSuccessReqs} | Failed: ${phaseFailedReqs}`);

        // Check if failure rate is greater than 1% (or just simply > 0 failures)
        // If we have failed requests in this phase, that's likely our limit
        if (phaseFailedReqs > 0) {
            console.log(`\n❌ ERROR THRESHOLD REACHED!`);
            console.log(`Capacity achieved: Your backend starts dropping requests consistently around ${Math.max(1, currentConcurrency - CONCURRENCY_STEP)} concurrent fast-looping users.`);
            console.log(`Failed at: ${currentConcurrency} concurrent continuous connections.`);
            console.log(`Final Stats: ${totalRequests} total requests | ${failedRequests} total failures`);

            isRunning = false;
            clearInterval(evaluationInterval);

            // Force exit after a few seconds to let workers finish
            setTimeout(() => process.exit(0), 3000);
            return;
        }

        // If no failures, ramp up concurrency
        currentConcurrency += CONCURRENCY_STEP;
        console.log(`\n✅ Phase passed. Ramping up to ${currentConcurrency} concurrent continuous loops...`);

        // Reset phase trackers
        phaseTotalReqs = 0;
        phaseFailedReqs = 0;
        phaseSuccessReqs = 0;

        // Start new workers to meet the new concurrency level
        // (activeWorkers might temporarily drop if one is in between loops, but this adds the delta)
        for (let i = 0; i < CONCURRENCY_STEP; i++) {
            runWorker();
        }

    }, PHASE_DURATION_MS);
}

startProgressiveStressTest();
