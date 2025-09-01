import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ethers, formatEther } from 'ethers';

// Define the unified type for both dice and coinflip events
interface GameEvent {
  blockNumber: number;
  transactionHash: string;
  player: string;
  amount: number;
  choice: number;
  outcome: number;
  won: boolean;
  gameType: 'dice' | 'coinflip';
  timestamp?: number;
}

// Define the ABI for the Roll event (same for both games)
const ROLL_EVENT_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "choice",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "outcome",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "won",
        "type": "bool"
      }
    ],
    "name": "Roll",
    "type": "event"
  }
];

const ROLL_EVENT_TOPIC0 = "0x9d4f0f00f06d0c9cb3a6b4425bf3a6537017a58de4a32674770bc910693d2158";

// Contract addresses
const DICE_CONTRACT_ADDRESS = "0xD288c47feFE57f84607aA43F705F388D2aE900eC";
const COINFLIP_CONTRACT_ADDRESS = "0x8d89670fE63E55b19B9C49972371D89451a94c10";

const ETHERSCAN_API_KEY = '8JZEIVVIWPKAZYX9DFGBDXEKIHFP9VR5TW';
const POLLING_INTERVAL = 5000;

const CombinedGameEvents: React.FC = () => {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastDiceBlock, setLastDiceBlock] = useState<number | null>(null);
  const [lastCoinflipBlock, setLastCoinflipBlock] = useState<number | null>(null);

  const fetchEventsForContract = async (
    contractAddress: string,
    gameType: 'dice' | 'coinflip',
    lastBlock: number | null
  ): Promise<{ events: GameEvent[]; highestBlock: number }> => {
    const currentFromBlock = lastBlock ? lastBlock + 1 : 0;
    const toBlock = 'latest';
    
    const url = `https://api.sonicscan.org/api?module=logs&action=getLogs&address=${contractAddress}&fromBlock=${currentFromBlock}&toBlock=${toBlock}&topic0=${ROLL_EVENT_TOPIC0}&apikey=${ETHERSCAN_API_KEY}`;
    
    const response = await axios.get(url);
    const data = response.data;
    
    if (data.status !== "1") {
      throw new Error(`API error for ${gameType}: ${data.message}`);
    }

    const rawEvents = data.result;
    const decodedNewEvents: GameEvent[] = [];
    let highestBlockInThisFetch = lastBlock || 0;

    const iface = new ethers.Interface(ROLL_EVENT_ABI);

    for (const eventLog of rawEvents) {
      try {
        const parsedLog = iface.parseLog(eventLog);

        if (parsedLog && parsedLog.name === "Roll") {
          const blockNum = parseInt(eventLog.blockNumber, 16);
          decodedNewEvents.push({
            blockNumber: blockNum,
            transactionHash: eventLog.transactionHash,
            player: parsedLog.args.player,
            amount: parsedLog.args.amount,
            choice: Number(parsedLog.args.choice),
            outcome: Number(parsedLog.args.outcome),
            won: parsedLog.args.won,
            gameType: gameType,
          });
          highestBlockInThisFetch = Math.max(highestBlockInThisFetch, blockNum);
        }
      } catch (parseError) {
        console.error(`Error parsing ${gameType} log:`, parseError, eventLog);
      }
    }

    return { events: decodedNewEvents, highestBlock: highestBlockInThisFetch };
  };

  useEffect(() => {
    let pollingIntervalId: number | null = null;

    const fetchAllEvents = async () => {
      if (lastDiceBlock === null && lastCoinflipBlock === null) {
        setLoading(true);
      }
      setError(null);

      if (!ETHERSCAN_API_KEY) {
        setError("Loading past bets...");
        setLoading(false);
        return;
      }

      try {
        // Fetch events from both contracts
        const [diceResult, coinflipResult] = await Promise.all([
          fetchEventsForContract(DICE_CONTRACT_ADDRESS, 'dice', lastDiceBlock),
          fetchEventsForContract(COINFLIP_CONTRACT_ADDRESS, 'coinflip', lastCoinflipBlock)
        ]);

        const allNewEvents = [...diceResult.events, ...coinflipResult.events];

        if (allNewEvents.length > 0) {
          // Sort all new events by block number (most recent first)
          allNewEvents.sort((a, b) => b.blockNumber - a.blockNumber);

          setEvents((prevEvents) => {
            const existingTxHashes = new Set(prevEvents.map(e => e.transactionHash));
            const uniqueNewEvents = allNewEvents.filter(e => !existingTxHashes.has(e.transactionHash));
            
            const combinedEvents = [...uniqueNewEvents, ...prevEvents];
            return combinedEvents.sort((a, b) => b.blockNumber - a.blockNumber);
          });

          // Update last block numbers
          if (diceResult.events.length > 0) {
            setLastDiceBlock(diceResult.highestBlock);
          }
          if (coinflipResult.events.length > 0) {
            setLastCoinflipBlock(coinflipResult.highestBlock);
          }
        }
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(`Network error: ${err.message}`);
        } else {
          setError("An unexpected error occurred.");
        }
        console.error("Failed to fetch events:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllEvents();
    pollingIntervalId = setInterval(fetchAllEvents, POLLING_INTERVAL) as unknown as number;

    return () => {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }
    };
  }, []);

  // Helper function to format game-specific text
  const formatGameDescription = (event: GameEvent) => {
    const amount = parseFloat(formatEther(event.amount)).toFixed(2);
    const player = `${event.player?.slice(0, 6)}...${event.player?.slice(-4)}`;
    
    if (event.gameType === 'dice') {
      return `${player} bet ${amount} on ${event.choice}, rolled ${event.outcome} and ${event.won ? 'Won' : 'Lost'}`;
    } else {
      return `${player} flipped ${amount} and ${event.won ? 'doubled' : 'got rugged'}`;
    }
  };

  if (loading && events.length === 0) {
    return <div className="p-4 text-center text-blue-600">Loading past bets...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600 text-center">Error: {error}</div>;
  }

  if (events.length === 0) {
    return <div className="p-4 text-center text-gray-500">No past bets found for either contract.</div>;
  }

  return (
    <div className="p-2 rounded-lg shadow-md max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-white mb-4 text-center">RECENT BETS</h2>
      
      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border border-black rounded-lg">
          <thead>
            <tr className="border-b border-black">
              <th className="px-4 py-3 text-left text-yellow-300 font-medium">Game</th>
              <th className="px-4 py-3 text-left text-yellow-300 font-medium">Player</th>
              <th className="px-4 py-3 text-left text-yellow-300 font-medium">Amount</th>
              <th className="px-4 py-3 text-left text-yellow-300 font-medium">Choice</th>
              <th className="px-4 py-3 text-left text-yellow-300 font-medium">Outcome</th>
              <th className="px-4 py-3 text-left text-yellow-300 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, 12).map((event, index) => (
              <tr 
                key={event.transactionHash} 
                className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${
                  index % 2 === 0 ? 'bg-gray-800/30' : 'bg-gray-800/50'
                }`}
              >
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    event.gameType === 'dice' 
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' 
                      : 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  }`}>
                    {event.gameType === 'dice' ? '🎲 Dice' : '🪙 Flip'}
                  </span>
                </td>
                <td className="px-4 py-3 text-white font-mono text-sm">
                  {event.player?.slice(0, 6)}...{event.player?.slice(-4)}
                </td>
                <td className="px-4 py-3 text-white">
                  {parseFloat(formatEther(event.amount)).toFixed(2)} S
                </td>
                <td className="px-4 py-3 text-white">
                  {event.gameType === 'dice' ? event.choice : (event.choice === 1 ? 'Heads' : 'Tails')}
                </td>
                <td className="px-4 py-3 text-white">
                  {event.gameType === 'dice' ? event.outcome : (event.outcome === 1 ? 'Heads' : 'Tails')}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    event.won 
                      ? 'bg-green-600/20 text-green-300 border border-green-500/30' 
                      : 'bg-red-600/20 text-red-300 border border-red-500/30'
                  }`}>
                    {event.won ? '✅ Won' : '❌ Lost'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="block md:hidden">
        <div className="space-y-3">
          {events.slice(0, 10).map((event, index) => (
            <div 
              key={event.transactionHash} 
              className={`p-4 rounded-lg border border-gray-700/50 ${
                index % 2 === 0 ? 'bg-gray-800/30' : 'bg-gray-800/50'
              }`}
            >
              {/* Header row with game type and result */}
              <div className="flex justify-between items-center mb-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  event.gameType === 'dice' 
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' 
                    : 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                }`}>
                  {event.gameType === 'dice' ? '🎲 Dice' : '🪙 Flip'}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  event.won 
                    ? 'bg-green-600/20 text-green-300 border border-green-500/30' 
                    : 'bg-red-600/20 text-red-300 border border-red-500/30'
                }`}>
                  {event.won ? '✅ Won' : '❌ Lost'}
                </span>
              </div>
              
              {/* Player and amount */}
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <div className="text-yellow-300 text-xs font-medium mb-1">Player</div>
                  <div className="text-white font-mono text-sm">
                    {event.player?.slice(0, 6)}...{event.player?.slice(-4)}
                  </div>
                </div>
                <div>
                  <div className="text-yellow-300 text-xs font-medium mb-1">Amount</div>
                  <div className="text-white text-sm font-semibold">
                    {parseFloat(formatEther(event.amount)).toFixed(2)} S
                  </div>
                </div>
              </div>
              
              {/* Choice and outcome */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-yellow-300 text-xs font-medium mb-1">Choice</div>
                  <div className="text-white text-sm">
                    {event.gameType === 'dice' ? event.choice : (event.choice === 1 ? 'Heads' : 'Tails')}
                  </div>
                </div>
                <div>
                  <div className="text-yellow-300 text-xs font-medium mb-1">Outcome</div>
                  <div className="text-white text-sm">
                    {event.gameType === 'dice' ? event.outcome : (event.outcome === 1 ? 'Heads' : 'Tails')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alternative compact view for mobile */}
      <div className="hidden mt-4">
        <div className="space-y-3 border border-yellow-700 p-2 rounded">
          {events.slice(0, 8).map((event) => (
            <div key={event.transactionHash} className="p-2 bg-gray-800/50 rounded-md">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  event.gameType === 'dice' 
                    ? 'bg-blue-600/20 text-blue-300' 
                    : 'bg-purple-600/20 text-purple-300'
                }`}>
                  {event.gameType === 'dice' ? '🎲' : '🪙'}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  event.won 
                    ? 'bg-green-600/20 text-green-300' 
                    : 'bg-red-600/20 text-red-300'
                }`}>
                  {event.won ? 'Won' : 'Lost'}
                </span>
              </div>
              <p className="text-white text-sm">
                {formatGameDescription(event)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CombinedGameEvents;
