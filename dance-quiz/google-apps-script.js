// ===========================================================
// Google Apps Script — Dance Quiz Backend
// ===========================================================
// HOW TO DEPLOY:
// 1. Open the Google Sheet "Dance Quiz — Résultats"
// 2. Extensions → Apps Script
// 3. Delete any existing code, paste this entire file
// 4. Click Deploy → New deployment
// 5. Type: "Web app"
// 6. Execute as: "Me"
// 7. Who has access: "Anyone"
// 8. Click Deploy → copy the Web App URL
// 9. Paste that URL into dance-quiz/index.html where it says APPS_SCRIPT_URL
// ===========================================================

const SPREADSHEET_ID = '1iSLWQmqKO_oJIwSEyESVGWLtJ3Cw1h_SXXsl8ivJKDY';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const args = body.args || {};

    let result;
    switch (action) {
      case 'save_student_session':
        result = saveStudentSession(args);
        break;
      case 'save_student_answer':
        result = saveStudentAnswer(args);
        break;
      case 'get_teacher_results':
        result = getTeacherResults();
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Also handle GET for testing
function doGet(e) {
  const result = getTeacherResults();
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function saveStudentSession(args) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Sessions');

  if (args.session_id) {
    // Update existing session (quiz completed)
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(args.session_id)) {
        sheet.getRange(i + 1, 4).setValue(new Date().toISOString()); // completed_at
        sheet.getRange(i + 1, 5).setValue(args.total_score || 0);
        sheet.getRange(i + 1, 6).setValue(args.max_score || 0);
        sheet.getRange(i + 1, 7).setValue(args.phase_scores || '{}');
        sheet.getRange(i + 1, 8).setValue(args.completed ? 'TRUE' : 'FALSE');
        return { session_id: args.session_id, ok: true };
      }
    }
    return { session_id: args.session_id, ok: false, error: 'Session not found' };
  } else {
    // Create new session
    const sessionId = Date.now(); // Use timestamp as session ID
    sheet.appendRow([
      sessionId,
      args.student_name || '',
      new Date().toISOString(),
      '',  // completed_at
      0,   // total_score
      0,   // max_score
      '{}', // phase_scores
      'FALSE'
    ]);
    return { session_id: sessionId, ok: true };
  }
}

function saveStudentAnswer(args) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Answers');

  sheet.appendRow([
    args.session_id || 0,
    args.question_id || 0,
    args.answer_json || '{}',
    args.is_correct ? 'TRUE' : 'FALSE',
    args.points_earned || 0,
    new Date().toISOString()
  ]);

  return { ok: true };
}

function getTeacherResults() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Read sessions
  const sessSheet = ss.getSheetByName('Sessions');
  const sessData = sessSheet.getDataRange().getValues();

  // Read answers
  const ansSheet = ss.getSheetByName('Answers');
  const ansData = ansSheet.getDataRange().getValues();

  // Build answer map: session_id → [answers]
  const answerMap = {};
  for (let i = 1; i < ansData.length; i++) {
    const sid = String(ansData[i][0]);
    if (!answerMap[sid]) answerMap[sid] = [];
    answerMap[sid].push({
      question_id: Number(ansData[i][1]) || 0,
      answer_json: ansData[i][2] || '{}',
      is_correct: ansData[i][3] === 'TRUE' || ansData[i][3] === true,
      points_earned: Number(ansData[i][4]) || 0,
      answered_at: ansData[i][5] || ''
    });
  }

  // Build sessions
  const sessions = [];
  for (let i = 1; i < sessData.length; i++) {
    const sid = String(sessData[i][0]);
    let phaseScores = {};
    try { phaseScores = JSON.parse(sessData[i][6] || '{}'); } catch (_) {}

    sessions.push({
      id: Number(sessData[i][0]) || 0,
      student_name: sessData[i][1] || '',
      started_at: sessData[i][2] || '',
      completed_at: sessData[i][3] || null,
      total_score: Number(sessData[i][4]) || 0,
      max_score: Number(sessData[i][5]) || 0,
      phase_scores: phaseScores,
      answers: answerMap[sid] || []
    });
  }

  return {
    sessions: sessions.reverse(), // newest first
    total_students: sessions.length
  };
}
