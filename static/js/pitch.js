// --- GLOBAL APPLICATION STATE ---
let allPlayers = [];    
let mySquad = [];         
let startingXI = [];       
let captainName = null;     
let selectedForSwap = null; 

// --- FPL RULES & CONSTRAINTS ---
const totalSquadCaps = { 'GK': 2, 'DEF': 5, 'MID': 5, 'FWD': 3 };

// --- PREMIER LEAGUE TEAMS LOOKUP ---
const teamNamesFull = {
    "ARS": "Arsenal", "AVL": "Aston Villa", "BOU": "Bournemouth", "BRE": "Brentford",
    "BHA": "Brighton", "CHE": "Chelsea", "COV": "Coventry", "CRY": "Crystal Palace",
    "EVE": "Everton", "FUL": "Fulham", "HUL": "Hull City", "IPS": "Ipswich",
    "LEE": "Leeds Utd", "LIV": "Liverpool", "MCI": "Man City", "MUN": "Man Utd",
    "NEW": "Newcastle", "NFO": "Nott'm Forest", "SUN": "Sunderland", "TOT": "Tottenham"
};

// --- TEAM BADGE & SHIRT COLOR PALETTES ---
const teamStyles = {
    "ARS": { bg: "#EF0107", text: "#FFFFFF" }, "AVL": { bg: "#670e36", text: "#FFFFFF" },
    "BOU": { bg: "#DA291C", text: "#FFFFFF" }, "BRE": { bg: "#E30613", text: "#FFFFFF" },
    "BHA": { bg: "#0057B8", text: "#FFFFFF" }, "CHE": { bg: "#034694", text: "#FFFFFF" },
    "COV": { bg: "#059DD9", text: "#FFFFFF" }, "CRY": { bg: "#1B458F", text: "#FFFFFF" },
    "EVE": { bg: "#004E98", text: "#FFFFFF" }, "FUL": { bg: "#000000", text: "#FFFFFF" },
    "HUL": { bg: "#F18A01", text: "#FFFFFF" }, "IPS": { bg: "#3a64a3", text: "#FFFFFF" },
    "LEE": { bg: "#1D428A", text: "#FFFFFF" }, "LIV": { bg: "#C8102E", text: "#FFFFFF" },
    "MCI": { bg: "#6CABDD", text: "#0F172A" }, "MUN": { bg: "#DA291C", text: "#FFFFFF" },
    "NEW": { bg: "#241F20", text: "#FFFFFF" }, "NFO": { bg: "#DD0000", text: "#FFFFFF" },
    "SUN": { bg: "#DC0714", text: "#FFFFFF" }, "TOT": { bg: "#132257", text: "#FFFFFF" },
    "DEFAULT": { bg: "#1E293B", text: "#FFFFFF" }
};

// --- STATISTICAL METRIC UNIT LABELS ---
const statLabels = {
    'selected_by_percent': '% Owned', 'gw_points': 'Pts', 'goals_scored': 'Goals',
    'assists': 'Assists', 'expected_goals': 'xG', 'expected_assists': 'xA',
    'expected_goal_involvements': 'xGI', 'expected_goals_conceded': 'xGC',
    'form': 'Form', 'bonus': 'Bonus Pts', 'bps': 'BPS', 'ict_index': 'ICT',
    'influence': 'Inf', 'creativity': 'Crea', 'threat': 'Thr', 'minutes': 'Mins',
    'clean_sheets': 'CS', 'saves': 'Saves'
};

/**
 * 1. INITIALIZE DASHBOARD DATA
 */
async function init() {
    try {
        console.log("🚀 Initializing FPL Insights HQ Engine...");
        const r = await fetch('/api/players');
        allPlayers = await r.json();
        populateTeamFilter();
        updateUI();
    } catch (e) { 
        console.error("Data Acquisition Error:", e); 
    }
}

/**
 * 2. POPULATE TEAM FILTER DROPDOWN
 */
function populateTeamFilter() {
    const teamFilter = document.getElementById('team-filter');
    if (!teamFilter) return;
    teamFilter.innerHTML = '<option value="All">All Teams</option>'; 
    Object.keys(teamNamesFull).sort().forEach(code => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.innerText = teamNamesFull[code]; 
        teamFilter.appendChild(opt);
    });
}

/**
 * 3. CREATE PLAYER ROW FOR LEFT SELECTION PANEL
 */
function createPlayerRow(p, selectedStat) {
    const d = document.createElement('div');
    d.className = "bg-purple-950/60 p-3 rounded-lg flex justify-between items-center cursor-pointer hover:bg-purple-900/80 border border-purple-800/60 mb-2 transition-all";
    const teamCode = String(p.team_label || 'TBC').trim().toUpperCase();
    const style = teamStyles[teamCode] || teamStyles["DEFAULT"];

    let statusBadge = '';
    if (p.chance_next_round === 0 || p.status === 'i' || p.status === 's') {
        statusBadge = `<span class="bg-red-900/80 text-red-200 text-[9px] font-black px-1.5 py-0.5 rounded border border-red-600" title="${p.news || 'Ruled Out'}">🚑 OUT</span>`;
    } else if (p.chance_next_round < 100) {
        statusBadge = `<span class="bg-amber-500/20 text-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded border border-amber-500/30" title="${p.news || 'Doubtful'}">⚠️ ${p.chance_next_round}%</span>`;
    }

    let setPieceTag = '';
    if (p.is_pen_taker) setPieceTag += '⚽';
    if (p.is_fk_taker) setPieceTag += '🎯';
    if (p.is_corner_taker) setPieceTag += '🚩';

    const statValue = p[selectedStat] !== undefined ? p[selectedStat] : 0;
    const statUnit = statLabels[selectedStat] || '';
    const greenStatDisplay = `• ${statValue} ${statUnit}`;

    d.innerHTML = `
        <div class="flex flex-col gap-1">
            <div class="flex items-center gap-1.5">
                <span class="text-sm font-bold text-white">${p.name}</span>
                ${statusBadge}
                <span class="text-[10px]">${setPieceTag}</span>
            </div>
            <div class="flex items-center gap-2">
                <span style="background-color: ${style.bg} !important; color: ${style.text} !important; font-weight: 900; font-size: 9px; padding: 2px 6px; border-radius: 4px;">
                    ${teamCode}
                </span>
                <span class="text-[10px] text-purple-300 font-medium uppercase">• £${p.display_price || 4.5}m</span>
                <span class="text-[10px] text-emerald-400 font-bold">${greenStatDisplay}</span>
            </div>
        </div>
        <span class="text-emerald-400 font-black text-lg pr-1">+</span>
    `;
    return d;
}

/**
 * 4. ADD PLAYER TO SQUAD & STARTING XI
 */
function addToSquad(p) {
    if (mySquad.find(x => x.name === p.name)) return;
    
    const teamCount = mySquad.filter(x => x.team_label === p.team_label).length;
    if (teamCount >= 3) {
        alert(`Cannot add ${p.name}. Maximum 3 players per club allowed!`);
        return;
    }
    
    const currentPositionCount = mySquad.filter(x => x.pos_label === p.pos_label).length;
    if (currentPositionCount >= totalSquadCaps[p.pos_label]) {
        alert(`Cannot add ${p.name}. Position cap reached for ${p.pos_label}.`);
        return;
    }
    if (mySquad.length >= 15) return;
    
    mySquad.push(p);

    if (startingXI.length < 11 && canAddToXI(p, startingXI)) { 
        startingXI.push(p); 
    }
    updateUI();
}

/**
 * 5. VALIDATE STARTING XI FORMATION CAPACITY
 */
function canAddToXI(newPlayer, currentXI) {
    if (currentXI.length >= 11) return false; 
    if (currentXI.find(x => x.name === newPlayer.name)) return false; 
    
    if (newPlayer.pos_label === 'GK') {
        return currentXI.filter(x => x.pos_label === 'GK').length < 1;
    }

    const currentDef = currentXI.filter(x => x.pos_label === 'DEF').length;
    const currentMid = currentXI.filter(x => x.pos_label === 'MID').length;
    const currentFwd = currentXI.filter(x => x.pos_label === 'FWD').length;

    if (newPlayer.pos_label === 'DEF' && currentDef >= 5) return false;
    if (newPlayer.pos_label === 'MID' && currentMid >= 5) return false;
    if (newPlayer.pos_label === 'FWD' && currentFwd >= 3) return false;

    return true;
}

/**
 * 6. EXECUTE PLAYER SWAP BETWEEN STARTING XI AND BENCH
 */
function executeSwap(playerA_Name, playerB_Name) {
    const pA = mySquad.find(x => x.name === playerA_Name);
    const pB = mySquad.find(x => x.name === playerB_Name);

    if (!pA || !pB) return;

    const inXI_A = startingXI.some(x => x.name === pA.name);
    const inXI_B = startingXI.some(x => x.name === pB.name);

    if (inXI_A && !inXI_B) {
        let tempXI = startingXI.filter(x => x.name !== pA.name);
        if (isValidXIWithAddition(tempXI, pB)) {
            startingXI = tempXI;
            startingXI.push(pB);
        } else {
            alert(`Invalid Formation! Must maintain 1 GK, 3-5 DEFs, 2-5 MIDs, and 1-3 FWDs.`);
        }
    } else if (!inXI_A && inXI_B) {
        let tempXI = startingXI.filter(x => x.name !== pB.name);
        if (isValidXIWithAddition(tempXI, pA)) {
            startingXI = tempXI;
            startingXI.push(pA);
        } else {
            alert(`Invalid Formation! Must maintain 1 GK, 3-5 DEFs, 2-5 MIDs, and 1-3 FWDs.`);
        }
    }

    selectedForSwap = null;
    updateUI();
}

/**
 * 7. FORMATION COMPLIANCE CHECK
 */
function isValidXIWithAddition(tempXI, candidate) {
    const testXI = [...tempXI, candidate];
    if (testXI.length > 11) return false;

    const gk = testXI.filter(x => x.pos_label === 'GK').length;
    const def = testXI.filter(x => x.pos_label === 'DEF').length;
    const mid = testXI.filter(x => x.pos_label === 'MID').length;
    const fwd = testXI.filter(x => x.pos_label === 'FWD').length;

    if (gk > 1) return false;
    if (def > 5) return false;
    if (mid > 5) return false;
    if (fwd > 3) return false;

    return true;
}

/**
 * 8. REMOVE PLAYER FROM ROSTER
 */
function removeFromSquad(name) {
    mySquad = mySquad.filter(x => x.name !== name);
    startingXI = startingXI.filter(x => x.name !== name);
    if (captainName === name) captainName = null;
    if (selectedForSwap === name) selectedForSwap = null;
    updateUI();
}

/**
 * 9. TOGGLE CAPTAIN ROLE
 */
function toggleCaptain(name) {
    captainName = (captainName === name) ? null : name;
    updateUI();
}

/**
 * 10. RESET ENTIRE SQUAD
 */
function resetSquad() {
    if (mySquad.length === 0) return;
    if (confirm("Are you sure you want to reset your entire squad?")) {
        mySquad = [];
        startingXI = [];
        captainName = null;
        selectedForSwap = null;
        updateUI();
    }
}

/**
 * 11. MAIN UI RENDERING ENGINE (PAGE 1)
 */
function updateUI() {
    // A. FILTER & RENDER LEFT PANEL SELECTION LIST
    const searchElem = document.getElementById('player-search');
    const posElem = document.getElementById('pos-filter');
    const teamElem = document.getElementById('team-filter');
    const priceElem = document.getElementById('price-filter');
    const statElem = document.getElementById('stat-filter');
    const sList = document.getElementById('scout-list');

    const sSearch = searchElem ? searchElem.value.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ø/g, "o").replace(/æ/g, "ae") : "";
    const sPos = posElem ? posElem.value : "All";
    const sTeam = teamElem ? teamElem.value : "All";
    const maxPrice = priceElem ? parseFloat(priceElem.value || 20.0) : 20.0;
    const selectedStat = statElem ? statElem.value : 'selected_by_percent';

    if (sList) {
        sList.innerHTML = '';
        const filtered = allPlayers.filter(x => {
            const cleanFullName = String(x.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ø/g, "o").replace(/æ/g, "ae");
            const cleanWebName = String(x.web_name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ø/g, "o").replace(/æ/g, "ae");
            const matchesSearch = cleanFullName.includes(sSearch) || cleanWebName.includes(sSearch);
            const matchesPos = (sPos === 'All' || x.pos_label === sPos);
            const matchesTeam = (sTeam === 'All' || x.team_label === sTeam);
            const matchesPrice = ((x.display_price || 4.5) <= maxPrice);
            const notInSquad = !mySquad.find(m => m.name === x.name);
            return matchesSearch && matchesPos && matchesTeam && matchesPrice && notInSquad;
        }).sort((a, b) => (b[selectedStat] || 0) - (a[selectedStat] || 0));

        filtered.slice(0, 30).forEach(p => {
            const row = createPlayerRow(p, selectedStat);
            row.onclick = () => addToSquad(p);
            sList.appendChild(row);
        });
    }

    // B. RENDER SELECTED ROSTER TABLE
    const tBody = document.getElementById('squad-table-body');
    if (tBody) {
        tBody.innerHTML = '';
        mySquad.forEach(p => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-purple-950 hover:bg-purple-950/20";
            const isCap = captainName === p.name;
            const inXI = startingXI.some(x => x.name === p.name);
            
            const capBtnStyle = isCap 
                ? "bg-amber-400 text-black font-black border-2 border-black shadow-[0_0_8px_#fbbf24]" 
                : "bg-purple-900/60 text-purple-300 border border-purple-700/60 hover:border-amber-400 hover:text-amber-400";

            tr.innerHTML = `
                <td class="py-2.5 pr-2 font-medium">
                    <span class="text-white text-xs block truncate max-w-[130px]">${p.name}</span>
                    <span class="text-[9px] ${inXI ? 'text-emerald-400 font-bold' : 'text-purple-400'}">[${inXI ? 'XI' : 'SUB'}] • £${p.display_price || 4.5}m</span>
                </td>
                <td class="text-right flex items-center justify-end gap-1.5 py-2.5 pr-1">
                    <button class="w-6 h-6 rounded-full text-[10px] flex items-center justify-center transition-all ${capBtnStyle}" title="${isCap ? 'Unassign Captain' : 'Make Captain'}" onclick="toggleCaptain('${p.name}')">
                        C
                    </button>
                    <button class="w-6 h-6 rounded-full bg-red-900/40 hover:bg-red-600 text-red-300 hover:text-white border border-red-700/60 text-xs font-black flex items-center justify-center transition-all" title="Remove Player" onclick="removeFromSquad('${p.name}')">
                        ✕
                    </button>
                </td>
            `;
            tBody.appendChild(tr);
        });
    }

    // C. RENDER PITCH AND BENCH CARDS
    const pDiv = document.getElementById('pitch');
    const bDiv = document.getElementById('bench');
    if (pDiv && bDiv) {
        pDiv.innerHTML = ''; bDiv.innerHTML = '';
        
        ['GK', 'DEF', 'MID', 'FWD'].forEach(pos => {
            const row = document.createElement('div');
            row.className = "pos-row";
            
            const posPlayers = startingXI.filter(x => x.pos_label === pos);
            posPlayers.forEach(x => {
                const card = createCard(x, false);
                row.appendChild(card);
            });

            pDiv.appendChild(row);
        });

        // RENDER BENCH CARDS
        const benchPlayers = mySquad.filter(x => !startingXI.some(s => s.name === x.name));
        benchPlayers.forEach(x => {
            const card = createCard(x, false);
            bDiv.appendChild(card);
        });
    }

    // D. CALCULATE REMAINING BUDGET AND EXPECTED POINTS
    const totalSpent = mySquad.reduce((s, x) => s + (x.display_price || 0), 0);
    const remainingBudget = 100.0 - totalSpent;

    const costElem = document.getElementById('total-cost');
    const errorElem = document.getElementById('budget-error');

    if (costElem) {
        if (remainingBudget < 0) {
            const absValue = Math.abs(remainingBudget).toFixed(1);
            costElem.innerText = `-£${absValue}m`;
            costElem.className = "text-2xl font-black text-red-500";
            if (errorElem) errorElem.classList.remove('hidden');
        } else {
            costElem.innerText = `£${remainingBudget.toFixed(1)}m`;
            costElem.className = "text-2xl font-black text-white";
            if (errorElem) errorElem.classList.add('hidden');
        }
    }

    let totalPts = 0;
    startingXI.forEach(p => { 
        const pPts = parseFloat(p.predicted || 0);
        totalPts += (captainName === p.name) ? (pPts * 2) : pPts; 
    });
    
    if (document.getElementById('xi-pts')) {
        document.getElementById('xi-pts').innerText = `${totalPts.toFixed(1)} Pts`;
    }
}

/**
 * 12. CREATE PITCH CARD
 */
function createCard(p, isLarge = false) {
    const d = document.createElement('div');
    d.className = isLarge ? "player-card-lg rounded-xl" : "player-card-ui rounded-md";
    
    if (!isLarge) {
        d.setAttribute("draggable", "true");
    }
    
    const teamCode = String(p.team_label || 'TBC').trim().toUpperCase();
    const style = teamStyles[teamCode] || teamStyles["DEFAULT"];
    
    d.style.setProperty('background-color', style.bg, 'important');
    d.style.setProperty('color', style.text, 'important');
    d.style.setProperty('display', 'flex', 'important');
    d.style.setProperty('flex-direction', 'column', 'important');
    d.style.setProperty('align-items', 'center', 'important');
    d.style.setProperty('justify-content', 'center', 'important');
    d.style.setProperty('padding', isLarge ? '8px' : '6px', 'important');
    d.style.setProperty('position', 'relative', 'important');

    if (!isLarge && selectedForSwap === p.name) {
        d.style.setProperty('border', '3px solid #00ff85', 'important');
        d.style.setProperty('box-shadow', '0 0 12px #00ff85', 'important');
    }

    if (!isLarge) {
        d.ondragstart = () => {
            selectedForSwap = p.name;
            d.style.opacity = '0.5';
        };

        d.ondragend = () => {
            d.style.opacity = '1.0';
        };

        d.ondragover = (e) => e.preventDefault();

        d.ondrop = (e) => {
            e.preventDefault();
            if (selectedForSwap && selectedForSwap !== p.name) {
                executeSwap(selectedForSwap, p.name);
            }
        };

        d.onclick = () => {
            if (!selectedForSwap) {
                selectedForSwap = p.name;
                updateUI();
            } else if (selectedForSwap === p.name) {
                selectedForSwap = null;
                updateUI();
            } else {
                executeSwap(selectedForSwap, p.name);
            }
        };
    }

    const displayWebName = p.web_name || p.name;
    const badgeSize = isLarge ? '22px' : '20px';
    const badgeFont = isLarge ? '11px' : '10px';

    const capBadge = (captainName === p.name) ? `
        <div style="position: absolute !important; top: -8px !important; right: -8px !important; background-color: #fbbf24 !important; color: #000000 !important; width: ${badgeSize} !important; height: ${badgeSize} !important; border-radius: 9999px !important; border: 2px solid #000000 !important; display: flex !important; align-items: center !important; justify-content: center !important; font-size: ${badgeFont} !important; font-weight: 900 !important; z-index: 50 !important;">C</div>
    ` : '';
    
    let warningBadge = '';
    if (p.chance_next_round === 0 || p.status === 'i' || p.status === 's') {
        warningBadge = `
            <div style="position: absolute !important; top: -8px !important; left: -8px !important; background-color: #dc2626 !important; color: #ffffff !important; width: 18px !important; height: 18px !important; border-radius: 9999px !important; display: flex !important; align-items: center !important; justify-content: center !important; font-size: 9px !important; font-weight: 900 !important; z-index: 50 !important; border: 1.5px solid #991b1b !important;" title="${p.news || 'Ruled Out'}">✕</div>
        `;
    } else if (p.chance_next_round < 100) {
        warningBadge = `
            <div style="position: absolute !important; top: -8px !important; left: -8px !important; background-color: #f59e0b !important; color: #000000 !important; width: 18px !important; height: 18px !important; border-radius: 9999px !important; display: flex !important; align-items: center !important; justify-content: center !important; font-size: 9px !important; font-weight: 900 !important; z-index: 50 !important; border: 1.5px solid #b45309 !important;" title="${p.news || 'Doubtful'}">!</div>
        `;
    }

    const nameFontSize = isLarge ? '12px' : '11px';
    const teamFontSize = isLarge ? '10px' : '9px';

    d.innerHTML = `
        ${capBadge}
        ${warningBadge}
        <div style="width: 100% !important; text-align: center !important; font-size: ${nameFontSize} !important; font-weight: 900 !important; text-transform: uppercase !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; color: ${style.text} !important; line-height: 1.2 !important;">${displayWebName}</div>
        <div style="width: 65% !important; height: 1px !important; background-color: ${style.text} !important; opacity: 0.25 !important; margin: ${isLarge ? '8px' : '6px'} auto !important;"></div>
        <div style="width: 100% !important; text-align: center !important; font-size: ${teamFontSize} !important; font-weight: 700 !important; text-transform: uppercase !important; color: ${style.text} !important; opacity: 0.85 !important; line-height: 1 !important;">${teamCode}</div>
    `;
    return d;
}

// --- SAFE FILTER EVENT LISTENERS ---
const bindEvent = (id, event, handler) => {
    const el = document.getElementById(id);
    if (el) el[event] = handler;
};

bindEvent('player-search', 'oninput', updateUI);
bindEvent('pos-filter', 'onchange', updateUI);
bindEvent('team-filter', 'onchange', updateUI);
bindEvent('price-filter', 'onchange', updateUI);
bindEvent('stat-filter', 'onchange', updateUI);

// --- APP INITIALIZATION ---
window.onload = init;

// --- MULTI-PAGE ROUTER & PAGE 2 AI RECOMMENDATION ENGINE ---
const tabBuilderBtn = document.getElementById('tab-builder');
const tabRecBtn = document.getElementById('tab-recommended');
const pageBuilderDiv = document.getElementById('page-builder');
const pageRecDiv = document.getElementById('page-recommended');

if (tabBuilderBtn && tabRecBtn && pageBuilderDiv && pageRecDiv) {
    
    // Page 1: Lineup Builder Tab Handler
    tabBuilderBtn.onclick = () => {
        pageBuilderDiv.classList.remove('hidden');
        pageRecDiv.classList.add('hidden');
        tabBuilderBtn.style.setProperty('background-color', '#00ff85', 'important');
        tabBuilderBtn.style.setProperty('color', '#1e0b30', 'important');
        tabRecBtn.style.background = 'transparent';
        tabRecBtn.style.setProperty('color', '#b4fee7', 'important');
    };

    // Page 2: AI Recommendation Tab Handler
    tabRecBtn.onclick = async () => {
        pageBuilderDiv.classList.add('hidden');
        pageRecDiv.classList.remove('hidden');
        
        tabRecBtn.style.setProperty('background-color', '#00ff85', 'important');
        tabRecBtn.style.setProperty('color', '#1e0b30', 'important');
        tabBuilderBtn.style.background = 'transparent';
        tabBuilderBtn.style.setProperty('color', '#b4fee7', 'important');
        
        const aiPitchEl = document.getElementById('ai-pitch');
        const aiBenchEl = document.getElementById('ai-bench');
        if (!aiPitchEl || !aiBenchEl) return;
        
        aiPitchEl.innerHTML = '<div class="text-center text-purple-300 font-bold py-16 animate-pulse">Running Squad Optimization Solver...</div>';
        aiBenchEl.innerHTML = '';

        try {
            const res = await fetch('/api/recommendation');
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            const lineup = data.lineup || [];
            const bench = data.bench || [];
            
            captainName = data.captain_name || null;

            aiPitchEl.innerHTML = '';
            aiBenchEl.innerHTML = '';

            if (document.getElementById('ai-cost')) {
                document.getElementById('ai-cost').innerText = `£${(data.total_cost || 0).toFixed(1)}m`;
            }
            if (document.getElementById('ai-pts')) {
                document.getElementById('ai-pts').innerText = `${(data.total_predicted_pts || 0).toFixed(1)} Pts`;
            }

            ['GK', 'DEF', 'MID', 'FWD'].forEach(pos => {
                const row = document.createElement('div');
                row.className = "pos-row-lg";
                
                lineup.filter(x => x.pos_label === pos).forEach(player => {
                    const card = createCard(player, true);
                    row.appendChild(card);
                });
                
                if (row.children.length > 0) {
                    aiPitchEl.appendChild(row);
                }
            });

            bench.forEach(player => {
                const card = createCard(player, true);
                aiBenchEl.appendChild(card);
            });

        } catch (err) {
            aiPitchEl.innerHTML = `<div class="text-center text-red-400 font-bold py-16">Failed to load recommendation: ${err.message}</div>`;
            console.error("Page 2 Fetch Error:", err);
        }
    };
}