const axios = require('axios');

const BASE_URL = 'https://backend.v1.nutritiffin.com';

async function main() {
    try {
        console.log(`Running test-workflow against ${BASE_URL}\n`);

        const generatePhone = () => '9' + Math.floor(100000000 + Math.random() * 900000000).toString();
        const ts = Date.now();

        console.log('--- Registering Accounts ---');

        // Kitchen Owner
        const ownerName = `vkitchen_${ts}`;
        await axios.post(`${BASE_URL}/auth/register`, {
            username: ownerName, name: 'V Kitchen', email: `${ownerName}@yopmail.com`,
            phone_number: generatePhone(), address: '123 St', pincode: '123456',
            password: 'Password123!', role: 'KITCHEN_OWNER'
        });
        const kToken = (await axios.post(`${BASE_URL}/auth/login`, { username: ownerName, password: 'Password123!' })).data.access_token;
        console.log('Kitchen Logged In');

        // Client: use existing credited account
        const clientUsername = 'nutriuser';
        const clientPassword = 'pass123';
        const cToken = (await axios.post(`${BASE_URL}/auth/login`, {
            username: clientUsername,
            password: clientPassword,
        })).data.access_token;
        console.log(`Client Logged In as ${clientUsername}`);

        // Driver
        const driverName = `vdriver_${ts}`;
        await axios.post(`${BASE_URL}/auth/register`, {
            username: driverName, name: 'V Driver', email: `${driverName}@yopmail.com`,
            phone_number: generatePhone(), address: '789 St', pincode: '123456',
            password: 'Password123!', role: 'DELIVERY_DRIVER'
        });
        const dToken = (await axios.post(`${BASE_URL}/auth/login`, { username: driverName, password: 'Password123!' })).data.access_token;
        console.log('Driver Logged In');

        // Kitchen Setup
        console.log('\n--- Kitchen Setup ---');
        const kitchenId = (await axios.post(
            `${BASE_URL}/kitchens`,
            {
                name: `Virtual Test Kitchen ${ts}`,
                details: { address: 'Kitchen St' },
                operating_hours: { monday: { open: '08:00', close: '20:00' }, tuesday: { open: '08:00', close: '20:00' } }
            },
            { headers: { Authorization: `Bearer ${kToken}` } }
        )).data.id;
        console.log(`Kitchen Created: ${kitchenId}`);

        const menuItemId = (await axios.post(
            `${BASE_URL}/menu-items`,
            {
                name: 'Virtual Tiffin', price: 100, description: 'Test tiffin',
                max_daily_orders: 50, availability_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
                is_available: true,
            },
            { headers: { Authorization: `Bearer ${kToken}` } }
        )).data.id;
        console.log(`Menu Item Created: ${menuItemId}`);

        // Order
        console.log('\n--- Client Placing Order ---');
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        const orderRes = await axios.post(
            `${BASE_URL}/orders`,
            { kitchen_id: kitchenId, scheduled_for: tomorrow.toISOString().split('T')[0], items: [{ food_item_id: menuItemId, quantity: 1 }] },
            { headers: { Authorization: `Bearer ${cToken}` } }
        );
        const orderId = orderRes.data.id;
        const orderItemId = orderRes.data.items[0].id;
        console.log(`Order Created: ${orderId}`);

        // Manage
        console.log('\n--- Owner Managing Order ---');
        await axios.patch(`${BASE_URL}/orders/${orderId}/accept`, {}, { headers: { Authorization: `Bearer ${kToken}` } });
        console.log('Order Accepted');
        await axios.patch(`${BASE_URL}/orders/${orderId}/ready`, {}, { headers: { Authorization: `Bearer ${kToken}` } });
        console.log('Order Ready');

        // Deliver
        console.log('\n--- Driver Delivery Flow ---');
        await axios.patch(`${BASE_URL}/deliveries/${orderId}/accept`, {}, { headers: { Authorization: `Bearer ${dToken}` } });
        console.log('Driver Accepted Delivery');
        await axios.patch(`${BASE_URL}/deliveries/${orderId}/pick-up`, {}, { headers: { Authorization: `Bearer ${dToken}` } });
        console.log('Driver Picked Up Delivery');
        await axios.patch(`${BASE_URL}/deliveries/${orderId}/out-for-delivery`, {}, { headers: { Authorization: `Bearer ${dToken}` } });
        console.log('Driver Out for Delivery');
        const handoff = await axios.get(`${BASE_URL}/orders/${orderId}/delivery-handoff-otp`, { headers: { Authorization: `Bearer ${cToken}` } });
        await axios.patch(
            `${BASE_URL}/deliveries/${orderId}/finish`,
            { otp: handoff.data.otp },
            { headers: { Authorization: `Bearer ${dToken}` } }
        );
        console.log('Driver Finished Delivery');

        // Review
        console.log('\n--- Client Review ---');
        await axios.post(
            `${BASE_URL}/orders/${orderId}/items/${orderItemId}/rating`,
            { stars: 5 },
            { headers: { Authorization: `Bearer ${cToken}` } },
        );
        console.log('Review Posted (5 stars)');

        console.log('\n✨ ALL WORKFLOW ENDPOINTS TESTED SUCCESSFULLY! ✨');

    } catch (error) {
        console.error('\n❌ ERROR OCCURRED:');
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
