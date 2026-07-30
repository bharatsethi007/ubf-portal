export type Term = string | { t: string; subs: string[] }
export const QUOTE_TERMS: Term[] = [
  'This quotation is valid from the issue date through the validity date stated on the quote.',
  'This quotation is not binding until expressly accepted by the customer. UB Freight may update or amend this quotation at any time prior to the acceptance by the customer.',
  'This quotation may be rescinded after customer\u2019s acceptance in the event the quotation was affected by a system error or in the event of changes occurring in relation to mode of transport, currency exchange rates, third party freight rates, insurance premiums or any third party charges applicable to the goods or any change in the parameters on which the quotation was based.',
  'This quotation applies to general cargo only. Cargo requiring special handling such as, but not limited to, hazardous goods, perishable cargo, oversized cargo, overweight containers, and non-stackable cargo, may be subject to additional charges.',
  'Cargo pickup and/or delivery is based on regular service during normal business hours. Additional requirements such as, but not limited to, after hours delivery, tailgate delivery, appointment delivery, hand load/unload, inside delivery, residential delivery, rush delivery, multiple stops, diversion miles, and deliveries requiring special equipment, may be subject to additional charges.',
  'For air freight shipments where TSA Known Shipper rules and regulations apply, quotation applies to Known Shippers only. Additional charges may apply to Unknown Shippers.',
  { t: 'Unless otherwise stated, quotation is exclusive of the following costs, which will be invoiced to the customer to the extent applicable:', subs: [
    'any taxes, export and import customs duties, excise taxes, GST, and other fees levied on the cargo being exported / imported',
    'fees for the processing of letters of credit',
    'fees in connection with any legalization, notarization, or other certified attestation required.',
  ]},
  'Customer has sole responsibility for any demurrage, inspection, storage, detention and/or third-party pass-through charges or costs or costs resulting from a force majeure event.',
  'Quotation is subject to General Carrier Adjustment (GCA), dependent on market conditions, fuel surcharges, weight surcharges, fumigation charges, or other surcharges without prior notice as per carrier terms.',
  'Transit times are for general cargo only. Transit times are subject to carrier delays, schedule changes, or upliftment, and carriers reserve the right to transship goods.',
  'Quotation is subject to empty equipment availability, space availability, cargo acceptance, and confirmation at time of booking.',
  'Final shipment price is based on the actual or cubic dimensional weight, whichever is greater as determined by the carrier. Any changes in the weight whether volumetric or actual will result in rate adjustments.',
  'Any cargo that is mis-declared at time of quote, the quote will become void and any costs / fines relating to the unsuitable nature of the cargo will be for the shipper\u2019s account.',
  'At UB Freight\u2019s discretion, interest may apply to any amounts which may become overdue for which payment has not been received. UB Freight reserves the right to on charge any and all costs associated to the process of recovering any monies owed outside of agreed terms.',
  'Terms and Conditions available at https://www.ubfreight.com/terms-and-conditions/',
]
