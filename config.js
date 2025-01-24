require('dotenv').config();

module.exports = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    JUPITER_API_URL: 'https://price.jup.ag/v4/price',
    RPC_ENDPOINT: 'https://api.mainnet-beta.solana.com'
};