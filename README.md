# Solana Portfolio Alert Bot

A Telegram bot that tracks Solana wallet portfolios and sends price alerts for selected tokens based on percentage thresholds.

## Features

- 📱 Telegram interface for easy interaction
- 💰 Fetch token balances from Solana wallets
- 📊 Real-time price monitoring using Jupiter API
- 🚨 Customizable price alerts based on percentage changes
- ⚡ Support for multiple tokens and alerts

## Prerequisites

- Node.js (v18 or higher)
- npm
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- Solana RPC endpoint (default: mainnet-beta)

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd price-feed-alert

# Install dependencies:

npm install

# Create a .env file with the following variables:

```bash
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```


## Usage
1. Start a chat with your bot on Telegram
2. Send the /start command
3. Enter your Solana wallet address
4. Select a token from your portfolio
5. Enter the percentage threshold for price alerts
## Commands
- /start - Initialize the bot and begin wallet tracking
- More commands coming soon...
## Technical Stack
- Telegraf - Modern Telegram Bot Framework
- @solana/web3.js - Solana JavaScript API
- Jupiter API - Price feed data

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.
