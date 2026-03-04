const fs = require('fs');

async function startProgressiveMixedLoadTest() {
    const fileContent = fs.readFileSync('RegisteredTestUsers.txt', 'utf-8');

    const clients = [];
    const drivers = [];
    const chefs = [];

    const regex = /{\s*"username":\s*"([^"]+)",\s*"password":\s*"([^"]+)"\s*}/g;
    let match;
    while ((match = regex.exec(fileContent)) !== null) {
        const user = { username: match[1], password: match[2] };
        if (user.username.startsWith('client')) clients.push(user);
        else if (user.username.startsWith('driver')) drivers.push(user);
        else if (user.username.startsWith('chef')) chefs.push(user);
    }

    const URL = 'https://backend.v1.nutritiffin.com';

    let globalMetrics = { totalReqs: 0, success: 0, failed: 0 };
    let phaseMetrics = { totalReqs: 0, success: 0, failed: 0 };

    let currentConcurrency = 5;
    const CONCURRENCY_STEP = 5;
    const PHASE_DURATION_MS = 10000; // 10s per phase

    let isRunning = true;
    let activeWorkers = 0;

    const apiCall = async (endpoint, method, token, body = null) => {
        globalMetrics.totalReqs++;
        phaseMetrics.totalReqs++;

        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' }
            };
            if (token) options.headers['Authorization'] = `Bearer ${token}`;
            if (body) options.body = JSON.stringify(body);

            const res = await fetch(`${URL}${endpoint}`, options);
            if (!res.ok) {
                globalMetrics.failed++;
                phaseMetrics.failed++;
                return null;
            }

            globalMetrics.success++;
            phaseMetrics.success++;
            const text = await res.text();
            return text ? JSON.parse(text) : {};
        } catch (err) {
            globalMetrics.failed++;
            phaseMetrics.failed++;
            return null;
        }
    };

    const loginUser = async (user) => {
        const data = await apiCall('/auth/login', 'POST', null, user);
        return data ? (data.access_token || data.token) : null;
    };

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const scheduledFor = tomorrow.toISOString().split('T')[0];

    const clientFlow = async () => {
        const client = clients[Math.floor(Math.random() * clients.length)];
        const token = await loginUser(client);
        if (!token) return;

        const kitchens = await apiCall('/kitchens', 'GET', token);
        if (!kitchens || kitchens.length === 0) return;
        const kitchen = kitchens[Math.floor(Math.random() * kitchens.length)];

        const menuItems = await apiCall(`/menu-items/kitchen/${kitchen.id}`, 'GET', token);
        if (!menuItems || menuItems.length === 0) return;

        const item = menuItems[Math.floor(Math.random() * menuItems.length)];
        await apiCall('/orders', 'POST', token, {
            kitchen_id: kitchen.id,
            scheduled_for: scheduledFor,
            items: [{ food_item_id: item.id, quantity: 1 }]
        });
    };

    const chefFlow = async () => {
        const chef = chefs[Math.floor(Math.random() * chefs.length)];
        const token = await loginUser(chef);
        if (!token) return;

        const orders = await apiCall('/orders', 'GET', token);
        if (!orders || orders.length === 0) return;

        const pendingOrders = orders.filter(o => o.status === 'PENDING');
        if (pendingOrders.length > 0) {
            const order = pendingOrders[Math.floor(Math.random() * pendingOrders.length)];
            await apiCall(`/orders/${order.id}/accept`, 'PATCH', token);
        }
    };

    const driverFlow = async () => {
        const driver = drivers[Math.floor(Math.random() * drivers.length)];
        const token = await loginUser(driver);
        if (!token) return;

        const myDeliveries = await apiCall('/deliveries/my-orders', 'GET', token);
        if (!myDeliveries || myDeliveries.length === 0) return;

        for (let delivery of myDeliveries) {
            if (delivery.status === 'READY') {
                await apiCall(`/deliveries/${delivery.id}/pick-up`, 'PATCH', token);
            }
        }
    };

    const runWorker = async () => {
        activeWorkers++;
        while (isRunning) {
            const r = Math.random();
            if (r < 0.5) await clientFlow();
            else if (r < 0.75) await chefFlow();
            else await driverFlow();

            await new Promise(r => setTimeout(r, 20));
        }
        activeWorkers--;
    };

    console.log(`\n--- Starting progressive MIXED stress test at concurrency: ${currentConcurrency} ---`);
    for (let i = 0; i < currentConcurrency; i++) {
        runWorker();
    }

    const evaluationInterval = setInterval(() => {
        const rps = (phaseMetrics.totalReqs / (PHASE_DURATION_MS / 1000)).toFixed(1);
        console.log(`\n[Phase Result] Concurrency: ${currentConcurrency} | Reqs: ${phaseMetrics.totalReqs} (${rps} req/s) | Success: ${phaseMetrics.success} | Failed: ${phaseMetrics.failed}`);

        if (phaseMetrics.failed > 0) {
            console.log(`\n❌ ERROR THRESHOLD REACHED ON MIXED LOAD!`);
            console.log(`Capacity achieved: Safe mixed operations max out around ${Math.max(1, currentConcurrency - CONCURRENCY_STEP)} concurrent users.`);
            console.log(`Failed at: ${currentConcurrency} concurrent continuous connections doing orders/kitchens/deliveries.`);
            console.log(`Final Stats: ${globalMetrics.totalReqs} total requests | ${globalMetrics.failed} total failures`);

            isRunning = false;
            clearInterval(evaluationInterval);
            setTimeout(() => process.exit(0), 2000);
            return;
        }

        currentConcurrency += CONCURRENCY_STEP;
        console.log(`✅ Phase passed. Ramping up to ${currentConcurrency} mixed concurrent loops...`);

        phaseMetrics = { totalReqs: 0, success: 0, failed: 0 };

        for (let i = 0; i < CONCURRENCY_STEP; i++) {
            runWorker();
        }

    }, PHASE_DURATION_MS);
}

startProgressiveMixedLoadTest();
