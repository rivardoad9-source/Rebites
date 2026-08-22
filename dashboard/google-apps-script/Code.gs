/**
 * Mango Cheese Dashboard & POS — jembatan Google Sheets -> Dashboard.
 *
 * Fungsinya: setiap kali ada perubahan MANUAL langsung di spreadsheet
 * (tambah baris penjualan, ubah total belanja batch, hapus baris OPEX),
 * script ini memanggil endpoint /api/sync di dashboard supaya logika FIFO
 * dan seluruh metrik dihitung ulang, lalu kolom turunannya ditulis balik
 * ke sheet ini.
 *
 * ── CARA PASANG ─────────────────────────────────────────────────────────
 * 1. Buka spreadsheet -> menu Extensions -> Apps Script.
 * 2. Tempel seluruh isi file ini, lalu Save.
 * 3. Menu Project Settings -> Script properties, tambahkan:
 *      DASHBOARD_URL = https://domain-dashboard-anda.com   (tanpa slash akhir)
 *      SYNC_SECRET   = nilai yang sama persis dengan env SYNC_SECRET dashboard
 * 4. Jalankan sekali fungsi `setupTriggers` (menu Run) dan setujui izinnya.
 *    Ini memasang trigger onEdit + onChange versi installable — versi
 *    installable dibutuhkan karena trigger sederhana tidak boleh memanggil
 *    layanan eksternal seperti UrlFetchApp.
 * 5. Selesai. Menu "Mango POS" juga muncul di spreadsheet untuk sinkron manual.
 * ────────────────────────────────────────────────────────────────────────
 */

var TRACKED_SHEETS = ['Batches', 'Sales', 'Expenses'];

/** Pasang trigger installable (jalankan sekali secara manual). */
function setupTriggers() {
  var ss = SpreadsheetApp.getActive();

  // Bersihkan trigger lama supaya tidak dobel saat script dipasang ulang.
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    var fn = trigger.getHandlerFunction();
    if (fn === 'onSheetEdit' || fn === 'onSheetChange') ScriptApp.deleteTrigger(trigger);
  });

  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('onSheetChange').forSpreadsheet(ss).onChange().create();

  SpreadsheetApp.getActive().toast('Trigger onEdit & onChange aktif.', 'Mango POS', 5);
}

/** Menu manual di spreadsheet. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Mango POS')
    .addItem('Sinkronkan & hitung ulang FIFO', 'syncNow')
    .addSeparator()
    .addItem('Pasang ulang trigger otomatis', 'setupTriggers')
    .addToUi();
}

/** Trigger: sel diedit manual. */
function onSheetEdit(e) {
  if (!e || !e.range) return syncNow();
  var name = e.range.getSheet().getName();
  if (TRACKED_SHEETS.indexOf(name) === -1) return;
  if (e.range.getRow() === 1) return; // baris header, bukan data
  scheduleSync_(name + '!' + e.range.getA1Notation());
}

/** Trigger: baris ditambah/dihapus, sheet di-import, dsb. */
function onSheetChange(e) {
  var type = e && e.changeType ? e.changeType : 'OTHER';
  if (['EDIT', 'INSERT_ROW', 'REMOVE_ROW', 'INSERT_GRID', 'REMOVE_GRID', 'OTHER'].indexOf(type) === -1) {
    return;
  }
  scheduleSync_('changeType=' + type);
}

/**
 * Debounce sederhana: kalau beberapa sel diedit beruntun, cukup satu panggilan
 * dalam rentang 5 detik supaya kuota UrlFetchApp tidak habis.
 */
function scheduleSync_(reason) {
  var cache = CacheService.getScriptCache();
  if (cache.get('sync-lock')) return;
  cache.put('sync-lock', '1', 5);
  syncNow(reason);
}

/** Panggil endpoint re-kalkulasi di dashboard. */
function syncNow(reason) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('DASHBOARD_URL');
  var secret = props.getProperty('SYNC_SECRET') || '';

  if (!url) {
    Logger.log('DASHBOARD_URL belum diisi di Script properties.');
    return;
  }

  var payload = {
    secret: secret,
    source: 'google-apps-script',
    reason: reason || 'manual',
    at: new Date().toISOString(),
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-sync-secret': secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    var response = UrlFetchApp.fetch(url.replace(/\/$/, '') + '/api/sync', options);
    var code = response.getResponseCode();
    Logger.log('Sync ' + code + ': ' + response.getContentText().slice(0, 300));
    if (code >= 400) {
      SpreadsheetApp.getActive().toast('Sinkron gagal (HTTP ' + code + ')', 'Mango POS', 5);
    }
  } catch (err) {
    Logger.log('Sync error: ' + err);
  }
}
