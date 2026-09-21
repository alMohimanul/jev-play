export interface CategoryInfo {
  id: string
  label: string
  description: string
}

export const SENTIMENT_CATEGORIES: CategoryInfo[] = [
  { id: 'positive', label: 'Positive', description: 'Favorable, satisfied, or praising tone toward the brand(s) or topic.' },
  { id: 'neutral', label: 'Neutral', description: 'Factual, mixed, or no clear emotional valence.' },
  { id: 'negative', label: 'Negative', description: 'Unfavorable, frustrated, or complaining tone.' },
]

export const INTENT_CATEGORIES: CategoryInfo[] = [
  { id: 'complaint', label: 'Complaint', description: 'Reporting a problem or expressing frustration with a product or service.' },
  { id: 'praise', label: 'Praise', description: 'Complimenting or expressing satisfaction.' },
  { id: 'inquiry', label: 'Inquiry', description: 'Asking a question or seeking information.' },
  { id: 'comparison', label: 'Comparison', description: 'Comparing to another brand, app, or service.' },
  { id: 'purchase_intent', label: 'Purchase Intent', description: 'Expressing intent to sign up for, start using, or switch to a service.' },
  { id: 'recommendation', label: 'Recommendation', description: 'Recommending or advising others for or against something.' },
  { id: 'promotion', label: 'Promotion', description: 'Promotional, marketing, or advertising content.' },
  { id: 'other', label: 'Other', description: 'None of the above.' },
]

export const TOPIC_CATEGORIES: CategoryInfo[] = [
  { id: 'app_experience', label: 'App Experience', description: 'App usability, bugs, crashes, or general UI/UX.' },
  { id: 'customer_service', label: 'Customer Service', description: 'Support quality, responsiveness, or the hotline/live chat experience.' },
  { id: 'transaction_issue', label: 'Transaction Issue', description: 'A failed, delayed, or stuck money transfer or payment.' },
  { id: 'fees_charges', label: 'Fees & Charges', description: 'Fees, charges, or hidden costs.' },
  { id: 'security_fraud', label: 'Security & Fraud', description: 'Account security, fraud, phishing, or OTP issues.' },
  { id: 'rewards_offers', label: 'Rewards & Offers', description: 'Cashback, discounts, promotions, or loyalty rewards.' },
  { id: 'account_access', label: 'Account Access', description: 'Login, registration, KYC, or an account being locked/unlocked.' },
  { id: 'agent_network', label: 'Agent Network', description: 'Cash-in/cash-out experience at an agent or merchant point.' },
  { id: 'remittance', label: 'Remittance', description: 'Cross-border or international money transfer.' },
  { id: 'bill_payment', label: 'Bill Payment', description: 'Paying utility bills or other recurring payments through the app.' },
  { id: 'general', label: 'General', description: 'Generic or unrelated to the above.' },
]

export const BRAND_ROSTER: CategoryInfo[] = [
  { id: 'PayNow', label: 'PayNow', description: 'The mobile money brand PayNow.' },
  { id: 'QuickPay', label: 'QuickPay', description: 'The mobile money brand QuickPay.' },
  { id: 'SendWise', label: 'SendWise', description: 'The mobile money brand SendWise.' },
  { id: 'CashLink', label: 'CashLink', description: 'The mobile money brand CashLink.' },
  { id: 'MoniGo', label: 'MoniGo', description: 'The mobile money brand MoniGo.' },
  { id: 'TapPay', label: 'TapPay', description: 'The mobile money brand TapPay.' },
]

export const NONE_BRAND = 'none'

export function getCategoryLabel(categories: { id: string; label: string }[], id: string): string {
  return categories.find((c) => c.id === id)?.label ?? id
}

export function isKnownCategory(categories: { id: string }[], id: string): boolean {
  return categories.some((c) => c.id === id)
}
