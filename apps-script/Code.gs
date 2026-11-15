const SETTINGS = {
  SPREADSHEET_ID: "",
  SHEET_NAME: "Signups",
  MAX_SIGNUPS: 100,
  OWNER_EMAIL: "privatevsemvaram@gmail.com",
  SEND_EMAIL_NOTIFICATION: true
};

const HEADERS = ["Időpont", "Név", "Email", "Telefon", "Hírlevél", "Forrás"];

function doGet() {
  try {
    const sheet = getSheet_();
    return json_({ ok: true, remaining: remaining_(sheet) });
  } catch (err) {
    return json_({ ok: false, error: "server" });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const raw = e && e.postData ? e.postData.contents : "";
    let data = {};
    try {
      data = JSON.parse(raw || "{}");
    } catch (parseError) {
      return json_({ ok: false, error: "payload" });
    }

    const name = String(data.name || "").trim().replace(/\s+/g, " ");
    const email = String(data.email || "").trim().toLowerCase();
    const phone = String(data.phone || "").trim();
    const newsletter = data.newsletter === true;

    if (name.length < 2 || name.length > 80) {
      return json_({ ok: false, error: "name" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) {
      return json_({ ok: false, error: "email" });
    }
    if (phone.length > 30) {
      return json_({ ok: false, error: "phone" });
    }

    const sheet = getSheet_();

    if (remaining_(sheet) <= 0) {
      return json_({ ok: false, error: "full", remaining: 0 });
    }

    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const emails = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
      for (let i = 0; i < emails.length; i++) {
        if (String(emails[i][0]).trim().toLowerCase() === email) {
          return json_({ ok: false, error: "duplicate", remaining: remaining_(sheet) });
        }
      }
    }

    sheet.appendRow([
      new Date(),
      safe_(name),
      safe_(email),
      safe_(phone),
      newsletter ? "igen" : "nem",
      "web"
    ]);

    const remaining = remaining_(sheet);

    if (SETTINGS.SEND_EMAIL_NOTIFICATION) {
      notifyOwner_(name, email, phone, newsletter, remaining);
    }

    return json_({ ok: true, remaining: remaining });
  } catch (err) {
    return json_({ ok: false, error: "server" });
  } finally {
    try {
      lock.releaseLock();
    } catch (releaseError) {}
  }
}

function getSheet_() {
  const ss = SETTINGS.SPREADSHEET_ID
    ? SpreadsheetApp.openById(SETTINGS.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(SETTINGS.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SETTINGS.SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#f3f3f3");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 200);
    sheet.setColumnWidth(3, 240);
    sheet.setColumnWidth(4, 160);
    sheet.setColumnWidth(5, 100);
    sheet.setColumnWidth(6, 80);
  }

  return sheet;
}

function remaining_(sheet) {
  const used = Math.max(0, sheet.getLastRow() - 1);
  return Math.max(0, SETTINGS.MAX_SIGNUPS - used);
}

function notifyOwner_(name, email, phone, newsletter, remaining) {
  try {
    const subject = "Új gym regisztráció: " + name;
    const body = [
      "Új jelentkező az ingyenes 1 hónapos bérletre.",
      "",
      "Név: " + name,
      "Email: " + email,
      "Telefon: " + (phone || "-"),
      "Hírlevél: " + (newsletter ? "igen" : "nem"),
      "Időpont: " + Utilities.formatDate(new Date(), "Europe/Budapest", "yyyy-MM-dd HH:mm"),
      "Maradék helyek: " + remaining
    ].join("\n");

    MailApp.sendEmail(SETTINGS.OWNER_EMAIL, subject, body);
  } catch (err) {}
}

function safe_(value) {
  const text = String(value || "");
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
