// Fast drop-in for csv-reader 1.0.0 (make.fun's own CSV reader), written from the
// semantics the competition kit publishes: the same answer for every input, less CPU time.
//
// The reference reads one character at a time and builds every field up a character at a
// time. This reader jumps between delimiters with indexOf and slices whole fields at once;
// a record whose line holds no quote and no stray carriage return is split straight off
// its line. The broken-row policy is the reference's own, step for step:
//
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no record;
//   - outside a quoted field a CR not followed by LF is dropped (stray_cr);
//   - a field that opens with a quote runs to the next quote that is not doubled, "" inside
//     it one quote, and each CRLF or lone CR inside it is read as LF; what follows its
//     closing quote, up to the next comma or line break, is appended as it stands
//     (quote_junk, when the field ends); a quote that never closes is a literal character
//     and the text after it is read again as an unquoted field (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay strings;
//   - columns is the first record when header is true, else null; rows holds the records
//     after it, each padded with "" (short_row, with fields: its count) or cut (long_row,
//     with extra: the cut fields) to the first record's width;
//   - each error is {code, line, row}: line the 1-based line its record starts on (every
//     LF, CRLF and lone CR inside a quoted field counted), row its record's index in rows
//     (null for the header), in the order met.
//
// Pure: no clock, no randomness, no locale, nothing kept from one call to the next.

/** How a field ended: at a comma (the record goes on), at a line break or at the end. */
const COMMA = 0;
const BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input {text, header}: {columns, rows, errors}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The end of the current line (the next LF, or n), or -1 when it is not known: the
  // line-aware unquoted reader uses it so a field needs one indexOf instead of three.
  let le = -1;

  // Reads unquoted characters onto `prefix` up to the next comma or line break: a CR not
  // followed by LF is dropped (stray_cr). Returns the field, how it ended, and how many
  // characters it kept (not counting the prefix).
  function readUnquoted(prefix) {
    let acc = null; // parts joined only when a stray CR split the field
    let seg = pos;
    let added = 0;
    for (;;) {
      const comma = text.indexOf(',', pos);
      const nl = text.indexOf('\n', pos);
      const cr = text.indexOf('\r', pos);
      let d = comma === -1 ? Infinity : comma;
      if (nl !== -1 && nl < d) d = nl;
      if (cr !== -1 && cr < d) d = cr;
      if (d === Infinity) {
        pos = n;
        if (acc === null) return { value: prefix + text.slice(seg), ended: END, added: added + (n - seg) };
        acc.push(text.slice(seg));
        return { value: acc.join(''), ended: END, added: added + (n - seg) };
      }
      const ch = text.charCodeAt(d);
      if (ch === 44) {
        pos = d + 1;
        if (acc === null) return { value: prefix + text.slice(seg, d), ended: COMMA, added: added + (d - seg) };
        acc.push(text.slice(seg, d));
        return { value: acc.join(''), ended: COMMA, added: added + (d - seg) };
      }
      if (ch === 10) {
        pos = d + 1;
        line += 1;
        if (acc === null) return { value: prefix + text.slice(seg, d), ended: BREAK, added: added + (d - seg) };
        acc.push(text.slice(seg, d));
        return { value: acc.join(''), ended: BREAK, added: added + (d - seg) };
      }
      if (text.charCodeAt(d + 1) === 10) {
        // CRLF: one line break.
        pos = d + 2;
        line += 1;
        if (acc === null) return { value: prefix + text.slice(seg, d), ended: BREAK, added: added + (d - seg) };
        acc.push(text.slice(seg, d));
        return { value: acc.join(''), ended: BREAK, added: added + (d - seg) };
      }
      // A lone CR is dropped, and the field goes on past it.
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      if (acc === null) acc = [prefix];
      acc.push(text.slice(seg, d));
      added += d - seg;
      pos = d + 1;
      seg = d + 1;
    }
  }

  // Reads an unquoted field whose line ends at `le` (the next LF, or n): the field ends
  // at the next comma or at the line end, and a CR inside it is a lone CR (stray_cr)
  // unless it is the CRLF that ends the line. Same return shape as readUnquoted, and
  // only one indexOf a field in the common case.
  function readUnquotedLE(prefix, le) {
    let acc = null; // parts joined only when a stray CR split the field
    let seg = pos;
    let added = 0;
    for (;;) {
      const comma = text.indexOf(',', pos);
      if (comma !== -1 && comma < le) {
        const cr = text.indexOf('\r', pos);
        if (cr === -1 || cr >= comma) {
          pos = comma + 1;
          if (acc === null) return { value: prefix + text.slice(seg, comma), ended: COMMA, added: added + (comma - seg) };
          acc.push(text.slice(seg, comma));
          return { value: acc.join(''), ended: COMMA, added: added + (comma - seg) };
        }
        // A lone CR before the comma: dropped, and the field goes on past it.
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        if (acc === null) acc = [prefix];
        acc.push(text.slice(seg, cr));
        added += cr - seg;
        pos = cr + 1;
        seg = cr + 1;
        continue;
      }
      // No comma before the line end: the field runs to it.
      const cr = text.indexOf('\r', pos);
      if (cr === -1 || cr >= le) {
        if (le < n) {
          pos = le + 1;
          line += 1;
          if (acc === null) return { value: prefix + text.slice(seg, le), ended: BREAK, added: added + (le - seg) };
          acc.push(text.slice(seg, le));
          return { value: acc.join(''), ended: BREAK, added: added + (le - seg) };
        }
        pos = n;
        if (acc === null) return { value: prefix + text.slice(seg), ended: END, added: added + (n - seg) };
        acc.push(text.slice(seg));
        return { value: acc.join(''), ended: END, added: added + (n - seg) };
      }
      if (cr === le - 1 && le < n) {
        // The CRLF that ends the line (le is a real LF; at the end of the text a CR
        // at le - 1 is a lone CR, not a CRLF).
        pos = le + 1;
        line += 1;
        if (acc === null) return { value: prefix + text.slice(seg, cr), ended: BREAK, added: added + (cr - seg) };
        acc.push(text.slice(seg, cr));
        return { value: acc.join(''), ended: BREAK, added: added + (cr - seg) };
      }
      // A lone CR inside the field: dropped, and the field goes on past it.
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      if (acc === null) acc = [prefix];
      acc.push(text.slice(seg, cr));
      added += cr - seg;
      pos = cr + 1;
      seg = cr + 1;
    }
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
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
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    // Fast path: this record's line holds no quote and no lone carriage return, so every
    // field on it is unquoted and the line splits on commas alone.
    const nl = text.indexOf('\n', pos);
    const lineEnd = nl === -1 ? n : nl;
    const q0 = text.indexOf('"', pos);
    let fields = null;
    let lastQuoted = false;
    if (q0 === -1 || q0 >= lineEnd) {
      const cr0 = text.indexOf('\r', pos);
      if (cr0 === -1 || cr0 >= lineEnd || (cr0 === lineEnd - 1 && nl !== -1)) {
        const end = cr0 === lineEnd - 1 && nl !== -1 ? lineEnd - 1 : lineEnd;
        fields = [];
        let f = pos;
        for (;;) {
          const comma = text.indexOf(',', f);
          if (comma === -1 || comma >= end) {
            fields.push(text.slice(f, end));
            break;
          }
          fields.push(text.slice(f, comma));
          f = comma + 1;
        }
        pos = nl === -1 ? n : nl + 1;
        if (nl !== -1) line += 1;
      }
    }

    if (fields === null) {
      // General path: at least one quoted field, or a lone CR, on this record's first line.
      le = lineEnd;
      fields = [];
      let quoted = false;
      let ended = COMMA;
      do {
        let value;
        if (pos < n && text.charCodeAt(pos) === 34) {
          quoted = true;
          const open = pos;
          const openLine = line;
          pos += 1;
          let seg = pos;
          let acc = null;
          let closed = false;
          let scan = pos;
          for (;;) {
            const q = text.indexOf('"', scan);
            if (q === -1) break;
            const r = text.indexOf('\r', scan);
            if (r !== -1 && r < q) {
              // A CR inside the quotes, before the next quote: one LF in the value.
              if (acc === null) acc = [];
              acc.push(text.slice(seg, r));
              let p = seg;
              for (;;) {
                const x = text.indexOf('\n', p);
                if (x === -1 || x >= r) break;
                line += 1;
                p = x + 1;
              }
              acc.push('\n');
              line += 1;
              scan = r + 1;
              if (text.charCodeAt(scan) === 10) scan += 1;
              seg = scan;
              continue;
            }
            if (text.charCodeAt(q + 1) === 34) {
              // A doubled quote: one literal quote in the value.
              if (acc === null) acc = [];
              acc.push(text.slice(seg, q));
              let p = seg;
              for (;;) {
                const x = text.indexOf('\n', p);
                if (x === -1 || x >= q) break;
                line += 1;
                p = x + 1;
              }
              acc.push('"');
              scan = q + 2;
              seg = q + 2;
              continue;
            }
            // The closing quote.
            let p = seg;
            for (;;) {
              const x = text.indexOf('\n', p);
              if (x === -1 || x >= q) break;
              line += 1;
              p = x + 1;
            }
            if (acc === null) value = text.slice(seg, q);
            else {
              acc.push(text.slice(seg, q));
              value = acc.join('');
            }
            pos = q + 1;
            closed = true;
            break;
          }
          if (!closed) {
            // The quote never closes: it is a literal character, and the text after it is
            // read again as an unquoted field.
            pos = open + 1;
            line = openLine;
            errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
            const uq = readUnquoted('"');
            value = uq.value;
            ended = uq.ended;
          } else if (pos >= n) {
            ended = END;
          } else {
            const c = text.charCodeAt(pos);
            if (c === 44) {
              pos += 1;
              ended = COMMA;
            } else if (c === 10) {
              pos += 1;
              line += 1;
              ended = BREAK;
            } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
              pos += 2;
              line += 1;
              ended = BREAK;
            } else {
              // What follows the closing quote is appended as it stands, up to the next
              // comma or line break.
              const junk = readUnquoted(value);
              if (junk.added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
              value = junk.value;
              ended = junk.ended;
            }
          }
          // A quoted field may have crossed lines: the line end is not known any more.
          le = -1;
        } else {
          quoted = false;
          if (le === -1) {
            const x = text.indexOf('\n', pos);
            le = x === -1 ? n : x;
          }
          const uq = readUnquotedLE('', le);
          value = uq.value;
          ended = uq.ended;
        }
        fields.push(value);
        lastQuoted = quoted;
      } while (ended === COMMA);
    }

    // A line that held only stray CRs is left with no characters: no record (its stray_cr
    // errors stay).
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

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
