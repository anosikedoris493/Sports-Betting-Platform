import { describe, it, expect, beforeEach } from 'vitest';

// Mock contract state
let events: any[] = [];
let userBets: { [key: string]: { totalBetAmount: number } } = {};
let nextEventId = 1;
const contractOwner = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
let oracleAddress = contractOwner;
let responsibleGamblingLimit = 1000000000; // 1000 STX

// Mock contract functions
function createEvent(description: string, options: string[]) {
  const eventId = nextEventId++;
  events.push({
    id: eventId,
    description,
    options,
    totalPool: 0,
    bets: [],
    status: 'open',
    result: null
  });
  return { success: true, value: eventId };
}

function placeBet(sender: string, eventId: number, option: number, amount: number) {
  const event = events.find(e => e.id === eventId);
  if (!event || event.status !== 'open') {
    return { success: false, error: 'Invalid event or bet closed' };
  }
  
  const userBet = userBets[sender] || { totalBetAmount: 0 };
  const newTotalBetAmount = userBet.totalBetAmount + amount;
  
  if (newTotalBetAmount > responsibleGamblingLimit) {
    return { success: false, error: 'Exceeds responsible gambling limit' };
  }
  
  event.totalPool += amount;
  event.bets.push({ better: sender, option, amount });
  userBets[sender] = { totalBetAmount: newTotalBetAmount };
  
  return { success: true };
}

function reportResult(sender: string, eventId: number, result: number) {
  if (sender !== oracleAddress) {
    return { success: false, error: 'Unauthorized' };
  }
  
  const event = events.find(e => e.id === eventId);
  if (!event || event.result !== null) {
    return { success: false, error: 'Invalid event or result already reported' };
  }
  
  event.status = 'closed';
  event.result = result;
  
  return { success: true };
}

function claimWinnings(sender: string, eventId: number) {
  const event = events.find(e => e.id === eventId);
  if (!event || event.status !== 'closed' || event.result === null) {
    return { success: false, error: 'Invalid event or result not reported' };
  }
  
  const winningBets = event.bets.filter((bet: any) => bet.option === event.result && bet.better === sender);
  if (winningBets.length === 0) {
    return { success: false, error: 'No winning bets' };
  }
  
  const totalWinningAmount = event.bets.reduce((sum: number, bet: any) =>
      bet.option === event.result ? sum + bet.amount : sum, 0);
  const userWinningAmount = winningBets.reduce((sum: any, bet: any) => sum + bet.amount, 0);
  const payout = Math.floor((userWinningAmount * event.totalPool) / totalWinningAmount);
  
  return { success: true, value: payout };
}

function calculateOdds(eventId: number, targetOption: number) {
  const event = events.find(e => e.id === eventId);
  if (!event) {
    return { success: false, error: 'Event not found' };
  }
  
  const totalPool = event.totalPool;
  const optionPool = event.bets.reduce((sum, bet) =>
      bet.option === targetOption ? sum + bet.amount : sum, 0);
  
  if (optionPool === 0) {
    return { success: true, value: 0 };
  }
  
  const odds = Math.floor((totalPool * 100) / optionPool);
  return { success: true, value: odds };
}

// Tests
describe('Decentralized Sports Betting Platform', () => {
  beforeEach(() => {
    events = [];
    userBets = {};
    nextEventId = 1;
    oracleAddress = contractOwner;
    responsibleGamblingLimit = 1000000000;
  });
  
  it('allows creating events', () => {
    const result = createEvent('World Cup Final', ['Team A', 'Team B', 'Draw']);
    expect(result.success).toBe(true);
    expect(result.value).toBe(1);
    expect(events.length).toBe(1);
    expect(events[0].options.length).toBe(3);
  });
  
  it('allows placing bets', () => {
    createEvent('World Cup Final', ['Team A', 'Team B', 'Draw']);
    const betResult = placeBet('ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG', 1, 0, 100000000);
    expect(betResult.success).toBe(true);
    expect(events[0].totalPool).toBe(100000000);
    expect(events[0].bets.length).toBe(1);
  });
  
  it('enforces responsible gambling limits', () => {
    createEvent('World Cup Final', ['Team A', 'Team B', 'Draw']);
    placeBet('ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG', 1, 0, 500000000);
    const exceedLimitResult = placeBet('ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG', 1, 1, 600000000);
    expect(exceedLimitResult.success).toBe(false);
    expect(exceedLimitResult.error).toBe('Exceeds responsible gambling limit');
  });
  
  it('allows reporting results by oracle', () => {
    createEvent('World Cup Final', ['Team A', 'Team B', 'Draw']);
    const reportResult1 = reportResult(oracleAddress, 1, 0);
    expect(reportResult1.success).toBe(true);
    expect(events[0].status).toBe('closed');
    expect(events[0].result).toBe(0);
    
    const reportResult2 = reportResult(oracleAddress, 1, 1);
    expect(reportResult2.success).toBe(false);
    expect(reportResult2.error).toBe('Invalid event or result already reported');
  });
  
  it('calculates and distributes winnings correctly', () => {
    createEvent('World Cup Final', ['Team A', 'Team B', 'Draw']);
    placeBet('ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
        1, 0, 100000000);
    placeBet('ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC', 1, 1, 200000000);
    reportResult(oracleAddress, 1, 0);
    
    const claimResult1 = claimWinnings('ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG', 1);
    expect(claimResult1.success).toBe(true);
    expect(claimResult1.value).toBe(300000000);
    
    const claimResult2 = claimWinnings('ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC', 1);
    expect(claimResult2.success).toBe(false);
    expect(claimResult2.error).toBe('No winning bets');
  });
  
  it('calculates odds correctly', () => {
    createEvent('World Cup Final', ['Team A', 'Team B', 'Draw']);
    placeBet('ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG', 1, 0, 100000000);
    placeBet('ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC', 1, 1, 200000000);
    
    const oddsTeamA = calculateOdds(1, 0);
    expect(oddsTeamA.success).toBe(true);
    expect(oddsTeamA.value).toBe(300);
    
    const oddsTeamB = calculateOdds(1, 1);
    expect(oddsTeamB.success).toBe(true);
    expect(oddsTeamB.value).toBe(150);
  });
});

