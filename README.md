# Salesforce Loyalty Portal Template

A configurable, ready-to-deploy loyalty program member portal that integrates with Salesforce Loyalty Management.

## Features

- Member login and dashboard
- Points balance display (supports multiple currency types: qualifying vs non-qualifying)
- Tier status with dynamic progress to next tier
- Household/Group member management
- **Promotion eligibility** - shows only promotions the member is eligible for
- Promotion enrollment
- Voucher display
- Responsive design
- Vercel deployment ready

## Prerequisites

1. **Salesforce Org** with Loyalty Management enabled
2. **Connected App** in Salesforce with OAuth 2.0 Client Credentials Flow
3. **Loyalty Program Process** for eligible promotions (see below)
4. **Node.js** 18+ installed locally
5. **Vercel CLI** (optional): `npm i -g vercel`

## Quick Start

### 1. Create a Salesforce Connected App

1. Setup → App Manager → New Connected App
2. Enable OAuth Settings
3. Callback URL: `https://localhost`
4. OAuth Scopes: `api`, `refresh_token`, `offline_access`
5. Enable Client Credentials Flow
6. Run As: Select user with Loyalty data access
7. Save and note Consumer Key and Consumer Secret

### 2. Create Required Loyalty Program Processes

**Important:** Two processes are required for full functionality.

#### Process 1: Enroll (for promotion enrollment)

1. Setup → Loyalty Program Processes → New
2. Select template: **"Enroll in Promotions"**
3. Name: `Enroll` (must match exactly)
4. Associate with your Loyalty Program
5. Activate the Process Rule inside the process
6. Activate the process

See: https://help.salesforce.com/s/articleView?id=xcloud.bapi_task_enroll_for_promotions_process_template.htm

#### Process 2: GetEligiblePromotions (for showing eligible promotions)

1. Setup → Loyalty Program Processes → New
2. Select template: **"Get Member Promotions"**
3. Name: `GetEligiblePromotions` (or configure in config.js)
4. Associate with your Loyalty Program
5. Configure output parameters:
   - `promotionName` (Text, Variable)
   - `memberEligibilityCategory` (Text, Variable)
6. Activate the Process Rule inside the process
7. Activate the process

See: https://help.salesforce.com/s/articleView?id=xcloud.bapi_task_get_member_promotions_process_template.htm

### 3. Configure the Portal

Copy `config.example.js` to `config.js` and fill in your values:

```javascript
module.exports = {
    salesforce: {
        domain: 'your-org.my.salesforce.com',
        clientId: 'YOUR_CONSUMER_KEY',
        clientSecret: 'YOUR_CONSUMER_SECRET',
        apiVersion: 'v65.0'
    },
    loyalty: {
        programName: '',  // Auto-detected or specify
        eligiblePromotionsProcess: 'GetEligiblePromotions'  // Your process name
    },
    branding: {
        companyName: 'My Company',
        primaryColor: '#0066CC'
    },
    language: 'de'  // or 'en'
};
```

### 4. Run Locally

```bash
npm install
npm start
```

Open http://localhost:8000

### 5. Deploy to Vercel

```bash
vercel env add SF_DOMAIN
vercel env add SF_CLIENT_ID  
vercel env add SF_CLIENT_SECRET
vercel --prod
```

## Configuration Reference

### Salesforce Settings

| Setting | Description |
|---------|-------------|
| `domain` | Your Salesforce My Domain (without https://) |
| `clientId` | Connected App Consumer Key |
| `clientSecret` | Connected App Consumer Secret |
| `apiVersion` | Salesforce API version (default: v65.0) |

### Loyalty Settings

| Setting | Description |
|---------|-------------|
| `programName` | Loyalty program name (auto-detected if empty) |
| `programId` | Loyalty program ID (auto-detected if empty) |
| `currencies.qualifying` | Name of tier-qualifying currency |
| `currencies.nonQualifying` | Name of spendable currency |
| `eligiblePromotionsProcess` | Name of your Get Member Promotions process |

### Auto-Detection

The portal can auto-detect many values from your Salesforce org:

| Setting | Auto-Detection Method |
|---------|----------------------|
| Program Name/ID | From first member login |
| Currency Names | From `LoyaltyProgramCurrency.IsQualifyingCurrency` |
| Tier Thresholds | From `LoyaltyTier` objects |
| Promotions | From `GetEligiblePromotions` process |

### Currency Types

Loyalty programs often have two types of points:

1. **Qualifying** - Determines tier status (Bronze → Silver → Gold)
2. **Non-Qualifying** - Spendable on rewards

The portal automatically separates these based on `IsQualifyingCurrency` flag or explicit configuration.

## API Endpoints Used

### SOQL Queries (REST API)
- `LoyaltyProgramMember` - Member lookup
- `LoyaltyMemberCurrency` - Points balances
- `LoyaltyMemberTier` - Current tier
- `LoyaltyTier` - Tier definitions
- `LoyaltyPgmGroupMbrRlnsp` - Household relationships
- `Voucher` - Member vouchers
- `Promotion` - Available promotions
- `LoyaltyProgramMbrPromotion` - Enrollment status

### Connect API (Program Processes)
- `POST /connect/loyalty/programs/{program}/program-processes/GetEligiblePromotions` - Get eligible promotions
- `POST /connect/loyalty/programs/{program}/program-processes/Enroll` - Promotion enrollment

## File Structure

```
loyalty-portal-template/
├── api/
│   └── index.js          # Vercel serverless function (proxy)
├── public/
│   ├── index.html        # Main HTML
│   ├── styles.css        # Styles (CSS variables for theming)
│   ├── app.js            # Main application logic
│   └── loyalty-api.js    # Salesforce API service
├── config.example.js     # Configuration template
├── config.js             # Your configuration (git-ignored)
├── server.js             # Local development server
├── package.json
├── vercel.json           # Vercel deployment config
├── LEARNINGS.md          # API learnings and gotchas
└── README.md
```

## Troubleshooting

### "No member found"
- Verify the membership number exists in Salesforce
- Check the Connected App user has access to Loyalty objects

### "Failed to get promotions"
- Verify the `GetEligiblePromotions` process exists and is active
- Check the process rule inside is also activated
- Verify process name in config matches exactly

### Points not showing
- Verify `LoyaltyMemberCurrency` records exist for the member
- Check currency names match your configuration

### Promotions showing wrong eligibility
- Ensure you're using `getMemberEligiblePromotions` API (not just querying all promotions)
- Check the Loyalty Program Process is configured correctly

## License

MIT License - Feel free to use and modify for your projects.
