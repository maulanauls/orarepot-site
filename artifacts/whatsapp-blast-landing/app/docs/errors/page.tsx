import type { Metadata } from 'next';
import { DocsArticle, DocsCodeBlock } from '@/components/docs/docs-article';

export const metadata: Metadata = { title: 'Errors' };
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardTable } from '@/components/ui/card';

export default function Page() {
  return (
    <DocsArticle
      section="Sending & receiving"
      title="Errors"
      lead="Error codes are stable. Branch on code, not on the human message."
    >
      <h2 id="shape">Envelope</h2>
      <DocsCodeBlock>
        {`{
  "error": {
    "code": "insufficient_balance",
    "message": "Deposit tidak cukup untuk 1 OTP (Rp 600)."
  }
}`}
      </DocsCodeBlock>
      <h2 id="codes">Codes</h2>
      <Card className="my-5">
        <CardTable>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <code>unauthorized</code>
                </TableCell>
                <TableCell>Missing or revoked key</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <code>template_not_active</code>
                </TableCell>
                <TableCell>Template is not ACTIVE</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <code>invalid_phone</code>
                </TableCell>
                <TableCell>Number is not E.164</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <code>insufficient_balance</code>
                </TableCell>
                <TableCell>Reserve debit failed</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardTable>
      </Card>
    </DocsArticle>
  );
}
