export interface SocialGroundTruth {
  sentiment: string
  intents: string[]
  topics: string[]
  brands: string[]
}

export interface SocialMessage {
  id: string
  text: string
  groundTruth: SocialGroundTruth
}

export const SOCIAL_MESSAGES: SocialMessage[] = [
  {
    id: '1',
    text: "PayNow's app crashed twice today while I was trying to pay my electricity bill. So frustrating.",
    groundTruth: { sentiment: 'negative', intents: ['complaint'], topics: ['app_experience', 'bill_payment'], brands: ['PayNow'] },
  },
  {
    id: '2',
    text: 'Just switched from QuickPay to PayNow because the transfer fees are way lower. Best decision ever!',
    groundTruth: { sentiment: 'positive', intents: ['praise', 'comparison'], topics: ['fees_charges'], brands: ['QuickPay', 'PayNow'] },
  },
  {
    id: '3',
    text: 'Does anyone know if SendWise charges extra for sending money abroad?',
    groundTruth: { sentiment: 'neutral', intents: ['inquiry'], topics: ['remittance', 'fees_charges'], brands: ['SendWise'] },
  },
  {
    id: '4',
    text: 'CashLink customer service kept me on hold for 40 minutes and never resolved my issue. Never using them again.',
    groundTruth: { sentiment: 'negative', intents: ['complaint'], topics: ['customer_service'], brands: ['CashLink'] },
  },
  {
    id: '5',
    text: "Got a random OTP request I didn't ask for on my MoniGo account. Is this a scam? Be careful everyone.",
    groundTruth: { sentiment: 'negative', intents: ['complaint'], topics: ['security_fraud'], brands: ['MoniGo'] },
  },
  {
    id: '6',
    text: 'Honestly mobile banking has made my life so much easier, paying bills from home is great.',
    groundTruth: { sentiment: 'positive', intents: ['praise'], topics: ['bill_payment'], brands: [] },
  },
  {
    id: '7',
    text: "TapPay's new cashback offer on grocery payments is actually really generous this month.",
    groundTruth: { sentiment: 'positive', intents: ['praise', 'promotion'], topics: ['rewards_offers'], brands: ['TapPay'] },
  },
  {
    id: '8',
    text: 'Thinking about signing up for PayNow, heard good things about their agent network being everywhere.',
    groundTruth: { sentiment: 'positive', intents: ['purchase_intent'], topics: ['agent_network'], brands: ['PayNow'] },
  },
  {
    id: '9',
    text: "My QuickPay transfer to my brother has been 'pending' for 3 days now. This is unacceptable.",
    groundTruth: { sentiment: 'negative', intents: ['complaint'], topics: ['transaction_issue'], brands: ['QuickPay'] },
  },
  {
    id: '10',
    text: "If you're comparing SendWise and CashLink for remittance, SendWise has way better exchange rates honestly.",
    groundTruth: { sentiment: 'positive', intents: ['comparison', 'recommendation'], topics: ['remittance'], brands: ['SendWise', 'CashLink'] },
  },
  {
    id: '11',
    text: "Can't log into my MoniGo account, it keeps saying my KYC info doesn't match. So annoying.",
    groundTruth: { sentiment: 'negative', intents: ['complaint'], topics: ['account_access'], brands: ['MoniGo'] },
  },
  {
    id: '12',
    text: 'TapPay is having system maintenance tonight from 12am to 4am, transactions may be delayed.',
    groundTruth: { sentiment: 'neutral', intents: ['other'], topics: ['transaction_issue'], brands: ['TapPay'] },
  },
  {
    id: '13',
    text: 'I recommend PayNow to anyone who sends money to family regularly, their agent fees are the lowest around.',
    groundTruth: { sentiment: 'positive', intents: ['recommendation'], topics: ['agent_network', 'fees_charges'], brands: ['PayNow'] },
  },
  {
    id: '14',
    text: "Why does every mobile money app charge so much just to cash out at an agent? It's ridiculous.",
    groundTruth: { sentiment: 'negative', intents: ['complaint'], topics: ['fees_charges', 'agent_network'], brands: [] },
  },
  {
    id: '15',
    text: "QuickPay's app redesign this year looks great, so much cleaner than before.",
    groundTruth: { sentiment: 'positive', intents: ['praise'], topics: ['app_experience'], brands: ['QuickPay'] },
  },
  {
    id: '16',
    text: "SendWise's fraud detection blocked a suspicious login attempt on my account within seconds. Impressive.",
    groundTruth: { sentiment: 'positive', intents: ['praise'], topics: ['security_fraud'], brands: ['SendWise'] },
  },
  {
    id: '17',
    text: 'Is CashLink or MoniGo better for paying university tuition fees? Need advice.',
    groundTruth: { sentiment: 'neutral', intents: ['inquiry', 'comparison'], topics: ['bill_payment'], brands: ['CashLink', 'MoniGo'] },
  },
  {
    id: '18',
    text: 'PayNow just added a new bill payment feature for internet providers, finally!',
    groundTruth: { sentiment: 'positive', intents: ['praise', 'promotion'], topics: ['bill_payment'], brands: ['PayNow'] },
  },
]
