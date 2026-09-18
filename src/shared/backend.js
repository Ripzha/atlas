/* PROJECT ATLAS - Backend addresses.
   Shared by the forum scripts (src/forum/). The Apps Script address changes
   only when the script is deployed as a new version; then it is changed here
   once. The sheet addresses are the published CSV exports of the Google Sheet. */

export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzJ_fMI1LBjmFAQDhjD1sr3hJtdUj4OOor_WiWX3asl_eX0FXDN1wr64cNON3odhHdX/exec';

// Tab "Charaktere"
export const CHARS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRRllRkwaCacdM0WZZT0cVQflhxJ9Fw5mgId-v615_kE2GdKdbwHMUYCG03HC8gUXfg7lucTs1Mqhg1/pub?output=csv&gid=474514580&single=true';

// Tab "Grundstücke"
export const LOTS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRRllRkwaCacdM0WZZT0cVQflhxJ9Fw5mgId-v615_kE2GdKdbwHMUYCG03HC8gUXfg7lucTs1Mqhg1/pub?output=csv&gid=306313316&single=true';

// Calls the Apps Script with GET parameters. Write actions use mode "no-cors"
// (the answer cannot be read, the request still arrives).
export function callAppsScript(params, options){
  return fetch(APPS_SCRIPT_URL + '?' + new URLSearchParams(params).toString(), options);
}
