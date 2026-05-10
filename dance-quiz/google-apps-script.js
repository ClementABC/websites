// ===========================================================
// Google Apps Script — Dance Quiz Backend (v2 — GET-only)
// ===========================================================
// POST is broken for Shared Drive container-bound scripts.
// All operations go through doGet with ?payload=<encoded JSON>
// ===========================================================

const SPREADSHEET_ID = '1iSLWQmqKO_oJIwSEyESVGWLtJ3Cw1h_SXXsl8ivJKDY';

function doGet(e) {
  try {
    // If payload param exists, this is a write operation
    var payloadStr = (e && e.parameter && e.parameter.payload) ? e.parameter.payload : null;
    
    if (payloadStr) {
      var body = JSON.parse(payloadStr);
      var action = body.action;
      var args = body.args || {};
      var result;

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
    }

    // No payload = return teacher results (default)
    var result = getTeacherResults();
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Keep doPost as fallback (works from browsers sometimes)
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var args = body.args || {};
    var result;

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

function saveStudentSession(args) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Sessions');

  if (args.session_id) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(args.session_id)) {
        sheet.getRange(i + 1, 4).setValue(new Date().toISOString());
        sheet.getRange(i + 1, 5).setValue(args.total_score || 0);
        sheet.getRange(i + 1, 6).setValue(args.max_score || 0);
        sheet.getRange(i + 1, 7).setValue(args.phase_scores || '{}');
        sheet.getRange(i + 1, 8).setValue(args.completed ? 'TRUE' : 'FALSE');
        return { session_id: args.session_id, ok: true };
      }
    }
    return { session_id: args.session_id, ok: false, error: 'Session not found' };
  } else {
    var sessionId = Date.now();
    sheet.appendRow([
      sessionId,
      args.student_name || '',
      new Date().toISOString(),
      '', 0, 0, '{}', 'FALSE'
    ]);
    return { session_id: sessionId, ok: true };
  }
}

function saveStudentAnswer(args) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Answers');

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
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sessSheet = ss.getSheetByName('Sessions');
  var sessData = sessSheet.getDataRange().getValues();
  var ansSheet = ss.getSheetByName('Answers');
  var ansData = ansSheet.getDataRange().getValues();

  var answerMap = {};
  for (var i = 1; i < ansData.length; i++) {
    var sid = String(ansData[i][0]);
    if (!answerMap[sid]) answerMap[sid] = [];
    answerMap[sid].push({
      question_id: Number(ansData[i][1]) || 0,
      answer_json: ansData[i][2] || '{}',
      is_correct: ansData[i][3] === 'TRUE' || ansData[i][3] === true,
      points_earned: Number(ansData[i][4]) || 0,
      answered_at: ansData[i][5] || ''
    });
  }

  var sessions = [];
  for (var i = 1; i < sessData.length; i++) {
    var sid = String(sessData[i][0]);
    var phaseScores = {};
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

  return { sessions: sessions.reverse(), total_students: sessions.length };
}
