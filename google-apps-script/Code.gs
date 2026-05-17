var SHEET_ID = "1EASeG92OYIneG6cILkU-yCdkB6krn_EX3QBDY-AN6Cc";
var SHEET_NAME = "Customers";
var HEADERS = ["No", "Date", "Car", "Name", "Phone", "Note"];
var RATE_SHEET_NAME = "InterestRates";
var RATE_HEADERS = ["VehicleType", "YearRange", "Months48", "Months60", "Months72", "Months84", "Commission"];
var BOOKING_SHEET_NAME = "BookingReports";
var BOOKING_HEADERS = [
  "Id",
  "CreatedAt",
  "UpdatedAt",
  "Status",
  "BuyerType",
  "CustomerName",
  "IdCard",
  "Phone",
  "Address",
  "BookingPrice",
  "Plate",
  "Brand",
  "Model",
  "Year",
  "Color",
  "SalePrice",
  "FinalPrice",
  "FinalPriceNote",
  "Discount",
  "PaymentType",
  "Source",
  "Ownership",
  "Project",
  "Campaign",
  "SaleName",
  "TeamName",
  "Conditions",
  "EmailSubject",
  "EmailTo",
  "EmailCc",
  "EmailBcc",
  "ReportText",
  "AttachmentsJson",
  "EmailStatus",
  "LineStatus",
  "OcrStatus"
];
var STOCK_SHEET_NAME = "StockInventory";
var STOCK_HEADERS = [
  "Plate",
  "Brand",
  "Model",
  "Year",
  "Color",
  "SalePrice",
  "Source",
  "Ownership",
  "Project",
  "Campaign",
  "ImportedAt",
  "UpdatedAt"
];
var TIME_ZONE = "Asia/Bangkok";
var API_VERSION = "2026-05-18-03";
var DEFAULT_INTEREST_RATES = [
  ["รถเก๋ง/กระบะ 4 ประตู", "2022-2026", 0.0279, 0.0309, 0.0399, 0.0449, 0.08],
  ["รถเก๋ง/กระบะ 4 ประตู", "2020-2021", 0.0299, 0.0319, 0.0419, 0.0449, 0.08],
  ["รถเก๋ง/กระบะ 4 ประตู", "2019", 0.0299, 0.0349, 0.0429, 0.0499, 0.08],
  ["รถเก๋ง/กระบะ 4 ประตู", "2017-2018", 0.0339, 0.0379, 0.0459, 0.0539, 0.08],
  ["รถเก๋ง/กระบะ 4 ประตู", "2016", 0.058, 0.0635, 0.0745, 0.0795, 0.08],
  ["รถเก๋ง/กระบะ 4 ประตู", "2015", 0.061, 0.071, 0.077, 0.0795, 0.08],
  ["รถเก๋ง/กระบะ 4 ประตู", "2014", 0.071, 0.0735, 0.0795, "", 0.08],
  ["รถเก๋ง/กระบะ 4 ประตู", "2013", 0.0735, 0.076, 0.0795, "", 0.08],
  ["รถเก๋ง/กระบะ 4 ประตู", "2012", 0.076, 0.0785, "", "", 0.08],
  ["รถเก๋ง/กระบะ 4 ประตู", "2011", 0.0785, 0.081, "", "", 0.08],
  ["รถกระบะ/รถตู้", "2022-2026", 0.0369, 0.0389, 0.0479, 0.0524, 0.08],
  ["รถกระบะ/รถตู้", "2020-2021", 0.0374, 0.0394, 0.0494, 0.0524, 0.08],
  ["รถกระบะ/รถตู้", "2019", 0.0399, 0.0449, 0.0529, 0.0599, 0.08],
  ["รถกระบะ/รถตู้", "2017-2018", 0.0459, 0.0529, 0.0599, 0.0699, 0.08],
  ["รถกระบะ/รถตู้", "2016", 0.065, 0.0735, 0.0795, 0.0795, 0.08],
  ["รถกระบะ/รถตู้", "2015", 0.068, 0.076, 0.0795, 0.0795, 0.08],
  ["รถกระบะ/รถตู้", "2014", 0.072, 0.0785, 0.0795, "", 0.08],
  ["รถกระบะ/รถตู้", "2013", 0.077, 0.0785, 0.0795, "", 0.08],
  ["รถกระบะ/รถตู้", "2012", 0.0785, 0.0785, "", "", 0.08],
  ["รถกระบะ/รถตู้", "2011", 0.0835, 0.0835, "", "", 0.08]
];

function doGet() {
  return jsonResponse({
    ok: true,
    message: "Big Car CRM Apps Script API is ready",
    version: API_VERSION,
    functions: {
      doPost: typeof doPost,
      listCustomers: typeof listCustomers,
      addCustomer: typeof addCustomer,
      listInterestRates: typeof listInterestRates,
      updateCustomer: typeof updateCustomer,
      deleteCustomer: typeof deleteCustomer,
      saveBookingReport: typeof saveBookingReport,
      lookupStockByPlate: typeof lookupStockByPlate,
      lookupCustomerById: typeof lookupCustomerById,
      importStock: typeof importStock,
      getStockImportStatus: typeof getStockImportStatus
    }
  });
}

function addCustomer(input) {
  var customer = cleanCustomer(input);
  var sheet = getSheet();
  var customers = listCustomers();
  var nextNo = getNextCustomerNo(customers);
  var date = Utilities.formatDate(new Date(), TIME_ZONE, "dd/MM/yyyy");

  sheet.appendRow([
    nextNo,
    date,
    customer.car,
    customer.name,
    customer.phone,
    customer.note
  ]);

  return {
    no: String(nextNo),
    date: date,
    car: customer.car,
    name: customer.name,
    phone: customer.phone,
    note: customer.note,
    rowIndex: sheet.getLastRow()
  };
}

function doPost(e) {
  try {
    var body = parseRequestBody(e);
    var action = String(body.action || "");

    if (action === "list") {
      return jsonResponse({
        ok: true,
        customers: listCustomers()
      });
    }

    if (action === "add") {
      return jsonResponse({
        ok: true,
        customer: addCustomer(body.customer || {})
      });
    }

    if (action === "update") {
      return jsonResponse({
        ok: true,
        customer: updateCustomer(Number(body.rowIndex), body.customer || {})
      });
    }

    if (action === "delete") {
      deleteCustomer(Number(body.rowIndex));
      return jsonResponse({
        ok: true
      });
    }

    if (action === "listInterestRates") {
      return jsonResponse({
        ok: true,
        rates: listInterestRates()
      });
    }

    if (action === "saveBookingReport") {
      return jsonResponse({
        ok: true,
        report: saveBookingReport(body.report || {})
      });
    }

    if (action === "lookupStockByPlate") {
      return jsonResponse({
        ok: true,
        vehicle: lookupStockByPlate(body.plate || "")
      });
    }

    if (action === "lookupCustomerById") {
      return jsonResponse({
        ok: true,
        customer: lookupCustomerById(body.idCard || "")
      });
    }

    if (action === "importStock") {
      return jsonResponse({
        ok: true,
        result: importStock(body.rows || [], body.sourceName || "")
      });
    }

    if (action === "getStockImportStatus") {
      return jsonResponse({
        ok: true,
        status: getStockImportStatus()
      });
    }

    throw new Error("Unknown action: " + action);
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: getErrorMessage(error)
    });
  }
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error("Invalid JSON body");
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getErrorMessage(error) {
  if (error && error.message) {
    return String(error.message);
  }
  return "Apps Script error";
}

function getSheet() {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  ensureHeader(sheet);
  return sheet;
}

function getInterestRateSheet() {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(RATE_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(RATE_SHEET_NAME);
    sheet.getRange(1, 1, 1, RATE_HEADERS.length).setValues([RATE_HEADERS]);
    sheet.getRange(2, 1, DEFAULT_INTEREST_RATES.length, RATE_HEADERS.length).setValues(DEFAULT_INTEREST_RATES);
    return sheet;
  }

  ensureInterestRateHeader(sheet);

  if (sheet.getLastRow() <= 1) {
    sheet.getRange(2, 1, DEFAULT_INTEREST_RATES.length, RATE_HEADERS.length).setValues(DEFAULT_INTEREST_RATES);
  }

  return sheet;
}

function getBookingSheet() {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(BOOKING_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(BOOKING_SHEET_NAME);
  }

  ensureSheetHeader(sheet, BOOKING_HEADERS);
  return sheet;
}

function getStockSheet() {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(STOCK_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(STOCK_SHEET_NAME);
  }

  ensureSheetHeader(sheet, STOCK_HEADERS);
  return sheet;
}

function ensureInterestRateHeader(sheet) {
  var range = sheet.getRange(1, 1, 1, RATE_HEADERS.length);
  var values = range.getValues()[0];
  var hasHeader = true;

  for (var index = 0; index < RATE_HEADERS.length; index += 1) {
    if (values[index] !== RATE_HEADERS[index]) {
      hasHeader = false;
      break;
    }
  }

  if (!hasHeader) {
    range.setValues([RATE_HEADERS]);
  }
}

function ensureHeader(sheet) {
  var range = sheet.getRange(1, 1, 1, HEADERS.length);
  var values = range.getValues()[0];
  var hasHeader = true;

  for (var index = 0; index < HEADERS.length; index += 1) {
    if (values[index] !== HEADERS[index]) {
      hasHeader = false;
      break;
    }
  }

  if (!hasHeader) {
    range.setValues([HEADERS]);
  }
}

function ensureSheetHeader(sheet, headers) {
  var range = sheet.getRange(1, 1, 1, headers.length);
  var values = range.getValues()[0];
  var hasHeader = true;

  for (var index = 0; index < headers.length; index += 1) {
    if (values[index] !== headers[index]) {
      hasHeader = false;
      break;
    }
  }

  if (!hasHeader) {
    range.setValues([headers]);
  }
}

function listCustomers() {
  var sheet = getSheet();
  var lastRow = sheet.getLastRow();
  var customers = [];

  if (lastRow <= 1) {
    return customers;
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();

  for (var index = 0; index < rows.length; index += 1) {
    var row = rows[index];
    var customer = {
      no: String(row[0] || ""),
      date: formatDate(row[1]),
      car: String(row[2] || ""),
      name: String(row[3] || ""),
      phone: String(row[4] || ""),
      note: String(row[5] || ""),
      rowIndex: index + 2
    };

    if (customer.no || customer.name || customer.phone || customer.car) {
      customers.push(customer);
    }
  }

  customers.sort(function (a, b) {
    return Number(b.no || 0) - Number(a.no || 0);
  });

  return customers;
}

function listInterestRates() {
  var sheet = getInterestRateSheet();
  var lastRow = sheet.getLastRow();
  var rates = [];

  if (lastRow <= 1) {
    return rates;
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, RATE_HEADERS.length).getValues();

  for (var index = 0; index < rows.length; index += 1) {
    var row = rows[index];
    var rate = {
      vehicleType: String(row[0] || "").trim(),
      yearRange: String(row[1] || "").trim(),
      months48: toNumberOrNull(row[2]),
      months60: toNumberOrNull(row[3]),
      months72: toNumberOrNull(row[4]),
      months84: toNumberOrNull(row[5]),
      commission: toNumberOrNull(row[6]) || 0
    };

    if (rate.vehicleType && rate.yearRange) {
      rates.push(rate);
    }
  }

  return rates;
}

function getNextCustomerNo(customers) {
  var maxNo = 0;

  for (var index = 0; index < customers.length; index += 1) {
    maxNo = Math.max(maxNo, Number(customers[index].no) || 0);
  }

  return maxNo + 1;
}

function updateCustomer(rowIndex, input) {
  if (!isValidRowIndex(rowIndex)) {
    throw new Error("Invalid row index");
  }

  var customer = cleanCustomer(input);
  var sheet = getSheet();
  var lastRow = sheet.getLastRow();

  if (rowIndex > lastRow) {
    throw new Error("Customer not found");
  }

  var existing = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];

  sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([[
    existing[0],
    existing[1],
    customer.car,
    customer.name,
    customer.phone,
    customer.note
  ]]);

  return {
    no: String(existing[0] || ""),
    date: formatDate(existing[1]),
    car: customer.car,
    name: customer.name,
    phone: customer.phone,
    note: customer.note,
    rowIndex: rowIndex
  };
}

function deleteCustomer(rowIndex) {
  if (!isValidRowIndex(rowIndex)) {
    throw new Error("Invalid row index");
  }

  var sheet = getSheet();
  var lastRow = sheet.getLastRow();

  if (rowIndex > lastRow) {
    throw new Error("Customer not found");
  }

  sheet.deleteRow(rowIndex);
}

function saveBookingReport(input) {
  var report = cleanBookingReport(input || {});
  var sheet = getBookingSheet();
  var now = new Date();
  var nowText = Utilities.formatDate(now, TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
  var id = "BR-" + Utilities.formatDate(now, TIME_ZONE, "yyyyMMdd-HHmmss") + "-" + Math.floor(Math.random() * 1000);

  sheet.appendRow([
    id,
    nowText,
    nowText,
    report.status,
    report.buyerType,
    report.customerName,
    report.idCard,
    report.phone,
    report.address,
    report.bookingPrice,
    report.plate,
    report.brand,
    report.model,
    report.year,
    report.color,
    report.salePrice,
    report.finalPrice,
    report.finalPriceNote,
    report.discount,
    report.paymentType,
    report.source,
    report.ownership,
    report.project,
    report.campaign,
    report.saleName,
    report.teamName,
    report.conditions,
    report.emailSubject,
    report.emailTo,
    report.emailCc,
    report.emailBcc,
    report.reportText,
    JSON.stringify(report.attachments || []),
    "draft_only",
    "draft_only",
    "not_run"
  ]);

  return {
    id: id,
    createdAt: nowText,
    updatedAt: nowText,
    status: report.status,
    buyerType: report.buyerType,
    customerName: report.customerName,
    idCard: report.idCard,
    phone: report.phone,
    address: report.address,
    bookingPrice: report.bookingPrice,
    plate: report.plate,
    brand: report.brand,
    model: report.model,
    year: report.year,
    color: report.color,
    salePrice: report.salePrice,
    finalPrice: report.finalPrice,
    finalPriceNote: report.finalPriceNote,
    discount: report.discount,
    paymentType: report.paymentType,
    source: report.source,
    ownership: report.ownership,
    project: report.project,
    campaign: report.campaign,
    saleName: report.saleName,
    teamName: report.teamName,
    conditions: report.conditions,
    emailSubject: report.emailSubject,
    emailTo: report.emailTo,
    emailCc: report.emailCc,
    emailBcc: report.emailBcc,
    reportText: report.reportText,
    attachments: report.attachments || []
  };
}

function cleanBookingReport(input) {
  var report = {
    status: "draft",
    buyerType: String(input.buyerType || "individual") === "company" ? "company" : "individual",
    customerName: String(input.customerName || "").trim(),
    idCard: String(input.idCard || "").trim(),
    phone: String(input.phone || "").trim(),
    address: String(input.address || "").trim(),
    bookingPrice: String(input.bookingPrice || "").trim(),
    plate: String(input.plate || "").trim(),
    brand: String(input.brand || "").trim(),
    model: String(input.model || "").trim(),
    year: String(input.year || "").trim(),
    color: String(input.color || "").trim(),
    salePrice: String(input.salePrice || "").trim(),
    finalPrice: String(input.finalPrice || "").trim(),
    finalPriceNote: String(input.finalPriceNote || "").trim(),
    discount: String(input.discount || "").trim(),
    paymentType: String(input.paymentType || "").trim(),
    source: String(input.source || "").trim(),
    ownership: String(input.ownership || "").trim(),
    project: String(input.project || "").trim(),
    campaign: String(input.campaign || "").trim(),
    saleName: String(input.saleName || "").trim(),
    teamName: String(input.teamName || "").trim(),
    conditions: String(input.conditions || "").trim(),
    emailSubject: String(input.emailSubject || "").trim(),
    emailTo: String(input.emailTo || "").trim(),
    emailCc: String(input.emailCc || "").trim(),
    emailBcc: String(input.emailBcc || "").trim(),
    reportText: String(input.reportText || "").trim(),
    attachments: Array.isArray(input.attachments) ? input.attachments : []
  };

  if (!report.customerName || !report.plate || !report.saleName) {
    throw new Error("Customer name, plate and sale are required");
  }

  return report;
}

function cleanStockRow(input) {
  return {
    plate: String(input.plate || "").trim(),
    brand: String(input.brand || "").trim(),
    model: String(input.model || "").trim(),
    year: String(input.year || "").trim(),
    color: String(input.color || "").trim(),
    salePrice: String(input.salePrice || "").trim(),
    source: String(input.source || "").trim(),
    ownership: String(input.ownership || "").trim(),
    project: String(input.project || "").trim(),
    campaign: String(input.campaign || "").trim()
  };
}

function lookupStockByPlate(plate) {
  var normalizedPlate = normalizePlate(plate);

  if (!normalizedPlate) {
    return null;
  }

  var sheet = getStockSheet();
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return null;
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, STOCK_HEADERS.length).getValues();

  for (var index = 0; index < rows.length; index += 1) {
    var row = rows[index];
    if (normalizePlate(row[0]) === normalizedPlate) {
      return {
        plate: String(row[0] || ""),
        brand: String(row[1] || ""),
        model: String(row[2] || ""),
        year: String(row[3] || ""),
        color: String(row[4] || ""),
        salePrice: String(row[5] || ""),
        source: String(row[6] || ""),
        ownership: String(row[7] || ""),
        project: String(row[8] || ""),
        campaign: String(row[9] || "")
      };
    }
  }

  return null;
}

function lookupCustomerById(idCard) {
  var normalizedIdCard = String(idCard || "").replace(/\D/g, "");

  if (!normalizedIdCard) {
    return null;
  }

  return null;
}

function importStock(rows, sourceName) {
  var sheet = getStockSheet();
  var now = new Date();
  var nowText = Utilities.formatDate(now, TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
  var lastRow = sheet.getLastRow();
  var plateIndex = {};
  var imported = 0;
  var updated = 0;
  var skipped = 0;

  if (lastRow > 1) {
    var existingRows = sheet.getRange(2, 1, lastRow - 1, STOCK_HEADERS.length).getValues();
    for (var existingIndex = 0; existingIndex < existingRows.length; existingIndex += 1) {
      var existingPlate = normalizePlate(existingRows[existingIndex][0]);
      if (existingPlate) {
        plateIndex[existingPlate] = existingIndex + 2;
      }
    }
  }

  var appendRows = [];

  for (var rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    var row = cleanStockRow(rows[rowIndex] || {});
    var normalizedPlate = normalizePlate(row.plate);

    if (!normalizedPlate) {
      skipped += 1;
      continue;
    }

    var values = [
      row.plate,
      row.brand,
      row.model,
      row.year,
      row.color,
      row.salePrice,
      row.source,
      row.ownership,
      row.project,
      row.campaign,
      nowText,
      nowText
    ];

    if (plateIndex[normalizedPlate]) {
      sheet.getRange(plateIndex[normalizedPlate], 1, 1, STOCK_HEADERS.length).setValues([values]);
      updated += 1;
    } else {
      appendRows.push(values);
      plateIndex[normalizedPlate] = true;
      imported += 1;
    }
  }

  if (appendRows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, appendRows.length, STOCK_HEADERS.length).setValues(appendRows);
  }

  return {
    imported: imported,
    updated: updated,
    skipped: skipped,
    total: rows.length,
    importedAt: nowText
  };
}

function getStockImportStatus() {
  var sheet = getStockSheet();
  var lastRow = sheet.getLastRow();
  var total = Math.max(lastRow - 1, 0);
  var latestImportedAt = "";
  var latestUpdatedAt = "";

  if (lastRow > 1) {
    var rows = sheet.getRange(2, 11, lastRow - 1, 2).getValues();
    for (var index = 0; index < rows.length; index += 1) {
      latestImportedAt = maxText(latestImportedAt, formatDateTime(rows[index][0]));
      latestUpdatedAt = maxText(latestUpdatedAt, formatDateTime(rows[index][1]));
    }
  }

  return {
    total: total,
    latestImportedAt: latestImportedAt,
    latestUpdatedAt: latestUpdatedAt
  };
}

function normalizePlate(value) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function cleanCustomer(input) {
  var customer = {
    car: String(input.car || "").trim(),
    name: String(input.name || "").trim(),
    phone: String(input.phone || "").trim(),
    note: String(input.note || "").trim()
  };

  if (!customer.car || !customer.name || !customer.phone) {
    throw new Error("Car, Name and Phone are required");
  }

  return customer;
}

function isValidRowIndex(rowIndex) {
  return rowIndex === Math.floor(rowIndex) && rowIndex > 1;
}

function formatDate(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, TIME_ZONE, "dd/MM/yyyy");
  }

  return String(value || "");
}

function formatDateTime(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
  }

  return String(value || "");
}

function maxText(currentValue, nextValue) {
  if (String(nextValue || "") > String(currentValue || "")) {
    return String(nextValue || "");
  }

  return String(currentValue || "");
}

function toNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  var numberValue = Number(value);
  if (isNaN(numberValue)) {
    return null;
  }

  return numberValue;
}
