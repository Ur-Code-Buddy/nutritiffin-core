const fs = require('fs');

async function startStressTest() {
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

    // Track metrics
    setInterval(() => {
        console.log(`[Metrics] Total reqs: ${totalRequests} | Success: ${successRequests} | Failed: ${failedRequests}`);
    }, 2000);

    // Helper method to login
    const doLoginAndFetch = async (user) => {
        try {
            totalRequests++;
            // 1. Login
            const loginRes = await fetch(`${URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(user)
            });

            if (!loginRes.ok) {
                failedRequests++;
                console.error(`Login failed for ${user.username} with status ${loginRes.status}`);
                return;
            }

            const loginData = await loginRes.json();
            const token = loginData.access_token || loginData.token;

            if (token) {
                // Log in was successful
                successRequests++;

                // 2. Fetch Profile
                totalRequests++;
                const profileRes = await fetch(`${URL}/users/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (profileRes.ok) {
                    successRequests++;
                } else {
                    failedRequests++;
                }
            } else {
                // No token but request succeeded?
                failedRequests++;
                console.error(`No token returned for ${user.username}`);
            }
        } catch (err) {
            failedRequests++;
            console.error(`Error during request for ${user.username}: ${err.message}`);
        }
    };

    const CONCURRENCY = 10;
    console.log(`Starting ${CONCURRENCY} concurrent workers...`);

    const runWorker = async (workerId) => {
        while (true) {
            const randomUser = users[Math.floor(Math.random() * users.length)];
            await doLoginAndFetch(randomUser);
            // Wait slightly between bursts
            await new Promise(r => setTimeout(r, 10));
        }
    };

    for (let i = 0; i < CONCURRENCY; i++) {
        runWorker(i);
    }
}

startStressTest();
