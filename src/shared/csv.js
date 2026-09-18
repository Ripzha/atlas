/* PROJECT ATLAS - CSV reading.
   Reads the published sheet exports. Handles quoted fields, so values that
   contain commas, quotes or line breaks stay intact. */

// Splits CSV text into rows of fields.
export function parseCsv(text){
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for(let i = 0; i < text.length; i++){
    const ch = text[i];
    if(inQuotes){
      if(ch === '"'){
        if(text[i + 1] === '"'){ field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if(ch === '"') inQuotes = true;
    else if(ch === ',') { row.push(field); field = ''; }
    else if(ch === '\n' || ch === '\r'){
      if(ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if(field !== '' || row.length){ row.push(field); rows.push(row); }
  return rows;
}

// Returns one object per row, keyed by the header names in lower case
// (e.g. "thread url", "bild url"). Values are trimmed; empty rows are skipped.
export function csvToObjects(text){
  const rows = parseCsv(text);
  if(!rows.length) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1)
    .filter(r => r.some(v => v.trim() !== ''))
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (r[i] || '').trim(); });
      return obj;
    });
}

// Fetches a published sheet tab and returns its rows as objects.
export function fetchCsvObjects(url){
  return fetch(url).then(r => r.text()).then(csvToObjects);
}
