import axios from 'axios';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();

const API_URL = 'https://app.dev.onton.live/api/trpc/events.addEvent?batch=1';
const API_KEY = process.env.SMOKE_TEST_API_KEY || "9b4812dc-14b2-49d0-90cd-21014cb6d69b"; // Use generated key

// Helper to generate dynamic event payload
const getEventPayload = () => {
    const now = Math.floor(Date.now() / 1000);
    const start = now + 3600; // 1 hour later
    const end = now + 7200;   // 2 hours later

    return {
        "0": {
            json: {
                eventData: {
                    type: 1, // Meetup
                    title: `Live Smoke Test ${new Date().toISOString()}`,
                    subtitle: "Automated System Verification",
                    description: "This event validates that the entire backend stack (Next.js, Postgres, Redis, Caddy) is operational.",
                    location: "Internet",
                    eventLocationType: "online",
                    image_url: "https://telegra.ph/file/5a5367807494575908611.jpg",
                    ts_reward_url: "https://telegra.ph/file/5a5367807494575908611.jpg",
                    society_hub: {
                        id: "1",
                        name: "Test Hub"
                    },
                    owner: 0, // Backend overrides this
                    start_date: start,
                    end_date: end,
                    timezone: "UTC",
                    has_registration: true,
                    has_approval: false,
                    capacity: 100,
                    has_waiting_list: false,
                    secret_phrase: "smoke-test",
                    category_id: 1,
                    dynamic_fields: [],
                    countryId: 100,
                    cityId: 100,
                    paid_event: { has_payment: false }
                }
            }
        }
    };
};

async function createLiveEvent() {
    console.log('🚀 Starting Live Smoke Test...');
    console.log(`� Endpoint: ${API_URL}`);
    console.log(`� Auth: API Key (Ending in ...${API_KEY.slice(-4)})`);

    try {
        const payload = getEventPayload();

        const response = await axios.post(API_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'api_key': API_KEY
            }
        });

        console.log('\n✅ REQUEST SUCCESSFUL');
        console.log('--------------------------------------------------');

        // TRPC batch response is an array
        const result = response.data[0];

        if (result.result?.data?.json) {
            const eventData = result.result.data.json;
            console.log(`🎉 Event Created ID: ${eventData.event_uuid}`);
            console.log(`🔗 Link: https://t.me/onton_dev_bot/app?startapp=${eventData.eventHash}`);
            console.log('--------------------------------------------------');
        } else {
            console.warn('⚠️  Response format unexpected:', JSON.stringify(result, null, 2));
        }

    } catch (error: any) {
        console.error('\n❌ REQUEST FAILED');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));

            if (error.response.status === 401 || error.response.status === 403) {
                console.error('💡 Hint: Check if the API Key is valid and the User is NOT banned.');
            }
        } else {
            console.error('Error:', error.message);
        }
        process.exit(1);
    }
}

createLiveEvent();
