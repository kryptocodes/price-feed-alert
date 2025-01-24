const { Telegraf } = require('telegraf');
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const config = require('./config');

const userStates = new Map();
const alertSubscriptions = new Map();

const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);
const connection = new Connection(config.RPC_ENDPOINT);

// Start command
bot.command('start', (ctx) => {
    ctx.reply('Welcome to Solana Portfolio Alert Bot! Please send your Solana wallet address to begin.');
});

// Handle wallet address
bot.on('text', async (ctx) => {
    const input = ctx.message.text;
    const userId = ctx.from.id;

    if (input.length === 44 || input.length === 43) { // Basic Solana address length check
        try {
            const walletAddress = new PublicKey(input);
            const tokens = await getWalletTokens(walletAddress);
            userStates.set(userId, { 
                wallet: input,
                tokens: tokens,
                state: 'selecting_token'
            });
            
            const tokenList = tokens.map(t => `${t.symbol}: ${t.balance}`).join('\n');
            ctx.reply(`Found these tokens in your wallet:\n${tokenList}\n\nPlease send the token symbol to set up price alerts.`);
        } catch (error) {
            ctx.reply('Invalid Solana wallet address. Please try again.');
        }
    } else if (userStates.get(userId)?.state === 'selecting_token') {
        const selectedToken = userStates.get(userId).tokens.find(
            t => t.symbol.toLowerCase() === input.toLowerCase()
        );
        
        if (selectedToken) {
            userStates.get(userId).state = 'setting_percentage';
            userStates.get(userId).selectedToken = selectedToken;
            ctx.reply('Please enter the percentage change for the alert (e.g., 5 for 5% change)');
        } else {
            ctx.reply('Token not found. Please select from the list above.');
        }
    } else if (userStates.get(userId)?.state === 'setting_percentage') {
        const percentage = parseFloat(input);
        if (!isNaN(percentage) && percentage > 0) {
            const userState = userStates.get(userId);
            setupPriceAlert(userId, userState.selectedToken, percentage, ctx);
            ctx.reply(`Alert set for ${userState.selectedToken.symbol} at ${percentage}% change!`);
        } else {
            ctx.reply('Please enter a valid positive number for the percentage.');
        }
    }
});

async function getWalletTokens(walletAddress) {
    // This is a simplified version. You'll need to implement proper token fetching
    // using the Solana connection
    return [
        { symbol: 'SOL', balance: 10 },
        { symbol: 'USDC', balance: 100 }
    ];
}

async function setupPriceAlert(userId, token, percentage, ctx) {
    // Implement price monitoring and alerts here
    // You can use Jupiter API to get price updates
    const currentPrice = await getCurrentPrice(token.symbol);
    
    alertSubscriptions.set(`${userId}-${token.symbol}`, {
        token,
        percentage,
        basePrice: currentPrice,
        chatId: ctx.chat.id
    });
}

async function getCurrentPrice(symbol) {
    try {
        const response = await axios.get(`${config.JUPITER_API_URL}?id=${symbol}`);
        return response.data.data.price;
    } catch (error) {
        console.error('Error fetching price:', error);
        return null;
    }
}

// Start price monitoring
setInterval(async () => {
    for (const [key, alert] of alertSubscriptions) {
        const currentPrice = await getCurrentPrice(alert.token.symbol);
        if (currentPrice) {
            const priceChange = ((currentPrice - alert.basePrice) / alert.basePrice) * 100;
            if (Math.abs(priceChange) >= alert.percentage) {
                bot.telegram.sendMessage(
                    alert.chatId,
                    `🚨 Alert: ${alert.token.symbol} price has changed by ${priceChange.toFixed(2)}%`
                );
                // Update base price after alert
                alert.basePrice = currentPrice;
            }
        }
    }
}, 60000); // Check every minute

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));