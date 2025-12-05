# Salesforce Loyalty Portal Template

A configurable, ready-to-deploy loyalty program member portal that integrates with Salesforce Loyalty Management.

## Features

- Member login and dashboard
- Points balance display (supports multiple currency types)
- Tier status with progress to next tier
- Household/Group member management
- Promotion enrollment
- Voucher display
- Responsive design
- Vercel deployment ready

## Prerequisites

1. **Salesforce Org** with Loyalty Management enabled
2. **Connected App** in Salesforce with OAuth 2.0 Client Credentials Flow
3. **Node.js** 18+ installed locally
4. **Vercel CLI** (optional): `npm i -g vercel`

## Quick Start

### 1. Create a Salesforce Connected App

1. Setup > App Manager > New Connected App
2. Enable OAuth Settings
3. Callback URL: `https://localhost`
4. OAuth Scopes: `api`, `refresh_token`, `offline_access`
5. Enable Client Credentials Flow
6. Run As: Select user with Loyalty data access
7. Save and note Consumer Key and Consumer Secret

### 2. Configure the Portal

Copy `config.example.js` to `config.js` and fill in your values.

### 3. Run Locally

```bash
npm install
npm start
```

Open http://localhost:8000

### 4. Deploy to Vercel

```bash
vercel env add SF_DOMAIN
vercel env add SF_CLIENT_ID  
vercel env add SF_CLIENT_SECRET
vercel --prod
```

## Configuration

See `config.example.js` for all options. Key settings:

- **salesforce**: Domain, credentials, API version
- **loyalty**: Program name, currency names
- **branding**: Colors, company name, logo
- **language**: 'de' or 'en'

## License

MIT License
