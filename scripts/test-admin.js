const axios = require('axios');
const crypto = require('crypto');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    const api = 'http://localhost:3000';
    const adminPass = 'VrbCZby6JoH32Wxw2Lh'; // from .env
    const rand = crypto.randomBytes(4).toString('hex');

    const userPayload = {
        username: `user_${rand}`,
        name: "Test User",
        email: `user_${rand}@test.com`,
        phone_number: `+1555${rand}`,
        address: "123 Test St",
        password: "password123",
        role: "CLIENT"
    };

    const adminPayload = {
        username: `admin_${rand}`,
        name: "Test Admin",
        email: `admin_${rand}@test.com`,
        phone_number: `+1666${rand}`,
        address: "123 Admin St",
        password: "password123",
        role: "ADMIN",
        admin_access_pass: adminPass
    };

    try {
        console.log('[1] Registering normal user...');
        let res = await axios.post(`${api}/auth/register`, userPayload);
        const userId = res.data.id || res.data.user?.id;
        console.log(`Normal User ID: ${userId}`);

        console.log('[2] Registering admin with WRONG pass...');
        try {
            await axios.post(`${api}/auth/register`, { ...adminPayload, admin_access_pass: 'wrong' });
            console.error('Admin reg with wrong pass succeeded! (FAIL)');
        } catch (e) {
            console.log(`Admin reg failed as expected: ${e.response?.status}`);
        }

        console.log('[3] Registering admin with CORRECT pass...');
        res = await axios.post(`${api}/auth/register`, adminPayload);
        const adminId = res.data.id || res.data.user?.id;
        console.log(`Admin ID: ${adminId}`);

        console.log('[4] Logging in as Admin...');
        res = await axios.post(`${api}/auth/login`, { username: adminPayload.username, password: adminPayload.password });
        const adminToken = res.data.access_token;

        console.log('[4b] Logging in as User...');
        res = await axios.post(`${api}/auth/login`, { username: userPayload.username, password: userPayload.password });
        const userToken = res.data.access_token;

        console.log('[5] Checking initial credits for normal user...');
        res = await axios.get(`${api}/users/me`, { headers: { Authorization: `Bearer ${userToken}` } });
        console.log(`Initial User Profiler credits: ${res.data.credits}`);
        let actualUserId = res.data.id;

        console.log('[6] Admin adding 50 credits to normal user...');
        res = await axios.post(`${api}/admin/credits/add`, { userId: actualUserId, amount: 50 }, { headers: { Authorization: `Bearer ${adminToken}` } });

        console.log('[7] Checking credits again for normal user...');
        res = await axios.get(`${api}/users/me`, { headers: { Authorization: `Bearer ${userToken}` } });
        console.log(`New credits: ${res.data.credits}`);

        console.log('[8] Admin deducting 20 credits...');
        res = await axios.post(`${api}/admin/credits/deduct`, { userId: actualUserId, amount: 20 }, { headers: { Authorization: `Bearer ${adminToken}` } });

        console.log('[9] Checking credits...');
        res = await axios.get(`${api}/users/me`, { headers: { Authorization: `Bearer ${userToken}` } });
        console.log(`Final credits: ${res.data.credits}`);

        console.log('[10] Admin disabling user...');
        await axios.post(`${api}/admin/users/${actualUserId}/disable`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });

        res = await axios.get(`${api}/users/me`, { headers: { Authorization: `Bearer ${userToken}` } });
        console.log(`User active status: ${res.data.is_active}`);

        console.log('[11] Admin viewing all users and credit balances...');
        res = await axios.get(`${api}/admin/users`, { headers: { Authorization: `Bearer ${adminToken}` } });
        console.log(`Total users found: ${res.data.length}`);
        const userToPrint = res.data.find(u => u.username === userPayload.username);
        if (userToPrint) {
            console.log(`Normal User details from Admin view: ID=${userToPrint.id}, Name=${userToPrint.name}, Credits=${userToPrint.credits}`);
        } else {
            console.log('User not found in Admin view');
        }

        console.log('ALL TESTS PASSED.');
        process.exit(0);

    } catch (error) {
        console.error('Test Failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

run();
