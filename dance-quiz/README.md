# Quiz — Histoire de la Danse

Interactive French dance history quiz with 16 questions across 5 phases and 8 question types.

## Student Mode
Open `index.html` — students enter their name and take the quiz.

## Teacher Dashboard
Open `index.html?mode=teacher` — password: `Tixi`

## Google Sheets Backend (optional)
Student answers can be saved to a Google Sheet for the teacher to review:

1. Open the Google Sheet "Dance Quiz — Résultats" in Google Drive (Personal SecondBrain)
2. Go to **Extensions → Apps Script**
3. Paste the contents of `google-apps-script.js`
4. Click **Deploy → New deployment** → Type: Web app → Execute as: Me → Access: Anyone
5. Copy the deployed URL
6. Edit `index.html` and replace `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with that URL

Without the Apps Script, the quiz still works perfectly — results are saved in the browser's localStorage.
