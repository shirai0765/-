/** Shared public contracts. Money is JPY; simulation advances only at end-week. */
export type DistrictId = 'center' | 'dogenzaka' | 'miyashita' | 'sakuragaoka';
export type StoreStyle = 'standard' | 'premium' | 'takeaway';
export type QualityLevel = 'low' | 'medium' | 'high';
export interface Lot { id: string; name: string; district: DistrictId; x: number; z: number; width: number; depth: number; height: number; rotation?: number; type: 'retail' | 'office' | 'residential' | 'landmark' | 'park' | 'station'; color: string; footfall: number; affluence: number; rent: number; purchasePrice: number; available: boolean; description: string }
export interface Store { id: string; lotId: string; name: string; style: StoreStyle; price: number; quality: number; staff: number; manager: boolean; marketing: number; level: number; openedWeek: number; revenue: number; profit: number; customers: number; satisfaction: number }
export interface Loan { id: string; principal: number; remaining: number; annualRate: number; weeksLeft: number; weeklyPayment: number }
export interface PropertyAsset { id: string; lotId: string; purchasePrice: number; level: number; occupancy: number; weeklyIncome: number }
export interface StockDefinition { id: string; code: string; name: string; realName: string; sector: string; basePrice: number; dividendYield: number; volatility: number; sourceUrl?: string; priceDate?: string; priceKind: 'market-reference' | 'simulation'; market?: 'Prime' | 'Standard' | 'Growth' | 'REIT'; profile?: 'defensive' | 'income' | 'growth' | 'cyclical' | 'speculative'; marketCap?: number; liquidity?: number }
export interface StockPosition { stockId: string; shares: number; averageCost: number }
export interface Subsidiary { id: string; name: string; sector: 'food' | 'property' | 'rail'; purchasePrice: number; weeklyProfit: number; risk: number }
export interface AcquisitionTarget { id: string; name: string; sector: 'food' | 'property' | 'rail'; price: number; weeklyProfit: number; risk: number; minReputation: number; description: string }
export interface WeeklyReport { week: number; revenue: number; operatingProfit: number; interest: number; netProfit: number; loanRepayment: number; dividendsReceived: number; dividendsPaid: number; cashChange: number; customers: number; headlines: string[]; storeResults: { id: string; revenue: number; profit: number; customers: number; satisfaction: number }[] }
export interface HistoryPoint { week: number; cash: number; profit: number; revenue: number; valuation: number; stores: number }
/** A bounded decision journal; never used to calculate company finances. */
export interface OpeningRecord {
  id: string; storeId: string; lotId: string; storeName: string; style: StoreStyle; decisionWeek: number;
  openingCost: number; cashBefore: number; cashAfter: number; netProfitBefore: number; netProfitAfter: number; initialStoreProfit: number; companyStoreCount: number;
  result?: { week: number; companyNetProfit: number; cashChange: number; storeProfit: number; customers: number };
  closedWeek?: number;
}
export interface GameState { railProjects?: RailProjectState; openingRecords?: OpeningRecord[]; marketAcquisitions?: MarketAcquisitionState; development?: DevelopmentState; deals?: DealState; version: 1; id: string; companyName: string; seed: number; week: number; cash: number; reputation: number; stores: Store[]; loans: Loan[]; properties: PropertyAsset[]; positions: StockPosition[]; stockPrices: Record<string, number>; subsidiaries: Subsidiary[]; listed: boolean; sharesOutstanding: number; founderShares: number; sharePrice: number; dividendPayout: number; profitableWeeks: number; totalCustomers: number; history: HistoryPoint[]; lastReport: WeeklyReport | null; milestones: string[]; gameOver: boolean; gameOverReason: string | null; settings: { quality: QualityLevel; sound: boolean } }
export type DealAction = { type: 'acceptOffer' | 'declineOffer' | 'investigateOffer'; offerId: string } | { type: 'cancelContract'; contractId: string };
export type GameAction =
  | { type: 'startDevelopment'; districtId: DistrictId; choiceId: string }
  | { type: 'startRailProject'; districtId: DistrictId; choiceId: RailProjectChoiceId }
  | MarketAcquisitionAction
  | DealAction
  | { type: 'openStore'; lotId: string; name?: string; style: StoreStyle }
  | { type: 'updateStore'; storeId: string; changes: Partial<Pick<Store, 'name' | 'price' | 'quality' | 'staff' | 'manager' | 'marketing' | 'style'>> }
  | { type: 'upgradeStore'; storeId: string } | { type: 'closeStore'; storeId: string }
  | { type: 'borrow'; amount: number; weeks: number } | { type: 'repayLoan'; loanId: string }
  | { type: 'buyProperty'; lotId: string } | { type: 'upgradeProperty'; propertyId: string } | { type: 'sellProperty'; propertyId: string }
  | { type: 'buyStock'; stockId: string; shares: number } | { type: 'sellStock'; stockId: string; shares: number }
  | { type: 'acquire'; targetId: string } | { type: 'ipo' } | { type: 'issueShares'; fraction: number }
  | { type: 'setDividend'; payout: number } | { type: 'settings'; changes: Partial<GameState['settings']> };
export interface CompanySummary { debt: number; borrowingLimit: number; availableCredit: number; valuation: number; netWorth: number; weeklyProfit: number; portfolioValue: number; propertyValue: number; ownership: number; ipoEligible: boolean; ipoRequirements: { label: string; met: boolean }[] }
export interface SiteEstimate { openingCost: number; expectedRevenue: number; expectedProfit: number; weeklyRent: number; expectedCustomers: number; competition: number; annualYield: number }

/** Sales pitches are simulations, not recommendations or quoted market returns. */
export interface DealOffer {
 id: string; category: 'system' | 'marketing' | 'property'; title: string; salesperson: string; supplier: string; supplierStockId?: string;
 pitch: string; upfrontCost: number; weeklyFee: number; termWeeks: number; expiresWeek: number; createdWeek: number;
 advertisedWeeklyBenefit: number; advertisedAnnualYield: number; conservativeWeeklyBenefit: number; optimisticWeeklyBenefit: number;
 signals: string[]; investigationCost: number; investigated: boolean; investigationNotes: string[];
 cancellationFee: number; leadWeeks: number; residualValue: number;
}
export interface DealContract { id: string; offer: DealOffer; startWeek: number; revealWeek: number; endWeek: number; status: 'active' | 'cancelled' | 'completed'; realizedWeeklyBenefit?: number; cumulativeBenefit: number; cumulativeFees: number }
export interface DealState { offers: DealOffer[]; contracts: DealContract[]; generatedBatches: string[]; dismissed: string[]; lastTickWeek?: number }

export interface DevelopmentChoice { id: string; districtId: DistrictId; phase: number; name: string; description: string; cost: number; weeks: number; weeklyUpkeep: number; cafeDemandBonus: number; propertyYieldBonus: number }
export interface DevelopmentProgram { districtId: DistrictId; completedChoiceIds: string[]; construction?: { choiceId: string; startWeek: number; completeWeek: number } }
export interface DevelopmentState { programs: DevelopmentProgram[] }

export type RailProjectChoiceId = 'commerce' | 'rental';
export interface RailProject { districtId: DistrictId; choiceId: RailProjectChoiceId; startWeek: number; completeWeek: number }
export interface RailProjectState { projects: RailProject[] }

export type MarketAcquisitionMode = 'autonomous' | 'integrated';
export type MarketAcquisitionAction = { type: 'researchMarketCompany'; stockId: string } | { type: 'acquireMarketCompany'; stockId: string; mode: MarketAcquisitionMode };
export interface MarketAcquisitionState { research: { stockId: string; week: number }[]; companies: { stockId: string; mode: MarketAcquisitionMode; acquiredWeek: number; readyWeek: number }[] }
