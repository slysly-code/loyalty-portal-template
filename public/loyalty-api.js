// Salesforce Loyalty API Service - Configurable Version
class LoyaltyAPIService {
    constructor() {
        this.baseUrl = '/api';
        this.config = null;
        this.currencyNames = { qualifying: null, nonQualifying: null };
        this.programInfo = { id: null, name: null };
        this.processNames = { eligiblePromotions: 'GetEligiblePromotions' }; // Configurable process name
    }

    async loadConfig() {
        if (this.config) return this.config;
        const response = await fetch('/api/config');
        this.config = await response.json();
        
        // Set currency names from config if provided
        if (this.config.loyalty?.currencies?.qualifying) {
            this.currencyNames.qualifying = this.config.loyalty.currencies.qualifying;
        }
        if (this.config.loyalty?.currencies?.nonQualifying) {
            this.currencyNames.nonQualifying = this.config.loyalty.currencies.nonQualifying;
        }
        if (this.config.loyalty?.programId) {
            this.programInfo.id = this.config.loyalty.programId;
        }
        if (this.config.loyalty?.programName) {
            this.programInfo.name = this.config.loyalty.programName;
        }
        if (this.config.loyalty?.eligiblePromotionsProcess) {
            this.processNames.eligiblePromotions = this.config.loyalty.eligiblePromotionsProcess;
        }
        
        return this.config;
    }

    async query(soql) {
        const url = `${this.baseUrl}/query?q=${encodeURIComponent(soql)}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) throw new Error(data[0]?.message || data.message || 'API Error');
        return data;
    }

    // Auto-detect currency names from the first member's currencies
    async detectCurrencies(memberId) {
        if (this.currencyNames.qualifying && this.currencyNames.nonQualifying) return;
        
        const result = await this.query(
            `SELECT LoyaltyProgramCurrency.Name, LoyaltyProgramCurrency.IsQualifyingCurrency FROM LoyaltyMemberCurrency WHERE LoyaltyMemberId = '${memberId}'`
        );
        
        result.records?.forEach(r => {
            const name = r.LoyaltyProgramCurrency?.Name;
            const isQualifying = r.LoyaltyProgramCurrency?.IsQualifyingCurrency;
            if (isQualifying && !this.currencyNames.qualifying) {
                this.currencyNames.qualifying = name;
            } else if (!isQualifying && !this.currencyNames.nonQualifying) {
                this.currencyNames.nonQualifying = name;
            }
        });
        
        // If still not detected, use first currency as non-qualifying
        if (!this.currencyNames.nonQualifying && result.records?.length > 0) {
            this.currencyNames.nonQualifying = result.records[0]?.LoyaltyProgramCurrency?.Name;
        }
        
        console.log('Detected currencies:', this.currencyNames);
    }

    async getMemberByNumber(membershipNumber) {
        const result = await this.query(
            `SELECT Id, MembershipNumber, MemberStatus, MemberType, ContactId, Contact.Name, Contact.Email, ProgramId, Program.Name FROM LoyaltyProgramMember WHERE MembershipNumber = '${membershipNumber}'`
        );
        const member = result.records?.[0] || null;
        
        // Store program info for later use
        if (member) {
            if (!this.programInfo.id) this.programInfo.id = member.ProgramId;
            if (!this.programInfo.name) this.programInfo.name = member.Program?.Name;
            
            // Auto-detect currencies
            await this.detectCurrencies(member.Id);
        }
        
        return member;
    }

    async getMemberPoints(memberId) {
        const result = await this.query(
            `SELECT Id, PointsBalance, LoyaltyProgramCurrency.Name, LoyaltyProgramCurrency.IsQualifyingCurrency FROM LoyaltyMemberCurrency WHERE LoyaltyMemberId = '${memberId}'`
        );
        const records = result.records || [];
        
        // Find qualifying and non-qualifying points
        let qualifyingPoints = 0;
        let nonQualifyingPoints = 0;
        
        records.forEach(r => {
            const currencyName = r.LoyaltyProgramCurrency?.Name;
            const isQualifying = r.LoyaltyProgramCurrency?.IsQualifyingCurrency;
            
            // Match by name if configured, otherwise by IsQualifyingCurrency flag
            if (this.currencyNames.qualifying && currencyName === this.currencyNames.qualifying) {
                qualifyingPoints = r.PointsBalance || 0;
            } else if (this.currencyNames.nonQualifying && currencyName === this.currencyNames.nonQualifying) {
                nonQualifyingPoints = r.PointsBalance || 0;
            } else if (isQualifying) {
                qualifyingPoints = r.PointsBalance || 0;
            } else {
                nonQualifyingPoints = r.PointsBalance || 0;
            }
        });
        
        return { 
            qualifyingPoints, 
            nonQualifyingPoints, 
            records,
            qualifyingName: this.currencyNames.qualifying,
            nonQualifyingName: this.currencyNames.nonQualifying
        };
    }

    async getMemberTier(memberId) {
        const result = await this.query(
            `SELECT Id, LoyaltyTierId, LoyaltyTier.Name, LoyaltyTier.SequenceNumber, LoyaltyTier.MinimumEligibleBalance, LoyaltyTier.MaximumEligibleBalance, LoyaltyTier.LoyaltyTierGroupId, EffectiveDate, TierExpirationDate FROM LoyaltyMemberTier WHERE LoyaltyMemberId = '${memberId}'`
        );
        return result.records?.[0] || null;
    }

    async getAllTiers(tierGroupId) {
        const result = await this.query(
            `SELECT Id, Name, SequenceNumber, MinimumEligibleBalance, MaximumEligibleBalance FROM LoyaltyTier WHERE LoyaltyTierGroupId = '${tierGroupId}' ORDER BY SequenceNumber`
        );
        return result.records || [];
    }

    async getMemberVouchers(memberId) {
        const result = await this.query(
            `SELECT Id, VoucherCode, Status, VoucherDefinition.Name, VoucherDefinition.Description FROM Voucher WHERE LoyaltyProgramMemberId = '${memberId}' AND Status IN ('Issued', 'Active')`
        );
        return result.records || [];
    }

    async getGroupOwnerForMember(memberId) {
        const result = await this.query(
            `SELECT Id, LoyaltyProgramGroupMemberId, LoyaltyProgramGroupMember.MembershipNumber, LoyaltyProgramGroupMember.Contact.Name, MemberPointContributionPercent FROM LoyaltyPgmGroupMbrRlnsp WHERE RelatedLoyaltyProgramMemberId = '${memberId}'`
        );
        return result.records?.[0] || null;
    }

    async getGroupMembers(groupMemberId) {
        const result = await this.query(
            `SELECT Id, RelatedLoyaltyProgramMemberId, RelatedLoyaltyProgramMember.MembershipNumber, RelatedLoyaltyProgramMember.Contact.Name, RelatedLoyaltyProgramMember.MemberType, MemberRole, MemberPointContributionPercent FROM LoyaltyPgmGroupMbrRlnsp WHERE LoyaltyProgramGroupMemberId = '${groupMemberId}'`
        );
        return result.records || [];
    }

    async getPointsForMembers(memberIds) {
        if (!memberIds.length) return {};
        const idList = memberIds.map(id => `'${id}'`).join(',');
        const result = await this.query(
            `SELECT LoyaltyMemberId, PointsBalance, LoyaltyProgramCurrency.Name, LoyaltyProgramCurrency.IsQualifyingCurrency FROM LoyaltyMemberCurrency WHERE LoyaltyMemberId IN (${idList})`
        );
        
        const pointsMap = {};
        result.records?.forEach(r => {
            if (!pointsMap[r.LoyaltyMemberId]) {
                pointsMap[r.LoyaltyMemberId] = { qualifyingPoints: 0, nonQualifyingPoints: 0 };
            }
            
            const currencyName = r.LoyaltyProgramCurrency?.Name;
            const isQualifying = r.LoyaltyProgramCurrency?.IsQualifyingCurrency;
            
            if (this.currencyNames.qualifying && currencyName === this.currencyNames.qualifying) {
                pointsMap[r.LoyaltyMemberId].qualifyingPoints = r.PointsBalance || 0;
            } else if (this.currencyNames.nonQualifying && currencyName === this.currencyNames.nonQualifying) {
                pointsMap[r.LoyaltyMemberId].nonQualifyingPoints = r.PointsBalance || 0;
            } else if (isQualifying) {
                pointsMap[r.LoyaltyMemberId].qualifyingPoints = r.PointsBalance || 0;
            } else {
                pointsMap[r.LoyaltyMemberId].nonQualifyingPoints = r.PointsBalance || 0;
            }
        });
        
        return pointsMap;
    }

    async getAvailablePromotions(programId) {
        const pid = programId || this.programInfo.id;
        if (!pid) return [];
        
        const result = await this.query(
            `SELECT Id, Name, Description, StartDate, EndDate, IsActive, IsEnrollmentRequired, EnrollmentStartDate, EnrollmentEndDate FROM Promotion WHERE LoyaltyProgramId = '${pid}' AND IsActive = true`
        );
        return result.records || [];
    }

    async getMemberEligiblePromotions(programName, membershipNumber) {
        const pName = programName || this.programInfo.name;
        const processName = this.processNames.eligiblePromotions;
        
        const url = `${this.baseUrl}/connect/loyalty/programs/${encodeURIComponent(pName)}/program-processes/${encodeURIComponent(processName)}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                processParameters: [{
                    MembershipNumber: membershipNumber
                }]
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data[0]?.message || data.message || 'Failed to get promotions');
        return data.outputParameters?.outputParameters?.results || [];
    }

    async getMemberEnrolledPromotions(memberId) {
        const result = await this.query(
            `SELECT Id, PromotionId, Promotion.Name, Promotion.Description, IsEnrollmentActive FROM LoyaltyProgramMbrPromotion WHERE LoyaltyProgramMemberId = '${memberId}'`
        );
        return result.records || [];
    }

    async enrollInPromotion(programName, membershipNumber, promotionName) {
        const pName = programName || this.programInfo.name;
        const url = `${this.baseUrl}/connect/loyalty/programs/${encodeURIComponent(pName)}/program-processes/Enroll`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                processParameters: [{
                    MembershipNumber: membershipNumber,
                    PromotionName: promotionName
                }]
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data[0]?.message || data.message || 'Enrollment failed');
        return data;
    }

    async unenrollFromPromotion(memberId, promotionId) {
        const result = await this.query(
            `SELECT Id FROM LoyaltyProgramMbrPromotion WHERE LoyaltyProgramMemberId = '${memberId}' AND PromotionId = '${promotionId}'`
        );
        if (result.records?.length > 0) {
            const enrollmentId = result.records[0].Id;
            const url = `${this.baseUrl}/sobjects/LoyaltyProgramMbrPromotion/${enrollmentId}`;
            const response = await fetch(url, { method: 'DELETE' });
            if (!response.ok && response.status !== 204) {
                throw new Error('Unenroll failed');
            }
        }
    }

    // Get program name (auto-detected or configured)
    getProgramName() {
        return this.programInfo.name;
    }

    // Get program ID (auto-detected or configured)
    getProgramId() {
        return this.programInfo.id;
    }

    // Get currency display name
    getNonQualifyingCurrencyName() {
        return this.currencyNames.nonQualifying || 'Points';
    }
}

const loyaltyAPI = new LoyaltyAPIService();
