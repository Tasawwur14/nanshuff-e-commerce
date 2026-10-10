/**
 * Checkout Flow Test Script
 * Tests the complete Razorpay checkout and order creation flow
 */

const http = require('http');
const querystring = require('querystring');

const BASE_URL = 'http://localhost:3000';
let sessionCookie = '';

// Helper function to make HTTP requests
function makeRequest(path, method = 'GET', body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(path, BASE_URL);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
                'Cookie': sessionCookie
            }
        };

        if (body) {
            const bodyStr = JSON.stringify(body);
            options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
        }

        const req = http.request(options, (res) => {
            let data = '';
            
            // Capture session cookie
            if (res.headers['set-cookie']) {
                const cookies = res.headers['set-cookie'];
                cookies.forEach(cookie => {
                    if (cookie.startsWith('connect.sid')) {
                        sessionCookie = cookie.split(';')[0];
                    }
                });
            }

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        body: data ? JSON.parse(data) : null,
                        headers: res.headers
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        body: data,
                        headers: res.headers
                    });
                }
            });
        });

        req.on('error', reject);
        
        if (body) {
            req.write(JSON.stringify(body));
        }
        
        req.end();
    });
}

// Test flow
async function runTests() {
    console.log('🧪 Starting Checkout Flow Tests\n');

    try {
        // Test 1: User Login
        console.log('📝 Test 1: User Login');
        const loginRes = await makeRequest('/api/auth/login', 'POST', {
            email: 'john@example.com',
            password: 'Test@1234'
        });
        
        if (loginRes.status === 200) {
            console.log('✅ Login successful');
            console.log(`   User ID: ${loginRes.body.user?.id}`);
        } else {
            console.log(`❌ Login failed with status ${loginRes.status}`);
            console.log(`   Response: ${JSON.stringify(loginRes.body)}`);
            return;
        }

        // Test 2: Get Cart
        console.log('\n🛒 Test 2: Get Cart');
        const cartRes = await makeRequest('/api/cart', 'GET');
        console.log(`✅ Cart fetched`);
        console.log(`   Items: ${cartRes.body.items?.length || 0}`);
        console.log(`   Subtotal: ₹${cartRes.body.subtotal || 0}`);
        console.log(`   Final Total: ₹${cartRes.body.finalTotal || 0}`);

        if (!cartRes.body.items || cartRes.body.items.length === 0) {
            console.log('⚠️  Cart is empty, adding test products...');
            
            // Add product to cart
            const addRes = await makeRequest('/api/cart/add', 'POST', {
                productId: 1,
                quantity: 1
            });
            
            if (addRes.status === 200) {
                console.log('✅ Product added to cart');
            } else {
                console.log(`❌ Failed to add product: ${addRes.status}`);
            }
        }

        // Test 3: Create Order
        console.log('\n📦 Test 3: Create Order');
        const orderRes = await makeRequest('/api/orders/create', 'POST', {
            fullName: 'John Doe',
            email: 'john@example.com',
            phone: '+91 98765 43210',
            address: '123 Main Street',
            city: 'Delhi',
            state: 'Delhi',
            postalCode: '110001',
            country: 'India',
            couponCode: ''
        });

        if (orderRes.status === 201) {
            console.log('✅ Order created successfully');
            const orderId = orderRes.body.orderId;
            console.log(`   Order ID: ${orderId}`);
            console.log(`   Total: ₹${orderRes.body.order?.totalAmount || 0}`);

            // Test 4: Create Razorpay Order
            console.log('\n💳 Test 4: Create Razorpay Order');
            const rzpOrderRes = await makeRequest('/api/payment/razorpay/create-order', 'POST', {
                orderId: orderId,
                amount: orderRes.body.order.totalAmount,
                currency: 'INR'
            });

            if (rzpOrderRes.status === 200) {
                console.log('✅ Razorpay order created');
                console.log(`   Razorpay Order ID: ${rzpOrderRes.body.orderId}`);
                console.log(`   Amount: ₹${rzpOrderRes.body.amount / 100}`);
                console.log(`   Key ID: ${rzpOrderRes.body.key_id}`);

                // Test 5: Verify Razorpay Payment (mock)
                console.log('\n✔️  Test 5: Verify Razorpay Payment');
                const verifyRes = await makeRequest('/api/payment/razorpay/verify', 'POST', {
                    razorpay_order_id: rzpOrderRes.body.orderId,
                    razorpay_payment_id: `pay_${Date.now()}`,
                    razorpay_signature: 'mock_signature',
                    orderId: orderId
                });

                if (verifyRes.status === 200) {
                    console.log('✅ Payment verified successfully');
                    console.log(`   Payment Status: ${verifyRes.body.paymentStatus}`);
                    console.log(`   Order Status: ${verifyRes.body.status}`);
                } else {
                    console.log(`❌ Payment verification failed: ${verifyRes.status}`);
                }

                // Test 6: Get Order
                console.log('\n📋 Test 6: Retrieve Order');
                const getOrderRes = await makeRequest(`/api/orders/${orderId}`, 'GET');
                
                if (getOrderRes.status === 200) {
                    console.log('✅ Order retrieved');
                    console.log(`   Status: ${getOrderRes.body.status}`);
                    console.log(`   Total: ₹${getOrderRes.body.totalAmount}`);
                    console.log(`   Items: ${getOrderRes.body.items?.length || 0}`);
                } else {
                    console.log(`❌ Failed to retrieve order: ${getOrderRes.status}`);
                }

            } else {
                console.log(`❌ Razorpay order creation failed: ${rzpOrderRes.status}`);
                console.log(`   Response: ${JSON.stringify(rzpOrderRes.body)}`);
            }

        } else {
            console.log(`❌ Order creation failed with status ${orderRes.status}`);
            console.log(`   Response: ${JSON.stringify(orderRes.body)}`);
        }

        console.log('\n✅ All checkout flow tests completed!');

    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
    }
}

// Run tests
runTests().catch(console.error);
