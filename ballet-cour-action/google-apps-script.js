/**
 * Google Apps Script for Quiz 2 — Ballet Cour à Action
 * Receives quiz data via GET request with ?payload= parameter
 * Writes to Google Sheet with improved readability (plain text)
 */

const SPREADSHEET_ID = '1qzX4VKHRXPYR-R_daOFVdnEfIMKOUkLLEgjKDHjLwkM';
const SESSIONS_SHEET = 'Sheet1';  // Will be renamed to Sessions
const ANSWERS_SHEET = 'Answers';

function doGet(e) {
  try {
    const payload = e.parameter.payload;
    if (!payload) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'No payload provided'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const data = JSON.parse(decodeURIComponent(payload));
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Handle different action types
    if (data.action === 'save_session') {
      return saveSession(ss, data);
    } else if (data.action === 'save_answer') {
      return saveAnswer(ss, data);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Unknown action: ' + data.action
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function saveSession(ss, data) {
  const sheet = ss.getSheetByName(SESSIONS_SHEET);
  if (!sheet) {
    throw new Error('Sessions sheet not found');
  }

  const session = data.session;
  
  // Calculate pass/fail (60% threshold)
  const percentage = session.totalQuestions > 0 
    ? Math.round((session.score / session.totalQuestions) * 100)
    : 0;
  const passFail = percentage >= 60 ? 'PASS' : 'FAIL';
  
  // Format phase breakdown as readable string
  let phaseBreakdown = '';
  if (session.phaseScores) {
    phaseBreakdown = Object.entries(session.phaseScores)
      .map(([phase, score]) => `${phase}: ${score.score}/${score.total}`)
      .join(' | ');
  }

  // Append to Sessions sheet
  sheet.appendRow([
    session.studentName || 'Anonyme',
    new Date(session.timestamp || Date.now()),
    `${session.score}/${session.totalQuestions}`,
    `${percentage}%`,
    passFail,
    session.timeTaken || '',
    phaseBreakdown
  ]);

  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    action: 'save_session'
  })).setMimeType(ContentService.MimeType.JSON);
}

function saveAnswer(ss, data) {
  const sheet = ss.getSheetByName(ANSWERS_SHEET);
  if (!sheet) {
    throw new Error('Answers sheet not found');
  }

  const answer = data.answer;
  
  // Convert answer to plain text for readability
  let studentAnswerText = formatAnswerForSheet(answer.studentAnswer, answer.questionType);
  let correctAnswerText = formatAnswerForSheet(answer.correctAnswer, answer.questionType);
  
  // Determine result symbol
  const result = answer.isCorrect ? '✓' : '✗';
  const points = `${answer.points || 0}/${answer.maxPoints || 1}`;

  // Append to Answers sheet with PLAIN TEXT (improved readability)
  sheet.appendRow([
    answer.studentName || 'Anonyme',
    answer.questionId || '',
    answer.questionText || '',  // ACTUAL QUESTION TEXT, not ID
    studentAnswerText,           // PLAIN TEXT answer
    correctAnswerText,           // PLAIN TEXT correct answer
    result,
    points
  ]);

  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    action: 'save_answer'
  })).setMimeType(ContentService.MimeType.JSON);
}

function formatAnswerForSheet(answer, questionType) {
  if (answer === null || answer === undefined) {
    return '';
  }
  
  // Handle different answer formats and convert to readable text
  if (Array.isArray(answer)) {
    return answer.join(', ');
  }
  
  if (typeof answer === 'object') {
    // For matching questions, format as "A → 1, B → 2"
    if (answer.matches) {
      return Object.entries(answer.matches)
        .map(([k, v]) => `${k} → ${v}`)
        .join(', ');
    }
    return JSON.stringify(answer);
  }
  
  // For ranking, word cloud, etc., return as-is
  return String(answer);
}

function doPost(e) {
  // POST is not supported for Shared Drive sheets
  // Redirect to GET handler
  return doGet(e);
}
