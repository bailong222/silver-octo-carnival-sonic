import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ethers, formatEther } from 'ethers';
import { useAccount } from 'wagmi'; // Import useAccount from wagmi

// Define the type for a decoded Roll event
interface RollEvent {
  blockNumber: number;
  transactionHash: string;
  player: string;
  amount: number,
  choice: number;
  outcome: number;
  won: boolean;
  timestamp: number;
}

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

// Calculate the event topic0 (Keccak-256 hash of the signature)
const ROLL_EVENT_TOPIC0 = "0x8def3bc2223262ccdecfbbf07303396df9ea44d00ed3c9d65c010ce88c46b58b";

// Replace with your actual contract address on Polygon
const CONTRACT_ADDRESS = "0xEDa212D52BDbaC5BBde136b4f19F988d7B05b59a"; // <<< IMPORTANT: Confirm this is correct for Polygon!

// Accessing API key using import.meta.env, as specified for Vite
const ETHERSCAN_API_KEY = '8JZEIVVIWPKAZYX9DFGBDXEKIHFP9VR5TW';

const POLLING_INTERVAL = 5000; // Poll every 5 seconds

const PlayerEvents: React.FC = () => {
  // Use useAccount from wagmi to get the connected address
  const { address: currentAccount, isConnected } = useAccount();
  const [events, setEvents] = useState<RollEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastBlock, setLastBlock] = useState<number | null>(null);
  

  useEffect(() => {
    let pollingIntervalId: number | null = null; 

    const fetchRollEvents = async () => {
      if (lastBlock === null) {
        setLoading(true);
      }
      setError(null); 

      if (!ETHERSCAN_API_KEY) {
        setError("Loading");
        setLoading(false);
        return;
      }
      
      const currentFromBlock = lastBlock ? lastBlock + 1 : 0;
      const toBlock = 'latest'; 

      const url = `https://api.sonicscan.org/api?module=logs&action=getLogs&address=${CONTRACT_ADDRESS}&fromBlock=${currentFromBlock}&toBlock=${toBlock}&topic0=${ROLL_EVENT_TOPIC0}&apikey=${ETHERSCAN_API_KEY}`;

      try {
        const response = await axios.get(url);
        const data = response.data;

        if (data.status === "1") {
          const rawEvents = data.result;
          const decodedNewEvents: RollEvent[] = [];
          let highestBlockInThisFetch = lastBlock || 0; 

          const iface = new ethers.Interface(ROLL_EVENT_ABI);

          for (const eventLog of rawEvents) {
            try {
              const parsedLog = iface.parseLog(eventLog);

              if (parsedLog && parsedLog.name === "Roll") {
                const blockNum = parseInt(eventLog.blockNumber, 16);
                const eventTimestamp = parseInt(eventLog.timeStamp, 16);
                decodedNewEvents.push({
                  blockNumber: blockNum,
                  transactionHash: eventLog.transactionHash,
                  player: parsedLog.args.player,
                  amount: parsedLog.args.amount,
                  choice: Number(parsedLog.args.choice), 
                  outcome: Number(parsedLog.args.outcome),
                  won: parsedLog.args.won,
                  timestamp: eventTimestamp,
                });
                highestBlockInThisFetch = Math.max(highestBlockInThisFetch, blockNum);
              }
            } catch (parseError) {
              console.error("Error parsing a log:", parseError, eventLog);
            }
          }

          if (decodedNewEvents.length > 0) {
            decodedNewEvents.sort((a, b) => b.blockNumber - a.blockNumber);

            setEvents((prevEvents) => {
              const existingTxHashes = new Set(prevEvents.map(e => e.transactionHash));
              const uniqueNewEvents = decodedNewEvents.filter(e => !existingTxHashes.has(e.transactionHash));
              
              const combinedEvents = [...uniqueNewEvents, ...prevEvents];
              return combinedEvents.sort((a, b) => b.blockNumber - a.blockNumber);
            });
            
            setLastBlock(highestBlockInThisFetch);
          }
        } else {
          setError(`Error`);
          console.error("PolygonScan API Error:", data.message, "Result:", data.result);
        }
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(`Network error: ${err.message}`);
        } else {
          setError("An unexpected error occurred.");
        }
        console.error("Failed to fetch your bets", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRollEvents();

    pollingIntervalId = setInterval(fetchRollEvents, POLLING_INTERVAL) as unknown as number;

    return () => {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }
    };
  }, []); // Empty dependency array. Polling handles updates.

  // --- Conditional Rendering for UI Feedback ---
  if (loading && events.length === 0) {
    return <div className="p-4 text-center text-blue-600">Loading past bets...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600 text-center">Error: {error}</div>;
  }

  if (!isConnected || !currentAccount) {
    return <div className="p-4 text-center text-yellow-600">Please connect your wallet to see your past bets.</div>;
  }

   const formatTimestamp = (timestamp: number): string => {
    // Unix timestamp from PolygonScan is in seconds, Date() expects milliseconds
    const date = new Date(timestamp * 1000); 
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} min${diffInMinutes === 1 ? '' : 's'} ago`;
    } else if (diffInMinutes < 1440) { // Less than 24 hours
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} day${days === 1 ? '' : 's'} ago`;
    }
  };
  // Filter events based on the current connected account
  const filteredEvents = events.filter(event => 
    event.player.toLowerCase() === currentAccount.toLowerCase()
  );

  // Display message if no events are found for the connected account after filtering
  if (filteredEvents.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No bets found for your connected address ({currentAccount.slice(0, 6)}...{currentAccount.slice(-4)}).
      </div>
    );
  }

  // --- Main Event Display ---
  return (
    <div className="p-4 rounded-lg shadow-xl max-w-4xl mx-auto bg-gray-900 border border-gray-700">
      <h2 className="text-2xl font-bold mb-6 text-center text-white">Your Betting History</h2>
      <p className="text-center text-sm text-gray-400 mb-6">
        Showing past bets for connected address: <span className="text-yellow-400 font-mono">{currentAccount.slice(0, 6)}...{currentAccount.slice(-4)}</span>
      </p>

      {/* Table Header */}
      <div className="bg-gray-800 rounded-t-lg p-4 border border-gray-600">
        <div className="grid grid-cols-5 gap-4 text-sm font-semibold text-gray-300 text-center">
          <div>Amount</div>
          <div>Choice</div>
          <div>Outcome</div>
          <div>Result</div>
          <div>Time</div>
        </div>
      </div>

      {/* Table body */}
      <div className="border border-t-0 border-gray-600 rounded-b-lg h-80 overflow-y-auto bg-gray-850 scrollbar-hide" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
        <style jsx>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {filteredEvents.map((event, index) => (
          <div 
            key={event.transactionHash} 
            className={`grid grid-cols-5 gap-4 p-4 text-sm text-center border-b border-gray-700 hover:bg-gray-800 transition-colors ${
              index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'
            }`}
          >
            <div className="text-blue-400 font-mono">
              {parseFloat(formatEther(event.amount)).toFixed(4)} S
            </div>
            <div className="text-white font-medium">
              {event.choice === 0 ? "Heads" : "Tails"}
            </div>
            <div className="text-white">
              {event.outcome === 0 ? "Heads" : "Tails"}
            </div>
            <div className={`font-bold ${event.won ? 'text-green-400' : 'text-red-400'}`}>
              {event.won ? '✅ Won' : '❌ Lost'}
            </div>
            <div className="text-gray-400 text-xs">
              {formatTimestamp(event.timestamp)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerEvents;