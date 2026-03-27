const axios = require('axios');
const { Client } = require('pg');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';

// Load .env for DB connection (needed to auto-verify users)
const envPath = path.join(__dirname, '..', '.env');
const envConfig = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath)
    .toString()
    .split('\n')
    .forEach((line) => {
      const parts = line.split('=');
      if (parts.length >= 2 && !line.startsWith('#')) {
        let val = parts.slice(1).join('=').trim();
        val = val.replace(/^["'](.*)["']$/, '$1');
        envConfig[parts[0].trim()] = val;
      }
    });
}

async function getDbClient() {
  const client = new Client({
    host: envConfig.DB_HOST || process.env.DB_HOST,
    port: parseInt(envConfig.DB_PORT || process.env.DB_PORT || '5432'),
    user: envConfig.DB_USERNAME || process.env.DB_USERNAME,
    password: envConfig.DB_PASSWORD || process.env.DB_PASSWORD,
    database: envConfig.DB_NAME || process.env.DB_NAME,
    ssl:
      (envConfig.DB_SSL || process.env.DB_SSL) === 'true'
        ? { rejectUnauthorized: false }
        : false,
  });
  await client.connect();
  return client;
}

// ---- HELPERS ----

function generateRandomString(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function tomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function authHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}

// ---- AUTH ACTIONS ----

async function registerUser(role, prefix, dbClient) {
  const username = `${prefix}_${generateRandomString()}`;
  const password = 'password123';
  const email = `${username}@example.com`;
  const phone_number = '9' + generateRandomString(9).replace(/[^0-9]/g, '0');
  const name = `${prefix} User`;
  const address = '123 Test Street, Automation City';

  console.log(`Registering ${role}: ${username}...`);
  try {
    await axios.post(`${BASE_URL}/auth/register`, {
      username,
      name,
      email,
      phone_number,
      address,
      pincode: '123456',
      password,
      role,
    });
  } catch (e) {
    if (e.response && e.response.status === 409) {
      console.log('User already exists, proceeding to login.');
    } else {
      throw new Error(
        `Registration failed for ${username}: ${e.message} ${JSON.stringify(e.response?.data)}`,
      );
    }
  }

  // Auto-verify user in DB so login works (email verification can't be done in automated tests)
  await dbClient.query('UPDATE users SET is_verified = true WHERE username = $1', [username]);
  console.log(`  ✔ Email auto-verified for ${username}`);

  console.log(`Logging in ${role}: ${username}...`);
  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    username,
    password,
  });

  return {
    item: loginRes.data,
    token: loginRes.data.access_token,
    username,
    password,
  };
}

// ---- MAIN TEST SUITE ----

async function main() {
  let dbClient;
  try {
    console.log('🚀 Starting Expanded Complete Endpoint Coverage Test...');

    // Connect to DB for auto-verification
    dbClient = await getDbClient();
    console.log('📦 Connected to DB for user verification\n');

    // 1. Register Users (Multiple ones)
    console.log('--- REGISTERING ACCOUNTS ---');
    const owners = [];
    const clients = [];
    const drivers = [];

    for (let i = 1; i <= 2; i++) {
        owners.push(await registerUser('KITCHEN_OWNER', `owner${i}`, dbClient));
    }
    for (let i = 1; i <= 3; i++) {
        clients.push(await registerUser('CLIENT', `client${i}`, dbClient));
    }
    for (let i = 1; i <= 2; i++) {
        drivers.push(await registerUser('DELIVERY_DRIVER', `driver${i}`, dbClient));
    }

    const ownerHeaders = owners.map(o => authHeaders(o.token));
    const clientHeaders = clients.map(c => authHeaders(c.token));
    const driverHeaders = drivers.map(d => authHeaders(d.token));

    // 2. Create Kitchens (Owners)
    console.log('\n--- CREATING KITCHENS ---');
    const kitchens = [];
    for (let i = 0; i < owners.length; i++) {
      console.log(`👨‍🍳 Owner ${i+1}: Creating Kitchen...`);
      const kitchenName = `Kitchen ${i+1} - ${generateRandomString(4)}`;
      const kitchenRes = await axios.post(
        `${BASE_URL}/kitchens`,
        {
          name: kitchenName,
          details: {
            address: `${100 + i} Test St, Food City`,
            phone: `987654321${i}`,
            description: `Best automated food by owner ${i+1}`,
          },
          operating_hours: {
            monday: { open: '08:00', close: '20:00' },
            tuesday: { open: '08:00', close: '20:00' },
            wednesday: { open: '08:00', close: '20:00' },
            thursday: { open: '08:00', close: '20:00' },
            friday: { open: '08:00', close: '20:00' },
            saturday: { open: '08:00', close: '20:00' },
            sunday: { open: '08:00', close: '20:00' }
          },
        },
        ownerHeaders[i],
      );

      if (kitchenRes.status !== 201) throw new Error(`Kitchen creation failed: ${kitchenRes.status}`);
      kitchens.push(kitchenRes.data);
      console.log(`✅ Kitchen created: ${kitchenRes.data.id}`);
    }

    // 3. Create Menu Items (Multiple items per kitchen)
    console.log('\n--- ADDING MENU ITEMS ---');
    const allMenuItems = [];
    for (let i = 0; i < owners.length; i++) {
      for (let j = 1; j <= 2; j++) {
          const itemName = `Dish ${i+1}-${j} ${generateRandomString(4)}`;
          const itemRes = await axios.post(
            `${BASE_URL}/menu-items`,
            {
              name: itemName,
              price: 150 + (j * 50),
              description: `Delicious dish ${j} from kitchen ${i+1}`,
              max_daily_orders: 50,
              availability_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
              is_available: true,
            },
            ownerHeaders[i],
          );
          allMenuItems.push({ ...itemRes.data, ownerIndex: i, kitchenId: kitchens[i].id });
          console.log(`✅ Menu Item created: ${itemRes.data.id} for Kitchen ${kitchens[i].id}`);
      }
    }

    // 4. Place Multiple Orders (Clients placing orders to different kitchens)
    console.log('\n--- PLACING MULTIPLE ORDERS (TRANSACTIONS) ---');
    const tomorrow = tomorrowDate();
    const allOrders = [];

    // Client 1 orders from Kitchen 1
    console.log(`🛒 Client 1: Ordering from Kitchen 1...`);
    let orderRes = await axios.post(
      `${BASE_URL}/orders`,
      {
        kitchen_id: kitchens[0].id,
        scheduled_for: tomorrow,
        items: [{ food_item_id: allMenuItems[0].id, quantity: 2 }],
      },
      clientHeaders[0],
    );
    allOrders.push({ id: orderRes.data.id, clientIndex: 0, ownerIndex: 0 });
    console.log(`✅ Order placed: ${orderRes.data.id}`);

    // Client 2 orders from Kitchen 1
    console.log(`🛒 Client 2: Ordering from Kitchen 1...`);
    orderRes = await axios.post(
      `${BASE_URL}/orders`,
      {
        kitchen_id: kitchens[0].id,
        scheduled_for: tomorrow,
        items: [{ food_item_id: allMenuItems[1].id, quantity: 1 }],
      },
      clientHeaders[1],
    );
    allOrders.push({ id: orderRes.data.id, clientIndex: 1, ownerIndex: 0 });
    console.log(`✅ Order placed: ${orderRes.data.id}`);

    // Client 3 orders from Kitchen 2
    console.log(`🛒 Client 3: Ordering from Kitchen 2...`);
    orderRes = await axios.post(
      `${BASE_URL}/orders`,
      {
        kitchen_id: kitchens[1].id,
        scheduled_for: tomorrow,
        items: [{ food_item_id: allMenuItems[2].id, quantity: 3 }],
      },
      clientHeaders[2],
    );
    allOrders.push({ id: orderRes.data.id, clientIndex: 2, ownerIndex: 1 });
    console.log(`✅ Order placed: ${orderRes.data.id}`);

    // Client 1 orders again but for rejection test
    console.log(`🛒 Client 1: Placing order to be rejected...`);
    const rejectOrderRes = await axios.post(
      `${BASE_URL}/orders`,
      {
        kitchen_id: kitchens[1].id,
        scheduled_for: tomorrow,
        items: [{ food_item_id: allMenuItems[3].id, quantity: 5 }],
      },
      clientHeaders[0],
    );
    const rejectOrderId = rejectOrderRes.data.id;
    console.log(`✅ Order placed (will be rejected): ${rejectOrderId}`);

    // 5. Owner Order Management
    console.log('\n--- MANAGING ORDERS (OWNERS) ---');
    for (let i = 0; i < owners.length; i++) {
        console.log(`👨‍🍳 Owner ${i+1}: Managing Orders...`);
        const ownerOrdersRes = await axios.get(`${BASE_URL}/orders`, ownerHeaders[i]);
        
        for (const order of ownerOrdersRes.data) {
            if (order.id === rejectOrderId && i === 1) { // It's for Kitchen 2
                console.log(`👨‍🍳 Owner ${i+1}: Rejecting order ${order.id}...`);
                await axios.patch(`${BASE_URL}/orders/${order.id}/reject`, {}, ownerHeaders[i]);
                console.log(`✅ Order REJECTED`);
            } else if (allOrders.find(o => o.id === order.id)) {
                // Accept valid orders
                console.log(`👨‍🍳 Owner ${i+1}: Accepting order ${order.id}...`);
                await axios.patch(`${BASE_URL}/orders/${order.id}/accept`, {}, ownerHeaders[i]);
                console.log(`✅ Order ACCEPTED`);
            }
        }
    }

    // 6. Delivery Driver Flow (Drivers take turns processing available orders)
    console.log('\n--- DELIVERY OPERATIONS ---');
    for (let d = 0; d < drivers.length; d++) {
        console.log(`🚚 Driver ${d+1}: Checking available deliveries...`);
        const availableRes = await axios.get(`${BASE_URL}/deliveries/available`, driverHeaders[d]);
        
        // Take up to 2 deliveries each
        const toDeliver = availableRes.data.slice(0, 2);
        for (const deliveryJob of toDeliver) {
            console.log(`🚚 Driver ${d+1}: Processing delivery for order ${deliveryJob.id}...`);
            await axios.patch(`${BASE_URL}/deliveries/${deliveryJob.id}/accept`, {}, driverHeaders[d]);
            console.log(`   ✅ Accepted`);
            await axios.patch(`${BASE_URL}/deliveries/${deliveryJob.id}/pick-up`, {}, driverHeaders[d]);
            console.log(`   ✅ Picked up`);
            await axios.patch(`${BASE_URL}/deliveries/${deliveryJob.id}/out-for-delivery`, {}, driverHeaders[d]);
            console.log(`   ✅ Out for delivery`);
            const orderMeta = allOrders.find((o) => o.id === deliveryJob.id);
            if (!orderMeta) throw new Error(`No client mapping for order ${deliveryJob.id}`);
            const handoffRes = await axios.get(
              `${BASE_URL}/orders/${deliveryJob.id}/delivery-handoff-otp`,
              clientHeaders[orderMeta.clientIndex],
            );
            await axios.patch(
              `${BASE_URL}/deliveries/${deliveryJob.id}/finish`,
              { otp: handoffRes.data.otp },
              driverHeaders[d],
            );
            console.log(`   ✅ Finished`);
        }
    }

    // 7. Verify Client Views
    console.log('\n--- VERIFYING CLIENT HISTORIES ---');
    for (let c = 0; c < clients.length; c++) {
        console.log(`😊 Client ${c+1}: Verifying Order History...`);
        const clientHistoryRes = await axios.get(`${BASE_URL}/orders`, clientHeaders[c]);
        
        const myOrdersExpected = allOrders.filter(o => o.clientIndex === c);
        for (const expected of myOrdersExpected) {
            const found = clientHistoryRes.data.find(o => o.id === expected.id);
            if (!found || found.status !== 'DELIVERED') {
                throw new Error(`Client ${c+1} history mismatch! Order ${expected.id} not DELIVERED.`);
            }
            console.log(`✅ Confirmed order ${expected.id} is DELIVERED`);
        }
    }

    console.log('\n✨ ALL MULTIPLE-ACCOUNT EXPERIMENTS COMPLETED WITH SUCCESS ✨');
  } catch (err) {
    console.error('\n❌ TEST FAILED');
    if (err.response) {
      console.error(`Status: ${err.response.status}`);
      console.error('Data:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
    process.exit(1);
  } finally {
    if (dbClient) await dbClient.end();
  }
}

main();
