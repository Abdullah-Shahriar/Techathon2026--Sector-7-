import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function DataTable({ columns, rows, rowClasses = [] }: { columns: string[]; rows: Array<Array<React.ReactNode>>; rowClasses?: string[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card/70 backdrop-blur">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => <TableHead key={column}>{column}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow key={rowIndex} className={cn(rowClasses[rowIndex])}>
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
