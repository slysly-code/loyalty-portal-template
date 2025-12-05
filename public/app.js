// Loyalty Portal - Configurable Version
document.addEventListener('DOMContentLoaded', async function() {
    const loginSection = document.getElementById('loginSection');
    const dashboard = document.getElementById('dashboard');
    const loginBtn = document.getElementById('loginBtn');
    const memberInput = document.getElementById('emailInput');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const householdDialog = document.getElementById('householdDialog');

    let currentMember = null;
    let currentView = 'individual';
    let groupOwner = null;
    let groupMembers = [];
    let pendingDashboardData = null;
    let allTiers = [];
    let config = null;

    // Load configuration
    try {
        config = await loyaltyAPI.loadConfig();
        applyBranding(config.branding);
    } catch (e) {
        console.error('Failed to load config:', e);
    }

    // Apply branding from config
    function applyBranding(branding) {
        if (!branding) return;
        
        // Update page title
        document.title = `${branding.programTitle} - ${branding.companyName}`;
        
        // Update company name in logo
        const logoText = document.querySelector('.logo-text');
        if (logoText) logoText.textContent = branding.companyName;
        
        // Update CSS variables for colors
        if (branding.primaryColor) {
            document.documentElement.style.setProperty('--primary-color', branding.primaryColor);
        }
        if (branding.secondaryColor) {
            document.documentElement.style.setProperty('--secondary-color', branding.secondaryColor);
        }
    }

    // Get translated text
    function t(key) {
        const translations = {
            de: {
                enterMemberId: 'Bitte geben Sie Ihre Mitgliedsnummer ein.',
                noMemberFound: 'Kein Mitglied gefunden.',
                error: 'Fehler',
                loading: 'Laden...',
                login: 'Anmelden',
                member: 'Mitglied',
                standard: 'Standard',
                householdAccount: 'Haushalts-Konto',
                myAccount: 'Mein Konto',
                householdOverview: 'Haushalts-Übersicht',
                total: 'Gesamt',
                points: 'Punkte',
                pointsAvailable: 'Punkte verfügbar',
                pointsTo: 'Punkte bis',
                highestTier: 'Höchste Stufe erreicht! 🎉',
                welcome: 'Willkommen!',
                collectPoints: 'Sammeln Sie Punkte für exklusive Prämien.',
                noPromotions: 'Keine aktiven Aktionen',
                checkBackSoon: 'Schauen Sie bald wieder vorbei!',
                enrolled: 'Angemeldet',
                enrollNow: 'Jetzt anmelden',
                enrollmentClosed: 'Anmeldung nicht möglich',
                autoActive: 'Automatisch aktiv',
                enrollSuccess: 'Erfolgreich angemeldet!',
                enrollFailed: 'Anmeldung fehlgeschlagen',
                partOfHousehold: 'Teil des Haushalts',
                showHousehold: 'Haushalt anzeigen',
                promotionsError: 'Aktionen konnten nicht geladen werden.'
            },
            en: {
                enterMemberId: 'Please enter your membership number.',
                noMemberFound: 'No member found.',
                error: 'Error',
                loading: 'Loading...',
                login: 'Login',
                member: 'Member',
                standard: 'Standard',
                householdAccount: 'Household Account',
                myAccount: 'My Account',
                householdOverview: 'Household Overview',
                total: 'Total',
                points: 'Points',
                pointsAvailable: 'Points available',
                pointsTo: 'Points to',
                highestTier: 'Highest tier reached! 🎉',
                welcome: 'Welcome!',
                collectPoints: 'Collect points for exclusive rewards.',
                noPromotions: 'No active promotions',
                checkBackSoon: 'Check back soon!',
                enrolled: 'Enrolled',
                enrollNow: 'Enroll now',
                enrollmentClosed: 'Enrollment closed',
                autoActive: 'Automatically active',
                enrollSuccess: 'Successfully enrolled!',
                enrollFailed: 'Enrollment failed',
                partOfHousehold: 'Part of household',
                showHousehold: 'Show household',
                promotionsError: 'Could not load promotions.'
            }
        };
        const lang = config?.language || 'de';
        return translations[lang]?.[key] || translations.de[key] || key;
    }

    loginBtn.addEventListener('click', () => loadMemberData(memberInput.value.trim()));
    memberInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') loginBtn.click(); });

    async function loadMemberData(input) {
        if (!input) { alert(t('enterMemberId')); return; }
        showLoading(true);
        
        try {
            const member = await loyaltyAPI.getMemberByNumber(input);
            if (!member) { alert(t('noMemberFound')); showLoading(false); return; }

            currentMember = member;
            const [pointsData, tierData, vouchersData] = await Promise.all([
                loyaltyAPI.getMemberPoints(member.Id),
                loyaltyAPI.getMemberTier(member.Id),
                loyaltyAPI.getMemberVouchers(member.Id)
            ]);

            if (member.MemberType === 'Group') {
                groupOwner = member;
                groupMembers = await loyaltyAPI.getGroupMembers(member.Id);
                currentView = 'group';
                showDashboard(member, pointsData, tierData, vouchersData);
            } else {
                const groupRel = await loyaltyAPI.getGroupOwnerForMember(member.Id);
                if (groupRel) {
                    groupOwner = {
                        Id: groupRel.LoyaltyProgramGroupMemberId,
                        MembershipNumber: groupRel.LoyaltyProgramGroupMember.MembershipNumber,
                        Contact: { Name: groupRel.LoyaltyProgramGroupMember.Contact?.Name }
                    };
                    groupMembers = await loyaltyAPI.getGroupMembers(groupRel.LoyaltyProgramGroupMemberId);
                    pendingDashboardData = { member, pointsData, tierData, vouchersData };
                    showHouseholdDialog();
                } else {
                    groupOwner = null;
                    groupMembers = [];
                    currentView = 'individual';
                    showDashboard(member, pointsData, tierData, vouchersData);
                }
            }
        } catch (error) {
            console.error('Error:', error);
            alert(t('error') + ': ' + error.message);
        } finally {
            showLoading(false);
        }
    }

    async function showHouseholdDialog() {
        const dialogContracts = document.getElementById('dialogContracts');
        const memberIds = groupMembers.map(gm => gm.RelatedLoyaltyProgramMemberId);
        const pointsMap = await loyaltyAPI.getPointsForMembers(memberIds);
        
        // Demo mode: auto-unenroll for repeatable demos
        if (config?.demo?.enabled && config.demo.autoUnenrollMemberId && config.demo.autoUnenrollPromotionId) {
            try {
                await loyaltyAPI.unenrollFromPromotion(config.demo.autoUnenrollMemberId, config.demo.autoUnenrollPromotionId);
                console.log('Demo reset: unenrolled member from promotion');
            } catch (e) { console.log('Unenroll skipped:', e.message); }
        }
        
        const currencyName = loyaltyAPI.getNonQualifyingCurrencyName();
        
        const contractsHtml = groupMembers.map(gm => {
            const m = gm.RelatedLoyaltyProgramMember || {};
            const name = m.Contact?.Name || 'Contract';
            const memberPoints = pointsMap[gm.RelatedLoyaltyProgramMemberId] || { nonQualifyingPoints: 0 };
            const isCurrentMember = m.MembershipNumber === currentMember.MembershipNumber;
            
            return `<div class="dialog-contract-item ${isCurrentMember ? 'current' : ''}">
                <span class="contract-icon">📄</span>
                <div class="contract-info"><span class="contract-name">${name}</span><span class="contract-number">${m.MembershipNumber}</span></div>
                <span class="contract-points">${formatNumber(memberPoints.nonQualifyingPoints)} ${currencyName}</span>
            </div>`;
        }).join('');
        
        const totalPoints = Object.values(pointsMap).reduce((sum, p) => sum + (p.nonQualifyingPoints || 0), 0);
        dialogContracts.innerHTML = contractsHtml + `<div class="dialog-total"><strong>${t('total')}: ${formatNumber(totalPoints)} ${currencyName}</strong></div>`;
        householdDialog.style.display = 'flex';
    }

    window.closeHouseholdDialog = function(accepted) {
        if (accepted) {
            householdDialog.querySelector('.dialog-card').innerHTML = `<div class="dialog-success"><div class="success-icon">✅</div><h3>Household created!</h3><p>Your contracts have been linked.</p></div>`;
            setTimeout(() => {
                householdDialog.style.display = 'none';
                resetDialogHTML();
                currentView = 'group';
                if (pendingDashboardData) showDashboard(pendingDashboardData.member, pendingDashboardData.pointsData, pendingDashboardData.tierData, pendingDashboardData.vouchersData);
            }, 2000);
        } else {
            householdDialog.style.display = 'none';
            currentView = 'individual';
            if (pendingDashboardData) showDashboard(pendingDashboardData.member, pendingDashboardData.pointsData, pendingDashboardData.tierData, pendingDashboardData.vouchersData);
        }
    };

    function resetDialogHTML() {
        householdDialog.querySelector('.dialog-card').innerHTML = `
            <div class="dialog-icon">🏠</div><h2>Household Found</h2>
            <p>We found other contracts with the same contact. Would you like to link them?</p>
            <div class="dialog-contracts" id="dialogContracts"></div>
            <div class="dialog-benefits"><h4>Benefits:</h4><ul><li>✓ Pool points together</li><li>✓ Reach rewards faster</li><li>✓ Overview of all contracts</li></ul></div>
            <div class="dialog-actions"><button class="btn-secondary" onclick="closeHouseholdDialog(false)">No, thanks</button><button class="btn-primary" onclick="closeHouseholdDialog(true)">Yes, link</button></div>`;
    }

    async function switchToGroupView() {
        if (!groupOwner) return;
        showLoading(true);
        try {
            const member = await loyaltyAPI.getMemberByNumber(groupOwner.MembershipNumber);
            const [pointsData, tierData, vouchersData] = await Promise.all([
                loyaltyAPI.getMemberPoints(groupOwner.Id), loyaltyAPI.getMemberTier(groupOwner.Id), loyaltyAPI.getMemberVouchers(groupOwner.Id)
            ]);
            currentView = 'group';
            showDashboard(member || groupOwner, pointsData, tierData, vouchersData);
        } catch (error) { console.error('Error:', error); }
        finally { showLoading(false); }
    }

    async function switchToIndividualView(membershipNumber) {
        showLoading(true);
        try {
            const member = await loyaltyAPI.getMemberByNumber(membershipNumber);
            if (!member) return;
            currentMember = member;
            const [pointsData, tierData, vouchersData] = await Promise.all([
                loyaltyAPI.getMemberPoints(member.Id), loyaltyAPI.getMemberTier(member.Id), loyaltyAPI.getMemberVouchers(member.Id)
            ]);
            currentView = 'individual';
            showDashboard(member, pointsData, tierData, vouchersData);
        } catch (error) { console.error('Error:', error); }
        finally { showLoading(false); }
    }

    async function showDashboard(member, pointsData, tierData, vouchersData) {
        loginSection.style.display = 'none';
        dashboard.style.display = 'block';

        const name = member.Contact?.Name || t('member');
        const tierName = tierData?.LoyaltyTier?.Name || t('standard');
        const nonQualifyingPoints = pointsData.nonQualifyingPoints || 0;
        const qualifyingPoints = pointsData.qualifyingPoints || 0;
        const isGroup = member.MemberType === 'Group';
        const currencyName = loyaltyAPI.getNonQualifyingCurrencyName();

        // Load all tiers from Salesforce if we have tier group info
        if (tierData?.LoyaltyTier?.LoyaltyTierGroupId && allTiers.length === 0) {
            allTiers = await loyaltyAPI.getAllTiers(tierData.LoyaltyTier.LoyaltyTierGroupId);
        }

        document.getElementById('memberName').textContent = name;
        document.getElementById('tierBadge').textContent = (currentView === 'group') ? t('householdAccount') : tierName + ' ' + t('member');
        document.getElementById('memberIdDisplay').textContent = member.MembershipNumber || '';
        document.getElementById('tierStatus').textContent = tierName;
        document.getElementById('pointsBalance').textContent = formatNumber(nonQualifyingPoints);
        document.getElementById('pointsLabel').textContent = currencyName + ' ' + t('pointsAvailable');
        updateTierProgress(tierData, qualifyingPoints);
        renderViewToggle(member, isGroup);

        if (currentView === 'group' && groupMembers.length > 0) renderGroupMembersWithPoints();
        else renderIndividualHousehold(member);
        renderVouchers(vouchersData);
        await renderPromotions(member);
    }

    function renderViewToggle(member, isGroup) {
        const householdSection = document.querySelector('.household-section h2');
        const existingToggle = document.getElementById('viewToggle');
        if (existingToggle) existingToggle.remove();

        if (groupOwner || isGroup) {
            householdSection.insertAdjacentHTML('afterend', `
                <div id="viewToggle" class="view-toggle">
                    <button class="toggle-btn ${currentView === 'individual' ? 'active' : ''}" onclick="window.switchView('individual')" ${isGroup ? 'disabled' : ''}>${t('myAccount')}</button>
                    <button class="toggle-btn ${currentView === 'group' ? 'active' : ''}" onclick="window.switchView('group')">${t('householdOverview')}</button>
                </div>`);
        }
    }

    window.switchView = async function(view) { view === 'group' ? await switchToGroupView() : currentMember && await switchToIndividualView(currentMember.MembershipNumber); };
    window.selectMember = async function(membershipNumber) { await switchToIndividualView(membershipNumber); };

    async function renderGroupMembersWithPoints() {
        const grid = document.getElementById('householdGrid');
        const memberIds = groupMembers.map(gm => gm.RelatedLoyaltyProgramMemberId);
        const programId = loyaltyAPI.getProgramId();
        const currencyName = loyaltyAPI.getNonQualifyingCurrencyName();
        
        const [pointsMap, enrollmentMap, allPromotions] = await Promise.all([
            loyaltyAPI.getPointsForMembers(memberIds),
            loyaltyAPI.getEnrolledPromotionsForMembers(memberIds),
            loyaltyAPI.getAvailablePromotions(programId)
        ]);
        
        const totalPoints = Object.values(pointsMap).reduce((sum, p) => sum + (p.nonQualifyingPoints || 0), 0);
        const enrollmentRequiredPromos = allPromotions.filter(p => p.IsEnrollmentRequired);
        
        document.getElementById('householdMembers').textContent = groupMembers.length;

        let html = `<div class="group-summary"><span class="group-total">${t('total')}: <strong>${formatNumber(totalPoints)} ${currencyName}</strong></span></div>`;
        html += groupMembers.map(gm => {
            const m = gm.RelatedLoyaltyProgramMember || {};
            const memberId = gm.RelatedLoyaltyProgramMemberId;
            const name = m.Contact?.Name || t('member');
            const memberPoints = pointsMap[memberId] || { nonQualifyingPoints: 0 };
            const enrolledPromos = enrollmentMap[memberId] || [];
            const enrolledIds = enrolledPromos.map(ep => ep.id);
            
            // Build promotion badges
            let promoHtml = '';
            if (enrollmentRequiredPromos.length > 0) {
                const enrolled = enrolledPromos.map(ep => `<span class="promo-badge enrolled">✓ ${ep.name}</span>`).join('');
                const notEnrolled = enrollmentRequiredPromos
                    .filter(p => !enrolledIds.includes(p.Id))
                    .map(p => `<span class="promo-badge not-enrolled" onclick="event.stopPropagation(); window.enrollMemberInPromotion('${m.MembershipNumber}', '${p.Name}')">+ ${p.Name}</span>`)
                    .join('');
                promoHtml = enrolled + notEnrolled;
            }
            
            return `<div class="household-member clickable" onclick="window.selectMember('${m.MembershipNumber}')">
                <div class="member-avatar">${getInitials(name)}</div>
                <div class="member-info">
                    <span class="member-name">${name} <span style="color: #999; font-weight: normal;">(${m.MembershipNumber})</span></span>
                    <span class="member-role">${m.MembershipNumber} ${promoHtml}</span>
                </div>
                <span class="member-points">${formatNumber(memberPoints.nonQualifyingPoints)} ${currencyName}</span>
            </div>`;
        }).join('');
        grid.innerHTML = html;
    }

    window.enrollMemberInPromotion = async function(membershipNumber, promotionName) {
        showLoading(true);
        try {
            await loyaltyAPI.enrollInPromotion(null, membershipNumber, promotionName);
            alert(`${membershipNumber}: ${t('enrollSuccess')}`);
            await renderGroupMembersWithPoints();
        } catch (error) {
            console.error('Enrollment error:', error);
            alert(t('enrollFailed') + ': ' + error.message);
        } finally {
            showLoading(false);
        }
    };

    function renderIndividualHousehold(member) {
        const grid = document.getElementById('householdGrid');
        const name = member.Contact?.Name || t('member');
        document.getElementById('householdMembers').textContent = groupMembers.length || '1';

        if (groupOwner && groupMembers.length > 0) {
            grid.innerHTML = `<div class="household-member"><div class="member-avatar">${getInitials(name)}</div><div class="member-info"><span class="member-name">${name}</span><span class="member-role">${member.MembershipNumber}</span></div></div>
            <div class="group-info-banner"><span>🏠 ${t('partOfHousehold')} "${groupOwner.Contact?.Name || groupOwner.MembershipNumber}"</span><button class="btn-secondary" onclick="window.switchView('group')">${t('showHousehold')}</button></div>`;
        } else {
            grid.innerHTML = `<div class="household-member"><div class="member-avatar">${getInitials(name)}</div><div class="member-info"><span class="member-name">${name}</span><span class="member-role">${member.MembershipNumber}</span></div></div>`;
        }
    }

    function updateTierProgress(tierData, points) {
        const progress = document.getElementById('tierProgress');
        const pointsToNextEl = document.getElementById('pointsToNext');
        
        const currentSequence = tierData?.LoyaltyTier?.SequenceNumber || 1;
        const currentMin = tierData?.LoyaltyTier?.MinimumEligibleBalance || 0;
        const currentMax = tierData?.LoyaltyTier?.MaximumEligibleBalance;
        
        const nextTier = allTiers.find(t => t.SequenceNumber === currentSequence + 1);
        
        let progressPercent = 100;
        if (currentMax && currentMax > currentMin) {
            progressPercent = Math.min(100, ((points - currentMin) / (currentMax - currentMin)) * 100);
        }
        progress.style.width = progressPercent + '%';
        
        if (nextTier) {
            const pointsNeeded = Math.max(0, Math.ceil(nextTier.MinimumEligibleBalance - points));
            pointsToNextEl.parentElement.innerHTML = `<span id="pointsToNext">${formatNumber(pointsNeeded)}</span> ${t('pointsTo')} ${nextTier.Name}`;
        } else {
            pointsToNextEl.parentElement.innerHTML = t('highestTier');
        }
    }

    function renderVouchers(vouchers) {
        const grid = document.getElementById('rewardsGrid');
        if (!vouchers.length) { 
            grid.innerHTML = `<div class="reward-card"><div class="reward-image">🎁</div><div class="reward-content"><h3>${t('welcome')}</h3><p>${t('collectPoints')}</p></div></div>`; 
            return; 
        }
        grid.innerHTML = vouchers.map(v => `<div class="reward-card"><div class="reward-image">🎫</div><div class="reward-content"><h3>${v.VoucherDefinition?.Name || 'Voucher'}</h3><p>${v.VoucherDefinition?.Description || ''}</p><div class="reward-footer"><span class="voucher-code">${v.VoucherCode || ''}</span><span class="reward-status">${v.Status}</span></div></div></div>`).join('');
    }

    async function renderPromotions(member) {
        const grid = document.getElementById('promotionsGrid');
        if (!grid) return;
        
        try {
            const programId = loyaltyAPI.getProgramId();
            const [allPromotions, enrolledPromotions] = await Promise.all([
                loyaltyAPI.getAvailablePromotions(programId),
                loyaltyAPI.getMemberEnrolledPromotions(member.Id)
            ]);
            
            const enrolledIds = enrolledPromotions.map(ep => ep.PromotionId);
            const today = new Date().toISOString().split('T')[0];
            
            if (!allPromotions.length) {
                grid.innerHTML = `<div class="promo-card"><div class="promo-icon">📢</div><div class="promo-content"><h3>${t('noPromotions')}</h3><p>${t('checkBackSoon')}</p></div></div>`;
                return;
            }
            
            grid.innerHTML = allPromotions.map(promo => {
                const isEnrolled = enrolledIds.includes(promo.Id);
                const needsEnrollment = promo.IsEnrollmentRequired;
                const enrollmentOpen = promo.EnrollmentStartDate <= today && (!promo.EnrollmentEndDate || promo.EnrollmentEndDate >= today);
                
                let statusHtml = '';
                let actionHtml = '';
                
                if (isEnrolled) {
                    statusHtml = `<span class="promo-status enrolled">✓ ${t('enrolled')}</span>`;
                } else if (needsEnrollment && enrollmentOpen) {
                    actionHtml = `<button class="btn-primary btn-small" onclick="window.enrollInPromotion('${promo.Name}')">${t('enrollNow')}</button>`;
                } else if (needsEnrollment && !enrollmentOpen) {
                    statusHtml = `<span class="promo-status">${t('enrollmentClosed')}</span>`;
                } else {
                    statusHtml = `<span class="promo-status active">${t('autoActive')}</span>`;
                }
                
                const dateRange = promo.StartDate ? `${formatDate(promo.StartDate)}${promo.EndDate ? ' - ' + formatDate(promo.EndDate) : ''}` : '';
                
                return `<div class="promo-card ${isEnrolled ? 'enrolled' : ''}">
                    <div class="promo-icon">🎯</div>
                    <div class="promo-content">
                        <h3>${promo.Name}</h3>
                        <p>${promo.Description || ''}</p>
                        ${dateRange ? `<span class="promo-dates">${dateRange}</span>` : ''}
                        <div class="promo-footer">${statusHtml}${actionHtml}</div>
                    </div>
                </div>`;
            }).join('');
        } catch (error) {
            console.error('Error loading promotions:', error);
            grid.innerHTML = `<div class="promo-card"><div class="promo-icon">⚠️</div><div class="promo-content"><h3>${t('error')}</h3><p>${t('promotionsError')}</p></div></div>`;
        }
    }

    window.enrollInPromotion = async function(promotionName) {
        if (!currentMember) return;
        showLoading(true);
        
        try {
            await loyaltyAPI.enrollInPromotion(null, currentMember.MembershipNumber, promotionName);
            alert(t('enrollSuccess'));
            await renderPromotions(currentMember);
        } catch (error) {
            console.error('Enrollment error:', error);
            alert(t('enrollFailed') + ': ' + error.message);
        } finally {
            showLoading(false);
        }
    };

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const lang = config?.language || 'de';
        return d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function formatNumber(n) { 
        const lang = config?.language || 'de';
        return Math.round(n || 0).toLocaleString(lang === 'de' ? 'de-DE' : 'en-US'); 
    }
    function getInitials(name) { return name ? name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase() : '??'; }
    function showLoading(show) { 
        loadingOverlay.style.display = show ? 'flex' : 'none'; 
        loginBtn.disabled = show; 
        loginBtn.textContent = show ? t('loading') : t('login'); 
    }
});
