import pandas as pd
import numpy as np
import requests
import io
import os
import urllib3
from pulp import LpProblem, LpMaximize, LpVariable, lpSum, LpStatus, LpBinary

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

DATA_DIR = "data"
BASE_URL = "https://raw.githubusercontent.com/olbauday/FPL-Core-Insights/main/data/2026-2027/"

def load_fpl_table(file_name):
    """Loads CSV tables locally first, falling back to GitHub remote URL."""
    local_path = os.path.join(DATA_DIR, file_name)
    if os.path.exists(local_path):
        return pd.read_csv(local_path)
    url = f"{BASE_URL}{file_name}"
    response = requests.get(url, verify=False) 
    if response.status_code != 200:
        raise Exception(f"Network error loading {file_name}")
    return pd.read_csv(io.StringIO(response.text))

def parse_price_value(val):
    if pd.isna(val) or val is None:
        return 4.5
    try:
        num = float(val)
        return round(num / 10.0, 1) if num > 25.0 else round(num, 1)
    except (ValueError, TypeError):
        return 4.5

def calculate_pre_gw1_predicted_pts(row):
    """
    Calculates projected pre-GW1 expected points using historical PPG, ep_next, 
    and playing time indicators.
    """
    # Exclude injured / ruled out players
    if row.get('status') in ['i', 's', 'u'] or row.get('chance_next_round', 100) == 0:
        return 0.0

    ppg = float(row.get('points_per_game', 0) or 0)
    ep_next = float(row.get('ep_next', 0) or 0)
    starts_per_90 = float(row.get('starts_per_90', 0) or 0)
    xg_per_90 = float(row.get('expected_goals_per_90', 0) or 0)
    xa_per_90 = float(row.get('expected_assists_per_90', 0) or 0)

    # Weighted composite projection
    base_proj = (ppg * 0.45) + (ep_next * 0.35) + (starts_per_90 * 1.2) + (xg_per_90 * 0.8) + (xa_per_90 * 0.5)
    
    # Scale chance of playing
    chance_factor = float(row.get('chance_next_round', 100)) / 100.0
    return round(max(0.0, base_proj * chance_factor), 2)

def get_clean_fpl_data():
    """
    Pipeline extracting core player stats, pricing, and calculating pre-GW1 predictions.
    """
    try:
        s_df = load_fpl_table("playerstats.csv")
        p_df = load_fpl_table("players.csv")
        t_df = load_fpl_table("teams.csv")

        s_df.columns = [str(c).strip().lower().replace('ï»¿', '') for c in s_df.columns]
        p_df.columns = [str(c).strip().lower().replace('ï»¿', '') for c in p_df.columns]
        t_df.columns = [str(c).strip().lower().replace('ï»¿', '') for c in t_df.columns]

        p_id = 'player_id' if 'player_id' in p_df.columns else p_df.columns[0]
        s_id = 'id' if 'id' in s_df.columns else s_df.columns[0]

        # Position Mapping
        def map_pos(val):
            v = str(val).lower()
            if 'goal' in v or v == '1': return 'GK'
            if 'def' in v or v == '2': return 'DEF'
            if 'mid' in v or v == '3': return 'MID'
            if 'fwd' in v or 'forw' in v or v == '4': return 'FWD'
            return 'MID'
        
        pos_col = 'position' if 'position' in p_df.columns else p_df.columns[-1]
        p_df['pos_label'] = p_df[pos_col].apply(map_pos)

        # Name formatting
        if 'first_name' in p_df.columns and 'second_name' in p_df.columns:
            p_df['name'] = p_df['first_name'].astype(str) + " " + p_df['second_name'].astype(str)
        else:
            p_df['name'] = p_df.get('web_name', p_df.columns[1])

        if 'web_name' not in p_df.columns:
            p_df['web_name'] = p_df['name']

        # Price Mapping from playerstats.csv
        if 'now_cost' in s_df.columns:
            cost_mapping = s_df.groupby(s_id)['now_cost'].last().reset_index()
            p_df = p_df.merge(cost_mapping, left_on=p_id, right_on=s_id, how='left')
            p_df['display_price'] = p_df['now_cost'].apply(parse_price_value)
        else:
            p_df['display_price'] = 4.5

        # Team Short Labels
        if 'code' in t_df.columns and 'short_name' in t_df.columns and 'team_code' in p_df.columns:
            p_df = p_df.merge(t_df[['code', 'short_name']], left_on='team_code', right_on='code', how='left')
            p_df['team_label'] = p_df['short_name'].astype(str).str.upper()
        else:
            p_df['team_label'] = p_df.get('team_code', 'TBC').astype(str).str.upper()

        p_df['team_label'] = p_df['team_label'].replace(['NAN', 'NONE', ''], 'TBC').fillna('TBC')

        # Merge Stats from playerstats.csv
        stat_cols = [
            'chance_of_playing_next_round', 'status', 'news', 'selected_by_percent', 
            'penalties_order', 'direct_freekicks_order', 'corners_and_indirect_freekicks_order',
            'goals_scored', 'assists', 'minutes', 'ict_index', 'expected_goals', 
            'expected_assists', 'expected_goal_involvements', 'expected_goals_conceded',
            'form', 'bonus', 'bps', 'influence', 'creativity', 'threat', 'clean_sheets', 'saves', 
            'total_points', 'points_per_game', 'ep_next', 'starts_per_90', 'expected_goals_per_90', 'expected_assists_per_90'
        ]
        avail_stats = [c for c in stat_cols if c in s_df.columns]
        
        if avail_stats:
            status_df = s_df.groupby(s_id)[avail_stats].last().reset_index()
            p_df = p_df.merge(status_df, left_on=p_id, right_on=s_id, how='left')

        # Clean fields
        p_df['chance_next_round'] = pd.to_numeric(p_df.get('chance_of_playing_next_round', 100), errors='coerce').fillna(100.0)
        p_df['status'] = p_df.get('status', 'a').fillna('a')
        p_df['news'] = p_df.get('news', '').fillna('')
        p_df['selected_by_percent'] = pd.to_numeric(p_df.get('selected_by_percent', 0.0), errors='coerce').fillna(0.0).round(1)
        p_df['goals_scored'] = pd.to_numeric(p_df.get('goals_scored', 0), errors='coerce').fillna(0).astype(int)
        p_df['assists'] = pd.to_numeric(p_df.get('assists', 0), errors='coerce').fillna(0).astype(int)
        p_df['minutes'] = pd.to_numeric(p_df.get('minutes', 0), errors='coerce').fillna(0).astype(int)
        p_df['ict_index'] = pd.to_numeric(p_df.get('ict_index', 0.0), errors='coerce').fillna(0.0).round(1)
        p_df['expected_goals'] = pd.to_numeric(p_df.get('expected_goals', 0.0), errors='coerce').fillna(0.0).round(2)
        p_df['expected_assists'] = pd.to_numeric(p_df.get('expected_assists', 0.0), errors='coerce').fillna(0.0).round(2)
        p_df['expected_goal_involvements'] = pd.to_numeric(p_df.get('expected_goal_involvements', 0.0), errors='coerce').fillna(0.0).round(2)
        p_df['expected_goals_conceded'] = pd.to_numeric(p_df.get('expected_goals_conceded', 0.0), errors='coerce').fillna(0.0).round(2)
        p_df['form'] = pd.to_numeric(p_df.get('form', 0.0), errors='coerce').fillna(0.0).round(1)
        p_df['bonus'] = pd.to_numeric(p_df.get('bonus', 0), errors='coerce').fillna(0).astype(int)
        p_df['bps'] = pd.to_numeric(p_df.get('bps', 0), errors='coerce').fillna(0).astype(int)
        p_df['influence'] = pd.to_numeric(p_df.get('influence', 0.0), errors='coerce').fillna(0.0).round(1)
        p_df['creativity'] = pd.to_numeric(p_df.get('creativity', 0.0), errors='coerce').fillna(0.0).round(1)
        p_df['threat'] = pd.to_numeric(p_df.get('threat', 0.0), errors='coerce').fillna(0.0).round(1)
        p_df['clean_sheets'] = pd.to_numeric(p_df.get('clean_sheets', 0), errors='coerce').fillna(0).astype(int)
        p_df['saves'] = pd.to_numeric(p_df.get('saves', 0), errors='coerce').fillna(0).astype(int)
        p_df['gw_points'] = pd.to_numeric(p_df.get('total_points', 0), errors='coerce').fillna(0).astype(int)

        # Set-Piece Role Flags
        p_df['is_pen_taker'] = pd.to_numeric(p_df.get('penalties_order', 99), errors='coerce').fillna(99) == 1
        p_df['is_fk_taker'] = pd.to_numeric(p_df.get('direct_freekicks_order', 99), errors='coerce').fillna(99) == 1
        p_df['is_corner_taker'] = pd.to_numeric(p_df.get('corners_and_indirect_freekicks_order', 99), errors='coerce').fillna(99) == 1

        # PRE-GW1 PREDICTED POINTS CALCULATION
        p_df['predicted'] = p_df.apply(calculate_pre_gw1_predicted_pts, axis=1)

        cols_to_export = [
            'name', 'web_name', 'team_label', 'pos_label', 'display_price', 
            'gw_points', 'predicted', 'status', 'chance_next_round', 'news', 
            'selected_by_percent', 'goals_scored', 'assists', 'minutes', 'ict_index', 
            'expected_goals', 'expected_assists', 'expected_goal_involvements', 'expected_goals_conceded',
            'form', 'bonus', 'bps', 'influence', 'creativity', 'threat', 'clean_sheets', 'saves',
            'is_pen_taker', 'is_fk_taker', 'is_corner_taker'
        ]
        
        output_records = p_df[cols_to_export].to_dict(orient='records')
        print(f"✅ Generated pre-GW1 player data ({len(output_records)} players).")
        return output_records

    except Exception as e:
        print(f"❌ PIPELINE ERROR: {e}")
        return []

def get_supercharged_fpl_data(base_path="https://raw.githubusercontent.com/olbauday/FPL-Core-Insights/main/data/2026-2027"):
    try:
        base_players = get_clean_fpl_data()
        if not base_players:
            return []
            
        df_players = pd.DataFrame(base_players)
        
        # Ensure cbit_bonus_factor always exists, even if external files fail to load
        df_players['cbit_bonus_factor'] = 0.0
        
        try:
            df_match_stats = pd.read_csv(f"{base_path}/playermatchstats.csv")
            if 'id' in df_players.columns and 'player_id' in df_match_stats.columns:
                defensive_agg = df_match_stats.groupby('player_id').agg(
                    total_tackles=('tackles', 'sum'),
                    total_clearances=('clearances_blocks_interceptions', 'sum')
                ).reset_index()
                
                df_players = df_players.merge(defensive_agg, left_on='id', right_on='player_id', how='left')
                df_players['total_tackles'] = df_players['total_tackles'].fillna(0)
                df_players['total_clearances'] = df_players['total_clearances'].fillna(0)
                df_players['cbit_bonus_factor'] = (df_players['total_tackles'] + df_players['total_clearances']) * 0.05
        except Exception as inner_e:
            print(f"⚠️ External match stats optional load note: {inner_e}")
            
        return df_players.to_dict(orient='records')

    except Exception as e:
        print(f"⚠️ SUPERCHARGE PIPELINE ERROR: {e}")
        return get_clean_fpl_data()

ACTIVE_OWNERSHIP_WEIGHT = 0.04  # Adjust this to make ownership more or less important

def get_optimal_fpl_squad():
    """
    MILP Solver:
    1. Maximizes Starting XI Expected Points + Captain Multiplier.
    2. Uses an Ownership (EO) Bonus to naturally favor highly-owned premium players.
    3. Filters out extreme differentials (< 1.0% ownership) to prevent picking non-starters.
    """
    try:
        from pulp import LpProblem, LpMaximize, LpVariable, LpBinary, lpSum, LpStatus
        import pandas as pd
        
        # Fetch your player data
        players = get_supercharged_fpl_data()
        if not players:
            return {"lineup": [], "bench": [], "captain_name": "", "total_cost": 0, "total_predicted_pts": 0}

        df = pd.DataFrame(players)
        
        # --- NEW: OWNERSHIP FLOOR FILTER ---
        # 1. Drop players who are injured/ruled out
        # 2. Drop players with < 1.0% ownership to filter out dead assets like Walter Benítez
        df = df[(df['chance_next_round'] > 0) & (df['selected_by_percent'] >= 1.0)].reset_index(drop=True)
        N = len(df)

        prob = LpProblem("FPL_Dynamic_Ownership_Optimization", LpMaximize)

        # Decision Variables
        squad_vars = [LpVariable(f"squad_{i}", cat=LpBinary) for i in range(N)]
        start_vars = [LpVariable(f"start_{i}", cat=LpBinary) for i in range(N)]
        captain_vars = [LpVariable(f"cap_{i}", cat=LpBinary) for i in range(N)]

        # --- NEW: OWNERSHIP-ADJUSTED OBJECTIVE FUNCTION ---
        # Main Goal: Maximize Starter Pts + Captain Bonus
        # Ownership Bonus: Add a fraction of selected_by_percent to favor highly owned players (The Haaland fix)
        # Bench Weight: 0.05 multiplier to pick decent bench fodder
        
        ownership_weight = ACTIVE_OWNERSHIP_WEIGHT  

        prob += lpSum([
            (start_vars[i] * (df.loc[i, 'predicted'] + df.loc[i, 'cbit_bonus_factor'])) + 
            (captain_vars[i] * (df.loc[i, 'predicted'] + df.loc[i, 'cbit_bonus_factor'])) +
            (ownership_weight * squad_vars[i] * df.loc[i, 'selected_by_percent']) +
            (0.05 * (squad_vars[i] - start_vars[i]) * (df.loc[i, 'predicted'] + df.loc[i, 'cbit_bonus_factor']))
            for i in range(N)
        ])

        # CONSTRAINT 1: Starter & Captain logical linkage
        for i in range(N):
            prob += start_vars[i] <= squad_vars[i]
            prob += captain_vars[i] <= start_vars[i]

        # CONSTRAINT 2: Total Counts (15 Squad, 11 Starters, 1 Captain)
        prob += lpSum([squad_vars[i] for i in range(N)]) == 15
        prob += lpSum([start_vars[i] for i in range(N)]) == 11
        prob += lpSum([captain_vars[i] for i in range(N)]) == 1

        # CONSTRAINT 3: Total Budget <= £100.0m
        prob += lpSum([squad_vars[i] * df.loc[i, 'display_price'] for i in range(N)]) <= 100.0

        # CONSTRAINT 4: Squad Position Caps (2 GK, 5 DEF, 5 MID, 3 FWD)
        prob += lpSum([squad_vars[i] for i in range(N) if df.loc[i, 'pos_label'] == 'GK']) == 2
        prob += lpSum([squad_vars[i] for i in range(N) if df.loc[i, 'pos_label'] == 'DEF']) == 5
        prob += lpSum([squad_vars[i] for i in range(N) if df.loc[i, 'pos_label'] == 'MID']) == 5
        prob += lpSum([squad_vars[i] for i in range(N) if df.loc[i, 'pos_label'] == 'FWD']) == 3

        # CONSTRAINT 5: Valid Starting XI Formations (1 GK, 3-5 DEF, 2-5 MID, 1-3 FWD)
        prob += lpSum([start_vars[i] for i in range(N) if df.loc[i, 'pos_label'] == 'GK']) == 1
        prob += lpSum([start_vars[i] for i in range(N) if df.loc[i, 'pos_label'] == 'DEF']) >= 3
        prob += lpSum([start_vars[i] for i in range(N) if df.loc[i, 'pos_label'] == 'DEF']) <= 5
        prob += lpSum([start_vars[i] for i in range(N) if df.loc[i, 'pos_label'] == 'MID']) >= 2
        prob += lpSum([start_vars[i] for i in range(N) if df.loc[i, 'pos_label'] == 'MID']) <= 5
        prob += lpSum([start_vars[i] for i in range(N) if df.loc[i, 'pos_label'] == 'FWD']) >= 1
        prob += lpSum([start_vars[i] for i in range(N) if df.loc[i, 'pos_label'] == 'FWD']) <= 3

        # CONSTRAINT 6: Max 3 players per Premier League team
        for team in df['team_label'].unique():
            prob += lpSum([squad_vars[i] for i in range(N) if df.loc[i, 'team_label'] == team]) <= 3

        # Solve the model
        prob.solve()

        print(f"🔍 PuLP Solver Status: {prob.status} ({LpStatus[prob.status]})")

        if LpStatus[prob.status] != 'Optimal':
            print("⚠️ WARNING: Solver did not find an optimal solution!")
            return {"lineup": [], "bench": [], "captain_name": "", "total_cost": 0, "total_predicted_pts": 0}
        
        starting_indices = [i for i in range(N) if start_vars[i].varValue == 1]
        squad_indices = [i for i in range(N) if squad_vars[i].varValue == 1]
        bench_indices = [i for i in squad_indices if i not in starting_indices]

        starting_xi_df = df.iloc[starting_indices].copy()
        bench_df = df.iloc[bench_indices].copy()

        # Identify Captain
        cap_index = [i for i in starting_indices if captain_vars[i].varValue == 1]
        cap_name = df.loc[cap_index[0], 'name'] if cap_index else starting_xi_df.sort_values('predicted', ascending=False).iloc[0]['name']

        total_cost = df.iloc[squad_indices]['display_price'].sum()
        
        raw_pts = starting_xi_df['predicted'].sum()
        cap_pts = df.loc[df['name'] == cap_name, 'predicted'].values[0] if cap_name in df['name'].values else 0
        total_predicted_pts = raw_pts + cap_pts

        return {
            "lineup": starting_xi_df.to_dict(orient='records'),
            "bench": bench_df.to_dict(orient='records'),
            "captain_name": cap_name,
            "total_cost": round(total_cost, 1),
            "total_predicted_pts": round(total_predicted_pts, 2)
        }

    except Exception as e:
        print(f"❌ OPTIMIZATION ERROR: {e}")
        return {"lineup": [], "bench": [], "captain_name": "", "total_cost": 0, "total_predicted_pts": 0}

def get_multi_gw_optimal_squad(horizon_weeks=4):
    """
    Optimizes squad selection across a rolling window of multiple gameweeks (e.g., GW 1 to 4)
    using future fixture difficulty and cumulative expected points.
    
    This runs completely separate from your active pre-season single-GW solver to ensure zero disruption.
    """
    try:
        from pulp import LpProblem, LpMaximize, LpVariable, LpBinary, lpSum, LpStatus
        import pandas as pd
        
        # Pull base supercharged data
        players = get_supercharged_fpl_data()
        if not players:
            return {"lineup": [], "bench": [], "captain_name": "", "total_cost": 0, "total_predicted_pts": 0}

        df = pd.DataFrame(players)
        df = df[(df['chance_next_round'] > 0) & (df['selected_by_percent'] >= 1.0)].reset_index(drop=True)
        N = len(df)

        # Multi-GW formulation placeholder:
        # In a full multi-week horizon, we project expected points across GW 1, 2, 3, 4 
        # based on upcoming fixture difficulties (FDR / Elo ratings).
        
        print(f"🚀 Initialized Multi-Gameweek Lookahead Solver for a {horizon_weeks}-week horizon.")
        
        # For now, we return a structured template or fall back to your stable runner 
        # while we build out the fixture mapping logic.
        return get_optimal_fpl_squad()

    except Exception as e:
        print(f"❌ MULTI-GW SOLVER ERROR: {e}")
        return get_optimal_fpl_squad()

def check_team_gameweek_fixture_count(team_code, gameweek_num, base_path="https://raw.githubusercontent.com/olbauday/FPL-Core-Insights/main/data/2026-2027"):
    """
    Checks the fixtures for a specific gameweek folder to determine if a team 
    has a Blank (0 matches), Normal (1 match), or Double (2 matches) gameweek.
    """
    try:
        # Construct the path to the gameweek-specific fixtures file
        gw_fixture_path = f"{base_path}/By Gameweek/GW{gameweek_num}/fixtures.csv"
        
        df_fixtures = pd.read_csv(gw_fixture_path)
        
        df_fixtures.columns = [str(c).strip().lower() for c in df_fixtures.columns]
        
        home_matches = df_fixtures[df_fixtures['team_h'] == team_code].shape[0]
        away_matches = df_fixtures[df_fixtures['team_a'] == team_code].shape[0]
        
        total_fixtures = home_matches + away_matches
        
        if total_fixtures == 0:
            return "Blank Gameweek (0 fixtures)"
        elif total_fixtures == 2:
            return "Double Gameweek (2 fixtures)"
        else:
            return "Normal Gameweek (1 fixture)"
            
    except Exception as e:
        return "Normal Gameweek (Default)"
    
if __name__ == "__main__":
    opt = get_optimal_fpl_squad()
    print(f"Optimal Squad Cost: £{opt['total_cost']}m | Predicted Points: {opt['total_predicted_pts']} Pts")