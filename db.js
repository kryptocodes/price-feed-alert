const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.json');

// Initialize DB if it doesn't exist
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({
        users: {},
        alerts: {}
    }));
}

const db = {
    read: () => {
        try {
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        } catch (error) {
            console.error('Error reading DB:', error);
            return { users: {}, alerts: {} };
        }
    },

    write: (data) => {
        try {
            fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('Error writing DB:', error);
            return false;
        }
    },

    saveUser: (userId, data) => {
        const dbData = db.read();
        dbData.users[userId] = data;
        return db.write(dbData);
    },

    getUser: (userId) => {
        const dbData = db.read();
        return dbData.users[userId];
    },

    saveAlert: (alertKey, data) => {
        const dbData = db.read();
        dbData.alerts[alertKey] = data;
        return db.write(dbData);
    },

    deleteAlert: (alertKey) => {
        const dbData = db.read();
        delete dbData.alerts[alertKey];
        return db.write(dbData);
    },

    getAlerts: (userId) => {
        const dbData = db.read();
        return Object.entries(dbData.alerts)
            .filter(([key]) => key.startsWith(`${userId}_`))
            .reduce((acc, [key, value]) => {
                acc[key] = value;
                return acc;
            }, {});
    }
};

module.exports = db;