import { useState } from 'react';
import TokenInput from './TokenInput';

function Sidebar({ tokens = [], selectedToken, onTokenSelect, onTokenAdded, loading = false }) {
  const [showAddToken, setShowAddToken] = useState(false);

  const getRiskEmoji = (riskScore) => {
    if (riskScore < 20) return '✅';
    if (riskScore < 50) return '🟡';
    return '🔴';
  };

  const getRiskColor = (riskScore) => {
    if (riskScore < 20) return 'text-green-400';
    if (riskScore < 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="sidebar">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">Tracked Tokens</h2>
        <button
          onClick={() => setShowAddToken(true)}
          className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
        >
          + Add Token
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center">
            <div className="spinner mx-auto"></div>
            <p className="text-gray-400 text-sm mt-2">Loading tokens...</p>
          </div>
        ) : tokens.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-gray-400 text-sm">No tokens tracked yet</p>
            <p className="text-gray-500 text-xs mt-1">Add a token to get started</p>
          </div>
        ) : (
          <div className="p-2">
            {tokens.map((token) => (
              <div
                key={token.id}
                onClick={() => onTokenSelect(token)}
                className={`p-3 rounded-lg cursor-pointer transition-colors mb-2 ${
                  selectedToken?.id === token.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {token.mint.slice(0, 8)}...{token.mint.slice(-4)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {token.trace_status === 'completed' ? 
                        `${token.flaggedCount || 0} flagged` : 
                        token.trace_status
                      }
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {token.trace_status === 'completed' && (
                      <span className={`text-lg ${getRiskColor(token.risk_score)}`}>
                        {getRiskEmoji(token.risk_score)}
                      </span>
                    )}
                    {token.trace_status === 'running' && (
                      <div className="spinner"></div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddToken && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Add New Token</h3>
            <TokenInput 
              onTokenAdded={(token) => {
                onTokenAdded(token);
                setShowAddToken(false);
              }}
              onCancel={() => setShowAddToken(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default Sidebar;
