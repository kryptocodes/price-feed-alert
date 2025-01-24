const { Telegraf } = require('telegraf');
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');

// Initialize bot and connection
const bot = new Telegraf(process.env.BOT_TOKEN || require('./config').TELEGRAM_BOT_TOKEN);
const connection = new Connection('https://api.mainnet-beta.solana.com');

// State management
const userStates = new Map();
const alertSubscriptions = new Map();
const TOKEN_LIST_URL = 'https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json';
let tokenMetadata = new Map();

// Menu configuration
const MAIN_MENU_BUTTONS = [
    [{ text: '💼 Check Wallet', callback_data: 'check_wallet' }],
    [{ text: '📊 Active Alerts', callback_data: 'view_alerts' }],
    [{ text: '❌ Clear Alerts', callback_data: 'clear_alerts' }],
    [{ text: '❓ Help', callback_data: 'help' }]
];

// Price APIs
async function getSOLPrice() {
    try {
        const response = await axios.get('https://price.jup.ag/v4/price?ids=SOL');
        return response.data.data.SOL.price;
    } catch (error) {
        console.error('SOL price error:', error);
        return null;
    }
}

async function getTokenPrice(mintAddress) {
    try {
        const response = await axios.get(`https://public-api.birdeye.so/public/price?address=${mintAddress}`);
        return response.data.data?.value || null;
    } catch (error) {
        console.error('Token price error:', error);
        return null;
    }
}

// Alert management
async function setupPriceAlert(userId, token, percentage, ctx) {
    const getPrice = token.symbol === 'SOL' ? getSOLPrice : () => getTokenPrice(token.mint);
    const initialPrice = await getPrice();
    
    if (!initialPrice) {
        ctx.reply(`❌ Could not get initial price for ${token.symbol}`);
        return;
    }

    const initialValue = initialPrice * token.balance;
    const alertKey = `${userId}_${token.mint}`;

    const interval = setInterval(async () => {
        try {
            const currentPrice = await getPrice();
            if (!currentPrice) return;

            const currentValue = currentPrice * token.balance;
            const change = ((currentValue - initialValue) / initialValue) * 100;

            if (Math.abs(change) >= percentage) {
                ctx.reply(
                    `🚨 *${token.symbol} Alert!*\n` +
                    `*Change:* ${change.toFixed(2)}%\n` +
                    `*Current Price:* $${currentPrice.toFixed(4)}\n` +
                    `*Initial Value:* $${initialValue.toFixed(2)}`,
                    { parse_mode: 'Markdown' }
                );
                clearInterval(interval);
                alertSubscriptions.delete(alertKey);
            }
        } catch (error) {
            console.error('Alert check error:', error);
        }
    }, 30000);

    alertSubscriptions.set(alertKey, { interval, token, percentage, initialValue });
}

// Token list initialization
async function initializeTokenList() {
    try {
        const response = await axios.get(TOKEN_LIST_URL);
        response.data.tokens.forEach(token => {
            tokenMetadata.set(token.address, {
                name: token.name,
                symbol: token.symbol,
                decimals: token.decimals
            });
        });
        console.log('Loaded token metadata for', tokenMetadata.size, 'tokens');
    } catch (error) {
        console.error('Failed to load token list:', error);
    }
}

// Wallet token fetching
async function getWalletTokens(walletAddress) {
    try {
        const [solBalance, tokenAccounts] = await Promise.all([
            connection.getBalance(walletAddress),
            connection.getParsedTokenAccountsByOwner(walletAddress, {
                programId: TOKEN_PROGRAM_ID
            })
        ]);

        const tokens = tokenAccounts.value
            .filter(account => {
                const amount = account.account.data.parsed.info.tokenAmount;
                return amount.uiAmount > 0;
            })
            .map(account => {
                const info = account.account.data.parsed.info;
                const meta = tokenMetadata.get(info.mint) || {
                    name: `Unknown (${info.mint.slice(0, 4)}...)`,
                    symbol: info.mint.slice(0, 4)
                };
                
                return {
                    mint: info.mint,
                    name: meta.name,
                    symbol: meta.symbol.toUpperCase(),
                    balance: info.tokenAmount.uiAmount,
                    decimals: info.tokenAmount.decimals
                };
            });

        // Add SOL as first token
        tokens.unshift({
            mint: 'SOL',
            name: 'Solana',
            symbol: 'SOL',
            balance: solBalance / 1e9,
            decimals: 9
        });

        return tokens;
    } catch (error) {
        console.error('Wallet token error:', error);
        return [];
    }
}

// Command handlers
bot.start(ctx => ctx.reply(
    'Welcome to Solana Portfolio Tracker! 🚀\n' +
    'Send your Solana wallet address to start tracking your tokens!'
));

bot.help(ctx => ctx.reply(
    '📖 *How to Use:*\n' +
    '1. Send your Solana wallet address\n' +
    '2. Select a token from your portfolio\n' +
    '3. Set percentage change threshold (e.g., 10 for 10%)\n' +
    '4. Get alerts every 30 seconds!\n' +
    '\nCommands:\n' +
    '/menu - Show main menu\n' +
    '/alerts - View active alerts\n' +
    '/clear - Remove all alerts',
    { parse_mode: 'Markdown' }
));

bot.command('menu', (ctx) => {
    ctx.reply('🌟 Main Menu:', {
        reply_markup: {
            inline_keyboard: MAIN_MENU_BUTTONS
        }
    });
});

bot.command('alerts', ctx => {
    const userId = ctx.from.id;
    const alerts = Array.from(alertSubscriptions.entries())
        .filter(([key]) => key.startsWith(`${userId}_`))
        .map(([_, alert]) => 
            `▸ ${alert.token.symbol}: ${alert.percentage}% (${alert.initialValue.toFixed(2)} USD)`
        );

    ctx.reply(alerts.length > 0 
        ? `🔔 Active Alerts:\n\n${alerts.join('\n')}`
        : 'No active alerts ⚠️'
    );
});

bot.command('clear', ctx => {
    const userId = ctx.from.id;
    Array.from(alertSubscriptions.keys())
        .filter(key => key.startsWith(`${userId}_`))
        .forEach(key => {
            clearInterval(alertSubscriptions.get(key).interval);
            alertSubscriptions.delete(key);
        });
    ctx.reply('All alerts cleared ✅');
});

// Callback handlers
bot.action('check_wallet', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('Please send your Solana wallet address 🏦');
});

bot.action('view_alerts', async (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.from.id;
    const alerts = Array.from(alertSubscriptions.entries())
        .filter(([key]) => key.startsWith(`${userId}_`))
        .map(([_, alert]) => 
            `▸ ${alert.token.symbol}: ${alert.percentage}% (${alert.initialValue.toFixed(2)} USD)`
        );
    
    ctx.reply(alerts.length > 0 
        ? `🔔 Active Alerts:\n\n${alerts.join('\n')}`
        : 'No active alerts ⚠️', {
        reply_markup: {
            inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]]
        }
    });
});

bot.action('clear_alerts', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.from.id;
    Array.from(alertSubscriptions.keys())
        .filter(key => key.startsWith(`${userId}_`))
        .forEach(key => {
            clearInterval(alertSubscriptions.get(key).interval);
            alertSubscriptions.delete(key);
        });
    ctx.reply('All alerts cleared ✅');
});

bot.action('back_to_menu', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('🌟 Main Menu:', {
        reply_markup: {
            inline_keyboard: MAIN_MENU_BUTTONS
        }
    });
});

bot.action('back_to_tokens', async (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.from.id;
    const state = userStates.get(userId);
    
    if (state && state.tokens) {
        const tokenList = state.tokens.map(t => 
            `▸ ${t.symbol} - ${t.balance.toFixed(2)} (${t.name})`
        ).join('\n');
    
        ctx.reply(
            `📋 *Wallet Contents:*\n\n${tokenList}\n\n` +
            'Reply with the token symbol you want to track:',
            { 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]]
                }
            }
        );
    } else {
        ctx.reply('Please start over by sending your wallet address or use /menu');
    }
});

// Message handler
bot.on('text', async ctx => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const state = userStates.get(userId) || {};

    try {
        if (!state.state) {
            try {
                const pubKey = new PublicKey(text);
                const tokens = await getWalletTokens(pubKey);
                
                if (tokens.length === 0) {
                    return ctx.reply('No tokens found in this wallet ⚠️');
                }

                userStates.set(userId, {
                    wallet: text,
                    tokens,
                    state: 'awaiting_token'
                });

                const tokenList = tokens.map(t => 
                    `▸ ${t.symbol} - ${t.balance.toFixed(2)} (${t.name})`
                ).join('\n');
                
                return ctx.reply(
                    `📋 *Wallet Contents:*\n\n${tokenList}\n\n` +
                    'Reply with the token symbol you want to track:',
                    { 
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]]
                        }
                    }
                );
            } catch (error) {
                return ctx.reply('⚠️ Invalid Solana address. Please send a valid wallet address.');
            }
        }

        if (state.state === 'awaiting_token') {
            const token = state.tokens.find(t => 
                t.symbol.toLowerCase() === text.toLowerCase()
            );

            if (token) {
                userStates.set(userId, {
                    ...state,
                    state: 'awaiting_threshold',
                    selectedToken: token
                });
                return ctx.reply(
                    `Set price change percentage for ${token.symbol} (e.g., 10):`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔙 Back to Token List', callback_data: 'back_to_tokens' }],
                                [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
                            ]
                        }
                    }
                );
            }
            return ctx.reply('Invalid token symbol. Please choose from the list above.');
        }

        if (state.state === 'awaiting_threshold') {
            const percentage = parseFloat(text);
            
            if (!isNaN(percentage) && percentage > 0) {
                setupPriceAlert(userId, state.selectedToken, percentage, ctx);
                userStates.delete(userId);
                return ctx.reply(`✅ Alert set for ${state.selectedToken.symbol}!`);
            }
            return ctx.reply('Please enter a valid positive number (e.g., 5 for 5%)');
        }
    } catch (error) {
        console.error('Message handling error:', error);
        ctx.reply('⚠️ An error occurred. Please try again.');
    }
});

// Initialize and start
(async () => {
    await initializeTokenList();
    await db.connect();
    await bot.launch();
    console.log('Bot started successfully!');
})();

process.once('SIGINT', async() => {
    await db.disconnect();
    bot.stop('SIGINT')
});
process.once('SIGTERM', async() => {
    await db.disconnect();
    bot.stop('SIGTERM')
});