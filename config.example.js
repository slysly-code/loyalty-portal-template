// Configuration Template for Loyalty Portal
// Copy this file to config.js and fill in your values

module.exports = {
    // Salesforce Connection
    salesforce: {
        domain: 'YOUR_ORG.my.salesforce.com',  // Without https://
        clientId: 'YOUR_CONSUMER_KEY',
        clientSecret: 'YOUR_CONSUMER_SECRET',
        apiVersion: 'v65.0'
    },
    
    // Loyalty Program Configuration
    loyalty: {
        // Leave empty to auto-detect from first member login
        programName: '',
        programId: '',
        
        // Currency names - must match your Salesforce setup
        // Set to null to auto-detect, or specify exact names
        currencies: {
            // Qualifying currency - determines tier status
            qualifying: null,      // e.g., 'Tier Points', 'Status Points'
            // Non-qualifying currency - spendable rewards
            nonQualifying: null    // e.g., 'Reward Points', 'Bonus Points'
        },
        
        // Name of the Loyalty Program Process for getting eligible promotions
        // Must be created in Salesforce using "Get Member Promotions" template
        // See README.md for setup instructions
        eligiblePromotionsProcess: 'GetEligiblePromotions'
    },
    
    // Portal Branding
    branding: {
        companyName: 'My Company',
        programTitle: 'Loyalty Program',
        primaryColor: '#0066CC',
        secondaryColor: '#004499',
        logo: null  // Path to logo or null for text logo
    },
    
    // Language: 'de' (German) or 'en' (English)
    language: 'de',
    
    // Demo Mode - for testing and demonstrations
    demo: {
        enabled: false,
        // Auto-unenroll a member from a promotion when household dialog shows
        // Useful for repeatable demos
        autoUnenrollMemberId: null,
        autoUnenrollPromotionId: null
    }
};
