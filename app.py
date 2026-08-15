import os
import sys
import time
from flask import Flask, render_template, jsonify

# --- ENVIRONMENT & PATH SETUP ---
anaconda_bin = r"C:\Users\karsh\anaconda3\Library\bin"
if os.path.exists(anaconda_bin) and anaconda_bin not in os.environ["PATH"]:
    os.environ["PATH"] = anaconda_bin + os.pathsep + os.environ["PATH"]

from data_engine import get_clean_fpl_data, get_optimal_fpl_squad

app = Flask(__name__)

# DISABLE STATIC FILE CACHING IN DEVELOPMENT
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

@app.after_request
def add_header(response):
    """Ensures browsers never cache pitch.js during active development."""
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/')
def index():
    """Passes a timestamp version parameter to force instant JS reloads."""
    return render_template('index.html', cache_bust=int(time.time()))

@app.route('/api/players')
def get_players():
    players = get_clean_fpl_data()
    return jsonify(players)

@app.route('/api/recommendation')
def api_recommendation():
    recommendation = get_optimal_fpl_squad()
    return jsonify(recommendation)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)