// Agency Co-operation Agreement, non-exclusive v2.1. Body clauses 1 to 19, word for word.
// Schedule 1 and Execution are built from the agreement record.
export type Clause = { n: number; title: string; items: [string, string][] }

export const AGREEMENT_VERSION = 'Non-exclusive v2.1'

export const RECITALS = [
  'The Parties are active in international air freight, ocean freight, forwarding and logistics services.',
  'The Parties wish to market, develop and handle reciprocal freight forwarding business between their respective territories and networks.',
  'The Parties intend to cooperate in relation to canvassing, quotations, operations, customer service, compliance, accounting and settlement.',
  'The Parties therefore agree to the terms below.',
]

export const PURPOSE = 'To establish a clear, reciprocal framework for sales, operations, compliance, accounting, service quality and risk management for air freight, ocean freight and related logistics activity handled between the Parties.'

export const CLAUSES: Clause[] = [
  { n: 1, title: "Agency Appointment and Status", items: [
    ["1.1", "The Parties appoint each other on a non-exclusive and reciprocal basis to perform agreed freight forwarding and logistics services in the territories and lanes accepted by them in writing."],
    ["1.2", "Nothing in this Agreement creates a partnership, joint venture, employment relationship, fiduciary relationship or authority for one Party to legally bind the other except where expressly authorised in writing."],
    ["1.3", "Each Party acts as an independent contractor and is responsible for its own personnel, taxes, licences, permits, subcontractors and operating costs."],
    ["1.4", "A Party may use competent subcontractors or sub-agents where reasonably required, but remains responsible for selecting and managing them and for their charges unless otherwise agreed in writing."],
    ["1.5", "Neither Party is granted exclusivity. Any exclusivity arrangement must be set out in a separate written schedule signed by both Parties."],
  ] },
  { n: 2, title: "Principles of Co-operation and Service Levels", items: [
    ["2.1", "The Parties shall actively support legitimate reciprocal air freight, ocean freight and logistics opportunities and shall treat the other Party's cargo and customers with a standard of care no less than that applied to their own comparable business."],
    ["2.2", "Each Party shall provide accurate and timely quotations, routing options, shipment updates and local service information, including known cut-offs, free time, storage conditions and material destination or origin charges."],
    ["2.3", "Rates, tariffs, service levels, credit arrangements, nominated traffic, project cargo terms and special handling requirements may be agreed separately by email, quotation, rate sheet, operating instruction or schedule."],
    ["2.4", "No Party is required to accept a shipment that is unlawful, unsafe, commercially unreasonable, outside its licence or capability, or inconsistent with its internal compliance requirements."],
    ["2.5", "The Parties shall nominate operational, commercial and accounting contacts and keep those contact details reasonably current."],
  ] },
  { n: 3, title: "Sales, Canvassing and Customer Protection", items: [
    ["3.1", "Each Party will use commercially reasonable efforts to develop routing orders, nominations, sales leads and reciprocal business in its territory."],
    ["3.2", "Joint marketing, advertising, brochures, digital campaigns, trade show participation or use of the other Party's branding must be approved in writing in advance."],
    ["3.3", "Unless otherwise agreed in writing for a specific lane or customer, any agreed profit share on qualifying air or ocean freight shall be calculated on a 50/50 basis using the agreed definition of net profit and supporting shipment records."],
    ["3.4", "Any loading port agent fee, project cargo fee, handling fee, nomination fee or other special remuneration must be agreed before shipment where practicable. Existing commercial arrangements remain effective only to the extent confirmed in writing."],
    ["3.5", "Neither Party shall knowingly bypass the other Party in relation to a customer or nominated traffic introduced solely through the other Party for the purpose of avoiding an agreed commission, profit share or handling arrangement. This clause does not restrict pre- existing customer relationships that can be reasonably evidenced."],
    ["3.6", "During the Agreement and for 12 months after termination, neither Party shall knowingly solicit for employment an employee of the other Party who was materially involved in the relationship, except through general recruitment not targeted at that person."],
  ] },
  { n: 4, title: "Operational Requirements", items: [
    ["4.1", "The origin Party shall provide complete shipment instructions and a timely pre-alert including, as applicable, master and house transport documents, routing, flight or vessel details, package count, weight, dimensions, commodity, value, Incoterm, freight status, collection amounts, special delivery instructions and any controlled or dangerous goods status."],
    ["4.2", "For ocean freight, cargo shall only be released against the original bill of lading or another valid release method authorised by the carrier and origin Party. A Party releasing cargo without appropriate authority bears responsibility for resulting loss or liability to the extent caused by that unauthorised release."],
    ["4.3", "For air freight and express freight, delivery shall be made only in accordance with applicable carrier procedures, customs requirements and written shipment instructions."],
    ["4.4", "Visible shortage, damage, tampering or discrepancy shall be recorded on relevant delivery or interchange documents and notified promptly with photographs or supporting records where available."],
    ["4.5", "If a shipment is at risk of storage, demurrage, detention, abandonment or other material additional charges, the destination Party shall notify the origin Party as early as reasonably practicable and seek instructions."],
    ["4.6", "A hold instruction from the origin Party shall be followed where lawful and operationally possible. Any resulting third-party cost shall be for the account of the Party or customer responsible under the applicable shipment terms."],
    ["4.7", "If the consignee refuses, fails to collect, cannot be located or cannot lawfully receive cargo, the destination Party shall notify the origin Party promptly and request disposal, return, storage or other instructions."],
    ["4.8", "Each Party shall maintain adequate shipment records and evidence of delivery or release in accordance with applicable law, contractual obligations and normal industry practice."],
    ["4.9", "Quotations accepted in writing, including by email or electronic system, form part of this Agreement for the relevant shipment. No unapproved surcharge may be passed to the other Party unless imposed by a carrier, authority or third party and reasonably unavoidable, in which case evidence shall be provided."],
    ["4.10", "Original document courier charges, where still required, must be quoted or agreed in advance. Electronic documentation shall be used where legally and operationally acceptable."],
  ] },
  { n: 5, title: "Customs, Security, Dangerous Goods and Cargo Information", items: [
    ["5.1", "Each Party shall comply with customs, aviation security, maritime security, border, biosecurity and transport security requirements applicable to the services it performs."],
    ["5.2", "The Party receiving information from a shipper or customer is responsible for transmitting shipment information accurately and without material omission. No Party shall knowingly provide false descriptions, values, origin information, tariff information, consignee details or other customs data."],
    ["5.3", "Dangerous goods, hazardous substances, batteries, restricted commodities, perishables, pharmaceuticals, valuables, live animals and other special cargo must be declared before acceptance and may only be handled where the receiving Party confirms capability and acceptance."],
    ["5.4", "Where dangerous goods are accepted, the tendering Party shall provide all legally required declarations, classifications, packaging information, labels, safety data and emergency information. Undeclared dangerous goods may be refused, isolated, returned or otherwise handled as required by law, with reasonable resulting costs charged to the responsible Party."],
    ["5.5", "Each Party shall promptly notify the other of any customs hold, regulatory intervention, security concern, seizure, inspection or material compliance issue affecting a shipment."],
  ] },
  { n: 6, title: "Legal and Ethical Compliance", items: [
    ["6.1", "Each Party shall comply with all laws and regulations applicable to its performance under this Agreement, including trade controls, anti-bribery and corruption laws, applicable anti-money laundering obligations, labour laws, competition laws and sanctions requirements."],
    ["6.2", "Neither Party shall offer, promise, authorise, request or accept any improper payment, kickback or thing of value in connection with business under this Agreement."],
    ["6.3", "Neither Party is required to perform a transaction that it reasonably believes may breach sanctions, export controls, import restrictions or other applicable law. The affected Party may suspend the transaction while conducting reasonable due diligence."],
    ["6.4", "Each Party shall provide reasonable compliance information requested by the other, including company registration details, ownership information, licences, insurance evidence and bank account verification, subject to confidentiality and data protection obligations."],
    ["6.5", "A material breach of this clause is grounds for immediate suspension and may constitute grounds for immediate termination under clause 16."],
  ] },
  { n: 7, title: "Data Protection, Confidentiality and Cyber Security", items: [
    ["7.1", "Each Party shall protect personal information and business information received from the other and shall process personal information only for legitimate purposes connected with the relationship and in accordance with applicable privacy laws, including the New Zealand Privacy Act 2020 where applicable."],
    ["7.2", "Confidential Information includes rates, customer details, shipment data, commercial strategy, systems information, passwords, credentials, financial information, contracts and any non-public information that a reasonable business person would regard as confidential."],
    ["7.3", "Confidential Information may be disclosed only to personnel, professional advisers, insurers, carriers, subcontractors or authorities who need it for a legitimate purpose and who are subject to appropriate confidentiality obligations or legal duties."],
    ["7.4", "Each Party shall maintain reasonable technical and organisational safeguards against unauthorised access, malware, credential compromise, data loss and other cyber security incidents."],
    ["7.5", "A Party becoming aware of a cyber incident or privacy breach that materially affects the other Party's data, systems, customers or shipments shall notify the other Party without undue delay and cooperate in containment, investigation and legally required notifications."],
    ["7.6", "The confidentiality obligations survive termination for three years, except trade secrets, passwords, credentials and personal information which remain protected for so long as they retain their confidential or protected character under applicable law."],
  ] },
  { n: 8, title: "Insurance", items: [
    ["8.1", "Each Party shall maintain insurance appropriate to its operations, including freight forwarders liability or errors and omissions cover, public or third-party liability and any compulsory local insurance."],
    ["8.2", "Upon reasonable request, a Party shall provide evidence that required insurance is current."],
    ["8.3", "Cargo insurance is not automatically provided under this Agreement. Cargo insurance shall only be arranged where specifically requested and accepted in writing, subject to insurer terms and premium."],
  ] },
  { n: 9, title: "Claims, Liability and Indemnities", items: [
    ["9.1", "Each Party shall promptly notify the other of any claim, threatened claim, cargo loss, damage, delay, fine, penalty or third-party demand materially connected with a shipment handled under this Agreement."],
    ["9.2", "The Parties shall cooperate in preserving evidence and pursuing responsible carriers or third parties. Collection or settlement of undisputed freight charges shall not automatically be withheld because a cargo claim is pending."],
    ["9.3", "Each Party is responsible for direct loss, cost, fine or liability to the extent caused by its own negligence, wilful misconduct, breach of this Agreement, unlawful act or material error or omission, including those of subcontractors for whom it is responsible."],
    ["9.4", "Each Party indemnifies the other against third-party claims, fines and reasonable external costs to the extent arising from the indemnifying Party's breach, negligence, unlawful act, unauthorised cargo release, false shipment information or undeclared dangerous goods."],
    ["9.5", "To the maximum extent permitted by law, neither Party shall be liable to the other for indirect, incidental, punitive or consequential loss, including loss of profit, opportunity or goodwill, except where such exclusion is prohibited by law or the loss results from fraud, wilful misconduct, breach of confidentiality, misuse of intellectual property or an indemnity expressly given under this Agreement."],
    ["9.6", "Any monetary liability cap for ordinary operational claims should be set out in Schedule 1. If no cap is inserted, liability remains subject to applicable law, transport conventions, carrier terms, issued bills of lading or air waybills, and any valid standard trading conditions incorporated into the relevant shipment contract."],
  ] },
  { n: 10, title: "Accounting, Credit and Payment", items: [
    ["10.1", "Unless otherwise agreed, inter-agent billing shall be in USD. A different currency may be used where stated on the applicable quotation, debit note, invoice or statement."],
    ["10.2", "Each Party shall issue a monthly statement showing opening balance, shipment transactions, credits, debits, payments and closing balance, normally by the 20th day of the following month."],
    ["10.3", "Approved balances are payable by the 25th day of the following month unless different written credit terms apply. A disputed item must be raised promptly with supporting detail, but undisputed amounts remain payable when due."],
    ["10.4", "If the net outstanding balance owed by one Party exceeds USD 5,000, or another credit limit stated in Schedule 1, the creditor Party may require immediate payment, a payment on account, reduced credit or security before accepting further exposure."],
    ["10.5", "Each Party bears the credit risk of customers to whom it independently grants credit unless the other Party expressly accepts that risk in writing."],
    ["10.6", "The remitting Party shall bear its sending bank charges. The receiving Party shall bear charges imposed solely by its own receiving bank unless otherwise agreed."],
    ["10.7", "No Party may set off unrelated or disputed claims against amounts properly due without written agreement, except where required or permitted by applicable law."],
    ["10.8", "If an amount remains overdue after written demand, the creditor Party may suspend credit or new shipments and may charge reasonable collection costs and any agreed default interest stated in Schedule 1, subject to applicable law."],
    ["10.9", "Bank account changes must be independently verified using an established contact before payment. Email-only bank detail changes should not be relied upon without verification."],
  ] },
  { n: 11, title: "Taxes and Government Charges", items: [
    ["11.1", "Rates and fees are exclusive of GST, VAT, sales tax, duties, levies and government charges unless expressly stated otherwise."],
    ["11.2", "Each Party is responsible for taxes imposed on its own income, personnel and business operations. Shipment-specific taxes, duties and disbursements shall be allocated according to the applicable quotation, Incoterm and customer instruction."],
  ] },
  { n: 12, title: "Records, Audit and Quality", items: [
    ["12.1", "Each Party shall maintain adequate records relating to shipments, charges, profit share calculations, compliance and claims for the period required by applicable law or, if longer, its normal corporate retention policy."],
    ["12.2", "Where there is a genuine accounting dispute, the relevant Party shall provide reasonable supporting shipment records, subject to customer confidentiality and legal restrictions."],
    ["12.3", "The Parties shall cooperate in good faith on service failures, root cause analysis and corrective action where recurring or material issues arise."],
  ] },
  { n: 13, title: "Intellectual Property and Brand Use", items: [
    ["13.1", "Each Party retains all rights in its names, trademarks, logos, systems, templates, content and other intellectual property."],
    ["13.2", "Use of the other Party's branding requires prior written approval and must comply with brand guidelines provided from time to time."],
    ["13.3", "Upon termination, each Party shall stop representing itself as affiliated with the other and remove the other Party's branding from current marketing material within a reasonable period, except where records must be retained by law."],
  ] },
  { n: 14, title: "Notices and Electronic Communications", items: [
    ["14.1", "Routine operational and commercial communications may be sent by email, EDI, approved messaging platform or the Parties' agreed operating system."],
    ["14.2", "Formal notices relating to breach, suspension, termination or dispute must be sent by email to the designated notice contacts in Schedule 1 and, where reasonably practicable, by courier or another trackable delivery method."],
    ["14.3", "A notice is deemed received when the sender receives no delivery failure and the message is sent during normal business hours at the recipient's location, otherwise on the next business day, unless actual receipt is shown earlier."],
  ] },
  { n: 15, title: "Force Majeure", items: [
    ["15.1", "A Party is not liable for failure or delay caused by an event beyond its reasonable control, including natural disaster, severe weather, war, terrorism, civil disturbance, epidemic, government action, port or airport closure, carrier embargo, widespread industrial action, major telecommunications failure or major cyber event not caused by that Party's failure to maintain reasonable safeguards."],
    ["15.2", "The affected Party shall notify the other as soon as reasonably practicable, take reasonable steps to mitigate the effect and resume performance when reasonably able."],
    ["15.3", "Payment obligations for services already performed are not excused by force majeure."],
  ] },
  { n: 16, title: "Term, Suspension and Termination", items: [
    ["16.1", "This Agreement takes effect on the Effective Date and continues until the Expiry Date stated in Schedule 1, unless renewed in writing or terminated earlier in accordance with this clause."],
    ["16.2", "Either Party may terminate the Agreement for convenience by giving 60 days written notice."],
    ["16.3", "A Party may suspend new business immediately if there is a material payment default, sanctions concern, fraud concern, material compliance concern, cyber security risk or other circumstance that reasonably exposes it to significant legal or financial risk."],
    ["16.4", "A Party may terminate immediately by written notice if the other Party commits a material breach that is incapable of remedy or, where capable of remedy, is not remedied within 10 business days after written notice."],
    ["16.5", "A Party may terminate immediately if the other Party becomes insolvent, enters liquidation or receivership, ceases substantial business operations, loses a material licence required to perform the services, or engages in fraud, bribery or deliberate unlawful conduct connected with the relationship."],
    ["16.6", "Termination does not affect accrued rights or liabilities. The Parties shall complete or safely transition open shipments where lawful and commercially reasonable, and all outstanding balances become due in accordance with the agreed accounting process."],
    ["16.7", "Clauses intended by their nature to survive termination, including confidentiality, data protection, intellectual property, payment, liability, indemnity and dispute resolution, continue to apply."],
  ] },
  { n: 17, title: "Assignment and Change of Control", items: [
    ["17.1", "Neither Party may assign this Agreement to an unrelated third party without the other Party's prior written consent, not to be unreasonably withheld, except as part of a bona fide group restructuring where the assignee has equivalent capability and financial standing."],
    ["17.2", "A Party shall notify the other of any material change of ownership or control that may reasonably affect compliance, credit risk or performance under this Agreement."],
  ] },
  { n: 18, title: "Entire Agreement, Variation and Severability", items: [
    ["18.1", "This Agreement and its schedules constitute the entire agreement between the Parties on the subject matter and supersede prior general agency agreements between them, but do not cancel shipment-specific quotations or contracts already accepted unless expressly stated."],
    ["18.2", "A variation must be in writing and agreed by authorised representatives of both Parties. Email confirmation is sufficient for operational or commercial variations where the sender has actual or apparent authority for that matter."],
    ["18.3", "If a provision is illegal or unenforceable, it shall be modified or severed to the minimum extent necessary and the remainder of the Agreement continues in force."],
    ["18.4", "A failure or delay to exercise a right is not a waiver of that right."],
    ["18.5", "This Agreement may be executed in counterparts and by electronic signature to the extent permitted by applicable law."],
  ] },
  { n: 19, title: "Governing Law and Dispute Resolution", items: [
    ["19.1", "The Parties shall first attempt in good faith to resolve any dispute through escalation to senior management."],
    ["19.2", "Unless Schedule 1 states otherwise, this Agreement is governed by the laws of New Zealand."],
    ["19.3", "If a dispute is not resolved within 30 days after written dispute notice, it shall be finally settled under the Rules of Arbitration of the International Chamber of Commerce by one arbitrator appointed in accordance with those Rules. The seat of arbitration shall be Auckland, New Zealand, the language shall be English, and the award shall be final and binding."],
    ["19.4", "Nothing prevents either Party from seeking urgent interim or injunctive relief from a court of competent jurisdiction."],
    ["19.5", "Claims arising under a carrier-issued bill of lading, air waybill or mandatory transport convention remain subject to any valid jurisdiction, time bar and liability provisions applicable to that carriage contract."],
  ] },
]
