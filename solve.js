// csv-reader-speed: a fast drop-in for make.fun's csv-reader 1.0.0.
//
// Same answers as csv-reader 1.0.0 on every input (the same broken-row
// policy), much faster: fields are cut out with native indexOf scans and
// string slices instead of being built one character at a time, and quoted
// fields are scanned for their closing quote the same way. Only the rare
// broken paths (stray CRs, line breaks inside quotes, an unterminated
// quote) fall back to small slow loops.
//
// The policy, csv-reader 1.0.0's: a U+FEFF at the very start is dropped; a
// record ends at LF or CRLF; a line left with no characters is no record;
// outside quotes a CR not followed by LF is dropped (stray_cr); a field
// opening with a quote runs to the next quote that is not doubled, "" in
// it one quote and each CRLF or lone CR in it read as LF; what follows its
// closing quote, up to the next comma or line break, is appended as it
// stands (quote_junk, when the field ends); a quote that never closes is
// a literal character and the text after it is read again as unquoted
// (unterminated_quote); a quote inside an unquoted field is literal;
// fields stay strings, never trimmed or converted; columns is the first
// record when header is true, else null; rows are padded with "" (short_row,
// with fields: its field count) or cut (long_row, with extra: the cut
// fields) to the first record's width; each error is {code, line, row} in
// the order met, line the 1-based line its record starts on (counting every
// LF, CRLF and lone CR inside quotes), row its record's index in rows
// (null for the header).
//
// Written from scratch for this competition; the reference (csv-reader
// 1.0.0, in the kit's baselines/csv-reader/vendor/) was read only to pin
// down the semantics above. Dependency-free, no state kept between calls.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input {text, header}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (len > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // The kept text of `seg` with every '\r' in it dropped, each a stray_cr.
  // Every '\r' handed here is stray: a CR followed by LF never reaches it,
  // because it ends the field instead. The scan stays inside `seg`.
  function stripStrayCRs(seg) {
    let kept = '';
    let p = 0;
    for (;;) {
      const r = seg.indexOf('\r', p);
      if (r === -1) return kept + seg.slice(p);
      kept += seg.slice(p, r);
      error('stray_cr');
      p = r + 1;
    }
  }

  // Reads unquoted characters onto `initial`, up to the next comma, line
  // break or the end of the text. Returns the field, how it ended, and how
  // many characters were kept (the quote_junk check counts kept characters).
  function readUnquoted(initial) {
    let value = initial;
    let added = 0;
    const iComma = text.indexOf(',', pos);
    const iLF = text.indexOf('\n', pos);
    if (iComma === -1 && iLF === -1) {
      const seg = text.slice(pos);
      if (seg.indexOf('\r') === -1) {
        value += seg;
        added += seg.length;
      } else {
        const kept = stripStrayCRs(seg);
        value += kept;
        added += kept.length;
      }
      pos = len;
      return { value, ended: END, added };
    }
    let end;
    let kind;
    if (iLF === -1 || (iComma !== -1 && iComma < iLF)) {
      end = iComma;
      kind = COMMA;
    } else {
      end = iLF;
      kind = LINE_BREAK;
    }
    // A CR just before the LF is the CRLF pair: it ends the field, it is
    // not part of it.
    let segEnd = end;
    if (kind === LINE_BREAK && end > pos && text.charCodeAt(end - 1) === 13) segEnd = end - 1;
    const seg = text.slice(pos, segEnd);
    if (seg.indexOf('\r') === -1) {
      value += seg;
      added += seg.length;
    } else {
      const kept = stripStrayCRs(seg);
      value += kept;
      added += kept.length;
    }
    pos = end + 1;
    if (kind === COMMA) return { value, ended: COMMA, added };
    line += 1;
    return { value, ended: LINE_BREAK, added };
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    let value = '';
    for (;;) {
      const q = text.indexOf('"', pos);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text
        // after it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        error('unterminated_quote');
        return readUnquoted('"');
      }
      const seg = text.slice(pos, q);
      if (seg.indexOf('\n') === -1 && seg.indexOf('\r') === -1) {
        value += seg;
      } else {
        // Line breaks inside the quotes: each CRLF or lone CR is one LF.
        let s = 0;
        for (;;) {
          const nl = seg.indexOf('\n', s);
          const cr = seg.indexOf('\r', s);
          let br = -1;
          let isCR = false;
          if (nl !== -1 && (cr === -1 || nl < cr)) br = nl;
          else if (cr !== -1) {
            br = cr;
            isCR = true;
          }
          if (br === -1) break;
          value += seg.slice(s, br);
          value += '\n';
          line += 1;
          s = br + (isCR && seg.charCodeAt(br + 1) === 10 ? 2 : 1);
        }
        value += seg.slice(s);
      }
      if (text.charCodeAt(q + 1) === 34) {
        value += '"';
        pos = q + 2;
        continue;
      }
      pos = q + 1;
      break;
    }
    if (pos >= len) return { value, ended: END };
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      return { value, ended: COMMA };
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    // What follows the closing quote is appended as it stands, up to the
    // next comma or line break.
    const junk = readUnquoted(value);
    if (junk.added > 0) error('quote_junk');
    return junk;
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let quoted = false;
    do {
      quoted = text.charCodeAt(pos) === 34;
      field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while (field.ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
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
