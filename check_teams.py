import pandas as pd
import requests
import io

print("--- Fetching Master Dataset to Extract True IDs ---")
BASE_URL = "https://raw.githubusercontent.com/olbauday/FPL-Core-Insights/main/data/2025-2026/"

try:
    # Fetch the players and playerstats files
    p_df = pd.read_csv(io.StringIO(requests.get(f"{BASE_URL}players.csv", verify=False).text))
    s_df = pd.read_csv(io.StringIO(requests.get(f"{BASE_URL}playerstats.csv", verify=False).text))
    
    # Normalize column names
    p_df.columns = [str(c).strip().lower().replace('ï»¿', '') for c in p_df.columns]
    s_df.columns = [str(c).strip().lower().replace('ï»¿', '') for c in s_df.columns]
    
    # Create the player full name
    if 'first_name' in p_df.columns and 'second_name' in p_df.columns:
        p_df['name'] = p_df['first_name'].astype(str) + " " + p_df['second_name'].astype(str)
    else:
        name_col = next((c for c in p_df.columns if 'name' in c), p_df.columns[1])
        p_df['name'] = p_df[name_col]

    t_col = next((c for c in p_df.columns if 'team' in c), 'team_code')
    
    print("\n✅ DATA SAMPLES FOUND:")
    print("----------------------------------------")
    # Group by the team ID and show a couple of player names representing that ID
    unique_teams = p_df.groupby(t_col)['name'].unique()
    
    for team_id, players in unique_teams.items():
        sample_players = ", ".join(list(players)[:3]) # Get the first 3 players as a sample
        print(f"ID [{team_id}] contains players like: {sample_players}")
        print("----------------------------------------")

except Exception as e:
    print(f"❌ Error scanning data: {e}")