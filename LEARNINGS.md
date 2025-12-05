# Salesforce Loyalty Management API - Learnings

This document contains key learnings from implementing a Loyalty Portal with Salesforce Loyalty Management APIs.

## API Endpoints

### Promotion Enrollment

**Documented endpoint (DOES NOT WORK):**
```
POST /services/data/v65.0/connect/loyalty/programs/{programName}/enroll-in-promotion
```

**Working endpoint:**
```
POST /services/data/v65.0/connect/loyalty/programs/{programName}/program-processes/Enroll
```

**Request body:**
```json
{
  "processParameters": [
    {
      "MembershipNumber": "E-001",
      "PromotionName": "DoubleTrouble"
    }
  ]
}
```

### Key Objects and Fields

#### LoyaltyTier
- `MinimumEligibleBalance` - Minimum points to qualify for tier
- `MaximumEligibleBalance` - Maximum points before next tier
- `SequenceNumber` - Order of tiers (1=lowest, 2, 3, etc.)
- `LoyaltyTierGroupId` - Links tiers to a tier group

#### LoyaltyProgramCurrency
- `IsQualifyingCurrency` - Boolean indicating if currency affects tier status
- Use this to distinguish qualifying (tier) vs non-qualifying (spendable) points

#### LoyaltyMemberCurrency
- `PointsBalance` - Current balance
- `LoyaltyProgramCurrency.Name` - Name of the currency type

#### LoyaltyPgmGroupMbrRlnsp (Group Member Relationship)
- Object name is abbreviated
- `LoyaltyProgramGroupMemberId` - The group owner
- `RelatedLoyaltyProgramMemberId` - Individual members in the group
- `MemberPointContributionPercent` - How much each member contributes

## SOQL Query Examples

### Get member with program info
```sql
SELECT Id, MembershipNumber, MemberStatus, MemberType, 
       ContactId, Contact.Name, Contact.Email, 
       ProgramId, Program.Name 
FROM LoyaltyProgramMember 
WHERE MembershipNumber = 'E-001'
```

### Get points with currency type
```sql
SELECT Id, PointsBalance, 
       LoyaltyProgramCurrency.Name, 
       LoyaltyProgramCurrency.IsQualifyingCurrency 
FROM LoyaltyMemberCurrency 
WHERE LoyaltyMemberId = '{memberId}'
```

### Get tier info with thresholds
```sql
SELECT Id, LoyaltyTierId, 
       LoyaltyTier.Name, 
       LoyaltyTier.SequenceNumber, 
       LoyaltyTier.MinimumEligibleBalance, 
       LoyaltyTier.MaximumEligibleBalance, 
       LoyaltyTier.LoyaltyTierGroupId 
FROM LoyaltyMemberTier 
WHERE LoyaltyMemberId = '{memberId}'
```

### Get all tiers for a tier group
```sql
SELECT Id, Name, SequenceNumber, 
       MinimumEligibleBalance, MaximumEligibleBalance 
FROM LoyaltyTier 
WHERE LoyaltyTierGroupId = '{tierGroupId}' 
ORDER BY SequenceNumber
```

### Get group members
```sql
SELECT Id, RelatedLoyaltyProgramMemberId, 
       RelatedLoyaltyProgramMember.MembershipNumber, 
       RelatedLoyaltyProgramMember.Contact.Name, 
       MemberPointContributionPercent 
FROM LoyaltyPgmGroupMbrRlnsp 
WHERE LoyaltyProgramGroupMemberId = '{groupMemberId}'
```

### Get promotions for a program
```sql
SELECT Id, Name, Description, StartDate, EndDate, 
       IsActive, IsEnrollmentRequired, 
       EnrollmentStartDate, EnrollmentEndDate 
FROM Promotion 
WHERE LoyaltyProgramId = '{programId}' AND IsActive = true
```

### Get member enrolled promotions
```sql
SELECT Id, PromotionId, Promotion.Name, IsEnrollmentActive 
FROM LoyaltyProgramMbrPromotion 
WHERE LoyaltyProgramMemberId = '{memberId}'
```

## Authentication

### OAuth 2.0 Client Credentials Flow

1. Create a Connected App in Salesforce
2. Enable "Enable Client Credentials Flow"
3. Set a "Run As" user with Loyalty permissions
4. Use Consumer Key and Secret for authentication

**Token endpoint:**
```
POST https://{domain}/services/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id={key}&client_secret={secret}
```

## Common Issues

### 404 on Enrollment
- Use `/program-processes/Enroll` not `/enroll-in-promotion`
- Program name must be URL-encoded

### No Points Showing
- Check LoyaltyMemberCurrency records exist
- Currency names are case-sensitive

### Tier Not Updating
- Tier calculation may be based on "qualifying" currency only
- Check `IsQualifyingCurrency` on currency type

### Group Members Not Found
- Use `LoyaltyPgmGroupMbrRlnsp` (abbreviated name)
- Query by `LoyaltyProgramGroupMemberId` for group owner

## API Versioning

Use API version 65.0 or higher for full Loyalty Connect API support:
```
/services/data/v65.0/connect/loyalty/...
```
