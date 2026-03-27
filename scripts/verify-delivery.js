const axios = require('axios');

const BASE_URL = 'https://backend.v1.nutritiffin.com';

async function main() {
  try {
    console.log(`Testing against ${BASE_URL}\n`);

    // Helper for 10-digit phone
    const generatePhone = () => '9' + Math.floor(100000000 + Math.random() * 900000000).toString();

    // 1. Register & Login Kitchen Owner
    console.log('--- Kitchen Owner Setup ---');
    const ts = Date.now();
    const ownerUsername = `owner_${ts}`;
    const kitchenOwnerEmail = `owner_${ts}@yopmail.com`;

    console.log(`Registering Owner: ${ownerUsername}`);
    try {
      await axios.post(`${BASE_URL}/auth/register`, {
        username: ownerUsername,
        name: 'Test Owner',
        email: kitchenOwnerEmail,
        phone_number: generatePhone(),
        address: 'Kitchen St',
        pincode: '123456',
        password: 'Password123!',
        role: 'KITCHEN_OWNER',
      });
    } catch (e) {
      if (e.response && e.response.status === 409) {
        console.log('Owner already exists (unexpected for unique ts)');
      } else {
        throw e;
      }
    }

    console.log(`Logging in Owner: ${ownerUsername}`);
    const ownerLogin = await axios.post(`${BASE_URL}/auth/login`, {
      username: ownerUsername,
      password: 'Password123!',
    });
    const ownerToken = ownerLogin.data.access_token;
    if (!ownerToken) throw new Error('Owner login failed, no token received');
    console.log('Kitchen Owner Logged In');

    // Create Kitchen
    console.log('Creating Kitchen...');
    const kitchen = await axios.post(
      `${BASE_URL}/kitchens`,
      {
        name: `Test Kitchen ${ts}`,
        details: {
          address: '123 Food St',
          phone: '555-5555',
          email: kitchenOwnerEmail,
        },
        operating_hours: {
          monday: { open: '08:00', close: '20:00' },
          tuesday: { open: '08:00', close: '20:00' },
        },
      },
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    );
    const kitchenId = kitchen.data.id;
    console.log('Kitchen Created:', kitchenId);

    // Create Menu Item
    console.log('Creating Menu Item...');
    const menuItem = await axios.post(
      `${BASE_URL}/menu-items`,
      {
        name: 'Test Burger',
        price: 250,
        description: 'Tasty test burger',
        max_daily_orders: 50,
        availability_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        is_available: true,
      },
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    );
    const menuItemId = menuItem.data.id;
    console.log('Menu Item Created:', menuItemId);

    // 2. Login Existing Client (with credits)
    console.log('\n--- Client Setup (Existing) ---');
    const clientUsername = 'nutriuser';
    const clientPassword = 'pass123';

    console.log(`Logging in Client: ${clientUsername}`);
    const clientLogin = await axios.post(`${BASE_URL}/auth/login`, {
      username: clientUsername,
      password: clientPassword,
    });
    const clientToken = clientLogin.data.access_token;
    if (!clientToken) throw new Error('Client login failed, no token received');
    console.log('Client Logged In');

    // Create Order
    console.log('Creating Order...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const scheduledFor = tomorrow.toISOString().split('T')[0];

    const order = await axios.post(
      `${BASE_URL}/orders`,
      {
        kitchen_id: kitchenId,
        scheduled_for: scheduledFor,
        items: [{ food_item_id: menuItemId, quantity: 2 }],
      },
      { headers: { Authorization: `Bearer ${clientToken}` } },
    );
    const orderId = order.data.id;
    console.log('Order Created:', orderId);

    // 3. Kitchen Accepts Order
    console.log('\n--- Kitchen Accepts Order ---');
    await axios.patch(
      `${BASE_URL}/orders/${orderId}/accept`,
      {},
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    console.log('Order Accepted by Kitchen');

    // Kitchen marks Order Ready
    await axios.patch(
      `${BASE_URL}/orders/${orderId}/ready`,
      {},
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    console.log('Order Marked READY by Kitchen');

    // 4. Register & Login Delivery Driver
    console.log('\n--- Driver Setup ---');
    const driverUsername = `driver_${ts}`;
    const driverEmail = `driver_${ts}@yopmail.com`;

    console.log(`Registering Driver: ${driverUsername}`);
    await axios.post(`${BASE_URL}/auth/register`, {
      username: driverUsername,
      name: 'Test Driver',
      email: driverEmail,
      phone_number: generatePhone(),
      address: 'Driver HQ',
      pincode: '123456',
      password: 'Password123!',
      role: 'DELIVERY_DRIVER',
    });

    console.log(`Logging in Driver: ${driverUsername}`);
    const driverLogin = await axios.post(`${BASE_URL}/auth/login`, {
      username: driverUsername,
      password: 'Password123!',
    });
    const driverToken = driverLogin.data.access_token;
    if (!driverToken) throw new Error('Driver login failed, no token');
    console.log('Driver Logged In');

    // 5. Driver Flow
    console.log('\n--- Driver Flow ---');

    // Get Available
    console.log('Fetching Available Deliveries...');
    const available = await axios.get(`${BASE_URL}/deliveries/available`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    console.log('Available Deliveries Count:', available.data.length);

    const targetOrder = available.data.find((o) => o.id === orderId);
    if (!targetOrder) {
      throw new Error(`Order ${orderId} not found in available list`);
    }
    console.log('Found target order in available list');

    // Accept Delivery
    console.log(`Accepting Delivery ${orderId}...`);
    await axios.patch(
      `${BASE_URL}/deliveries/${orderId}/accept`,
      {},
      { headers: { Authorization: `Bearer ${driverToken}` } }
    );
    console.log('Driver Accepted Order');

    // Pick-up Delivery
    console.log(`Picking up Delivery ${orderId}...`);
    await axios.patch(
      `${BASE_URL}/deliveries/${orderId}/pick-up`,
      {},
      { headers: { Authorization: `Bearer ${driverToken}` } }
    );
    console.log('Driver Picked up Order');

    // Out for delivery
    console.log(`Marking Delivery ${orderId} Out for Delivery...`);
    await axios.patch(
      `${BASE_URL}/deliveries/${orderId}/out-for-delivery`,
      {},
      { headers: { Authorization: `Bearer ${driverToken}` } }
    );
    console.log('Driver Marked Order Out for Delivery');

    // Client reads in-app handoff code (shown to driver at door)
    console.log('Client fetching delivery handoff OTP...');
    const handoffRes = await axios.get(
      `${BASE_URL}/orders/${orderId}/delivery-handoff-otp`,
      { headers: { Authorization: `Bearer ${clientToken}` } }
    );
    const handoffOtp = handoffRes.data.otp;
    if (!handoffOtp || String(handoffOtp).length !== 4) {
      throw new Error('Invalid handoff OTP from API');
    }

    // Finish Delivery
    console.log('Finishing Delivery (with handoff OTP)...');
    await axios.patch(
      `${BASE_URL}/deliveries/${orderId}/finish`,
      { otp: handoffOtp },
      { headers: { Authorization: `Bearer ${driverToken}` } }
    );
    console.log('Driver Finished Delivery');

    // Verify Final Status
    console.log('Verifying Final Status...');
    const finalOrder = await axios.get(`${BASE_URL}/deliveries/${orderId}`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    console.log('Final Order Status:', finalOrder.data.status);

    if (finalOrder.data.status === 'DELIVERED') {
      console.log('\nSUCCESS: Full Delivery Flow Verified!');
    } else {
      console.error('\nFAILURE: Final status mismatch');
    }
  } catch (error) {
    console.error('\nERROR OCCURRED:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

main();
