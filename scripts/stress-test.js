const fs = require('fs');

async function startStressTest() {
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

    console.log(`Loaded ${clients.length} clients, ${chefs.length} chefs, ${drivers.length} drivers.`);

    const URL = 'https://backend.v1.nutritiffin.com';

    let metrics = {
        totalRequests: 0,
        success: 0,
        failed: 0,
        ordersPlaced: 0,
        ordersAccepted: 0,
        ordersReady: 0,
        deliveriesFinished: 0
    };

    let lastTotalReqs = 0;
    setInterval(() => {
        const rps = ((metrics.totalRequests - lastTotalReqs) / 2).toFixed(1);
        lastTotalReqs = metrics.totalRequests;
        console.log(`[Metrics] Reqs: ${metrics.totalRequests} (${rps} req/s) | OK: ${metrics.success} | Fail: ${metrics.failed} | Orders Placed: ${metrics.ordersPlaced} | Accepted: ${metrics.ordersAccepted} | Ready: ${metrics.ordersReady} | Delivered: ${metrics.deliveriesFinished}`);
    }, 2000);

    const apiCall = async (endpoint, method, token, body = null) => {
        metrics.totalRequests++;
        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' }
            };
            if (token) options.headers['Authorization'] = `Bearer ${token}`;
            if (body) options.body = JSON.stringify(body);

            const res = await fetch(`${URL}${endpoint}`, options);
            if (!res.ok) {
                metrics.failed++;
                return null;
            }

            metrics.success++;
            const text = await res.text();
            return text ? JSON.parse(text) : {};
        } catch (err) {
            metrics.failed++;
            return null;
        }
    };

    const loginUser = async (user) => {
        const data = await apiCall('/auth/login', 'POST', null, user);
        return data ? (data.access_token || data.token) : null;
    };

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const scheduledFor = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

    // -- Flows --

    const clientFlow = async () => {
        const client = clients[Math.floor(Math.random() * clients.length)];
        const token = await loginUser(client);
        if (!token) return;

        // Fetch kitchens
        const kitchens = await apiCall('/kitchens', 'GET', token);
        if (!kitchens || kitchens.length === 0) return;

        // Pick a random kitchen
        const kitchen = kitchens[Math.floor(Math.random() * kitchens.length)];

        // Fetch menu items
        const menuItems = await apiCall(`/menu-items/kitchen/${kitchen.id}`, 'GET', token);
        if (!menuItems || menuItems.length === 0) return;

        // Pick random items to order
        const item = menuItems[Math.floor(Math.random() * menuItems.length)];

        // Place order
        const orderData = {
            kitchen_id: kitchen.id,
            scheduled_for: scheduledFor,
            items: [{ food_item_id: item.id, quantity: 1 }]
        };
        const order = await apiCall('/orders', 'POST', token, orderData);
        if (order) metrics.ordersPlaced++;
    };

    const chefFlow = async () => {
        const chef = chefs[Math.floor(Math.random() * chefs.length)];
        const token = await loginUser(chef);
        if (!token) return;

        // Get orders
        const orders = await apiCall('/orders', 'GET', token);
        if (!orders || orders.length === 0) return;

        // Try to accept PENDING orders
        const pendingOrders = orders.filter(o => o.status === 'PENDING');
        if (pendingOrders.length > 0) {
            const orderToAccept = pendingOrders[Math.floor(Math.random() * pendingOrders.length)];
            const res = await apiCall(`/orders/${orderToAccept.id}/accept`, 'PATCH', token);
            if (res) metrics.ordersAccepted++;
        }

        // Try to make ACCEPTED orders READY
        const acceptedOrders = orders.filter(o => o.status === 'ACCEPTED');
        if (acceptedOrders.length > 0) {
            const orderToReady = acceptedOrders[Math.floor(Math.random() * acceptedOrders.length)];
            const res = await apiCall(`/orders/${orderToReady.id}/ready`, 'PATCH', token);
            if (res) metrics.ordersReady++;
        }
    };

    const driverFlow = async () => {
        const driver = drivers[Math.floor(Math.random() * drivers.length)];
        const token = await loginUser(driver);
        if (!token) return;

        // Get available deliveries
        const availableDeliveries = await apiCall('/deliveries/available', 'GET', token);
        if (availableDeliveries && availableDeliveries.length > 0) {
            // Accept one
            const deliveryToAccept = availableDeliveries[Math.floor(Math.random() * availableDeliveries.length)];
            await apiCall(`/deliveries/${deliveryToAccept.id}/accept`, 'PATCH', token);
        }

        // Check my orders
        const myDeliveries = await apiCall('/deliveries/my-orders', 'GET', token);
        if (!myDeliveries || myDeliveries.length === 0) return;

        // Iterate deliveries and progress status randomly
        for (let delivery of myDeliveries) {
            if (delivery.status === 'READY') {
                await apiCall(`/deliveries/${delivery.id}/pick-up`, 'PATCH', token);
            } else if (delivery.status === 'PICKED_UP') {
                await apiCall(`/deliveries/${delivery.id}/out-for-delivery`, 'PATCH', token);
            } else if (delivery.status === 'OUT_FOR_DELIVERY') {
                let otp = null;
                const shuffled = [...clients].sort(() => Math.random() - 0.5).slice(0, 8);
                for (const c of shuffled) {
                    const ct = await loginUser(c);
                    if (!ct) continue;
                    const handoff = await apiCall(`/orders/${delivery.id}/delivery-handoff-otp`, 'GET', ct);
                    if (handoff && handoff.otp) {
                        otp = handoff.otp;
                        break;
                    }
                }
                if (!otp) continue;
                const res = await apiCall(`/deliveries/${delivery.id}/finish`, 'PATCH', token, { otp });
                if (res) metrics.deliveriesFinished++;
            }
        }
    };

    const runWorker = async () => {
        while (true) {
            const r = Math.random();
            // Mix of roles playing concurrently
            if (r < 0.4) await clientFlow();      // 40% chance client (generates orders)
            else if (r < 0.7) await chefFlow();   // 30% chance chef (processes orders)
            else await driverFlow();              // 30% chance driver (delivers orders)

            // Prevent crazy local port exhaustion
            await new Promise(r => setTimeout(r, 20));
        }
    };

    const CONCURRENCY = 15;
    console.log(`Starting ${CONCURRENCY} concurrent mixed-role workers...`);
    for (let i = 0; i < CONCURRENCY; i++) {
        runWorker();
    }
}

startStressTest();
