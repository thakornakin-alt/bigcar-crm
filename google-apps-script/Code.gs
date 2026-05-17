var SHEET_ID = "1EASeG92OYIneG6cILkU-yCdkB6krn_EX3QBDY-AN6Cc";
var SHEET_NAME = "Customers";
var HEADERS = ["No", "Date", "Car", "Name", "Phone", "Note"];
var TIME_ZONE = "Asia/Bangkok";
var API_VERSION = "2026-05-17-02";

function doGet() {
  return jsonResponse({
    ok: true,
    message: "Big Car CRM Apps Script API is ready",
    version: API_VERSION,
    functions: {
      doPost: typeof doPost,
      listCustomers: typeof listCustomers,
      addCustomer: typeof addCustomer,
      updateCustomer: typeof updateCustomer,
      deleteCustomer: typeof deleteCustomer
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
