// Renders a question stem. Lines of the form "| a | b |" (from tables in the PDF) become an HTML table.

export function parseStem(text: string): ({ kind: 'text'; text: string } | { kind: 'table'; rows: string[][] })[] {
  const blocks: ({ kind: 'text'; text: string } | { kind: 'table'; rows: string[][] })[] = [];
  for (const line of text.split('\n')) {
    const isRow = line.startsWith('| ') && line.endsWith(' |');
    const last = blocks[blocks.length - 1];
    if (isRow) {
      const cells = line.slice(2, -2).split(' | ');
      if (last?.kind === 'table') last.rows.push(cells);
      else blocks.push({ kind: 'table', rows: [cells] });
    } else blocks.push({ kind: 'text', text: line });
  }
  return blocks;
}

export function Stem({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-base leading-relaxed sm:text-lg">
      {parseStem(text).map((b, i) =>
        b.kind === 'text' ? (
          <p key={i}>{b.text}</p>
        ) : (
          <div key={i} className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm tabular-nums">
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r} className={r === 0 ? 'font-semibold' : ''}>
                    {row.map((c, j) => (
                      <td key={j} className="border border-slate-200 px-2 py-1 dark:border-slate-700">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      )}
    </div>
  );
}
