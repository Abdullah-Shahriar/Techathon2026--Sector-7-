import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function DataTable({ columns, rows }: { columns: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => <TableHead key={column}>{column}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {row.map((cell, cellIndex) => <TableCell key={cellIndex}>{cell}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ResponsiveTableOrCards({
  columns,
  rows,
  cards
}: {
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
  cards: React.ReactNode;
}) {
  return (
    <>
      <div className="hidden md:block"><DataTable columns={columns} rows={rows} /></div>
      <div className="grid gap-3 md:hidden">{cards}</div>
    </>
  );
}
