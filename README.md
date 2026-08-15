# FPL Insights HQ

A data-driven Fantasy Premier League squad builder and analytics tool that helps managers make smarter transfer decisions with AI-powered recommendations and in-depth player statistics.

#### 🔗 It's Live!: [fpl-insights-hq.onrender.com](https://fpl-insights-hq.onrender.com)
---

## 🚀 Features

* **Lineup Builder-** Construct your 15-man squad visually with a full pitch view, position constraints, and real-time budget tracking.
* **AI Roster Recommendations-** Get intelligent squad suggestions optimised for predicted total points within your remaining budget.
* **Advanced Player Filtering-** Filter by position, team, price ceiling, and sort by 15+ statistical categories.
* **Comprehensive Stats-** Access xG, xA, xGI, xGC, ICT Index, Influence, Creativity, Threat, BPS, form rating, clean sheets, and more.
* **Live Budget Tracking-** Real-time remaining budget and squad value validation with overspend warnings.
* **Expected Points Projection-** See predicted total points update dynamically as you build your squad.
* **Substitute Management-** Manage your bench alongside your starting XI with full squad overview.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | HTML5, CSS3, JavaScript |
| **Backend** | Python, Flask, Gunicorn |
| **Data Engine & Analytics** | Pandas, NumPy, Scikit-Learn |
| **Data Source** | [FPL Core Insights](https://github.com/olbauday/FPL-Core-Insights) by @olbauday |
| **Hosting & Deployment** | Render (Cloud Platform) |

---

## How it Works

* **Browse Players-** Use the filters to search by position, team or price range and sort by your preferred stat
* **Build your Squad-** Add up to 15 players while staying within the £100m budget.
* **Get Recommendations-** Click the Recommendations tab to receive an AI optimized squad based on current form and projected points.
* **Manage Substitutes-** Designate your bench players and lock in your final selection.

---

## Data & Statistics Covered

Player pricing, fixture details and performance metrics are pulled directly from the official FPL API and processed dynamically:

* **Attacking Metrics-** Goals, Assists, xG, xA, xGI, Creativity, Threat
* **Defensive Metrics-** xGC, Clean Sheets, Saves
* **Overall Metrics-** ICT Index, Influence, BPS (Bonus Points System), Minutes Played, Form Rating

---

## Acknowledgements

- **[FPL Core Insights](https://github.com/olbauday/FPL-Core-Insights)** by [@olbauday](https://github.com/olbauday) — the dataset powering this project. It fuses official FPL API data with manually curated match stats, team Elo ratings from [ClubElo.com](https://clubelo.com), and full coverage of cups and European competitions, all keyed by official FPL player IDs.
- Deployed on [Render](https://render.com)

---

*FPL Insights HQ is an independent fan project and is not affiliated with the Premier League or Fantasy Premier League.*
