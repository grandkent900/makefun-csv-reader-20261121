// Fast drop-in replacement for csv-reader 1.0.0 (make.fun csv-reader-speed-01).
// Returns exactly {columns, rows, errors} as the reference readCsv for every input.
// Strategy: single left-to-right pass, fields built from string slices (never
// char-by-char concatenation); segment lists only when a field contains a
// dropped stray CR (unquoted) or an escape/CR conversion (quoted).

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = n > 0 && text.charCodeAt(0) === 0xFEFF ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;

  // Unquoted scan starting at pos, with `value` as the already-kept prefix
  // ('' for a plain field, '"' for an unterminated quote, or the quoted
  // content for quote junk). Returns [value, ended, added] where
  // ended: 0 comma, 1 line break, 2 end; added: chars kept by this scan.
  function readUnquoted(value) {
    const initLen = value.length;
    let parts = null;
    let seg = pos;
    let i = pos;
    let ended = 2;
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 44) { // ,
        ended = 0; break;
      }
      if (c === 10) { // \n
        ended = 1; break;
      }
      if (c === 13) { // \r
        if (i + 1 < n && text.charCodeAt(i + 1) === 10) { ended = 1; break; }
        // stray CR: dropped, error in place
        if (parts === null) parts = [];
        parts.push(text.slice(seg, i));
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        i += 1;
        seg = i;
        continue;
      }
      i += 1;
    }
    let out;
    if (parts === null) {
      out = initLen === 0 ? text.slice(seg, i) : value + text.slice(seg, i);
    } else {
      parts.push(text.slice(seg, i));
      out = initLen === 0 ? parts.join('') : value + parts.join('');
    }
    if (ended === 0) {
      pos = i + 1;
    } else if (ended === 1) {
      pos = text.charCodeAt(i) === 13 ? i + 2 : i + 1;
      line += 1;
    } else {
      pos = n;
    }
    return [out, ended, out.length - initLen];
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) { pos += 1; line += 1; }
      else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) { pos += 2; line += 1; }
      else break;
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let lastQuoted = false;
    let ended = 0;

    do {
      if (pos < n && text.charCodeAt(pos) === 34) { // opening "
        lastQuoted = true;
        const open = pos;
        const openLine = line;
        // Scan the quoted body in segments.
        let parts = null;
        let seg = pos + 1;
        let i = pos + 1;
        let closed = false;
        while (i < n) {
          const c = text.charCodeAt(i);
          if (c === 34) { // "
            if (i + 1 < n && text.charCodeAt(i + 1) === 34) {
              if (parts === null) parts = [];
              parts.push(text.slice(seg, i), '"');
              i += 2; seg = i; continue;
            }
            i += 1; closed = true; break;
          }
          if (c === 13) { // CR or CRLF inside quotes -> one LF
            if (parts === null) parts = [];
            parts.push(text.slice(seg, i), '\n');
            line += 1;
            i += (i + 1 < n && text.charCodeAt(i + 1) === 10) ? 2 : 1;
            seg = i; continue;
          }
          if (c === 10) line += 1;
          i += 1;
        }
        if (!closed) {
          // Literal quote; the rest is read again as unquoted.
          pos = open + 1;
          line = openLine;
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          const r = readUnquoted('"');
          fields.push(r[0]);
          ended = r[1];
          continue;
        }
        let value;
        if (parts === null) value = text.slice(seg, i - 1);
        else { parts.push(text.slice(seg, i - 1)); value = parts.join(''); }
        pos = i;
        if (pos >= n) {
          fields.push(value); ended = 2;
        } else {
          const c = text.charCodeAt(pos);
          if (c === 44) { pos += 1; fields.push(value); ended = 0; }
          else if (c === 10) { pos += 1; line += 1; fields.push(value); ended = 1; }
          else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) { pos += 2; line += 1; fields.push(value); ended = 1; }
          else {
            const r = readUnquoted(value);
            if (r[2] > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
            fields.push(r[0]); ended = r[1];
          }
        }
      } else {
        lastQuoted = false;
        const r = readUnquoted('');
        fields.push(r[0]);
        ended = r[1];
      }
    } while (ended === 0);

    // A line that held only stray CRs is no record (its errors stay).
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) { columns = fields; continue; }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
