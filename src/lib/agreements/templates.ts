// Professional agreement templates ("letter types"). Picking one pre-fills the
// title, type, confidentiality default, and a real, editable document body that
// the signer sees and fields are placed on. {{COMPANY}} is substituted with the
// business name; the owner can edit everything before sending.
import type { AgreementType } from './types';

export interface AgreementTemplate {
  id: string;
  label: string;
  type: AgreementType;
  blurb: string;
  /** Sensitive types default to Private (hidden from non-admin staff). */
  defaultPrivate?: boolean;
  body: string;
}

const sign = `\n\nIN WITNESS WHEREOF, the parties have executed this agreement as of the date of the last signature below.\n\nFor and on behalf of {{COMPANY}}\n\n______________________________\nName / Title\n\nCounterparty\n\n______________________________\nName / Title`;

export const AGREEMENT_TEMPLATES: AgreementTemplate[] = [
  {
    id: 'tmpl-service-standard', label: 'Service Agreement', type: 'service',
    blurb: 'Engage a client or vendor for services, scope, fees and terms.',
    body:
`SERVICE AGREEMENT

This Service Agreement (the "Agreement") is entered into between {{COMPANY}} ("Provider") and the undersigned counterparty ("Client").

1. Services. Provider shall perform the services described in the attached scope of work with reasonable skill and care.
2. Fees & Payment. Client shall pay the agreed fees within the payment terms stated on each invoice. Late amounts may accrue interest as permitted by law.
3. Term & Termination. This Agreement continues until the services are complete or until terminated by either party on written notice.
4. Confidentiality. Each party shall keep the other's confidential information secret and use it only to perform this Agreement.
5. Liability. Neither party is liable for indirect or consequential loss; total liability is limited to the fees paid under this Agreement.
6. Governing Law. This Agreement is governed by the laws of the Provider's place of business.${sign}`,
  },
  {
    id: 'tmpl-sales-order', label: 'Sales / Order Agreement', type: 'sales',
    blurb: 'Confirm a sale or purchase order, goods, price and delivery.',
    body:
`SALES AGREEMENT

This Sales Agreement is made between {{COMPANY}} ("Seller") and the undersigned buyer ("Buyer").

1. Goods. Seller agrees to sell and Buyer agrees to purchase the goods set out in the order.
2. Price & Payment. The total price is as stated in the order, payable per the agreed terms. Title passes on full payment.
3. Delivery. Seller shall deliver within the agreed timeframe. Risk passes on delivery.
4. Warranty. Goods are warranted to conform to their description and to be free from material defects.
5. Returns. Returns are accepted in line with Seller's published policy.
6. Governing Law. This Agreement is governed by the laws of the Seller's place of business.${sign}`,
  },
  {
    id: 'tmpl-nda-mutual', label: 'Mutual NDA', type: 'nda', defaultPrivate: true,
    blurb: 'Protect confidential information shared between two parties.',
    body:
`MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement is entered into between {{COMPANY}} and the undersigned counterparty (each a "Party").

1. Purpose. The Parties wish to explore a potential business relationship and may share confidential information.
2. Confidential Information. Any non-public business, technical or financial information disclosed by one Party to the other.
3. Obligations. Each Party shall protect the other's Confidential Information with at least reasonable care and use it only for the Purpose.
4. Exclusions. Information that is public, already known, or independently developed is not confidential.
5. Term. Confidentiality obligations survive for three (3) years from disclosure.
6. No License. No rights are granted except as expressly set out here.${sign}`,
  },
  {
    id: 'tmpl-employment', label: 'Employment Contract', type: 'employment', defaultPrivate: true,
    blurb: 'Hire an employee — role, salary, hours and terms.',
    body:
`EMPLOYMENT AGREEMENT

This Employment Agreement is made between {{COMPANY}} ("Employer") and the undersigned ("Employee").

1. Position. Employee is engaged in the role and duties agreed between the parties, reporting as directed.
2. Start Date & Hours. Employment begins on the agreed start date with the agreed working hours.
3. Remuneration. Employer shall pay the agreed salary and any benefits, less lawful deductions, on the normal pay cycle.
4. Confidentiality & IP. Employee shall keep Employer's information confidential; work product created in the role belongs to Employer.
5. Termination. Either party may end the employment on the agreed notice, subject to applicable law.
6. Governing Law. This Agreement is governed by the laws of the Employer's place of business.${sign}`,
  },
  {
    id: 'tmpl-offer-letter', label: 'Offer Letter', type: 'employment', defaultPrivate: true,
    blurb: 'Extend a job offer for the candidate to accept and sign.',
    body:
`OFFER OF EMPLOYMENT

Dear Candidate,

On behalf of {{COMPANY}}, we are delighted to offer you the position discussed, on the following principal terms:

• Role: as agreed between us
• Start date: as agreed
• Remuneration: the agreed salary and benefits, paid on the normal cycle
• Probation: a standard probationary period may apply

This offer is conditional on satisfactory references and your right to work. Your employment will be governed by our standard employment terms. To accept, please sign below.

We look forward to welcoming you to the team.

For and on behalf of {{COMPANY}}

______________________________
Name / Title

Accepted by Candidate

______________________________
Name / Date`,
  },
  {
    id: 'tmpl-partnership', label: 'Partnership Agreement', type: 'partnership',
    blurb: 'Define a partnership — contributions, split and responsibilities.',
    body:
`PARTNERSHIP AGREEMENT

This Partnership Agreement is entered into between {{COMPANY}} and the undersigned partner.

1. Purpose. The parties agree to collaborate on the venture described between them.
2. Contributions. Each party shall provide the resources, capital or services agreed.
3. Profit & Loss. Profits and losses shall be shared in the agreed proportions.
4. Responsibilities. Each party shall carry out its agreed responsibilities in good faith.
5. Term & Exit. The partnership continues until ended by agreement or on the agreed notice.
6. Governing Law. This Agreement is governed by the laws of {{COMPANY}}'s place of business.${sign}`,
  },
  {
    id: 'tmpl-consultancy', label: 'Consultancy Agreement', type: 'service',
    blurb: 'Engage an independent consultant or contractor.',
    body:
`CONSULTANCY AGREEMENT

This Consultancy Agreement is made between {{COMPANY}} ("Client") and the undersigned consultant ("Consultant").

1. Services. Consultant shall provide the consultancy services as agreed, as an independent contractor.
2. Fees. Client shall pay the agreed fees against invoices; Consultant is responsible for their own taxes.
3. IP. Deliverables created for Client under this Agreement are assigned to Client on payment.
4. Confidentiality. Consultant shall keep Client information confidential.
5. Term. This Agreement runs until the services are complete or terminated on the agreed notice.
6. Governing Law. This Agreement is governed by the laws of the Client's place of business.${sign}`,
  },
  {
    id: 'tmpl-blank', label: 'Blank document', type: 'custom',
    blurb: 'Start from an empty document and write your own.',
    body: `AGREEMENT\n\nThis agreement is made between {{COMPANY}} and the undersigned counterparty.\n\n[ Write your terms here. ]${sign}`,
  },
];

export function renderTemplateBody(body: string, companyName: string): string {
  return body.replace(/\{\{COMPANY\}\}/g, companyName || 'our company');
}
