const { createClient } = require('redis');

const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', err => console.error('Redis Client Error:', err));

const db = {
    connect: async () => {
        await client.connect();
    },

    disconnect: async () => {
        await client.quit();
    },

    saveUser: async (userId, data) => {
        try {
            await client.hSet(`user:${userId}`, 'data', JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving user:', error);
            return false;
        }
    },

    getUser: async (userId) => {
        try {
            const data = await client.hGet(`user:${userId}`, 'data');
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error getting user:', error);
            return null;
        }
    },

    saveAlert: async (alertKey, data) => {
        try {
            await client.hSet(`alert:${alertKey}`, 'data', JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving alert:', error);
            return false;
        }
    },

    deleteAlert: async (alertKey) => {
        try {
            await client.del(`alert:${alertKey}`);
            return true;
        } catch (error) {
            console.error('Error deleting alert:', error);
            return false;
        }
    },

    getAlerts: async (userId) => {
        try {
            const keys = await client.keys(`alert:${userId}_*`);
            const alerts = {};
            
            for (const key of keys) {
                const data = await client.hGet(key, 'data');
                if (data) {
                    alerts[key.replace('alert:', '')] = JSON.parse(data);
                }
            }
            
            return alerts;
        } catch (error) {
            console.error('Error getting alerts:', error);
            return {};
        }
    }
};

module.exports = db;